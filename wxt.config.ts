import { defineConfig } from 'wxt';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { AUTOMATION_ANYWHERE_MATCHES } from './src/ts/automation-anywhere';

const { version } = createRequire(import.meta.url)('./package.json') as {
	version: string;
};
const automationAnywhereMatches = [...AUTOMATION_ANYWHERE_MATCHES];
const webAccessibleResources = ['media/loading.gif', 'sounds/*'];

export default defineConfig({
	targetBrowsers: ['chrome', 'firefox'],
	vite: () => ({
		resolve: {
			alias: {
				jszip: resolve('node_modules/jszip/lib/index.js'),
				setimmediate: resolve('src/ts/setimmediate-shim.ts'),
				stream: resolve('src/ts/stream-shim.ts'),
			},
		},
	}),
	hooks: {
		'build:manifestGenerated': (_wxt, manifest) => {
			if (manifest.sidebar_action) {
				manifest.sidebar_action.default_title = '__MSG_extensionName__';
			}
		},
	},
	manifest: ({ browser }) => ({
		name: '__MSG_extensionName__',
		version,
		description: '__MSG_extensionDescription__',
		default_locale: 'en',
		author: 'jamir-boop',
		permissions: [
			'storage',
			'tabs',
			...(browser === 'chrome'
				? ['sidePanel', 'scripting', 'activeTab', 'contextMenus']
				: ['menus']),
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
