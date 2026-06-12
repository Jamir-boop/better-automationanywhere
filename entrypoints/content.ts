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
	isTaskEditorUrl,
	isTextFileUrl,
} from '../src/ts/automation-anywhere';
import {
	exportActionToClipboard,
	getHelpHtml,
	importActionFromJson,
} from '../src/ts/commands';
import { debugError, debugInfo } from '../src/ts/debug';
import { setScrollableFoldersAutoScrollEnabled } from '../src/ts/folders';
import { setActiveLanguagePreference, t } from '../src/ts/i18n';
import {
	callInitializeRepeatedly,
	setCustomPaletteButtonsEnabled,
	setForceEnglishLocaleEnabled,
	setPathFinderSlimSidebarEnabled,
} from '../src/ts/initialize';
import type { ContentActionResponse, RuntimeMessage } from '../src/ts/messages';
import {
	DEFAULT_BLOCK_TASKBOT_NODE_LABEL_CLICKS,
	DEFAULT_COMMAND_PALETTE_ENABLED,
	DEFAULT_FORCE_ENGLISH_LOCALE,
	blockTaskbotNodeLabelClicks,
	commandPaletteEnabled,
	extensionLanguage,
	forceEnglishLocale,
	getBlockTaskbotNodeLabelClicks,
	getCommandPaletteEnabled,
	getCommandPaletteShortcut,
	getExtensionLanguage,
	getForceEnglishLocale,
	getOpenSidebarShortcut,
	getShowSuggestions,
	getSoundsEnabled,
	getStyleFeatureValues,
	getStylesEnabled,
	getStyleValues,
	normalizeOpenSidebarShortcut,
	openSidebarShortcut,
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
import { updateCommandPaletteLanguage } from '../src/ts/palette';
import {
	setActiveBlockTaskbotNodeLabelClicks,
	setActiveCommandPaletteEnabled,
	setActiveCommandPaletteShortcut,
	setActiveOpenSidebarShortcut,
} from '../src/ts/utils';

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
const FOLDERS_ROUTE_CLASS = 'better-aa-route-folders';
const TASKBOT_ROUTE_CLASS = 'better-aa-route-taskbot';
const TEXT_FILE_ROUTE_CLASS = 'better-aa-route-text-file';
const SCROLLABLE_FOLDERS_CLASS = 'better-aa-make-sidebar-scrollable';
const FOLDERS_ROUTE_RE = /.*automationanywhere\.digital.*?folders.*$/i;

function applyBundledAssetVariables(): void {
	document.documentElement.style.setProperty(
		'--better-aa-loading-image-url',
		DEFAULT_LOADING_IMAGE_CSS
	);
}

function applyRouteClasses(): void {
	const href = location.href;
	document.documentElement.classList.toggle(FOLDERS_ROUTE_CLASS, FOLDERS_ROUTE_RE.test(href));
	document.documentElement.classList.toggle(TASKBOT_ROUTE_CLASS, isTaskEditorUrl(href));
	document.documentElement.classList.toggle(TEXT_FILE_ROUTE_CLASS, isTextFileUrl(href));
	syncScrollableFoldersAutoScroll();
}

function syncScrollableFoldersAutoScroll(): void {
	const root = document.documentElement;
	setScrollableFoldersAutoScrollEnabled(
		root.classList.contains(STYLE_CLASS) &&
			root.classList.contains(FOLDERS_ROUTE_CLASS) &&
			root.classList.contains(SCROLLABLE_FOLDERS_CLASS)
	);
}

function watchRouteChanges(): void {
	let lastRouteUrl = location.href;
	const update = () => {
		requestAnimationFrame(() => {
			applyRouteClasses();
			if (location.href === lastRouteUrl) return;
			lastRouteUrl = location.href;
			void browser.runtime.sendMessage({
				type: 'AA_ROUTE_CHANGED',
				url: lastRouteUrl,
			});
		});
	};
	const wrapHistoryMethod = (method: 'pushState' | 'replaceState') => {
		const original = history[method];
		history[method] = function (...args) {
			const result = original.apply(this, args);
			update();
			return result;
		};
	};
	wrapHistoryMethod('pushState');
	wrapHistoryMethod('replaceState');
	window.addEventListener('popstate', update);
	window.addEventListener('hashchange', update);
}

async function applyStyleClasses(): Promise<void> {
	const [enabled, styleFeatures] = await Promise.all([
		getStylesEnabled(),
		getStyleFeatureValues(),
	]);
	document.documentElement.classList.toggle(STYLE_CLASS, enabled);
	for (const feature of STYLE_FEATURES) {
		document.documentElement.classList.toggle(
			feature.className,
			styleFeatures[feature.key]
		);
	}
	setCustomPaletteButtonsEnabled(enabled && styleFeatures.customPaletteButtons);
	setPathFinderSlimSidebarEnabled(enabled && styleFeatures.pathFinder);
	syncScrollableFoldersAutoScroll();
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
		setActiveLanguagePreference(await getExtensionLanguage());
		await applyStyleClasses();
		await applyStyleValues();
		setSoundsEnabled(await getSoundsEnabled());
		setSuggestionsEnabled(await getShowSuggestions());
		setActiveCommandPaletteEnabled(await getCommandPaletteEnabled());
		setActiveBlockTaskbotNodeLabelClicks(await getBlockTaskbotNodeLabelClicks());
		setForceEnglishLocaleEnabled(await getForceEnglishLocale());
		setActiveCommandPaletteShortcut(await getCommandPaletteShortcut());
		setActiveOpenSidebarShortcut(await getOpenSidebarShortcut());
	} catch (error) {
		void debugError('content', 'Initial settings failed.', { error }, {
			feedback: true,
		});
		document.documentElement.classList.add(STYLE_CLASS);
	}
}

