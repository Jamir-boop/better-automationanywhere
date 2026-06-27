# Better AA Feature Checklist

Manual validation source of truth for extension features, selectors, and cleanup.

Status values:
- `active`: keep and validate.
- `watch`: works or is needed now, but selector/API is brittle.
- `deprecated`: retained only for compatibility.
- `remove-candidate`: safe to remove after manual validation confirms unused.

Selector source of truth:
- External Automation Anywhere DOM selectors live in `src/ts/automation-anywhere-selectors.ts`.
- Extension-owned sidepanel selectors, generated ids, classes, and data attributes stay local to their component.
- Delete rule: do not delete selectors/features until this checklist has a dated manual validation note.

## Core Extension Lifecycle

- [ ] Content script loads on Automation Anywhere pages
  - Source: `entrypoints/content.ts`, `wxt.config.ts`
  - Setting/id: `AUTOMATION_ANYWHERE_MATCHES`
  - Selectors: route/url based
  - Validate: open supported Control Room page and confirm sidebar button, styles, shortcuts, and tools initialize.
  - Expected: no console errors; route class updates when moving between folder/taskbot/text pages.
  - Status: active
  - Delete condition: never delete unless extension host matching changes.

- [ ] Background message router
  - Source: `entrypoints/background.ts`, `src/ts/messages.ts`
  - Setting/id: `RuntimeMessage`
  - Selectors: none
  - Validate: toggle settings, open sidepanel, run tools API calls.
  - Expected: messages return `ok: true` or useful local debug error.
  - Status: active
  - Delete condition: message type removed from all callers.

- [ ] Chrome side panel open
  - Source: `entrypoints/background.ts`, `src/ts/sidepanel-state.ts`
  - Setting/id: `OPEN_SIDEBAR`
  - Selectors: none
  - Validate: click page button, command palette command, toolbar icon, shortcut.
  - Expected: sidepanel opens and optional tab/focus request is applied.
  - Status: active
  - Delete condition: browser extension side panel API replaced.

- [ ] Firefox sidebar open
  - Source: `entrypoints/background.ts`, `AGENTS.md`
  - Setting/id: `openFirefoxSidebarFromUserAction`
  - Selectors: none
  - Validate: toolbar click opens sidebar; content-script request shows manual-open message.
  - Expected: no `sidebarAction.toggle may only be called from a user input handler`.
  - Status: active
  - Delete condition: Firefox removes user-action restriction.

- [ ] Route change watcher
  - Source: `entrypoints/content.ts`
  - Setting/id: `AA_ROUTE_CHANGED`
  - Selectors: route/url based
  - Validate: navigate between Control Room pages without full reload.
  - Expected: sidepanel tools refresh and page classes update.
  - Status: active
  - Delete condition: WXT route/content lifecycle replaces manual watcher.

## Sidepanel

- [ ] Tools tab
  - Source: `entrypoints/sidepanel/tools.ts`
  - Setting/id: `data-panel="tools"`
  - Selectors: internal sidepanel only
  - Validate: open sidepanel on unsupported, folder, taskbot, and packages pages.
  - Expected: availability dot, context text, and tool buttons match page.
  - Status: active
  - Delete condition: tools panel replaced.

- [ ] UI tab
  - Source: `entrypoints/sidepanel/main.ts`, `src/ts/settings.ts`
  - Setting/id: `STYLE_FEATURES`, `STYLE_VALUE_FIELDS`
  - Selectors: internal sidepanel only
  - Validate: toggle each UI feature and color/upload control.
  - Expected: content page updates without reload where supported.
  - Status: active
  - Delete condition: settings move to browser options page.

- [ ] Settings/About tab
  - Source: `entrypoints/sidepanel/main.ts`, `src/ts/help.ts`
  - Setting/id: language, shortcuts, debug, suggestions, keep alive
  - Selectors: internal sidepanel only
  - Validate: change each setting and reload sidepanel/page.
  - Expected: persisted values restore; About help renders current shortcuts.
  - Status: active
  - Delete condition: settings surface replaced.

- [ ] Health tab
  - Source: `entrypoints/sidepanel/main.ts`, `src/ts/style-doctor.ts`
  - Setting/id: `RUN_STYLE_DOCTOR_CHECK`
  - Selectors: `AUTOMATION_ANYWHERE_SELECTOR_CHECKS`
  - Validate: run General, Taskbot Editor, Folder Navigation checks.
  - Expected: rows show feature, selector, source, severity, selector status, count.
  - Status: active
  - Delete condition: external validation moves elsewhere.

