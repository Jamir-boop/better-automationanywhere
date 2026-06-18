import { defineConfig } from 'wxt';
import { AUTOMATION_ANYWHERE_MATCHES } from './src/ts/automation-anywhere';

const automationAnywhereMatches = [...AUTOMATION_ANYWHERE_MATCHES];
const webAccessibleResources = ['media/loading.gif', 'sounds/*'];

export default defineConfig({
	targetBrowsers: ['chrome', 'firefox'],
	hooks: {
		'build:manifestGenerated': (_wxt, manifest) => {
			if (manifest.sidebar_action) {
				manifest.sidebar_action.default_title = '__MSG_extensionName__';
			}
		},
	},
	manifest: ({ browser }) => ({
		name: '__MSG_extensionName__',
		version: '1.10.0',
		description: '__MSG_extensionDescription__',
		default_locale: 'en',
		author: 'jamir-boop',
		permissions: [
			'storage',
			'tabs',
			...(browser === 'chrome' ? ['sidePanel', 'scripting', 'activeTab'] : []),
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
							data_collection_permissions: {
								required: ['none'],
							},
						},
					},
					sidebar_action: {
						default_title: '__MSG_extensionName__',
						default_panel: 'sidepanel/index.html',
					},
				}),
		action: {
			default_title: '__MSG_extensionShortName__',
		},
		commands: {
			...(browser === 'firefox'
				? {
						'_execute_sidebar_action': {
							suggested_key: {
								default: 'Alt+Shift+L',
							},
						},
					}
				: {
						'open-sidebar': {
							suggested_key: {
								default: 'Alt+Shift+L',
							},
							description: '__MSG_openSidebarCommandDescription__',
						},
					}),
			'toggle-styles': {
				suggested_key: {
					default: 'Ctrl+Shift+S',
				},
				description: '__MSG_toggleStylesCommandDescription__',
			},
		},
	}),
});
