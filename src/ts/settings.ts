import { storage } from '#imports';

export const STYLE_CLASS = 'better-aa-styles-enabled';
export const RUN_BUTTON_CLASS = 'better-aa-run-button-enabled';
export const EXTENSION_VERSION = '0.2.4';

export const COMMAND_PALETTE_SHORTCUTS = {
	ALT_P: 'alt+p',
	SLASH: 'slash',
} as const;

export type CommandPaletteShortcut =
	(typeof COMMAND_PALETTE_SHORTCUTS)[keyof typeof COMMAND_PALETTE_SHORTCUTS];

export const stylesEnabled = storage.defineItem<boolean>('local:stylesEnabled');
export const runButton = storage.defineItem<boolean>('local:runButton');
export const soundsEnabled = storage.defineItem<boolean>('local:soundsEnabled');
export const showSuggestions = storage.defineItem<boolean>('local:showSuggestions');
export const debugEnabled = storage.defineItem<boolean>('local:debugEnabled');
export const commandPaletteShortcut = storage.defineItem<CommandPaletteShortcut>(
	'local:commandPaletteShortcut'
);

export const DEFAULT_STYLES_ENABLED = true;
export const DEFAULT_RUN_BUTTON = false;
export const DEFAULT_SOUNDS_ENABLED = true;
export const DEFAULT_SHOW_SUGGESTIONS = true;
export const DEFAULT_DEBUG_ENABLED = false;
export const DEFAULT_COMMAND_PALETTE_SHORTCUT = COMMAND_PALETTE_SHORTCUTS.ALT_P;

export const STYLE_FEATURES = [
	{
		key: 'customPaletteButtons',
		label: 'Palette buttons',
		description: 'Use compact Actions, Variables, and Triggers palette layout.',
		className: 'better-aa-custom-palette-buttons',
		defaultValue: true,
	},
	{
		key: 'runButton',
		label: 'Run button style',
		description: 'Animate and emphasize Run.',
		className: RUN_BUTTON_CLASS,
		defaultValue: DEFAULT_RUN_BUTTON,
	},
	{
		key: 'editorTabsButtons',
		label: 'Hide editor tabs',
		description: 'Hide Flow, List, and Dual tabs button group.',
		className: 'better-aa-editor-tabs-buttons',
		defaultValue: false,
	},
	{
		key: 'makeSidebarScrollable',
		label: 'Scrollable folders',
		description: 'Make folder sidebar sticky and scrollable.',
		className: 'better-aa-make-sidebar-scrollable',
		defaultValue: false,
	},
	{
		key: 'adjustFolderColumnsWidth',
		label: 'Folder columns',
		description: 'Widen folder table columns.',
		className: 'better-aa-adjust-folder-columns-width',
		defaultValue: false,
	},
	{
		key: 'pathFinder',
		label: 'Slim sidebar',
		description: 'Collapse Pathfinder until hover.',
		className: 'better-aa-path-finder',
		defaultValue: false,
	},
	{
		key: 'bgStyle',
		label: 'Custom background',
		description: 'Apply custom TaskBot background gradient.',
		className: 'better-aa-bg-style',
		defaultValue: false,
	},
	{
		key: 'loadingCat',
		label: 'Loading animation',
		description: 'Replace loading animation image.',
		className: 'better-aa-loading-cat',
		defaultValue: false,
	},
] as const;

export type StyleFeatureKey = (typeof STYLE_FEATURES)[number]['key'];

type StyleFeatureStorageItem = typeof runButton;

export const styleFeatureItems = STYLE_FEATURES.reduce(
	(items, feature) => {
		items[feature.key] =
			feature.key === 'runButton'
				? runButton
				: storage.defineItem<boolean | null>(`local:styleFeature:${feature.key}`);
		return items;
	},
	{} as Record<StyleFeatureKey, StyleFeatureStorageItem>
);

