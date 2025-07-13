import { callInitializeRepeatedly } from '../src/ts/initialize';
import '../src/styl/background.styl';
import '../src/styl/customLoadingIcon.styl';
import '../src/styl/editorActionsVariablesTriggers.styl';
import '../src/styl/editorMain.styl';
import '../src/styl/editorRunButton.styl';
import '../src/styl/editorTabsButtons.styl';
import '../src/styl/fonts.styl';
// import '../src/styl/hideRootSidebar.styl';
// import '../src/styl/editorDialog.styl';
import '../src/styl/rootSidebarAutoHide.styl';
import '../src/styl/taskbot.styl';

export default defineContentScript({
	matches: ['*://*.automationanywhere.digital/*'],
	async main() {
		const {
			fontStyle = false,
			runButton = false,
			pathFinder = false,
		} = await chrome.storage.sync.get({
			fontStyle: false,
			runButton: false,
			pathFinder: false,
		});
		if (runButton) {
			await import('../src/styl/editorRunButton.styl');
		}


		// userscript loading
		if (document.readyState === "loading") {
			document.addEventListener("DOMContentLoaded", () => callInitializeRepeatedly());
		} else {
			callInitializeRepeatedly();
		}
	}
});