import './style.styl';
import { getHelpTipId, initializeHelpTooltips, renderHelpTip } from './help';
import {
	clearAutomationAnywhereJsonDetails,
	downloadJsonTextFile,
	getJsonDownloadText,
	renderAutomationAnywhereJsonDetails,
} from './json-info';
import { initializeToolsPanel, renderToolsPanel } from './tools';
import { getCommandHelp, renderHelpHtml } from '@/src/ts/help';
import {
	setActiveLanguagePreference,
	t,
	type LanguagePreference,
} from '@/src/ts/i18n';
import type {
	BackgroundMessage,
	ContentActionMessage,
	ContentActionResponse,
	ExtensionShortcuts,
} from '@/src/ts/messages';
import {
	isAutomationAnywhereJson,
	summarizeAutomationAnywhereJson,
} from '@/src/ts/automation-anywhere-json';
import {
	COMMAND_PALETTE_SHORTCUTS,
	BOT_EXECUTION_MODAL_POSITION_OPTIONS,
	DEFAULT_BLOCK_TASKBOT_NODE_LABEL_CLICKS,
	DEFAULT_BOT_EXECUTION_MODAL_POSITION,
	DEFAULT_COMMAND_PALETTE_ENABLED,
	DEFAULT_DEBUG_ENABLED,
	DEFAULT_EXTENSION_LANGUAGE,
	DEFAULT_FORCE_ENGLISH_LOCALE,
	DEFAULT_OPEN_SIDEBAR_SHORTCUT,
	DEFAULT_SOUNDS_ENABLED,
	DEFAULT_SHOW_SUGGESTIONS,
	DEFAULT_STYLES_ENABLED,
	EXTENSION_LANGUAGE_OPTIONS,
	EXTENSION_VERSION,
	OPEN_SIDEBAR_SHORTCUT_OPTIONS,
	STYLE_FEATURES,
	STYLE_VALUE_FIELDS,
	botExecutionModalPosition,
	blockTaskbotNodeLabelClicks,
	commandPaletteEnabled,
	commandPaletteShortcut,
	debugEnabled,
	extensionLanguage,
	forceEnglishLocale,
	getBlockTaskbotNodeLabelClicks,
	getBotExecutionModalPosition,
	getCommandPaletteEnabled,
	getCommandPaletteShortcut,
	getCommandPaletteShortcutLabel,
	getDebugEnabled,
	getExtensionLanguage,
	getForceEnglishLocale,
	getOpenSidebarShortcut,
	getOpenSidebarShortcutLabel,
	getShowSuggestions,
	getSoundsEnabled,
	getStyleFeatureValues,
	getStyleValues,
	getStylesEnabled,
	normalizeBotExecutionModalPosition,
	normalizeExtensionLanguage,
	normalizeOpenSidebarShortcut,
	openSidebarShortcut,
	showSuggestions,
	soundsEnabled,
	styleFeatureItems,
	styleValueItems,
	stylesEnabled,
	type BotExecutionModalPosition,
	type CommandPaletteShortcut,
	type OpenSidebarShortcut,
	type StyleFeatureKey,
	type StyleValueKey,
} from '@/src/ts/settings';
import {
	DEFAULT_UNIVERSAL_CLIPBOARD_SLOT,
	UNIVERSAL_CLIPBOARD_SLOTS,
	universalClipboardSlot,
} from '@/src/ts/universal-clipboard-storage';
import {
	sidepanelRequest,
	type SidepanelRequest,
	type SidepanelTab,
} from '@/src/ts/sidepanel-state';
import {
	addFeedback,
	clearFeedback,
	debugError,
	debugInfo,
	debugWarn,
	feedbackHistory,
	getFeedbackHistory,
	type DebugEvent,
	type FeedbackSeverity,
} from '@/src/ts/debug';

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('Missing #app root.');

const EXTENSION_LANGUAGE_CACHE_KEY = 'betterAaExtensionLanguage';

function getCachedExtensionLanguage(): LanguagePreference {
	try {
		return normalizeExtensionLanguage(localStorage.getItem(EXTENSION_LANGUAGE_CACHE_KEY));
	} catch {
		return DEFAULT_EXTENSION_LANGUAGE;
	}
}

function cacheExtensionLanguage(language: LanguagePreference): void {
	try {
		localStorage.setItem(EXTENSION_LANGUAGE_CACHE_KEY, language);
	} catch {
		// Storage cache is best-effort; browser extension storage remains authoritative.
	}
}

setActiveLanguagePreference(getCachedExtensionLanguage());

const extensionVersion = browser.runtime.getManifest().version || EXTENSION_VERSION;
const defaultLoadingImageCss = `url("${browser.runtime.getURL('media/loading.gif' as any)}")`;
const MAX_BACKGROUND_UPLOAD_BYTES = 3 * 1024 * 1024;
const ALLOWED_BACKGROUND_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif']);
const ALLOWED_BACKGROUND_MIME_TYPES = new Set([
	'image/png',
	'image/jpeg',
	'image/webp',
	'image/gif',
]);
let currentShortcut: CommandPaletteShortcut = COMMAND_PALETTE_SHORTCUTS.ALT_P;
let currentOpenSidebarShortcut: OpenSidebarShortcut = DEFAULT_OPEN_SIDEBAR_SHORTCUT;
const BACKGROUND_COLOR_KEYS = [
	'backgroundColor1',
	'backgroundColor2',
	'backgroundColor3',
] as const satisfies readonly StyleValueKey[];
const STYLE_FEATURE_GROUPS = [
	{
		title: 'Taskbot Editor',
		keys: [
			'customPaletteButtons',
			'runButton',
			'editorTabsButtons',
			'minimizeBotModal',
		],
	},
	{
		title: 'Folder navigation',
		keys: ['makeSidebarScrollable', 'adjustFolderColumnsWidth'],
	},
	{
		title: 'General',
		keys: ['pathFinder', 'bgStyle', 'loadingCat'],
	},
] as const satisfies ReadonlyArray<{
	title: string;
	keys: readonly StyleFeatureKey[];
}>;
const STYLE_FEATURE_HELP_TIPS: Partial<Record<StyleFeatureKey, string>> = {
	minimizeBotModal:
		'Adds Minimize and Maximize buttons to the running bot window. Minimized mode keeps the page behind it clickable.',
	makeSidebarScrollable:
		'Makes folder sidebar sticky and scrollable. On folder pages, centers active folder automatically.',
};

function getClipboardSlotLabel(slot: number): string {
	return slot === DEFAULT_UNIVERSAL_CLIPBOARD_SLOT
		? t('Default')
		: t('Slot {slot}', { slot });
}

function renderClipboardSlotRow(slot: number): string {
	const label = getClipboardSlotLabel(slot);
	return `
		<div class="slot-row is-empty" data-slot-row="${slot}" role="button" tabindex="0" aria-label="${t('Load {label}', { label })}">
			<span class="slot-label">${label}</span>
			<span class="slot-state" data-slot-state="${slot}">${t('Empty')}</span>
			<span class="help-wrapper">
				<button class="help-anchor" type="button" data-copy-slot="${slot}" aria-describedby="${getHelpTipId(`slot-${slot}-copy`)}">${t('Copy')}</button>
				${renderHelpTip(`slot-${slot}-copy`, t('Save current AA clipboard to this slot.'))}
			</span>
			<span class="help-wrapper">
				<button class="help-anchor" type="button" data-paste-slot="${slot}" aria-describedby="${getHelpTipId(`slot-${slot}-paste`)}">${t('Paste')}</button>
				${renderHelpTip(`slot-${slot}-paste`, t('Paste this slot through AA shared paste.'))}
			</span>
		</div>
	`;
}

