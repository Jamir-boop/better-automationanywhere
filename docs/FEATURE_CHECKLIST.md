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
- Validation format: `Validated: YYYY-MM-DD — browser, Control Room build, result.` Use `Validated: pending — reason` until checked.

## Core Extension Lifecycle

- [ ] Better Recorder localhost bridge
  - Source: `src/ts/recorder/ws-client.ts`, `entrypoints/recorder.content.ts`, `entrypoints/background.ts`
  - Setting/id: Chrome/Edge only; `local:recorderBridgeEnabled` (default `true`), `local:recorderBridgePort` (default `8765`), `local:recorderBridgeToken`; all rows are hidden on Firefox and port/token rows are hidden while disabled.
  - Selectors: web-page selectors are generated at runtime by `src/ts/recorder/selector.ts`; no Automation Anywhere external selector.
  - Validate: on Chrome/Edge, confirm failed loopback connections retry after 3, 6, 12, then 20 seconds; start BetterRecorder on `127.0.0.1:8765` and confirm the delay resets before `hello` then `ping`; verify runtime-only injection after `selectTab`; exercise `listTabs`, `navigate`, `observePage`, semantic target descriptors, state-aware form verbs, interaction glow, throttled screenshots, and debugger click. On Firefox, confirm settings, bridge startup, recorder output, and `<all_urls>` are absent.
  - Expected: zero-config mode trusts the process owning the configured loopback port; the optional token authenticates the extension to BetterRecorder but is not mutual server authentication. Only one reconnect is pending, retries cap at 20 seconds, and disabling or changing bridge settings cancels and resets the connection lifecycle. Runtime injection occurs only for the selected tab; leaving or closing it returns `NO_TAB`; click navigation settles before the response; DOM requests return protocol results or `NO_MATCH`/`NOT_VISIBLE`/`NO_TAB`/`TIMEOUT`/`NOT_ALLOWED`/`INTERNAL`; password reads are rejected and debugger clicks detach after use. Firefox retains only its Automation Anywhere host permissions.
  - Validated: pending — v2 live Java/browser checkpoints required.
  - Status: active
  - Delete condition: BetterRecorder package support is removed or replaced by a native bridge.

- [ ] Content script loads on Automation Anywhere pages
  - Source: `entrypoints/content.ts`, `wxt.config.ts`
  - Setting/id: `AUTOMATION_ANYWHERE_MATCHES`
  - Selectors: route/url based
  - Validate: open a supported Control Room page; use SPA navigation, clicks, and shortcuts; confirm sidebar button, styles, palette controls, and tools initialize without recurring UI polling.
  - Expected: no console errors or permanent one-second/five-second UI timers; route signals in the same animation frame coalesce into one lifecycle update, and route classes and injected UI update when moving between folder/taskbot/text pages.
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
  - Validate: toolbar click, configured shortcut, and **Open extension sidebar** context-menu item each open the sidebar; content-script requests show the manual-open message.
  - Expected: toolbar, shortcut, context-menu, and notification handlers call `browser.sidebarAction.open()` before async work; no `sidebarAction.open may only be called from a user input handler` or equivalent `toggle` error.
  - Status: active
  - Delete condition: Firefox removes user-action restriction.

- [ ] Route change watcher
	- Source: `entrypoints/content.ts`, `entrypoints/sidepanel/main.ts`, `entrypoints/sidepanel/tools.ts`
	- Setting/id: `AA_ROUTE_CHANGED`, `session:toolsWindowSelection:{windowId}`; active-tab following is user-approved always on.
	- Selectors: route/url based
	- Validate: select a Tools page, navigate it without full reload, activate supported and unsupported tabs, switch another browser window, then repeat while a job runs.
	- Expected: an idle selected page accepts an eligible route and reloads its tools automatically; supported authenticated active tabs in the side panel's window select their room and page, while unrelated, logged-out, unsupported, and other-window tabs leave the last valid target unchanged. A running job keeps its captured target and applies the latest eligible activation after completion.
  - Status: active
  - Delete condition: WXT route/content lifecycle replaces manual watcher.