function updateOpenSidebarButtonLabel(): void {
	const button = document.getElementById(OPEN_SIDEBAR_BUTTON_ID);
	if (!button) return;
	button.textContent = t('Better AA');
	button.title = t('Open Better AA sidebar');
	button.setAttribute('aria-label', t('Open Better AA sidebar'));
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
	button.textContent = t('Better AA');
	button.title = t('Open Better AA sidebar');
	button.setAttribute('aria-label', t('Open Better AA sidebar'));
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
			await applyStyleClasses();
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
		if (message.type === 'SET_COMMAND_PALETTE_ENABLED') {
			setActiveCommandPaletteEnabled(message.enabled);
			return;
		}
		if (message.type === 'SET_BLOCK_TASKBOT_NODE_LABEL_CLICKS') {
			setActiveBlockTaskbotNodeLabelClicks(message.enabled);
			return;
		}
		if (message.type === 'SET_FORCE_ENGLISH_LOCALE') {
			setForceEnglishLocaleEnabled(message.enabled);
			return;
		}
		if (message.type === 'SET_EXTENSION_LANGUAGE') {
			setActiveLanguagePreference(message.language);
			updateOpenSidebarButtonLabel();
			updateCommandPaletteLanguage();
			callInitializeRepeatedly(1, 1);
			return;
		}
		if (message.type === 'SET_COMMAND_PALETTE_SHORTCUT') {
			setActiveCommandPaletteShortcut(message.shortcut);
			return;
		}
		if (message.type === 'SET_OPEN_SIDEBAR_SHORTCUT') {
			setActiveOpenSidebarShortcut(message.shortcut);
			return;
		}
		if (message.type === 'SET_STYLE_FEATURE') {
			const feature = STYLE_FEATURES.find((item) => item.key === message.key);
			if (feature) {
				document.documentElement.classList.toggle(feature.className, message.enabled);
			}
			await applyStyleClasses();
			return;
		}
		if (message.type === 'SET_STYLE_VALUE') {
			setStyleValue(message.key, message.value);
			return;
		}
		if (message.type === 'COPY_TO_SLOT') {
			const json = await copyToSlot(message.slot);
			return json
				? { ok: true, message: t('Copied slot {slot}.', { slot: message.slot }), json }
				: { ok: false, error: t('Could not copy slot {slot}.', { slot: message.slot }) };
		}
		if (message.type === 'PASTE_FROM_SLOT') {
			const json = await pasteFromSlot(message.slot);
			return json
				? { ok: true, message: t('Pasted slot {slot}.', { slot: message.slot }), json }
				: { ok: false, error: t('Slot {slot} is empty.', { slot: message.slot }) };
		}
		if (message.type === 'UNIVERSAL_COPY') {
			const json = await universalCopy();
			return json
				? { ok: true, json }
				: { ok: false, error: t('Copy failed.') };
		}
		if (message.type === 'UNIVERSAL_PASTE') {
			const json = await universalPaste();
			return json
				? { ok: true, message: t('Paste queued.'), json }
				: { ok: false, error: t('Universal clipboard is empty.') };
		}
		if (message.type === 'EXPORT_ACTION') {
			await exportActionToClipboard();
			return { ok: true, message: t('Export queued.') };
		}
		if (message.type === 'IMPORT_ACTION') {
			importActionFromJson();
			return { ok: true, message: t('Sidebar import field opened.') };
		}
		if (message.type === 'GET_HELP_HTML') {
			return { ok: true, html: getHelpHtml() };
		}
		if (message.type === 'IMPORT_ACTION_JSON') {
			await importActionJson(message.json);
			return { ok: true, message: t('Import queued.') };
		}
	} catch (error) {
		return {
			ok: false,
			error: error instanceof Error ? error.message : t('Action failed.'),
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
		applyRouteClasses();
		watchRouteChanges();
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
		commandPaletteEnabled.watch((value) => {
			setActiveCommandPaletteEnabled(value ?? DEFAULT_COMMAND_PALETTE_ENABLED);
		});
		blockTaskbotNodeLabelClicks.watch((value) => {
			setActiveBlockTaskbotNodeLabelClicks(
				value ?? DEFAULT_BLOCK_TASKBOT_NODE_LABEL_CLICKS
			);
		});
		forceEnglishLocale.watch((value) => {
			setForceEnglishLocaleEnabled(value ?? DEFAULT_FORCE_ENGLISH_LOCALE);
		});
		extensionLanguage.watch((value) => {
			setActiveLanguagePreference(value);
			updateOpenSidebarButtonLabel();
			updateCommandPaletteLanguage();
			callInitializeRepeatedly(1, 1);
		});
		openSidebarShortcut.watch((value) => {
			setActiveOpenSidebarShortcut(normalizeOpenSidebarShortcut(value));
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