function renderToolsConfigSection(): string {
	return `
		<section class="panel-section">
			<h2>${t('Extension Settings')}</h2>
			<label class="select-row">
				<span>
					<strong>${t('Extension language')}</strong>
					<small>${t('Use browser language, English, or Spanish for this extension UI.')}</small>
				</span>
				<select id="extensionLanguage">
					${EXTENSION_LANGUAGE_OPTIONS.map((option) => `<option value="${option.value}">${t(option.label)}</option>`).join('')}
				</select>
			</label>
			<label class="select-row">
				<span>
					<strong>${t('Command palette')}</strong>
					<small id="shortcutLabel"></small>
				</span>
				<select id="commandPaletteShortcut">
					<option value="${COMMAND_PALETTE_SHORTCUTS.ALT_P}">Alt + P</option>
					<option value="${COMMAND_PALETTE_SHORTCUTS.SLASH}">/</option>
				</select>
			</label>
			<label class="setting-row">
				<span>
					<strong>${t('Show command palette')}</strong>
					<small>${t('Enable the in-page command palette shortcut and popup.')}</small>
				</span>
				<input id="commandPaletteEnabled" type="checkbox">
			</label>
			<label class="select-row">
				<span>
					<strong>${t('Sidebar shortcut')}</strong>
					<small id="openSidebarShortcutLabel"></small>
				</span>
				<select id="openSidebarShortcut" class="shortcut-select">
					${OPEN_SIDEBAR_SHORTCUT_OPTIONS.map((option) => `<option value="${option.value}">${option.label}</option>`).join('')}
				</select>
			</label>
			<label class="setting-row">
				<span>
					<strong>${t('Sounds')}</strong>
					<small>${t('Run, error, and done tones')}</small>
				</span>
				<input id="soundsEnabled" type="checkbox">
			</label>
			<label class="setting-row">
				<span>
					<strong>${t('Show suggestions')}</strong>
					<small>${t('Short mouse-click tips for common shortcuts')}</small>
				</span>
				<input id="showSuggestions" type="checkbox">
			</label>
			<label class="setting-row">
				<span>
					<strong>${t('Block taskbot link clicks')}</strong>
					<small>${t('Prevent left-click navigation on taskbot node links; middle-click still works.')}</small>
				</span>
				<input id="blockTaskbotNodeLabelClicks" type="checkbox">
			</label>
			<label class="setting-row">
				<span>
					<strong>${t('Force Automation Anywhere English')}</strong>
					<small>${t('Set Automation Anywhere locale to en-US and reload when needed. Does not change this extension language.')}</small>
				</span>
				<input id="forceEnglishLocale" type="checkbox">
			</label>
		</section>
	`;
}

function renderUniversalClipboardSection(): string {
	return `
		<h2>${t('Universal Clipboard')}</h2>
		<div class="slots">
			${UNIVERSAL_CLIPBOARD_SLOTS.map(renderClipboardSlotRow).join('')}
		</div>

		<h2>${t('Action JSON')}</h2>
		<p class="inline-hint">${t('Advanced: imports raw Automation Anywhere clipboard JSON.')}</p>
		<div class="json-field">
			<textarea id="actionJson" class="json-area" spellcheck="false" placeholder="${t('Universal copy loads selected action JSON here. Paste JSON here to import.')}"></textarea>
			<button id="clearJson" class="clear-json-button help-anchor" type="button" aria-label="${t('Clear JSON')}" aria-describedby="${getHelpTipId('clear-json')}" hidden>
				<svg aria-hidden="true" viewBox="0 0 24 24">
					<path d="M3 6h18"></path>
					<path d="M8 6V4h8v2"></path>
					<path d="M6 6l1 15h10l1-15"></path>
					<path d="M10 11v6"></path>
					<path d="M14 11v6"></path>
				</svg>
			</button>
			${renderHelpTip('clear-json', t('Clear the Action JSON field.'))}
		</div>
		<div id="actionPackageList" class="action-package-list" hidden></div>
		<div class="button-grid">
			<span class="help-wrapper">
				<button id="importJson" class="help-anchor" type="button" aria-describedby="${getHelpTipId('import-json')}">${t('Import JSON')}</button>
				${renderHelpTip('import-json', t('Import textarea JSON into AA clipboard.'))}
			</span>
			<span class="help-wrapper">
				<button id="copyJsonText" class="help-anchor" type="button" aria-describedby="${getHelpTipId('copy-json')}">${t('Copy JSON')}</button>
				${renderHelpTip('copy-json', t('Copy textarea JSON to system clipboard.'))}
			</span>
			<span class="help-wrapper button-grid-full">
				<button id="exportJsonText" class="help-anchor" type="button" aria-describedby="${getHelpTipId('export-json')}">${t('Export JSON')}</button>
				${renderHelpTip('export-json', t('Download textarea JSON as a .json file.'))}
			</span>
		</div>
	`;
}

function renderStyleFeatureControl(feature: (typeof STYLE_FEATURES)[number]): string {
	const helpTip = STYLE_FEATURE_HELP_TIPS[feature.key];
	const helpTipId = `style-feature-${feature.key}`;
	return `
		<label class="setting-row userstyle-dependent${helpTip ? ' help-anchor' : ''}"${helpTip ? ` aria-describedby="${getHelpTipId(helpTipId)}"` : ''}>
			<span>
				<strong>${t(feature.label)}</strong>
				<small>${t(feature.description)}</small>
			</span>
			<input id="styleFeature-${feature.key}" type="checkbox">
			${helpTip ? renderHelpTip(helpTipId, t(helpTip)) : ''}
		</label>
		${feature.key === 'minimizeBotModal' ? renderBotExecutionModalPositionControl() : ''}
	`;
}

function renderStyleFeatureControls(): string {
	return STYLE_FEATURE_GROUPS.map((group) => {
		const controls = group.keys
			.map((key) => STYLE_FEATURES.find((feature) => feature.key === key))
			.filter((feature): feature is (typeof STYLE_FEATURES)[number] => !!feature)
			.map(renderStyleFeatureControl)
			.join('');
		return `
			<div class="style-feature-group">
				<h3>${t(group.title)}</h3>
				${controls}
			</div>
		`;
	}).join('');
}

function renderBotExecutionModalPositionControl(): string {
	return `
		<label class="select-row userstyle-dependent bot-modal-position-dependent">
			<span>
				<strong>${t('Running bot window position')}</strong>
				<small>${t('Choose where the minimized running bot window appears.')}</small>
			</span>
			<select id="botExecutionModalPosition">
				${BOT_EXECUTION_MODAL_POSITION_OPTIONS.map((option) => `<option value="${option.value}">${t(option.label)}</option>`).join('')}
			</select>
		</label>
	`;
}

function renderStyleValueControl(field: (typeof STYLE_VALUE_FIELDS)[number]): string {
	if (field.key === 'userBg') {
		return `
			<div class="text-row userstyle-dependent">
				<span>
					<strong>${t(field.label)}</strong>
					<small>${t(field.description)}</small>
				</span>
				<input id="styleValue-${field.key}" type="hidden">
				<div class="upload-row">
					<input id="backgroundUpload" type="file" accept=".png,.jpg,.jpeg,.webp,.gif,image/png,image/jpeg,image/webp,image/gif">
					<span class="help-wrapper">
						<button id="clearBackgroundUpload" class="help-anchor" type="button" aria-describedby="${getHelpTipId('loading-default')}">${t('Use default')}</button>
						${renderHelpTip('loading-default', t('Use bundled loading animation image.'))}
					</span>
				</div>
				<div id="backgroundPreview" class="background-preview" aria-label="${t('Loading animation preview')}"></div>
			</div>
		`;
	}

	if (field.type === 'select' && 'options' in field) {
		return `
			<label class="select-row userstyle-dependent">
				<span>
					<strong>${t(field.label)}</strong>
					<small>${t(field.description)}</small>
				</span>
				<select id="styleValue-${field.key}">
					${field.options.map((option) => `<option value="${option}">${t(option)}</option>`).join('')}
				</select>
			</label>
		`;
	}

	if (field.type === 'color') {
		return `
			<label class="color-row userstyle-dependent">
				<span>
					<strong>${t(field.label)}</strong>
					<small>${t(field.description)}</small>
				</span>
				<span class="color-controls">
					<input id="styleValue-${field.key}" type="color" aria-label="${t(field.label)}">
					<input id="styleOpacity-${field.key}" type="range" min="0" max="1" step="0.01" aria-label="${t('{label} opacity', { label: t(field.label) })}">
					<output id="styleOpacityValue-${field.key}"></output>
				</span>
			</label>
		`;
	}

	return '';
}

