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
	isFolderRepositoryUrl,
	isAutomationAnywhereUrl,
	isTaskEditorUrl,
	isTextFileUrl,
} from '../src/ts/automation-anywhere';
import { clampBackgroundColorValue } from '../src/ts/background-colors';
import {
	setBotExecutionModalEnabled,
	setBotExecutionModalPosition,
} from '../src/ts/bot-execution-modal';
import {
	exportActionToClipboard,
	getHelpHtml,
	importActionFromJson,
} from '../src/ts/commands';
import { debugError, debugInfo, debugWarn } from '../src/ts/debug';
import {
	AutomationAnywhereApi,
	parseAutomationAnywherePageContext,
	readAutomationAnywhereAuthTokenFromLocalStorage,
} from '../src/ts/automation-anywhere-api';
import { setScrollableFoldersAutoScrollEnabled } from '../src/ts/folders';
import { setActiveLanguagePreference, t } from '../src/ts/i18n';
import {
	createUnknownControlRoomCompatibility,
	formatControlRoomTarget,
	type ControlRoomCompatibilityStatus,
} from '../src/ts/control-room-version';
import { runStyleDoctor, runSingleCheck } from '../src/ts/style-doctor';
import {
	callInitializeRepeatedly,
	setActiveBlockTaskbotNodeLabelClicks,
	setActiveCommandPaletteEnabled,
	setActiveCommandPaletteShortcut,
	setActiveOpenSidebarShortcut,
	setCustomPaletteButtonsEnabled,
	setForceEnglishLocaleEnabled,
	setPathFinderSlimSidebarEnabled,
} from '../src/ts/initialize';
import type { ContentActionResponse, RuntimeMessage } from '../src/ts/messages';
import type { ControlRoomCompatibilityResponse } from '../src/ts/messages';
import {
	DEFAULT_BLOCK_TASKBOT_NODE_LABEL_CLICKS,
	DEFAULT_COMMAND_PALETTE_ENABLED,
	DEFAULT_FORCE_ENGLISH_LOCALE,
	DEFAULT_KEEP_ALIVE_ENABLED,
	botExecutionModalPosition,
	blockTaskbotNodeLabelClicks,
	commandPaletteEnabled,
	extensionLanguage,
	forceEnglishLocale,
	forceUnsupportedControlRoomStyles,
	getBlockTaskbotNodeLabelClicks,
	getBotExecutionModalPosition,
	getCommandPaletteEnabled,
	getCommandPaletteShortcut,
	getCommandPaletteShortcutLabel,
	getExtensionLanguage,
	getForceEnglishLocale,
	getForceUnsupportedControlRoomStyles,
	getKeepAliveEnabled,
	getOpenSidebarShortcut,
	getRunButtonWavesEnabled,
	getShowSuggestions,
	getSoundsEnabled,
	getStyleFeatureValues,
	getStylesEnabled,
	getStyleValues,
	normalizeBotExecutionModalPosition,
	normalizeOpenSidebarShortcut,
	keepAliveEnabled,
	openSidebarShortcut,
	runButtonWaves,
	STYLE_FEATURES,
	STYLE_VALUE_FIELDS,
	STYLE_CLASS,
	showSuggestions,
	styleFeatureItems,
	styleValueItems,
	stylesEnabled,
} from '../src/ts/settings';
import { setRunButtonAnimationEnabled } from '../src/ts/run-button-animation';
import { setSoundsEnabled } from '../src/ts/sounds';
import { setSuggestionsEnabled } from '../src/ts/suggestions';
import { updateCommandPaletteLanguage } from '../src/ts/palette';
import {
	extractVariableMetadataLookup,
	findVariableMetadata,
	type VariableMetadataLookup,
} from '../src/ts/variable-metadata';

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
const BOT_EXECUTION_MODAL_CLASS = 'better-aa-minimize-bot-modal';
const KEEP_ALIVE_INTERVAL_MS = 60_000;
const VARIABLES_BUTTON_SELECTOR =
	'button[data-path="EditorPalette.section.button"][aria-label="Variables"]';
