import '../src/styl/index.styl';
import {
	copyToSlot,
	importActionJson,
	pasteFromSlot,
	setGlobalClipboardWatcherEnabled,
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
import {
	ACTIVE_EDITOR_PALETTE_VARIABLES_SELECTOR,
	EDITOR_PALETTE_SECTION_SELECTOR,
	FOLDER_REFRESH_SELECTOR,
	NATIVE_TOAST_SELECTOR,
	SHARED_COPY_BUTTON_SELECTOR,
	SHARED_PASTE_BUTTON_SELECTOR,
	TASK_EDITOR_CAPABILITY_SELECTOR,
	TASKBOT_SAVE_BUTTON_SELECTOR,
	VARIABLE_LABEL_SELECTOR,
	VARIABLE_LABEL_TEXT_SELECTOR,
	VARIABLE_ROW_SELECTOR,
} from '../src/ts/automation-anywhere-selectors';
import { findNonClosingMessageBoxes } from '../src/ts/automation-anywhere-json';
import {
	clampBackgroundColorValue,
	getBackgroundColorRgbChannels,
} from '../src/ts/background-colors';
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
	extractAutomationAnywherePackages,
	parseAutomationAnywherePageContext,
	readAutomationAnywhereAuthTokenFromLocalStorage,
} from '../src/ts/automation-anywhere-api';
import { getAutomationAnywherePackageUpdates } from '../src/ts/automation-anywhere-tools';
import { setScrollableFoldersAutoScrollEnabled } from '../src/ts/folders';
import { setActiveLanguagePreference, t } from '../src/ts/i18n';
import {
	evaluateControlRoomCompatibility,
	formatControlRoomTarget,
	type ControlRoomCompatibilityStatus,
} from '../src/ts/control-room-version';
import { runStyleDoctor, runSingleCheck } from '../src/ts/style-doctor';
import {
	initializeUi,
	refreshUi,
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
	DEFAULT_NON_CLOSING_MESSAGE_BOX_WARNING_ENABLED,
	DEFAULT_PACKAGE_UPDATE_TOAST_ENABLED,
	DEFAULT_VARIABLE_METADATA_ENABLED,
	getPackageUpdateToastEnabled,
	getNonClosingMessageBoxWarningEnabled,
	getVariableMetadataEnabled,
	packageUpdateToastEnabled,
	nonClosingMessageBoxWarningEnabled,
	variableMetadataEnabled,
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
import { showNotification } from '../src/ts/ui';
import { setRunButtonAnimationEnabled } from '../src/ts/run-button-animation';
import { setSoundsEnabled } from '../src/ts/sounds';
import { setSuggestionsEnabled } from '../src/ts/suggestions';
import { updateCommandPaletteLanguage } from '../src/ts/palette';
import { setContentIconButton } from '../src/ts/content-icons';
import {
	extractVariableMetadataLookup,
	findVariableMetadata,
	type VariableMetadataLookup,
} from '../src/ts/variable-metadata';

const DEFAULT_LOADING_IMAGE_CSS = `url("${browser.runtime.getURL(
	'media/loading.gif' as any
)}")`;
const OPEN_SIDEBAR_BUTTON_ID = 'better-aa-open-sidebar-button';
const FOLDERS_ROUTE_CLASS = 'better-aa-route-folders';
const TASKBOT_ROUTE_CLASS = 'better-aa-route-taskbot';
const TEXT_FILE_ROUTE_CLASS = 'better-aa-route-text-file';
const SCROLLABLE_FOLDERS_CLASS = 'better-aa-make-sidebar-scrollable';
const BOT_EXECUTION_MODAL_CLASS = 'better-aa-minimize-bot-modal';
const KEEP_ALIVE_INTERVAL_MS = 60_000;
const VARIABLE_METADATA_ORIGINAL_TEXT_ATTR = 'data-better-aa-original-text';

let keepAliveTimer: ReturnType<typeof setInterval> | undefined;
let activeRunButtonStyleEnabled = false;
let activeRunButtonWavesEnabled = false;
let variableMetadataObserver: MutationObserver | null = null;
let variableMetadataObservedSection: HTMLElement | null = null;
let variableMetadataScheduled = false;
let variableMetadataCurrentFileId: string | null = null;
let variableMetadataMissingSignature: string | null = null;
let variableMetadataExhaustedSignature: string | null = null;
let variableMetadataMissingRetryCount = 0;
let variableMetadataRetryTimer: ReturnType<typeof setTimeout> | undefined;
const variableMetadataCache = new Map<
	string,
	Promise<VariableMetadataLookup | null>
>();

function applyBundledAssetVariables(): void {
	document.documentElement.style.setProperty(
		'--better-aa-loading-image-url',
		DEFAULT_LOADING_IMAGE_CSS
	);
}

function applyRouteClasses(): void {
	const href = location.href;
	void checkPackageUpdateToast();
	document.documentElement.classList.toggle(FOLDERS_ROUTE_CLASS, isFolderRepositoryUrl(href));
	document.documentElement.classList.toggle(TASKBOT_ROUTE_CLASS, isTaskEditorUrl(href));
	document.documentElement.classList.toggle(TEXT_FILE_ROUTE_CLASS, isTextFileUrl(href));
	syncScrollableFoldersAutoScroll();
	syncBotExecutionModal();
	if (isTopFrame()) setGlobalClipboardWatcherEnabled(isTaskEditorUrl(href));
	scheduleVariableMetadataSync();
	refreshUi();
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

function getPageContextLogDetails(): Record<string, unknown> {
	const context = parseAutomationAnywherePageContext(location.href);
	return {
		pageType: context.pageType,
		host: context.hostname,
		fileId: context.fileId,
		folderId: context.folderId,
	};
}

function watchRouteChanges(): void {
	let lastRouteUrl = location.href;
	let lastRouteContext = parseAutomationAnywherePageContext(location.href);
	let updateScheduled = false;
	const update = () => {
		if (updateScheduled) return;
		updateScheduled = true;
		requestAnimationFrame(() => {
			updateScheduled = false;
			applyRouteClasses();
			if (location.href === lastRouteUrl) return;
			lastRouteUrl = location.href;
			const routeContext = parseAutomationAnywherePageContext(lastRouteUrl);
			if (routeContext.mode !== lastRouteContext.mode) {
				void applyStyleClasses();
			}
			if (routeContext.pageType !== lastRouteContext.pageType) {
				void debugInfo(
					'content',
					'Automation Anywhere route page type changed.',
					{
						previousPageType: lastRouteContext.pageType,
						pageType: routeContext.pageType,
						host: routeContext.hostname,
						fileId: routeContext.fileId,
						folderId: routeContext.folderId,
					},
					{ feedback: true, keepDetails: true, debugOnly: true }
				);
			}
			lastRouteContext = routeContext;
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
		return evaluateControlRoomCompatibility(undefined, response?.error);
	} catch (error) {
		return evaluateControlRoomCompatibility(
			undefined,
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
	const customPaletteButtonsEnabled =
		effectiveEnabled &&
		styleFeatures.customPaletteButtons &&
		parseAutomationAnywherePageContext(location.href).mode !== 'view';
	document.documentElement.dataset.betterAaControlRoomState = compatibility.state;
	document.documentElement.dataset.betterAaSupportedControlRoom =
		formatControlRoomTarget(compatibility.target);
	document.documentElement.classList.toggle(STYLE_CLASS, effectiveEnabled);
	for (const feature of STYLE_FEATURES) {
		document.documentElement.classList.toggle(
			feature.className,
			feature.key === 'customPaletteButtons'
				? customPaletteButtonsEnabled
				: styleFeatures[feature.key]
		);
	}
	activeRunButtonStyleEnabled = effectiveEnabled && styleFeatures.runButton;
	activeRunButtonWavesEnabled = runButtonWavesEnabled;
	setRunButtonAnimationEnabled(activeRunButtonStyleEnabled, activeRunButtonWavesEnabled);
	setCustomPaletteButtonsEnabled(customPaletteButtonsEnabled);
	setPathFinderSlimSidebarEnabled(effectiveEnabled && styleFeatures.pathFinder);
	syncScrollableFoldersAutoScroll();
	syncBotExecutionModal();
	scheduleVariableMetadataSync();
}

function getLabelTextElement(label: HTMLElement): HTMLElement {
	return label.querySelector<HTMLElement>(VARIABLE_LABEL_TEXT_SELECTOR) ?? label;
}

function restoreVariableMetadataLabel(label: HTMLElement): void {
	const originalText = label.getAttribute(VARIABLE_METADATA_ORIGINAL_TEXT_ATTR);
	if (originalText === null) return;

	getLabelTextElement(label).textContent = originalText;
	label.setAttribute('data-text', originalText);
	label.setAttribute('title', originalText);
	label.removeAttribute(VARIABLE_METADATA_ORIGINAL_TEXT_ATTR);
	label.classList.remove('better-aa-variable-metadata-label');
	const row = label.closest(VARIABLE_ROW_SELECTOR);
	row?.classList.remove('better-aa-variable-metadata-row');
	row?.classList.remove('better-aa-variable-metadata-unused');
}

function restoreVariableMetadataLabels(root: ParentNode = document): void {
	root
		.querySelectorAll<HTMLElement>(
			`[${VARIABLE_METADATA_ORIGINAL_TEXT_ATTR}]`
		)
		.forEach(restoreVariableMetadataLabel);
}

function getActiveVariablesSection(): HTMLElement | null {
	const button = document.querySelector<HTMLButtonElement>(
		ACTIVE_EDITOR_PALETTE_VARIABLES_SELECTOR
	);
	return button?.closest<HTMLElement>(EDITOR_PALETTE_SECTION_SELECTOR) ?? null;
}

let variableMetadataActive = DEFAULT_VARIABLE_METADATA_ENABLED;

function getVariableMetadataContext(): {
	baseUrl: string;
	fileId: string;
	section: HTMLElement;
} | null {
	if (!variableMetadataActive) return null;
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
		void debugWarn(
			'variable-metadata',
			'Automation Anywhere auth token not found.',
			{ fileId },
			{ feedback: true, keepDetails: true }
		);
		return null;
	}

	const promise = new AutomationAnywhereApi(baseUrl, authToken)
		.getBotContent(fileId)
		.then((content) => {
			const lookup = extractVariableMetadataLookup(content, t('(unused)'));
			void debugInfo(
				'variable-metadata',
				'Variable metadata loaded.',
				{ fileId, variableCount: lookup.size },
				{ feedback: true, keepDetails: true, debugOnly: true }
			);
			return lookup;
		})
		.catch((error) => {
			void debugWarn(
				'variable-metadata',
				'Variable metadata load failed.',
				{ fileId, error },
				{ feedback: true, keepDetails: true }
			);
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
	variableMetadataExhaustedSignature = null;
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
		if (
			variableMetadataMissingRetryCount >= 2 &&
			variableMetadataExhaustedSignature !== signature
		) {
			variableMetadataExhaustedSignature = signature;
			void debugWarn(
				'variable-metadata',
				'Variable metadata retry exhausted.',
				{ fileId, missingNames, retryCount: variableMetadataMissingRetryCount },
				{ feedback: true, keepDetails: true }
			);
		}
		return;
	}

	const refresh = (): void => {
		variableMetadataRetryTimer = undefined;
		variableMetadataCache.delete(fileId);
		scheduleVariableMetadataSync();
	};
	const retryCount = variableMetadataMissingRetryCount++;
	void debugInfo(
		'variable-metadata',
		'Variable metadata retry queued.',
		{ fileId, missingNames, retryCount },
		{ feedback: true, keepDetails: true, debugOnly: true }
	);
	if (retryCount === 0) refresh();
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
	let appliedCount = 0;
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
		appliedCount += 1;

		const normalizedRowName = (rowName ?? '').replace(/\s+/g, ' ').trim();
		const stashedOriginal = label.getAttribute(VARIABLE_METADATA_ORIGINAL_TEXT_ATTR);
		if (stashedOriginal === null) {
			label.setAttribute(
				VARIABLE_METADATA_ORIGINAL_TEXT_ATTR,
				getLabelTextElement(label).textContent ?? ''
			);
		} else if (
			normalizedRowName &&
			stashedOriginal.replace(/\s+/g, ' ').trim().toLocaleLowerCase() !==
				normalizedRowName.toLocaleLowerCase()
		) {
			// Row was re-rendered under a different variable name; stale stash would
			// restore the old name and show duplicates.
			label.setAttribute(VARIABLE_METADATA_ORIGINAL_TEXT_ATTR, normalizedRowName);
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
		row.classList.toggle('better-aa-variable-metadata-unused', metadata.unused);
	});

	void debugInfo(
		'variable-metadata',
		'Variable metadata labels synced.',
		{ fileId, appliedCount, missingCount: missingNames.length, missingNames },
		{ feedback: true, keepDetails: true, debugOnly: true }
	);
	if (missingNames.length) refreshMissingVariableMetadata(fileId, missingNames);
	else clearVariableMetadataMissingRefresh();
}

async function syncVariableMetadataLabels(): Promise<void> {
	const context = getVariableMetadataContext();
	setVariableMetadataObserverSection(context?.section ?? null);
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
		if (variableMetadataCurrentFileId) {
			variableMetadataCache.delete(variableMetadataCurrentFileId);
		}
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

function setVariableMetadataObserverSection(section: HTMLElement | null): void {
	if (section === variableMetadataObservedSection) return;
	variableMetadataObserver?.disconnect();
	variableMetadataObserver = null;
	variableMetadataObservedSection = section;
	if (!section) return;
	variableMetadataObserver = new MutationObserver(scheduleVariableMetadataSync);
	variableMetadataObserver.observe(section, {
		childList: true,
		subtree: true,
	});
}

function installVariableMetadataObserver(): void {
	document.addEventListener('click', scheduleVariableMetadataSync, true);
	scheduleVariableMetadataSync();
}

const packageUpdateToastFileIds = new Set<string>();
const packageUpdateToastPendingFileIds = new Set<string>();
let packageUpdateToastActive = DEFAULT_PACKAGE_UPDATE_TOAST_ENABLED;
let nonClosingMessageBoxWarningActive =
	DEFAULT_NON_CLOSING_MESSAGE_BOX_WARNING_ENABLED;
let nativeSaveObserver: MutationObserver | null = null;
let nativeSaveTimeout: ReturnType<typeof setTimeout> | null = null;
const NATIVE_SAVE_TIMEOUT_MS = 30_000;

async function checkPackageUpdateToast(): Promise<void> {
	if (!packageUpdateToastActive) return;
	const context = parseAutomationAnywherePageContext(location.href);
	if (
		(context.pageType !== 'private-taskbot' &&
			context.pageType !== 'public-taskbot') ||
		!context.fileId ||
		!context.baseUrl
	) {
		return;
	}
	if (
		packageUpdateToastFileIds.has(context.fileId) ||
		packageUpdateToastPendingFileIds.has(context.fileId)
	) return;

	const authToken = readAutomationAnywhereAuthTokenFromLocalStorage();
	if (!authToken) return;
	packageUpdateToastPendingFileIds.add(context.fileId);

	try {
		const api = new AutomationAnywhereApi(context.baseUrl, authToken);
		const [content, defaultVersions] = await Promise.all([
			api.getBotContent(context.fileId),
			api.getDefaultPackageVersions(),
		]);
		const updates = getAutomationAnywherePackageUpdates(
			extractAutomationAnywherePackages(content),
			defaultVersions
		);
		const currentContext = parseAutomationAnywherePageContext(location.href);
		if (
			currentContext.fileId !== context.fileId ||
			currentContext.baseUrl !== context.baseUrl
		) return;
		packageUpdateToastFileIds.add(context.fileId);
		if (!updates.length) return;

		const shown = updates
			.slice(0, 3)
			.map((update) => `${update.name} ${update.currentVersion} → ${update.targetVersion}`);
		if (updates.length > 3) {
			shown.push(t('+{count} more', { count: updates.length - 3 }));
		}
		showNotification(
			t('Package updates available ({count})', { count: updates.length }),
			shown
		);
	} catch (error) {
		void debugWarn(
			'package-updates',
			'Package update check failed.',
			{ fileId: context.fileId, error },
			{ feedback: true, keepDetails: true }
		);
	} finally {
		packageUpdateToastPendingFileIds.delete(context.fileId);
	}
}

function clearNativeSaveWait(): void {
	nativeSaveObserver?.disconnect();
	nativeSaveObserver = null;
	if (nativeSaveTimeout !== null) clearTimeout(nativeSaveTimeout);
	nativeSaveTimeout = null;
}

function addedNodeContainsNativeToast(node: Node): boolean {
	if (!(node instanceof Element)) return false;
	const toast = node.matches(NATIVE_TOAST_SELECTOR)
		? node
		: node.querySelector(NATIVE_TOAST_SELECTOR);
	return Boolean(toast && !toast.closest('#better-aa-toast-host'));
}

function isNativeSaveBusy(button: HTMLButtonElement): boolean {
	return button.disabled || button.getAttribute('aria-busy') === 'true';
}

async function checkSavedTaskbotForNonClosingMessageBoxes(
	fileId: string,
	baseUrl: string
): Promise<void> {
	const context = parseAutomationAnywherePageContext(location.href);
	if (context.fileId !== fileId || context.baseUrl !== baseUrl) return;
	const authToken = readAutomationAnywhereAuthTokenFromLocalStorage();
	if (!authToken) return;

	try {
		const content = await new AutomationAnywhereApi(baseUrl, authToken).getBotContent(fileId);
		const findings = findNonClosingMessageBoxes(content);
		if (!findings.length) return;
		const shown = findings
			.slice(0, 3)
			.map((finding) => `${finding.packageName}.${finding.commandName}`);
		if (findings.length > 3) {
			shown.push(t('+{count} more', { count: findings.length - 3 }));
		}
		showNotification(
			t('Message boxes may never close ({count})', { count: findings.length }),
			shown
		);
	} catch (error) {
		void debugWarn(
			'message-box-warning',
			'Message-box save check failed.',
			{ fileId, error },
			{ feedback: true, keepDetails: true }
		);
	}
}

function handleSuccessfulNativeSave(fileId: string, baseUrl: string): void {
	variableMetadataCache.delete(fileId);
	if (variableMetadataCurrentFileId === fileId) scheduleVariableMetadataSync();
	if (nonClosingMessageBoxWarningActive) {
		void checkSavedTaskbotForNonClosingMessageBoxes(fileId, baseUrl);
	}
}

function installNativeSaveListener(): void {
	document.addEventListener(
		'click',
		(event) => {
			if (
				(!nonClosingMessageBoxWarningActive && !variableMetadataActive) ||
				!document.body
			) return;
			const button =
				event.target instanceof Element
					? event.target.closest<HTMLButtonElement>(TASKBOT_SAVE_BUTTON_SELECTOR)
					: null;
			if (!button || button.disabled) return;
			const context = parseAutomationAnywherePageContext(location.href);
			if (!context.fileId || !context.baseUrl || !isTaskEditorUrl(location.href)) return;

			clearNativeSaveWait();
			const { fileId, baseUrl } = context;
			let sawBusy = false;
			let sawToast = false;
			nativeSaveObserver = new MutationObserver((records) => {
				if (
					records.some(
						(record) =>
							record.type === 'attributes' &&
							record.target === button &&
							((record.attributeName === 'disabled' && record.oldValue === null) ||
								(record.attributeName === 'aria-busy' && record.oldValue !== 'true'))
					)
				) {
					sawBusy = true;
				}
				sawToast ||= records.some((record) =>
					[...record.addedNodes].some(addedNodeContainsNativeToast)
				);
				if (!sawBusy || !sawToast || isNativeSaveBusy(button)) return;
				clearNativeSaveWait();
				handleSuccessfulNativeSave(fileId, baseUrl);
			});
			nativeSaveObserver.observe(document.body, {
				attributes: true,
				attributeFilter: ['disabled', 'aria-busy'],
				attributeOldValue: true,
				childList: true,
				subtree: true,
			});
			nativeSaveTimeout = setTimeout(clearNativeSaveWait, NATIVE_SAVE_TIMEOUT_MS);
		},
		true
	);
}

function setStyleValue(key: string, value: string): void {
	const field = STYLE_VALUE_FIELDS.find((item) => item.key === key);
	if (!field) return;
	const normalizedValue = value.trim();
	if (!normalizedValue && field.key === 'userBg') {
		document.documentElement.style.removeProperty(field.cssVar);
		return;
	}
	const nextValue =
		field.type === 'color'
			? clampBackgroundColorValue(normalizedValue || field.defaultValue)
			: normalizedValue || field.defaultValue;
	document.documentElement.style.setProperty(field.cssVar, nextValue);
	if (field.type === 'color') {
		const rgbChannels = getBackgroundColorRgbChannels(nextValue);
		if (rgbChannels) {
			document.documentElement.style.setProperty(`${field.cssVar}-rgb`, rgbChannels);
		} else {
			document.documentElement.style.removeProperty(`${field.cssVar}-rgb`);
		}
	}
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
	packageUpdateToastActive = await getPackageUpdateToastEnabled();
	void checkPackageUpdateToast();
	nonClosingMessageBoxWarningActive =
		await getNonClosingMessageBoxWarningEnabled();
	variableMetadataActive = await getVariableMetadataEnabled();
	scheduleVariableMetadataSync();
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
	if (!(button instanceof HTMLButtonElement)) return;
	setContentIconButton(button, 'panel-right-open', t('Better AA'));
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
	setContentIconButton(button, 'panel-right-open', t('Better AA'));
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
	const refreshButton = document.querySelector(FOLDER_REFRESH_SELECTOR);
	if (!(refreshButton instanceof HTMLElement)) return false;
	refreshButton.click();
	return true;
}

function getToolCapabilities(): ContentActionResponse {
	const universalClipboard =
		Boolean(document.querySelector(SHARED_COPY_BUTTON_SELECTOR)) ||
		Boolean(document.querySelector(SHARED_PASTE_BUTTON_SELECTOR)) ||
		Boolean(document.querySelector(TASK_EDITOR_CAPABILITY_SELECTOR));
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
			refreshUi();
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
		void debugError(
			'content',
			'Content action failed.',
			{
				messageType: message.type,
				...getPageContextLogDetails(),
				error,
			},
			{ feedback: true, keepDetails: true }
		);
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
			if (message.type === 'GET_AA_AUTH_TOKEN' && !isTopFrame()) return;
			return handleRuntimeMessage(message);
		});
		await applyInitialSettings();
		if (isTopFrame()) {
			installNativeSaveListener();
		}

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
		packageUpdateToastEnabled.watch((value) => {
			packageUpdateToastActive = value ?? DEFAULT_PACKAGE_UPDATE_TOAST_ENABLED;
			if (packageUpdateToastActive) void checkPackageUpdateToast();
		});
		nonClosingMessageBoxWarningEnabled.watch((value) => {
			nonClosingMessageBoxWarningActive =
				value ?? DEFAULT_NON_CLOSING_MESSAGE_BOX_WARNING_ENABLED;
			if (!nonClosingMessageBoxWarningActive && !variableMetadataActive) {
				clearNativeSaveWait();
			}
		});
		variableMetadataEnabled.watch((value) => {
			variableMetadataActive = value ?? DEFAULT_VARIABLE_METADATA_ENABLED;
			if (!variableMetadataActive && !nonClosingMessageBoxWarningActive) {
				clearNativeSaveWait();
			}
			scheduleVariableMetadataSync();
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
			refreshUi();
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
			initializeUi();
		});
	},
});