function renderLoadingAnimationControls(): string {
	return STYLE_VALUE_FIELDS.filter((field) =>
		field.key === 'userBg' || field.key === 'userBgSize'
	)
		.map(renderStyleValueControl)
		.join('');
}

function renderBackgroundColorControls(): string {
	return STYLE_VALUE_FIELDS.filter((field) =>
		BACKGROUND_COLOR_KEYS.includes(field.key as (typeof BACKGROUND_COLOR_KEYS)[number])
	)
		.map(renderStyleValueControl)
		.join('');
}

app.innerHTML = `
	<header class="panel-header">
		<div>
			<h1>${t('Better AA Developer Experience')}</h1>
		</div>
		<div class="header-controls">
			<span class="version-chip">${extensionVersion}</span>
			<label class="debug-toggle">
				<span>${t('Debug Mode')}</span>
				<input id="debugEnabled" type="checkbox">
			</label>
		</div>
	</header>

	<section id="debugLogSection" class="panel-section feedback-section is-collapsed">
		<div class="section-heading-row">
			<h2>${t('Debug Log')}</h2>
			<span class="feedback-actions">
				<span class="help-wrapper">
					<button id="toggleDebugLog" class="debug-log-toggle help-anchor" type="button" aria-expanded="false" aria-label="${t('Expand debug log')}" aria-describedby="${getHelpTipId('debug-toggle')}"></button>
					${renderHelpTip('debug-toggle', t('Show or hide recent debug entries.'))}
				</span>
				<span class="help-wrapper">
					<button id="copyFeedback" class="help-anchor" type="button" aria-describedby="${getHelpTipId('debug-copy')}">${t('Copy')}</button>
					${renderHelpTip('debug-copy', t('Copy support log for troubleshooting.'))}
				</span>
				<span class="help-wrapper">
					<button id="clearFeedback" class="help-anchor" type="button" aria-describedby="${getHelpTipId('debug-clear')}">${t('Clear')}</button>
					${renderHelpTip('debug-clear', t('Clear local debug log entries.'))}
				</span>
			</span>
		</div>
		<p class="inline-hint">${t('Debug Mode stores local support logs. Nothing is sent automatically.')}</p>
		<div id="feedbackList" class="feedback-list" aria-live="polite"></div>
	</section>

	<p id="status" role="status"></p>

	<nav class="tab-list" role="tablist" aria-label="${t('Sidebar sections')}">
		<button class="tab-button is-active" type="button" role="tab" aria-selected="true" data-tab="tools">${t('Tools')}</button>
		<button class="tab-button" type="button" role="tab" aria-selected="false" data-tab="userstyle">${t('UI Improvements')}</button>
		<button class="tab-button" type="button" role="tab" aria-selected="false" data-tab="settings">${t('Settings')}</button>
	</nav>

	<main>
		${renderToolsPanel({
			universalClipboardHtml: renderUniversalClipboardSection(),
		})}

		<section class="tab-panel" role="tabpanel" data-panel="userstyle" hidden>
			<section class="panel-section">
				<div class="section-heading-row">
					<h2>${t('UI Improvements')}</h2>
					<span class="help-wrapper">
						<button id="restoreUserstyleDefaults" class="help-anchor" type="button" aria-describedby="${getHelpTipId('ui-restore-defaults')}" hidden>${t('Restore to Default')}</button>
						${renderHelpTip('ui-restore-defaults', t('Reset all UI Improvements options.'))}
					</span>
				</div>
				<label class="setting-row">
					<span>
						<strong>${t('Injected styles')}</strong>
						<small>${t('Enable all custom style rules')}</small>
					</span>
					<input id="stylesEnabled" type="checkbox">
				</label>
				${renderStyleFeatureControls()}
			</section>

			<section class="panel-section">
				<h2>${t('Loading Animation')}</h2>
				${renderLoadingAnimationControls()}
			</section>

			<section class="panel-section">
				<div class="section-heading-row">
					<h2>${t('Background Customization')}</h2>
					<span class="help-wrapper">
						<button id="resetGradientColors" class="help-anchor" type="button" aria-describedby="${getHelpTipId('reset-gradient-colors')}">${t('Reset Colors')}</button>
						${renderHelpTip('reset-gradient-colors', t('Restore background gradient defaults.'))}
					</span>
				</div>
				${renderBackgroundColorControls()}
			</section>
		</section>

		<section class="tab-panel" role="tabpanel" data-panel="settings" hidden>
			${renderToolsConfigSection()}
			<section class="panel-section info-panel">
				<h2>${t('About')}</h2>
				<div class="info-row">
					<span>${t('Version')}</span>
					<strong>${extensionVersion}</strong>
				</div>
				<div id="aboutHelp" class="help-content"></div>
				<span class="help-wrapper">
					<a class="github-link help-anchor" href="https://github.com/Jamir-boop/automationanywhere-improvements.git" target="_blank" rel="noreferrer" aria-label="${t('GitHub repository')}" aria-describedby="${getHelpTipId('github-link')}">
						<svg aria-hidden="true" viewBox="0 0 24 24">
							<path d="M12 .5C5.65.5.75 5.65.75 12.02c0 5.1 3.29 9.42 7.86 10.94.58.1.79-.25.79-.56v-2.14c-3.2.7-3.87-1.37-3.87-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.2 1.77 1.2 1.03 1.76 2.7 1.25 3.36.96.1-.75.4-1.25.73-1.54-2.56-.29-5.25-1.28-5.25-5.7 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.47.11-3.06 0 0 .97-.31 3.17 1.18.92-.26 1.91-.38 2.9-.39.98.01 1.97.13 2.89.39 2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.77.11 3.06.74.81 1.19 1.84 1.19 3.1 0 4.43-2.7 5.41-5.27 5.7.42.36.78 1.06.78 2.14v3.18c0 .31.21.67.8.56A11.54 11.54 0 0 0 23.25 12C23.25 5.65 18.35.5 12 .5Z"></path>
						</svg>
					</a>
					${renderHelpTip('github-link', t('Open project repository.'))}
				</span>
			</section>
		</section>
	</main>

`;

initializeHelpTooltips();

const stylesInput = document.querySelector<HTMLInputElement>('#stylesEnabled')!;
const soundsInput = document.querySelector<HTMLInputElement>('#soundsEnabled')!;
const showSuggestionsInput =
	document.querySelector<HTMLInputElement>('#showSuggestions')!;
const commandPaletteEnabledInput = document.querySelector<HTMLInputElement>(
	'#commandPaletteEnabled'
)!;
const blockTaskbotNodeLabelClicksInput = document.querySelector<HTMLInputElement>(
	'#blockTaskbotNodeLabelClicks'
)!;
const forceEnglishLocaleInput =
	document.querySelector<HTMLInputElement>('#forceEnglishLocale')!;
const extensionLanguageSelect =
	document.querySelector<HTMLSelectElement>('#extensionLanguage')!;
const debugInput = document.querySelector<HTMLInputElement>('#debugEnabled')!;
const shortcutSelect = document.querySelector<HTMLSelectElement>(
	'#commandPaletteShortcut'
)!;
const openSidebarShortcutSelect = document.querySelector<HTMLSelectElement>(
	'#openSidebarShortcut'
)!;
const botExecutionModalPositionSelect = document.querySelector<HTMLSelectElement>(
	'#botExecutionModalPosition'
)!;
const botExecutionModalPositionRow =
	botExecutionModalPositionSelect.closest<HTMLElement>('.bot-modal-position-dependent')!;
const shortcutLabel = document.querySelector<HTMLElement>('#shortcutLabel')!;
const openSidebarShortcutLabel = document.querySelector<HTMLElement>(
	'#openSidebarShortcutLabel'
)!;
const status = document.querySelector<HTMLElement>('#status')!;
const actionJson = document.querySelector<HTMLTextAreaElement>('#actionJson')!;
const actionPackageList = document.querySelector<HTMLElement>('#actionPackageList')!;
const clearJsonButton = document.querySelector<HTMLButtonElement>('#clearJson')!;
const debugLogSection = document.querySelector<HTMLElement>('#debugLogSection')!;
const feedbackList = document.querySelector<HTMLElement>('#feedbackList')!;
const toggleDebugLogButton =
	document.querySelector<HTMLButtonElement>('#toggleDebugLog')!;
