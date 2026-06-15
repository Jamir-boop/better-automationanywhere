import { storage } from '#imports';
import type { LanguagePreference } from './i18n';
export type { LanguagePreference } from './i18n';

export const STYLE_CLASS = 'better-aa-styles-enabled';
export const RUN_BUTTON_CLASS = 'better-aa-run-button-enabled';
export const EXTENSION_VERSION = '1.9.0';

export const COMMAND_PALETTE_SHORTCUTS = {
	ALT_P: 'alt+p',
	SLASH: 'slash',
} as const;

export const OPEN_SIDEBAR_SHORTCUTS = {
	ALT_SHIFT_L: 'alt+shift+l',
	CTRL_SHIFT_L: 'ctrl+shift+l',
	ALT_SHIFT_S: 'alt+shift+s',
	ALT_SHIFT_O: 'alt+shift+o',
	CTRL_SHIFT_SPACE: 'ctrl+shift+space',
} as const;

export const BOT_EXECUTION_MODAL_POSITIONS = {
	BOTTOM_LEFT: 'bottom-left',
	BOTTOM_RIGHT: 'bottom-right',
	TOP_LEFT: 'top-left',
	TOP_RIGHT: 'top-right',
} as const;

export type CommandPaletteShortcut =
	(typeof COMMAND_PALETTE_SHORTCUTS)[keyof typeof COMMAND_PALETTE_SHORTCUTS];
export type OpenSidebarShortcut =
	(typeof OPEN_SIDEBAR_SHORTCUTS)[keyof typeof OPEN_SIDEBAR_SHORTCUTS];
export type BotExecutionModalPosition =
	(typeof BOT_EXECUTION_MODAL_POSITIONS)[keyof typeof BOT_EXECUTION_MODAL_POSITIONS];

export const stylesEnabled = storage.defineItem<boolean>('local:stylesEnabled');
export const runButton = storage.defineItem<boolean>('local:runButton');
export const soundsEnabled = storage.defineItem<boolean>('local:soundsEnabled');
export const showSuggestions = storage.defineItem<boolean>('local:showSuggestions');
export const debugEnabled = storage.defineItem<boolean>('local:debugEnabled');
export const commandPaletteEnabled = storage.defineItem<boolean>(
	'local:commandPaletteEnabled'
);
export const keepAliveEnabled = storage.defineItem<boolean>('local:keepAliveEnabled');
export const blockTaskbotNodeLabelClicks = storage.defineItem<boolean>(
	'local:blockTaskbotNodeLabelClicks'
);
export const forceEnglishLocale = storage.defineItem<boolean>('local:forceEnglishLocale');
export const forceUnsupportedControlRoomStyles = storage.defineItem<boolean>(
	'local:forceUnsupportedControlRoomStyles'
);
export const extensionLanguage =
	storage.defineItem<LanguagePreference>('local:extensionLanguage');
export const commandPaletteShortcut = storage.defineItem<CommandPaletteShortcut>(
	'local:commandPaletteShortcut'
);
export const openSidebarShortcut = storage.defineItem<OpenSidebarShortcut>(
	'local:openSidebarShortcut'
);
export const botExecutionModalPosition = storage.defineItem<BotExecutionModalPosition>(
	'local:botExecutionModalPosition'
);

export const DEFAULT_STYLES_ENABLED = true;
export const DEFAULT_RUN_BUTTON = false;
export const DEFAULT_SOUNDS_ENABLED = false;
export const DEFAULT_SHOW_SUGGESTIONS = true;
export const DEFAULT_DEBUG_ENABLED = false;
export const DEFAULT_COMMAND_PALETTE_ENABLED = true;
export const DEFAULT_KEEP_ALIVE_ENABLED = false;
export const DEFAULT_BLOCK_TASKBOT_NODE_LABEL_CLICKS = true;
export const DEFAULT_FORCE_ENGLISH_LOCALE = true;
export const DEFAULT_FORCE_UNSUPPORTED_CONTROL_ROOM_STYLES = false;
export const DEFAULT_EXTENSION_LANGUAGE: LanguagePreference = 'auto';
export const DEFAULT_COMMAND_PALETTE_SHORTCUT = COMMAND_PALETTE_SHORTCUTS.ALT_P;
export const DEFAULT_OPEN_SIDEBAR_SHORTCUT = OPEN_SIDEBAR_SHORTCUTS.ALT_SHIFT_L;
export const DEFAULT_BOT_EXECUTION_MODAL_POSITION =
	BOT_EXECUTION_MODAL_POSITIONS.TOP_RIGHT;

export const OPEN_SIDEBAR_SHORTCUT_LABELS: Record<OpenSidebarShortcut, string> = {
	[OPEN_SIDEBAR_SHORTCUTS.ALT_SHIFT_L]: 'Alt + Shift + L',
	[OPEN_SIDEBAR_SHORTCUTS.CTRL_SHIFT_L]: 'Ctrl + Shift + L',
	[OPEN_SIDEBAR_SHORTCUTS.ALT_SHIFT_S]: 'Alt + Shift + S',
	[OPEN_SIDEBAR_SHORTCUTS.ALT_SHIFT_O]: 'Alt + Shift + O',
	[OPEN_SIDEBAR_SHORTCUTS.CTRL_SHIFT_SPACE]: 'Ctrl + Shift + Space',
};

export const OPEN_SIDEBAR_SHORTCUT_OPTIONS = Object.values(
	OPEN_SIDEBAR_SHORTCUTS
).map((value) => ({
	value,
	label: OPEN_SIDEBAR_SHORTCUT_LABELS[value],
}));

