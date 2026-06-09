import {
	AutomationAnywhereApi,
	AUTOMATION_ANYWHERE_TASKBOT_TYPE,
	applyPackageVersionsToContent,
	automationAnywhereBlobResponseToBlob,
	extractAutomationAnywherePackages,
	getActiveAutomationAnywhereContext,
	getAutomationAnywhereAuthToken,
	getAutomationAnywhereFileId,
	getAutomationAnywhereFileName,
	getAutomationAnywhereFileType,
	isAutomationAnywhereFolder,
	isAutomationAnywhereTaskbot,
	refreshAutomationAnywhereFolderList,
	type ActiveAutomationAnywhereContext,
	type AutomationAnywhereFile,
	type AutomationAnywherePageContext,
	type AutomationAnywherePackage,
} from '@/src/ts/automation-anywhere-api';
import { getHelpTipId, renderHelpTip, setHelpTip } from './help';
import { t } from '@/src/ts/i18n';
import type {
	ContentActionResponse,
	RuntimeMessage,
	ToolCapabilities,
} from '@/src/ts/messages';
import JSZip from 'jszip';
type FeedbackSeverity = 'info' | 'warn' | 'error';
type ToolId =
	| 'universal-clipboard'
	| 'copy-files'
	| 'update-packages'
	| 'export-bots'
	| 'download-packages'
	| 'taskbot-json';
type ToolListItem = AutomationAnywhereFile | AutomationAnywherePackage;

interface ToolsRuntime extends ActiveAutomationAnywhereContext {
	api: AutomationAnywhereApi;
	capabilities: ToolCapabilities;
}

interface CopiedToolFile {
	id: string;
	name: string;
	sourceFolderId: string;
	hostname: string;
}

interface InitializeToolsOptions {
	setStatus(message: string, severity?: FeedbackSeverity, source?: string): void;
	addFeedback(
		severity: FeedbackSeverity,
		source: string,
		message: string,
		details?: Record<string, unknown>
	): void | Promise<void>;
	prettyJson(json: string): string;
}

interface RenderToolsPanelOptions {
	universalClipboardHtml?: string;
}

interface ExportMetadataReference {
	fileId: string;
	botPath: string;
	metadataPath: string;
	fileName: string;
}

interface ExportManifestEntry {
	path: string;
	newPath: null;
	contentType: string;
	metadataForFile: string | null;
	manualDependencies: string[] | null;
	scannedDependencies: string[] | null;
	manualDependenciesNewPaths: string[];
	scannedDependenciesNewPaths: string[];
	description: string;
	author: string;
	tags: string[];
	excluded: boolean;
}

interface ExportManifest {
	files: ExportManifestEntry[];
	packages: [];
	globalValues: [];
}

interface ToolRunState {
	title: string;
	total: number;
	completed: number;
	lines: Array<{ message: string; severity: FeedbackSeverity }>;
	startedAt: number;
}

const PAGE_LENGTH = 200;
const EXPORT_BATCH_SIZE = 20;
const AUTOMATION_ANYWHERE_TASKBOT_TEMPLATE_TYPE = 'application/vnd.aa.taskbot+template';
const EMPTY_TOOL_CAPABILITIES: ToolCapabilities = {
	universalClipboard: false,
};
const CONTENT_TYPE_BY_EXTENSION: Record<string, string> = {
	bmp: 'image/bmp',
	csv: 'text/csv',
	doc: 'application/msword',
	docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
	gif: 'image/gif',
	jpeg: 'image/jpeg',
	jpg: 'image/jpeg',
	json: 'application/json',
	pdf: 'application/pdf',
	png: 'image/png',
	svg: 'image/svg+xml',
	txt: 'text/plain',
	xls: 'application/vnd.ms-excel',
	xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
	xml: 'text/xml',
	zip: 'application/zip',
};

let options: InitializeToolsOptions;
let runtime: ToolsRuntime | null = null;
let currentTool: ToolId | null = null;
let loadedItems: ToolListItem[] = [];
let selectedIds = new Set<string>();
let loadedOffset = 0;
let loadedTotal = 0;
let lastRawPageLength = 0;
let copiedFiles: CopiedToolFile[] = [];
let taskbotJsonFileId: string | null = null;
let activeToolRun: ToolRunState | null = null;
let refreshToolsContextTimer: ReturnType<typeof setTimeout> | null = null;

let contextText: HTMLElement;
let toolsClipboardStatus: HTMLElement;
let availabilityDot: HTMLElement;
let refreshButton: HTMLButtonElement;
let actionsContainer: HTMLElement;
let universalClipboardSection: HTMLElement;
let fileSection: HTMLElement;
let listTitle: HTMLElement;
let searchInput: HTMLInputElement;
let selectAllInput: HTMLInputElement;
let selectedCountText: HTMLElement;
let fileList: HTMLElement;
let primaryActionButton: HTMLButtonElement;
let primaryActionHelp: HTMLElement;
let pasteActionButton: HTMLButtonElement;
let pasteActionWrapper: HTMLElement;
let loadMoreButton: HTMLButtonElement;
let toolsActionHint: HTMLElement;
let toolsProgress: HTMLElement;
let toolsProgressLabel: HTMLElement;
let toolsProgressPercent: HTMLElement;
let toolsProgressBar: HTMLElement;
let toolsProgressFill: HTMLElement;
let toolsFinishModal: HTMLElement;
let toolsFinishTitle: HTMLElement;
let toolsFinishSummary: HTMLElement;
let toolsFinishLog: HTMLElement;
let toolsFinishClose: HTMLButtonElement;
let taskbotSection: HTMLElement;
let taskbotJson: HTMLTextAreaElement;
let taskbotJsonMeta: HTMLElement;
let taskbotJsonError: HTMLElement;

export function renderToolsPanel(renderOptions: RenderToolsPanelOptions = {}): string {
	return `
		<section class="tab-panel is-active" role="tabpanel" data-panel="tools">
			<section class="panel-section">
				<div class="section-heading-row">
					<h2>${t('Tools')}</h2>
					<span class="tools-refresh-group">
						<span class="help-wrapper">
							<span id="toolsAvailabilityDot" class="tools-availability-dot help-anchor" data-available="false" role="status" tabindex="0" aria-label="${t('Tools unavailable')}" aria-describedby="${getHelpTipId('tools-availability')}"></span>
							${renderHelpTip('tools-availability', t('Green = tools available. Red = no tools here.'))}
						</span>
						<span class="help-wrapper">
							<button id="toolsRefresh" class="icon-button tools-refresh-button help-anchor" type="button" aria-label="${t('Refresh tools')}" aria-describedby="${getHelpTipId('tools-refresh')}" data-has-tools="false">
								<span aria-hidden="true">&#8635;</span>
							</button>
							${renderHelpTip('tools-refresh', t('Detect tools for current AA page.'))}
						</span>
					</span>
				</div>
				<p id="toolsContext" class="tools-context">${t('Open Automation Anywhere folder, taskbot, or packages page.')}</p>
				<p class="inline-hint">${t('Open an Automation Anywhere folder, taskbot, or Packages page, then refresh.')}</p>
				<p id="toolsClipboardStatus" class="tools-clipboard-status" hidden></p>
				<div id="toolsActions" class="tool-action-grid"></div>
			</section>

			<section id="universalClipboardSection" class="panel-section" hidden>
				${renderOptions.universalClipboardHtml ?? ''}
			</section>

			<section id="toolsFileSection" class="panel-section" hidden>
				<div class="section-heading-row">
					<h2 id="toolsListTitle">${t('Files')}</h2>
					<span id="toolsSelectedCount" class="tools-count">${t('0 selected')}</span>
				</div>
				<div class="tools-list-toolbar">
					<input id="toolsSearch" type="text" placeholder="${t('Search files')}" autocomplete="off">
					<label class="tools-select-all">
						<input id="toolsSelectAll" type="checkbox">
						<span>${t('Select visible')}</span>
					</label>
				</div>
				<div id="toolsFileList" class="tools-file-list"></div>
				<button id="toolsLoadMore" type="button" hidden>${t('Load more')}</button>
				<p id="toolsActionHint" class="inline-hint" hidden></p>
				<div class="tools-action-bar">
					<span class="help-wrapper">
						<button id="toolsPrimaryAction" class="help-anchor" type="button" disabled aria-describedby="${getHelpTipId('tools-primary-action')}">${t('Run')}</button>
						<span id="${getHelpTipId('tools-primary-action')}" class="help-tooltip" role="tooltip">${t('Run selected tool action.')}</span>
					</span>
					<span class="help-wrapper" id="toolsPasteActionWrapper">
						<button id="toolsPasteAction" class="help-anchor" type="button" hidden aria-describedby="${getHelpTipId('tools-paste-action')}">${t('Paste copied files')}</button>
						${renderHelpTip('tools-paste-action', t('Paste into this folder. Duplicates are skipped.'))}
					</span>
				</div>
				<div id="toolsProgress" class="tools-progress" hidden aria-live="polite">
					<div class="tools-progress-meta">
						<span id="toolsProgressLabel">${t('Idle')}</span>
						<span id="toolsProgressPercent">0%</span>
					</div>
					<div id="toolsProgressBar" class="tools-progress-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
						<span id="toolsProgressFill" class="tools-progress-fill"></span>
					</div>
				</div>
				<div id="toolsFinishModal" class="tools-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="toolsFinishTitle" hidden>
					<div class="tools-modal">
						<h2 id="toolsFinishTitle">${t('Tool finished')}</h2>
						<p id="toolsFinishSummary"></p>
						<div id="toolsFinishLog" class="tools-finish-log"></div>
						<button id="toolsFinishClose" type="button">${t('Close')}</button>
					</div>
				</div>
			</section>

			<section id="taskbotJsonSection" class="panel-section" hidden>
				<div class="section-heading-row">
					<h2>${t('Taskbot JSON')}</h2>
					<span id="taskbotJsonMeta" class="tools-count"></span>
				</div>
				<p class="inline-hint">${t('Advanced: saves raw bot content back to Control Room.')}</p>
				<textarea id="taskbotJson" class="json-area tools-json-area" spellcheck="false" aria-describedby="taskbotJsonError"></textarea>
				<p id="taskbotJsonError" class="json-inline-error" hidden></p>
				<div class="button-grid">
					<span class="help-wrapper">
						<button id="taskbotLoadJson" class="help-anchor" type="button" aria-describedby="${getHelpTipId('taskbot-load-json')}">${t('Load from Control Room')}</button>
						${renderHelpTip('taskbot-load-json', t('Load current taskbot content JSON.'))}
					</span>
					<span class="help-wrapper">
						<button id="taskbotCopyJson" type="button">${t('Copy to clipboard')}</button>
					</span>
					<span class="help-wrapper">
						<button id="taskbotFormatJson" type="button">${t('Format')}</button>
					</span>
				</div>
				<span class="help-wrapper">
					<button id="taskbotSaveJson" class="help-anchor" type="button" aria-describedby="${getHelpTipId('taskbot-save-json')}">${t('Save JSON')}</button>
					${renderHelpTip('taskbot-save-json', t('Save edited JSON back to Control Room.'))}
				</span>
			</section>

		</section>
	`;
}

