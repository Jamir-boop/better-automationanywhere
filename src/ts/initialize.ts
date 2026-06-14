import { refreshSounds } from './sounds';
import { registerMouseClickSuggestions } from './suggestions';
import * as ui from './ui';
import * as utils from './utils';

let initialized = false;
let forceEnglishLocaleEnabled = true;
let pathFinderSlimSidebarEnabled = false;

export function setCustomPaletteButtonsEnabled(enabled: boolean): void {
	ui.setCustomEditorPaletteButtonsEnabled(enabled);
}

export function setForceEnglishLocaleEnabled(enabled: boolean): void {
	forceEnglishLocaleEnabled = enabled;
	if (enabled && initialized) {
		utils.ensureEnglishLocale();
	}
}

export function setPathFinderSlimSidebarEnabled(enabled: boolean): void {
	pathFinderSlimSidebarEnabled = enabled;
	if (initialized) {
		ui.syncPathFinderSlimSidebar(enabled);
	}
}

function injectUi(): void {
	ui.syncCustomEditorPaletteButtons();
	ui.syncPathFinderSlimSidebar(pathFinderSlimSidebarEnabled);
	refreshSounds();
}

function initialize(): void {
	injectUi();

	if (!initialized) {
		if (forceEnglishLocaleEnabled) {
			utils.ensureEnglishLocale();
		}
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
	if (times <= 0) return;
	initialize();
	let count = 1;
	if (count >= times) return;
	const intervalId = setInterval(() => {
		initialize();
		count++;
		if (count >= times) {
			clearInterval(intervalId);
		}
	}, interval);
}