- [ ] Debug Logs tab
  - Source: `entrypoints/sidepanel/main.ts`, `src/ts/debug.ts`
  - Setting/id: `local:debugFeedbackHistory`
  - Selectors: internal sidepanel only
  - Validate: create warn/error/debug events, copy logs, clear logs.
  - Expected: logs stay local; copy text includes header and redacted details.
  - Status: active
  - Delete condition: local debugging replaced.

## UI Improvements

- [ ] Injected styles master toggle
  - Source: `src/ts/settings.ts`, `entrypoints/content.ts`
  - Setting/id: `local:stylesEnabled`
  - Selectors: root class `better-aa-styles-enabled`
  - Validate: disable and enable injected styles.
  - Expected: all style feature classes stop applying when disabled.
  - Status: active
  - Delete condition: style features removed.

- [ ] Palette buttons
  - Source: `src/ts/ui.ts`, `src/styl/editorActionsVariablesTriggers.styl`
  - Setting/id: `customPaletteButtons`
  - Selectors: `editor-palette`, `editor-palette-scroller`, palette actions/variables/triggers
  - Validate: switch Actions, Variables, Triggers on `/edit`; open private and public taskbots on `/view`.
  - Expected: compact custom buttons render only on editable taskbots; `/view` keeps native Automation Anywhere palette selectors visible.
  - Status: active
  - Delete condition: Automation Anywhere palette redesign makes buttons redundant.

- [ ] Run button style
  - Source: `src/ts/run-button-animation.ts`
  - Setting/id: `runButton`
  - Selectors: `run-button`, `RUN_BUTTON_SELECTOR`
  - Validate: enable Run button style and hover Run.
  - Expected: gradient, glow, sweep, fill, and icon pop render.
  - Status: active
  - Delete condition: feature intentionally removed.

- [ ] Run button wave rings
  - Source: `src/ts/run-button-animation.ts`
  - Setting/id: `local:runButtonWaves`
  - Selectors: `run-button`
  - Validate: enable Run style and Wave rings; hover Run.
  - Expected: canvas rings animate with custom background colors.
  - Status: active
  - Delete condition: animation removed or browser performance issue confirmed.

- [ ] Custom background gradient
  - Source: `src/styl/background.styl`, `src/styl/utils.styl`, `entrypoints/content.ts`
  - Setting/id: `bgStyle`, `backgroundColor1`, `backgroundColor3`
  - Selectors: `page-background`
  - Validate: change both colors and opacity.
  - Expected: TaskBot/folder background gradient updates; Run effect uses RGB palette.
  - Status: active
  - Delete condition: style feature removed.

- [ ] Loading animation replacement
  - Source: `src/styl/customLoadingIcon.styl`, `entrypoints/sidepanel/main.ts`
  - Setting/id: `loadingCat`, `userBg`, `userBgSize`
  - Selectors: `loading-indicator`
  - Validate: upload png/jpg/webp/gif, change sizing, restore default.
  - Expected: loading spinner area uses selected image without storage errors.
  - Status: active
  - Delete condition: spinner selector removed and no replacement exists.

- [ ] Hide editor tabs
  - Source: `src/styl/editorTabsButtons.styl`
  - Setting/id: `editorTabsButtons`
  - Selectors: `editor-tabs`
  - Validate: enable on taskbot editor.
  - Expected: Flow/List/Dual tab button group is hidden.
  - Status: active
  - Delete condition: tabs no longer exist.

- [ ] Minimize running bot window
  - Source: `src/ts/bot-execution-modal.ts`, `src/styl/botExecutionModal.styl`
  - Setting/id: `minimizeBotModal`, `botExecutionModalPosition`
  - Selectors: `bot-modal`, `bot-modal-controls`, `bot-modal-dialog`, `bot-modal-running-indicator`
  - Validate: run taskbot, minimize/maximize modal, test all four positions.
  - Expected: modal minimizes without trapping page; aria-modal restored on maximize.
  - Status: active
  - Delete condition: running bot modal markup changes beyond repair.

- [ ] Scrollable folders
  - Source: `src/ts/folders.ts`, `src/styl/foldersScrollable.styl`
  - Setting/id: `makeSidebarScrollable`
  - Selectors: `folder-list`, `folder-list-item`, `active-folder`
  - Validate: open deep folder list.
  - Expected: active folder scrolls into view and sidebar remains usable.
  - Status: active
  - Delete condition: folder sidebar redesign removes overflow issue.

