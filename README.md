# Better AA Developer Experience

Browser extension that adds developer-focused controls, UI improvements, and productivity tools to Automation Anywhere Control Room.

| Extension version | Automation Anywhere Control Room | Browser support | Status    |
| ----------------- | -------------------------------- | --------------- | --------- |
| 1.13.9           | A360 v.40+                       | Chrome / Edge   | Supported |

[Installation](#installation) · [Features](#features) · [Commands](#command-palette) · [Known limitations](#known-limitations) · Report issue

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

### Universal action copy/paste

Copy and paste bot actions between different Control Rooms in the same browser.

![Universal copy paste](https://raw.githubusercontent.com/Jamir-boop/markdown-images/master/2026-06-13_22-49-07-2026-04-03_10-38-51-image-20260403103849668.png)

Notes:

- Data is stored in browser storage.
- Large action blocks may hit browser storage limits.
- Copy smaller sections for better reliability.
- Uploaded Control Room dependencies are not transferred.
- Capture screenshots and other uploaded assets must exist in target Control Room.

------

### Command palette

Open fast command search with `Alt + P`.

Use it to navigate Control Room, manage variables, copy actions, paste actions, export action JSON, import action JSON, and jump to specific bot lines.

https://github.com/Jamir-boop/automationanywhere-improvements/assets/73477811/f7c6eec2-409f-495d-88e3-028e5b6d4593

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
- Supported browser: Chrome or Edge.
- Supported Automation Anywhere version: A360 v.40+.

### Install from browser store

TODO: Add Chrome Web Store or Edge Add-ons link.

```text
TODO: Browser store link
```

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

TODO: Add screenshots and describe settings page.

Recommended settings fields:

| Setting                     | Description                                            | Default |
| --------------------------- | ------------------------------------------------------ | ------- |
| Enable command palette      | Enables `Alt + P` command launcher                     | On      |
| Enable universal copy/paste | Enables action copy/paste between Control Rooms        | On      |
| Enable text area expansion  | Converts supported long fields into wrapped text areas | On      |
| Enable picker redesign      | Updates action, variable, and trigger picker buttons   | On      |
| Enable sidebar fixes        | Applies scroll and layout fixes                        | On      |
| Builder background color    | Custom Bot Builder background color                    | Default |

------

## Known limitations

- Control Room language must be English.
- Universal copy/paste depends on browser storage limits.
- Large copied action blocks may fail or paste inconsistently.
- Uploaded dependencies are not transferred between Control Rooms.
- Capture screenshots and other Control Room assets must be manually available in target environment.
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