export function initializeToolsPanel(initOptions: InitializeToolsOptions): void {
	options = initOptions;
	contextText = getRequiredElement('#toolsContext');
	toolsClipboardStatus = getRequiredElement('#toolsClipboardStatus');
	availabilityDot = getRequiredElement('#toolsAvailabilityDot');
	refreshButton = getRequiredElement<HTMLButtonElement>('#toolsRefresh');
	actionsContainer = getRequiredElement('#toolsActions');
	universalClipboardSection = getRequiredElement('#universalClipboardSection');
	fileSection = getRequiredElement('#toolsFileSection');
	listTitle = getRequiredElement('#toolsListTitle');
	searchInput = getRequiredElement<HTMLInputElement>('#toolsSearch');
	selectAllInput = getRequiredElement<HTMLInputElement>('#toolsSelectAll');
	selectedCountText = getRequiredElement('#toolsSelectedCount');
	fileList = getRequiredElement('#toolsFileList');
	primaryActionButton = getRequiredElement<HTMLButtonElement>('#toolsPrimaryAction');
	primaryActionHelp = getRequiredElement(`#${getHelpTipId('tools-primary-action')}`);
	pasteActionButton = getRequiredElement<HTMLButtonElement>('#toolsPasteAction');
	pasteActionWrapper = getRequiredElement('#toolsPasteActionWrapper');
	loadMoreButton = getRequiredElement<HTMLButtonElement>('#toolsLoadMore');
	toolsActionHint = getRequiredElement('#toolsActionHint');
	toolsProgress = getRequiredElement('#toolsProgress');
	toolsProgressLabel = getRequiredElement('#toolsProgressLabel');
	toolsProgressPercent = getRequiredElement('#toolsProgressPercent');
	toolsProgressBar = getRequiredElement('#toolsProgressBar');
	toolsProgressFill = getRequiredElement('#toolsProgressFill');
	toolsFinishModal = getRequiredElement('#toolsFinishModal');
	toolsFinishTitle = getRequiredElement('#toolsFinishTitle');
	toolsFinishSummary = getRequiredElement('#toolsFinishSummary');
	toolsFinishLog = getRequiredElement('#toolsFinishLog');
	toolsFinishClose = getRequiredElement<HTMLButtonElement>('#toolsFinishClose');
	taskbotSection = getRequiredElement('#taskbotJsonSection');
	taskbotJson = getRequiredElement<HTMLTextAreaElement>('#taskbotJson');
	taskbotJsonMeta = getRequiredElement('#taskbotJsonMeta');
	taskbotJsonError = getRequiredElement('#taskbotJsonError');

	refreshButton.addEventListener('click', () => {
		void refreshToolsContext();
	});
	searchInput.addEventListener('input', renderFileList);
	selectAllInput.addEventListener('change', toggleVisibleSelection);
	primaryActionButton.addEventListener('click', () => {
		void runPrimaryToolAction();
	});
	pasteActionButton.addEventListener('click', () => {
		void pasteCopiedFiles();
	});
	loadMoreButton.addEventListener('click', () => {
		void loadListPage(false);
	});
	toolsFinishClose.addEventListener('click', hideToolFinishModal);
	toolsFinishModal.addEventListener('click', (event) => {
		if (event.target === toolsFinishModal) hideToolFinishModal();
	});
	getRequiredElement<HTMLButtonElement>('#taskbotLoadJson').addEventListener('click', () => {
		void loadTaskbotJson();
	});
	getRequiredElement<HTMLButtonElement>('#taskbotCopyJson').addEventListener('click', () => {
		void copyTaskbotJson();
	});
	getRequiredElement<HTMLButtonElement>('#taskbotFormatJson').addEventListener('click', () => {
		formatTaskbotJson();
	});
	taskbotJson.addEventListener('input', () => {
		validateTaskbotJson();
	});
	getRequiredElement<HTMLButtonElement>('#taskbotSaveJson').addEventListener('click', () => {
		void saveTaskbotJson();
	});
	browser.runtime.onMessage.addListener((message: RuntimeMessage, sender) => {
		if (message.type !== 'AA_ROUTE_CHANGED') return;
		if (sender.tab?.active === false) return;
		scheduleToolsContextRefresh();
	});
	browser.tabs.onActivated.addListener(() => {
		scheduleToolsContextRefresh();
	});
	browser.tabs.onUpdated.addListener((tabId, changeInfo) => {
		if (!changeInfo.url && changeInfo.status !== 'complete') return;
		void browser.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
			if (tab?.id === tabId) scheduleToolsContextRefresh();
		});
	});

	void refreshToolsContext();
}

function getRequiredElement<T extends HTMLElement = HTMLElement>(selector: string): T {
	const element = document.querySelector<T>(selector);
	if (!element) throw new Error(`Missing ${selector}.`);
	return element;
}

function setToolStatus(
	message: string,
	severity: FeedbackSeverity = 'info'
): void {
	options.setStatus(message, severity, 'tools');
}

function scheduleToolsContextRefresh(): void {
	if (refreshToolsContextTimer) clearTimeout(refreshToolsContextTimer);
	refreshToolsContextTimer = setTimeout(() => {
		refreshToolsContextTimer = null;
		void refreshToolsContext();
	}, 250);
}

function updateCopiedFilesStatus(): void {
	if (!copiedFiles.length) {
		toolsClipboardStatus.hidden = true;
		toolsClipboardStatus.textContent = '';
		return;
	}
	const label = copiedFiles.length === 1 ? t('file') : t('files');
	toolsClipboardStatus.textContent = t('{count} {label} in clipboard.', {
		count: copiedFiles.length,
		label,
	});
	toolsClipboardStatus.hidden = false;
}

function addRunLine(message: string, severity: FeedbackSeverity = 'info'): void {
	activeToolRun?.lines.push({ message, severity });
}

function appendToolLog(
	message: string,
	severity: FeedbackSeverity = 'info',
	details?: Record<string, unknown>
): void {
	addRunLine(message, severity);
	void options.addFeedback(severity, 'tools', message, details);
}