- [ ] Folder columns
  - Source: `src/styl/foldersColumns.styl`, `src/styl/utils.styl`
  - Setting/id: `adjustFolderColumnsWidth`
  - Selectors: `folder-table-row`, `folder-table-column`, `folder-table-header`
  - Validate: open private/public folder table.
  - Expected: columns are wider and readable.
  - Status: active
  - Delete condition: table layout fixed upstream.

- [ ] Slim sidebar
  - Source: `src/ts/ui.ts`, `src/styl/rootSidebarAutoHide.styl`
  - Setting/id: `pathFinder`
  - Selectors: `main-navigation`, `pathfinder-expander`, `pathfinder-collapsed`
  - Validate: enable, hover sidebar, try expander click.
  - Expected: sidebar collapses until hover; expander guarded while feature enabled.
  - Status: active
  - Delete condition: Pathfinder removed or replaced.

- [ ] Long text/code input readability
  - Source: `src/styl/codeInput.styl`, `src/styl/taskbot.styl`
  - Setting/id: injected styles
  - Selectors: `code-input`, text input content selectors in Stylus
  - Validate: open command with long expression/path/json.
  - Expected: content wraps and scrolls vertically.
  - Status: active
  - Delete condition: native editor handles long text.

- [ ] Resource center hide
  - Source: `src/styl/taskbot.styl`
  - Setting/id: injected styles
  - Selectors: `button[data-pendo-stashed-aria-label="Open Resource Center"]`
  - Validate: open taskbot page.
  - Expected: Resource Center button hidden.
  - Status: watch
  - Delete condition: selector no longer appears for two release validations.

- [ ] Close button/background tweaks
  - Source: `src/styl/taskbot.styl`
  - Setting/id: injected styles
  - Selectors: close command button selectors in Stylus
  - Validate: open editor dialogs and hover close controls.
  - Expected: close/control backgrounds stay consistent.
  - Status: active
  - Delete condition: dialog styles no longer need override.

## Command Palette

- [ ] Command palette open/close
  - Source: `src/ts/palette.ts`, `src/ts/initialize.ts`
  - Setting/id: `commandPaletteEnabled`, `commandPaletteShortcut`
  - Selectors: extension-owned `#commandPalette`
  - Validate: `Alt + P`, `/` when configured, outside click, Escape.
  - Expected: palette opens, predictions render, closes cleanly.
  - Status: active
  - Delete condition: command palette removed.

- [ ] Static bot commands
  - Source: `src/ts/commands.ts`, `src/ts/help.ts`
  - Setting/id: `getCommandsWithAliases`
  - Selectors: palette actions/variables/triggers, add variable, delete unused selectors
  - Validate: run `add variable`, `actions`, `variables`, `triggers`, `delete unused`.
  - Expected: matching Automation Anywhere UI opens.
  - Status: active
  - Delete condition: command removed or target UI removed.

- [ ] Dynamic navigation commands
  - Source: `src/ts/commands.ts`
  - Setting/id: `getCommandsWithNavigation`
  - Selectors: `sidebar-nav-links`
  - Validate: open palette on Control Room with sidebar nav.
  - Expected: available sidebar destinations appear without alias collisions.
  - Status: active
  - Delete condition: Control Room removes sidebar navigation.

- [ ] Line jump
  - Source: `src/ts/commands.ts`
  - Setting/id: `:<line>`
  - Selectors: `taskbot-line-number`
  - Validate: type `:1` and invalid high number.
  - Expected: valid line scrolls/highlights; invalid line logs warning.
  - Status: active
  - Delete condition: line number UI removed.

- [ ] Command help
  - Source: `src/ts/help.ts`, `src/ts/commands.ts`
  - Setting/id: `help`
  - Selectors: none
  - Validate: open help from command palette and About.
  - Expected: shortcuts and commands match current settings.
  - Status: active
  - Delete condition: help surface replaced.

- [ ] Mouse click suggestions
  - Source: `src/ts/suggestions.ts`
  - Setting/id: `showSuggestions`
  - Selectors: palette/action/variable/toggle selectors
  - Validate: click supported UI with suggestions enabled/disabled.
  - Expected: tips show once with cooldown; disabled means no tips.
  - Status: active
  - Delete condition: suggestions feature removed.

## Clipboard And Action JSON

