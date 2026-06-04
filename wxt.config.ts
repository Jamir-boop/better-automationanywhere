import { defineConfig } from 'wxt';
import { AUTOMATION_ANYWHERE_MATCHES } from './src/ts/automation-anywhere';

const automationAnywhereMatches = [...AUTOMATION_ANYWHERE_MATCHES];
const webAccessibleResources = ['media/loading.gif', 'sounds/*'];

export default defineConfig({
	targetBrowsers: ['chrome', 'firefox'],
	manifest: ({ browser }) => ({
		name: 'Better AutomationAnywhere DX',
		version: '0.2.4',
		description: 'Enhanced Automation Anywhere developer experience.',
		author: 'jamir-boop',
		permissions: [
			'storage',
			'tabs',
			...(browser === 'chrome' ? ['sidePanel'] : []),
		],
		host_permissions: automationAnywhereMatches,
		web_accessible_resources:
			browser === 'chrome'
				? [
						{
							resources: webAccessibleResources,
							matches: automationAnywhereMatches,
						},
					]
				: webAccessibleResources,
		...(browser === 'chrome'
			? {
					side_panel: {
						default_path: 'sidepanel/index.html',
					},
				}
			: {
					browser_specific_settings: {
						gecko: {
							id: 'better-automationanywhere-dx@jamir-boop',
						},
					},
					sidebar_action: {
						default_title: 'Better AutomationAnywhere DX',
						default_panel: 'sidepanel/index.html',
					},
				}),
		action: {},
		commands: {
			'open-sidebar': {
				suggested_key: {
					default: 'Ctrl+Shift+L',
				},
				description: 'Open extension sidebar',
			},
			'toggle-styles': {
				suggested_key: {
					default: 'Ctrl+Shift+S',
				},
				description: 'Toggle all custom styles',
			},
		},
	}),
});
