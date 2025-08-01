import { callInitializeRepeatedly } from '../src/ts/initialize';

let activeStyleSheets: CSSStyleSheet[] = [];

async function applyStyles() {
	// First, ensure any previous styles are removed before applying new ones.
	removeStyles();

	const { runButton = false } = await chrome.storage.sync.get({ runButton: false });

	const styleImports = [
		import('../src/styl/background.styl', { with: { type: 'css' } }),
		import('../src/styl/customLoadingIcon.styl', { with: { type: 'css' } }),
		import('../src/styl/editorActionsVariablesTriggers.styl', { with: { type: 'css' } }),
		import('../src/styl/editorMain.styl', { with: { type: 'css' } }),
		import('../src/styl/editorTabsButtons.styl', { with: { type: 'css' } }),
		import('../src/styl/fonts.styl', { with: { type: 'css' } }),
		import('../src/styl/rootSidebarAutoHide.styl', { with: { type: 'css' } }),
		import('../src/styl/taskbot.styl', { with: { type: 'css' } }),
	];

	if (runButton) {
		styleImports.push(import('../src/styl/editorRunButton.styl', { with: { type: 'css' } }));
	}

	const loadedModules = await Promise.all(styleImports);
	activeStyleSheets = loadedModules.map(module => module.default);
	document.adoptedStyleSheets = [...document.adoptedStyleSheets, ...activeStyleSheets];
}

function removeStyles() {
	if (activeStyleSheets.length > 0) {
		document.adoptedStyleSheets = document.adoptedStyleSheets.filter(
			(s) => !activeStyleSheets.includes(s)
		);
		activeStyleSheets = [];
	}
}

export default defineContentScript({
	matches: ['*://*.automationanywhere.digital/*'],
	async main() {
		// On initial load, check storage and apply styles if enabled
		const { stylesEnabled = true } = await chrome.storage.local.get('stylesEnabled');
		if (stylesEnabled) {
			await applyStyles();
		}

		// Listen for toggle commands from the background script
		chrome.runtime.onMessage.addListener((message) => {
			if (message.type === 'TOGGLE_STYLES') {
				if (message.enabled) {
					applyStyles();
				} else {
					removeStyles();
				}
			}
		});

		// userscript loading
		if (document.readyState === "loading") {
			document.addEventListener("DOMContentLoaded", () => callInitializeRepeatedly());
		} else {
			callInitializeRepeatedly();
		}
	}
});