const copyFeedbackButton =
	document.querySelector<HTMLButtonElement>('#copyFeedback')!;
const clearFeedbackButton =
	document.querySelector<HTMLButtonElement>('#clearFeedback')!;
const restoreUserstyleDefaultsButton = document.querySelector<HTMLButtonElement>(
	'#restoreUserstyleDefaults'
)!;
const resetGradientColorsButton = document.querySelector<HTMLButtonElement>(
	'#resetGradientColors'
)!;
const backgroundUpload = document.querySelector<HTMLInputElement>('#backgroundUpload')!;
const clearBackgroundUploadButton = document.querySelector<HTMLButtonElement>(
	'#clearBackgroundUpload'
)!;
const backgroundPreview =
	document.querySelector<HTMLElement>('#backgroundPreview')!;
const aboutHelp = document.querySelector<HTMLElement>('#aboutHelp')!;
let currentDebugEnabled = DEFAULT_DEBUG_ENABLED;
let debugLogCollapsed = true;
let currentExtensionShortcuts: ExtensionShortcuts = {
	openSidebar: getOpenSidebarShortcutLabel(currentOpenSidebarShortcut),
	commandPalette: getCommandPaletteShortcutLabel(currentShortcut),
};
let lastSidepanelRequestNonce: string | null = null;

function setStatus(
	message: string,
	severity: FeedbackSeverity = 'info',
	source = 'sidepanel'
): void {
	status.textContent = message;
	if (!message) return;
	status.dataset.severity = severity;
	void addFeedback(severity, source, message);
	setTimeout(() => {
		if (status.textContent === message) status.textContent = '';
	}, 3000);
}

function updateDebugLogState(): void {
	debugLogSection.classList.toggle('is-collapsed', debugLogCollapsed);
	feedbackList.dataset.collapsed = String(debugLogCollapsed);
	toggleDebugLogButton.setAttribute(
		'aria-label',
		debugLogCollapsed ? t('Expand debug log') : t('Collapse debug log')
	);
	toggleDebugLogButton.setAttribute('aria-expanded', String(!debugLogCollapsed));
}

function renderFeedbackHistory(events: DebugEvent[] = []): void {
	updateDebugLogState();
	feedbackList.textContent = '';
	if (!events.length) {
		const empty = document.createElement('p');
		empty.className = 'feedback-empty';
		empty.textContent = t('No debug log.');
		feedbackList.appendChild(empty);
		return;
	}

	const visibleEvents = debugLogCollapsed ? events.slice(0, 1) : events;
	for (const event of visibleEvents) {
		const row = document.createElement('div');
		row.className = `feedback-line feedback-${event.level}`;

		const meta = document.createElement('small');
		meta.textContent = `${new Date(event.timestamp).toLocaleTimeString()} - ${event.level.toUpperCase()} - ${event.source}${
			event.details ? ` - ${t('DETAILS IN COPY')}` : ''
		}`;

		const message = document.createElement('span');
		message.textContent = event.message;

		row.appendChild(meta);
		row.appendChild(message);

		feedbackList.appendChild(row);
	}
}

async function refreshFeedbackHistory(): Promise<void> {
	renderFeedbackHistory(await getFeedbackHistory());
}

function formatFeedbackForAi(events: DebugEvent[]): string {
	if (!events.length) {
		return `${t('# Better AA Developer Experience Debug Log')}\n\n${t('Stored entries: {count}', { count: 0 })}\n\n${t('No debug log.')}`;
	}

	return [
		t('# Better AA Developer Experience Debug Log'),
		'',
		t('Stored entries: {count}', { count: events.length }),
		'',
		...events.flatMap((event, index) => {
			const lines = [
				`## ${t('Entry {count}', { count: index + 1 })}`,
				t('Timestamp: {value}', { value: event.timestamp }),
				t('Level: {value}', { value: event.level }),
				t('Source: {value}', { value: event.source }),
				t('Message: {value}', { value: event.message }),
			];

			if (event.details) {
				lines.push(t('Details JSON:'));
				lines.push(JSON.stringify(event.details, null, 2));
			}

			lines.push('');
			return lines;
		}),
	].join('\n').trimEnd();
}

function setActiveTab(tab: SidepanelTab): void {
	document.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((button) => {
		const active = button.dataset.tab === tab;
		button.classList.toggle('is-active', active);
		button.setAttribute('aria-selected', String(active));
	});
	document.querySelectorAll<HTMLElement>('[data-panel]').forEach((panel) => {
		const active = panel.dataset.panel === tab;
		panel.classList.toggle('is-active', active);
		panel.hidden = !active;
	});
}

async function sendBackgroundMessage(message: BackgroundMessage): Promise<void> {
	await browser.runtime.sendMessage(message);
}

async function sendActiveTabMessage(
	message: ContentActionMessage
): Promise<ContentActionResponse> {
	const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
	if (!tab?.id) return { ok: false, error: t('No active tab.') };

	try {
		const response = (await browser.tabs.sendMessage(
			tab.id,
			message
		)) as ContentActionResponse | undefined;
		return response ?? { ok: true };
	} catch {
		return { ok: false, error: t('Open an Automation Anywhere tab first.') };
	}
}

function updateShortcutLabel(shortcut: CommandPaletteShortcut): void {
	const label = getCommandPaletteShortcutLabel(shortcut);
	shortcutLabel.textContent = t('Current: {shortcut}', { shortcut: label });
	currentExtensionShortcuts.commandPalette = label;
}

function updateOpenSidebarShortcutLabel(shortcut: OpenSidebarShortcut): void {
	const label = getOpenSidebarShortcutLabel(shortcut);
	openSidebarShortcutLabel.textContent = t('Current: {shortcut}', { shortcut: label });
	currentExtensionShortcuts.openSidebar = label;
}

async function refreshExtensionShortcuts(): Promise<void> {
	try {
		const response = (await browser.runtime.sendMessage({
			type: 'GET_EXTENSION_SHORTCUTS',
		})) as ExtensionShortcuts | undefined;
		currentExtensionShortcuts = {
			openSidebar:
				response?.openSidebar ||
				getOpenSidebarShortcutLabel(currentOpenSidebarShortcut),
			commandPalette:
				response?.commandPalette || getCommandPaletteShortcutLabel(currentShortcut),
		};
	} catch {
		currentExtensionShortcuts = {
			openSidebar: getOpenSidebarShortcutLabel(currentOpenSidebarShortcut),
			commandPalette: getCommandPaletteShortcutLabel(currentShortcut),
		};
	}
}

function renderStaticAboutHelp(shortcut: CommandPaletteShortcut): void {
	aboutHelp.innerHTML = renderHelpHtml({
		commands: Object.values(getCommandHelp()),
		shortcutLabel: getCommandPaletteShortcutLabel(shortcut),
		sidebarShortcutLabel: currentExtensionShortcuts.openSidebar,
	});
}

async function refreshAboutHelp(): Promise<void> {
	const response = await sendActiveTabMessage({ type: 'GET_HELP_HTML' });
	if (response.ok && response.html) {
		aboutHelp.innerHTML = response.html;
		return;
	}
	renderStaticAboutHelp(currentShortcut);
}

function focusActionJsonTextarea(): void {
	document.querySelector<HTMLButtonElement>('[data-tool-action="universal-clipboard"]')?.click();
	requestAnimationFrame(() => {
		actionJson.scrollIntoView({ block: 'center' });
		actionJson.focus();
	});
}

async function handleSidepanelRequest(
	request: SidepanelRequest | null | undefined
): Promise<void> {
	if (!request || request.nonce === lastSidepanelRequestNonce) return;
	lastSidepanelRequestNonce = request.nonce;

	setActiveTab(request.tab);
	if (request.tab === 'settings') void refreshAboutHelp();
	if (request.focus === 'actionJson') focusActionJsonTextarea();

	await sidepanelRequest.setValue(null);
}