function getProgressPercent(completed: number, total: number): number {
	if (total <= 0) return completed > 0 ? 100 : 0;
	return Math.min(100, Math.max(0, Math.round((completed / total) * 100)));
}

function setToolProgress(completed: number, total: number, message: string): void {
	const percent = getProgressPercent(completed, total);
	toolsProgress.hidden = false;
	toolsProgressLabel.textContent = message;
	toolsProgressPercent.textContent = `${percent}%`;
	toolsProgressBar.setAttribute('aria-valuenow', String(percent));
	toolsProgressBar.setAttribute('aria-valuetext', message);
	toolsProgressFill.style.width = `${percent}%`;
	if (activeToolRun) {
		activeToolRun.completed = completed;
		activeToolRun.total = total;
	}
}

function startToolRun(title: string, total: number, message: string): void {
	activeToolRun = {
		title,
		total,
		completed: 0,
		lines: [],
		startedAt: Date.now(),
	};
	setToolProgress(0, total, message);
	appendToolLog(message);
}

function hideToolFinishModal(): void {
	toolsFinishModal.hidden = true;
}

function showToolFinishModal(
	run: ToolRunState,
	summary: string,
	severity: FeedbackSeverity
): void {
	toolsFinishTitle.textContent =
		severity === 'error'
			? t('{title} failed', { title: run.title })
			: severity === 'warn'
				? t('{title} finished with warnings', { title: run.title })
				: t('{title} finished', { title: run.title });
	const seconds = Math.max(0, Math.round((Date.now() - run.startedAt) / 1000));
	toolsFinishSummary.textContent = t('{summary} Duration: {seconds}s.', {
		summary,
		seconds,
	});
	toolsFinishLog.textContent = '';
	if (!run.lines.length) {
		const empty = document.createElement('p');
		empty.className = 'tools-finish-empty';
		empty.textContent = t('No actions recorded.');
		toolsFinishLog.appendChild(empty);
	} else {
		for (const line of run.lines) {
			const row = document.createElement('div');
			row.className = `tools-finish-line tools-finish-${line.severity}`;
			row.textContent = `${line.severity.toUpperCase()} - ${line.message}`;
			toolsFinishLog.appendChild(row);
		}
	}
	toolsFinishModal.hidden = false;
	requestAnimationFrame(() => toolsFinishClose.focus());
}

function finishToolRun(
	summary: string,
	severity: FeedbackSeverity = 'info'
): void {
	const run = activeToolRun;
	if (!run) return;
	addRunLine(summary, severity);
	setToolProgress(run.total, run.total, summary);
	activeToolRun = null;
	showToolFinishModal(run, summary, severity);
}

function setBusy(button: HTMLButtonElement, busy: boolean, label?: string): void {
	button.disabled = busy;
	if (label) button.textContent = label;
}

function updateAvailabilityDot(hasTools: boolean): void {
	availabilityDot.dataset.available = String(hasTools);
	availabilityDot.setAttribute(
		'aria-label',
		hasTools
			? t('Tools available on current page')
			: t('No tools available on current page')
	);
	refreshButton.dataset.hasTools = String(hasTools);
}

function isFolderTool(
	tool: ToolId | null
): tool is 'copy-files' | 'update-packages' | 'export-bots' {
	return tool === 'copy-files' || tool === 'update-packages' || tool === 'export-bots';
}

function isListTool(
	tool: ToolId | null
): tool is 'copy-files' | 'update-packages' | 'export-bots' | 'download-packages' {
	return isFolderTool(tool) || tool === 'download-packages';
}

function setToolPanelHidden(panel: HTMLElement, hidden: boolean): void {
	panel.hidden = hidden;
	panel.setAttribute('aria-hidden', String(hidden));
}

function setSelectedToolPanel(tool: ToolId | null): void {
	setToolPanelHidden(universalClipboardSection, tool !== 'universal-clipboard');
	setToolPanelHidden(taskbotSection, tool !== 'taskbot-json');
	setToolPanelHidden(fileSection, !isListTool(tool));
}

async function refreshToolsContext(): Promise<void> {
	actionsContainer.textContent = '';
	setSelectedToolPanel(null);
	taskbotJson.value = '';
	validateTaskbotJson();
	taskbotJsonFileId = null;
	updateCopiedFilesStatus();
	updateAvailabilityDot(false);

	try {
		const active = await getActiveAutomationAnywhereContext();
		if (!active || active.context.pageType === 'unsupported') {
			runtime = null;
			currentTool = null;
			contextText.textContent =
				t('Unsupported page. Open Automation Anywhere folder, taskbot, or packages page.');
			setSelectedToolPanel(null);
			renderActionButtons();
			return;
		}

		const capabilities = await getToolCapabilities(active.tabId);
		const authToken = await getAutomationAnywhereAuthToken(active.tabId);
		runtime = {
			...active,
			api: new AutomationAnywhereApi(active.context.baseUrl, authToken),
			capabilities,
		};
		contextText.textContent = getContextLabel(active.context);
		const tools = getAvailableTools(active.context, capabilities);
		updateAvailabilityDot(tools.length > 0);

		if (isFolderContext(active.context)) {
			const shouldSuggestPaste = canPasteCopiedFilesInContext(active.context);
			currentTool = shouldSuggestPaste ? 'copy-files' : null;
			setSelectedToolPanel(currentTool);
			renderActionButtons();
			if (shouldSuggestPaste) {
				await loadListPage(true);
				setToolStatus(
					t('{count} file(s) in clipboard. Paste available.', {
						count: copiedFiles.length,
					})
				);
			}
			return;
		}

		currentTool = null;
		setSelectedToolPanel(null);
		renderActionButtons();
	} catch (error) {
		runtime = null;
		currentTool = null;
		setSelectedToolPanel(null);
		contextText.textContent =
			error instanceof Error ? error.message : t('Tools context failed.');
		setToolStatus(contextText.textContent, 'error');
	}
}

async function getToolCapabilities(tabId: number): Promise<ToolCapabilities> {
	try {
		const response = (await browser.tabs.sendMessage(tabId, {
			type: 'GET_TOOL_CAPABILITIES',
		})) as ContentActionResponse | undefined;
		return response?.ok && response.capabilities
			? response.capabilities
			: EMPTY_TOOL_CAPABILITIES;
	} catch {
		return EMPTY_TOOL_CAPABILITIES;
	}
}

function getContextLabel(context: AutomationAnywherePageContext): string {
	if (context.pageType === 'private-folder') {
		return t('Private folder {id} on {host}', {
			id: context.folderId ?? '',
			host: context.hostname,
		});
	}
	if (context.pageType === 'public-folder') {
		return t('Public folder {id} on {host}', {
			id: context.folderId ?? '',
			host: context.hostname,
		});
	}
	if (context.pageType === 'private-taskbot') {
		return t('Private taskbot {id} on {host}', {
			id: context.fileId ?? '',
			host: context.hostname,
		});
	}
	if (context.pageType === 'public-taskbot') {
		return t('Public taskbot {id} on {host}', {
			id: context.fileId ?? '',
			host: context.hostname,
		});
	}
	if (context.pageType === 'packages') {
		return t('Packages on {host}', { host: context.hostname });
	}
	return t('Unsupported page.');
}

function isFolderContext(context: AutomationAnywherePageContext): boolean {
	return context.pageType === 'private-folder' || context.pageType === 'public-folder';
}

function getAvailableTools(
	context: AutomationAnywherePageContext,
	capabilities: ToolCapabilities = runtime?.capabilities ?? EMPTY_TOOL_CAPABILITIES
): ToolId[] {
	const tools: ToolId[] = [];
	if (capabilities.universalClipboard) tools.push('universal-clipboard');
	if (context.pageType === 'private-folder') {
		tools.push('copy-files', 'update-packages', 'export-bots');
		return tools;
	}
	if (context.pageType === 'public-folder') {
		tools.push('export-bots');
		return tools;
	}
	if (context.pageType === 'private-taskbot' || context.pageType === 'public-taskbot') {
		tools.push('taskbot-json');
		return tools;
	}
	if (context.pageType === 'packages') {
		tools.push('download-packages');
		return tools;
	}
	return tools;
}

function getToolLabel(tool: ToolId): string {
	if (tool === 'universal-clipboard') return t('Universal Clipboard');
	if (tool === 'copy-files') return t('Copy Files');
	if (tool === 'update-packages') return t('Update Packages');
	if (tool === 'export-bots') return t('Export Bots');
	if (tool === 'download-packages') return t('Download Packages');
	return t('Taskbot JSON');
}