export const STYLE_VALUE_FIELDS = [
	{
		key: 'userBg',
		label: 'Background image',
		description: 'Upload png, jpg, jpeg, webp, or gif. Empty uses bundled default.',
		cssVar: '--better-aa-user-bg',
		defaultValue: '',
		type: 'text',
	},
	{
		key: 'userBgSize',
		label: 'Loading image size',
		description: 'Background-size for replacement loading image.',
		cssVar: '--better-aa-user-bg-size',
		defaultValue: 'contain',
		type: 'select',
		options: ['contain', 'cover', 'auto'],
	},
	{
		key: 'backgroundColor1',
		label: 'Gradient 3',
		description: 'TaskBot background gradient color.',
		cssVar: '--better-aa-background-color-1',
		defaultValue: 'rgba(182, 182, 182, .2)',
		type: 'color',
	},
	{
		key: 'backgroundColor2',
		label: 'Gradient 2',
		description: 'TaskBot background gradient color.',
		cssVar: '--better-aa-background-color-2',
		defaultValue: 'rgba(253, 237, 211, .0)',
		type: 'color',
	},
	{
		key: 'backgroundColor3',
		label: 'Gradient 1',
		description: 'TaskBot background gradient color.',
		cssVar: '--better-aa-background-color-3',
		defaultValue: 'rgba(182, 182, 182, .0)',
		type: 'color',
	},
] as const;

export type StyleValueKey = (typeof STYLE_VALUE_FIELDS)[number]['key'];

type StyleValueStorageItem = ReturnType<typeof storage.defineItem<string | null>>;

export const styleValueItems = STYLE_VALUE_FIELDS.reduce(
	(items, field) => {
		items[field.key] = storage.defineItem<string | null>(`local:styleValue:${field.key}`);
		return items;
	},
	{} as Record<StyleValueKey, StyleValueStorageItem>
);

export async function getStylesEnabled(): Promise<boolean> {
	return (await stylesEnabled.getValue()) ?? DEFAULT_STYLES_ENABLED;
}

export async function getRunButtonEnabled(): Promise<boolean> {
	return (await runButton.getValue()) ?? DEFAULT_RUN_BUTTON;
}

export async function getSoundsEnabled(): Promise<boolean> {
	return (await soundsEnabled.getValue()) ?? DEFAULT_SOUNDS_ENABLED;
}

export async function getShowSuggestions(): Promise<boolean> {
	return (await showSuggestions.getValue()) ?? DEFAULT_SHOW_SUGGESTIONS;
}

export async function getDebugEnabled(): Promise<boolean> {
	return (await debugEnabled.getValue()) ?? DEFAULT_DEBUG_ENABLED;
}

export function normalizeCommandPaletteShortcut(
	value: unknown
): CommandPaletteShortcut {
	return value === COMMAND_PALETTE_SHORTCUTS.SLASH
		? COMMAND_PALETTE_SHORTCUTS.SLASH
		: COMMAND_PALETTE_SHORTCUTS.ALT_P;
}

export async function getCommandPaletteShortcut(): Promise<CommandPaletteShortcut> {
	return normalizeCommandPaletteShortcut(await commandPaletteShortcut.getValue());
}

export function getCommandPaletteShortcutLabel(
	value: CommandPaletteShortcut
): string {
	return value === COMMAND_PALETTE_SHORTCUTS.SLASH ? '/' : 'Alt + P';
}

export function getStyleFeatureDefault(key: StyleFeatureKey): boolean {
	return STYLE_FEATURES.find((feature) => feature.key === key)?.defaultValue ?? false;
}

export async function getStyleFeatureEnabled(
	key: StyleFeatureKey
): Promise<boolean> {
	return (await styleFeatureItems[key].getValue()) ?? getStyleFeatureDefault(key);
}

export async function getStyleFeatureValues(): Promise<Record<StyleFeatureKey, boolean>> {
	const entries = await Promise.all(
		STYLE_FEATURES.map(async (feature) => [
			feature.key,
			await getStyleFeatureEnabled(feature.key),
		] as const)
	);
	return Object.fromEntries(entries) as Record<StyleFeatureKey, boolean>;
}

export function getStyleValueDefault(key: StyleValueKey): string {
	return STYLE_VALUE_FIELDS.find((field) => field.key === key)?.defaultValue ?? '';
}

export async function getStyleValue(key: StyleValueKey): Promise<string> {
	return (await styleValueItems[key].getValue()) ?? getStyleValueDefault(key);
}

export async function getStyleValues(): Promise<Record<StyleValueKey, string>> {
	const entries = await Promise.all(
		STYLE_VALUE_FIELDS.map(async (field) => [
			field.key,
			await getStyleValue(field.key),
		] as const)
	);
	return Object.fromEntries(entries) as Record<StyleValueKey, string>;
}
