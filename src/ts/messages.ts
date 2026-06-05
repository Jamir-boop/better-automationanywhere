import type {
	CommandPaletteShortcut,
	StyleFeatureKey,
	StyleValueKey,
} from './settings';
import type { SidepanelFocusTarget, SidepanelTab } from './sidepanel-state';

export interface AutomationAnywhereApiRequestConfig {
	url: string;
	method?: string;
	headers?: Record<string, string>;
	body?: string;
	responseType?: 'json' | 'text' | 'blob' | 'bot-content';
}

export interface AutomationAnywhereApiBlobResponse {
	blob: string;
	type: string;
	size: number;
	fileName?: string;
}

export interface ExtensionShortcuts {
	openSidebar: string;
	commandPalette: string;
}

export interface ToolCapabilities {
	universalClipboard: boolean;
}

export type AutomationAnywhereApiResponse =
	| { ok: true; data?: unknown }
	| { ok: false; error: string; status?: number };

export type SettingsBackgroundMessage =
	| { type: 'TOGGLE_STYLES'; enabled?: boolean }
	| { type: 'SET_RUN_BUTTON_STYLE'; enabled: boolean }
	| { type: 'SET_SOUNDS_ENABLED'; enabled: boolean }
	| { type: 'SET_SHOW_SUGGESTIONS'; enabled: boolean }
	| { type: 'SET_DEBUG_ENABLED'; enabled: boolean }
	| { type: 'SET_COMMAND_PALETTE_SHORTCUT'; shortcut: CommandPaletteShortcut }
	| { type: 'SET_STYLE_FEATURE'; key: StyleFeatureKey; enabled: boolean }
	| { type: 'SET_STYLE_VALUE'; key: StyleValueKey; value: string }
	| { type: 'OPEN_SIDEBAR'; tab?: SidepanelTab; focus?: SidepanelFocusTarget };

export type AutomationAnywhereApiRequestMessage = {
	type: 'AA_API_REQUEST';
	config: AutomationAnywhereApiRequestConfig;
};

export type ExtensionShortcutsMessage = {
	type: 'GET_EXTENSION_SHORTCUTS';
};

export type BackgroundMessage =
	| SettingsBackgroundMessage
	| AutomationAnywhereApiRequestMessage
	| ExtensionShortcutsMessage;

export type ContentActionMessage =
	| { type: 'COPY_TO_SLOT'; slot: number }
	| { type: 'PASTE_FROM_SLOT'; slot: number }
	| { type: 'UNIVERSAL_COPY' }
	| { type: 'UNIVERSAL_PASTE' }
	| { type: 'EXPORT_ACTION' }
	| { type: 'IMPORT_ACTION' }
	| { type: 'GET_HELP_HTML' }
	| { type: 'IMPORT_ACTION_JSON'; json: string }
	| { type: 'PING_AA_CONTENT' }
	| { type: 'GET_AA_AUTH_TOKEN' }
	| { type: 'GET_TOOL_CAPABILITIES' }
	| { type: 'REFRESH_AA_FOLDER_LIST' };

export type ContentActionResponse =
	| {
			ok: true;
			json?: string;
			message?: string;
			html?: string;
			authToken?: string | null;
			capabilities?: ToolCapabilities;
	  }
	| { ok: false; error: string };

export type RuntimeMessage = BackgroundMessage | ContentActionMessage;
