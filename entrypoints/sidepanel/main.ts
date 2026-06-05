import './style.styl';
import { initializeToolsPanel, renderToolsPanel } from './tools';
import { COMMAND_HELP, renderHelpHtml } from '@/src/ts/help';
import type {
	BackgroundMessage,
	ContentActionMessage,
	ContentActionResponse,
	ExtensionShortcuts,
} from '@/src/ts/messages';
import {
	isAutomationAnywhereJson,
	summarizeAutomationAnywhereJson,
	type AutomationAnywhereJsonSummary,
} from '@/src/ts/automation-anywhere-json';
import {
	COMMAND_PALETTE_SHORTCUTS,
	DEFAULT_DEBUG_ENABLED,
	DEFAULT_SOUNDS_ENABLED,
	DEFAULT_SHOW_SUGGESTIONS,
	DEFAULT_STYLES_ENABLED,
	EXTENSION_VERSION,
	STYLE_FEATURES,
	STYLE_VALUE_FIELDS,
	commandPaletteShortcut,
	debugEnabled,
	getCommandPaletteShortcut,
	getCommandPaletteShortcutLabel,
	getDebugEnabled,
	getShowSuggestions,
	getSoundsEnabled,
	getStyleFeatureValues,
	getStyleValues,
	getStylesEnabled,
	showSuggestions,
	soundsEnabled,
	styleFeatureItems,
	styleValueItems,
	stylesEnabled,
	type CommandPaletteShortcut,
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
const BACKGROUND_COLOR_KEYS = [
	'backgroundColor1',
	'backgroundColor2',
	'backgroundColor3',
] as const satisfies readonly StyleValueKey[];
const STYLE_FEATURE_GROUPS = [
	{
		title: 'Taskbot Editor',
		keys: ['customPaletteButtons', 'runButton', 'editorTabsButtons'],
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

function getClipboardSlotLabel(slot: number): string {
	return slot === DEFAULT_UNIVERSAL_CLIPBOARD_SLOT ? 'Default' : `Slot ${slot}`;
}

function renderClipboardSlotRow(slot: number): string {
	const label = getClipboardSlotLabel(slot);
	return `
		<div class="slot-row is-empty" data-slot-row="${slot}" role="button" tabindex="0" aria-label="Load ${label}">
			<span class="slot-label">${label}</span>
			<span class="slot-state" data-slot-state="${slot}">Empty</span>
			<button type="button" data-copy-slot="${slot}">Copy</button>
			<button type="button" data-paste-slot="${slot}">Paste</button>
		</div>
	`;
}

function renderToolsConfigSection(): string {
	return `
		<section class="panel-section">
			<h2>Userscript Config</h2>
			<label class="select-row">
				<span>
					<strong>Command palette</strong>
					<small id="shortcutLabel"></small>
				</span>
				<select id="commandPaletteShortcut">
					<option value="${COMMAND_PALETTE_SHORTCUTS.ALT_P}">Alt + P</option>
					<option value="${COMMAND_PALETTE_SHORTCUTS.SLASH}">/</option>
				</select>
			</label>
			<label class="setting-row">
				<span>
					<strong>Sounds</strong>
					<small>Run, error, and done tones</small>
				</span>
				<input id="soundsEnabled" type="checkbox">
			</label>
			<label class="setting-row">
				<span>
					<strong>Show suggestions</strong>
					<small>Short mouse-click tips for common shortcuts</small>
				</span>
				<input id="showSuggestions" type="checkbox">
			</label>
		</section>
	`;
}

function renderUniversalClipboardSection(): string {
	return `
		<h2>Universal Clipboard</h2>
		<div class="slots">
			${UNIVERSAL_CLIPBOARD_SLOTS.map(renderClipboardSlotRow).join('')}
		</div>

		<h2>Action JSON</h2>
		<div class="json-field">
			<textarea id="actionJson" class="json-area" spellcheck="false" placeholder="Universal copy loads selected action JSON here. Paste JSON here to import."></textarea>
			<button id="clearJson" class="clear-json-button" type="button" aria-label="Clear JSON" title="Clear JSON" hidden>
				<svg aria-hidden="true" viewBox="0 0 24 24">
					<path d="M3 6h18"></path>
					<path d="M8 6V4h8v2"></path>
					<path d="M6 6l1 15h10l1-15"></path>
					<path d="M10 11v6"></path>
					<path d="M14 11v6"></path>
				</svg>
			</button>
		</div>
		<pre id="actionSummary" class="action-summary" hidden></pre>
		<div class="button-grid">
			<button id="importJson" type="button">Import JSON</button>
			<button id="copyJsonText" type="button">Copy text</button>
		</div>
	`;
}

function renderStyleFeatureControl(feature: (typeof STYLE_FEATURES)[number]): string {
	return `
		<label class="setting-row userstyle-dependent">
			<span>
				<strong>${feature.label}</strong>
				<small>${feature.description}</small>
			</span>
			<input id="styleFeature-${feature.key}" type="checkbox">
		</label>
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
				<h3>${group.title}</h3>
				${controls}
			</div>
		`;
	}).join('');
}

function renderStyleValueControls(): string {
	return STYLE_VALUE_FIELDS.map((field) => {
		if (field.key === 'userBg') {
			return `
				<div class="text-row userstyle-dependent">
					<span>
						<strong>${field.label}</strong>
						<small>${field.description}</small>
					</span>
					<input id="styleValue-${field.key}" type="hidden">
					<div class="upload-row">
						<input id="backgroundUpload" type="file" accept=".png,.jpg,.jpeg,.webp,.gif,image/png,image/jpeg,image/webp,image/gif">
						<button id="clearBackgroundUpload" type="button">Use default</button>
					</div>
					<div id="backgroundPreview" class="background-preview" aria-label="Background preview"></div>
				</div>
			`;
		}

		if (field.type === 'select' && 'options' in field) {
			return `
				<label class="select-row userstyle-dependent">
					<span>
						<strong>${field.label}</strong>
						<small>${field.description}</small>
					</span>
					<select id="styleValue-${field.key}">
						${field.options.map((option) => `<option value="${option}">${option}</option>`).join('')}
					</select>
				</label>
			`;
		}

		if (field.type === 'color') {
			return `
				<label class="color-row userstyle-dependent">
					<span>
						<strong>${field.label}</strong>
						<small>${field.description}</small>
					</span>
					<span class="color-controls">
						<input id="styleValue-${field.key}" type="color" aria-label="${field.label}">
						<input id="styleOpacity-${field.key}" type="range" min="0" max="1" step="0.01" aria-label="${field.label} opacity">
						<output id="styleOpacityValue-${field.key}"></output>
					</span>
				</label>
			`;
		}

		return '';
	}).join('');
}

app.innerHTML = `
	<header class="panel-header">
		<div>
			<h1>Better AA Developer Experience</h1>
		</div>
		<div class="header-controls">
			<span class="version-chip">v${extensionVersion}</span>
			<label class="debug-toggle">
				<span>Debug Mode</span>
				<input id="debugEnabled" type="checkbox">
			</label>
		</div>
	</header>

	<section id="debugLogSection" class="panel-section feedback-section is-collapsed">
		<div class="section-heading-row">
			<h2>Debug Log</h2>
			<span class="feedback-actions">
				<button id="toggleDebugLog" class="debug-log-toggle" type="button" aria-expanded="false" aria-label="Expand debug log" title="Expand debug log">▾</button>
				<button id="copyFeedback" type="button">Copy details</button>
				<button id="clearFeedback" type="button">Clear</button>
			</span>
		</div>
		<div id="feedbackList" class="feedback-list" aria-live="polite"></div>
	</section>

	<p id="status" role="status"></p>

	<nav class="tab-list" role="tablist" aria-label="Sidebar sections">
		<button class="tab-button is-active" type="button" role="tab" aria-selected="true" data-tab="tools">Tools</button>
		<button class="tab-button" type="button" role="tab" aria-selected="false" data-tab="userstyle">Userstyle</button>
		<button class="tab-button" type="button" role="tab" aria-selected="false" data-tab="settings">Settings</button>
	</nav>

	<main>
		${renderToolsPanel({
			universalClipboardHtml: renderUniversalClipboardSection(),
		})}

		<section class="tab-panel" role="tabpanel" data-panel="userstyle" hidden>
			<section class="panel-section">
				<div class="section-heading-row">
					<h2>Userstyle</h2>
					<button id="restoreUserstyleDefaults" type="button" hidden>Restore to Default</button>
				</div>
				<label class="setting-row">
					<span>
						<strong>Injected styles</strong>
						<small>Enable all custom style rules</small>
					</span>
					<input id="stylesEnabled" type="checkbox">
				</label>
				${renderStyleFeatureControls()}
			</section>

			<section class="panel-section">
				<div class="section-heading-row">
					<h2>Background Customization</h2>
					<button id="resetGradientColors" type="button">Reset Colors</button>
				</div>
				${renderStyleValueControls()}
			</section>
		</section>

		<section class="tab-panel" role="tabpanel" data-panel="settings" hidden>
			${renderToolsConfigSection()}
			<section class="panel-section">
				<h2>Configuration shortcuts</h2>
				<div class="info-row">
					<span>Sidebar shortcut</span>
					<strong id="sidebarShortcutValue">Ctrl+Shift+L</strong>
				</div>
				<div class="info-row">
					<span>Command palette shortcut</span>
					<strong id="settingsCommandPaletteShortcut">Alt + P</strong>
				</div>
			</section>
			<section class="panel-section info-panel">
				<h2>About</h2>
				<div class="info-row">
					<span>Version</span>
					<strong>${extensionVersion}</strong>
				</div>
				<div id="aboutHelp" class="help-content"></div>
				<a class="github-link" href="https://github.com/Jamir-boop/automationanywhere-improvements.git" target="_blank" rel="noreferrer" aria-label="GitHub repository" title="GitHub repository">
					<svg aria-hidden="true" viewBox="0 0 24 24">
						<path d="M12 .5C5.65.5.75 5.65.75 12.02c0 5.1 3.29 9.42 7.86 10.94.58.1.79-.25.79-.56v-2.14c-3.2.7-3.87-1.37-3.87-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.2 1.77 1.2 1.03 1.76 2.7 1.25 3.36.96.1-.75.4-1.25.73-1.54-2.56-.29-5.25-1.28-5.25-5.7 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.47.11-3.06 0 0 .97-.31 3.17 1.18.92-.26 1.91-.38 2.9-.39.98.01 1.97.13 2.89.39 2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.77.11 3.06.74.81 1.19 1.84 1.19 3.1 0 4.43-2.7 5.41-5.27 5.7.42.36.78 1.06.78 2.14v3.18c0 .31.21.67.8.56A11.54 11.54 0 0 0 23.25 12C23.25 5.65 18.35.5 12 .5Z"></path>
					</svg>
				</a>
			</section>
		</section>
	</main>

`;

const stylesInput = document.querySelector<HTMLInputElement>('#stylesEnabled')!;
const soundsInput = document.querySelector<HTMLInputElement>('#soundsEnabled')!;
const showSuggestionsInput =
	document.querySelector<HTMLInputElement>('#showSuggestions')!;
const debugInput = document.querySelector<HTMLInputElement>('#debugEnabled')!;
const shortcutSelect = document.querySelector<HTMLSelectElement>(
	'#commandPaletteShortcut'
)!;
const shortcutLabel = document.querySelector<HTMLElement>('#shortcutLabel')!;
const sidebarShortcutValue = document.querySelector<HTMLElement>('#sidebarShortcutValue')!;
const settingsCommandPaletteShortcut = document.querySelector<HTMLElement>(
	'#settingsCommandPaletteShortcut'
)!;
const status = document.querySelector<HTMLElement>('#status')!;
const actionJson = document.querySelector<HTMLTextAreaElement>('#actionJson')!;
const actionSummary = document.querySelector<HTMLElement>('#actionSummary')!;
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
	openSidebar: 'Ctrl+Shift+L',
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
	toggleDebugLogButton.textContent = debugLogCollapsed ? '▾' : '▴';
	toggleDebugLogButton.title = debugLogCollapsed ? 'Expand debug log' : 'Collapse debug log';
	toggleDebugLogButton.setAttribute(
		'aria-label',
		debugLogCollapsed ? 'Expand debug log' : 'Collapse debug log'
	);
	toggleDebugLogButton.setAttribute('aria-expanded', String(!debugLogCollapsed));
}