export const BOT_EXECUTION_MODAL_POSITION_LABELS: Record<
	BotExecutionModalPosition,
	string
> = {
	[BOT_EXECUTION_MODAL_POSITIONS.BOTTOM_LEFT]: 'Bottom left',
	[BOT_EXECUTION_MODAL_POSITIONS.BOTTOM_RIGHT]: 'Bottom right',
	[BOT_EXECUTION_MODAL_POSITIONS.TOP_LEFT]: 'Top left',
	[BOT_EXECUTION_MODAL_POSITIONS.TOP_RIGHT]: 'Top right',
};

export const BOT_EXECUTION_MODAL_POSITION_OPTIONS = Object.values(
	BOT_EXECUTION_MODAL_POSITIONS
).map((value) => ({
	value,
	label: BOT_EXECUTION_MODAL_POSITION_LABELS[value],
}));

export const EXTENSION_LANGUAGE_OPTIONS: Array<{
	value: LanguagePreference;
	label: string;
}> = [
	{ value: 'auto', label: 'Auto (browser)' },
	{ value: 'en', label: 'English' },
	{ value: 'es', label: 'Spanish' },
];

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
		key: 'minimizeBotModal',
		label: 'Minimize running bot window',
		description: 'Add Minimize and Maximize controls to the running bot window.',
		className: 'better-aa-minimize-bot-modal',
		defaultValue: false,
	},
	{
		key: 'makeSidebarScrollable',
		label: 'Scrollable folders',
		description:
			'Makes folder sidebar sticky and scrollable. On folder pages, centers active folder automatically.',
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
		label: 'Loading animation image',
		description: 'Upload replacement png, jpg, jpeg, webp, or gif. Empty uses bundled default.',
		cssVar: '--better-aa-user-bg',
		defaultValue: '',
		type: 'text',
	},
	{
		key: 'userBgSize',
		label: 'Loading image size',
		description: 'Sizing mode for replacement loading animation image.',
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

export async function getCommandPaletteEnabled(): Promise<boolean> {
	return (await commandPaletteEnabled.getValue()) ?? DEFAULT_COMMAND_PALETTE_ENABLED;
}

export async function getKeepAliveEnabled(): Promise<boolean> {
	return (await keepAliveEnabled.getValue()) ?? DEFAULT_KEEP_ALIVE_ENABLED;
}

export async function getBlockTaskbotNodeLabelClicks(): Promise<boolean> {
	return (
		(await blockTaskbotNodeLabelClicks.getValue()) ??
		DEFAULT_BLOCK_TASKBOT_NODE_LABEL_CLICKS
	);
}

export async function getForceEnglishLocale(): Promise<boolean> {
	return (await forceEnglishLocale.getValue()) ?? DEFAULT_FORCE_ENGLISH_LOCALE;
}

export async function getForceUnsupportedControlRoomStyles(): Promise<boolean> {
	return (
		(await forceUnsupportedControlRoomStyles.getValue()) ??
		DEFAULT_FORCE_UNSUPPORTED_CONTROL_ROOM_STYLES
	);
}

export function normalizeExtensionLanguage(value: unknown): LanguagePreference {
	return value === 'en' || value === 'es' ? value : DEFAULT_EXTENSION_LANGUAGE;
}

export async function getExtensionLanguage(): Promise<LanguagePreference> {
	return normalizeExtensionLanguage(await extensionLanguage.getValue());
}

export function normalizeCommandPaletteShortcut(
	value: unknown
): CommandPaletteShortcut {
	return value === COMMAND_PALETTE_SHORTCUTS.SLASH
		? COMMAND_PALETTE_SHORTCUTS.SLASH
		: COMMAND_PALETTE_SHORTCUTS.ALT_P;
}

export function normalizeOpenSidebarShortcut(
	value: unknown
): OpenSidebarShortcut {
	return Object.values(OPEN_SIDEBAR_SHORTCUTS).includes(
		value as OpenSidebarShortcut
	)
		? (value as OpenSidebarShortcut)
		: DEFAULT_OPEN_SIDEBAR_SHORTCUT;
}

export function normalizeBotExecutionModalPosition(
	value: unknown
): BotExecutionModalPosition {
	return Object.values(BOT_EXECUTION_MODAL_POSITIONS).includes(
		value as BotExecutionModalPosition
	)
		? (value as BotExecutionModalPosition)
		: DEFAULT_BOT_EXECUTION_MODAL_POSITION;
}

export async function getCommandPaletteShortcut(): Promise<CommandPaletteShortcut> {
	return normalizeCommandPaletteShortcut(await commandPaletteShortcut.getValue());
}

export async function getOpenSidebarShortcut(): Promise<OpenSidebarShortcut> {
	return normalizeOpenSidebarShortcut(await openSidebarShortcut.getValue());
}

export async function getBotExecutionModalPosition(): Promise<BotExecutionModalPosition> {
	return normalizeBotExecutionModalPosition(
		await botExecutionModalPosition.getValue()
	);
}

export function getCommandPaletteShortcutLabel(
	value: CommandPaletteShortcut
): string {
	return value === COMMAND_PALETTE_SHORTCUTS.SLASH ? '/' : 'Alt + P';
}

export function getOpenSidebarShortcutLabel(value: OpenSidebarShortcut): string {
	return OPEN_SIDEBAR_SHORTCUT_LABELS[value];
}

export function getBotExecutionModalPositionLabel(
	value: BotExecutionModalPosition
): string {
	return BOT_EXECUTION_MODAL_POSITION_LABELS[value];
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