- [ ] Universal clipboard auto slot
  - Source: `src/ts/clipboard.ts`, `src/ts/universal-clipboard-storage.ts`
  - Setting/id: `local:universalClipboard`, slot `0`
  - Selectors: `shared-copy-button`, `shared-paste-button`, task editor capability selector
  - Validate: use native AA shared copy.
  - Expected: auto slot updates from `globalClipboard` watcher.
  - Status: active
  - Delete condition: AA shared clipboard mechanism removed.

- [ ] Clipboard slots 0 to 3
  - Source: `entrypoints/sidepanel/main.ts`, `src/ts/clipboard.ts`
  - Setting/id: `local:universalClipboardSlot1..3`
  - Selectors: shared copy/paste
  - Validate: copy selection to each slot, paste each slot.
  - Expected: correct slot content is pasted with fresh uid.
  - Status: active
  - Delete condition: slot UI removed.

- [ ] Export action JSON
  - Source: `src/ts/commands.ts`, `src/ts/clipboard.ts`
  - Setting/id: command `exportActionToClipboard`
  - Selectors: shared copy button
  - Validate: copy an action and run export command.
  - Expected: sanitized action JSON lands in system clipboard.
  - Status: active
  - Delete condition: import/export workflow replaced by tools.

- [ ] Import action JSON
  - Source: `src/ts/commands.ts`, `entrypoints/sidepanel/main.ts`, `src/ts/clipboard.ts`
  - Setting/id: command `importActionFromJson`, `IMPORT_ACTION_JSON`
  - Selectors: shared paste button
  - Validate: paste valid and invalid JSON into Action JSON field.
  - Expected: valid JSON queues paste; invalid JSON shows error.
  - Status: active
  - Delete condition: workflow replaced by Taskbot JSON tool.

- [ ] Sensitive field cleanup
  - Source: `src/ts/clipboard.ts`
  - Setting/id: `clearSensitiveFields`
  - Selectors: none
  - Validate: export copied action with blobs/screenshots.
  - Expected: blob/screenshot fields are cleared.
  - Status: active
  - Delete condition: no sensitive payloads are present in AA clipboard JSON.

## Variable Metadata

- [ ] Variable metadata fetch
  - Source: `entrypoints/content.ts`, `src/ts/variable-metadata.ts`
  - Setting/id: implicit taskbot editor feature
  - Selectors: `editor-palette-variables`, `variable-row`, `variable-label`
  - Validate: open Variables on private/public taskbots in `/edit` and `/view`.
  - Expected: bot content loads once per file and labels update under the active Variables header, including the disabled read-only button on `/view`.
  - Status: active
  - Delete condition: variable metadata feature removed.

- [ ] Variable default/description labels
  - Source: `src/ts/variable-metadata.ts`
  - Setting/id: `extractVariableMetadataLookup`
  - Selectors: variable row/label selectors
  - Validate: variables with string/list/dictionary/default/description.
  - Expected: label shows IO arrows, default value, or description; empty dictionary with description uses description.
  - Status: active
  - Delete condition: feature removed.

- [ ] Missing metadata retry
  - Source: `entrypoints/content.ts`
  - Setting/id: retry counter/signature
  - Selectors: variable row/label selectors
  - Validate: open variables before metadata loads.
  - Expected: retries fill missing labels or logs one exhausted warning.
  - Status: active
  - Delete condition: variable list rendering becomes synchronous/reliable.

## Tools

- [ ] Tool context detection
  - Source: `entrypoints/sidepanel/tools.ts`, `src/ts/automation-anywhere-api.ts`
  - Setting/id: `getActiveAutomationAnywhereContext`
  - Selectors: route/url based and task editor capability selector
  - Validate: non-AA active tab, unsupported AA route, private/public folder, private/public taskbot, packages page, package detail page.
  - Expected: correct tools appear for page and capabilities; no-tools context names current host when active tab is not an AA tools page.
  - Status: active
  - Delete condition: tools panel removed.

- [ ] Copy Files
  - Source: `entrypoints/sidepanel/tools.ts`
  - Setting/id: tool `copy-files`
  - Selectors: none; API/list based
  - Validate: select files in folder and copy.
  - Expected: copied file refs stored in extension memory and paste available in other folder on same host.
  - Status: active
  - Delete condition: copy-file API unavailable.

- [ ] Paste copied files
  - Source: `entrypoints/sidepanel/tools.ts`
  - Setting/id: copy-files paste action
  - Selectors: none; API/list based
  - Validate: paste into different folder with duplicate and non-duplicate names.
  - Expected: duplicates skipped, copies created, folder refresh requested.
  - Status: active
  - Delete condition: copy-file API unavailable.