function getToolActionHelp(tool: ToolId): string {
	if (tool === 'universal-clipboard') return t('Use saved AA clipboard slots.');
	if (tool === 'copy-files') return t('Copy file references inside this extension.');
	if (tool === 'update-packages') return t('Apply default package versions to selected bots.');
	if (tool === 'export-bots') return t('Export selected taskbots from this folder.');
	if (tool === 'download-packages') return t('Download packages from this page.');
	return t('Load and edit raw taskbot JSON.');
}

function getPrimaryActionHelp(tool: ToolId | null): string {
	if (tool === 'copy-files') return t('Store selected file references inside extension.');
	if (tool === 'update-packages') return t('Update selected bots using default package versions.');
	if (tool === 'export-bots') return t('Export selected bots into a ZIP file.');
	if (tool === 'download-packages') return t('Download selected package JAR files.');
	return t('Run selected tool action.');
}

function getToolInlineHint(tool: ToolId | null): string {
	if (tool === 'copy-files') {
		return t('Stores file references inside extension. Open another folder on same host to paste.');
	}
	if (tool === 'update-packages') {
		return t('Updates selected taskbots using package defaults from this Control Room.');
	}
	if (tool === 'export-bots') return t('Exports selected taskbots and dependencies where available.');
	if (tool === 'download-packages') return t('Downloads selected packages from the Packages page.');
	return '';
}

function renderActionButtons(): void {
	const context = runtime?.context;
	actionsContainer.textContent = '';
	if (!context) return;

	for (const tool of getAvailableTools(context)) {
		const wrapper = document.createElement('span');
		wrapper.className = 'help-wrapper';
		const button = document.createElement('button');
		button.type = 'button';
		button.textContent = getToolLabel(tool);
		button.dataset.toolAction = tool;
		button.className = tool === currentTool ? 'is-active tool-action-button' : 'tool-action-button';
		const helpTip = setHelpTip(button, `tool-action-${tool}`, getToolActionHelp(tool));
		button.addEventListener('click', () => {
			void selectTool(tool);
		});
		wrapper.append(button, helpTip);
		actionsContainer.appendChild(wrapper);
	}
}

async function selectTool(tool: ToolId): Promise<void> {
	currentTool = tool;
	renderActionButtons();
	setSelectedToolPanel(tool);

	if (tool === 'universal-clipboard') return;

	if (tool === 'taskbot-json') {
		await loadTaskbotJson();
		return;
	}

	await loadListPage(true);
}

async function loadListPage(reset: boolean): Promise<void> {
	if (currentTool === 'download-packages') {
		await loadPackagePage(reset);
		return;
	}
	await loadFolderPage(reset);
}

function getCurrentFolderId(): string | null {
	const folderId = runtime?.context.folderId;
	return folderId ? String(folderId) : null;
}

async function loadFolderPage(reset: boolean): Promise<void> {
	const activeRuntime = runtime;
	const folderId = getCurrentFolderId();
	const selectedTool = currentTool;
	if (!activeRuntime || !folderId || !isFolderTool(selectedTool)) {
		return;
	}

	setBusy(loadMoreButton, true, reset ? t('Loading...') : t('Loading more...'));
	if (reset) {
		loadedItems = [];
		selectedIds = new Set<string>();
		loadedOffset = 0;
		loadedTotal = 0;
		lastRawPageLength = 0;
		searchInput.value = '';
	}

	try {
		const response = await activeRuntime.api.listFolderContents({
			folderId,
			offset: loadedOffset,
			length: PAGE_LENGTH,
			taskbotsOnly: selectedTool === 'update-packages' || selectedTool === 'export-bots',
			filesOnly: selectedTool === 'copy-files',
		});
		if (runtime !== activeRuntime || currentTool !== selectedTool) return;
		const rawList = response.list ?? [];
		lastRawPageLength = rawList.length;
		const filtered = filterItemsForTool(rawList, selectedTool);
		const byId = new Map(loadedItems.map((item) => [getToolItemId(item), item]));
		for (const item of filtered) byId.set(getToolItemId(item), item);
		loadedItems = [...byId.values()];
		loadedOffset += PAGE_LENGTH;
		loadedTotal =
			response.page?.totalFilter ??
			response.page?.total ??
			response.total ??
			Math.max(loadedItems.length, loadedTotal);
		pruneSelection();
		renderFileList();
		setSelectedToolPanel(selectedTool);
		setToolStatus(t('{count} item(s) loaded.', { count: loadedItems.length }));
	} catch (error) {
		if (runtime !== activeRuntime || currentTool !== selectedTool) return;
		setToolStatus(
			error instanceof Error ? error.message : t('Folder list failed.'),
			'error'
		);
	} finally {
		if (runtime === activeRuntime && currentTool === selectedTool) {
			setBusy(loadMoreButton, false, t('Load more'));
		}
	}
}

async function loadPackagePage(reset: boolean): Promise<void> {
	const activeRuntime = runtime;
	const selectedTool = currentTool;
	if (!activeRuntime || selectedTool !== 'download-packages') {
		return;
	}

	setBusy(loadMoreButton, true, reset ? t('Loading...') : t('Loading more...'));
	if (reset) {
		loadedItems = [];
		selectedIds = new Set<string>();
		loadedOffset = 0;
		loadedTotal = 0;
		lastRawPageLength = 0;
		searchInput.value = '';
	}

	try {
		const response = await activeRuntime.api.listPackages({
			offset: loadedOffset,
			length: PAGE_LENGTH,
		});
		if (runtime !== activeRuntime || currentTool !== selectedTool) return;
		const rawList = response.list ?? [];
		lastRawPageLength = rawList.length;
		const byId = new Map(loadedItems.map((item) => [getToolItemId(item), item]));
		for (const item of rawList) byId.set(getToolItemId(item), item);
		loadedItems = [...byId.values()];
		loadedOffset += PAGE_LENGTH;
		loadedTotal =
			response.page?.totalFilter ??
			response.page?.total ??
			response.total ??
			Math.max(loadedItems.length, loadedTotal);
		pruneSelection();
		renderFileList();
		setSelectedToolPanel(selectedTool);
		setToolStatus(t('{count} package(s) loaded.', { count: loadedItems.length }));
	} catch (error) {
		if (runtime !== activeRuntime || currentTool !== selectedTool) return;
		setToolStatus(
			error instanceof Error ? error.message : t('Package list failed.'),
			'error'
		);
	} finally {
		if (runtime === activeRuntime && currentTool === selectedTool) {
			setBusy(loadMoreButton, false, t('Load more'));
		}
	}
}

function filterItemsForTool(
	items: AutomationAnywhereFile[],
	tool: ToolId
): AutomationAnywhereFile[] {
	if (tool === 'copy-files') return items.filter((item) => !isAutomationAnywhereFolder(item));
	if (tool === 'update-packages' || tool === 'export-bots') {
		return items.filter(isAutomationAnywhereTaskbot);
	}
	return items;
}

function isAutomationAnywherePackageItem(
	item: ToolListItem
): item is AutomationAnywherePackage {
	return (
		'packageVersion' in item ||
		'package_version' in item ||
		'packageName' in item ||
		'package_name' in item ||
		'pkgDownloadUrl' in item ||
		'packageDownloadUrl' in item ||
		'downloadUrl' in item
	);
}

function getAutomationAnywherePackageName(pkg: AutomationAnywherePackage): string {
	return String(pkg.name ?? pkg.packageName ?? pkg.package_name ?? '').trim();
}

function getAutomationAnywherePackageVersion(pkg: AutomationAnywherePackage): string {
	return String(pkg.packageVersion ?? pkg.version ?? pkg.package_version ?? '').trim();
}

function getAutomationAnywherePackageDownloadUrl(
	pkg: AutomationAnywherePackage
): string {
	return String(pkg.pkgDownloadUrl ?? pkg.packageDownloadUrl ?? pkg.downloadUrl ?? '').trim();
}

function getAutomationAnywherePackageId(pkg: AutomationAnywherePackage): string {
	const explicitId = getOptionalString(pkg.id);
	if (explicitId) return explicitId;
	return `${getAutomationAnywherePackageName(pkg)}\u0000${getAutomationAnywherePackageVersion(pkg)}`;
}

function getToolItemId(item: ToolListItem): string {
	return isAutomationAnywherePackageItem(item)
		? getAutomationAnywherePackageId(item)
		: getAutomationAnywhereFileId(item);
}

function getToolItemName(item: ToolListItem): string {
	if (!isAutomationAnywherePackageItem(item)) return getAutomationAnywhereFileName(item);
	return getAutomationAnywherePackageName(item) || getAutomationAnywherePackageId(item);
}