## Sidepanel

- [ ] Lucide action icons
	- Source: `src/ts/icons.ts`, `entrypoints/sidepanel/main.ts`, `entrypoints/sidepanel/tools.ts`, `src/ts/ui.ts`, `src/ts/bot-execution-modal.ts`
	- Setting/id: none; user-requested always-on visual language. `lucide` is pinned and only named icons are bundled.
	- Selectors: extension-owned `.better-aa-icon` and `data-lucide`; no Automation Anywhere external selector.
	- Validate: inspect the side panel, full options routes, launcher, TaskBot palette controls, notification close control, and minimized bot window in Chrome and Firefox at normal and 200% zoom; use keyboard focus on icon-only controls.
	- Expected: icons support visible labels where space permits; icon-only buttons keep an accessible button name and target size; dynamic labels retain their icon; SVG strokes use `currentColor` without filled paths; no remote icon asset or full icon catalog is bundled.
	- Status: active
	- Delete condition: the extension visual language no longer uses icons or Lucide is replaced.

- [ ] Full configuration options page
	- Source: `entrypoints/options/index.html`, `entrypoints/options/main.ts`, `entrypoints/sidepanel/main.ts`, `wxt.config.ts`
	- Setting/id: browser `options_ui`; routes `#appearance`, `#settings`, `#help`
	- Selectors: extension-owned IDs only
	- Validate: open from the browser extension details page and **Open full settings**; inspect all three routes in Chrome and Firefox at 200% zoom and a narrow viewport; change settings in both surfaces.
  - Expected: one centered 760–840px configuration column reuses the side-panel markup, handlers, and storage wiring; stable routes and Help section anchors open the correct primary tab and subtab; Tools and its tab listeners load only in the side panel, while Tools and live Diagnostics are not available in Options; global changes synchronize across open extension surfaces.
	- Status: active
	- Delete condition: browser options support is removed.

- [ ] Tools tab
	- Source: `entrypoints/sidepanel/tools.ts`, `src/ts/control-room-targets.ts`
	- Setting/id: `data-panel="tools"`, `session:toolsWindowSelection:{windowId}`; active-tab following is user-approved always on.
	- Selectors: internal sidepanel only
	- Validate: open Tools with signed-in Control Rooms in the current window, including eligible and unsupported pages; repeat with another browser window and unrelated sites; switch active tabs; change route; close and log out of the selected page; use the round Refresh control.
	- Expected: selectors share one full-width row as equal 50/50 columns and use the 36px secondary-control height; authenticated pages group by hostname. On open and idle tab activation, a supported authenticated active page selects its Control Room and page. Selecting a room chooses its active eligible page or its first eligible page and immediately refreshes Tools; manual page selection also refreshes immediately. Each browser window stores an independent target. Selector labels omit a trailing `.my.automationanywhere.digital`, and TaskBot page labels omit `| Edit Task Bot` plus the browser-title suffix, while stored origins and full page titles remain unchanged; only Folder, TaskBot, and Packages pages are selectable. When no room or supported page is available, every tool remains visible but disabled under a clear target status. Refresh is a recovery command for login changes, missed events, and connection errors rather than a normal navigation step.
  - Status: active
  - Delete condition: tools panel replaced.

- [ ] Appearance tab
  - Source: `entrypoints/sidepanel/main.ts`, `src/ts/settings.ts`
  - Setting/id: `STYLE_FEATURES`, `STYLE_VALUE_FIELDS`
  - Selectors: internal sidepanel only
  - Validate: toggle each UI feature and color/upload control.
  - Expected: content page updates without reload where supported.
  - Status: active
	- Delete condition: appearance controls are removed.

