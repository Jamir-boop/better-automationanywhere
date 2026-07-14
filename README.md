# Better AA Developer Experience

Browser extension that adds developer-focused controls, UI improvements, and productivity tools to Automation Anywhere Control Room.

| Extension version | Automation Anywhere Control Room | Browser support | Status    |
| ----------------- | -------------------------------- | --------------- | --------- |
| 1.30.0           | A360 v.40+                       | Chrome / Edge / Firefox | Supported |

[Installation](#installation) · [Features](#features) · [Commands](#command-palette) · [Known limitations](#known-limitations) · [Report issue](https://github.com/Jamir-boop/better-automationanywhere/issues)

------

## Overview

Better Automation Anywhere improves Automation Anywhere Control Room for bot builders and power users.

It focuses on:

- faster navigation
- better Bot Editor usability
- command-palette workflows
- action copy/paste between Control Rooms
- variable and action management tools
- small UI fixes that reduce repetitive work

This project replaces the older Tampermonkey userscript and Stylus theme. Everything is now shipped as one browser extension.

------

## Features

### Better Recorder bridge

The optional Better Recorder bridge connects the extension to a local `BetterRecorder` Automation Anywhere package. Enable it from the sidepanel Settings tab, enter the local port/token, and start the package session. It uses `<all_urls>` and `webNavigation` so capture actions can operate on user-selected web pages; it does not run unless enabled. Chrome's optional trusted-click verb also requires the `debugger` permission; Firefox reports that verb as unsupported.

### Universal action copy/paste

Copy and paste bot actions between different Control Rooms in the same browser.

![Universal copy paste](https://raw.githubusercontent.com/Jamir-boop/markdown-images/master/2026-06-13_22-49-07-2026-04-03_10-38-51-image-20260403103849668.png)

Notes:

- Clipboard slots use extension storage with its normal quota removed.
- Available non-secure capture screenshots and thumbnails are embedded in portable Action JSON. Cross-bot paste uploads them into the target bot metadata and rewrites the action paths; same-bot paste reuses the existing paths.
- Selector blobs, variables, and package references remain in Automation Anywhere's native action JSON. The portable resource envelope and image bytes are removed before native paste.
- If Automation Anywhere's page clipboard is full, TaskBot paste automatically sends the largest fitting top-level action groups in order. Loops, conditions, branches, and their children are never split internally. This fallback can be disabled in Settings.
- Automation Anywhere's native shared copy and a single oversized action block still use its page clipboard and can exceed that limit.
- Secure, unavailable, or failed capture resources are omitted during cross-bot paste with a warning. Other uploaded Control Room dependencies are not transferred.

------

### Command palette

Open fast command search with `Alt + P`.

Use it to navigate Control Room, manage variables, copy actions, paste actions, export action JSON, import action JSON, and jump to specific bot lines.

https://github.com/Jamir-boop/better-automationanywhere/assets/73477811/f7c6eec2-409f-495d-88e3-028e5b6d4593

------

### Control Room tools

The sidepanel Tools tab adapts to the active Control Room page.

- Folder pages: copy files, update package versions, and export bots.
- Taskbot pages: inspect/edit Taskbot JSON, update package versions, and export bots.
- Packages page: download selected package JAR files and view bots using a selected package version.
- Package detail page: download versions for the opened package and view usage across all used versions.

Package lists load in small pages with progress feedback. Package Usage loads all results, groups them by package version, and makes each version group collapsible. Versions with no usage are not shown. The tool requires Control Room package-management API permission.

### Save-time MessageBox warning

An optional Settings toggle checks successfully saved TaskBots for MessageBox and supported MessageBoxPlus actions that definitely lack automatic closing. It covers the native TaskBot Save button and the extension's TaskBot JSON Save, reports affected actions without blocking the save, and accepts dynamic timeout values when automatic closing is enabled.

------

### Improved long text fields

Horizontally scrollable input fields are converted into wrapped text areas where supported.

This makes long expressions, paths, JSON, selectors, and formulas easier to read.

https://github.com/user-attachments/assets/c7a60ccb-d023-4dcb-b865-4d9fcc569933

------

### Redesigned picker buttons

Improves action, variable, and trigger picker buttons for faster visual scanning.

https://github.com/user-attachments/assets/271a4a95-26d5-491f-ad3c-bc281b00d0f4

------

### Bot Builder background color

Adds option to change TaskBot Builder background color.

Useful for reducing visual fatigue and distinguishing environments.

------

### Scrollable Public Folders sidebar

Makes Public Folders sidebar scrollable when folder lists are long.

https://github.com/user-attachments/assets/24dd3f72-c5ca-46e6-8316-0d000381f408

------

### Font and UI refinements

Applies developer-friendly font styling to selected Control Room areas.

Recommended optional font:

- [Cascadia Code](https://github.com/microsoft/cascadia-code/releases)

The extension also includes smaller layout, spacing, and readability improvements.

------

## Command Palette

Open with:

```text
Alt + P
```

### Bot Builder commands

| Command aliases                                   | Action                                 |
| ------------------------------------------------- | -------------------------------------- |
| `adv`, `addvar`, `add variable`                   | Open dialog to create variable         |
| `v`, `showvars`, `list variables`, `variables`    | Show variables in sidebar              |
| `duv`, `delete unused`, `remove unused variables` | Open dialog to delete unused variables |
| `help`, `man`, `show help`                        | Show available commands                |
| `:line`                                           | Jump to line number, example: `:25`    |

### Universal copy/paste commands

| Command aliases                                              | Action                              |
| ------------------------------------------------------------ | ----------------------------------- |
| `universal copy`, `copy universal`, `rocket copy`            | Copy actions between Control Rooms  |
| `universal paste`, `paste universal`, `rocket paste`         | Paste actions between Control Rooms |
| `export action`, `copy action json`, `export copied action`, `share action` | Export copied action as JSON        |
| `import action`, `paste action json`, `import shared action`, `load action json` | Import action JSON and paste it     |

### Dynamic navigation commands

Navigation commands are generated from sidebar views available to current user.

The extension reads sidebar items from Control Room and creates commands from available labels, titles, aria-labels, and names.

If view is not present for current user, command is not generated.

Examples:

| Command aliases                                | Destination       |
| ---------------------------------------------- | ----------------- |
| `home`, `dashboard`, `overview`                | Home              |
| `historical`, `history`, `activity historical` | Historical        |
| `inprogress`, `progress`, `in progress`        | In progress       |
| `audit`, `audit log`                           | Audit log         |
| `users`, `admin users`, `manage users`         | Users             |
| `roles`, `admin roles`, `manage roles`         | Roles             |
| `devices`, `admin devices`, `manage devices`   | Devices           |
| `pack`, `packages`                             | Packages          |
| `oauth`, `oauth connections`                   | OAuth connections |
| `p`, `private`, `private bots`                 | Private bots      |
| `pub`, `public`, `public bots`                 | Public bots       |

------

## Keyboard shortcuts

| Shortcut  | Action               |
| --------- | -------------------- |
| `Alt + P` | Open command palette |
| `Alt + V` | Show variables       |
| `Alt + A` | Show actions         |

------

## Installation

### Requirements

- Automation Anywhere Control Room language must be set to English.
- Supported browsers: Chrome, Edge, and Firefox.
- Supported Automation Anywhere version: A360 v.40+.

### Install from browser store

- [Chrome Web Store](https://chromewebstore.google.com/detail/better-aa-developer-exper/kgedphocnonmdjgnnhkljfgmhdnabgho) for Chrome and Edge.
- [Firefox Add-ons](https://addons.mozilla.org/firefox/addon/better-aa-developer-experience/) for Firefox.

------

## Usage

1. Open Automation Anywhere Control Room.
2. Open Bot Editor.
3. Press `Alt + P`.
4. Type command name.
5. Press `Enter`.
6. Use extension options to enable or disable specific UI improvements.

------

## Configuration

Open the extension sidebar from the toolbar or configured shortcut.

- **Config:** shortcuts, sounds, suggestions, keep-alive, package and MessageBox notifications, chunked clipboard paste, language, and debug controls.
- **UI Improvements:** master style switch, individual feature toggles, colors, and loading background.
- **Tools:** context-aware Control Room tools; export format appears when Export Bots is selected.

------

## Known limitations

- Control Room language must be English.
- Automation Anywhere's native shared copy can fail before the extension receives the selection, and a single oversized action block cannot be split safely.
- Chunked paste is limited to TaskBot editors; Process Automation keeps native paste behavior.
- Available non-secure capture screenshots and thumbnails transfer automatically. Secure, missing, or failed resources are omitted with a warning; other uploaded dependencies are not transferred between Control Rooms.
- Automation Anywhere UI updates may break selectors.
- Some commands only appear when related Control Room sidebar views are available to current user.
- Extension behavior may differ between Automation Anywhere Cloud and On-Prem versions.

------

## License

MIT

------

## Author

**jamir-boop**
GitHub: [@Jamir-boop](https://github.com/Jamir-boop)