function getToolItemSearchText(item: ToolListItem): string {
	return isAutomationAnywherePackageItem(item)
		? `${getAutomationAnywherePackageName(item)} ${getAutomationAnywherePackageVersion(item)}`
		: getAutomationAnywhereFileName(item);
}

function getToolItemMeta(item: ToolListItem): string {
	if (!isAutomationAnywherePackageItem(item)) return getItemMeta(item);
	const version = getAutomationAnywherePackageVersion(item) || t('unknown');
	const hasDownloadUrl = Boolean(getAutomationAnywherePackageDownloadUrl(item));
	return hasDownloadUrl
		? t('Version {version}', { version })
		: t('Version {version} | missing pkgDownloadUrl', { version });
}

function pruneSelection(): void {
	const available = new Set(loadedItems.map(getToolItemId));
	selectedIds = new Set([...selectedIds].filter((id) => available.has(id)));
}

function renderFileList(): void {
	const search = searchInput.value.trim().toLowerCase();
	const visible = loadedItems.filter((item) =>
		getToolItemSearchText(item).toLowerCase().includes(search)
	);
	searchInput.placeholder =
		currentTool === 'download-packages' ? t('Search packages') : t('Search files');

	listTitle.textContent =
		currentTool === 'copy-files'
			? t('Copy Files')
			: currentTool === 'update-packages'
				? t('Update Packages')
				: currentTool === 'export-bots'
					? t('Export Bots')
					: t('Download Packages');
	selectedCountText.textContent = t('{selected} selected / {loaded} loaded', {
		selected: selectedIds.size,
		loaded: loadedItems.length,
	});
	fileList.textContent = '';

	if (!visible.length) {
		const empty = document.createElement('p');
		empty.className = 'tools-empty';
		empty.textContent = loadedItems.length
			? t('No matches.')
			: currentTool === 'download-packages'
				? t('No packages found.')
				: t('No files found.');
		fileList.appendChild(empty);
	}

	for (const item of visible) {
		const id = getToolItemId(item);
		const row = document.createElement('label');
		row.className = 'tool-file-row';
		const checkbox = document.createElement('input');
		checkbox.type = 'checkbox';
		checkbox.checked = selectedIds.has(id);
		checkbox.addEventListener('change', () => {
			if (checkbox.checked) selectedIds.add(id);
			else selectedIds.delete(id);
			renderFileList();
		});
		const name = document.createElement('strong');
		name.textContent = getToolItemName(item);
		const meta = document.createElement('small');
		meta.textContent = getToolItemMeta(item);
		const text = document.createElement('span');
		text.className = 'tool-file-text';
		text.append(name, meta);
		row.append(checkbox, text);
		fileList.appendChild(row);
	}

	const allVisibleSelected =
		visible.length > 0 && visible.every((item) => selectedIds.has(getToolItemId(item)));
	const someVisibleSelected = visible.some((item) => selectedIds.has(getToolItemId(item)));
	selectAllInput.checked = allVisibleSelected;
	selectAllInput.indeterminate = someVisibleSelected && !allVisibleSelected;
	updateActionBar();
}

function getItemMeta(item: AutomationAnywhereFile): string {
	const type = getAutomationAnywhereFileType(item) ?? t('unknown');
	const modified = item.lastModified ?? item.modifiedOn ?? item.updatedOn;
	return modified ? `${type} | ${modified}` : type;
}

function toggleVisibleSelection(): void {
	const search = searchInput.value.trim().toLowerCase();
	const visible = loadedItems.filter((item) =>
		getToolItemSearchText(item).toLowerCase().includes(search)
	);
	for (const item of visible) {
		const id = getToolItemId(item);
		if (selectAllInput.checked) selectedIds.add(id);
		else selectedIds.delete(id);
	}
	renderFileList();
}

function updateActionBar(): void {
	const count = selectedIds.size;
	primaryActionButton.disabled = count === 0;
	if (currentTool === 'copy-files') primaryActionButton.textContent = t('Copy {count} file(s)', { count });
	if (currentTool === 'update-packages') primaryActionButton.textContent = t('Update {count} bot(s)', { count });
	if (currentTool === 'export-bots') primaryActionButton.textContent = t('Export {count} bot(s)', { count });
	if (currentTool === 'download-packages') {
		primaryActionButton.textContent = t('Download {count} package(s)', { count });
	}
	primaryActionHelp.textContent = getPrimaryActionHelp(currentTool);

	const hint = getToolInlineHint(currentTool);
	toolsActionHint.textContent = hint;
	toolsActionHint.hidden = !hint;

	const canPaste = canPasteCopiedFiles();
	pasteActionWrapper.hidden = !canPaste;
	pasteActionButton.hidden = !canPaste;
	pasteActionButton.disabled = !canPaste;
	pasteActionButton.textContent = t('Paste {count} copied file(s)', {
		count: copiedFiles.length,
	});

	loadMoreButton.hidden = !hasMoreItems();
}

function hasMoreItems(): boolean {
	return lastRawPageLength >= PAGE_LENGTH || loadedItems.length < loadedTotal;
}

function getSelectedItems(): ToolListItem[] {
	return loadedItems.filter((item) => selectedIds.has(getToolItemId(item)));
}

function getSelectedFiles(): AutomationAnywhereFile[] {
	return getSelectedItems().filter(
		(item): item is AutomationAnywhereFile => !isAutomationAnywherePackageItem(item)
	);
}

function getSelectedPackages(): AutomationAnywherePackage[] {
	return getSelectedItems().filter(isAutomationAnywherePackageItem);
}

async function runPrimaryToolAction(): Promise<void> {
	if (currentTool === 'copy-files') {
		copySelectedFiles();
		return;
	}
	if (currentTool === 'update-packages') {
		await updateSelectedPackages();
		return;
	}
	if (currentTool === 'export-bots') {
		await exportSelectedBots();
		return;
	}
	if (currentTool === 'download-packages') {
		await downloadSelectedPackages();
	}
}

function copySelectedFiles(): void {
	const folderId = getCurrentFolderId();
	const context = runtime?.context;
	if (!folderId || !context) return;
	const items = getSelectedFiles();
	if (!items.length) return;
	copiedFiles = [];
	for (let index = 0; index < items.length; index += 1) {
		const item = items[index];
		const name = getAutomationAnywhereFileName(item);
		copiedFiles.push({
			id: getAutomationAnywhereFileId(item),
			name,
			sourceFolderId: folderId,
			hostname: context.hostname,
		});
	}
	hideToolFinishModal();
	toolsProgress.hidden = true;
	updateCopiedFilesStatus();
	const summary = t('{count} file(s) in clipboard. Open target folder to paste.', {
		count: copiedFiles.length,
	});
	setToolStatus(summary);
	void options.addFeedback('info', 'tools', summary, {
		count: copiedFiles.length,
		sourceFolderId: folderId,
	});
	updateActionBar();
}

function canPasteCopiedFiles(): boolean {
	const context = runtime?.context;
	return Boolean(currentTool === 'copy-files' && context && canPasteCopiedFilesInContext(context));
}

function canPasteCopiedFilesInContext(context: AutomationAnywherePageContext): boolean {
	const folderId = context.folderId ? String(context.folderId) : null;
	return Boolean(
		folderId &&
			copiedFiles.length &&
			copiedFiles[0].hostname === context.hostname &&
			copiedFiles[0].sourceFolderId !== folderId
	);
}