function renderFeedbackHistory(events: DebugEvent[] = []): void {
	updateDebugLogState();
	feedbackList.textContent = '';
	if (!events.length) {
		const empty = document.createElement('p');
		empty.className = 'feedback-empty';
		empty.textContent = 'No debug log.';
		feedbackList.appendChild(empty);
		return;
	}

	const visibleEvents = debugLogCollapsed ? events.slice(0, 1) : events;
	for (const event of visibleEvents) {
		const row = document.createElement('div');
		row.className = `feedback-line feedback-${event.level}`;

		const meta = document.createElement('small');
		meta.textContent = `${new Date(event.timestamp).toLocaleTimeString()} - ${event.level.toUpperCase()} - ${event.source}${
			event.details ? ' - DETAILS IN COPY' : ''
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
		return '# Better AA Developer Experience Debug Log\n\nStored entries: 0\n\nNo debug log.';
	}

	return [
		'# Better AA Developer Experience Debug Log',
		'',
		`Stored entries: ${events.length}`,
		'',
		...events.flatMap((event, index) => {
			const lines = [
				`## Entry ${index + 1}`,
				`Timestamp: ${event.timestamp}`,
				`Level: ${event.level}`,
				`Source: ${event.source}`,
				`Message: ${event.message}`,
			];

			if (event.details) {
				lines.push('Details JSON:');
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
	if (!tab?.id) return { ok: false, error: 'No active tab.' };

	try {
		const response = (await browser.tabs.sendMessage(
			tab.id,
			message
		)) as ContentActionResponse | undefined;
		return response ?? { ok: true };
	} catch {
		return { ok: false, error: 'Open an Automation Anywhere tab first.' };
	}
}

function updateShortcutLabel(shortcut: CommandPaletteShortcut): void {
	const label = getCommandPaletteShortcutLabel(shortcut);
	shortcutLabel.textContent = `Current: ${label}`;
	currentExtensionShortcuts.commandPalette = label;
	updateSettingsShortcutLabels();
}

function updateSettingsShortcutLabels(): void {
	sidebarShortcutValue.textContent = currentExtensionShortcuts.openSidebar;
	settingsCommandPaletteShortcut.textContent = currentExtensionShortcuts.commandPalette;
}

async function refreshExtensionShortcuts(): Promise<void> {
	try {
		const response = (await browser.runtime.sendMessage({
			type: 'GET_EXTENSION_SHORTCUTS',
		})) as ExtensionShortcuts | undefined;
		currentExtensionShortcuts = {
			openSidebar: response?.openSidebar || 'Ctrl+Shift+L',
			commandPalette:
				response?.commandPalette || getCommandPaletteShortcutLabel(currentShortcut),
		};
	} catch {
		currentExtensionShortcuts = {
			openSidebar: 'Ctrl+Shift+L',
			commandPalette: getCommandPaletteShortcutLabel(currentShortcut),
		};
	}
	updateSettingsShortcutLabels();
}

function renderStaticAboutHelp(shortcut: CommandPaletteShortcut): void {
	aboutHelp.innerHTML = renderHelpHtml({
		commands: Object.values(COMMAND_HELP),
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

function formatAutomationAnywhereSummary(summary: AutomationAnywhereJsonSummary): string {
	const lines = [`Copied actions: ${summary.actionCount}`, '', 'Packages:'];
	if (summary.packages.length) {
		for (const pkg of summary.packages) {
			lines.push(`- ${pkg.name} ${pkg.version}`);
		}
	} else {
		lines.push('- none');
	}

	lines.push('', 'Actions by package:');
	if (summary.actionsByPackage.length) {
		for (const group of summary.actionsByPackage) {
			lines.push(`- ${group.packageName} ${group.version}`);
			for (const action of group.actions) {
				lines.push(`  - ${action.commandName}: ${action.count}`);
			}
		}
	} else {
		lines.push('- none');
	}

	return lines.join('\n');
}

function getActionSummaryText(json: string): string {
	const input = json.trim();
	if (!input) return '';

	try {
		const parsed = JSON.parse(input);
		if (!isAutomationAnywhereJson(parsed)) {
			return 'JSON is not Automation Anywhere clipboard JSON.';
		}
		try {
			return formatAutomationAnywhereSummary(
				summarizeAutomationAnywhereJson(parsed)
			);
		} catch (error) {
			void debugError('aa-json', 'AA JSON summarization failed.', { error }, {
				feedback: true,
			});
			return 'Automation Anywhere summary failed.';
		}
	} catch {
		return 'Invalid JSON.';
	}
}

function updateClearJsonButton(): void {
	clearJsonButton.hidden = !actionJson.value.trim();
}

function updateActionJsonState(): void {
	updateClearJsonButton();
	const summaryText = getActionSummaryText(actionJson.value);
	actionSummary.textContent = summaryText;
	actionSummary.hidden = !summaryText;
}

function setActionJsonValue(json: string): void {
	actionJson.value = json;
	updateActionJsonState();
}

function getSlotStateText(json: string | null | undefined): string {
	if (!json?.trim()) return 'Empty';
	try {
		const parsed = JSON.parse(json);
		if (isAutomationAnywhereJson(parsed)) {
			const summary = summarizeAutomationAnywhereJson(parsed);
			const noun = summary.actionCount === 1 ? 'action' : 'actions';
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
		return 'Invalid JSON';
	}
}

function updateSlotState(slot: number, json: string | null | undefined): void {
	const row = document.querySelector<HTMLElement>(`[data-slot-row="${slot}"]`);
	const state = document.querySelector<HTMLElement>(`[data-slot-state="${slot}"]`);
	if (!row || !state) return;

	const stateText = getSlotStateText(json);
	state.textContent = stateText;
	row.classList.toggle('is-empty', stateText === 'Empty');
	row.classList.toggle('is-populated', stateText !== 'Empty');
	row.classList.toggle('is-invalid', stateText === 'Invalid JSON');
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
		setStatus(`${label} is empty.`, 'warn', 'clipboard');
		return;
	}
	setActionJsonValue(prettyJson(json));
	setStatus(`${label} JSON loaded.`, 'info', 'clipboard');
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
	updateRestoreDefaultsButton();
}

function validateBackgroundFile(file: File): string | null {
	const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
	if (
		!ALLOWED_BACKGROUND_MIME_TYPES.has(file.type) &&
		!ALLOWED_BACKGROUND_EXTENSIONS.has(extension)
	) {
		return 'Unsupported background file. Use png, jpg, jpeg, webp, or gif.';
	}
	if (file.size > MAX_BACKGROUND_UPLOAD_BYTES) {
		return 'Background file is too large. Maximum size is 3 MiB.';
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
			reject(new Error('File could not be read as a data URL.'));
		});
		reader.addEventListener('error', () => {
			reject(new Error('Background file read failed.'));
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
	const [styles, sounds, suggestions, debug, shortcut, styleFeatures, styleValues] = await Promise.all([
		getStylesEnabled(),
		getSoundsEnabled(),
		getShowSuggestions(),
		getDebugEnabled(),
		getCommandPaletteShortcut(),
		getStyleFeatureValues(),
		getStyleValues(),
	]);

	stylesInput.checked = styles;
	soundsInput.checked = sounds;
	showSuggestionsInput.checked = suggestions;
	debugInput.checked = debug;
	currentDebugEnabled = debug;
	shortcutSelect.value = shortcut;
	currentShortcut = shortcut;
	updateShortcutLabel(shortcut);
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
		showSuggestionsInput.checked ? 'Suggestions enabled.' : 'Suggestions disabled.',
		'info',
		'suggestions'
	);
});

debugInput.addEventListener('change', () => {
	currentDebugEnabled = debugInput.checked;
	void sendBackgroundMessage({
		type: 'SET_DEBUG_ENABLED',
		enabled: debugInput.checked,
	});
	void refreshFeedbackHistory();
	setStatus(debugInput.checked ? 'Debug mode enabled.' : 'Debug mode disabled.', 'info', 'debug');
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

STYLE_FEATURES.forEach((feature) => {
	getStyleFeatureInput(feature.key).addEventListener('change', (event) => {
		const input = event.currentTarget as HTMLInputElement;
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
		void debugWarn('background', 'Background upload validation failed.', {
			fileName: file.name,
			fileSize: file.size,
			fileType: file.type,
			reason: validationError,
		});
		setStatus(validationError, 'error', 'background');
		return;
	}

	try {
		const dataUrl = await readFileAsDataUrl(file);
		if (!dataUrl.startsWith('data:image/')) {
			void debugWarn('background', 'Background upload did not produce an image data URL.', {
				fileName: file.name,
				fileSize: file.size,
				fileType: file.type,
			}, { feedback: true });
			setStatus('Background file could not be used as an image.', 'error', 'background');
			return;
		}
		await setStyleValueAndNotify('userBg', `url("${dataUrl}")`);
		void debugInfo('background', 'Background uploaded.', {
			fileName: file.name,
			fileSize: file.size,
			fileType: file.type,
		});
		setStatus('Background uploaded.', 'info', 'background');
	} catch (error) {
		void debugError('background', 'Background upload failed.', {
			error,
			fileName: file.name,
			fileSize: file.size,
			fileType: file.type,
		}, { feedback: true });
		setStatus(
			error instanceof Error ? error.message : 'Background upload failed.',
			'error',
			'background'
		);
	} finally {
		backgroundUpload.value = '';
	}
});

clearBackgroundUploadButton.addEventListener('click', () => {
	void setStyleValueAndNotify('userBg', '').then(() => {
		setStatus('Default background restored.', 'info', 'background');
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
	setStatus('Gradient colors restored.', 'info', 'userstyle');
});

restoreUserstyleDefaultsButton.addEventListener('click', async () => {
	stylesInput.checked = DEFAULT_STYLES_ENABLED;
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
	void debugInfo('userstyle', 'Userstyle defaults restored.', {
		stylesEnabled: DEFAULT_STYLES_ENABLED,
	});
	setStatus('Userstyle defaults restored.', 'info', 'userstyle');
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
	setStatus(response.message ?? `${getClipboardSlotLabel(slot)} copied.`, 'info', 'clipboard');
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
		response.ok ? response.message ?? 'Paste queued.' : response.error,
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
		status.textContent = 'Debug log cleared.';
		status.dataset.severity = 'info';
		setTimeout(() => {
			if (status.textContent === 'Debug log cleared.') status.textContent = '';
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
			setStatus('Debug log copied for AI.', 'info', 'debug');
		})
		.catch(() => {
			setStatus('Debug log copy failed.', 'error', 'debug');
		});
});

document.querySelector<HTMLButtonElement>('#importJson')!.addEventListener('click', async () => {
	const json = actionJson.value.trim();
	if (!json) {
		setStatus('JSON textarea is empty.', 'warn', 'json');
		return;
	}
	try {
		JSON.parse(json);
	} catch (error) {
		void debugWarn('json', 'Action JSON parse failed.', { error }, { feedback: true });
		setStatus('Invalid JSON.', 'error', 'json');
		return;
	}
	const response = await sendActiveTabMessage({ type: 'IMPORT_ACTION_JSON', json });
	if (response.ok) {
		await refreshSlotState(DEFAULT_UNIVERSAL_CLIPBOARD_SLOT);
	}
	setStatus(
		response.ok ? response.message ?? 'Import queued.' : response.error,
		response.ok ? 'info' : 'error',
		'json'
	);
});

document.querySelector<HTMLButtonElement>('#copyJsonText')!.addEventListener('click', async () => {
	if (!actionJson.value.trim()) {
		setStatus('JSON textarea is empty.', 'warn', 'json');
		return;
	}
	try {
		await navigator.clipboard.writeText(actionJson.value);
		setStatus('JSON copied to clipboard.', 'info', 'json');
	} catch {
		setStatus('Clipboard write failed.', 'error', 'json');
	}
});

actionJson.addEventListener('input', updateActionJsonState);

clearJsonButton.addEventListener('click', () => {
	setActionJsonValue('');
	setStatus('JSON cleared.', 'info', 'json');
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
STYLE_FEATURES.forEach((feature) => {
	styleFeatureItems[feature.key].watch((value) => {
		getStyleFeatureInput(feature.key).checked = value ?? feature.defaultValue;
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
