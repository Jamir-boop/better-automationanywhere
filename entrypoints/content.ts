import '../src/styl/index.styl';
import {
	copyToSlot,
	importActionJson,
	pasteFromSlot,
	startGlobalClipboardWatcher,
	universalCopy,
	universalPaste,
} from '../src/ts/clipboard';
import {
	AUTOMATION_ANYWHERE_MATCHES,
	isAutomationAnywhereUrl,
} from '../src/ts/automation-anywhere';
import {
	exportActionToClipboard,
	getHelpHtml,
	importActionFromJson,
} from '../src/ts/commands';
import { debugError, debugInfo } from '../src/ts/debug';
import { callInitializeRepeatedly } from '../src/ts/initialize';
import type { ContentActionResponse, RuntimeMessage } from '../src/ts/messages';
import {
	getCommandPaletteShortcut,
	getShowSuggestions,
	getSoundsEnabled,
	getStyleFeatureValues,
	getStylesEnabled,
	getStyleValues,
	RUN_BUTTON_CLASS,
	STYLE_FEATURES,
	STYLE_VALUE_FIELDS,
	STYLE_CLASS,
	showSuggestions,
	styleFeatureItems,
	styleValueItems,
	stylesEnabled,
} from '../src/ts/settings';
import { setSoundsEnabled } from '../src/ts/sounds';
import { setSuggestionsEnabled } from '../src/ts/suggestions';
import { setActiveCommandPaletteShortcut } from '../src/ts/utils';

const DEFAULT_LOADING_IMAGE_CSS = `url("${browser.runtime.getURL(
	'media/loading.gif' as any
)}")`;
const SHARED_CLIPBOARD_SELECTORS = [
	'.aa-icon-action-clipboard-copy--shared',
	'.aa-icon-action-clipboard-paste--shared',
];
const TASK_EDITOR_CAPABILITY_SELECTORS = [
	'.taskbot-editor__toolbar__action',
	'.taskbot-canvas-list-node',
	'.editor-layout__canvas',
];
const OPEN_SIDEBAR_BUTTON_ID = 'better-aa-open-sidebar-button';

function applyBundledAssetVariables(): void {
	document.documentElement.style.setProperty(
		'--better-aa-loading-image-url',
		DEFAULT_LOADING_IMAGE_CSS
	);
}

async function applyStyleClasses(): Promise<void> {
	const [stylesEnabled, styleFeatures] = await Promise.all([
		getStylesEnabled(),
		getStyleFeatureValues(),
	]);
	document.documentElement.classList.toggle(STYLE_CLASS, stylesEnabled);
	for (const feature of STYLE_FEATURES) {
		document.documentElement.classList.toggle(
			feature.className,
			styleFeatures[feature.key]
		);
	}
}

function setStyleValue(key: string, value: string): void {
	const field = STYLE_VALUE_FIELDS.find((item) => item.key === key);
	if (!field) return;
	const normalizedValue = value.trim();
	if (!normalizedValue && field.key === 'userBg') {
		document.documentElement.style.removeProperty(field.cssVar);
		return;
	}
	document.documentElement.style.setProperty(
		field.cssVar,
		normalizedValue || field.defaultValue
	);
}

async function applyStyleValues(): Promise<void> {
	const values = await getStyleValues();
	for (const field of STYLE_VALUE_FIELDS) {
		setStyleValue(field.key, values[field.key]);
	}
}

async function applyInitialSettings(): Promise<void> {
	try {
		await applyStyleClasses();
		await applyStyleValues();
		setSoundsEnabled(await getSoundsEnabled());
		setSuggestionsEnabled(await getShowSuggestions());
		setActiveCommandPaletteShortcut(await getCommandPaletteShortcut());
	} catch (error) {
		void debugError('content', 'Initial settings failed.', { error }, {
			feedback: true,
		});
		document.documentElement.classList.add(STYLE_CLASS);
	}
}

function runOnReady(callback: () => void): void {
	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', callback, { once: true });
		return;
	}
	callback();
}

function isTopFrame(): boolean {
	try {
		return window.top === window.self;
	} catch {
		return false;
	}
}

function insertOpenSidebarButton(): void {
	if (
		import.meta.env.FIREFOX ||
		!isTopFrame() ||
		document.getElementById(OPEN_SIDEBAR_BUTTON_ID)
	) {
		return;
	}
	const button = document.createElement('button');
	button.id = OPEN_SIDEBAR_BUTTON_ID;
	button.type = 'button';
	button.textContent = 'Better AA Developer Experience';
	button.title = 'Open Better AA Developer Experience sidebar';
	button.setAttribute('aria-label', 'Open Better AA Developer Experience sidebar');
	button.addEventListener('click', () => {
		button.style.transform = 'scale(0.95)';
		setTimeout(() => {
			button.style.transform = '';
		}, 100);
		void browser.runtime
			.sendMessage({ type: 'OPEN_SIDEBAR', tab: 'tools' })
			.then((response: ContentActionResponse | undefined) => {
				if (response && !response.ok) throw new Error(response.error);
				button.style.background = '#3AA35C';
				button.style.borderColor = '#3AA35C';
				setTimeout(() => {
					button.style.background = '';
					button.style.borderColor = '';
				}, 300);
			})
			.catch((error) => {
				button.style.background = '#A33A3A';
				button.style.borderColor = '#A33A3A';
				void debugError('content', 'Open sidebar button failed.', { error }, {
					feedback: true,
				});
			});
	});
	document.body.appendChild(button);
}

function getAutomationAnywhereAuthToken(): string | null {
	try {
		const raw = localStorage.getItem('authToken');
		if (!raw) return null;
		try {
			const parsed = JSON.parse(raw);
			return typeof parsed === 'string' ? parsed : raw;
		} catch {
			return raw;
		}
	} catch {
		return null;
	}
}