async function pasteCopiedFiles(): Promise<void> {
	const activeRuntime = runtime;
	const folderId = getCurrentFolderId();
	if (!activeRuntime || !folderId || !canPasteCopiedFiles()) return;

	setBusy(pasteActionButton, true, t('Pasting...'));
	startToolRun(
		t('Paste Copied Files'),
		copiedFiles.length,
		t('Pasting {count} copied file(s)...', { count: copiedFiles.length })
	);
	try {
		const destinationItems = await loadAllFolderItems(folderId, true);
		const destinationNames = new Set(
			destinationItems.map((item) => getAutomationAnywhereFileName(item).toLowerCase())
		);
		let copied = 0;
		let skipped = 0;
		let failed = 0;

		for (let index = 0; index < copiedFiles.length; index += 1) {
			const item = copiedFiles[index];
			if (destinationNames.has(item.name.toLowerCase())) {
				skipped += 1;
				appendToolLog(t('Skipped duplicate: {name}', { name: item.name }), 'warn');
				setToolProgress(
					index + 1,
					copiedFiles.length,
					t('Processed {count}/{total}', {
						count: index + 1,
						total: copiedFiles.length,
					})
				);
				continue;
			}
			try {
				await activeRuntime.api.copyFile(item.id, item.name, folderId);
				copied += 1;
				destinationNames.add(item.name.toLowerCase());
				appendToolLog(t('Copied: {name}', { name: item.name }));
			} catch (error) {
				failed += 1;
				appendToolLog(
					t('Failed: {name} - {message}', {
						name: item.name,
						message: error instanceof Error ? error.message : t('copy failed'),
					}),
					'error'
				);
			}
			setToolProgress(
				index + 1,
				copiedFiles.length,
				t('Processed {count}/{total}', {
					count: index + 1,
					total: copiedFiles.length,
				})
			);
		}

		await refreshAutomationAnywhereFolderList(activeRuntime.tabId);
		await loadFolderPage(true);
		const summary = t('Paste done. Copied {copied}, skipped {skipped}, failed {failed}.', {
			copied,
			skipped,
			failed,
		});
		const severity = failed ? 'warn' : 'info';
		setToolStatus(summary, severity);
		finishToolRun(summary, severity);
	} catch (error) {
		const message = error instanceof Error ? error.message : t('Paste failed.');
		setToolStatus(message, 'error');
		finishToolRun(message, 'error');
	} finally {
		setBusy(pasteActionButton, false);
		updateActionBar();
	}
}

async function loadAllFolderItems(
	folderId: string,
	filesOnly: boolean
): Promise<AutomationAnywhereFile[]> {
	const activeRuntime = runtime;
	if (!activeRuntime) return [];
	const all: AutomationAnywhereFile[] = [];
	for (let offset = 0; ; offset += PAGE_LENGTH) {
		const response = await activeRuntime.api.listFolderContents({
			folderId,
			offset,
			length: PAGE_LENGTH,
			filesOnly,
		});
		const page = (response.list ?? []).filter((item) => !isAutomationAnywhereFolder(item));
		all.push(...page);
		if ((response.list ?? []).length < PAGE_LENGTH) break;
	}
	return all;
}

async function updateSelectedPackages(): Promise<void> {
	const activeRuntime = runtime;
	if (!activeRuntime) return;
	const bots = getSelectedFiles();
	if (!bots.length) return;

	setBusy(primaryActionButton, true, t('Updating...'));
	startToolRun(
		t('Update Packages'),
		bots.length,
		t('Loading default package versions...')
	);
	try {
		const defaults = await activeRuntime.api.getDefaultPackageVersions();
		if (!defaults.size) {
			const message = t('No default package versions found.');
			setToolStatus(message, 'error');
			finishToolRun(message, 'error');
			return;
		}

		appendToolLog(t('Loaded {count} default package version(s).', { count: defaults.size }));
		let updated = 0;
		let skipped = 0;
		let failed = 0;

		for (let index = 0; index < bots.length; index += 1) {
			const bot = bots[index];
			const fileId = getAutomationAnywhereFileId(bot);
			const botName = getAutomationAnywhereFileName(bot);
			try {
				const content = await activeRuntime.api.getBotContent(fileId);
				const packages = extractAutomationAnywherePackages(content);
				const changes = packages.filter((pkg) => {
					const target = defaults.get(pkg.name);
					return target && target !== pkg.version;
				});
				const result = applyPackageVersionsToContent(content, defaults);
				if (!result.changed) {
					skipped += 1;
					appendToolLog(t('Skipped: {name} - no package change', { name: botName }));
					setToolProgress(index + 1, bots.length, t('Processed {count}/{total}', {
						count: index + 1,
						total: bots.length,
					}));
					continue;
				}
				await activeRuntime.api.updateBotContent(fileId, result.content);
				updated += 1;
				appendToolLog(t('Updated: {name} - {count} package(s)', {
					name: botName,
					count: changes.length,
				}));
			} catch (error) {
				failed += 1;
				appendToolLog(
					t('Failed: {name} - {message}', {
						name: botName,
						message: error instanceof Error ? error.message : t('update failed'),
					}),
					'error'
				);
			}
			setToolProgress(index + 1, bots.length, t('Processed {count}/{total}', {
				count: index + 1,
				total: bots.length,
			}));
		}
		const summary = t(
			'Update packages done. Updated {updated}, skipped {skipped}, failed {failed}.',
			{ updated, skipped, failed }
		);
		const severity = failed ? 'warn' : 'info';
		setToolStatus(summary, severity);
		finishToolRun(summary, severity);
	} catch (error) {
		const message = error instanceof Error ? error.message : t('Update packages failed.');
		setToolStatus(message, 'error');
		finishToolRun(message, 'error');
	} finally {
		setBusy(primaryActionButton, false);
		updateActionBar();
	}
}

async function exportSelectedBots(): Promise<void> {
	const activeRuntime = runtime;
	if (!activeRuntime) return;
	const bots = getSelectedFiles().filter(isAutomationAnywhereTaskbot);
	if (!bots.length) return;

	setBusy(primaryActionButton, true, t('Exporting...'));
	const exportName = `better-aa-export-${new Date().toISOString().replace(/[:.]/g, '-')}`;
	startToolRun(
		t('Export Bots'),
		5,
		t('Starting ZIP export for {count} bot(s). Do not close sidepanel.', {
			count: bots.length,
		})
	);
	try {
		const rootIds = new Set(bots.map(getAutomationAnywhereFileId));
		setToolProgress(0, 5, t('Fetching dependency graph...'));
		appendToolLog(t('Fetching dependency graph...'));
		const dependencyResponse = await activeRuntime.api.getBotDependencies([...rootIds]);
		const dependencyItems = dependencyResponse.dependencies ?? [];
		const exportItems = dedupeAutomationAnywhereFiles([...bots, ...dependencyItems]);
		if (!exportItems.length) {
			throw new Error(
				t('Dependency graph is empty. Response: {response}', {
					response: stringifyForFeedback(dependencyResponse),
				})
			);
		}

		appendToolLog(t('Dependency graph loaded: {count} file(s).', {
			count: exportItems.length,
		}));
		const taskbots = exportItems.filter(isExportTaskbot);
		setToolProgress(1, 5, t('Dependency graph loaded: {count} file(s).', {
			count: exportItems.length,
		}));
		appendToolLog(t('Scanning {count} taskbot file(s) for metadata paths...', {
			count: taskbots.length,
		}));
		const metadataReferences = await scanMetadataReferences(activeRuntime, taskbots);
		if (metadataReferences.length) {
			appendToolLog(t('Metadata references found: {count}.', {
				count: metadataReferences.length,
			}));
		}
		setToolProgress(2, 5, t('Metadata scan done: {count} reference(s).', {
			count: metadataReferences.length,
		}));

		appendToolLog(
			t('Downloading {count} export file(s)...', {
				count: exportItems.length + metadataReferences.length,
			})
		);
		const fileBlobs = await downloadExportFiles(activeRuntime, exportItems, rootIds);
		const metadataBlobs = await downloadMetadataFiles(activeRuntime, metadataReferences);
		setToolProgress(3, 5, t('Export file downloads done.'));
		appendToolLog(t('Creating export archive...'));
		const archive = await createExportArchive(
			exportItems,
			metadataReferences,
			fileBlobs,
			metadataBlobs
		);
		setToolProgress(4, 5, t('Export archive created.'));
		const fileName = `${exportName}.zip`;
		downloadBlob(archive, fileName);
		appendToolLog(t('Downloaded: {fileName}', { fileName }));
		const summary = t('Export downloaded: {fileName}', { fileName });
		setToolStatus(summary);
		finishToolRun(summary);
	} catch (error) {
		const message = error instanceof Error ? error.message : t('Export failed.');
		setToolStatus(message, 'error');
		finishToolRun(message, 'error');
	} finally {
		setBusy(primaryActionButton, false);
		updateActionBar();
	}
}