- [ ] Settings and Help tabs
  - Source: `entrypoints/sidepanel/main.ts`, `src/ts/help.ts`
  - Setting/id: language, shortcuts, debug, suggestions, keep alive, supported builds
  - Selectors: internal sidepanel only
	- Validate: use the four primary ARIA tabs and the Help subtabs with mouse and Left/Right/Home/End; inspect Help at narrow width and 200% zoom; verify `#help-start`, `#help-about`, `#help-commands`, `#help-compatibility`, and `#help-diagnostics`; expand settings groups; search Help; dismiss Start here; change one simple setting and use the eight-second Undo; confirm its checkbox or select stays right-aligned in Firefox; change the same setting in another open extension surface; confirm color and Appearance resets.
	- Expected: General is the only initially open settings group; primary and Help tabs have roving `tabindex` and linked panels; Help separates Overview, Commands, Compatibility, and Diagnostics, with only the active panel in reading/focus order and a two-column tab grid below 440px; About identifies Jamir, states the confirmed creator mission, shows the current version, and provides accessible 44px GitHub and email icon actions; Saved appears before the changed control without moving its right edge; one latest eligible change is undoable and expires after a same-setting external change; language, uploads, recorder token, and resets have no Undo; reset dialogs name the affected settings.
  - Status: active
  - Delete condition: settings surface replaced.

- [ ] Help Diagnostics
  - Source: `entrypoints/sidepanel/main.ts`, `src/ts/style-doctor.ts`
  - Setting/id: `RUN_STYLE_DOCTOR_CHECK`
  - Selectors: `AUTOMATION_ANYWHERE_SELECTOR_CHECKS`
  - Validate: switch UI Health, API Health, and Debug Logs sub-tabs; run General, Taskbot Editor, Folder Navigation checks under UI Health.
	- Expected: Diagnostics appears only under side-panel Help; UI Health, API Health, and logs render. The options page explains that live diagnostics require the side panel.
  - Status: active
  - Delete condition: external validation moves elsewhere.

- [ ] API health checks
  - Source: `entrypoints/sidepanel/main.ts`, `src/ts/api-health.ts`, `src/ts/automation-anywhere-api.ts`
  - Setting/id: `API_HEALTH_CHECKS`, `local:apiHealthLastResults`
  - Selectors: none; API probes
  - Validate: run checks on a private folder page, a taskbot page, and a non-AA tab.
  - Expected: folder page passes folder-list and skips bot-content (taskbot page inverse); non-AA tab skips all; create-file probe passes via 400 rejection and never creates a bot; results persist across sidepanel reloads.
  - Status: active
  - Delete condition: endpoints replaced or probes moved elsewhere.

- [ ] Debug Logs tab
  - Source: `entrypoints/sidepanel/main.ts`, `src/ts/debug.ts`
  - Setting/id: `local:debugFeedbackHistory`
  - Selectors: internal sidepanel only
  - Validate: create warn/error/debug events, copy logs, clear logs; expand a log line with details.
  - Expected: logs stay local; copy text includes header and redacted details; expanded details push following rows down without overlap.
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

- [ ] Sounds
  - Source: `src/ts/sounds.ts`
  - Assets: `public/sounds/*.mp3`; MP3 avoids Firefox/Linux exposing WAV files as unsupported `audio/vnd.wave` media.
  - Setting/id: `local:soundsEnabled`
  - Selectors: `run-button`, `error-modal`, `error-badge-icon`, `done-modal`, `done-badge-icon`
  - Validate: on Firefox/Linux, enable Sounds before and after entering a TaskBot; click Run; complete one bot and trigger one bot error; confirm all tones play without media errors and no retry or navigation timer remains active.
  - Expected: Run starts immediately while its tone plays; the initial scan wires the current Run button, changed nodes wire later Run buttons and inspect result badges without full-document rescans, and done/error tones play once per result.
  - Status: active
  - Delete condition: sound setting removed.

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
  - Validated: pending — 0/2 required release validations recorded.
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
  - Setting/id: `commandPaletteEnabled` (default off), `commandPaletteShortcut`
  - Selectors: extension-owned `#commandPalette`
  - Validate: `Alt + P`, `/` when configured, outside click, Escape.
  - Expected: palette opens, predictions render, closes cleanly.
  - Status: active
  - Delete condition: command palette removed.