function refreshAutomationAnywhereFolderList(): boolean {
	const refreshButton = document.getElementsByName('table-refresh')[0];
	if (!(refreshButton instanceof HTMLElement)) return false;
	refreshButton.click();
	return true;
}

function getToolCapabilities(): ContentActionResponse {
	const universalClipboard =
		SHARED_CLIPBOARD_SELECTORS.some((selector) =>
			Boolean(document.querySelector(selector))
		) ||
		TASK_EDITOR_CAPABILITY_SELECTORS.some((selector) =>
			Boolean(document.querySelector(selector))
		);
	return {
		ok: true,
		capabilities: {
			universalClipboard,
		},
	};
}

async function handleRuntimeMessage(
	message: RuntimeMessage
): Promise<ContentActionResponse | void> {
	try {
		if (message.type === 'PING_AA_CONTENT') {
			return { ok: true, message: 'Content script loaded.' };
		}
		if (message.type === 'GET_AA_AUTH_TOKEN') {
			return { ok: true, authToken: getAutomationAnywhereAuthToken() };
		}
		if (message.type === 'GET_TOOL_CAPABILITIES') {
			return getToolCapabilities();
		}
		if (message.type === 'REFRESH_AA_FOLDER_LIST') {
			return refreshAutomationAnywhereFolderList()
				? { ok: true, message: 'Folder refresh queued.' }
				: { ok: false, error: 'Refresh button not found.' };
		}
		if (message.type === 'TOGGLE_STYLES') {
			document.documentElement.classList.toggle(STYLE_CLASS, message.enabled ?? false);
			return;
		}
		if (message.type === 'SET_RUN_BUTTON_STYLE') {
			document.documentElement.classList.toggle(RUN_BUTTON_CLASS, message.enabled);
			return;
		}
		if (message.type === 'SET_SOUNDS_ENABLED') {
			setSoundsEnabled(message.enabled);
			return;
		}
		if (message.type === 'SET_SHOW_SUGGESTIONS') {
			setSuggestionsEnabled(message.enabled);
			return;
		}
		if (message.type === 'SET_DEBUG_ENABLED') {
			return;
		}
		if (message.type === 'SET_COMMAND_PALETTE_SHORTCUT') {
			setActiveCommandPaletteShortcut(message.shortcut);
			return;
		}
		if (message.type === 'SET_STYLE_FEATURE') {
			const feature = STYLE_FEATURES.find((item) => item.key === message.key);
			if (feature) {
				document.documentElement.classList.toggle(feature.className, message.enabled);
			}
			return;
		}
		if (message.type === 'SET_STYLE_VALUE') {
			setStyleValue(message.key, message.value);
			return;
		}
		if (message.type === 'COPY_TO_SLOT') {
			const json = await copyToSlot(message.slot);
			return json
				? { ok: true, message: `Copied slot ${message.slot}.`, json }
				: { ok: false, error: `Could not copy slot ${message.slot}.` };
		}
		if (message.type === 'PASTE_FROM_SLOT') {
			const json = await pasteFromSlot(message.slot);
			return json
				? { ok: true, message: `Pasted slot ${message.slot}.`, json }
				: { ok: false, error: `Slot ${message.slot} is empty.` };
		}
		if (message.type === 'UNIVERSAL_COPY') {
			const json = await universalCopy();
			return json
				? { ok: true, json }
				: { ok: false, error: 'Copy failed.' };
		}
		if (message.type === 'UNIVERSAL_PASTE') {
			const json = await universalPaste();
			return json
				? { ok: true, message: 'Paste queued.', json }
				: { ok: false, error: 'Universal clipboard is empty.' };
		}
		if (message.type === 'EXPORT_ACTION') {
			await exportActionToClipboard();
			return { ok: true, message: 'Export queued.' };
		}
		if (message.type === 'IMPORT_ACTION') {
			importActionFromJson();
			return { ok: true, message: 'Sidebar import field opened.' };
		}
		if (message.type === 'GET_HELP_HTML') {
			return { ok: true, html: getHelpHtml() };
		}
		if (message.type === 'IMPORT_ACTION_JSON') {
			await importActionJson(message.json);
			return { ok: true, message: 'Import queued.' };
		}
	} catch (error) {
		return {
			ok: false,
			error: error instanceof Error ? error.message : 'Action failed.',
		};
	}
}

export default defineContentScript({
	matches: [...AUTOMATION_ANYWHERE_MATCHES],
	allFrames: true,
	runAt: 'document_idle',
	async main() {
		if (!isAutomationAnywhereUrl(location.href)) return;
		document.documentElement.dataset.betterAaContentScript = 'loaded';
		void debugInfo('content', 'Content script loaded.', { url: location.href });
		applyBundledAssetVariables();
		await applyInitialSettings();
		startGlobalClipboardWatcher();

		browser.runtime.onMessage.addListener((message: RuntimeMessage) => {
			return handleRuntimeMessage(message);
		});

		stylesEnabled.watch(() => {
			void applyStyleClasses();
		});
		styleFeatureItems.runButton.watch(() => {
			void applyStyleClasses();
		});
		showSuggestions.watch((value) => {
			setSuggestionsEnabled(value ?? true);
		});
		STYLE_FEATURES.forEach((feature) => {
			if (feature.key === 'runButton') return;
			styleFeatureItems[feature.key].watch(() => {
				void applyStyleClasses();
			});
		});
		STYLE_VALUE_FIELDS.forEach((field) => {
			styleValueItems[field.key].watch(() => {
				void applyStyleValues();
			});
		});

		runOnReady(() => {
			insertOpenSidebarButton();
			callInitializeRepeatedly();
		});
	},
});