async function downloadSelectedPackages(): Promise<void> {
	const packages = getSelectedPackages();
	if (!packages.length) return;

	setBusy(primaryActionButton, true, t('Downloading...'));
	startToolRun(
		t('Download Packages'),
		packages.length,
		t('Downloading {count} package(s)...', { count: packages.length })
	);
	try {
		let downloaded = 0;
		let skipped = 0;
		let failed = 0;

		for (let index = 0; index < packages.length; index += 1) {
			const pkg = packages[index];
			const label = getPackageLabel(pkg);
			const downloadUrl = getAutomationAnywherePackageDownloadUrl(pkg);
			if (!downloadUrl) {
				skipped += 1;
				appendToolLog(t('Skipped: {label} - missing pkgDownloadUrl', { label }), 'warn');
				setToolProgress(index + 1, packages.length, t('Processed {count}/{total}', {
					count: index + 1,
					total: packages.length,
				}));
				if (index < packages.length - 1) await delay(300);
				continue;
			}

			try {
				const fileName = getPackageJarFileName(pkg);
				downloadUrlFile(downloadUrl, fileName);
				downloaded += 1;
				appendToolLog(t('Downloaded: {fileName}', { fileName }));
			} catch (error) {
				failed += 1;
				appendToolLog(
					t('Failed: {name} - {message}', {
						name: label,
						message: error instanceof Error ? error.message : t('download failed'),
					}),
					'error'
				);
			}
			setToolProgress(index + 1, packages.length, t('Processed {count}/{total}', {
				count: index + 1,
				total: packages.length,
			}));
			if (index < packages.length - 1) await delay(300);
		}

		const summary = t(
			'Download packages done. Downloaded {downloaded}, skipped {skipped}, failed {failed}.',
			{ downloaded, skipped, failed }
		);
		const severity = skipped || failed ? 'warn' : 'info';
		setToolStatus(summary, severity);
		finishToolRun(summary, severity);
	} catch (error) {
		const message = error instanceof Error ? error.message : t('Download packages failed.');
		setToolStatus(message, 'error');
		finishToolRun(message, 'error');
	} finally {
		setBusy(primaryActionButton, false);
		updateActionBar();
	}
}

async function loadTaskbotJson(): Promise<void> {
	const activeRuntime = runtime;
	const fileId = activeRuntime?.context.fileId;
	const selectedTool = currentTool;
	if (!activeRuntime || !fileId || selectedTool !== 'taskbot-json') return;

	setSelectedToolPanel(selectedTool);
	taskbotJsonMeta.textContent = t('File {fileId}', { fileId });
	taskbotJson.value = '';
	taskbotJsonFileId = fileId;
	try {
		const content = await activeRuntime.api.getBotContent(fileId);
		if (runtime !== activeRuntime || currentTool !== selectedTool || taskbotJsonFileId !== fileId) {
			return;
		}
		taskbotJson.value = JSON.stringify(content, null, 2);
		validateTaskbotJson();
		setToolStatus(t('Taskbot JSON loaded.'));
	} catch (error) {
		if (runtime !== activeRuntime || currentTool !== selectedTool || taskbotJsonFileId !== fileId) {
			return;
		}
		setToolStatus(
			error instanceof Error ? error.message : t('Taskbot JSON load failed.'),
			'error'
		);
	}
}

async function copyTaskbotJson(): Promise<void> {
	if (!taskbotJson.value.trim()) {
		setToolStatus(t('Taskbot JSON is empty.'), 'warn');
		return;
	}
	try {
		await navigator.clipboard.writeText(taskbotJson.value);
		setToolStatus(t('Taskbot JSON copied.'));
	} catch {
		setToolStatus(t('Clipboard write failed.'), 'error');
	}
}

function formatTaskbotJson(): void {
	try {
		taskbotJson.value = options.prettyJson(taskbotJson.value);
		JSON.parse(taskbotJson.value);
		validateTaskbotJson();
		setToolStatus(t('Taskbot JSON formatted.'));
	} catch (error) {
		validateTaskbotJson();
		setToolStatus(error instanceof Error ? error.message : t('Invalid JSON.'), 'error');
	}
}

function validateTaskbotJson(): boolean {
	const value = taskbotJson.value.trim();
	if (!value) {
		taskbotJson.classList.remove('is-invalid');
		taskbotJson.removeAttribute('aria-invalid');
		taskbotJsonError.textContent = '';
		taskbotJsonError.hidden = true;
		return true;
	}

	try {
		JSON.parse(taskbotJson.value);
		taskbotJson.classList.remove('is-invalid');
		taskbotJson.removeAttribute('aria-invalid');
		taskbotJsonError.textContent = '';
		taskbotJsonError.hidden = true;
		return true;
	} catch (error) {
		taskbotJson.classList.add('is-invalid');
		taskbotJson.setAttribute('aria-invalid', 'true');
		taskbotJsonError.textContent = error instanceof Error ? error.message : t('Invalid JSON.');
		taskbotJsonError.hidden = false;
		return false;
	}
}

async function saveTaskbotJson(): Promise<void> {
	const activeRuntime = runtime;
	const fileId = taskbotJsonFileId;
	if (!activeRuntime || !fileId) return;

	let parsed: unknown;
	try {
		if (!validateTaskbotJson()) {
			setToolStatus(taskbotJsonError.textContent || t('Invalid JSON.'), 'error');
			return;
		}
		parsed = JSON.parse(taskbotJson.value);
	} catch (error) {
		setToolStatus(error instanceof Error ? error.message : t('Invalid JSON.'), 'error');
		return;
	}

	if (!window.confirm(t('Update taskbot content in Control Room?'))) return;
	try {
		await activeRuntime.api.updateBotContent(fileId, parsed);
		const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
		if (tab?.id) await browser.tabs.reload(tab.id);
		setToolStatus(t('Taskbot JSON saved.'));
	} catch (error) {
		setToolStatus(error instanceof Error ? error.message : t('Taskbot JSON save failed.'), 'error');
	}
}

function dedupeAutomationAnywhereFiles(
	items: AutomationAnywhereFile[]
): AutomationAnywhereFile[] {
	const byId = new Map<string, AutomationAnywhereFile>();
	for (const item of items) {
		const id = getAutomationAnywhereFileId(item);
		if (!id) continue;
		byId.set(id, { ...byId.get(id), ...item });
	}
	return [...byId.values()];
}

function isExportTaskbot(file: AutomationAnywhereFile): boolean {
	const type = getAutomationAnywhereFileType(file);
	return (
		type === AUTOMATION_ANYWHERE_TASKBOT_TYPE ||
		type === AUTOMATION_ANYWHERE_TASKBOT_TEMPLATE_TYPE
	);
}

async function scanMetadataReferences(
	activeRuntime: ToolsRuntime,
	taskbots: AutomationAnywhereFile[]
): Promise<ExportMetadataReference[]> {
	const references: ExportMetadataReference[] = [];
	for (let index = 0; index < taskbots.length; index += EXPORT_BATCH_SIZE) {
		const batch = taskbots.slice(index, index + EXPORT_BATCH_SIZE);
		const results = await Promise.allSettled(
			batch.map(async (bot) => {
				const content = await activeRuntime.api.getBotContent(getAutomationAnywhereFileId(bot));
				const paths = collectMetadataPaths(content);
				return paths.map((metadataPath) => ({
					fileId: getAutomationAnywhereFileId(bot),
					botPath: getAutomationAnywherePath(bot),
					metadataPath,
					fileName: getPathFileName(metadataPath),
				}));
			})
		);

		for (const result of results) {
			if (result.status === 'fulfilled') {
				references.push(...result.value);
			} else {
				appendToolLog(
					t('Metadata scan skipped: {message}', {
						message: getErrorMessage(result.reason),
					}),
					'warn'
				);
			}
		}
		appendToolLog(
			t('Metadata scan progress: {count}/{total}', {
				count: Math.min(index + batch.length, taskbots.length),
				total: taskbots.length,
			})
		);
	}
	return references;
}

function collectMetadataPaths(value: unknown, paths = new Set<string>()): string[] {
	if (!value || typeof value !== 'object') return [...paths];
	if (Array.isArray(value)) {
		for (const item of value) collectMetadataPaths(item, paths);
		return [...paths];
	}

	for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
		if (key.endsWith('MetadataPath') && typeof item === 'string' && item) {
			paths.add(item);
		}
		if (item && typeof item === 'object') collectMetadataPaths(item, paths);
	}
	return [...paths];
}

async function downloadExportFiles(
	activeRuntime: ToolsRuntime,
	items: AutomationAnywhereFile[],
	rootIds: Set<string>
): Promise<Map<string, Blob>> {
	const blobs = new Map<string, Blob>();
	for (let index = 0; index < items.length; index += EXPORT_BATCH_SIZE) {
		const batch = items.slice(index, index + EXPORT_BATCH_SIZE);
		const results = await Promise.allSettled(
			batch.map(async (item) => {
				const id = getAutomationAnywhereFileId(item);
				const response = await activeRuntime.api.downloadFileContent(id);
				return { id, item, blob: automationAnywhereBlobResponseToBlob(response) };
			})
		);

		for (const result of results) {
			if (result.status === 'fulfilled') {
				blobs.set(result.value.id, result.value.blob);
				continue;
			}
			const item = batch[results.indexOf(result)];
			const id = getAutomationAnywhereFileId(item);
			const message = `${getAutomationAnywhereFileName(item)} - ${getErrorMessage(
				result.reason
			)}`;
			if (rootIds.has(id)) {
				throw new Error(t('Selected bot download failed: {message}', { message }));
			}
			appendToolLog(t('Dependency omitted: {message}', { message }), 'warn');
		}
		appendToolLog(
			t('File download progress: {count}/{total}', {
				count: Math.min(index + batch.length, items.length),
				total: items.length,
			})
		);
	}
	return blobs;
}

