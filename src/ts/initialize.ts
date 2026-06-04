import * as palette from './palette';
import { refreshSounds } from './sounds';
import { registerMouseClickSuggestions } from './suggestions';
import * as ui from './ui';
import * as utils from './utils';

let initialized = false;

function injectUi(): void {
	if (!document.querySelector('#commandPalette')) palette.insertCommandPalette();
	if (!document.getElementById('customActionVariableButtons')) {
		ui.insertCustomEditorPaletteButtons();
	}
	ui.removeInlineWidth();
	refreshSounds();
}

function initialize(): void {
	injectUi();

	if (!initialized) {
		utils.ensureEnglishLocale();
		utils.registerKeyboardShortcuts();
		registerMouseClickSuggestions();
		setInterval(ui.updateActiveButton, 1000);
		initialized = true;

		let lastHref = document.location.href;
		setInterval(() => {
			const currentHref = document.location.href;
			if (lastHref !== currentHref) {
				lastHref = currentHref;
				injectUi();
			}
		}, 5000);
	}
}

export function callInitializeRepeatedly(times = 3, interval = 5000): void {
	let count = 0;
	const intervalId = setInterval(() => {
		initialize();
		count++;
		if (count >= times) {
			clearInterval(intervalId);
		}
	}, interval);
}