const VARIABLE_ROW_SELECTOR = '.editor-palette-item[data-item-name]';
const VARIABLE_LABEL_SELECTOR =
	'.editor-palette-item__child-label[data-path="ClippedText"]';
const LABEL_TEXT_SELECTOR = '.clipped-text__string--for_presentation';
const VARIABLE_METADATA_ORIGINAL_TEXT_ATTR = 'data-better-aa-original-text';

let keepAliveTimer: ReturnType<typeof setInterval> | undefined;
let activeRunButtonStyleEnabled = false;
let activeRunButtonWavesEnabled = false;
let variableMetadataObserver: MutationObserver | null = null;
let variableMetadataScheduled = false;
let variableMetadataCurrentFileId: string | null = null;
let variableMetadataMissingSignature: string | null = null;
let variableMetadataMissingRetryCount = 0;
let variableMetadataRetryTimer: ReturnType<typeof setTimeout> | undefined;
const variableMetadataCache = new Map<string, Promise<VariableMetadataLookup | null>>();

function applyBundledAssetVariables(): void {
	document.documentElement.style.setProperty(
		'--better-aa-loading-image-url',
		DEFAULT_LOADING_IMAGE_CSS
	);
}

function applyRouteClasses(): void {
	const href = location.href;
	document.documentElement.classList.toggle(FOLDERS_ROUTE_CLASS, isFolderRepositoryUrl(href));
	document.documentElement.classList.toggle(TASKBOT_ROUTE_CLASS, isTaskEditorUrl(href));
	document.documentElement.classList.toggle(TEXT_FILE_ROUTE_CLASS, isTextFileUrl(href));
	syncScrollableFoldersAutoScroll();
	syncBotExecutionModal();
	scheduleVariableMetadataSync();
}

function syncScrollableFoldersAutoScroll(): void {
	const root = document.documentElement;
	setScrollableFoldersAutoScrollEnabled(
		root.classList.contains(STYLE_CLASS) &&
			root.classList.contains(FOLDERS_ROUTE_CLASS) &&
			root.classList.contains(SCROLLABLE_FOLDERS_CLASS)
	);
}