- [ ] Palette commands
  - Source: `src/ts/commands.ts`, `src/ts/utils.ts`
  - Setting/id: show Actions, Variables, and Triggers commands
  - Selectors: `editor-palette-toggle`, `editor-palette-actions`, `editor-palette-variables`, `editor-palette-triggers`, `editor-palette-search-cancel`
  - Validate: run Actions, Variables, and Triggers commands with palette open and closed, including active search.
  - Expected: palette opens when needed, selected section activates, and search cancellation remains optional/transient.
  - Status: watch
  - Validated: pending — manual Control Room validation required for both watch selectors.
  - Delete condition: commands stop depending on Automation Anywhere palette controls.

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
  - Source: `entrypoints/content.ts`, `src/ts/clipboard.ts`, `src/ts/clipboard-json.ts`, `src/ts/universal-clipboard-storage.ts`, `wxt.config.ts`
  - Setting/id: `local:universalClipboard`, slot `0`
  - Selectors: `shared-copy-button`, `shared-paste-button`, task editor capability selector
  - Validate: use native AA shared copy on a task editor containing an iframe and a capture action.
  - Expected: only the top frame polls `globalClipboard`, only while on a TaskBot editor route; entry snapshots existing content and route exit clears the 500 ms timer. The newest copy updates the auto slot in extension `storage.local`; `unlimitedStorage` removes its normal quota; available capture resources are stored in the portable envelope.
  - Status: active
  - Delete condition: AA shared clipboard mechanism removed.

- [ ] Browser context menu
  - Source: `entrypoints/background.ts`, `entrypoints/sidepanel/main.ts`, `src/ts/settings.ts`
  - Setting/id: `local:browserContextMenuEnabled` (default off)
  - Selectors: reuses `shared-copy-button` and `shared-paste-button` through the existing Universal Clipboard messages; no new external selectors
  - Validate: with the setting disabled and enabled, right-click Automation Anywhere folders and private/public TaskBot editors in Chrome and Firefox; copy capture actions through Slots 1–3, clear and repopulate each slot, navigate between SPA routes, and switch tabs/windows.
  - Expected: disabled hides every extension context-menu entry; enabled shows Open Sidebar on Automation Anywhere pages and Universal Clipboard only on TaskBot editors; Slots 1–3 each expose Copy, while their Paste item is hidden whenever that slot is empty; every slot retains the existing portable metadata, capture-resource, chunking, and notification behavior.
  - Status: active
  - Delete condition: browser context-menu shortcuts are removed or replaced.

- [ ] Clipboard slots 0 to 3
  - Source: `entrypoints/sidepanel/main.ts`, `src/ts/clipboard.ts`, `src/ts/clipboard-json.ts`
  - Setting/id: `local:universalClipboardSlot1..3`
  - Selectors: shared copy/paste
  - Validate: copy capture actions to each slot, paste within the same bot and into another Control Room, exceed the page clipboard quota, and reject malformed non-object clipboard JSON.
  - Expected: correct slot content is pasted with fresh uid, selector blobs, screenshots, thumbnails, variables, and package references; quota fallback is shared by every slot; unavailable images are omitted with a warning.
  - Status: active
  - Delete condition: slot UI removed.

