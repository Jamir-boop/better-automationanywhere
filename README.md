# Better Automation Anywhere

<div align="center">
  <img src="https://raw.githubusercontent.com/Jamir-boop/markdown-images/master/2026-04-02_19-49-08-image-20260402194907547.png" alt="Better Automation Anywhere preview">
</div>

Opinionated improvements for the Automation Anywhere Control Room, focused on UI fixes and developer-oriented features exposed through a command palette.

> Tested on Automation Anywhere Control Room **39.0.0**

---

## Features

- **Universal copy/paste** lets you copy and paste actions between different Control Rooms in the same browser.*

![image-20260403103849668](https://raw.githubusercontent.com/Jamir-boop/markdown-images/master/2026-04-03_10-38-51-image-20260403103849668.png)

You can also use the Tampermonkey context menu to copy and paste bot actions between sessions and across Control Rooms in the same browser:

![Tampermonkey context menu](https://raw.githubusercontent.com/Jamir-boop/markdown-images/master/2026-04-02_20-28-41-image-20260402202840239.png)

> \* This feature is limited by the browser `localStorage` size limit. For reliability, copy smaller code sections at a time.  
> Uploaded Control Room dependencies are **not** transferred. For example, Capture steps that reference screenshots will not include those images when pasted.

- Converts horizontally scrollable input fields into text areas with wrapped text, so the full content is visible at a glance.

https://github.com/user-attachments/assets/c7a60ccb-d023-4dcb-b865-4d9fcc569933

- Redesigns the action, variable, and trigger picker buttons.

https://github.com/user-attachments/assets/271a4a95-26d5-491f-ad3c-bc281b00d0f4

- Adds an option to change the TaskBot Builder background color.
- Makes the sidebar scrollable for Public Folders.

https://github.com/user-attachments/assets/24dd3f72-c5ca-46e6-8316-0d000381f408

- Applies **[Cascadia Code](https://github.com/Microsoft/cascadia-code/releases/)** to selected areas of the UI (optionally you can install it [here](https://github.com/Microsoft/cascadia-code/releases/)).
- Includes several smaller UI refinements.

---

## `userScript.js`

https://github.com/Jamir-boop/automationanywhere-improvements/assets/73477811/f7c6eec2-409f-495d-88e3-028e5b6d4593

This script extends Automation Anywhere with a command palette (`Alt + P`) for fast access to developer-focused commands.

### Command Palette Commands

- `adv`, `addvar`, `add variable` — Open a dialog to create a new variable.
- `v`, `showvars`, `list variables`, `variables` — Show variables in the sidebar.
- `duv`, `delete unused`, `remove unused variables` — Open a dialog to select and delete unused variables.
- `p`, `private`, `private bots` — Go to the **Private Bots** folder.
- `pub`, `public`, `public bots` — Go to the **Public Bots** folder.
- `historical`, `history`, `activity historical` — Go to the **Activities Historical** tab.
- `inprogress`, `progress`, `in progress` — Go to the **In-Progress Activities** tab.
- `audit`, `audit log` — Go to the **Activities Historical** tab.
- `users`, `admin users`, `manage users` — Go to the **Admin Users** page.
- `roles`, `admin roles`, `manage roles` — Go to the **Admin Roles** page.
- `devices`, `admin devices`, `manage devices` — Go to the **Admin Devices** page.
- `home`, `dashboard`, `overview` — Go to the dashboard overview.
- `help`, `man`, `show help` — Display the list of available commands.
- `universal copy`, `copy universal`, `rocket copy` — Copy actions between Control Rooms.
- `universal paste`, `paste universal`, `rocket paste` — Paste actions between Control Rooms.
- `export action`, `copy action json`, `export copied action`, `share action` — Export the currently copied action as JSON to the clipboard.
- `import action`, `paste action json`, `import shared action`, `load action json` — Import an action from JSON and paste it as if it were copied locally.
- `:line` — Jump to a specific line number, for example `:25`.

### Keyboard Shortcuts

- `Alt + P` — Open the command palette
- `Alt + V` — Show variables
- `Alt + A` — Show actions

---

<details>
<summary><strong>Installation</strong></summary>

### Requirements

Before installing, make sure:

> Your Control Room language is set to **English** for selector compatibility.

You will need the following browser extensions:

- **Tampermonkey** for `userScript.js`
- **Stylus** for `aa.user.styl`

You can install both files together, or use `userScript.js` by itself.

### 1. Install the Browser Extensions

- [Install Tampermonkey](https://www.tampermonkey.net)
- [Install Stylus](https://add0n.com/stylus.html)

### 2. Install the Files

| File | Type | Install |
|---|---|---|
| `BetterAutomationAnywhere.user.js` | Userscript | [![badge](https://img.shields.io/badge/Install-Userscript-blue?style=for-the-badge)](https://raw.githubusercontent.com/Jamir-boop/better-automationanywhere/main/betterAutomationAnywhere.user.js) |
| `aa.user.styl` | Stylus theme | [![badge](https://img.shields.io/badge/Install-Userstyle-green?style=for-the-badge)](https://raw.githubusercontent.com/Jamir-boop/automationanywhere-improvements/main/aa.user.styl) |
| `buttons.user.js` | Optional custom sounds userscript | [![badge](https://img.shields.io/badge/Install-Userscript-blue?style=for-the-badge)](https://raw.githubusercontent.com/Jamir-boop/better-automationanywhere/main/buttons.user.js) |

  </details>

---

<details>
<summary><strong>Usage</strong></summary>

1. Open Automation Anywhere.
2. Press `Alt + P` to open the command palette.
3. Type a command, or type `help` to list available commands.
4. Press `Enter` to run the selected command.
5. Optionally, right-click the Tampermonkey icon and use a clipboard slot to copy or paste actions.

</details>

---

<details>
<summary><strong>Why are there two files?</strong></summary>

They are split on purpose.

- `aa.user.styl` handles UI styling cleanly through Stylus.
- `userScript.js` handles behavior and command logic through Tampermonkey.

Keeping style and script separate makes development, testing, and maintenance faster.

</details>

---

## License

MIT

---

## Author

**jamir-boop**  
GitHub: [@Jamir-boop](https://github.com/Jamir-boop)