function syncBotExecutionModal(): void {
	const root = document.documentElement;
	setBotExecutionModalEnabled(
		root.classList.contains(STYLE_CLASS) &&
			root.classList.contains(TASKBOT_ROUTE_CLASS) &&
			root.classList.contains(BOT_EXECUTION_MODAL_CLASS)
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

async function getCurrentControlRoomCompatibility(): Promise<ControlRoomCompatibilityStatus> {
	try {
		const response = (await browser.runtime.sendMessage({
			type: 'GET_CONTROL_ROOM_COMPATIBILITY',
		})) as ControlRoomCompatibilityResponse | undefined;
		if (response?.ok) return response.compatibility;
		return createUnknownControlRoomCompatibility(response?.error);
	} catch (error) {
		return createUnknownControlRoomCompatibility(
			error instanceof Error ? error.message : undefined
		);
	}
}

async function applyStyleClasses(): Promise<void> {
	const [enabled, styleFeatures, runButtonWavesEnabled, forceUnsupported, compatibility] =
		await Promise.all([
			getStylesEnabled(),
			getStyleFeatureValues(),
			getRunButtonWavesEnabled(),
			getForceUnsupportedControlRoomStyles(),
			getCurrentControlRoomCompatibility(),
		]);
	const effectiveEnabled =
		enabled &&
		(compatibility.supported || compatibility.state === 'unknown' || forceUnsupported);
	document.documentElement.dataset.betterAaControlRoomState = compatibility.state;
	document.documentElement.dataset.betterAaSupportedControlRoom =
		formatControlRoomTarget(compatibility.target);
	document.documentElement.classList.toggle(STYLE_CLASS, effectiveEnabled);
	for (const feature of STYLE_FEATURES) {
		document.documentElement.classList.toggle(
			feature.className,
			styleFeatures[feature.key]
		);
	}
	activeRunButtonStyleEnabled = effectiveEnabled && styleFeatures.runButton;
	activeRunButtonWavesEnabled = runButtonWavesEnabled;
	setRunButtonAnimationEnabled(activeRunButtonStyleEnabled, activeRunButtonWavesEnabled);
	setCustomPaletteButtonsEnabled(
		effectiveEnabled && styleFeatures.customPaletteButtons
	);
	setPathFinderSlimSidebarEnabled(effectiveEnabled && styleFeatures.pathFinder);
	syncScrollableFoldersAutoScroll();
	syncBotExecutionModal();
	scheduleVariableMetadataSync();
}

function getLabelTextElement(label: HTMLElement): HTMLElement {
	return label.querySelector<HTMLElement>(LABEL_TEXT_SELECTOR) ?? label;
}

function restoreVariableMetadataLabel(label: HTMLElement): void {
	const originalText = label.getAttribute(VARIABLE_METADATA_ORIGINAL_TEXT_ATTR);
	if (originalText === null) return;

	getLabelTextElement(label).textContent = originalText;
	label.setAttribute('data-text', originalText);
	label.setAttribute('title', originalText);
	label.removeAttribute(VARIABLE_METADATA_ORIGINAL_TEXT_ATTR);
	label.classList.remove('better-aa-variable-metadata-label');
	label.closest(VARIABLE_ROW_SELECTOR)?.classList.remove('better-aa-variable-metadata-row');
}

function restoreVariableMetadataLabels(root: ParentNode = document): void {
	root
		.querySelectorAll<HTMLElement>(
			`[${VARIABLE_METADATA_ORIGINAL_TEXT_ATTR}]`
		)
		.forEach(restoreVariableMetadataLabel);
}

function getActiveVariablesSection(): HTMLElement | null {
	const button = document.querySelector<HTMLButtonElement>(VARIABLES_BUTTON_SELECTOR);
	const section = button?.closest<HTMLElement>('[data-path="EditorPalette.section"]');
	if (!button || !section) return null;
	if (!button.closest('.editor-palette__accordion--is_active')) return null;
	if (
		!section.querySelector(
			'.editor-palette-section__header--is_active'
		)
	) {
		return null;
	}
	return section;
}

function getVariableMetadataContext(): {
	baseUrl: string;
	fileId: string;
	section: HTMLElement;
} | null {
	if (!document.documentElement.classList.contains(STYLE_CLASS)) return null;
	const context = parseAutomationAnywherePageContext(location.href);
	if (
		(context.pageType !== 'private-taskbot' &&
			context.pageType !== 'public-taskbot') ||
		!context.baseUrl ||
		!context.fileId
	) {
		return null;
	}
	const section = getActiveVariablesSection();
	if (!section) return null;
	return { baseUrl: context.baseUrl, fileId: context.fileId, section };
}

function scheduleVariableMetadataSync(): void {
	if (variableMetadataScheduled) return;
	variableMetadataScheduled = true;
	requestAnimationFrame(() => {
		variableMetadataScheduled = false;
		void syncVariableMetadataLabels();
	});
}

async function loadVariableMetadata(
	fileId: string,
	baseUrl: string
): Promise<VariableMetadataLookup | null> {
	const existing = variableMetadataCache.get(fileId);
	if (existing) return existing;

	const authToken = readAutomationAnywhereAuthTokenFromLocalStorage();
	if (!authToken) {
		void debugWarn('variable-metadata', 'Automation Anywhere auth token not found.');
		return null;
	}

	const promise = new AutomationAnywhereApi(baseUrl, authToken)
		.getBotContent(fileId)
		.then((content) => extractVariableMetadataLookup(content))
		.catch((error) => {
			variableMetadataCache.delete(fileId);
			void debugWarn('variable-metadata', 'Variable metadata load failed.', { error });
			return null;
		})
		.finally(scheduleVariableMetadataSync);

	variableMetadataCache.set(fileId, promise);
	return promise;
}

function clearVariableMetadataMissingRefresh(): void {
	if (variableMetadataRetryTimer) clearTimeout(variableMetadataRetryTimer);
	variableMetadataRetryTimer = undefined;
	variableMetadataMissingSignature = null;
	variableMetadataMissingRetryCount = 0;
}

function refreshMissingVariableMetadata(
	fileId: string,
	missingNames: string[]
): void {
	const signature = `${fileId}\u0000${missingNames.join('\u0000')}`;
	if (signature !== variableMetadataMissingSignature) {
		clearVariableMetadataMissingRefresh();
		variableMetadataMissingSignature = signature;
	}
	if (
		variableMetadataMissingRetryCount >= 2 ||
		variableMetadataRetryTimer
	) {
		return;
	}

	const refresh = (): void => {
		variableMetadataRetryTimer = undefined;
		variableMetadataCache.delete(fileId);
		scheduleVariableMetadataSync();
	};
	if (variableMetadataMissingRetryCount++ === 0) refresh();
	else {
		// ponytail: one delayed retry; poll only if Control Room lag proves longer.
		variableMetadataRetryTimer = setTimeout(refresh, 1_000);
	}
}

function applyVariableMetadataLabels(
	section: HTMLElement,
	lookup: VariableMetadataLookup,
	fileId: string
): void {
	const missingNames: string[] = [];
	const seenMissingNames = new Set<string>();
	section.querySelectorAll<HTMLElement>(VARIABLE_ROW_SELECTOR).forEach((row) => {
		const rowName = row.dataset.itemName;
		const label = row.querySelector<HTMLElement>(VARIABLE_LABEL_SELECTOR);
		if (!label) return;

		const metadata = findVariableMetadata(lookup, rowName);
		if (!metadata) {
			const name = (rowName ?? '').replace(/\s+/g, ' ').trim();
			const key = name.toLocaleLowerCase();
			if (name && !seenMissingNames.has(key)) {
				seenMissingNames.add(key);
				missingNames.push(name);
			}
			restoreVariableMetadataLabel(label);
			return;
		}

		if (!label.hasAttribute(VARIABLE_METADATA_ORIGINAL_TEXT_ATTR)) {
			label.setAttribute(
				VARIABLE_METADATA_ORIGINAL_TEXT_ATTR,
				getLabelTextElement(label).textContent ?? ''
			);
		}

		const textElement = getLabelTextElement(label);
		if (textElement.textContent !== metadata.label) {
			textElement.textContent = metadata.label;
		}
		if (label.getAttribute('data-text') !== metadata.label) {
			label.setAttribute('data-text', metadata.label);
		}
		if (label.getAttribute('title') !== metadata.title) {
			label.setAttribute('title', metadata.title);
		}
		label.classList.add('better-aa-variable-metadata-label');
		row.classList.add('better-aa-variable-metadata-row');
	});

	if (missingNames.length) refreshMissingVariableMetadata(fileId, missingNames);
	else clearVariableMetadataMissingRefresh();
}

async function syncVariableMetadataLabels(): Promise<void> {
	const context = getVariableMetadataContext();
	if (!context) {
		clearVariableMetadataMissingRefresh();
		if (variableMetadataCurrentFileId !== null) {
			variableMetadataCurrentFileId = null;
			restoreVariableMetadataLabels();
		}
		return;
	}

	if (context.fileId !== variableMetadataCurrentFileId) {
		clearVariableMetadataMissingRefresh();
		restoreVariableMetadataLabels();
		variableMetadataCurrentFileId = context.fileId;
	}

	const lookup = await loadVariableMetadata(context.fileId, context.baseUrl);
	const latestContext = getVariableMetadataContext();
	if (
		!lookup ||
		!latestContext ||
		latestContext.fileId !== context.fileId ||
		latestContext.section !== context.section
	) {
		return;
	}
	applyVariableMetadataLabels(context.section, lookup, context.fileId);
}

function installVariableMetadataObserver(): void {
	if (variableMetadataObserver || !document.body) return;
	variableMetadataObserver = new MutationObserver(scheduleVariableMetadataSync);
	variableMetadataObserver.observe(document.body, {
		childList: true,
		subtree: true,
	});
	document.addEventListener('click', scheduleVariableMetadataSync, true);
	scheduleVariableMetadataSync();
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
		field.type === 'color'
			? clampBackgroundColorValue(normalizedValue || field.defaultValue)
			: normalizedValue || field.defaultValue
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
		setBotExecutionModalPosition(await getBotExecutionModalPosition());
		await applyStyleClasses();
		await applyStyleValues();
		setSoundsEnabled(await getSoundsEnabled());
		setSuggestionsEnabled(await getShowSuggestions());
		setActiveCommandPaletteEnabled(await getCommandPaletteEnabled());
		setActiveBlockTaskbotNodeLabelClicks(await getBlockTaskbotNodeLabelClicks());
		setForceEnglishLocaleEnabled(await getForceEnglishLocale());
		setKeepAliveEnabled(await getKeepAliveEnabled());
		setActiveCommandPaletteShortcut(await getCommandPaletteShortcut());
		setActiveOpenSidebarShortcut(await getOpenSidebarShortcut());
	} catch (error) {
		void debugError('content', 'Initial settings failed.', { error }, {
			feedback: true,
		});
		document.documentElement.classList.remove(STYLE_CLASS);
		setCustomPaletteButtonsEnabled(false);
		setPathFinderSlimSidebarEnabled(false);
		syncScrollableFoldersAutoScroll();
		syncBotExecutionModal();
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

function clearKeepAliveTimer(): void {
	if (!keepAliveTimer) return;
	clearInterval(keepAliveTimer);
	keepAliveTimer = undefined;
}

function sendKeepAliveActivity(): void {
	window.dispatchEvent(new Event('pointermove'));
}

function setKeepAliveEnabled(enabled: boolean): void {
	if (!enabled || !isTopFrame()) {
		clearKeepAliveTimer();
		return;
	}
	sendKeepAliveActivity();
	if (keepAliveTimer) return;
	keepAliveTimer = setInterval(sendKeepAliveActivity, KEEP_ALIVE_INTERVAL_MS);
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
	return readAutomationAnywhereAuthTokenFromLocalStorage();
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
		if (message.type === 'RUN_STYLE_DOCTOR') {
			return { ok: true, doctorReport: await runStyleDoctor() };
		}
		if (message.type === 'RUN_STYLE_DOCTOR_CHECK') {
			const result = runSingleCheck(message.checkId);
			if (!result) return { ok: false, error: `Unknown check: ${message.checkId}` };
			return { ok: true, doctorCheckResult: result };
		}
		if (message.type === 'FINISH_STYLE_DOCTOR_RUN') {
			return { ok: true, message: 'Doctor run finished.' };
		}
		if (message.type === 'TOGGLE_STYLES') {
			await applyStyleClasses();
			return;
		}
		if (message.type === 'SET_FORCE_UNSUPPORTED_CONTROL_ROOM_STYLES') {
			await applyStyleClasses();
			return;
		}
		if (message.type === 'SET_RUN_BUTTON_WAVES') {
			activeRunButtonWavesEnabled = message.enabled;
			setRunButtonAnimationEnabled(
				activeRunButtonStyleEnabled,
				activeRunButtonWavesEnabled
			);
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
		if (message.type === 'SET_KEEP_ALIVE_ENABLED') {
			setKeepAliveEnabled(message.enabled);
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
		if (message.type === 'SET_BOT_EXECUTION_MODAL_POSITION') {
			setBotExecutionModalPosition(
				normalizeBotExecutionModalPosition(message.position)
			);
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
				? { ok: true, message: t('Paste queued.'), json }
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
			return { ok: true, html: getHelpHtml(getCommandPaletteShortcutLabel(await getCommandPaletteShortcut())) };
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
		browser.runtime.onMessage.addListener((message: RuntimeMessage) => {
			return handleRuntimeMessage(message);
		});
		await applyInitialSettings();
		startGlobalClipboardWatcher();

		stylesEnabled.watch(() => {
			void applyStyleClasses();
		});
		styleFeatureItems.runButton.watch(() => {
			void applyStyleClasses();
		});
		runButtonWaves.watch(() => {
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
		keepAliveEnabled.watch((value) => {
			setKeepAliveEnabled(value ?? DEFAULT_KEEP_ALIVE_ENABLED);
		});
		forceUnsupportedControlRoomStyles.watch(() => {
			void applyStyleClasses();
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
		botExecutionModalPosition.watch((value) => {
			setBotExecutionModalPosition(normalizeBotExecutionModalPosition(value));
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
			installVariableMetadataObserver();
			callInitializeRepeatedly();
		});
	},
});