- [ ] Chunk oversized clipboard pastes
  - Source: `src/ts/clipboard.ts`, `src/ts/clipboard-json.ts`, `src/ts/settings.ts`
  - Setting/id: `local:chunkedClipboardPasteEnabled` (default on)
  - Selectors: `taskbot-active-cursor`, `taskbot-rendered-node`, shared paste button
  - Validate: paste a multi-action payload larger than `globalClipboard` with no cursor and after a selected action; repeat through slots 0 to 3 and Action JSON import, including nested blocks and a variable/package conflict; disable the setting and repeat.
  - Expected: normal payloads paste once; quota failures adapt to actual remaining page storage, keep nested structures intact, paste forward with no cursor or reverse around a stable cursor, include variables/packages only in the first executed chunk, and wait for each native insertion. Cursor change, navigation, timeout, unsupported editor, or one oversized block stops safely with feedback.
  - Status: active
  - Delete condition: Automation Anywhere removes the page-storage clipboard limit or exposes a native large-payload paste API.

- [ ] Export action JSON
  - Source: `src/ts/commands.ts`, `src/ts/clipboard.ts`, `src/ts/clipboard-json.ts`
  - Setting/id: command `exportActionToClipboard`
  - Selectors: shared copy button
  - Validate: copy an action and run export command.
  - Expected: versioned portable action JSON, including available capture images and selector data, lands in the system clipboard.
  - Status: active
  - Delete condition: import/export workflow replaced by tools.

- [ ] Import action JSON
  - Source: `src/ts/commands.ts`, `entrypoints/sidepanel/main.ts`, `src/ts/clipboard.ts`, `src/ts/clipboard-json.ts`
  - Setting/id: command `importActionFromJson`, `IMPORT_ACTION_JSON`
  - Selectors: shared paste button
  - Validate: paste valid and invalid JSON into Action JSON field.
  - Expected: valid portable or legacy JSON queues paste; cross-Control-Room metadata is created and uploaded before native paste; oversized TaskBot JSON uses the same quota fallback as clipboard slots; invalid JSON shows error.
  - Status: active
  - Delete condition: workflow replaced by Taskbot JSON tool.

- [ ] Portable action resources
  - Source: `src/ts/clipboard.ts`, `src/ts/clipboard-json.ts`, `src/ts/automation-anywhere-api.ts`, `entrypoints/background.ts`
  - Setting/id: none; always on by explicit user approval; stored inline in `local:universalClipboard*`
  - Selectors: none; reuses the existing shared copy/paste selectors above
  - API: `GET /v2/repository/files/{sourceFileId}/metadata/content`, `POST /v2/repository/files`, `PUT /v2/repository/files/{metadataFileId}/content`, rollback `DELETE /v2/repository/files/{metadataFileId}`
  - Validate: copy Capture, coordinate/region capture, anchored UIObject, secure-recording, and image-bearing actions within one bot and between two Control Rooms; inspect the page `globalClipboard`; force one upload failure and verify rollback.
  - Expected: each available non-secure screenshot/thumbnail is embedded once per source path in `__betterAutomationAnywhere`; same-origin/same-bot paste reuses metadata paths; cross-bot paste creates and uploads target metadata, rewrites paths and `sourceFileId`, then strips the envelope before writing native JSON to `globalClipboard`. A failed upload best-effort deletes its newly created metadata file while preserving the original error. Selector `blob`, variables, and packages remain native; secure or failed resources are blanked cross-bot and reported without blocking the action.
  - Status: active
  - Delete condition: Automation Anywhere provides a portable cross-Control-Room action clipboard or removes these metadata fields/endpoints.

## Variable Metadata

- [ ] Variable metadata fetch
  - Source: `entrypoints/content.ts`, `src/ts/variable-metadata.ts`
  - Setting/id: `local:variableMetadataEnabled` (default on; also requires master styles)
  - Selectors: `editor-palette-variables`, `editor-palette-section`, `variable-row`, `variable-label`, `variable-label-text` (all Doctor-checked)
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

