import './style.styl';
import {
	initializeJsonWorkbench,
	renderJsonWorkbenchActionButtons,
	renderJsonWorkbenchSearchTools,
	type JsonWorkbench,
} from './json-workbench';
import {
	getSelectedToolsTargetTabId,
	handleToolsTabActivated,
	initializeToolsPanel,
	markToolsTargetDisconnected,
	markToolsTargetRouteChanged,
	openToolsJobs,
	renderToolsPanel,
} from './tools';
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
	ControlRoomCompatibilityResponse,
	ExtensionShortcuts,
	RuntimeMessage,
} from '@/src/ts/messages';
import {
	formatControlRoomTarget,
	formatControlRoomVersion,
	SUPPORTED_CONTROL_ROOM_TARGET,
	SUPPORTED_CONTROL_ROOM_TARGETS,
	type ControlRoomCompatibilityStatus,
} from '@/src/ts/control-room-version';
import type { StyleDoctorCheck, StyleDoctorCheckResult } from '@/src/ts/style-doctor';
import {
	compareResults,
	getChecksForGroup,
	type DoctorCheckGroup,
} from '@/src/ts/style-doctor';
import {
	runApiHealthChecks,
	skipAllApiHealthChecks,
	type ApiHealthResult,
} from '@/src/ts/api-health';
import {
	AutomationAnywhereApi,
	getActiveAutomationAnywhereContext,
	getAutomationAnywhereAuthToken,
} from '@/src/ts/automation-anywhere-api';
import {
	isAutomationAnywhereJson,
	summarizeAutomationAnywhereJson,
} from '@/src/ts/automation-anywhere-json';
import {
	clampBackgroundColorValue,
	formatAlpha,
	formatRgba,
	hexToRgb,
	parseCssColorValue,
	toHex,
} from '@/src/ts/background-colors';
import {
	COMMAND_PALETTE_SHORTCUTS,
	BOT_EXECUTION_MODAL_POSITION_OPTIONS,
	DEFAULT_BLOCK_TASKBOT_NODE_LABEL_CLICKS,
	DEFAULT_BOT_EXECUTION_MODAL_POSITION,
	DEFAULT_BACKGROUND_JOB_NOTIFICATIONS_ENABLED,
	DEFAULT_BROWSER_CONTEXT_MENU_ENABLED,
	DEFAULT_COMMAND_PALETTE_ENABLED,
	DEFAULT_DEBUG_ENABLED,
	DEFAULT_EXTENSION_LANGUAGE,
	DEFAULT_FORCE_ENGLISH_LOCALE,
	DEFAULT_FORCE_UNSUPPORTED_CONTROL_ROOM_STYLES,
	DEFAULT_CHUNKED_CLIPBOARD_PASTE_ENABLED,
	DEFAULT_KEEP_ALIVE_ENABLED,
	DEFAULT_OPEN_SIDEBAR_SHORTCUT,
	DEFAULT_RUN_BUTTON_WAVES,
	DEFAULT_SOUNDS_ENABLED,
	DEFAULT_SHOW_SUGGESTIONS,
	DEFAULT_STYLES_ENABLED,
	DEFAULT_GETTING_STARTED_GUIDANCE_ENABLED,
	EXTENSION_LANGUAGE_OPTIONS,
	OPEN_SIDEBAR_SHORTCUT_OPTIONS,
	STYLE_FEATURES,
	STYLE_VALUE_FIELDS,
	botExecutionModalPosition,
	backgroundJobNotificationsEnabled,
	blockTaskbotNodeLabelClicks,
	browserContextMenuEnabled,
	chunkedClipboardPasteEnabled,
	commandPaletteEnabled,
	commandPaletteShortcut,
	debugEnabled,
	extensionLanguage,
	forceEnglishLocale,
	forceUnsupportedControlRoomStyles,
	getBlockTaskbotNodeLabelClicks,
	getBotExecutionModalPosition,
	getBackgroundJobNotificationsEnabled,
	getBrowserContextMenuEnabled,
	getCommandPaletteEnabled,
	getChunkedClipboardPasteEnabled,
	getCommandPaletteShortcut,
	getCommandPaletteShortcutLabel,
	getDebugEnabled,
	getExtensionLanguage,
	getForceEnglishLocale,
	getForceUnsupportedControlRoomStyles,
	getKeepAliveEnabled,
	getOpenSidebarShortcut,
	getOpenSidebarShortcutLabel,
	getRunButtonWavesEnabled,
	getShowSuggestions,
	getSoundsEnabled,
	getStyleFeatureValues,
	getStyleValues,
	getStylesEnabled,
	getGettingStartedGuidanceEnabled,
	normalizeBotExecutionModalPosition,
	normalizeExtensionLanguage,
	normalizeOpenSidebarShortcut,
	keepAliveEnabled,
	openSidebarShortcut,
	runButtonWaves,
	showSuggestions,
	soundsEnabled,
	styleFeatureItems,
	styleValueItems,
	stylesEnabled,
	gettingStartedGuidanceEnabled,
	styleDoctorLastResults,
	apiHealthLastResults,
	packageUpdateToastEnabled,
	getPackageUpdateToastEnabled,
	DEFAULT_PACKAGE_UPDATE_TOAST_ENABLED,
	nonClosingMessageBoxWarningEnabled,
	getNonClosingMessageBoxWarningEnabled,
	DEFAULT_NON_CLOSING_MESSAGE_BOX_WARNING_ENABLED,
	variableMetadataEnabled,
	getVariableMetadataEnabled,
	DEFAULT_VARIABLE_METADATA_ENABLED,
	DEFAULT_RECORDER_BRIDGE_ENABLED,
	DEFAULT_RECORDER_BRIDGE_PORT,
	recorderBridgeEnabled,
	recorderBridgePort,
	recorderBridgeToken,
	getRecorderBridgeEnabled,
	getRecorderBridgePort,
	getRecorderBridgeToken,
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
import { replaceChildrenFromHtml } from '@/src/ts/utils';
import {
	icon,
	type BetterAaIconName,
} from '@/src/ts/icons';
import {
	renderLucideIcons,
	setSidepanelIconButtonContent,
	setSidepanelIconContent,
} from './icons';

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('Missing #app root.');
const isOptionsSurface = document.documentElement.dataset.surface === 'options';

void (async () => {
setActiveLanguagePreference(
	await getExtensionLanguage().catch(() => DEFAULT_EXTENSION_LANGUAGE)
);

const extensionVersion = browser.runtime.getManifest().version;
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
		title: 'Navigation',
		keys: ['makeSidebarScrollable', 'adjustFolderColumnsWidth', 'pathFinder'],
	},
	{
		title: 'Background and loading',
		keys: ['bgStyle', 'loadingCat'],
	},
] as const satisfies ReadonlyArray<{
	title: string;
	keys: readonly StyleFeatureKey[];
}>;
let currentControlRoomCompatibility: ControlRoomCompatibilityStatus | null = null;
let controlRoomCompatibilityRequestId = 0;

function getClipboardSlotLabel(slot: number): string {
	return slot === DEFAULT_UNIVERSAL_CLIPBOARD_SLOT
		? t('Auto')
		: t('Slot {slot}', { slot });
}

function renderClipboardSlotRow(slot: number): string {
	const label = getClipboardSlotLabel(slot);
	return `
		<div class="slot-row is-empty" data-slot-row="${slot}" role="button" tabindex="0" aria-label="${t('Load {label}', { label })}">
			<span class="slot-label">${label}</span>
			<span class="slot-state" data-slot-state="${slot}">${t('Empty')}</span>
			<button type="button" data-copy-slot="${slot}" title="${t('Save current AA clipboard to this slot.')}">${icon('clipboard-copy')}${t('Copy')}</button>
			<button type="button" data-paste-slot="${slot}" title="${t('Paste this slot through AA shared paste.')}">${icon('clipboard-paste')}${t('Paste')}</button>
		</div>
	`;
}

function renderToolsConfigSection(): string {
	return `
		<section class="panel-section settings-intro">
			<h2>${t('Settings')}</h2>
			<p class="inline-hint">${t('Settings apply to all Control Rooms.')}</p>
			<details class="settings-group" id="settings-general" open>
				<summary>${t('General')}${icon('chevron-right', false)}</summary>
				<div class="settings-group-content">
			<label class="select-row">
				<span>
					<strong>${t('Extension language')}</strong>
					<small>${t('Use browser language, English, or Spanish for this extension UI.')}</small>
				</span>
				<select id="extensionLanguage">
					${EXTENSION_LANGUAGE_OPTIONS.map((option) => `<option value="${option.value}">${t(option.label)}</option>`).join('')}
				</select>
			</label>
			<label class="setting-row">
				<span><strong>${t('Sounds')}</strong><small>${t('Run, error, and done tones')}</small></span>
				<input id="soundsEnabled" type="checkbox">
			</label>
			<label class="setting-row">
				<span><strong>${t('Show suggestions')}</strong><small>${t('Short mouse-click tips for common shortcuts')}</small></span>
				<input id="showSuggestions" type="checkbox">
			</label>
			<label class="setting-row">
				<span><strong>${t('Notify outdated packages')}</strong><small>${t('Shows a toast when an open taskbot has package updates available.')}</small></span>
				<input id="packageUpdateToastEnabled" type="checkbox">
			</label>
			<label class="setting-row">
				<span><strong>${t('Background job notifications')}</strong><small>${t('Show a browser notification when a Tools job finishes.')}</small></span>
				<input id="backgroundJobNotificationsEnabled" type="checkbox">
			</label>
			<label class="setting-row">
				<span><strong>${t('Show getting started guidance')}</strong><small>${t('Show the dismissible Start here card in Help.')}</small></span>
				<input id="gettingStartedGuidanceEnabled" type="checkbox">
			</label>
				</div>
			</details>

			<details class="settings-group" id="settings-shortcuts">
				<summary>${t('Shortcuts and access')}${icon('chevron-right', false)}</summary>
				<div class="settings-group-content">
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
				<span><strong>${t('Browser context menu')}</strong><small>${t('Shows Open Sidebar and Universal Clipboard commands in the browser right-click menu.')}</small></span>
				<input id="browserContextMenuEnabled" type="checkbox">
			</label>
				</div>
			</details>

			<details class="settings-group" id="settings-control-room">
				<summary>${t('Control Room behavior')}${icon('chevron-right', false)}</summary>
				<div class="settings-group-content">
			<label class="setting-row">
				<span>
					<strong>${t('Warn about non-closing message boxes')}</strong>
					<small>${t('Checks saved TaskBots for message boxes without a definite positive timeout.')}</small>
				</span>
				<input id="nonClosingMessageBoxWarningEnabled" type="checkbox">
			</label>
			<label class="setting-row">
				<span>
					<strong>${t('Chunk oversized clipboard pastes')}</strong>
					<small>${t('Automatically split large TaskBot pastes when Automation Anywhere storage is full.')}</small>
				</span>
				<input id="chunkedClipboardPasteEnabled" type="checkbox">
			</label>
			<label class="setting-row">
				<span>
					<strong>${t('Keep Automation Anywhere session alive')}</strong>
					<small>${t('Sends periodic in-page activity to reduce idle logout.')}</small>
					<em class="impact-label">${t('All Control Rooms')}</em>
				</span>
				<input id="keepAliveEnabled" type="checkbox">
			</label>
			<label class="setting-row">
				<span>
					<strong>${t('Force Automation Anywhere English')}</strong>
					<small>${t('Set Automation Anywhere locale to en-US and reload when needed. Does not change this extension language.')}</small>
					<em class="impact-label">${t('All Control Rooms')} · ${t('Reloads pages')}</em>
				</span>
				<input id="forceEnglishLocale" type="checkbox">
			</label>
			<label class="setting-row">
				<span><strong>${t('Block taskbot link clicks')}</strong><small>${t('Prevent left-click navigation on taskbot node links; middle-click still works.')}</small></span>
				<input id="blockTaskbotNodeLabelClicks" type="checkbox">
			</label>
				</div>
			</details>

			<details class="settings-group" id="settings-integrations">
				<summary>${t('Integrations')}${icon('chevron-right', false)}</summary>
				<div class="settings-group-content">
			<label class="setting-row"${import.meta.env.CHROME ? '' : ' hidden'}>
				<span>
					<strong>Better Recorder bridge</strong>
					<small>Connects to the local BetterRecorder package. Enabled by default.</small>
				</span>
				<input id="recorderBridgeEnabled" type="checkbox">
			</label>
			<label id="recorderBridgePortRow" class="select-row"${import.meta.env.CHROME ? '' : ' hidden'}>
				<span><strong>Recorder port</strong><small>Local WebSocket port.</small></span>
				<input id="recorderBridgePort" type="number" min="1" max="65535" inputmode="numeric">
			</label>
			<label id="recorderBridgeTokenRow" class="select-row"${import.meta.env.CHROME ? '' : ' hidden'}>
				<span><strong>Recorder token</strong><small>Shared only with localhost.</small></span>
				<input id="recorderBridgeToken" type="password" autocomplete="off">
			</label>
				</div>
			</details>
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
		<p class="inline-hint">${t('Portable Action JSON can contain capture screenshots and selector data.')}</p>
		${renderJsonWorkbenchSearchTools('actionJson')}
		<div class="json-field">
			<textarea id="actionJson" class="json-area" spellcheck="false" placeholder="${t('Universal copy loads selected action JSON here. Paste JSON here to import.')}"></textarea>
			<button id="clearJson" class="clear-json-button" type="button" aria-label="${t('Clear JSON')}" title="${t('Clear JSON')}" hidden>
				${icon('trash-2', false)}
			</button>
		</div>
		<p id="actionJsonError" class="json-inline-error" hidden></p>
		<div id="actionPackageList" class="action-package-list" hidden></div>
		<div class="button-grid">
			<button id="importJson" type="button">${icon('file-up')}${t('Import JSON')}</button>
			${renderJsonWorkbenchActionButtons('actionJson')}
		</div>
	`;
}

function renderRunButtonWavesControl(): string {
	return `
		<label class="setting-row userstyle-dependent style-subsetting run-button-waves-dependent">
			<span>
				<strong>${t('Wave rings')}</strong>
				<small>${t('Play wave rings on Run hover.')}</small>
			</span>
			<input id="runButtonWaves" type="checkbox">
		</label>
	`;
}

function renderStyleFeatureControl(feature: (typeof STYLE_FEATURES)[number]): string {
	return `
		<label class="setting-row userstyle-dependent">
			<span>
				<strong>${t(feature.label)}</strong>
				<small>${t(feature.description)}</small>
			</span>
			<input id="styleFeature-${feature.key}" type="checkbox">
		</label>
		${feature.key === 'runButton' ? renderRunButtonWavesControl() : ''}
		${feature.key === 'minimizeBotModal' ? renderBotExecutionModalPositionControl() : ''}
	`;
}

function renderVariableMetadataControl(): string {
	return `
		<label class="setting-row">
			<span>
				<strong>${t('Variable metadata labels')}</strong>
				<small>${t('Shows IO arrows, defaults, and unused badges in the Variables palette.')}</small>
			</span>
			<input id="variableMetadataEnabled" type="checkbox">
		</label>
	`;
}

function renderStyleFeatureControls(): string {
	return STYLE_FEATURE_GROUPS.map((group) => {
		const groupId = group.title === 'Taskbot Editor'
			? 'appearance-taskbot-editor'
			: group.title === 'Navigation'
				? 'appearance-navigation'
				: 'appearance-background-loading';
		const extraControls =
			group.title === 'Taskbot Editor'
				? renderVariableMetadataControl()
				: '';
		const controls = group.keys
			.map((key) => STYLE_FEATURES.find((feature) => feature.key === key))
			.filter((feature): feature is (typeof STYLE_FEATURES)[number] => !!feature)
			.map(renderStyleFeatureControl)
			.join('');
		return `
			<div id="${groupId}" class="style-feature-group">
				<h3>${t(group.title)}</h3>
				${extraControls}
				${controls}
			</div>
		`;
	}).join('');
}

function renderControlRoomCompatibilitySection(): string {
	return `
		<details id="appearance-compatibility" class="settings-group control-room-status">
			<summary>${t('Compatibility override')}${icon('chevron-right', false)}</summary>
			<div class="settings-group-content">
			<div class="control-room-head">
				<span>
					<strong>${t('Control Room')}</strong>
					<small id="controlRoomVersionState">${t('Checking version...')}</small>
				</span>
				<button id="refreshControlRoomVersion" type="button">${icon('refresh-cw')}${t('Refresh')}</button>
			</div>
			<div id="controlRoomVersionMeta" class="control-room-meta"></div>
			<p id="controlRoomVersionAlert" class="control-room-alert" hidden></p>
			<label id="forceUnsupportedControlRoomRow" class="setting-row force-control-room-row" hidden>
				<span>
					<strong>${t('Force styles on unsupported Control Room')}</strong>
					<small>${t('Use UI Improvements even when Control Room target differs.')}</small>
				</span>
				<input id="forceUnsupportedControlRoomStyles" type="checkbox">
			</label>
			</div>
		</details>
	`;
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
					<button id="clearBackgroundUpload" type="button">${icon('rotate-ccw')}${t('Use default')}</button>
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

replaceChildrenFromHtml(app, `
	<header class="panel-header">
		<div>
			<h1>${t('Better AA Developer Experience')}</h1>
		</div>
		<div class="header-controls">
			<span class="version-chip">${extensionVersion}</span>
			${isOptionsSurface ? '' : `<button id="openFullSettings" type="button">${icon('external-link')}${t('Open full settings')}</button>`}
		</div>
	</header>

	<p id="status" role="status"></p>
	<div id="undoNotice" class="undo-notice" role="status" hidden>
		<span>${t('Setting saved.')}</span>
		<button id="undoSetting" type="button">${icon('undo-2')}${t('Undo')}</button>
	</div>

	<nav class="tab-list" role="tablist" aria-label="${t('Sidebar sections')}">
		${isOptionsSurface ? '' : `<button id="tab-tools" class="tab-button is-active" type="button" role="tab" aria-selected="true" aria-controls="panel-tools" tabindex="0" data-tab="tools">${icon('toolbox')}${t('Tools')} <span id="jobsTabBadge" class="nav-badge" hidden></span></button>`}
		<button id="tab-appearance" class="tab-button${isOptionsSurface ? ' is-active' : ''}" type="button" role="tab" aria-selected="${String(isOptionsSurface)}" aria-controls="panel-appearance" tabindex="${isOptionsSurface ? '0' : '-1'}" data-tab="appearance">${icon('palette')}${t('Appearance')}</button>
		<button id="tab-settings" class="tab-button" type="button" role="tab" aria-selected="false" aria-controls="panel-settings" tabindex="-1" data-tab="settings">${icon('settings')}${t('Settings')}</button>
		<button id="tab-help" class="tab-button" type="button" role="tab" aria-selected="false" aria-controls="panel-help" tabindex="-1" data-tab="help">${icon('circle-help')}${t('Help')}</button>
	</nav>

	<main>
		${renderToolsPanel({
			universalClipboardHtml: renderUniversalClipboardSection(),
			hidden: isOptionsSurface,
		})}

		<section id="panel-appearance" class="tab-panel${isOptionsSurface ? ' is-active' : ''}" role="tabpanel" aria-labelledby="tab-appearance" tabindex="0" data-panel="appearance"${isOptionsSurface ? '' : ' hidden'}>
			<section class="panel-section">
				<div class="section-heading-row">
					<h2>${t('Appearance')}</h2>
					<button id="restoreUserstyleDefaults" type="button" hidden>${icon('rotate-ccw')}${t('Restore to Default')}</button>
				</div>
				${renderControlRoomCompatibilitySection()}
				<label class="setting-row">
					<span>
						<strong>${t('UI Improvements')}</strong>
						<small>${t('Enable all custom style rules')}</small>
					</span>
					<input id="stylesEnabled" type="checkbox">
				</label>
				${renderStyleFeatureControls()}
			</section>

			<section id="appearance-loading" class="panel-section">
				<h2>${t('Loading Animation')}</h2>
				${renderLoadingAnimationControls()}
			</section>

			<section id="appearance-background" class="panel-section">
				<div class="section-heading-row">
					<h2>${t('Background Customization')}</h2>
					<button id="resetGradientColors" type="button">${icon('rotate-ccw')}${t('Reset Colors')}</button>
				</div>
				${renderBackgroundColorControls()}
			</section>
		</section>

		<section id="panel-settings" class="tab-panel" role="tabpanel" aria-labelledby="tab-settings" tabindex="0" data-panel="settings" hidden>
			${renderToolsConfigSection()}
		</section>

		<section id="panel-help" class="tab-panel" role="tabpanel" aria-labelledby="tab-help" tabindex="0" data-panel="help" hidden>
			<div class="help-subtabs" role="tablist" aria-label="${t('Help sections')}">
				<button id="help-tab-overview" class="help-subtab is-active" type="button" role="tab" aria-selected="true" aria-controls="help-panel-overview" tabindex="0" data-help-section="overview">${icon('circle-help')}${t('Overview')}</button>
				<button id="help-tab-commands" class="help-subtab" type="button" role="tab" aria-selected="false" aria-controls="help-panel-commands" tabindex="-1" data-help-section="commands">${icon('terminal')}${t('Commands')}</button>
				<button id="help-tab-compatibility" class="help-subtab" type="button" role="tab" aria-selected="false" aria-controls="help-panel-compatibility" tabindex="-1" data-help-section="compatibility">${icon('package-check')}${t('Compatibility')}</button>
				<button id="help-tab-diagnostics" class="help-subtab" type="button" role="tab" aria-selected="false" aria-controls="help-panel-diagnostics" tabindex="-1" data-help-section="diagnostics">${icon('stethoscope')}${t('Diagnostics')}</button>
			</div>

			<div id="help-panel-overview" class="help-subpanel" role="tabpanel" aria-labelledby="help-tab-overview" tabindex="0" data-help-subpanel="overview">
				<section id="help-start" class="panel-section getting-started-card">
					<div class="section-heading-row"><h2>${t('Start here')}</h2><button id="dismissGettingStarted" type="button">${icon('x')}${t('Dismiss')}</button></div>
					<p>${isOptionsSurface
						? t('Customize the interface in Appearance, review global behavior in Settings, and use the side panel for Tools and live Diagnostics.')
						: t('Choose a Control Room in Tools, customize the interface in Appearance, and review global behavior in Settings.')}</p>
				</section>
				<section id="help-about" class="panel-section creator-panel">
					<div class="creator-heading-row">
						<h2>${t('About')}</h2>
						<span class="version-chip" title="${t('Version')}">${extensionVersion}</span>
					</div>
					<div class="creator-signature">
						<strong>${t('Built by Jamir')}</strong>
						<span>@Jamir-boop</span>
					</div>
					<p class="creator-mission">${t('I build practical tools that remove friction from Automation Anywhere development, so you can focus on the automation—not the interface.')}</p>
					<nav class="creator-contact-list" aria-label="${t('Contact Jamir')}">
						<a class="creator-contact" href="https://github.com/Jamir-boop" target="_blank" rel="noreferrer" aria-label="${t('GitHub profile')}" title="${t('GitHub profile')}">${icon('git-fork', false)}</a>
						<a class="creator-contact" href="mailto:jeiser_vargas@outlook.com" aria-label="${t('Email Jamir')}" title="${t('Email Jamir')}">${icon('mail', false)}</a>
					</nav>
				</section>
			</div>

			<div id="help-panel-commands" class="help-subpanel" role="tabpanel" aria-labelledby="help-tab-commands" tabindex="0" data-help-subpanel="commands" hidden>
				<section id="help-commands" class="panel-section help-search-section">
					<h2>${t('Help')}</h2>
					<input id="helpSearch" type="search" placeholder="${t('Search help')}" aria-label="${t('Search help')}">
					<div id="aboutHelp" class="help-content"></div>
				</section>
			</div>

			<div id="help-panel-compatibility" class="help-subpanel" role="tabpanel" aria-labelledby="help-tab-compatibility" tabindex="0" data-help-subpanel="compatibility" hidden>
				<section id="help-compatibility" class="panel-section">
					<div class="section-heading-row">
						<h2>${t('Supported Builds')}</h2>
					</div>
					<div id="supportedBuildsList" class="supported-builds-list"></div>
					<div id="buildCandidate" class="build-candidate" hidden>
						<p id="buildCandidateMessage" class="inline-hint"></p>
						<pre id="buildCandidateSnippet" class="build-candidate-snippet"></pre>
						<button id="copyBuildCandidate" type="button">${icon('copy')}${t('Copy candidate')}</button>
					</div>
				</section>
			</div>

			<div id="help-panel-diagnostics" class="help-subpanel" role="tabpanel" aria-labelledby="help-tab-diagnostics" tabindex="0" data-help-subpanel="diagnostics" hidden>
				<section id="help-diagnostics" class="panel-section diagnostics-heading">
					<div class="section-heading-row"><h2>${t('Diagnostics')}</h2><label class="debug-toggle"><span>${t('Debug Mode')}</span><input id="debugEnabled" type="checkbox"></label></div>
					<p class="inline-hint">${isOptionsSurface ? t('Open the side panel to run live Control Room diagnostics.') : t('Live diagnostics inspect Control Room state and never modify it.')}</p>
				</section>

		<div id="diagnosticsContent" class="doctor-panel"${isOptionsSurface ? ' hidden' : ''}>
			<div class="health-subtabs" role="tablist" aria-label="${t('Health sections')}">
				<button class="health-subtab" type="button" role="tab" aria-selected="false" data-health-section="health">${icon('stethoscope')}${t('UI Health')}</button>
				<button class="health-subtab" type="button" role="tab" aria-selected="false" data-health-section="api">${icon('activity')}${t('API Health')}</button>
				<button class="health-subtab is-active" type="button" role="tab" aria-selected="true" data-health-section="logs">${icon('scroll-text')}${t('Debug Logs')}</button>
			</div>

			<div class="health-subpanel" data-health-subpanel="health" hidden aria-hidden="true">
				<section class="panel-section">
					<h2>${t('UI Health')}</h2>
					<div class="doctor-view-pills" role="group" aria-label="${t('Health check view selector')}">
						<button class="doctor-pill is-active" type="button" data-doctor-view="general">${t('General')}</button>
						<button class="doctor-pill" type="button" data-doctor-view="taskbot-editor">${t('Taskbot Editor')}</button>
						<button class="doctor-pill" type="button" data-doctor-view="folder-navigation">${t('Folder Navigation')}</button>
					</div>
					<div id="doctorChecklist" class="doctor-checklist"></div>
					<div class="doctor-actions">
						<button id="runDoctorView" type="button">${icon('play')}${t('Run Checks')}</button>
						<span id="doctorSummary" class="doctor-summary"></span>
					</div>
				</section>

			</div>

			<div class="health-subpanel" data-health-subpanel="api" hidden aria-hidden="true">
				<section class="panel-section">
					<h2>${t('API Health')}</h2>
					<p class="inline-hint">${t('Read-only probes of Control Room endpoints this extension depends on. Nothing is created or modified.')}</p>
					<div id="apiHealthList" class="doctor-checklist"></div>
					<div class="doctor-actions">
						<button id="runApiHealth" type="button">${icon('play')}${t('Run Checks')}</button>
						<span id="apiHealthSummary" class="doctor-summary"></span>
					</div>
				</section>
			</div>

			<section class="panel-section feedback-section health-subpanel" id="debugLogSection" data-health-subpanel="logs" aria-hidden="false">
				<div class="section-heading-row">
					<h2>${t('Debug Logs')}</h2>
					<span class="feedback-actions">
						<button id="copyFeedback" type="button">${icon('copy')}${t('Copy')}</button>
						<button id="clearFeedback" type="button">${icon('trash-2')}${t('Clear')}</button>
					</span>
				</div>
				<p class="inline-hint">${t('Debug Mode stores local support logs. Nothing is sent automatically.')}</p>
				<div id="feedbackList" class="feedback-list" aria-live="polite"></div>
			</section>
		</div>
			</div>
		</section>
	</main>

`);
renderLucideIcons(app);

const stylesInput = document.querySelector<HTMLInputElement>('#stylesEnabled')!;
const runButtonWavesInput = document.querySelector<HTMLInputElement>('#runButtonWaves')!;
const runButtonWavesRow =
	runButtonWavesInput.closest<HTMLElement>('.run-button-waves-dependent')!;
const soundsInput = document.querySelector<HTMLInputElement>('#soundsEnabled')!;
const packageUpdateToastEnabledInput = document.querySelector<HTMLInputElement>(
	'#packageUpdateToastEnabled'
)!;
const backgroundJobNotificationsEnabledInput =
	document.querySelector<HTMLInputElement>('#backgroundJobNotificationsEnabled')!;
const gettingStartedGuidanceEnabledInput =
	document.querySelector<HTMLInputElement>('#gettingStartedGuidanceEnabled')!;
const nonClosingMessageBoxWarningEnabledInput =
	document.querySelector<HTMLInputElement>('#nonClosingMessageBoxWarningEnabled')!;
const browserContextMenuEnabledInput = document.querySelector<HTMLInputElement>(
	'#browserContextMenuEnabled'
)!;
const chunkedClipboardPasteEnabledInput = document.querySelector<HTMLInputElement>(
	'#chunkedClipboardPasteEnabled'
)!;
const variableMetadataEnabledInput = document.querySelector<HTMLInputElement>(
	'#variableMetadataEnabled'
)!;
const showSuggestionsInput =
	document.querySelector<HTMLInputElement>('#showSuggestions')!;
const keepAliveEnabledInput =
	document.querySelector<HTMLInputElement>('#keepAliveEnabled')!;
const commandPaletteEnabledInput = document.querySelector<HTMLInputElement>(
	'#commandPaletteEnabled'
)!;
const blockTaskbotNodeLabelClicksInput = document.querySelector<HTMLInputElement>(
	'#blockTaskbotNodeLabelClicks'
)!;
const forceEnglishLocaleInput =
	document.querySelector<HTMLInputElement>('#forceEnglishLocale')!;
const recorderBridgeEnabledInput = document.querySelector<HTMLInputElement>('#recorderBridgeEnabled')!;
const recorderBridgePortRow = document.querySelector<HTMLElement>('#recorderBridgePortRow')!;
const recorderBridgeTokenRow = document.querySelector<HTMLElement>('#recorderBridgeTokenRow')!;
const recorderBridgePortInput = document.querySelector<HTMLInputElement>('#recorderBridgePort')!;
const recorderBridgeTokenInput = document.querySelector<HTMLInputElement>('#recorderBridgeToken')!;

function updateRecorderBridgeDependentState(): void {
	const hidden = !import.meta.env.CHROME || !recorderBridgeEnabledInput.checked;
	recorderBridgePortRow.hidden = hidden;
	recorderBridgeTokenRow.hidden = hidden;
}
const forceUnsupportedControlRoomStylesInput =
	document.querySelector<HTMLInputElement>('#forceUnsupportedControlRoomStyles')!;
const forceUnsupportedControlRoomRow = document.querySelector<HTMLElement>(
	'#forceUnsupportedControlRoomRow'
)!;
const controlRoomVersionState = document.querySelector<HTMLElement>(
	'#controlRoomVersionState'
)!;
const controlRoomVersionMeta = document.querySelector<HTMLElement>(
	'#controlRoomVersionMeta'
)!;
const controlRoomVersionAlert = document.querySelector<HTMLElement>(
	'#controlRoomVersionAlert'
)!;
const refreshControlRoomVersionButton = document.querySelector<HTMLButtonElement>(
	'#refreshControlRoomVersion'
)!;
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
const actionJsonError = document.querySelector<HTMLElement>('#actionJsonError')!;
const actionPackageList = document.querySelector<HTMLElement>('#actionPackageList')!;
const clearJsonButton = document.querySelector<HTMLButtonElement>('#clearJson')!;
const debugLogSection = document.querySelector<HTMLElement>('#debugLogSection')!;
const feedbackList = document.querySelector<HTMLElement>('#feedbackList')!;
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
type HelpSection = 'overview' | 'commands' | 'compatibility' | 'diagnostics';
let activeHelpSection: HelpSection = 'overview';
type HealthSection = 'health' | 'api' | 'logs';
let activeHealthSection: HealthSection = 'logs';
let actionJsonWorkbench: JsonWorkbench;
let currentExtensionShortcuts: ExtensionShortcuts = {
	openSidebar: getOpenSidebarShortcutLabel(currentOpenSidebarShortcut),
	commandPalette: getCommandPaletteShortcutLabel(currentShortcut),
};
let lastSidepanelRequestNonce: string | null = null;
let currentDoctorView: DoctorCheckGroup = 'general';
let currentDoctorResults: StyleDoctorCheckResult[] = [];
let previousDoctorResults: StyleDoctorCheckResult[] | null = null;
let doctorRunning = false;
let activeTab: SidepanelTab = isOptionsSurface ? 'appearance' : 'tools';

function showStatusMessage(message: string, severity: FeedbackSeverity = 'info'): void {
	if (currentDebugEnabled && activeTab === 'help') {
		status.textContent = '';
		return;
	}
	status.textContent = message;
	if (!message) return;
	status.dataset.severity = severity;
	setTimeout(() => {
		if (status.textContent === message) status.textContent = '';
	}, 3000);
}

function setStatus(
	message: string,
	severity: FeedbackSeverity = 'info',
	source = 'sidepanel'
): void {
	showStatusMessage(message, severity);
	if (!message) return;
	void addFeedback(severity, source, message);
}

function updateDebugVisibility(): void {
	const diagnostics = document.querySelector<HTMLElement>('#diagnosticsContent');
	if (diagnostics) diagnostics.hidden = isOptionsSurface || !currentDebugEnabled;
	if (
		currentDebugEnabled &&
		activeTab === 'help' &&
		activeHelpSection === 'diagnostics' &&
		!isOptionsSurface
	) {
		setHealthSection(activeHealthSection);
	} else {
		debugLogSection.hidden = true;
		debugLogSection.setAttribute('aria-hidden', 'true');
	}
	updateStatusVisibility();
}

actionJsonWorkbench = initializeJsonWorkbench({
	idPrefix: 'actionJson',
	textarea: actionJson,
	errorElement: actionJsonError,
	detailsContainer: actionPackageList,
	setStatus: (message, severity = 'info') => setStatus(message, severity, 'json'),
	getExportFileName: () => 'action-json.json',
	onChange: updateClearJsonButton,
	emptyMessage: t('JSON textarea is empty.'),
	copiedMessage: t('JSON copied to clipboard.'),
});

function renderFeedbackHistory(events: DebugEvent[] = []): void {
	feedbackList.textContent = '';
	if (!events.length) {
		const empty = document.createElement('p');
		empty.className = 'feedback-empty';
		empty.textContent = t('No debug log.');
		feedbackList.appendChild(empty);
		return;
	}

	for (const event of events) {
		const meta = document.createElement('small');
		meta.textContent = `${new Date(event.timestamp).toLocaleTimeString()} - ${event.level.toUpperCase()} - ${event.source}`;
		const message = document.createElement('span');
		message.textContent = event.message;

		if (event.details) {
			const row = document.createElement('details');
			row.className = `feedback-line feedback-${event.level}`;
			const summary = document.createElement('summary');
			summary.className = 'feedback-summary';
			summary.appendChild(meta);
			summary.appendChild(message);
			const body = document.createElement('pre');
			body.className = 'feedback-details';
			body.textContent = JSON.stringify(event.details, null, 2);
			row.appendChild(summary);
			row.appendChild(body);
			feedbackList.appendChild(row);
		} else {
			const row = document.createElement('div');
			row.className = `feedback-line feedback-${event.level}`;
			row.appendChild(meta);
			row.appendChild(message);
			feedbackList.appendChild(row);
		}
	}
}

async function refreshFeedbackHistory(): Promise<void> {
	renderFeedbackHistory(await getFeedbackHistory());
}

function formatFeedbackForAi(events: DebugEvent[]): string {
	const header = [
		t('# Better AA Developer Experience Debug Log'),
		'',
		`Generated: ${new Date().toISOString()}`,
		`Extension version: ${browser.runtime.getManifest().version}`,
		`Browser target: ${
			import.meta.env.FIREFOX ? 'firefox' : import.meta.env.CHROME ? 'chrome' : 'unknown'
		}`,
		t('Stored entries: {count}', { count: events.length }),
	].join('\n');

	if (!events.length) {
		return `${header}\n\n${t('No debug log.')}`;
	}

	return [
		header,
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

function updateStatusVisibility(): void {
	const shouldHide = currentDebugEnabled && activeTab === 'help' && !isOptionsSurface;
	status.hidden = shouldHide;
	status.setAttribute('aria-hidden', String(shouldHide));
	if (shouldHide) status.textContent = '';
}

function setActiveTab(tab: SidepanelTab, updateHash = true): void {
	activeTab = tab;
	document.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((button) => {
		const active = button.dataset.tab === tab;
		button.classList.toggle('is-active', active);
		button.setAttribute('aria-selected', String(active));
		button.tabIndex = active ? 0 : -1;
	});
	document.querySelectorAll<HTMLElement>('[data-panel]').forEach((panel) => {
		const active = panel.dataset.panel === tab;
		panel.classList.toggle('is-active', active);
		panel.hidden = !active;
	});
	if (
		tab === 'help' &&
		activeHelpSection === 'diagnostics' &&
		currentDebugEnabled &&
		!isOptionsSurface
	) {
		setHealthSection(activeHealthSection);
	}
	if (isOptionsSurface && updateHash) history.replaceState(null, '', `#${tab}`);
	updateStatusVisibility();
}

async function sendBackgroundMessage(message: BackgroundMessage): Promise<void> {
	await browser.runtime.sendMessage(message);
}

async function sendActiveTabMessage(
	message: ContentActionMessage
): Promise<ContentActionResponse> {
	const tabId = getSelectedToolsTargetTabId();
	if (!tabId) return { ok: false, error: t('Select a connected Control Room page first.') };

	try {
		const response = (await browser.tabs.sendMessage(
			tabId,
			message
		)) as ContentActionResponse | undefined;
		return response ?? { ok: true };
	} catch {
		return { ok: false, error: t('Open an Automation Anywhere tab first.') };
	}
}

async function refreshControlRoomCompatibility(forceRefresh = false): Promise<void> {
	if (isOptionsSurface) {
		controlRoomVersionState.textContent = t('Live compatibility requires the side panel.');
		return;
	}
	const requestId = ++controlRoomCompatibilityRequestId;
	controlRoomVersionState.textContent = t('Checking version...');
	try {
		const response = (await browser.runtime.sendMessage({
			type: 'GET_CONTROL_ROOM_COMPATIBILITY',
			forceRefresh,
			tabId: getSelectedToolsTargetTabId(),
		})) as ControlRoomCompatibilityResponse | undefined;
		if (requestId !== controlRoomCompatibilityRequestId) return;
		if (!response?.ok) {
			currentControlRoomCompatibility = null;
			updateControlRoomCompatibilityUi();
			setStatus(
				response?.error || t('Control Room version unavailable.'),
				'warn',
				'userstyle'
			);
			return;
		}
		currentControlRoomCompatibility = response.compatibility;
		updateControlRoomCompatibilityUi();
	} catch (error) {
		if (requestId !== controlRoomCompatibilityRequestId) return;
		currentControlRoomCompatibility = null;
		updateControlRoomCompatibilityUi();
		setStatus(
			error instanceof Error ? error.message : t('Control Room version unavailable.'),
			'warn',
			'userstyle'
		);
	}
}

function updateControlRoomCompatibilityUi(): void {
	const compatibility = currentControlRoomCompatibility;
	const target = formatControlRoomTarget(SUPPORTED_CONTROL_ROOM_TARGET);
	controlRoomVersionAlert.hidden = true;
	controlRoomVersionAlert.textContent = '';

	if (!compatibility) {
		controlRoomVersionState.textContent = t('Version unavailable.');
		controlRoomVersionMeta.textContent = t('Supported target: {target}', { target });
		forceUnsupportedControlRoomRow.hidden = false;
		return;
	}

	const current = formatControlRoomVersion(compatibility.current);
	controlRoomVersionState.textContent = compatibility.supported
		? t('Supported target matched.')
		: compatibility.state === 'unknown'
			? t('Version unavailable.')
			: t('Unsupported target.');
	controlRoomVersionMeta.textContent = t(
		'Current: {current}. Supported target: {target}. Validated build: {build}.',
		{
			current,
			target,
			build: compatibility.target.buildNumber,
		}
	);

	forceUnsupportedControlRoomRow.hidden =
		(compatibility.supported || compatibility.state === 'unknown') &&
		!forceUnsupportedControlRoomStylesInput.checked;
	if (compatibility.supported && compatibility.buildMismatch) {
		controlRoomVersionAlert.hidden = false;
		controlRoomVersionAlert.textContent = t(
			'Build differs from validated build {build}. Styles still load.',
			{ build: compatibility.target.buildNumber }
		);
		return;
	}
	if (compatibility.state === 'unknown') {
		controlRoomVersionAlert.hidden = false;
		controlRoomVersionAlert.textContent = compatibility.message
			? t('Control Room version unavailable: {message}', {
					message: compatibility.message,
				})
			: t('Control Room version unavailable. Styles still load.');
		return;
	}
	if (!compatibility.supported) {
		controlRoomVersionAlert.hidden = false;
		controlRoomVersionAlert.textContent = compatibility.message
			? t('Control Room version unavailable: {message}', {
					message: compatibility.message,
				})
			: t('UI Improvements blocked until target matches or force is enabled.');
	}
	renderSupportedBuilds();
}

const doctorChecklist = document.querySelector<HTMLElement>('#doctorChecklist')!;
const doctorSummary = document.querySelector<HTMLElement>('#doctorSummary')!;
const runDoctorViewButton =
	document.querySelector<HTMLButtonElement>('#runDoctorView')!;
const doctorPills = document.querySelectorAll<HTMLButtonElement>('.doctor-pill');

const helpSubtabs = [...document.querySelectorAll<HTMLButtonElement>('[data-help-section]')];
const helpSubpanels = document.querySelectorAll<HTMLElement>('[data-help-subpanel]');
const healthSubtabs = document.querySelectorAll<HTMLButtonElement>('[data-health-section]');
const healthSubpanels = document.querySelectorAll<HTMLElement>('[data-health-subpanel]');

const HELP_SECTION_ANCHORS: Record<HelpSection, string> = {
	overview: 'help-start',
	commands: 'help-commands',
	compatibility: 'help-compatibility',
	diagnostics: 'help-diagnostics',
};

function setHelpSection(section: HelpSection, updateHash = true): void {
	activeHelpSection = section;
	helpSubtabs.forEach((button) => {
		const active = button.dataset.helpSection === section;
		button.classList.toggle('is-active', active);
		button.setAttribute('aria-selected', String(active));
		button.tabIndex = active ? 0 : -1;
	});
	helpSubpanels.forEach((panel) => {
		panel.hidden = panel.dataset.helpSubpanel !== section;
	});
	if (section === 'diagnostics' && currentDebugEnabled && !isOptionsSurface) {
		setHealthSection(activeHealthSection);
	}
	if (section === 'compatibility') renderSupportedBuilds();
	if (isOptionsSurface && updateHash) {
		history.replaceState(null, '', `#${HELP_SECTION_ANCHORS[section]}`);
	}
}

helpSubtabs.forEach((button) => {
	button.addEventListener('click', () => {
		setHelpSection(button.dataset.helpSection as HelpSection);
	});
});

document.querySelector<HTMLElement>('.help-subtabs')?.addEventListener('keydown', (event) => {
	if (!(event instanceof KeyboardEvent)) return;
	const current = document.activeElement as HTMLButtonElement | null;
	const index = current ? helpSubtabs.indexOf(current) : -1;
	if (index < 0) return;
	let next = index;
	if (event.key === 'ArrowRight') next = (index + 1) % helpSubtabs.length;
	else if (event.key === 'ArrowLeft') next = (index - 1 + helpSubtabs.length) % helpSubtabs.length;
	else if (event.key === 'Home') next = 0;
	else if (event.key === 'End') next = helpSubtabs.length - 1;
	else return;
	event.preventDefault();
	helpSubtabs[next].focus();
	helpSubtabs[next].click();
});

function setHealthSection(section: HealthSection): void {
	activeHealthSection = section;
	healthSubtabs.forEach((button) => {
		const active = button.dataset.healthSection === section;
		button.classList.toggle('is-active', active);
		button.setAttribute('aria-selected', String(active));
	});
	healthSubpanels.forEach((panel) => {
		const active = panel.dataset.healthSubpanel === section;
		panel.hidden = !active;
		panel.setAttribute('aria-hidden', String(!active));
	});
	if (section === 'logs') void refreshFeedbackHistory();
}

healthSubtabs.forEach((button) => {
	button.addEventListener('click', () => {
		setHealthSection(button.dataset.healthSection as HealthSection);
	});
});

const apiHealthList = document.querySelector<HTMLElement>('#apiHealthList')!;
const apiHealthSummary = document.querySelector<HTMLElement>('#apiHealthSummary')!;
const runApiHealthButton =
	document.querySelector<HTMLButtonElement>('#runApiHealth')!;

const HEALTH_STATUS_ICONS: Record<ApiHealthResult['status'], BetterAaIconName> = {
	pass: 'circle-check-big',
	fail: 'circle-x',
	warn: 'triangle-alert',
	skip: 'circle-minus',
};

function renderApiHealthResults(results: ApiHealthResult[]): void {
	apiHealthList.textContent = '';
	for (const result of results) {
		const row = document.createElement('details');
		row.className = `doctor-check-row doctor-status-${result.status}`;

		const summary = document.createElement('summary');
		summary.className = 'doctor-check-summary';
		const icon = document.createElement('span');
		icon.className = 'doctor-check-icon';
		setSidepanelIconContent(icon, HEALTH_STATUS_ICONS[result.status]);
		const label = document.createElement('span');
		label.className = 'doctor-check-label';
		label.textContent = result.label;
		const meta = document.createElement('span');
		meta.className = 'doctor-check-meta';
		meta.textContent = [result.method, result.status, result.reason].join(' · ');
		summary.appendChild(icon);
		summary.appendChild(label);
		summary.appendChild(meta);

		const body = document.createElement('pre');
		body.className = 'doctor-check-details';
		body.textContent = [
			`${t('Feature')}: ${result.feature}`,
			`${t('Endpoint')}: ${result.method} ${result.path}`,
			`${t('Status')}: ${result.status}`,
			`HTTP: ${result.httpStatus ?? t('Not checked')}`,
			`${t('Reason')}: ${result.reason}`,
		].join('\n');

		row.appendChild(summary);
		row.appendChild(body);
		apiHealthList.appendChild(row);
	}

	const counts = { pass: 0, fail: 0, warn: 0, skip: 0 };
	for (const result of results) counts[result.status]++;
	apiHealthSummary.textContent = t('{pass} pass, {fail} fail, {warn} warn, {skip} skip', counts);
}

async function runApiHealthScan(): Promise<void> {
	runApiHealthButton.disabled = true;
	apiHealthSummary.textContent = t('Scanning...');
	try {
		const active = await getActiveAutomationAnywhereContext();
		let results: ApiHealthResult[];
		if (!active || !active.context.baseUrl || active.context.pageType === 'unsupported') {
			results = skipAllApiHealthChecks(t('Open an Automation Anywhere page.'));
		} else {
			const authToken = await getAutomationAnywhereAuthToken(active.tabId);
			const api = new AutomationAnywhereApi(active.context.baseUrl, authToken);
			results = await runApiHealthChecks(api, active.context);
		}
		renderApiHealthResults(results);
		await apiHealthLastResults.setValue(results);
	} catch (error) {
		apiHealthSummary.textContent =
			error instanceof Error ? error.message : t('API health scan failed.');
	} finally {
		runApiHealthButton.disabled = false;
	}
}

runApiHealthButton.addEventListener('click', () => {
	void runApiHealthScan();
});

void apiHealthLastResults.getValue().then((saved) => {
	if (saved?.length) renderApiHealthResults(saved);
});

function getHealthChecksForView(group: DoctorCheckGroup): StyleDoctorCheck[] {
	if (group !== 'taskbot-editor') return getChecksForGroup(group);
	return [...getChecksForGroup(group), ...getChecksForGroup('taskbot-transient')];
}

function renderDoctorChecklist(): void {
	const comparison = currentDoctorResults.length
		? compareResults(previousDoctorResults, currentDoctorResults)
		: [];

	doctorChecklist.textContent = '';

	const mainChecks = getChecksForGroup(currentDoctorView);
	const transientChecks = currentDoctorView === 'taskbot-editor'
		? getChecksForGroup('taskbot-transient')
		: [];

	function renderCheckRow(check: StyleDoctorCheck): HTMLElement {
		const row = document.createElement('details');
		row.className = 'doctor-check-row';
		row.dataset.checkId = check.id;

		const comp = comparison.find((c) => c.id === check.id);
		if (comp) {
			row.classList.add(`doctor-status-${comp.currentStatus}`);
			if (comp.delta === 'fixed') row.classList.add('doctor-delta-fixed');
			if (comp.delta === 'regressed') row.classList.add('doctor-delta-regressed');
		}

		const summary = document.createElement('summary');
		summary.className = 'doctor-check-summary';

		const icon = document.createElement('span');
		icon.className = 'doctor-check-icon';
		if (comp) {
			setSidepanelIconContent(icon, HEALTH_STATUS_ICONS[comp.currentStatus]);
		} else {
			setSidepanelIconContent(icon, 'circle-minus');
		}

		const label = document.createElement('span');
		label.className = 'doctor-check-label';
		label.textContent = check.label;

		const meta = document.createElement('span');
		meta.className = 'doctor-check-meta';
		const parts = [check.severity, check.selectorStatus, check.source];
		if (check.triggerHint && check.severity === 'transient') {
			parts.push(check.triggerHint);
		}
		if (comp && comp.currentStatus !== 'pass' && comp.currentStatus !== 'skip') {
			const result = currentDoctorResults.find((r) => r.id === check.id);
			if (result?.reason) parts.push(result.reason);
		}
		meta.textContent = parts.join(' \u00B7 ');

		summary.appendChild(icon);
		summary.appendChild(label);
		summary.appendChild(meta);

		const body = document.createElement('pre');
		body.className = 'doctor-check-details';
		const result = currentDoctorResults.find((r) => r.id === check.id);
		const detailLines = [
			`${t('Feature')}: ${check.feature}`,
			`${t('Selector')}: ${check.selector}`,
			`${t('Source')}: ${check.source}`,
			`${t('Severity')}: ${check.severity}`,
			`${t('Selector status')}: ${check.selectorStatus}`,
			`${t('Status')}: ${result?.status ?? t('Not checked')}`,
			`${t('Count')}: ${result?.count ?? 0}`,
		];
		if (check.triggerHint) detailLines.push(`${t('Trigger')}: ${check.triggerHint}`);
		if (check.notes) detailLines.push(`${t('Notes')}: ${check.notes}`);
		if (result?.reason) detailLines.push(`${t('Reason')}: ${result.reason}`);
		body.textContent = detailLines.join('\n');

		row.appendChild(summary);
		row.appendChild(body);
		return row;
	}

	for (const check of mainChecks) {
		doctorChecklist.appendChild(renderCheckRow(check));
	}

	if (transientChecks.length) {
		const details = document.createElement('details');
		details.className = 'doctor-transient-group';
		details.open = true;

		const summary = document.createElement('summary');
		summary.textContent = t('Taskbot transient items');

		const list = document.createElement('div');
		list.className = 'doctor-transient-list';
		for (const check of transientChecks) {
			list.appendChild(renderCheckRow(check));
		}

		details.appendChild(summary);
		details.appendChild(list);
		doctorChecklist.appendChild(details);
	}
}

function updateDoctorSummary(): void {
	if (!currentDoctorResults.length) {
		doctorSummary.textContent = '';
		return;
	}
	const pass = currentDoctorResults.filter((r) => r.status === 'pass').length;
	const fail = currentDoctorResults.filter((r) => r.status === 'fail').length;
	const warn = currentDoctorResults.filter((r) => r.status === 'warn').length;
	const skip = currentDoctorResults.filter((r) => r.status === 'skip').length;
	doctorSummary.textContent = `${pass} pass, ${fail} fail, ${warn} warn, ${skip} skip`;
}

async function runDoctorViewScan(): Promise<void> {
	if (doctorRunning) return;
	doctorRunning = true;
	runDoctorViewButton.disabled = true;
	setSidepanelIconButtonContent(runDoctorViewButton, 'activity', t('Scanning...'));

	const checks = getHealthChecksForView(currentDoctorView);
	const results: StyleDoctorCheckResult[] = [];

	for (const check of checks) {
		const response = await sendActiveTabMessage({
			type: 'RUN_STYLE_DOCTOR_CHECK',
			checkId: check.id,
		});
		const result = response.ok ? response.doctorCheckResult : null;
		if (result) {
			results.push(result);
			currentDoctorResults = results;
			renderDoctorChecklist();
			updateDoctorSummary();
		}
		await new Promise((r) => setTimeout(r, 100));
	}

	previousDoctorResults = results.length ? [...results] : previousDoctorResults;
	currentDoctorResults = results;
	renderDoctorChecklist();
	updateDoctorSummary();

	const allResults = (await styleDoctorLastResults.getValue()) ?? {};
	allResults[currentDoctorView] = results;
	await styleDoctorLastResults.setValue(allResults);

	const pass = results.filter((r) => r.status === 'pass').length;
	const fail = results.filter((r) => r.status === 'fail').length;
	const warn = results.filter((r) => r.status === 'warn').length;
	const skip = results.filter((r) => r.status === 'skip').length;

	await addFeedback(
		fail > 0 ? 'warn' : 'info',
		'health',
		`Health ${currentDoctorView}: ${pass} pass, ${fail} fail, ${warn} warn, ${skip} skip.`,
		{
			view: currentDoctorView,
			results: results.map((r) => ({ id: r.id, status: r.status, severity: r.severity })),
		},
		{ keepDetails: true }
	);
	await refreshFeedbackHistory();

	runDoctorViewButton.disabled = false;
	setSidepanelIconButtonContent(runDoctorViewButton, 'play', t('Run Checks'));
	doctorRunning = false;
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
	replaceChildrenFromHtml(aboutHelp, renderHelpHtml({
		commands: Object.values(getCommandHelp()),
		shortcutLabel: getCommandPaletteShortcutLabel(shortcut),
		sidebarShortcutLabel: currentExtensionShortcuts.openSidebar,
	}));
	renderLucideIcons(aboutHelp);
}

async function refreshAboutHelp(): Promise<void> {
	const response = await sendActiveTabMessage({ type: 'GET_HELP_HTML' });
	if (response.ok && response.html) {
		replaceChildrenFromHtml(aboutHelp, response.html);
		renderLucideIcons(aboutHelp);
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
	if (request.tab === 'help') {
		renderDoctorChecklist();
		renderSupportedBuilds();
		setHealthSection(activeHealthSection);
	}
	if (request.focus === 'actionJson') focusActionJsonTextarea();
	if (request.focus === 'jobs') openToolsJobs();
	if (request.focus === 'diagnostics') {
		setHelpSection('diagnostics');
		setHealthSection('health');
	}

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

function setActionJsonValue(json: string): void {
	actionJsonWorkbench.setValue(json);
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

function parseColorValue(value: string): { hex: string; alpha: number } {
	const parsed = parseCssColorValue(clampBackgroundColorValue(value));
	if (parsed) {
		const { red, green, blue } = parsed.rgb;
		return { hex: `#${toHex(red)}${toHex(green)}${toHex(blue)}`, alpha: parsed.alpha };
	}

	return { hex: '#a0a0a0', alpha: 1 };
}

function colorControlsToRgba(key: StyleValueKey): string {
	const colorInput = getStyleValueInput(key) as HTMLInputElement;
	const opacityInput = getStyleOpacityInput(key);
	const rgb = hexToRgb(colorInput.value);
	const alpha = Number(opacityInput.value);
	return clampBackgroundColorValue(formatRgba(rgb, alpha));
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
	if (
		forceUnsupportedControlRoomStylesInput.checked !==
		DEFAULT_FORCE_UNSUPPORTED_CONTROL_ROOM_STYLES
	) {
		return false;
	}
	if (botExecutionModalPositionSelect.value !== DEFAULT_BOT_EXECUTION_MODAL_POSITION) {
		return false;
	}
	if (runButtonWavesInput.checked !== DEFAULT_RUN_BUTTON_WAVES) return false;
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
	updateRunButtonWavesState();
	updateRestoreDefaultsButton();
}

function updateRunButtonWavesState(): void {
	const disabled = !stylesInput.checked || !getStyleFeatureInput('runButton').checked;
	runButtonWavesRow.classList.toggle('is-disabled', disabled);
	runButtonWavesInput.disabled = disabled;
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
		keepAlive,
		paletteEnabled,
		blockTaskbotClicks,
		forceEnglish,
		forceUnsupported,
		language,
		debug,
		shortcut,
		sidebarShortcut,
		botModalPosition,
		waves,
		styleFeatures,
		styleValues,
		recorderEnabled,
		recorderPort,
		recorderToken,
		jobNotifications,
		gettingStarted,
	] = await Promise.all([
		getStylesEnabled(),
		getSoundsEnabled(),
		getShowSuggestions(),
		getKeepAliveEnabled(),
		getCommandPaletteEnabled(),
		getBlockTaskbotNodeLabelClicks(),
		getForceEnglishLocale(),
		getForceUnsupportedControlRoomStyles(),
		getExtensionLanguage(),
		getDebugEnabled(),
		getCommandPaletteShortcut(),
		getOpenSidebarShortcut(),
		getBotExecutionModalPosition(),
		getRunButtonWavesEnabled(),
		getStyleFeatureValues(),
		getStyleValues(),
		getRecorderBridgeEnabled(),
		getRecorderBridgePort(),
		getRecorderBridgeToken(),
		getBackgroundJobNotificationsEnabled(),
		getGettingStartedGuidanceEnabled(),
	]);

	stylesInput.checked = styles;
	soundsInput.checked = sounds;
	showSuggestionsInput.checked = suggestions;
	keepAliveEnabledInput.checked = keepAlive;
	commandPaletteEnabledInput.checked = paletteEnabled;
	blockTaskbotNodeLabelClicksInput.checked = blockTaskbotClicks;
	forceEnglishLocaleInput.checked = forceEnglish;
	forceUnsupportedControlRoomStylesInput.checked = forceUnsupported;
	extensionLanguageSelect.value = language;
	debugInput.checked = debug;
	currentDebugEnabled = debug;
	updateDebugVisibility();
	shortcutSelect.value = shortcut;
	currentShortcut = shortcut;
	updateShortcutLabel(shortcut);
	openSidebarShortcutSelect.value = sidebarShortcut;
	currentOpenSidebarShortcut = sidebarShortcut;
	updateOpenSidebarShortcutLabel(sidebarShortcut);
	botExecutionModalPositionSelect.value = botModalPosition;
	runButtonWavesInput.checked = waves;
	await refreshExtensionShortcuts();
	renderStaticAboutHelp(shortcut);

	STYLE_FEATURES.forEach((feature) => {
		getStyleFeatureInput(feature.key).checked = styleFeatures[feature.key];
	});

	STYLE_VALUE_FIELDS.forEach((field) => {
		setStyleValueControl(field.key, styleValues[field.key]);
	});
	updateUserstyleDependentState();
	await refreshControlRoomCompatibility();
	await refreshSlotStates();
	await refreshFeedbackHistory();
	renderSupportedBuilds();
	packageUpdateToastEnabledInput.checked = await getPackageUpdateToastEnabled();
	nonClosingMessageBoxWarningEnabledInput.checked =
		await getNonClosingMessageBoxWarningEnabled();
	browserContextMenuEnabledInput.checked = await getBrowserContextMenuEnabled();
	chunkedClipboardPasteEnabledInput.checked = await getChunkedClipboardPasteEnabled();
	variableMetadataEnabledInput.checked = await getVariableMetadataEnabled();
	recorderBridgeEnabledInput.checked = recorderEnabled;
	updateRecorderBridgeDependentState();
	recorderBridgePortInput.value = String(recorderPort);
	recorderBridgeTokenInput.value = recorderToken;
	backgroundJobNotificationsEnabledInput.checked = jobNotifications;
	gettingStartedGuidanceEnabledInput.checked = gettingStarted;
	document.querySelector<HTMLElement>('#help-start')!.hidden = !gettingStarted;
	const savedDoctorResults = (await styleDoctorLastResults.getValue()) ?? {};
	previousDoctorResults = savedDoctorResults[currentDoctorView] ?? null;
	void debugInfo('sidepanel', 'Sidebar state loaded.', {
		styles,
		sounds,
		suggestions,
		keepAlive,
		paletteEnabled,
		blockTaskbotClicks,
		forceEnglish,
		forceUnsupported,
		debug,
	});
}

document.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((button) => {
	button.addEventListener('click', () => {
		const tab = button.dataset.tab as SidepanelTab;
		setActiveTab(tab);
		if (tab === 'help') void refreshAboutHelp();
		if (tab === 'appearance') void refreshControlRoomCompatibility();
		if (tab === 'help') {
			renderDoctorChecklist();
			renderSupportedBuilds();
			setHealthSection(activeHealthSection);
		}
	});
});

const primaryTabs = [...document.querySelectorAll<HTMLButtonElement>('[data-tab]')];
document.querySelector<HTMLElement>('.tab-list')?.addEventListener('keydown', (event) => {
	if (!(event instanceof KeyboardEvent)) return;
	const current = document.activeElement as HTMLButtonElement | null;
	const index = current ? primaryTabs.indexOf(current) : -1;
	if (index < 0) return;
	let next = index;
	if (event.key === 'ArrowRight') next = (index + 1) % primaryTabs.length;
	else if (event.key === 'ArrowLeft') next = (index - 1 + primaryTabs.length) % primaryTabs.length;
	else if (event.key === 'Home') next = 0;
	else if (event.key === 'End') next = primaryTabs.length - 1;
	else return;
	event.preventDefault();
	primaryTabs[next].focus();
	primaryTabs[next].click();
});

document.querySelector<HTMLButtonElement>('#openFullSettings')?.addEventListener('click', () => {
	void browser.runtime.openOptionsPage();
});

type UndoableControl = HTMLInputElement | HTMLSelectElement;
const priorControlValues = new WeakMap<UndoableControl, string | boolean>();
const undoNotice = document.querySelector<HTMLElement>('#undoNotice')!;
const undoSettingButton = document.querySelector<HTMLButtonElement>('#undoSetting')!;
let undoTimer: ReturnType<typeof setTimeout> | null = null;
let undoAction: (() => void) | null = null;
let applyingUndo = false;
let undoStorageKey = '';
let ignoreNextUndoStorageChange = false;

function expireUndo(): void {
	if (undoTimer) clearTimeout(undoTimer);
	undoTimer = null;
	undoAction = null;
	undoStorageKey = '';
	ignoreNextUndoStorageChange = false;
	undoNotice.hidden = true;
}

function readControlValue(control: UndoableControl): string | boolean {
	return control instanceof HTMLInputElement && control.type === 'checkbox'
		? control.checked
		: control.value;
}

function rememberControlValue(event: Event): void {
	const control = (event.target as Element | null)?.closest<UndoableControl>('input, select');
	if (!control || control.type === 'file' || control.id === 'recorderBridgeToken') return;
	priorControlValues.set(control, readControlValue(control));
}

document.addEventListener('pointerdown', rememberControlValue, true);
document.addEventListener('focusin', rememberControlValue, true);
document.addEventListener('change', (event) => {
	if (applyingUndo) return;
	const control = event.target as UndoableControl | null;
	if (!control || !(control instanceof HTMLInputElement || control instanceof HTMLSelectElement)) return;
	if (control.type === 'file' || control.id === 'extensionLanguage' || control.id === 'recorderBridgeToken') return;
	const previous = priorControlValues.get(control);
	if (previous === undefined || previous === readControlValue(control)) return;
	undoStorageKey = control.id.replace(/^styleOpacity-/, 'styleValue-');
	ignoreNextUndoStorageChange = true;
	const row = control.closest<HTMLElement>('.setting-row, .select-row, .color-row');
	let saved = row?.querySelector<HTMLElement>('.save-state');
	if (row && !saved) {
		saved = document.createElement('span');
		saved.className = 'save-state';
		row.insertBefore(saved, row.lastElementChild);
	}
	if (saved) saved.textContent = t('Saved');
	undoAction = () => {
		applyingUndo = true;
		if (control instanceof HTMLInputElement && control.type === 'checkbox') {
			control.checked = Boolean(previous);
		} else {
			control.value = String(previous);
		}
		control.dispatchEvent(new Event('change', { bubbles: true }));
		applyingUndo = false;
		priorControlValues.set(control, readControlValue(control));
		expireUndo();
	};
	undoNotice.hidden = false;
	if (undoTimer) clearTimeout(undoTimer);
	undoTimer = setTimeout(() => {
		expireUndo();
	}, 8000);
});
undoSettingButton.addEventListener('click', () => undoAction?.());

browser.storage.onChanged.addListener((changes) => {
	const change = changes[undoStorageKey];
	if (!change) return;
	if (ignoreNextUndoStorageChange) {
		ignoreNextUndoStorageChange = false;
		return;
	}
	expireUndo();
});

document.querySelector<HTMLInputElement>('#helpSearch')?.addEventListener('input', (event) => {
	const query = (event.currentTarget as HTMLInputElement).value.trim().toLowerCase();
	document.querySelectorAll<HTMLElement>('#aboutHelp [data-help-card]').forEach((card) => {
		card.hidden = Boolean(query) && !card.textContent?.toLowerCase().includes(query);
	});
});

document.querySelector<HTMLButtonElement>('#dismissGettingStarted')?.addEventListener('click', () => {
	void gettingStartedGuidanceEnabled.setValue(false);
});

gettingStartedGuidanceEnabled.watch((enabled) => {
	gettingStartedGuidanceEnabledInput.checked = enabled ?? DEFAULT_GETTING_STARTED_GUIDANCE_ENABLED;
	document.querySelector<HTMLElement>('#help-start')!.hidden = !gettingStartedGuidanceEnabledInput.checked;
});

backgroundJobNotificationsEnabled.watch((enabled) => {
	backgroundJobNotificationsEnabledInput.checked = enabled ?? DEFAULT_BACKGROUND_JOB_NOTIFICATIONS_ENABLED;
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

packageUpdateToastEnabledInput.addEventListener('change', () => {
	// Storage watch in the content script picks this up; no message needed.
	void packageUpdateToastEnabled.setValue(packageUpdateToastEnabledInput.checked);
});

backgroundJobNotificationsEnabledInput.addEventListener('change', () => {
	const requested = backgroundJobNotificationsEnabledInput.checked;
	const permissionRequest = requested
		? browser.permissions.request({ permissions: ['notifications'] })
		: Promise.resolve(false);
	void permissionRequest.then(async (granted) => {
		if (requested && !granted) {
			backgroundJobNotificationsEnabledInput.checked = false;
			await backgroundJobNotificationsEnabled.setValue(false);
			expireUndo();
			setStatus(t('Notification permission was denied. Enable it in the extension permissions and try again.'), 'warn', 'settings');
			return;
		}
		await backgroundJobNotificationsEnabled.setValue(requested);
	});
});

gettingStartedGuidanceEnabledInput.addEventListener('change', () => {
	void gettingStartedGuidanceEnabled.setValue(gettingStartedGuidanceEnabledInput.checked);
});

browser.permissions.onRemoved.addListener((permissions) => {
	if (!permissions.permissions?.includes('notifications')) return;
	backgroundJobNotificationsEnabledInput.checked = false;
	void backgroundJobNotificationsEnabled.setValue(false);
	setStatus(t('Notification permission was removed. Background job notifications are off.'), 'warn', 'settings');
});

variableMetadataEnabledInput.addEventListener('change', () => {
	void variableMetadataEnabled.setValue(variableMetadataEnabledInput.checked);
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

keepAliveEnabledInput.addEventListener('change', () => {
	void sendBackgroundMessage({
		type: 'SET_KEEP_ALIVE_ENABLED',
		enabled: keepAliveEnabledInput.checked,
	});
	setStatus(
		keepAliveEnabledInput.checked
			? t('Keep-alive enabled.')
			: t('Keep-alive disabled.'),
		'info',
		'settings'
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
		'userstyle'
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

nonClosingMessageBoxWarningEnabledInput.addEventListener('change', () => {
	void nonClosingMessageBoxWarningEnabled.setValue(
		nonClosingMessageBoxWarningEnabledInput.checked
	);
});

browserContextMenuEnabledInput.addEventListener('change', () => {
	void browserContextMenuEnabled.setValue(browserContextMenuEnabledInput.checked);
});

chunkedClipboardPasteEnabledInput.addEventListener('change', () => {
	void chunkedClipboardPasteEnabled.setValue(
		chunkedClipboardPasteEnabledInput.checked
	);
});

recorderBridgeEnabledInput.addEventListener('change', () => {
	updateRecorderBridgeDependentState();
	void recorderBridgeEnabled.setValue(recorderBridgeEnabledInput.checked);
});
recorderBridgePortInput.addEventListener('change', () => {
	const port = Number(recorderBridgePortInput.value);
	const value = Number.isInteger(port) && port > 0 && port < 65536
		? port
		: DEFAULT_RECORDER_BRIDGE_PORT;
	recorderBridgePortInput.value = String(value);
	void recorderBridgePort.setValue(value);
});
recorderBridgeTokenInput.addEventListener('change', () => {
	void recorderBridgeToken.setValue(recorderBridgeTokenInput.value);
});

forceUnsupportedControlRoomStylesInput.addEventListener('change', () => {
	updateRestoreDefaultsButton();
	void sendBackgroundMessage({
		type: 'SET_FORCE_UNSUPPORTED_CONTROL_ROOM_STYLES',
		enabled: forceUnsupportedControlRoomStylesInput.checked,
	});
	setStatus(
		forceUnsupportedControlRoomStylesInput.checked
			? t('Unsupported Control Room styles forced on.')
			: t('Unsupported Control Room styles force disabled.'),
		'warn',
		'userstyle'
	);
});

refreshControlRoomVersionButton.addEventListener('click', () => {
	void refreshControlRoomCompatibility(true);
});

function shouldRefreshBuildCheckerForActiveView(): boolean {
	return activeTab === 'help' && activeHelpSection === 'compatibility' && !isOptionsSurface;
}

let buildCheckerRefreshTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleBuildCheckerRefresh(): void {
	if (!shouldRefreshBuildCheckerForActiveView()) return;
	if (buildCheckerRefreshTimer) clearTimeout(buildCheckerRefreshTimer);
	buildCheckerRefreshTimer = setTimeout(() => {
		buildCheckerRefreshTimer = null;
		if (!shouldRefreshBuildCheckerForActiveView()) return;
		void refreshControlRoomCompatibility(false).then(renderSupportedBuilds);
	}, 250);
}

browser.runtime.onMessage.addListener((message: RuntimeMessage, sender) => {
	if (message.type !== 'AA_ROUTE_CHANGED') return;
	if (sender.tab?.id !== undefined) {
		void markToolsTargetRouteChanged(
			sender.tab.id,
			message.url,
			sender.tab.windowId,
			sender.tab.active
		);
	}
	scheduleBuildCheckerRefresh();
});

browser.tabs.onActivated.addListener(({ tabId, windowId }) => {
	void handleToolsTabActivated(tabId, windowId);
});

browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
	if (changeInfo.url) {
		void markToolsTargetRouteChanged(tabId, changeInfo.url, tab.windowId, tab.active);
	}
});

browser.tabs.onRemoved.addListener((tabId, removeInfo) => {
	void markToolsTargetDisconnected(tabId, removeInfo.windowId);
});

doctorPills.forEach((pill) => {
	pill.addEventListener('click', async () => {
		currentDoctorView = pill.dataset.doctorView as DoctorCheckGroup;
		doctorPills.forEach((p) => p.classList.toggle('is-active', p === pill));
		const saved = (await styleDoctorLastResults.getValue()) ?? {};
		currentDoctorResults = saved[currentDoctorView] ?? [];
		previousDoctorResults = currentDoctorResults.length ? currentDoctorResults : null;
		renderDoctorChecklist();
		updateDoctorSummary();
	});
});

runDoctorViewButton.addEventListener('click', () => {
	void runDoctorViewScan();
});

const supportedBuildsList = document.querySelector<HTMLElement>('#supportedBuildsList')!;
const buildCandidate = document.querySelector<HTMLElement>('#buildCandidate')!;
const buildCandidateMessage = document.querySelector<HTMLElement>('#buildCandidateMessage')!;
const buildCandidateSnippet = document.querySelector<HTMLElement>('#buildCandidateSnippet')!;
const copyBuildCandidateButton = document.querySelector<HTMLButtonElement>('#copyBuildCandidate')!;

function renderSupportedBuilds(): void {
	supportedBuildsList.textContent = '';
	for (const build of SUPPORTED_CONTROL_ROOM_TARGETS) {
		const row = document.createElement('div');
		row.className = 'supported-build-row';
		const isCurrent =
			currentControlRoomCompatibility?.supported &&
			!currentControlRoomCompatibility.buildMismatch &&
			currentControlRoomCompatibility.target === build;
		row.classList.toggle('is-current-match', Boolean(isCurrent));
		const label = document.createElement('span');
		label.textContent = `${build.versionNumber} ${build.versionRelease} build ${build.buildNumber} product ${build.productVersion}`;
		row.appendChild(label);
		if (isCurrent) {
			const marker = document.createElement('span');
			marker.className = 'supported-build-marker';
			marker.textContent = t('current');
			row.appendChild(marker);
		}
		supportedBuildsList.appendChild(row);
	}
	updateBuildCandidate();
}

function updateBuildCandidate(): void {
	const compat = currentControlRoomCompatibility;
	if (!compat?.current || compat.state === 'unknown') {
		buildCandidate.hidden = true;
		return;
	}
	const showCandidate = !compat.supported || compat.buildMismatch;
	buildCandidate.hidden = !showCandidate;
	if (!showCandidate) return;

	buildCandidateMessage.textContent = !compat.supported
		? t('Unsupported Control Room detected. Review before adding to source.')
		: t('Validated build differs. Review before updating source.');
	const current = compat.current;
	const snippet = `{\n  versionNumber: '${String(current.versionNumber ?? '')}',\n  versionRelease: '${String(current.versionRelease ?? '')}',\n  buildNumber: '${String(current.buildNumber ?? '')}',\n  productVersion: '${String(current.productVersion ?? SUPPORTED_CONTROL_ROOM_TARGET.productVersion)}',\n}`;
	buildCandidateSnippet.textContent = snippet;
}

copyBuildCandidateButton.addEventListener('click', () => {
	const snippet = buildCandidateSnippet.textContent;
	if (!snippet) return;
	void navigator.clipboard.writeText(snippet).then(() => {
		setStatus(t('Candidate copied to clipboard.'), 'info', 'health');
	}).catch(() => {
		setStatus(t('Copy failed.'), 'error', 'health');
	});
});

extensionLanguageSelect.addEventListener('change', () => {
	const language = normalizeExtensionLanguage(
		extensionLanguageSelect.value
	) as LanguagePreference;
	extensionLanguageSelect.value = language;
	setActiveLanguagePreference(language);
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
	updateDebugVisibility();
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
		if (feature.key === 'runButton') updateRunButtonWavesState();
		if (feature.key === 'minimizeBotModal') updateBotExecutionModalPositionState();
		updateRestoreDefaultsButton();
		void sendBackgroundMessage({
			type: 'SET_STYLE_FEATURE',
			key: feature.key,
			enabled: input.checked,
		});
	});
});

runButtonWavesInput.addEventListener('change', () => {
	updateRestoreDefaultsButton();
	void sendBackgroundMessage({
		type: 'SET_RUN_BUTTON_WAVES',
		enabled: runButtonWavesInput.checked,
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
	if (!window.confirm(t('Reset the background and loading gradient colors?'))) return;
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
	if (!window.confirm(t('Restore all Appearance settings to their defaults?'))) return;
	stylesInput.checked = DEFAULT_STYLES_ENABLED;
	forceUnsupportedControlRoomStylesInput.checked =
		DEFAULT_FORCE_UNSUPPORTED_CONTROL_ROOM_STYLES;
	botExecutionModalPositionSelect.value = DEFAULT_BOT_EXECUTION_MODAL_POSITION;
	runButtonWavesInput.checked = DEFAULT_RUN_BUTTON_WAVES;
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
			type: 'SET_FORCE_UNSUPPORTED_CONTROL_ROOM_STYLES',
			enabled: DEFAULT_FORCE_UNSUPPORTED_CONTROL_ROOM_STYLES,
		}),
		sendBackgroundMessage({
			type: 'SET_BOT_EXECUTION_MODAL_POSITION',
			position: DEFAULT_BOT_EXECUTION_MODAL_POSITION,
		}),
		sendBackgroundMessage({
			type: 'SET_RUN_BUTTON_WAVES',
			enabled: DEFAULT_RUN_BUTTON_WAVES,
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

function setClipboardPasteButtonsDisabled(disabled: boolean): void {
	document.querySelectorAll<HTMLButtonElement>('[data-paste-slot]').forEach((button) => {
		button.disabled = disabled;
	});
}

async function pasteClipboardSlot(slot: number): Promise<void> {
	const label = getClipboardSlotLabel(slot);
	let seconds = 0;
	let response: ContentActionResponse = { ok: false, error: t('Action failed.') };
	setClipboardPasteButtonsDisabled(true);
	showStatusMessage(
		t('Preparing {label} paste... {seconds}s', { label, seconds }),
		'info'
	);
	const timer = window.setInterval(() => {
		seconds += 1;
		showStatusMessage(
			t('Preparing {label} paste... {seconds}s', { label, seconds }),
			'info'
		);
	}, 1000);
	try {
		response =
			slot === DEFAULT_UNIVERSAL_CLIPBOARD_SLOT
				? await sendActiveTabMessage({ type: 'UNIVERSAL_PASTE' })
				: await sendActiveTabMessage({ type: 'PASTE_FROM_SLOT', slot });
	} finally {
		window.clearInterval(timer);
		setClipboardPasteButtonsDisabled(false);
	}
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
		button.disabled = true;
		try {
			await copyClipboardSlot(Number(button.dataset.copySlot));
		} finally {
			button.disabled = false;
		}
	});
});

document.querySelectorAll<HTMLButtonElement>('[data-paste-slot]').forEach((button) => {
	button.addEventListener('click', async () => {
		button.disabled = true;
		try {
			await pasteClipboardSlot(Number(button.dataset.pasteSlot));
		} finally {
			button.disabled = false;
		}
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
	void clearFeedback().then(async () => {
		await refreshFeedbackHistory();
		showStatusMessage(t('Debug log cleared.'), 'info');
	});
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
	const json = actionJsonWorkbench.getValue().trim();
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
packageUpdateToastEnabled.watch((value) => {
	packageUpdateToastEnabledInput.checked =
		value ?? DEFAULT_PACKAGE_UPDATE_TOAST_ENABLED;
});
variableMetadataEnabled.watch((value) => {
	variableMetadataEnabledInput.checked = value ?? DEFAULT_VARIABLE_METADATA_ENABLED;
});
showSuggestions.watch((value) => {
	showSuggestionsInput.checked = value ?? DEFAULT_SHOW_SUGGESTIONS;
});
keepAliveEnabled.watch((value) => {
	keepAliveEnabledInput.checked = value ?? DEFAULT_KEEP_ALIVE_ENABLED;
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
nonClosingMessageBoxWarningEnabled.watch((value) => {
	nonClosingMessageBoxWarningEnabledInput.checked =
		value ?? DEFAULT_NON_CLOSING_MESSAGE_BOX_WARNING_ENABLED;
});
browserContextMenuEnabled.watch((value) => {
	browserContextMenuEnabledInput.checked = value ?? DEFAULT_BROWSER_CONTEXT_MENU_ENABLED;
});
chunkedClipboardPasteEnabled.watch((value) => {
	chunkedClipboardPasteEnabledInput.checked =
		value ?? DEFAULT_CHUNKED_CLIPBOARD_PASTE_ENABLED;
});
recorderBridgeEnabled.watch((value) => {
	recorderBridgeEnabledInput.checked = value ?? DEFAULT_RECORDER_BRIDGE_ENABLED;
	updateRecorderBridgeDependentState();
});
recorderBridgePort.watch((value) => {
	recorderBridgePortInput.value = String(value ?? DEFAULT_RECORDER_BRIDGE_PORT);
});
recorderBridgeToken.watch((value) => {
	recorderBridgeTokenInput.value = value ?? '';
});
forceUnsupportedControlRoomStyles.watch((value) => {
	forceUnsupportedControlRoomStylesInput.checked =
		value ?? DEFAULT_FORCE_UNSUPPORTED_CONTROL_ROOM_STYLES;
	updateRestoreDefaultsButton();
});
extensionLanguage.watch((value) => {
	const language = normalizeExtensionLanguage(value);
	extensionLanguageSelect.value = language;
});
debugEnabled.watch((value) => {
	currentDebugEnabled = value ?? DEFAULT_DEBUG_ENABLED;
	debugInput.checked = currentDebugEnabled;
	updateDebugVisibility();
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
runButtonWaves.watch((value) => {
	runButtonWavesInput.checked = value ?? DEFAULT_RUN_BUTTON_WAVES;
	updateRunButtonWavesState();
	updateRestoreDefaultsButton();
});
STYLE_FEATURES.forEach((feature) => {
	styleFeatureItems[feature.key].watch((value) => {
		getStyleFeatureInput(feature.key).checked = value ?? feature.defaultValue;
		if (feature.key === 'runButton') updateRunButtonWavesState();
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

if (!isOptionsSurface) {
	sidepanelRequest.watch((value) => {
		void handleSidepanelRequest(value);
	});
}

if (!isOptionsSurface) initializeToolsPanel({ setStatus, addFeedback });
if (isOptionsSurface) {
	const openHashTab = (): void => {
		const anchor = location.hash.slice(1);
		const helpSection: HelpSection | null =
			anchor === 'help' || anchor === 'help-start' || anchor === 'help-about' || anchor === 'help-overview'
				? 'overview'
				: anchor === 'help-commands'
					? 'commands'
					: anchor === 'help-compatibility'
						? 'compatibility'
						: anchor === 'help-diagnostics'
							? 'diagnostics'
							: null;
		const tab: SidepanelTab = anchor === 'settings' || anchor.startsWith('settings-')
			? 'settings'
			: helpSection
				? 'help'
				: 'appearance';
		setActiveTab(tab, false);
		if (helpSection) setHelpSection(helpSection, false);
		if (anchor !== tab) requestAnimationFrame(() => document.getElementById(anchor)?.scrollIntoView());
	};
	window.addEventListener('hashchange', openHashTab);
	openHashTab();
}
void loadState();
if (!isOptionsSurface) void sidepanelRequest.getValue().then(handleSidepanelRequest);
})();
