import * as palette from './palette';
import * as ui from './ui';
import * as utils from './utils';

let initialized = false;
let updateActiveButtonIntervalId: any = null;

function initialize() {
	if (!document.querySelector("#commandPalette")) palette.insertCommandPalette();
	if (!document.getElementById("customActionVariableButtons")) ui.insertCustomEditorPaletteButtons();
	ui.insertUniversalCopyPasteButtons();
	ui.removeInlineWidth();

	if (!initialized) {
		utils.ensureEnglishLocale();
		utils.registerKeyboardShortcuts();
		updateActiveButtonIntervalId = setInterval(ui.updateActiveButton, 1000);
		initialized = true;
		let lastHref = document.location.href;
		setInterval(function() {
			const currentHref = document.location.href;
			if (lastHref !== currentHref) {
				lastHref = currentHref;
				palette.insertCommandPalette();
				ui.insertCustomEditorPaletteButtons();
				ui.insertUniversalCopyPasteButtons();
				ui.removeInlineWidth();
			}
		}, 3000);
	}
}


export function callInitializeRepeatedly(times = 3, interval = 5000) {
	let count = 0;
	const intervalId = setInterval(() => {
		initialize();
		count++;
		if (count >= times) {
			clearInterval(intervalId);
		}
	}, interval);
}