- [ ] Variable metadata revalidation
  - Source: `entrypoints/content.ts`
  - Setting/id: `local:variableMetadataEnabled`; event-invalidated per-file cache
  - Selectors: variable row/label selectors
  - Validate: toggle input/output without rename; rename a variable; complete a successful native save; change TaskBot routes; paste actions from clipboard.
  - Expected: bot content remains cached during ordinary editor mutations, then refreshes after a successful native save, file-id route change, or visible-variable mismatch; no duplicated variable names after palette re-render. The MutationObserver is attached only to the active Variables section.
  - Status: active
  - Delete condition: metadata source becomes push-based/reliable.

- [ ] Unused variable indicator
  - Source: `src/ts/variable-metadata.ts`, `entrypoints/content.ts`, `src/styl/taskbot.styl`
  - Setting/id: `collectUsedVariableNames`, class `better-aa-variable-metadata-unused`
  - Selectors: variable row/label selectors
  - Validate: bot with one variable unreferenced in code; then reference it and wait for revalidation. Include `$var.Method:call$` expressions and assignment targets.
  - Expected: unreferenced variable row is greyed with `(unused)` badge and tooltip; badge clears within ~10s after a reference is added; output and workItem variables are never flagged (Control Room parity).
  - Status: active
  - Delete condition: feature removed or AA adds native unused indicator.

- [ ] Missing metadata retry
  - Source: `entrypoints/content.ts`
  - Setting/id: retry counter/signature
  - Selectors: variable row/label selectors
  - Validate: open variables before metadata loads.
  - Expected: retries fill missing labels or logs one exhausted warning.
  - Status: active
  - Delete condition: variable list rendering becomes synchronous/reliable.

## Tools

- [ ] Background Jobs
	- Source: `entrypoints/sidepanel/tools.ts`, `src/ts/tool-jobs.ts`, `entrypoints/background.ts`
	- Setting/id: `session:toolJobHistory`, optional permission `notifications`, `local:backgroundJobNotificationsEnabled` (default `false`)
	- Selectors: extension-owned Jobs controls only
	- Validate: run Package Usage and a read-only export; switch browser and extension tabs; request Stop; open Jobs; use Back to Tools; reload the side panel during a fake job; grant, deny, and revoke notifications; select a completion notification.
	- Expected: the permanent Actions/Jobs selector is absent. Jobs appears only for running or unread work and while its view is open; opening clears unread, and Back hides access when no running/unread job remains. One job runs globally; selectors and other Tools actions lock; sequential jobs stop after the current item and ZIP jobs after the current batch of at most 20; a stopped ZIP is not emitted; partial downloads or tenant writes are reported; latest ten session records retain target, timing, counts, summary, and per-item logs; reload recovers running as interrupted; notification selection opens Tools → Jobs without changing the active browser tab and Firefox opens synchronously from the click handler.
	- Status: active
	- Delete condition: all long Tools operations move to a persistent browser-native queue.

- [ ] Tool context detection
	- Source: `entrypoints/sidepanel/tools.ts`, `src/ts/control-room-targets.ts`, `src/ts/automation-anywhere-api.ts`
	- Setting/id: `session:toolsWindowSelection:{windowId}`
  - Selectors: route/url based and task editor capability selector
	- Validate: authenticated and logged-out AA tabs, unrelated sites, another browser window, unsupported AA route, private/public folder, private/public taskbot, packages page, and package detail page.
	- Expected: only authenticated AA pages from the side panel's window appear; correct tools and both selectors follow its active supported page when idle. Unsupported, logged-out, unrelated, and other-window activations do not replace a valid target.
  - Status: active
  - Delete condition: tools panel removed.

- [ ] Copy Files
  - Source: `entrypoints/sidepanel/tools.ts`, `src/ts/automation-anywhere-api.ts`
  - Setting/id: tool `copy-files`
  - Selectors: none; API/list based
  - Validate: select files in a folder containing subfolders, use Load more, and copy.
  - Expected: only files load, Load more hides after the last page, and copied refs can be pasted in another folder on the same host.
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