function prettyJson(json: string): string {
	try {
		return JSON.stringify(JSON.parse(json), null, 2);
	} catch {
		return json;
	}
}

function updateClearJsonButton(): void {
	clearJsonButton.hidden = !actionJson.value.trim();
}

function updateActionJsonState(): void {
	updateClearJsonButton();
	const input = actionJson.value.trim();
	if (!input) {
		clearAutomationAnywhereJsonDetails(actionPackageList);
		return;
	}

	try {
		const parsed = JSON.parse(input);
		renderAutomationAnywhereJsonDetails(actionPackageList, parsed);
	} catch {
		clearAutomationAnywhereJsonDetails(actionPackageList);
	}
}

function setActionJsonValue(json: string): void {
	actionJson.value = json;
	updateActionJsonState();
}

function getSlotStateText(json: string | null | undefined): string {
	if (!json?.trim()) return t('Empty');
	try {
		const parsed = JSON.parse(json);
		if (isAutomationAnywhereJson(parsed)) {
			const summary = summarizeAutomationAnywhereJson(parsed);
			const noun = summary.actionCount === 1 ? t('action') : t('actions');
			const packageNames = [
				...new Set(
					summary.packages
						.map((pkg) => pkg.name.trim())
						.filter(Boolean)
				),
			].slice(0, 3);
			const prefix = packageNames.length ? packageNames.join(', ') : 'AA';
			return `${prefix} - ${summary.actionCount} ${noun}`;
		}
		return 'JSON';
	} catch {
		return t('Invalid JSON');
	}
}

function updateSlotState(slot: number, json: string | null | undefined): void {
	const row = document.querySelector<HTMLElement>(`[data-slot-row="${slot}"]`);
	const state = document.querySelector<HTMLElement>(`[data-slot-state="${slot}"]`);
	if (!row || !state) return;

	const stateText = getSlotStateText(json);
	state.textContent = stateText;
	const isEmpty = !json?.trim();
	const isInvalid = stateText === t('Invalid JSON');
	row.classList.toggle('is-empty', isEmpty);
	row.classList.toggle('is-populated', !isEmpty);
	row.classList.toggle('is-invalid', isInvalid);
}

async function refreshSlotState(slot: number): Promise<void> {
	updateSlotState(slot, await universalClipboardSlot(slot).getValue());
}

async function refreshSlotStates(): Promise<void> {
	await Promise.all(UNIVERSAL_CLIPBOARD_SLOTS.map(refreshSlotState));
}

async function loadSlotIntoActionJson(slot: number): Promise<void> {
	const json = await universalClipboardSlot(slot).getValue();
	const label = getClipboardSlotLabel(slot);
	if (!json?.trim()) {
		setActionJsonValue('');
		setStatus(t('{label} is empty.', { label }), 'warn', 'clipboard');
		return;
	}
	setActionJsonValue(prettyJson(json));
	setStatus(t('{label} JSON loaded.', { label }), 'info', 'clipboard');
}

function getStyleFeatureInput(key: StyleFeatureKey): HTMLInputElement {
	return document.querySelector<HTMLInputElement>(`#styleFeature-${key}`)!;
}

function getStyleValueInput(
	key: StyleValueKey
): HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement {
	return document.querySelector(`#styleValue-${key}`)!;
}

function getStyleOpacityInput(key: StyleValueKey): HTMLInputElement {
	return document.querySelector<HTMLInputElement>(`#styleOpacity-${key}`)!;
}

function getStyleOpacityOutput(key: StyleValueKey): HTMLOutputElement {
	return document.querySelector<HTMLOutputElement>(`#styleOpacityValue-${key}`)!;
}

function isColorField(key: StyleValueKey): boolean {
	return STYLE_VALUE_FIELDS.some((field) => field.key === key && field.type === 'color');
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

function toHex(value: number): string {
	return clamp(Math.round(value), 0, 255).toString(16).padStart(2, '0');
}

function parseColorValue(value: string): { hex: string; alpha: number } {
	const normalized = value.trim();
	const hexMatch = normalized.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
	if (hexMatch) {
		const hex = hexMatch[1];
		const expanded =
			hex.length === 3
				? hex
						.split('')
						.map((char) => `${char}${char}`)
						.join('')
				: hex;
		return { hex: `#${expanded.toLowerCase()}`, alpha: 1 };
	}

	const rgbaMatch = normalized.match(
		/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*([0-9.]+))?\s*\)$/i
	);
	if (rgbaMatch) {
		const red = Number(rgbaMatch[1]);
		const green = Number(rgbaMatch[2]);
		const blue = Number(rgbaMatch[3]);
		const alpha = rgbaMatch[4] === undefined ? 1 : Number(rgbaMatch[4]);
		return {
			hex: `#${toHex(red)}${toHex(green)}${toHex(blue)}`,
			alpha: clamp(Number.isFinite(alpha) ? alpha : 1, 0, 1),
		};
	}

	return { hex: '#a0a0a0', alpha: 1 };
}

function hexToRgb(hex: string): { red: number; green: number; blue: number } {
	const normalized = hex.replace('#', '');
	return {
		red: Number.parseInt(normalized.slice(0, 2), 16),
		green: Number.parseInt(normalized.slice(2, 4), 16),
		blue: Number.parseInt(normalized.slice(4, 6), 16),
	};
}

function formatAlpha(alpha: number): string {
	return String(Math.round(clamp(alpha, 0, 1) * 100) / 100);
}

function colorControlsToRgba(key: StyleValueKey): string {
	const colorInput = getStyleValueInput(key) as HTMLInputElement;
	const opacityInput = getStyleOpacityInput(key);
	const { red, green, blue } = hexToRgb(colorInput.value);
	const alpha = Number(opacityInput.value);
	return `rgba(${red}, ${green}, ${blue}, ${formatAlpha(alpha)})`;
}

function setColorControls(key: StyleValueKey, value: string): void {
	const parsed = parseColorValue(value);
	const colorInput = getStyleValueInput(key) as HTMLInputElement;
	const opacityInput = getStyleOpacityInput(key);
	const opacityOutput = getStyleOpacityOutput(key);
	colorInput.value = parsed.hex;
	opacityInput.value = formatAlpha(parsed.alpha);
	opacityOutput.value = `${Math.round(parsed.alpha * 100)}%`;
}

function getEffectiveBackgroundCss(value: string): string {
	return value.trim() || defaultLoadingImageCss;
}

function updateBackgroundPreview(): void {
	const userBg = getStyleValueInput('userBg').value;
	const backgroundSize = getStyleValueInput('userBgSize').value || 'contain';
	backgroundPreview.style.backgroundImage = getEffectiveBackgroundCss(userBg);
	backgroundPreview.style.backgroundSize = backgroundSize;
}

function setStyleValueControl(key: StyleValueKey, value: string): void {
	if (isColorField(key)) {
		setColorControls(key, value);
	} else {
		getStyleValueInput(key).value = value;
	}
	if (key === 'userBg' || key === 'userBgSize') updateBackgroundPreview();
}

function getStyleValueControlValue(key: StyleValueKey): string {
	return isColorField(key) ? colorControlsToRgba(key) : getStyleValueInput(key).value;
}

function normalizeStyleValueForComparison(key: StyleValueKey, value: string): string {
	if (!isColorField(key)) return value;
	const parsed = parseColorValue(value);
	const { red, green, blue } = hexToRgb(parsed.hex);
	return `rgba(${red}, ${green}, ${blue}, ${formatAlpha(parsed.alpha)})`;
}

function isUserstyleAtDefault(): boolean {
	if (stylesInput.checked !== DEFAULT_STYLES_ENABLED) return false;
	if (botExecutionModalPositionSelect.value !== DEFAULT_BOT_EXECUTION_MODAL_POSITION) {
		return false;
	}
	for (const feature of STYLE_FEATURES) {
		if (getStyleFeatureInput(feature.key).checked !== feature.defaultValue) {
			return false;
		}
	}
	for (const field of STYLE_VALUE_FIELDS) {
		if (
			normalizeStyleValueForComparison(field.key, getStyleValueControlValue(field.key)) !==
			normalizeStyleValueForComparison(field.key, field.defaultValue)
		) {
			return false;
		}
	}
	return true;
}

