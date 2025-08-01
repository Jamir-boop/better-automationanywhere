export default defineBackground(() => {
	// Open sidebar with shortcut
	browser.commands.onCommand.addListener(async (command) => {
		if (command === 'open-sidebar' && import.meta.env.CHROME) {
			browser.sidePanel.open({ windowId: undefined });
		}

		if (command === 'open-sidebar' && import.meta.env.FIREFOX) {
			browser.sidebarAction.toggle();
		}

		if (command === 'toggle-styles') {
			const { stylesEnabled = true } = await chrome.storage.local.get('stylesEnabled');
			const newState = !stylesEnabled;
			await chrome.storage.local.set({ stylesEnabled: newState });

			const tabs = await chrome.tabs.query({
				url: '*://*.automationanywhere.digital/*',
			});

			for (const tab of tabs) {
				if (tab.id) {
					chrome.tabs.sendMessage(tab.id, {
						type: 'TOGGLE_STYLES',
						enabled: newState,
					}).catch(() => {
						// Ignore errors from tabs that don't have the content script running
					});
				}
			}
		}
	});

	//idle panel auto-open on icon click
	if (import.meta.env.CHROME) {
		chrome.sidePanel
			.setPanelBehavior({ openPanelOnActionClick: true })
			.catch(() => {});
	}
	if (import.meta.env.FIREFOX) {
		browser.browserAction.onClicked.addListener(() => {
			console.log('[MV2] Icon clicked!');
			browser.sidebarAction.toggle();
		});
	}

});
