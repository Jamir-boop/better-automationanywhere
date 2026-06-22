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

Local setup:

```bash
pnpm submit:init
```

Local dry run:

```bash
pnpm submit:dry-run
```

Local publish:

```bash
pnpm submit:stores
```