- [ ] Package update toast
  - Source: `entrypoints/content.ts`, `src/ts/ui.ts`, `src/ts/settings.ts`
  - Setting/id: `local:packageUpdateToastEnabled` (default off)
  - Selectors: none; API/content based
  - Validate: enable in Settings; open taskbot with outdated packages on `/edit` and `/view`; re-open same bot in session; force an auth/API failure and retry; reload; open up-to-date bot; disable toggle.
  - Expected: one toast per successfully checked bot per page load with the total in its title and a vertical list of up to 3 `name current → target` rows plus `+N more`; failed checks remain retryable; up-to-date bot silent; toggle off silent.
  - Status: active
  - Delete condition: toast setting removed or AA surfaces native update notice.

- [ ] Non-closing message-box save warning
  - Source: `entrypoints/content.ts`, `entrypoints/sidepanel/tools.ts`, `src/ts/automation-anywhere-json.ts`, `src/ts/settings.ts`
  - Setting/id: `local:nonClosingMessageBoxWarningEnabled` (default off)
  - Selectors: `TASKBOT_SAVE_BUTTON_SELECTOR`, `NATIVE_TOAST_SELECTOR`
  - Validate: enable the setting; save the supplied unsafe and corrected TaskBots through native Save and TaskBot JSON Save; test nested actions, a dynamic timeout, an unrelated toast, save failure, a build without a visible Save-button busy transition, and setting off.
  - Expected: native Save requires the same button to enter and leave `disabled`/`aria-busy` state plus a new native toast; ambiguous, unrelated, safe, failed, and disabled checks stay silent. A successful unsafe save warns with the affected action count and up to 3 action names; missing/false auto-close and missing/non-positive literal timeouts warn; enabled auto-close with a dynamic timeout does not. Native Save is never delayed or blocked.
  - Status: watch
  - Delete condition: MessageBox schemas change or Automation Anywhere adds an equivalent native validator.

- [ ] Update Packages
  - Source: `entrypoints/sidepanel/tools.ts`, `src/ts/automation-anywhere-tools.ts`, `src/ts/automation-anywhere-api.ts`
  - Setting/id: tool `update-packages`
  - Selectors: none; API/content based
  - Validate: on private taskbot `/edit`, deselect one of multiple outdated packages and update; also test private `/view` and folder mode; switch between two Control Rooms containing the same numeric file id; force a failed check and retry; open outdated and up-to-date taskbots and hover the tool button.
  - Expected: `/edit` lists outdated packages with current/default versions and updates only selected packages; `/view` and folder mode retain update-all behavior; the dot uses a fresh check for the active runtime, refreshes after updates, and never carries state/defaults across Control Rooms. An outdated taskbot shows a dot with tooltip suffix 'Package updates available.' (always-on by design, user sign-off 2026-07-10; sidepanel-internal, no toggle); an up-to-date taskbot shows neither.
  - Status: active
  - Delete condition: AA package schema changes beyond repair.

- [ ] Export Bots/Files ZIP
  - Source: `entrypoints/sidepanel/tools.ts`, `src/ts/automation-anywhere-tools.ts`, `src/ts/automation-anywhere-api.ts`
  - Setting/id: tool `export-bots`, format `zip`
  - Selectors: none; API/content/dependency based
  - Validate: export a taskbot with dependencies, uploaded files, nested paths, and folder siblings.
  - Expected: ZIP downloads with manifest, metadata, content, and package list; archive paths contain no `.` or `..` segments and Load more terminates.
  - Status: active
  - Delete condition: export feature replaced by native AA export.

- [ ] Export Bots/Files separate files
  - Source: `entrypoints/sidepanel/tools.ts`, `src/ts/automation-anywhere-tools.ts`
  - Setting/id: tool `export-bots`, format `separate`
  - Selectors: none; API/blob based
  - Validate: choose Separate files; include a name with invalid/trailing or Windows-reserved filename text.
  - Expected: selected files download individually with safe filenames.
  - Status: active
  - Delete condition: separate export removed.