function updateRestoreDefaultsButton(): void {
	const atDefault = isUserstyleAtDefault();
	restoreUserstyleDefaultsButton.hidden = atDefault;
	restoreUserstyleDefaultsButton.disabled = atDefault;
	resetGradientColorsButton.disabled = areGradientColorsAtDefault();
}

function areGradientColorsAtDefault(): boolean {
	return BACKGROUND_COLOR_KEYS.every((key) => {
		const field = STYLE_VALUE_FIELDS.find((item) => item.key === key);
		return (
			field &&
			normalizeStyleValueForComparison(key, getStyleValueControlValue(key)) ===
				normalizeStyleValueForComparison(key, field.defaultValue)
		);
	});
}

function updateUserstyleDependentState(): void {
	const disabled = !stylesInput.checked;
	document.querySelectorAll<HTMLElement>('.userstyle-dependent').forEach((row) => {
		row.classList.toggle('is-disabled', disabled);
		row.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | HTMLButtonElement>(
			'input, select, textarea, button'
		).forEach((control) => {
			control.disabled = disabled;
		});
	});
	updateBotExecutionModalPositionState();
	updateRestoreDefaultsButton();
}

function updateBotExecutionModalPositionState(): void {
	const disabled =
		!stylesInput.checked || !getStyleFeatureInput('minimizeBotModal').checked;
	botExecutionModalPositionRow.classList.toggle('is-disabled', disabled);
	botExecutionModalPositionSelect.disabled = disabled;
}

function validateBackgroundFile(file: File): string | null {
	const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
	if (
		!ALLOWED_BACKGROUND_MIME_TYPES.has(file.type) &&
		!ALLOWED_BACKGROUND_EXTENSIONS.has(extension)
	) {
		return t('Unsupported loading animation image. Use png, jpg, jpeg, webp, or gif.');
	}
	if (file.size > MAX_BACKGROUND_UPLOAD_BYTES) {
		return t('Loading animation image is too large. Maximum size is 3 MiB.');
	}
	return null;
}

function readFileAsDataUrl(file: File): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.addEventListener('load', () => {
			if (typeof reader.result === 'string') {
				resolve(reader.result);
				return;
			}
			reject(new Error(t('File could not be read as a data URL.')));
		});
		reader.addEventListener('error', () => {
			reject(new Error(t('Loading animation image read failed.')));
		});
		reader.readAsDataURL(file);
	});
}

async function setStyleValueAndNotify(
	key: StyleValueKey,
	value: string
): Promise<void> {
	setStyleValueControl(key, value);
	updateRestoreDefaultsButton();
	await sendBackgroundMessage({
		type: 'SET_STYLE_VALUE',
		key,
		value,
	});
}

async function loadState(): Promise<void> {
	const [
		styles,
		sounds,
		suggestions,
		paletteEnabled,
		blockTaskbotClicks,
		forceEnglish,
		language,
		debug,
		shortcut,
		sidebarShortcut,
		botModalPosition,
		styleFeatures,
		styleValues,
	] = await Promise.all([
		getStylesEnabled(),
		getSoundsEnabled(),
		getShowSuggestions(),
		getCommandPaletteEnabled(),
		getBlockTaskbotNodeLabelClicks(),
		getForceEnglishLocale(),
		getExtensionLanguage(),
		getDebugEnabled(),
		getCommandPaletteShortcut(),
		getOpenSidebarShortcut(),
		getBotExecutionModalPosition(),
		getStyleFeatureValues(),
		getStyleValues(),
	]);

	const cachedLanguage = getCachedExtensionLanguage();
	cacheExtensionLanguage(language);
	if (language !== cachedLanguage) {
		setActiveLanguagePreference(language);
		window.location.reload();
		return;
	}

	stylesInput.checked = styles;
	soundsInput.checked = sounds;
	showSuggestionsInput.checked = suggestions;
	commandPaletteEnabledInput.checked = paletteEnabled;
	blockTaskbotNodeLabelClicksInput.checked = blockTaskbotClicks;
	forceEnglishLocaleInput.checked = forceEnglish;
	extensionLanguageSelect.value = language;
	debugInput.checked = debug;
	currentDebugEnabled = debug;
	shortcutSelect.value = shortcut;
	currentShortcut = shortcut;
	updateShortcutLabel(shortcut);
	openSidebarShortcutSelect.value = sidebarShortcut;
	currentOpenSidebarShortcut = sidebarShortcut;
	updateOpenSidebarShortcutLabel(sidebarShortcut);
	botExecutionModalPositionSelect.value = botModalPosition;
	await refreshExtensionShortcuts();
	renderStaticAboutHelp(shortcut);

	STYLE_FEATURES.forEach((feature) => {
		getStyleFeatureInput(feature.key).checked = styleFeatures[feature.key];
	});

	STYLE_VALUE_FIELDS.forEach((field) => {
		setStyleValueControl(field.key, styleValues[field.key]);
	});
	updateUserstyleDependentState();
	await refreshSlotStates();
	await refreshFeedbackHistory();
	void debugInfo('sidepanel', 'Sidebar state loaded.', {
		styles,
		sounds,
		suggestions,
		paletteEnabled,
		blockTaskbotClicks,
		forceEnglish,
		debug,
	});
}

document.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((button) => {
	button.addEventListener('click', () => {
		setActiveTab(button.dataset.tab as SidepanelTab);
		if (button.dataset.tab === 'settings') void refreshAboutHelp();
	});
});

stylesInput.addEventListener('change', () => {
	updateUserstyleDependentState();
	void sendBackgroundMessage({
		type: 'TOGGLE_STYLES',
		enabled: stylesInput.checked,
	});
});

soundsInput.addEventListener('change', () => {
	void sendBackgroundMessage({
		type: 'SET_SOUNDS_ENABLED',
		enabled: soundsInput.checked,
	});
});

showSuggestionsInput.addEventListener('change', () => {
	void sendBackgroundMessage({
		type: 'SET_SHOW_SUGGESTIONS',
		enabled: showSuggestionsInput.checked,
	});
	setStatus(
		showSuggestionsInput.checked
			? t('Suggestions enabled.')
			: t('Suggestions disabled.'),
		'info',
		'suggestions'
	);
});

commandPaletteEnabledInput.addEventListener('change', () => {
	void sendBackgroundMessage({
		type: 'SET_COMMAND_PALETTE_ENABLED',
		enabled: commandPaletteEnabledInput.checked,
	});
	setStatus(
		commandPaletteEnabledInput.checked
			? t('Command palette enabled.')
			: t('Command palette disabled.'),
		'info',
		'settings'
	);
});

blockTaskbotNodeLabelClicksInput.addEventListener('change', () => {
	void sendBackgroundMessage({
		type: 'SET_BLOCK_TASKBOT_NODE_LABEL_CLICKS',
		enabled: blockTaskbotNodeLabelClicksInput.checked,
	});
	setStatus(
		blockTaskbotNodeLabelClicksInput.checked
			? t('Taskbot link click blocking enabled.')
			: t('Taskbot link click blocking disabled.'),
		'info',
		'settings'
	);
});

forceEnglishLocaleInput.addEventListener('change', () => {
	void sendBackgroundMessage({
		type: 'SET_FORCE_ENGLISH_LOCALE',
		enabled: forceEnglishLocaleInput.checked,
	});
	setStatus(
		forceEnglishLocaleInput.checked
			? t('English locale enforcement enabled.')
			: t('English locale enforcement disabled.'),
		'info',
		'settings'
	);
});

extensionLanguageSelect.addEventListener('change', () => {
	const language = normalizeExtensionLanguage(
		extensionLanguageSelect.value
	) as LanguagePreference;
	extensionLanguageSelect.value = language;
	setActiveLanguagePreference(language);
	cacheExtensionLanguage(language);
	void sendBackgroundMessage({
		type: 'SET_EXTENSION_LANGUAGE',
		language,
	}).then(() => {
		setStatus(t('Extension language saved.'), 'info', 'settings');
		setTimeout(() => window.location.reload(), 250);
	});
});

