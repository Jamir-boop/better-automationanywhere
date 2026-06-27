# Chrome Web Store Publishing Setup

This project publishes Chrome packages through Chrome Web Store API V2 using a
Google Cloud service account. Firefox continues to use
`publish-browser-extension`.

No OAuth refresh token or service-account JSON key is required.

## Project values

```powershell
$PROJECT_ID = "chrome-web-store-500215"
$SERVICE_ACCOUNT_EMAIL = "cws-uploader@chrome-web-store-500215.iam.gserviceaccount.com"
$REPOSITORY = "Jamir-boop/better-automationanywhere"
```

## Local setup

### 1. Install and authenticate gcloud

Install Google Cloud CLI from
[Google's installation guide](https://cloud.google.com/sdk/docs/install), then
open a new PowerShell session.

```powershell
gcloud --version
gcloud auth login
gcloud config set project $PROJECT_ID
```

Application Default Credentials are not used by the publishing script.

### 2. Enable APIs

```powershell
gcloud services enable chromewebstore.googleapis.com iamcredentials.googleapis.com sts.googleapis.com --project=$PROJECT_ID
```

### 3. Grant local impersonation

Run with a project owner or IAM administrator account. Replace
`YOUR_GOOGLE_EMAIL` with the Google account returned by `gcloud auth list`.

```powershell
gcloud iam service-accounts add-iam-policy-binding $SERVICE_ACCOUNT_EMAIL --member="user:YOUR_GOOGLE_EMAIL" --role="roles/iam.serviceAccountTokenCreator" --project=$PROJECT_ID
```

IAM changes can take several minutes to propagate.

### 4. Link Chrome Web Store publisher

In Chrome Web Store Developer Dashboard:

1. Open **Account** and add `$SERVICE_ACCOUNT_EMAIL` as the publisher service
   account.
2. Open **Publisher → Settings** and copy publisher ID.

Only one service account can be linked to a publisher.

### 5. Configure `.env.submit`

Use `.env.submit.example` as the source of truth. Required Chrome values:

```env
CHROME_EXTENSION_ID=
CHROME_PUBLISHER_ID=
CHROME_PROJECT_ID=chrome-web-store-500215
SERVICE_ACCOUNT_EMAIL=cws-uploader@chrome-web-store-500215.iam.gserviceaccount.com
CHROME_UPLOAD_ONLY=false
```

Keep existing Firefox values from `.env.submit.example`. `.env.submit` is
gitignored and must never be committed.

### 6. Verify impersonation

Use the same scope and project as the publishing script:

```powershell
gcloud auth print-access-token --impersonate-service-account=$SERVICE_ACCOUNT_EMAIL --scopes=https://www.googleapis.com/auth/chromewebstore --project=$PROJECT_ID
```

A token beginning with `ya29.` confirms token creation. Do not copy it into an
environment file or logs.

### 7. Run local dry run

```powershell
corepack pnpm submit:dry-run
```

Expected success includes:

```text
Chrome Web Store: authenticated (<current state>)
✔ Firefox Addon Store
```

Dry run calls Chrome `fetchStatus` and checks Firefox authentication. It does
not upload packages.

## GitHub Actions setup

GitHub Actions uses Workload Identity Federation instead of a JSON key.

### 1. Create restricted Workload Identity provider

```powershell
gcloud iam workload-identity-pools create github --project=$PROJECT_ID --location=global --display-name="GitHub Actions"
gcloud iam workload-identity-pools providers create-oidc better-automationanywhere --project=$PROJECT_ID --location=global --workload-identity-pool=github --display-name="better-automationanywhere" --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.repository_owner=assertion.repository_owner" --attribute-condition="assertion.repository == '$REPOSITORY'" --issuer-uri="https://token.actions.githubusercontent.com"
$POOL_NAME = gcloud iam workload-identity-pools describe github --project=$PROJECT_ID --location=global --format="value(name)"
gcloud iam service-accounts add-iam-policy-binding $SERVICE_ACCOUNT_EMAIL --project=$PROJECT_ID --role="roles/iam.workloadIdentityUser" --member="principalSet://iam.googleapis.com/$POOL_NAME/attribute.repository/$REPOSITORY"
gcloud iam workload-identity-pools providers describe better-automationanywhere --project=$PROJECT_ID --location=global --workload-identity-pool=github --format="value(name)"
```

Copy final command output. It is full provider resource name used by
`GCP_WORKLOAD_IDENTITY_PROVIDER`.

### 2. Configure GitHub repository variables

Open **Settings → Secrets and variables → Actions → Variables** and add:

```text
CHROME_EXTENSION_ID
CHROME_PUBLISHER_ID
CHROME_PROJECT_ID
SERVICE_ACCOUNT_EMAIL
GCP_WORKLOAD_IDENTITY_PROVIDER
```

Keep these Firefox values under **Secrets**:

```text
FIREFOX_EXTENSION_ID
FIREFOX_JWT_ISSUER
FIREFOX_JWT_SECRET
```

### 3. Test workflow

Run **Publish Stores** from GitHub Actions with `dry_run=true`. After it passes,
run with `dry_run=false` for a real release. Set `chrome_upload_only=true` to
upload Chrome ZIP without submitting it for review.

## Troubleshooting

### `gcloud` is not recognized

Open a new PowerShell session after installing Google Cloud CLI, then run
`gcloud --version`.

### No active account

```powershell
gcloud auth login
gcloud auth list
```

### `iam.serviceAccounts.getAccessToken` denied

Grant local user `roles/iam.serviceAccountTokenCreator` on service account,
wait several minutes, then retry scoped token command.

### Chrome Web Store returns `403`

Confirm Chrome Web Store API is enabled, service account is linked under
Developer Dashboard **Account**, and `CHROME_PUBLISHER_ID` belongs to selected
publisher.
