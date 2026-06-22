# AGENTS.md

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

Store upload is wired through `publish-browser-extension`.

Commands:

- `rtk corepack pnpm submit:init` starts the credential setup wizard and writes
  `.env.submit`.
- `rtk corepack pnpm submit:dry-run` builds/zips Chrome and Firefox packages,
  then checks store authentication without uploading.
- `rtk corepack pnpm submit:stores` builds/zips Chrome and Firefox packages,
  then uploads them to the stores.

Upload flow:

- `pnpm zip` creates `.output/better-automationanywhere-dx-<version>-chrome.zip`.
- `pnpm zip:firefox` creates `.output/better-automationanywhere-dx-<version>-firefox.zip`
  and `.output/better-automationanywhere-dx-<version>-sources.zip`.
- `scripts/submit-stores.mjs` passes those ZIPs to `publish-extension`.
- `publish-extension` automatically loads `.env.submit`.

Environment files:

- `.env.submit.example` lists required variable names only.
- `.env.submit` holds real Chrome Web Store and Firefox Add-ons credentials.
- `.env.submit` is gitignored. Do not commit it or paste its values into logs.

Required `.env.submit` keys:

```text
CHROME_EXTENSION_ID=
CHROME_CLIENT_ID=
CHROME_CLIENT_SECRET=
CHROME_REFRESH_TOKEN=
CHROME_PUBLISH_TARGET=default
CHROME_SKIP_SUBMIT_REVIEW=false

FIREFOX_EXTENSION_ID=
FIREFOX_JWT_ISSUER=
FIREFOX_JWT_SECRET=
FIREFOX_CHANNEL=listed
```

Review notes:

- Current wrapper expects ZIP names based on `package.json` `name` and `version`.
- Firefox source ZIP is included with `--firefox-sources-zip`.
- Dry-run currently reaches Firefox but Chrome fails if Google returns
  `"deleted_client"`. Fix by rerunning `rtk corepack pnpm submit:init` or
  replacing Chrome OAuth values in `.env.submit`.