debugInput.addEventListener('change', () => {
	currentDebugEnabled = debugInput.checked;
	void sendBackgroundMessage({
		type: 'SET_DEBUG_ENABLED',
		enabled: debugInput.checked,
	});
	void refreshFeedbackHistory();
	setStatus(
		debugInput.checked ? t('Debug mode enabled.') : t('Debug mode disabled.'),
		'info',
		'debug'
	);
});

shortcutSelect.addEventListener('change', () => {
	const shortcut = shortcutSelect.value as CommandPaletteShortcut;
	currentShortcut = shortcut;
	updateShortcutLabel(shortcut);
	renderStaticAboutHelp(shortcut);
	void sendBackgroundMessage({
		type: 'SET_COMMAND_PALETTE_SHORTCUT',
		shortcut,
	}).then(() => {
		void refreshExtensionShortcuts();
	});
});

openSidebarShortcutSelect.addEventListener('change', () => {
	const shortcut = normalizeOpenSidebarShortcut(openSidebarShortcutSelect.value);
	currentOpenSidebarShortcut = shortcut;
	openSidebarShortcutSelect.value = shortcut;
	updateOpenSidebarShortcutLabel(shortcut);
	renderStaticAboutHelp(currentShortcut);
	void sendBackgroundMessage({
		type: 'SET_OPEN_SIDEBAR_SHORTCUT',
		shortcut,
	}).then(() => {
		void refreshExtensionShortcuts().then(() => {
			renderStaticAboutHelp(currentShortcut);
		});
	});
	setStatus(t('Sidebar shortcut saved.'), 'info', 'settings');
});

botExecutionModalPositionSelect.addEventListener('change', () => {
	const position = normalizeBotExecutionModalPosition(
		botExecutionModalPositionSelect.value
	) as BotExecutionModalPosition;
	botExecutionModalPositionSelect.value = position;
	updateRestoreDefaultsButton();
	void sendBackgroundMessage({
		type: 'SET_BOT_EXECUTION_MODAL_POSITION',
		position,
	});
});

STYLE_FEATURES.forEach((feature) => {
	getStyleFeatureInput(feature.key).addEventListener('change', (event) => {
		const input = event.currentTarget as HTMLInputElement;
		if (feature.key === 'minimizeBotModal') updateBotExecutionModalPositionState();
		updateRestoreDefaultsButton();
		void sendBackgroundMessage({
			type: 'SET_STYLE_FEATURE',
			key: feature.key,
			enabled: input.checked,
		});
	});
});

STYLE_VALUE_FIELDS.forEach((field) => {
	if (field.type === 'color') {
		const sendColorValue = () => {
			setColorControls(field.key, colorControlsToRgba(field.key));
			void sendBackgroundMessage({
				type: 'SET_STYLE_VALUE',
				key: field.key,
				value: colorControlsToRgba(field.key),
			});
			updateRestoreDefaultsButton();
		};
		getStyleValueInput(field.key).addEventListener('input', sendColorValue);
		getStyleOpacityInput(field.key).addEventListener('input', sendColorValue);
		return;
	}

	getStyleValueInput(field.key).addEventListener('change', (event) => {
		const input = event.currentTarget as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
		void sendBackgroundMessage({
			type: 'SET_STYLE_VALUE',
			key: field.key,
			value: input.value,
		});
		if (field.key === 'userBg' || field.key === 'userBgSize') updateBackgroundPreview();
		updateRestoreDefaultsButton();
	});
});

backgroundUpload.addEventListener('change', async () => {
	const file = backgroundUpload.files?.[0];
	if (!file) return;

	const validationError = validateBackgroundFile(file);
	if (validationError) {
		backgroundUpload.value = '';
		void debugWarn('loadingAnimation', 'Loading animation upload validation failed.', {
			fileName: file.name,
			fileSize: file.size,
			fileType: file.type,
			reason: validationError,
		});
		setStatus(validationError, 'error', 'loadingAnimation');
		return;
	}

	try {
		const dataUrl = await readFileAsDataUrl(file);
		if (!dataUrl.startsWith('data:image/')) {
			void debugWarn('loadingAnimation', 'Loading animation upload did not produce an image data URL.', {
				fileName: file.name,
				fileSize: file.size,
				fileType: file.type,
			}, { feedback: true });
			setStatus(
				t('Loading animation file could not be used as an image.'),
				'error',
				'loadingAnimation'
			);
			return;
		}
		await setStyleValueAndNotify('userBg', `url("${dataUrl}")`);
		void debugInfo('loadingAnimation', 'Loading animation uploaded.', {
			fileName: file.name,
			fileSize: file.size,
			fileType: file.type,
		});
		setStatus(t('Loading animation uploaded.'), 'info', 'loadingAnimation');
	} catch (error) {
		void debugError('loadingAnimation', 'Loading animation upload failed.', {
			error,
			fileName: file.name,
			fileSize: file.size,
			fileType: file.type,
		}, { feedback: true });
		setStatus(
			error instanceof Error ? error.message : t('Loading animation upload failed.'),
			'error',
			'loadingAnimation'
		);
	} finally {
		backgroundUpload.value = '';
	}
});

clearBackgroundUploadButton.addEventListener('click', () => {
	void setStyleValueAndNotify('userBg', '').then(() => {
		setStatus(t('Default loading animation restored.'), 'info', 'loadingAnimation');
	});
});

resetGradientColorsButton.addEventListener('click', async () => {
	const fields = STYLE_VALUE_FIELDS.filter((field) =>
		BACKGROUND_COLOR_KEYS.includes(field.key as (typeof BACKGROUND_COLOR_KEYS)[number])
	);
	fields.forEach((field) => {
		setStyleValueControl(field.key, field.defaultValue);
	});
	updateRestoreDefaultsButton();
	await Promise.all(
		fields.map((field) =>
			sendBackgroundMessage({
				type: 'SET_STYLE_VALUE',
				key: field.key,
				value: field.defaultValue,
			})
		)
	);
	setStatus(t('Gradient colors restored.'), 'info', 'userstyle');
});

restoreUserstyleDefaultsButton.addEventListener('click', async () => {
	stylesInput.checked = DEFAULT_STYLES_ENABLED;
	botExecutionModalPositionSelect.value = DEFAULT_BOT_EXECUTION_MODAL_POSITION;
	STYLE_FEATURES.forEach((feature) => {
		getStyleFeatureInput(feature.key).checked = feature.defaultValue;
	});
	STYLE_VALUE_FIELDS.forEach((field) => {
		setStyleValueControl(field.key, field.defaultValue);
	});
	updateUserstyleDependentState();

	await Promise.all([
		sendBackgroundMessage({
			type: 'TOGGLE_STYLES',
			enabled: DEFAULT_STYLES_ENABLED,
		}),
		sendBackgroundMessage({
			type: 'SET_BOT_EXECUTION_MODAL_POSITION',
			position: DEFAULT_BOT_EXECUTION_MODAL_POSITION,
		}),
		...STYLE_FEATURES.map((feature) =>
			sendBackgroundMessage({
				type: 'SET_STYLE_FEATURE',
				key: feature.key,
				enabled: feature.defaultValue,
			})
		),
		...STYLE_VALUE_FIELDS.map((field) =>
			sendBackgroundMessage({
				type: 'SET_STYLE_VALUE',
				key: field.key,
				value: field.defaultValue,
			})
		),
	]);
	void debugInfo('userstyle', 'Visual improvements restored.', {
		stylesEnabled: DEFAULT_STYLES_ENABLED,
	});
	setStatus(t('Visual improvements restored.'), 'info', 'userstyle');
});

async function copyClipboardSlot(slot: number): Promise<void> {
	const response =
		slot === DEFAULT_UNIVERSAL_CLIPBOARD_SLOT
			? await sendActiveTabMessage({ type: 'UNIVERSAL_COPY' })
			: await sendActiveTabMessage({ type: 'COPY_TO_SLOT', slot });
	if (!response.ok) {
		setStatus(response.error, 'error', 'clipboard');
		await refreshSlotState(slot);
		return;
	}
	if (response.json) setActionJsonValue(prettyJson(response.json));
	await refreshSlotState(slot);
	setStatus(
		response.message ?? t('{label} copied.', { label: getClipboardSlotLabel(slot) }),
		'info',
		'clipboard'
	);
}