- [ ] Update Packages
  - Source: `entrypoints/sidepanel/tools.ts`, `src/ts/automation-anywhere-tools.ts`, `src/ts/automation-anywhere-api.ts`
  - Setting/id: tool `update-packages`
  - Selectors: none; API/content based
  - Validate: on private taskbot `/edit`, deselect one of multiple outdated packages and update; also test private `/view` and folder mode.
  - Expected: `/edit` lists outdated packages with current/default versions and updates only selected packages; `/view` and folder mode retain update-all behavior.
  - Status: active
  - Delete condition: AA package schema changes beyond repair.

- [ ] Export Bots ZIP
  - Source: `entrypoints/sidepanel/tools.ts`
  - Setting/id: tool `export-bots`, format `zip`
  - Selectors: none; API/content/dependency based
  - Validate: export taskbot with dependencies and uploaded files.
  - Expected: ZIP downloads with manifest, metadata, content, package list.
  - Status: active
  - Delete condition: export feature replaced by native AA export.

- [ ] Export Bots separate files
  - Source: `entrypoints/sidepanel/tools.ts`
  - Setting/id: tool `export-bots`, format `separate`
  - Selectors: none; API/blob based
  - Validate: enable legacy mode or choose Separate files.
  - Expected: selected files download individually.
  - Status: active
  - Delete condition: separate export removed.

- [ ] Download Packages
  - Source: `entrypoints/sidepanel/tools.ts`
  - Setting/id: tool `download-packages`
  - Selectors: none; API/package list based
  - Validate: open Packages page, search packages, load more, select packages, download; open package detail page and download package versions.
  - Expected: first load is capped, search fetches matching package rows, progress updates during fallback scans, package detail page scopes to opened package, missing download URL is reported.
  - Status: active
  - Delete condition: packages API unavailable.

- [ ] Package Usage
  - Source: `entrypoints/sidepanel/tools.ts`, `src/ts/automation-anywhere-api.ts`, `src/ts/automation-anywhere-tools.ts`
  - Setting/id: tool `package-usage`
  - Selectors: none; API/package usage based
  - Validate: open Packages page, search/select one package version, view usage; open package detail page and view usage without selecting a version.
  - Expected: all usage rows load automatically and show bot name/path/status and copy path, package detail usage groups rows by collapsible version, missing versions mean no usage found, `ENABLED`/`DISABLED` status filters do not trigger `No enum constant`.
  - Status: active
  - Delete condition: package usage API unavailable.

- [ ] Taskbot JSON load/edit/save
  - Source: `entrypoints/sidepanel/tools.ts`
  - Setting/id: tool `taskbot-json`
  - Selectors: none; API/content based
  - Validate: load current bot JSON, edit valid/invalid JSON, save.
  - Expected: valid save updates Control Room; invalid JSON disables save or shows error.
  - Status: active
  - Delete condition: raw taskbot JSON edit removed.

- [ ] JSON workbench
  - Source: `entrypoints/sidepanel/json-workbench.ts`, `entrypoints/sidepanel/json-info.ts`
  - Setting/id: search/replace/copy/format/export/details controls
  - Selectors: internal sidepanel only
  - Validate: search next/prev, replace one/all, copy, format, export, inspect details tabs.
  - Expected: JSON remains valid when required; details list packages/actions/variables/references.
  - Status: active
  - Delete condition: JSON editing removed.

## Automation Anywhere API Bridge

- [ ] Auth token retrieval
  - Source: `src/ts/automation-anywhere-api.ts`, `entrypoints/content.ts`
  - Setting/id: `GET_AA_AUTH_TOKEN`
  - Selectors: localStorage key based
  - Validate: tools run on active AA tab and on fallback scripting path.
  - Expected: token found or useful local debug warning.
  - Status: active
  - Delete condition: AA auth storage changes.

- [ ] API request proxy
  - Source: `entrypoints/background.ts`, `src/ts/automation-anywhere-api.ts`
  - Setting/id: `AA_API_REQUEST`
  - Selectors: none
  - Validate: tools call list/content/package endpoints.
  - Expected: JSON/blob responses return; failures log status/method/path.
  - Status: active
  - Delete condition: tools no longer need background proxy.

- [ ] Folder refresh bridge
  - Source: `entrypoints/content.ts`, `src/ts/automation-anywhere-api.ts`
  - Setting/id: `REFRESH_AA_FOLDER_LIST`
  - Selectors: `folder-refresh`
  - Validate: paste copied files and watch folder refresh.
  - Expected: refresh button clicked when present; false result otherwise.
  - Status: active
  - Delete condition: folder refresh API replaces button click.

