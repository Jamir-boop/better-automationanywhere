import { defineConfig } from 'wxt';

export default defineConfig({
	targets: [
		'chrome',
		'firefox',
	],
	manifest: {
		name: 'Better AutomationAnywhere DX',
		version: '0.1.0',
		description: 'Enhanced Automation Anywhere developer experience.',
		author: 'jamir-boop',
	    permissions: [
			"storage",
			"tabs",
			"scripting"
	    ],
		side_panel: {
			default_path: 'sidepanel/index.html'
		},
		action: {},
		commands: {
		"open-sidebar": {
			suggested_key: {
				default: "Ctrl+Shift+L"
			},
			description: "Open extension sidebar"
		}
	    }
	}
});