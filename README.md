# Better AutomationAnywhere
<div align="center">
  <img src="https://i.ibb.co/pK7C9N2/aa-preview.png" alt="aa-preview" border="0">
</div>

#### Working on AutomationAnywhere Control Room 31.0.0 and 32.0.0

This is a userScript (`userScript.js`) and a userStyle (`aa.user.styl`), both designed to work together (the `aa.user.styl` file can work alone). They enhance the Automation Anywhere platform by providing an improved user interface (UI) and a set of features accessible through a command palette. The `userScript.js` file is a script that runs in the Tampermonkey extension, while the `aa.user.styl` file runs within the Stylus extension.

## Why two damn files on two different extensions?
This decision was made considering the fact that there's no need to reinvent the wheel by creating a way to ship the entire `aa.user.styl` file, which was written in Stylus syntax. Both Stylus and Tampermonkey frameworks are proficient in simplifying the development work, expediting the process. Please note that I'm open to options that can streamline the installation process.

## Features
### aa.user.styl

### userScript.js
The script adds a command palette to Automation Anywhere, which can be invoked using the `Alt + P` key combination. The command palette provides a set of commands that can be used to perform various actions on the Automation Anywhere platform. The commands include:

- `a`, `addaction`, `add action`, `action`: Opens and focuses the actions input field.
- `adv`, `addvar`, `add variable`: Adds a new variable.
- `v`, `showvars`, `list variables`, `variables`: Shows all variables.
- `duv`, `delete unused`, `remove unused variables`: Deletes unused variables.
- `hd`, `hide dialog`, `close dialog`: Hides the dialog that appears when a bot is running.
- `up`, `updatepkgs`, `upgrade packages`: Updates all packages.
- `fa`, `fold all`, `collapse all`: Folds all sections in the code.
- `help`, `h`, `show help`: Displays help information for available commands.

If an invalid command is entered, a help message is displayed with a list of valid commands.

## Installation
Its important to note that 
1. Install Tampermonkey extension on your browser.
2. Click on the Tampermonkey icon and select "Create a new script".
3. Copy and paste the provided script into the editor.
4. Save the script.

## Usage

1. Navigate to the Automation Anywhere platform.
2. Press `Ctrl + P` to invoke the command palette.
3. Enter a command or `help` for a list of commands.
4. Press `Enter` to execute the command.

## License

This project is licensed under the MIT License.

## Author

This script was created by jamir-boop.