- [ ] Dependency fallback
  - Source: `src/ts/automation-anywhere-api.ts`
  - Setting/id: `getBotDependencies`
  - Selectors: none
  - Validate: export multiple bots when batch endpoint fails.
  - Expected: per-file fallback runs and logs warning.
  - Status: active
  - Delete condition: batch endpoint stable and fallback no longer needed.

## Health, Debug, Compatibility

- [ ] Style Doctor selector checks
  - Source: `src/ts/style-doctor.ts`, `src/ts/automation-anywhere-selectors.ts`
  - Setting/id: `AUTOMATION_ANYWHERE_SELECTOR_CHECKS`
  - Selectors: central registry
  - Validate: run checks on all supported views.
  - Expected: static Doctor list tracks registry; transient items skip when missing.
  - Status: active
  - Delete condition: replaced by automated browser validation.

- [ ] Supported Control Room compatibility
  - Source: `src/ts/control-room-version.ts`, `entrypoints/background.ts`
  - Setting/id: `SUPPORTED_CONTROL_ROOM_TARGETS`, force unsupported toggle
  - Selectors: none
  - Validate: supported, unsupported, unknown version states.
  - Expected: styles block only when unsupported unless force enabled.
  - Status: active
  - Delete condition: support policy removed.

- [ ] Debug mode
  - Source: `src/ts/debug.ts`, `src/ts/debug-utils.ts`
  - Setting/id: `local:debugEnabled`
  - Selectors: none
  - Validate: toggle Debug Mode and trigger info/warn/error events.
  - Expected: debug-only info stored only when enabled; warn/error always stored.
  - Status: active
  - Delete condition: debug system replaced.

- [ ] Copy-for-AI debug log
  - Source: `entrypoints/sidepanel/main.ts`
  - Setting/id: copy feedback action
  - Selectors: internal sidepanel only
  - Validate: copy logs with entries and empty logs.
  - Expected: header includes generated timestamp, extension version, browser target, entry count.
  - Status: active
  - Delete condition: support workflow changes.

## Settings And Localization

- [ ] Language preference
  - Source: `src/ts/i18n.ts`, `src/ts/settings.ts`
  - Setting/id: `extensionLanguage`
  - Selectors: none
  - Validate: auto/en/es and reload.
  - Expected: sidepanel and content labels use selected locale.
  - Status: active
  - Delete condition: localization removed.

- [ ] Force English locale
  - Source: `src/ts/initialize.ts`
  - Setting/id: `forceEnglishLocale`
  - Selectors: none
  - Validate: enable on Control Room page.
  - Expected: extension attempts to keep English assumptions stable.
  - Status: active
  - Delete condition: selectors become locale-independent.

- [ ] Keep alive
  - Source: `entrypoints/content.ts`
  - Setting/id: `keepAliveEnabled`
  - Selectors: none
  - Validate: enable and observe periodic activity event.
  - Expected: interval starts/stops with setting.
  - Status: active
  - Delete condition: no longer needed.

- [ ] Configurable shortcuts
  - Source: `src/ts/settings.ts`, `entrypoints/background.ts`, `src/ts/initialize.ts`
  - Setting/id: command palette shortcut, open sidebar shortcut
  - Selectors: none
  - Validate: change shortcuts and reload page.
  - Expected: command palette/sidebar shortcuts match selected values; browser command update attempted.
  - Status: active
  - Delete condition: shortcuts become fixed.

## Release And Maintenance

- [ ] Compile/build checks
  - Source: `package.json`
  - Setting/id: `compile`, `build`, `build:firefox`, `check:maintenance`
  - Selectors: none
  - Validate: run maintenance before release.
  - Expected: TypeScript, tests, Chrome build, Firefox build pass.
  - Status: active
  - Delete condition: build system replaced.

- [ ] Store submit dry-run/stores
  - Source: `scripts/submit-stores.mjs`, `AGENTS.md`
  - Setting/id: `.env.submit`
  - Selectors: none
  - Validate: run dry-run with valid credentials.
  - Expected: ZIPs generated and store authentication checked/uploaded.
  - Status: active
  - Delete condition: publishing workflow replaced.

- [ ] Version update script
  - Source: `scripts/update-version.mjs`
  - Setting/id: package/manifest version
  - Selectors: none
  - Validate: run version update in dry manual review.
  - Expected: package and generated manifests align.
  - Status: active
  - Delete condition: release automation replaces script.