async function pasteClipboardSlot(slot: number): Promise<void> {
	const response =
		slot === DEFAULT_UNIVERSAL_CLIPBOARD_SLOT
			? await sendActiveTabMessage({ type: 'UNIVERSAL_PASTE' })
			: await sendActiveTabMessage({ type: 'PASTE_FROM_SLOT', slot });
	if (response.ok && response.json) {
		setActionJsonValue(prettyJson(response.json));
	}
	await refreshSlotState(slot);
	setStatus(
		response.ok ? response.message ?? t('Paste queued.') : response.error,
		response.ok ? 'info' : 'error',
		'clipboard'
	);
}

document.querySelectorAll<HTMLButtonElement>('[data-copy-slot]').forEach((button) => {
	button.addEventListener('click', async () => {
		await copyClipboardSlot(Number(button.dataset.copySlot));
	});
});

document.querySelectorAll<HTMLButtonElement>('[data-paste-slot]').forEach((button) => {
	button.addEventListener('click', async () => {
		await pasteClipboardSlot(Number(button.dataset.pasteSlot));
	});
});

document.querySelectorAll<HTMLElement>('[data-slot-row]').forEach((row) => {
	row.addEventListener('click', (event) => {
		if ((event.target as HTMLElement | null)?.closest('button')) return;
		void loadSlotIntoActionJson(Number(row.dataset.slotRow));
	});
	row.addEventListener('keydown', (event) => {
		if (event.key !== 'Enter' && event.key !== ' ') return;
		if ((event.target as HTMLElement | null)?.closest('button')) return;
		event.preventDefault();
		void loadSlotIntoActionJson(Number(row.dataset.slotRow));
	});
});

clearFeedbackButton.addEventListener('click', () => {
	void clearFeedback().then(() => {
		status.textContent = t('Debug log cleared.');
		status.dataset.severity = 'info';
		setTimeout(() => {
			if (status.textContent === t('Debug log cleared.')) status.textContent = '';
		}, 3000);
	});
});

toggleDebugLogButton.addEventListener('click', () => {
	debugLogCollapsed = !debugLogCollapsed;
	void refreshFeedbackHistory();
});

copyFeedbackButton.addEventListener('click', () => {
	void getFeedbackHistory()
		.then((events) => navigator.clipboard.writeText(formatFeedbackForAi(events)))
		.then(() => {
			setStatus(t('Debug log copied for AI.'), 'info', 'debug');
		})
		.catch(() => {
			setStatus(t('Debug log copy failed.'), 'error', 'debug');
		});
});

document.querySelector<HTMLButtonElement>('#importJson')!.addEventListener('click', async () => {
	const json = actionJson.value.trim();
	if (!json) {
		setStatus(t('JSON textarea is empty.'), 'warn', 'json');
		return;
	}
	try {
		JSON.parse(json);
	} catch (error) {
		void debugWarn('json', 'Action JSON parse failed.', { error }, { feedback: true });
		setStatus(t('Invalid JSON.'), 'error', 'json');
		return;
	}
	const response = await sendActiveTabMessage({ type: 'IMPORT_ACTION_JSON', json });
	if (response.ok) {
		await refreshSlotState(DEFAULT_UNIVERSAL_CLIPBOARD_SLOT);
	}
	setStatus(
		response.ok ? response.message ?? t('Import queued.') : response.error,
		response.ok ? 'info' : 'error',
		'json'
	);
});

document.querySelector<HTMLButtonElement>('#copyJsonText')!.addEventListener('click', async () => {
	if (!actionJson.value.trim()) {
		setStatus(t('JSON textarea is empty.'), 'warn', 'json');
		return;
	}
	try {
		await navigator.clipboard.writeText(actionJson.value);
		setStatus(t('JSON copied to clipboard.'), 'info', 'json');
	} catch {
		setStatus(t('Clipboard write failed.'), 'error', 'json');
	}
});

document.querySelector<HTMLButtonElement>('#exportJsonText')!.addEventListener('click', () => {
	const json = actionJson.value.trim();
	if (!json) {
		setStatus(t('JSON textarea is empty.'), 'warn', 'json');
		return;
	}
	try {
		downloadJsonTextFile(getJsonDownloadText(json), 'action-json.json');
		setStatus(t('JSON exported.'), 'info', 'json');
	} catch (error) {
		void debugWarn('json', 'Action JSON export parse failed.', { error }, { feedback: true });
		setStatus(t('Invalid JSON.'), 'error', 'json');
	}
});

actionJson.addEventListener('input', updateActionJsonState);

clearJsonButton.addEventListener('click', () => {
	setActionJsonValue('');
	setStatus(t('JSON cleared.'), 'info', 'json');
});

stylesEnabled.watch((value) => {
	stylesInput.checked = value ?? DEFAULT_STYLES_ENABLED;
	updateUserstyleDependentState();
});
soundsEnabled.watch((value) => {
	soundsInput.checked = value ?? DEFAULT_SOUNDS_ENABLED;
});
showSuggestions.watch((value) => {
	showSuggestionsInput.checked = value ?? DEFAULT_SHOW_SUGGESTIONS;
});
commandPaletteEnabled.watch((value) => {
	commandPaletteEnabledInput.checked = value ?? DEFAULT_COMMAND_PALETTE_ENABLED;
});
blockTaskbotNodeLabelClicks.watch((value) => {
	blockTaskbotNodeLabelClicksInput.checked =
		value ?? DEFAULT_BLOCK_TASKBOT_NODE_LABEL_CLICKS;
});
forceEnglishLocale.watch((value) => {
	forceEnglishLocaleInput.checked = value ?? DEFAULT_FORCE_ENGLISH_LOCALE;
});
extensionLanguage.watch((value) => {
	const language = normalizeExtensionLanguage(value);
	extensionLanguageSelect.value = language;
	cacheExtensionLanguage(language);
});
debugEnabled.watch((value) => {
	currentDebugEnabled = value ?? DEFAULT_DEBUG_ENABLED;
	debugInput.checked = currentDebugEnabled;
	void refreshFeedbackHistory();
});
commandPaletteShortcut.watch((value) => {
	if (!value) return;
	currentShortcut = value;
	shortcutSelect.value = value;
	updateShortcutLabel(value);
	void refreshExtensionShortcuts();
	renderStaticAboutHelp(value);
});
openSidebarShortcut.watch((value) => {
	const shortcut = normalizeOpenSidebarShortcut(value);
	currentOpenSidebarShortcut = shortcut;
	openSidebarShortcutSelect.value = shortcut;
	updateOpenSidebarShortcutLabel(shortcut);
	void refreshExtensionShortcuts().then(() => {
		renderStaticAboutHelp(currentShortcut);
	});
});
botExecutionModalPosition.watch((value) => {
	botExecutionModalPositionSelect.value = normalizeBotExecutionModalPosition(value);
	updateRestoreDefaultsButton();
});
STYLE_FEATURES.forEach((feature) => {
	styleFeatureItems[feature.key].watch((value) => {
		getStyleFeatureInput(feature.key).checked = value ?? feature.defaultValue;
		if (feature.key === 'minimizeBotModal') updateBotExecutionModalPositionState();
		updateRestoreDefaultsButton();
	});
});
STYLE_VALUE_FIELDS.forEach((field) => {
	styleValueItems[field.key].watch((value) => {
		setStyleValueControl(field.key, value ?? field.defaultValue);
		updateRestoreDefaultsButton();
	});
});

UNIVERSAL_CLIPBOARD_SLOTS.forEach((slot) => {
	universalClipboardSlot(slot).watch((value) => {
		updateSlotState(slot, value);
	});
});

feedbackHistory.watch((value) => {
	renderFeedbackHistory(value ?? []);
});

sidepanelRequest.watch((value) => {
	void handleSidepanelRequest(value);
});

initializeToolsPanel({ setStatus, addFeedback, prettyJson });
void loadState();
updateActionJsonState();
void sidepanelRequest.getValue().then(handleSidepanelRequest);
