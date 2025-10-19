# Better AutomationAnywhere

<div align="center">
<img src="https://i.ibb.co/pK7C9N2/aa-preview.png" alt="aa-preview" border="0">
</div>

Improvements for the Automation Anywhere development platform with an upgraded user interface and a suite of features accessible via a command palette, along with fixes for several annoyances.
✅ **Tested and working on AutomationAnywhere Control Room 31.0.0 to 38.0.0**

---

<details>
<summary>✨ <strong>Features</strong></summary>

### `aa.user.styl`
<img src="https://i.ibb.co/W2bxLKX/image.png" alt="image" border="0" width="50%">
<br>

- Universal copy/paste allows you to copy and paste actions between control rooms.

<img src="https://i.ibb.co/fdmcjvF/image.png" alt="image" border="0" width="50%">

- Converts input fields that have a horizontal scroll into text areas that break words, allowing you to view all contents at a glance.

<img src="https://i.ibb.co/fx0RDqk/input-to-areatext.png" alt="input-to-areatext" border="0" width="60%">

- Redesigned the annoying buttons for selecting actions, variables, and triggers.

<img src="https://i.ibb.co/tHhMdWs/services.png" alt="services" border="0" width="60%">

- Increases the font size and assigns Cascadia Code and Cursive Cascadia Code to key parts of the UI.
- Adds a colorful background.
- And much more...

---

### `userScript.js`

https://github.com/Jamir-boop/automationanywhere-improvements/assets/73477811/f7c6eec2-409f-495d-88e3-028e5b6d4593

This script enhances Automation Anywhere by adding a command palette (`Alt + P`) that lets you execute helpful developer commands instantly.

#### ✅ Command Palette Commands

Use the command palette to run any of the following:

- `a`, `addaction`, `add action`: Open the "Actions" section in the palette.
- `adv`, `addvar`, `add variable`: Add a new variable.
- `v`, `showvars`, `list variables`, `variables`: Show the variables panel.
- `duv`, `delete unused`: Remove unused variables.
- `p`, `private`, `private bots`: Go to your Private Bots folder.
- `historical`, `activity historical`: Open Activity History.
- `audit`, `audit log`: Open the Audit Log.
- `:25`: Scroll to line number 25 (or any number).
- `help`, `show help`: Show this command reference.

#### ⌨️ Keyboard Shortcuts

- `Alt + P`: Toggle the command palette.
- `Alt + V`: Show variables.
- `Alt + A`: Show actions.
- `Ctrl + D`: Toggle the right-side toolbar.

#### 📋 Clipboard Slots (Universal Copy/Paste)

Using the Tampermonkey menu, you can copy/paste bot actions between sessions and even across control rooms:

- `Copy to Slot 1/2/3`
- `Paste from Slot 1/2/3`

Rocket icon buttons will also appear in the top toolbar for faster access.

</details>

---

<details>
<summary>⚙️ <strong>Installation</strong></summary>

These are a **userScript** (`userScript.js`) and a **userStyle** (`aa.user.styl`) that can work together or independently.

- `userScript.js`: Use with [Tampermonkey](https://www.tampermonkey.net)
- `aa.user.styl`: Use with [Stylus](https://add0n.com/stylus.html)

### 1. Install the Browser Extensions

- Install **[Tampermonkey](https://www.tampermonkey.net)**.
- Install **[Stylus](https://add0n.com/stylus.html)**.

### 2. Add the Scripts

- **[Install the userScript.js](https://update.greasyfork.org/scripts/477891/Better%20AutomationAnywhere.user.js)** via GreasyFork
- **[Install the Stylus Theme](https://github.com/Jamir-boop/automationanywhere-improvements/raw/main/aa.user.styl)** via Stylus

> ✅ Make sure your Control Room language is set to **English** for selector compatibility.

</details>

---

<details>
<summary>🚀 <strong>Usage</strong></summary>

1. Open Automation Anywhere.
2. Press `Alt + P` to open the palette.
3. Start typing a command or `help` to see options.
4. Hit `Enter` to execute.
5. Optionally, right-click Tampermonkey → choose a clipboard slot to copy or paste.

</details>

---

<details>
<summary>🧠 <strong>Why are there two files?</strong></summary>

This project is split into:
- A **userScript** that runs JavaScript features via Tampermonkey.
- A **userStyle** that changes CSS and UI styles via Stylus.

Keeping them separate makes installation modular and leverages the best tool for each job without bloating a single script.

</details>

---

<strong>License</strong>

MIT License

---

<strong>Created by **jamir-boop**</strong>
GitHub: [@Jamir-boop](https://github.com/Jamir-boop)