async function downloadMetadataFiles(
	activeRuntime: ToolsRuntime,
	references: ExportMetadataReference[]
): Promise<Map<string, Blob>> {
	const blobs = new Map<string, Blob>();
	for (let index = 0; index < references.length; index += EXPORT_BATCH_SIZE) {
		const batch = references.slice(index, index + EXPORT_BATCH_SIZE);
		const results = await Promise.allSettled(
			batch.map(async (reference) => {
				const response = await activeRuntime.api.downloadMetadataContent(
					reference.fileId,
					reference.metadataPath
				);
				return {
					key: getMetadataKey(reference),
					reference,
					blob: automationAnywhereBlobResponseToBlob(response),
				};
			})
		);

		for (const result of results) {
			if (result.status === 'fulfilled') {
				blobs.set(result.value.key, result.value.blob);
				continue;
			}
			appendToolLog(
				t('Metadata omitted: {message}', {
					message: getErrorMessage(result.reason),
				}),
				'warn'
			);
		}
		appendToolLog(
			t('Metadata download progress: {count}/{total}', {
				count: Math.min(index + batch.length, references.length),
				total: references.length,
			})
		);
	}
	return blobs;
}

async function createExportArchive(
	items: AutomationAnywhereFile[],
	metadataReferences: ExportMetadataReference[],
	fileBlobs: Map<string, Blob>,
	metadataBlobs: Map<string, Blob>
): Promise<Blob> {
	const zip = new JSZip();
	const fileEntries: ExportManifestEntry[] = [];
	const metadataEntries: ExportManifestEntry[] = [];
	const scannedDependencies = buildScannedDependencyPaths(items);

	for (const item of items) {
		const id = getAutomationAnywhereFileId(item);
		const blob = fileBlobs.get(id);
		if (!blob) continue;
		const path = getAutomationAnywherePath(item);
		addBlobToZip(zip, path, blob);
		fileEntries.push(createDependencyManifestEntry(item, scannedDependencies.get(id) ?? []));
	}

	for (const reference of metadataReferences) {
		const blob = metadataBlobs.get(getMetadataKey(reference));
		if (!blob) continue;
		addBlobToZip(zip, getMetadataZipPath(reference), blob);
		metadataEntries.push(createMetadataManifestEntry(reference));
	}

	const manifest: ExportManifest = {
		files: [...fileEntries, ...metadataEntries],
		packages: [],
		globalValues: [],
	};
	zip.file('manifest.json', JSON.stringify(manifest, null, 2));
	return zip.generateAsync({
		type: 'blob',
		compression: 'DEFLATE',
		compressionOptions: { level: 6 },
	});
}

function addBlobToZip(zip: JSZip, path: string, blob: Blob): void {
	const parts = splitAutomationPath(path);
	if (!parts.length) return;
	let folder = zip;
	for (const part of parts.slice(0, -1)) {
		const next = folder.folder(part);
		if (!next) throw new Error(t('Failed to create ZIP folder: {folder}', { folder: part }));
		folder = next;
	}
	folder.file(parts[parts.length - 1], blob);
}

function buildScannedDependencyPaths(
	items: AutomationAnywhereFile[]
): Map<string, string[]> {
	const pathsById = new Map(
		items.map((item) => [getAutomationAnywhereFileId(item), getAutomationAnywherePath(item)])
	);
	const dependencies = new Map<string, string[]>();
	for (const item of items) {
		const parentId = getOptionalString(item.requiredByFileId);
		if (!parentId || parentId === '0' || !pathsById.has(parentId)) continue;
		if (!dependencies.has(parentId)) dependencies.set(parentId, []);
		dependencies.get(parentId)?.push(getAutomationAnywherePath(item));
	}
	return dependencies;
}

function createDependencyManifestEntry(
	item: AutomationAnywhereFile,
	scannedDependencies: string[]
): ExportManifestEntry {
	return {
		path: getAutomationAnywherePath(item),
		newPath: null,
		contentType: getFileContentType(item),
		metadataForFile: null,
		manualDependencies: [],
		scannedDependencies,
		manualDependenciesNewPaths: [],
		scannedDependenciesNewPaths: [],
		description: '',
		author: '',
		tags: getFileTags(item),
		excluded: false,
	};
}

function createMetadataManifestEntry(reference: ExportMetadataReference): ExportManifestEntry {
	return {
		path: `${reference.botPath}\\${reference.fileName}`,
		newPath: null,
		contentType: getContentTypeFromPath(reference.fileName),
		metadataForFile: reference.botPath,
		manualDependencies: null,
		scannedDependencies: null,
		manualDependenciesNewPaths: [],
		scannedDependenciesNewPaths: [],
		description: '',
		author: '',
		tags: [],
		excluded: false,
	};
}

function getFileContentType(item: AutomationAnywhereFile): string {
	return (
		getAutomationAnywhereFileType(item) ||
		getContentTypeFromPath(getAutomationAnywherePath(item)) ||
		'application/octet-stream'
	);
}

function getContentTypeFromPath(path: string): string {
	const extension = path.toLowerCase().split('.').pop() ?? '';
	return CONTENT_TYPE_BY_EXTENSION[extension] ?? 'application/octet-stream';
}

function getAutomationAnywherePath(item: AutomationAnywhereFile): string {
	const path = getOptionalString(item.path);
	if (path) return path;
	return getAutomationAnywhereFileName(item);
}

function splitAutomationPath(path: string): string[] {
	return path.split(/[\\/]+/).filter(Boolean);
}

function getPathFileName(path: string): string {
	return splitAutomationPath(path).pop() || path;
}

function getMetadataZipPath(reference: ExportMetadataReference): string {
	const botPath = splitAutomationPath(reference.botPath);
	const botFileName = botPath.pop() || reference.botPath;
	return [...botPath, `${botFileName}Metadata`, reference.fileName].join('\\');
}

function getOptionalString(value: unknown): string | null {
	if (typeof value === 'string' && value) return value;
	if (typeof value === 'number') return String(value);
	return null;
}

function getFileTags(item: AutomationAnywhereFile): string[] {
	return Array.isArray(item.tags) ? item.tags.filter((tag): tag is string => typeof tag === 'string') : [];
}

function getMetadataKey(reference: ExportMetadataReference): string {
	return `${reference.fileId}\u0000${reference.metadataPath}`;
}

function getErrorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error || 'request failed');
}

function stringifyForFeedback(value: unknown): string {
	if (value === undefined) return '';
	if (typeof value === 'string') return value;
	try {
		return JSON.stringify(value);
	} catch {
		return String(value);
	}
}

function getPackageLabel(pkg: AutomationAnywherePackage): string {
	const name = getAutomationAnywherePackageName(pkg) || 'package';
	const version = getAutomationAnywherePackageVersion(pkg) || 'unknown';
	return `${name} ${version}`;
}

function sanitizeDownloadFileName(value: string): string {
	const sanitized = value
		.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
		.replace(/\s+/g, ' ')
		.trim()
		.replace(/[. ]+$/g, '');
	return sanitized || 'package';
}

function getPackageJarFileName(pkg: AutomationAnywherePackage): string {
	const name = getAutomationAnywherePackageName(pkg) || 'package';
	const version = getAutomationAnywherePackageVersion(pkg) || 'unknown';
	return `${sanitizeDownloadFileName(`${name}-${version}`)}.jar`;
}

function downloadUrlFile(url: string, fileName: string): void {
	const anchor = document.createElement('a');
	anchor.href = url;
	anchor.download = fileName;
	document.body.appendChild(anchor);
	anchor.click();
	anchor.remove();
}

function delay(milliseconds: number): Promise<void> {
	return new Promise((resolve) => {
		setTimeout(resolve, milliseconds);
	});
}

function downloadBlob(blob: Blob, fileName: string): void {
	const url = URL.createObjectURL(blob);
	const anchor = document.createElement('a');
	anchor.href = url;
	anchor.download = fileName;
	document.body.appendChild(anchor);
	anchor.click();
	anchor.remove();
	setTimeout(() => URL.revokeObjectURL(url), 1000);
}