- [ ] Download Packages
  - Source: `entrypoints/sidepanel/tools.ts`, `src/ts/automation-anywhere-api.ts`; undocumented API contracts recorded in `docs/swagger architecture.md` §4.5
  - Setting/id: tool `download-packages`; specific-version drilldown is always available by user approval (no separate toggle)
  - Selectors: none; API/package list based
  - Validate: open Packages page, search/select one package, browse versions, locally search versions, select multiple versions, download, and return to the package list; repeat from a package detail page; log out and verify requests stop until login plus Tools Refresh.
  - Expected: `/v3/packages/package/list` uses nested `filterRequest`, label search, and real pagination; `/v2/packages/package/version/list` scopes to one internal package name; selected historical versions lazily fetch `/v2/packages/package/version/{id}` and resolve relative or absolute `pkgDownloadUrl`; one failed version is skipped without stopping the batch; a logged-out session does not fall back to a full scan.
  - Validated: 2026-07-15 — Firefox `aa-se-latam-2` network capture confirmed package list/version list/version detail shapes and three `BetterRecorder` versions; authenticated `protecta` API checks confirmed `/v3` pagination/filtering, 19 Browser versions, and a historical JAR returning HTTP 200 with `504b0304` magic.
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

- [ ] Import taskbot JSON
  - Source: `entrypoints/sidepanel/tools.ts`, `src/ts/automation-anywhere-tools.ts`, `src/ts/automation-anywhere-api.ts`
  - Setting/id: tool `import-taskbot`, `createTaskbotFile` (`POST /v2/repository/files`)
  - Selectors: none; API/content based
  - Validate: on private folder pick a valid taskbot JSON and import; import same file again; import invalid JSON and non-taskbot JSON; select an extensionless exported file (imports when valid JSON).
  - Expected: new bot created in current folder and folder refreshes; duplicate name auto-suffixes `_1` with info status; invalid/non-taskbot JSON rejected with error; tool absent on public folders.
  - Status: active
  - Delete condition: create-file endpoint removed or native import covers JSON.

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
  - Validate: supported builds `45946`, `45983`, and `46078`; unsupported and unknown version states.
  - Expected: styles block only when unsupported unless force enabled.
  - Status: active
  - Delete condition: support policy removed.

- [ ] Settings disclosure indicators
  - Source: `entrypoints/sidepanel/main.ts`, `entrypoints/sidepanel/style.styl`
  - Setting/id: none; shared side-panel and options-page presentation
  - Selectors: `.settings-group > summary`, `.settings-group[open] > summary .better-aa-icon`
  - Validate: open and close each Settings group and Appearance compatibility override in both extension surfaces.
  - Expected: a right-facing chevron is visible when collapsed and rotates down with amber emphasis when expanded.
  - Status: active
  - Delete condition: native disclosure markers become visually consistent across supported Chrome and Firefox builds.

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

- [ ] Getting started guidance
	- Source: `entrypoints/sidepanel/main.ts`, `src/ts/settings.ts`
	- Setting/id: `local:gettingStartedGuidanceEnabled` (default `true`)
	- Selectors: extension-owned `help-start`
	- Validate: dismiss the Start here card, re-enable it in General, and open both configuration surfaces.
	- Expected: dismissal and the global toggle stay synchronized; Help search remains usable when the card is hidden.
	- Status: active
	- Delete condition: onboarding moves to a different surface.

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
  - Setting/id: `forceEnglishLocale` (default off)
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
  - Validate: run `node scripts/update-version.mjs --dry-run` to preview, then run with `-y` to apply.
  - Expected: package and generated manifests align.
  - Status: active
  - Delete condition: release automation replaces script.
