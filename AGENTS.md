# AGENTS.md

## Feature And Selector Documentation

When adding or changing a feature or external Automation Anywhere selector:

- Update `docs/FEATURE_CHECKLIST.md` with its source, selectors, validation,
  expected behavior, status, and delete condition.
- Add or update the corresponding Doctor entry in
  `src/ts/automation-anywhere-selectors.ts` for every external selector used by
  the feature.
- Reuse the same exported selector constant in runtime code and Doctor checks.

## Firefox Sidebar Opening

Firefox only allows `browser.sidebarAction.open()` from a direct user input
handler. Do not call it after `await`, from `runtime.onMessage`, or from any
async helper that runs after the click handler returns.

Current fix:

- `entrypoints/background.ts` registers a Firefox toolbar click handler.
- That handler calls `openFirefoxSidebarFromUserAction()` immediately.
- `openFirefoxSidebarFromUserAction()` calls `browser.sidebarAction.open()`
  before writing `sidepanelRequest`.
- `sidepanelRequest` is queued after the open call so the sidepanel can still
  route to the requested tab/focus.

Do not move `writeSidepanelRequest()` before `browser.sidebarAction.open()`.
That breaks Firefox with:

```text
sidebarAction.toggle may only be called from a user input handler
```

Firefox content-script messages still cannot open the sidebar directly. They
should keep returning the manual-open message that tells the user to use the
shortcut or toolbar button.

## Checks

Run after changing sidebar open behavior:

```bash
rtk corepack pnpm compile
rtk corepack pnpm build:firefox
```

## Store Uploads

Chrome upload uses Chrome Web Store API V2 with a Google Cloud service account.
Firefox upload still uses `publish-browser-extension`.
Full credential and Workload Identity setup is documented in
`docs/chrome web store credentials setup.md`.

Commands:

- `rtk corepack pnpm submit:dry-run` builds/zips Chrome and Firefox packages,
  checks Chrome with `fetchStatus`, and checks Firefox authentication without
  uploading.
- `rtk corepack pnpm submit:stores` builds/zips Chrome and Firefox packages,
  uploads both packages, then submits Chrome for review unless
  `CHROME_UPLOAD_ONLY=true`.

Upload flow:

- `pnpm zip` creates `.output/better-automationanywhere-dx-<version>-chrome.zip`.
- `pnpm zip:firefox` creates `.output/better-automationanywhere-dx-<version>-firefox.zip`
  and `.output/better-automationanywhere-dx-<version>-sources.zip`.
- `scripts/submit-stores.mjs` loads `.env.submit` when present.
- Chrome gets a short-lived token from `CWS_ACCESS_TOKEN` in CI or from local
  `gcloud` service-account impersonation, then calls V2 `upload`, `fetchStatus`,
  and `publish` endpoints.
- Firefox ZIPs are passed to `publish-extension`; Chrome is never passed to that
  OAuth/V1.1 implementation.

Environment files:

- `.env.submit.example` lists required variable names only.
- `.env.submit` holds real Chrome Web Store and Firefox Add-ons credentials.
- `.env.submit` is gitignored. Do not commit it or paste its values into logs.
- `CWS_ACCESS_TOKEN` is temporary. Do not store it in either file.

Required `.env.submit` keys:

```text
CHROME_EXTENSION_ID=
CHROME_PUBLISHER_ID=
CHROME_PROJECT_ID=
SERVICE_ACCOUNT_EMAIL=
CHROME_UPLOAD_ONLY=false

FIREFOX_EXTENSION_ID=
FIREFOX_JWT_ISSUER=
FIREFOX_JWT_SECRET=
FIREFOX_CHANNEL=listed
```

Review notes:

- Current wrapper expects ZIP names based on `package.json` `name` and `version`.
- Firefox source ZIP is included with `--firefox-sources-zip`.
- Local Chrome submission requires Google Cloud CLI, `gcloud auth login`, and
  `roles/iam.serviceAccountTokenCreator` for the configured service account.
- The service account must be added under Account in Chrome Web Store Developer
  Dashboard. Only one service account can be linked to a publisher.
- GitHub Actions uses Workload Identity Federation. Configure repository
  variables `CHROME_EXTENSION_ID`, `CHROME_PUBLISHER_ID`, `CHROME_PROJECT_ID`,
  `SERVICE_ACCOUNT_EMAIL`, and `GCP_WORKLOAD_IDENTITY_PROVIDER`. Grant the
  repository principal `roles/iam.workloadIdentityUser` on the service account.
- Restrict the Workload Identity Provider to
  `Jamir-boop/better-automationanywhere`; do not create a service-account JSON
  key.

# Source Code Review

Use this file for Firefox AMO source review.

## Build

```bash
pnpm install --frozen-lockfile
pnpm check:maintenance
pnpm zip
pnpm zip:firefox
```

## Outputs

```text
.output/better-automationanywhere-dx-<version>-chrome.zip
.output/better-automationanywhere-dx-<version>-firefox.zip
.output/better-automationanywhere-dx-<version>-sources.zip
```

## Submit

Local setup: [Chrome Web Store publishing setup](<docs/chrome web store credentials setup.md>).

Local dry run:

```bash
pnpm submit:dry-run
```

Local publish:

```bash
pnpm submit:stores
```
