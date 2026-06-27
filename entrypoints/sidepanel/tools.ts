import {
	AutomationAnywhereApi,
	AUTOMATION_ANYWHERE_TASKBOT_TYPE,
	applyPackageVersionsToContent,
	automationAnywhereBlobResponseToBlob,
	dedupeAutomationAnywhereFiles,
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
	type AutomationAnywherePackageUsage,
	type AutomationAnywherePackageUsageStatus,
} from '@/src/ts/automation-anywhere-api';
import { isAutomationAnywhereUrl } from '@/src/ts/automation-anywhere';
import {
	initializeJsonWorkbench,
	renderJsonWorkbenchActionButtons,
	renderJsonWorkbenchSearchTools,
	type JsonWorkbench,
} from './json-workbench';
import { t } from '@/src/ts/i18n';
import {
	getAvailableAutomationAnywhereTools,
	getAutomationAnywherePackageUpdates,
	getAutomationAnywherePackageUsageStatusFilter,
	getDefaultTaskbotTool,
	hasMoreAutomationAnywherePackageUsage,
	type AutomationAnywhereToolId,
} from '@/src/ts/automation-anywhere-tools';
import type {
	ContentActionResponse,
	RuntimeMessage,
	ToolCapabilities,
} from '@/src/ts/messages';
type FeedbackSeverity = 'info' | 'warn' | 'error';
type ToolId = AutomationAnywhereToolId;
type ToolListItem = AutomationAnywhereFile | AutomationAnywherePackage;
type ExportFormat = 'zip' | 'separate';

interface ZipWriter {
	folder(name: string): ZipWriter | null;
	file(name: string, data: Blob | string): unknown;
}

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
		details?: Record<string, unknown>,
		options?: { keepDetails?: boolean; debugOnly?: boolean }
	): void | Promise<void>;
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
	exportSummary: {
		selectedTaskbotIds: string[];
		dependencyIds: Array<{ id: string; name: string; version: string | null }>;
		includedNonTaskbotFiles: string[];
	};
}

interface ExportPackageReference {
	name: string;
	version: string;
}

interface ExportTaskbotScan {
	metadataReferences: ExportMetadataReference[];
	packages: ExportPackageReference[];
}

interface ToolRunState {
	runId: string;
	title: string;
	total: number;
	completed: number;
	lines: Array<{ message: string; severity: FeedbackSeverity }>;
	startedAt: number;
}

const PAGE_LENGTH = 200;
const PACKAGE_PAGE_LENGTH = 20;
const PACKAGE_SEARCH_MIN_LENGTH = 2;
const PACKAGE_SEARCH_DEBOUNCE_MS = 300;
const EXPORT_BATCH_SIZE = 20;
const AUTOMATION_ANYWHERE_TASKBOT_TEMPLATE_TYPE = 'application/vnd.aa.taskbot+template';
const CURRENT_TASKBOT_FALLBACK_NAME = 'Current bot';
const EXPORT_BOTS_LEGACY_MODE_KEY = 'exportBotsLegacyMode';
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
let taskbotJsonBaseline: string | null = null;
let activeToolRun: ToolRunState | null = null;
let refreshToolsContextTimer: ReturnType<typeof setTimeout> | null = null;
let packageSearchTimer: ReturnType<typeof setTimeout> | null = null;

let contextText: HTMLElement;
let toolsClipboardStatus: HTMLElement;
let toolsHelpMatrix: HTMLElement;
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
let pasteActionButton: HTMLButtonElement;
let pasteActionWrapper: HTMLElement;
let loadMoreButton: HTMLButtonElement;
let toolsActionHint: HTMLElement;
let toolsProgress: HTMLElement;
let toolsProgressLabel: HTMLElement;
let toolsProgressPercent: HTMLElement;
let toolsProgressBar: HTMLElement;
let toolsProgressFill: HTMLElement;
let toolsExportFormat: HTMLElement;
let toolsExportFormatZip: HTMLInputElement;
let toolsExportFormatSeparate: HTMLInputElement;
let toolsExportPackageInfo: HTMLElement;
let toolsPackageListContent: HTMLElement;
let toolsCopyPackageList: HTMLButtonElement;
let packageUsageSection: HTMLElement;
let packageUsageSummary: HTMLElement;
let packageUsageList: HTMLElement;
let toolsFinishModal: HTMLElement;
let toolsFinishTitle: HTMLElement;
let toolsFinishSummary: HTMLElement;
let toolsFinishLog: HTMLElement;
let toolsFinishClose: HTMLButtonElement;
let taskbotSection: HTMLElement;
let taskbotJson: HTMLTextAreaElement;
let taskbotJsonMeta: HTMLElement;
let taskbotJsonWorkbench: JsonWorkbench;
let taskbotJsonSaveButton: HTMLButtonElement;
let exportPackageListText = '';
let exportFormat: ExportFormat = 'zip';
let exportBotsLegacyMode = false;
let packageUsageItems: AutomationAnywherePackageUsage[] = [];
let packageUsagePackageKey = '';
let packageQuery = '';
let packageScanOffset = 0;
let packageFallbackScan = false;
let packageListLoading = false;
let packageUsageLoading = false;
let currentTaskbotPackageEmptyText = '';
const packageListCache = new Map<string, AutomationAnywherePackage[]>();
const packageListRefreshes = new Set<string>();

export function renderToolsPanel(renderOptions: RenderToolsPanelOptions = {}): string {
	return `
		<section class="tab-panel is-active" role="tabpanel" data-panel="tools">
			<section class="panel-section">
				<div class="section-heading-row">
					<h2>${t('Tools')}</h2>
					<span class="tools-refresh-group">
						<span id="toolsAvailabilityDot" class="tools-availability-dot" data-available="false" role="status" tabindex="0" aria-label="${t('Tools unavailable')}" title="${t('Green = tools available. Red = no tools here.')}"></span>
						<button id="toolsRefresh" class="icon-button tools-refresh-button" type="button" aria-label="${t('Refresh tools')}" title="${t('Refresh tools')}" data-has-tools="false">
							<span aria-hidden="true">&#8635;</span>
						</button>
					</span>
				</div>
				<p id="toolsContext" class="tools-context">${t('Open an Automation Anywhere folder, taskbot, or Packages page.')}</p>
				<p class="inline-hint">${t('Open an Automation Anywhere folder, taskbot, or Packages page, then refresh.')}</p>
				<p id="toolsClipboardStatus" class="tools-clipboard-status" hidden></p>
				<div id="toolsActions" class="tool-action-grid"></div>
				<div id="toolsHelpMatrix" class="tools-help-matrix" hidden>
					<p class="inline-hint">${t('Tools appear when the active tab is on a supported Automation Anywhere page.')}</p>
					<dl>
						<div>
							<dt>${t('Taskbot editor')}</dt>
							<dd>${t('Universal Clipboard, Taskbot JSON, Update Packages, Export Bots')}</dd>
						</div>
						<div>
							<dt>${t('Folder view')}</dt>
							<dd>${t('Copy Files, Update Packages, Export Bots')}</dd>
						</div>
						<div>
							<dt>${t('Packages page')}</dt>
							<dd>${t('Download Packages, Package Usage')}</dd>
						</div>
					</dl>
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
				<div id="toolsExportFormat" class="tools-export-format" role="radiogroup" aria-labelledby="toolsExportFormatLabel" hidden>
					<span id="toolsExportFormatLabel" class="tools-export-format-label">${t('Export format')}</span>
					<label class="tools-export-format-option">
						<input id="toolsExportFormatZip" type="radio" name="toolsExportFormat" value="zip" aria-describedby="toolsExportFormatZipHint">
						<span>${t('ZIP (single archive)')}</span>
						<small id="toolsExportFormatZipHint" class="inline-hint">${t('Includes taskbot dependencies and uploaded files; produces one .zip file.')}</small>
					</label>
					<label class="tools-export-format-option">
						<input id="toolsExportFormatSeparate" type="radio" name="toolsExportFormat" value="separate" aria-describedby="toolsExportFormatSeparateHint">
						<span>${t('Separate files')}</span>
						<small id="toolsExportFormatSeparateHint" class="inline-hint">${t('Downloads each selected file individually.')}</small>
					</label>
				</div>
				<div class="tools-action-bar">
					<button id="toolsPrimaryAction" type="button" disabled title="${t('Run selected tool action.')}">${t('Run')}</button>
					<span id="toolsPasteActionWrapper">
						<button id="toolsPasteAction" type="button" hidden title="${t('Paste into this folder. Duplicates are skipped.')}">${t('Paste copied files')}</button>
					</span>
				</div>
				<div id="packageUsageSection" class="package-usage-section" hidden>
					<div class="tools-export-package-header">
						<strong class="package-list-label">${t('Package usage')}</strong>
						<span id="packageUsageSummary" class="tools-count"></span>
					</div>
					<div id="packageUsageList" class="package-usage-list"></div>
				</div>
				<div id="toolsExportPackageInfo" class="tools-export-package-info" hidden>
					<div class="tools-export-package-header">
						<strong class="package-list-label">${t('Packages used:')}</strong>
						<button id="toolsCopyPackageList" type="button" title="${t('Copy package list to clipboard.')}">${t('Copy')}</button>
					</div>
					<div id="toolsPackageListContent" class="package-list-content"></div>
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
					<h2 id="taskbotJsonTitle">${t('Taskbot JSON')}</h2>
					<span id="taskbotJsonMeta" class="tools-count"></span>
				</div>
				<div id="taskbotJsonContent" class="taskbot-json-content">
					<p class="inline-hint">${t('Advanced: saves raw bot content back to Control Room.')}</p>
					${renderJsonWorkbenchSearchTools('taskbotJson')}
					<textarea id="taskbotJson" class="json-area tools-json-area" spellcheck="false" aria-describedby="taskbotJsonError"></textarea>
					<p id="taskbotJsonError" class="json-inline-error" hidden></p>
					<div id="taskbotPackageList" class="taskbot-package-list" hidden></div>
					<div class="button-grid">
						${renderJsonWorkbenchActionButtons('taskbotJson', {
							copyLabel: 'Copy to clipboard',
							copyHelp: 'Copy textarea JSON to system clipboard.',
							formatLabel: 'Format',
							exportLabel: 'Export JSON',
							exportHelp: 'Download textarea JSON as a .json file.',
						})}
						<button id="taskbotSaveJson" type="button">${t('Import JSON to control room')}</button>
					</div>
				</div>
			</section>

		</section>
	`;
}

export function initializeToolsPanel(initOptions: InitializeToolsOptions): void {
	options = initOptions;
	contextText = getRequiredElement('#toolsContext');
	toolsClipboardStatus = getRequiredElement('#toolsClipboardStatus');
	toolsHelpMatrix = getRequiredElement('#toolsHelpMatrix');
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
	pasteActionButton = getRequiredElement<HTMLButtonElement>('#toolsPasteAction');
	pasteActionWrapper = getRequiredElement('#toolsPasteActionWrapper');
	loadMoreButton = getRequiredElement<HTMLButtonElement>('#toolsLoadMore');
	toolsActionHint = getRequiredElement('#toolsActionHint');
	toolsProgress = getRequiredElement('#toolsProgress');
	toolsProgressLabel = getRequiredElement('#toolsProgressLabel');
	toolsProgressPercent = getRequiredElement('#toolsProgressPercent');
	toolsProgressBar = getRequiredElement('#toolsProgressBar');
	toolsProgressFill = getRequiredElement('#toolsProgressFill');
	toolsExportFormat = getRequiredElement('#toolsExportFormat');
	toolsExportFormatZip = getRequiredElement<HTMLInputElement>('#toolsExportFormatZip');
	toolsExportFormatSeparate = getRequiredElement<HTMLInputElement>('#toolsExportFormatSeparate');
	toolsExportPackageInfo = getRequiredElement('#toolsExportPackageInfo');
	toolsPackageListContent = getRequiredElement('#toolsPackageListContent');
	toolsCopyPackageList = getRequiredElement<HTMLButtonElement>('#toolsCopyPackageList');
	packageUsageSection = getRequiredElement('#packageUsageSection');
	packageUsageSummary = getRequiredElement('#packageUsageSummary');
	packageUsageList = getRequiredElement('#packageUsageList');
	toolsFinishModal = getRequiredElement('#toolsFinishModal');
	toolsFinishTitle = getRequiredElement('#toolsFinishTitle');
	toolsFinishSummary = getRequiredElement('#toolsFinishSummary');
	toolsFinishLog = getRequiredElement('#toolsFinishLog');
	toolsFinishClose = getRequiredElement<HTMLButtonElement>('#toolsFinishClose');
	taskbotSection = getRequiredElement('#taskbotJsonSection');
	taskbotJson = getRequiredElement<HTMLTextAreaElement>('#taskbotJson');
	taskbotJsonMeta = getRequiredElement('#taskbotJsonMeta');
	taskbotJsonSaveButton = getRequiredElement<HTMLButtonElement>('#taskbotSaveJson');
	taskbotJsonWorkbench = initializeJsonWorkbench({
		idPrefix: 'taskbotJson',
		textarea: taskbotJson,
		errorElement: getRequiredElement('#taskbotJsonError'),
		detailsContainer: getRequiredElement('#taskbotPackageList'),
		setStatus: setToolStatus,
		getExportFileName: () => `taskbot-${taskbotJsonFileId ?? 'json'}.json`,
		onChange: updateTaskbotJsonMutationState,
		emptyMessage: t('Taskbot JSON is empty.'),
		copiedMessage: t('Taskbot JSON copied.'),
		formattedMessage: t('Taskbot JSON formatted.'),
	});

	refreshButton.addEventListener('click', () => {
		void refreshToolsContext();
	});
	searchInput.addEventListener('input', handleToolsSearchInput);
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
	toolsExportFormatZip.addEventListener('change', updateExportFormatFromInput);
	toolsExportFormatSeparate.addEventListener('change', updateExportFormatFromInput);
	toolsCopyPackageList.addEventListener('click', () => {
		void copyExportPackageList();
	});
	toolsFinishClose.addEventListener('click', hideToolFinishModal);
	toolsFinishModal.addEventListener('click', (event) => {
		if (event.target === toolsFinishModal) hideToolFinishModal();
	});
	taskbotJsonSaveButton.addEventListener('click', () => {
		void saveTaskbotJson();
	});
	resetExportFormatToDefault();
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

function clearPackageSearchTimer(): void {
	if (!packageSearchTimer) return;
	clearTimeout(packageSearchTimer);
	packageSearchTimer = null;
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

function clearExportPackageInfo(): void {
	exportPackageListText = '';
	toolsPackageListContent.textContent = '';
	toolsExportPackageInfo.hidden = true;
}

function clearPackageUsageResults(): void {
	packageUsageLoading = false;
	packageUsageItems = [];
	packageUsagePackageKey = '';
	renderPackageUsageResults();
}

function resetToolProgress(): void {
	toolsProgress.hidden = true;
	toolsProgressLabel.textContent = t('Idle');
	toolsProgressPercent.textContent = '0%';
	toolsProgressBar.setAttribute('aria-valuenow', '0');
	toolsProgressBar.setAttribute('aria-valuetext', t('Idle'));
	toolsProgressFill.style.width = '0';
}

function isPackageTool(tool: ToolId | null = currentTool): boolean {
	return tool === 'download-packages' || tool === 'package-usage';
}

function getPackageSearchQuery(): string {
	const query = searchInput.value.trim();
	return query.length >= PACKAGE_SEARCH_MIN_LENGTH ? query : '';
}

function handleToolsSearchInput(): void {
	if (!isPackageTool()) {
		renderFileList();
		return;
	}
	clearPackageSearchTimer();
	const query = searchInput.value.trim();
	packageQuery = query.length >= PACKAGE_SEARCH_MIN_LENGTH ? query : '';
	if (query && query.length < PACKAGE_SEARCH_MIN_LENGTH) {
		packageListLoading = false;
		loadedItems = [];
		selectedIds = new Set<string>();
		loadedOffset = 0;
		loadedTotal = 0;
		lastRawPageLength = 0;
		packageScanOffset = 0;
		packageFallbackScan = false;
		if (currentTool === 'package-usage') clearPackageUsageResults();
		resetToolProgress();
		renderFileList();
		setToolStatus(t('Type at least {count} characters to search packages.', {
			count: PACKAGE_SEARCH_MIN_LENGTH,
		}));
		return;
	}
	packageSearchTimer = setTimeout(() => {
		packageSearchTimer = null;
		void loadPackagePage(true, { keepSearch: true });
	}, PACKAGE_SEARCH_DEBOUNCE_MS);
}

function readExportBotsLegacyMode(): boolean {
	try {
		const value = window.localStorage.getItem(EXPORT_BOTS_LEGACY_MODE_KEY);
		return value === 'true' || value === '1';
	} catch {
		return false;
	}
}

function getDefaultExportFormat(): ExportFormat {
	return readExportBotsLegacyMode() ? 'separate' : 'zip';
}

function resetExportFormatToDefault(): void {
	exportBotsLegacyMode = readExportBotsLegacyMode();
	exportFormat = getDefaultExportFormat();
	updateExportFormatControls();
}

function updateExportFormatControls(): void {
	const zipDisabled = exportBotsLegacyMode;
	if (zipDisabled && exportFormat === 'zip') exportFormat = 'separate';
	toolsExportFormatZip.checked = exportFormat === 'zip';
	toolsExportFormatSeparate.checked = exportFormat === 'separate';
	toolsExportFormatZip.disabled = zipDisabled;
	const zipLabel = toolsExportFormatZip.closest('.tools-export-format-option');
	zipLabel?.classList.toggle('is-disabled', zipDisabled);
	zipLabel?.setAttribute('aria-disabled', String(zipDisabled));
}

function updateExportFormatFromInput(): void {
	exportFormat = toolsExportFormatZip.checked ? 'zip' : 'separate';
	updateExportFormatControls();
	updateActionBar();
}

function getActiveExportFormat(): ExportFormat {
	return exportBotsLegacyMode ? 'separate' : exportFormat;
}

function setExportFormatVisible(visible: boolean): void {
	toolsExportFormat.hidden = !visible;
}

function normalizePackageReference(
	pkg: ExportPackageReference
): ExportPackageReference | null {
	const name = pkg.name.trim();
	const version = pkg.version.trim();
	return name && version ? { name, version } : null;
}

function getPackageReferenceKey(pkg: ExportPackageReference): string {
	return `${pkg.name}\u0000${pkg.version}`;
}

function sortPackageReferences(
	packages: ExportPackageReference[]
): ExportPackageReference[] {
	return [...packages].sort((left, right) => {
		const leftKey = getPackageReferenceKey(left).toLowerCase();
		const rightKey = getPackageReferenceKey(right).toLowerCase();
		if (leftKey < rightKey) return -1;
		if (leftKey > rightKey) return 1;
		return 0;
	});
}

function addPackageReferences(
	packagesByKey: Map<string, ExportPackageReference>,
	packages: ExportPackageReference[]
): void {
	for (const pkg of packages) {
		const normalized = normalizePackageReference(pkg);
		if (!normalized) continue;
		packagesByKey.set(getPackageReferenceKey(normalized), normalized);
	}
}

function formatPackageReference(pkg: ExportPackageReference): string {
	return `${pkg.name} ${pkg.version}`;
}

function showExportPackageInfo(packages: ExportPackageReference[]): void {
	const sortedPackages = sortPackageReferences(packages);
	exportPackageListText = sortedPackages.map(formatPackageReference).join(', ');
	toolsPackageListContent.textContent = exportPackageListText || t('No packages found.');
	toolsExportPackageInfo.hidden = false;
}

function normalizeTaskbotJsonContent(content: unknown): string {
	return JSON.stringify(content) ?? 'undefined';
}

function updateTaskbotJsonMutationState(): void {
	taskbotJsonSaveButton.disabled =
		!taskbotJsonWorkbench || !taskbotJsonWorkbench.canParseJson();
}

async function copyExportPackageList(): Promise<void> {
	if (!exportPackageListText) {
		setToolStatus(t('No packages found.'), 'warn');
		return;
	}
	try {
		await navigator.clipboard.writeText(exportPackageListText);
		setToolStatus(t('Package list copied.'));
	} catch {
		setToolStatus(t('Clipboard write failed.'), 'error');
	}
}

function addRunLine(message: string, severity: FeedbackSeverity = 'info'): void {
	activeToolRun?.lines.push({ message, severity });
}

function createToolRunId(): string {
	if (crypto.randomUUID) return crypto.randomUUID();
	return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function appendToolLog(
	message: string,
	severity: FeedbackSeverity = 'info',
	details?: Record<string, unknown>
): void {
	addRunLine(message, severity);
	void options.addFeedback(
		severity,
		'tools',
		message,
		{
			...(activeToolRun ? { runId: activeToolRun.runId } : {}),
			...(currentTool ? { tool: currentTool } : {}),
			...details,
		},
		{ keepDetails: true, debugOnly: severity === 'info' }
	);
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
		runId: createToolRunId(),
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
	void options.addFeedback(
		severity,
		'tools',
		t('{title} run finished.', { title: run.title }),
		{
			runId: run.runId,
			tool: currentTool,
			title: run.title,
			total: run.total,
			completed: run.completed,
			durationMs: Date.now() - run.startedAt,
			summary,
		},
		{ keepDetails: true, debugOnly: severity === 'info' }
	);
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

function setToolsHelpMatrixVisible(visible: boolean): void {
	toolsHelpMatrix.hidden = !visible;
	toolsHelpMatrix.setAttribute('aria-hidden', String(!visible));
}

function isFolderTool(
	tool: ToolId | null
): tool is 'copy-files' | 'update-packages' | 'export-bots' {
	return tool === 'copy-files' || tool === 'update-packages' || tool === 'export-bots';
}

function isCurrentTaskbotTool(
	tool: ToolId | null
): tool is 'update-packages' | 'export-bots' {
	return tool === 'update-packages' || tool === 'export-bots';
}

function isListTool(
	tool: ToolId | null
): tool is 'copy-files' | 'update-packages' | 'export-bots' | 'download-packages' | 'package-usage' {
	return isFolderTool(tool) || tool === 'download-packages' || tool === 'package-usage';
}

function setToolPanelHidden(panel: HTMLElement, hidden: boolean): void {
	panel.hidden = hidden;
	panel.setAttribute('aria-hidden', String(hidden));
}

function setSelectedToolPanel(tool: ToolId | null): void {
	setToolPanelHidden(universalClipboardSection, tool !== 'universal-clipboard');
	setToolPanelHidden(taskbotSection, tool !== 'taskbot-json');
	setToolPanelHidden(fileSection, !isListTool(tool));
	setExportFormatVisible(tool === 'export-bots');
}

async function refreshToolsContext(): Promise<void> {
	clearPackageSearchTimer();
	currentTaskbotPackageEmptyText = '';
	actionsContainer.textContent = '';
	clearExportPackageInfo();
	clearPackageUsageResults();
	resetToolProgress();
	setSelectedToolPanel(null);
	taskbotJsonWorkbench.setValue('');
	taskbotJsonFileId = null;
	taskbotJsonBaseline = null;
	updateCopiedFilesStatus();
	updateAvailabilityDot(false);
	setToolsHelpMatrixVisible(false);

	try {
		const active = await getActiveAutomationAnywhereContext();
		if (!active || active.context.pageType === 'unsupported') {
			runtime = null;
			currentTool = null;
			contextText.textContent = getUnsupportedToolsContextText(active);
			setSelectedToolPanel(null);
			renderActionButtons();
			setToolsHelpMatrixVisible(true);
			void options.addFeedback(
				'info',
				'tools',
				t('Tools context unsupported.'),
				active
					? {
							pageType: active.context.pageType,
							host: active.context.hostname,
						}
					: { reason: 'no-active-tab' },
				{ keepDetails: true, debugOnly: true }
			);
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
		void options.addFeedback(
			'info',
			'tools',
			t('Tools context loaded.'),
			{
				tabId: active.tabId,
				pageType: active.context.pageType,
				host: active.context.hostname,
				fileId: active.context.fileId,
				folderId: active.context.folderId,
				capabilities,
				tools,
			},
			{ keepDetails: true, debugOnly: true }
		);
		updateAvailabilityDot(tools.length > 0);
		setToolsHelpMatrixVisible(tools.length === 0);

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

		if (isTaskbotContext(active.context)) {
			currentTool = getDefaultTaskbotTool(active.context, capabilities);
			if (!currentTool) return;
			if (currentTool === 'export-bots') resetExportFormatToDefault();
			setSelectedToolPanel(currentTool);
			renderActionButtons();
			if (currentTool === 'taskbot-json') await loadTaskbotJson();
			else if (currentTool !== 'universal-clipboard') await loadListPage(true);
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
		void options.addFeedback(
			'error',
			'tools',
			t('Tools context failed.'),
			{ error },
			{ keepDetails: true }
		);
	}
}

function getUnsupportedToolsContextText(
	active: ActiveAutomationAnywhereContext | null
): string {
	if (!active) return t('Open an Automation Anywhere folder, taskbot, or Packages page.');
	if (!isAutomationAnywhereUrl(active.context.url) && active.context.hostname) {
		return t(
			'No tools for {host}. Open an Automation Anywhere folder, taskbot, or Packages page.',
			{ host: active.context.hostname }
		);
	}
	return t('Unsupported Automation Anywhere page. Open a folder, taskbot, or Packages page.');
}

async function getToolCapabilities(tabId: number): Promise<ToolCapabilities> {
	try {
		const response = (await browser.tabs.sendMessage(tabId, {
			type: 'GET_TOOL_CAPABILITIES',
		})) as ContentActionResponse | undefined;
		return response?.ok && response.capabilities
			? response.capabilities
			: EMPTY_TOOL_CAPABILITIES;
	} catch (error) {
		void options.addFeedback(
			'warn',
			'tools',
			t('Tool capabilities unavailable.'),
			{ tabId, error },
			{ keepDetails: true }
		);
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
		if (context.packageName) {
			return t('Package {name} on {host}', {
				name: context.packageName,
				host: context.hostname,
			});
		}
		return t('Packages on {host}', { host: context.hostname });
	}
	return t('Unsupported page.');
}

function isFolderContext(context: AutomationAnywherePageContext): boolean {
	return context.pageType === 'private-folder' || context.pageType === 'public-folder';
}

function isTaskbotContext(context: AutomationAnywherePageContext | undefined): boolean {
	return context?.pageType === 'private-taskbot' || context?.pageType === 'public-taskbot';
}

function isCurrentTaskbotMode(): boolean {
	return Boolean(runtime && isTaskbotContext(runtime.context) && isCurrentTaskbotTool(currentTool));
}

function isCurrentTaskbotPackageSelectionMode(): boolean {
	return Boolean(
		runtime?.context.pageType === 'private-taskbot' &&
			runtime.context.mode === 'edit' &&
			currentTool === 'update-packages'
	);
}

function getPackageDetailsName(): string | null {
	return runtime?.context.pageType === 'packages' && runtime.context.packageName
		? runtime.context.packageName
		: null;
}

function isPackageDetailsUsageMode(): boolean {
	return currentTool === 'package-usage' && Boolean(getPackageDetailsName());
}

function getAvailableTools(
	context: AutomationAnywherePageContext,
	capabilities: ToolCapabilities = runtime?.capabilities ?? EMPTY_TOOL_CAPABILITIES
): ToolId[] {
	return getAvailableAutomationAnywhereTools(context, capabilities);
}

function getToolLabel(tool: ToolId): string {
	if (tool === 'universal-clipboard') return t('Universal Clipboard');
	if (tool === 'copy-files') return t('Copy Files');
	if (tool === 'update-packages') return t('Update Packages');
	if (tool === 'export-bots') return t('Export Bots');
	if (tool === 'download-packages') return t('Download Packages');
	if (tool === 'package-usage') return t('Package Usage');
	return t('Taskbot JSON');
}

function getToolActionHelp(tool: ToolId): string {
	if (tool === 'universal-clipboard') return t('Use saved AA clipboard slots.');
	if (tool === 'copy-files') return t('Copy file references inside this extension.');
	if (tool === 'update-packages') return t('Apply default package versions to selected bots.');
	if (tool === 'export-bots') return t('Export selected files as a ZIP or separate downloads.');
	if (tool === 'download-packages') return t('Download packages from this page.');
	if (tool === 'package-usage') return t('Find bots using selected package version.');
	return t('Load and edit raw taskbot JSON.');
}

function getPrimaryActionHelp(tool: ToolId | null): string {
	if (tool === 'copy-files') return t('Store selected file references inside extension.');
	if (tool === 'update-packages') {
		return isCurrentTaskbotPackageSelectionMode()
			? t('Update selected packages using Control Room default versions.')
			: t('Update selected bots using default package versions.');
	}
	if (tool === 'export-bots') {
		return getActiveExportFormat() === 'zip'
			? t('Create one ZIP with taskbot dependencies and uploaded files.')
			: t('Download each selected file individually.');
	}
	if (tool === 'download-packages') return t('Download selected package JAR files.');
	if (tool === 'package-usage' && getPackageDetailsName()) {
		return t('Show usage for all used versions of this package.');
	}
	if (tool === 'package-usage') return t('Show bots using selected package version.');
	return t('Run selected tool action.');
}

function getToolInlineHint(tool: ToolId | null): string {
	if (tool === 'copy-files') {
		return t('Stores file references inside extension. Open another folder on same host to paste.');
	}
	if (tool === 'update-packages') {
		return isCurrentTaskbotPackageSelectionMode()
			? t('Select outdated packages to update to Control Room defaults.')
			: t('Updates selected taskbots using package defaults from this Control Room.');
	}
	if (tool === 'export-bots') {
		return getActiveExportFormat() === 'zip'
			? t('ZIP includes selected files and taskbot dependencies.')
			: t('Downloads selected files one at a time.');
	}
	if (tool === 'download-packages') return t('Downloads selected packages from the Packages page.');
	if (tool === 'package-usage' && getPackageDetailsName()) {
		return t('Only versions with usage are shown. Missing versions have no usage found.');
	}
	if (tool === 'package-usage') return t('Shows bots using one selected package version.');
	return '';
}

function renderActionButtons(): void {
	const context = runtime?.context;
	actionsContainer.textContent = '';
	if (!context) return;

	for (const tool of getAvailableTools(context)) {
		const button = document.createElement('button');
		button.type = 'button';
		button.textContent = getToolLabel(tool);
		button.dataset.toolAction = tool;
		button.className = tool === currentTool ? 'is-active tool-action-button' : 'tool-action-button';
		button.title = getToolActionHelp(tool);
		button.addEventListener('click', () => {
			void selectTool(tool);
		});
		actionsContainer.appendChild(button);
	}
}

async function selectTool(tool: ToolId): Promise<void> {
	const wasPackageTool = isPackageTool();
	clearPackageSearchTimer();
	currentTool = tool;
	clearExportPackageInfo();
	clearPackageUsageResults();
	resetToolProgress();
	if (tool === 'export-bots') resetExportFormatToDefault();
	renderActionButtons();
	setSelectedToolPanel(tool);

	if (tool === 'universal-clipboard') return;

	if (tool === 'taskbot-json') {
		await loadTaskbotJson();
		return;
	}

	if (tool === 'package-usage' && getPackageDetailsName()) {
		loadedItems = [];
		selectedIds = new Set<string>();
		loadedOffset = 0;
		loadedTotal = 0;
		lastRawPageLength = 0;
		searchInput.value = '';
		renderFileList();
		await loadPackageDetailsUsage();
		return;
	}

	if (isPackageTool(tool)) {
		await loadPackagePage(true, { keepSearch: wasPackageTool });
		return;
	}

	await loadListPage(true);
}

async function loadListPage(reset: boolean): Promise<void> {
	if (currentTool === 'download-packages' || currentTool === 'package-usage') {
		await loadPackagePage(reset);
		return;
	}
	if (isCurrentTaskbotMode()) {
		await loadCurrentTaskbotPage(reset);
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
			taskbotsOnly: selectedTool === 'update-packages',
			filesOnly: selectedTool === 'copy-files' || selectedTool === 'export-bots',
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

function createCurrentTaskbotFallback(fileId: string): AutomationAnywhereFile {
	return {
		id: fileId,
		name: CURRENT_TASKBOT_FALLBACK_NAME,
		mimeType: AUTOMATION_ANYWHERE_TASKBOT_TYPE,
	};
}

async function findCurrentTaskbotInFolder(
	activeRuntime: ToolsRuntime,
	folderId: string,
	fileId: string
): Promise<AutomationAnywhereFile | null> {
	for (let offset = 0; ; offset += PAGE_LENGTH) {
		const response = await activeRuntime.api.listFolderContents({
			folderId,
			offset,
			length: PAGE_LENGTH,
			filesOnly: true,
		});
		const list = response.list ?? [];
		const match = list.find((item) => getAutomationAnywhereFileId(item) === fileId);
		if (match) return match;
		if (list.length < PAGE_LENGTH) return null;
	}
}

async function loadCurrentTaskbotPackagePage(
	activeRuntime: ToolsRuntime,
	selectedTool: ToolId,
	fileId: string,
	reset: boolean
): Promise<void> {
	setBusy(loadMoreButton, true, t('Loading...'));
	packageListLoading = true;
	if (reset) {
		loadedItems = [];
		selectedIds = new Set<string>();
		loadedOffset = 0;
		loadedTotal = 0;
		lastRawPageLength = 0;
		searchInput.value = '';
		currentTaskbotPackageEmptyText = '';
	}
	renderFileList();
	setToolStatus(t('Loading outdated packages...'));

	try {
		const [content, defaults] = await Promise.all([
			activeRuntime.api.getBotContent(fileId),
			activeRuntime.api.getDefaultPackageVersions(),
		]);
		if (runtime !== activeRuntime || currentTool !== selectedTool) return;
		if (!defaults.size) {
			currentTaskbotPackageEmptyText = t('No default package versions found.');
			setToolStatus(currentTaskbotPackageEmptyText, 'error');
			return;
		}

		const updates = getAutomationAnywherePackageUpdates(
			extractAutomationAnywherePackages(content),
			defaults
		);
		loadedItems = updates.map((update) => ({
			packageName: update.name,
			packageVersion: update.currentVersion,
			targetVersion: update.targetVersion,
		}));
		selectedIds = new Set(loadedItems.map(getToolItemId));
		loadedOffset = loadedItems.length;
		loadedTotal = loadedItems.length;
		lastRawPageLength = loadedItems.length;
		currentTaskbotPackageEmptyText = t('All package versions are current.');
		setSelectedToolPanel(selectedTool);
		setToolStatus(
			t('{count} outdated package(s) loaded.', { count: loadedItems.length })
		);
	} catch (error) {
		if (runtime !== activeRuntime || currentTool !== selectedTool) return;
		currentTaskbotPackageEmptyText =
			error instanceof Error ? error.message : t('Package list failed.');
		setToolStatus(currentTaskbotPackageEmptyText, 'error');
	} finally {
		if (runtime === activeRuntime && currentTool === selectedTool) {
			packageListLoading = false;
			renderFileList();
			setBusy(loadMoreButton, false, t('Load more'));
		}
	}
}

async function loadCurrentTaskbotPage(reset: boolean): Promise<void> {
	const activeRuntime = runtime;
	const context = activeRuntime?.context;
	const fileId = context?.fileId;
	const selectedTool = currentTool;
	if (!activeRuntime || !context || !fileId || !isCurrentTaskbotTool(selectedTool)) return;
	if (isCurrentTaskbotPackageSelectionMode()) {
		await loadCurrentTaskbotPackagePage(activeRuntime, selectedTool, fileId, reset);
		return;
	}

	setBusy(loadMoreButton, true, t('Loading current bot...'));
	if (reset) {
		loadedItems = [];
		selectedIds = new Set<string>();
		loadedOffset = 0;
		loadedTotal = 0;
		lastRawPageLength = 0;
		searchInput.value = '';
	}

	try {
		const folderId = context.folderId ? String(context.folderId) : null;
		const resolved = folderId
			? await findCurrentTaskbotInFolder(activeRuntime, folderId, fileId)
			: null;
		if (runtime !== activeRuntime || currentTool !== selectedTool) return;

		const item = resolved ?? createCurrentTaskbotFallback(fileId);
		loadedItems = [item];
		selectedIds = new Set([getAutomationAnywhereFileId(item)]);
		loadedOffset = 1;
		loadedTotal = 1;
		lastRawPageLength = 1;
		renderFileList();
		setSelectedToolPanel(selectedTool);
		setToolStatus(
			resolved ? t('Current bot loaded.') : t('Current bot loaded from ID fallback.')
		);
	} catch (error) {
		if (runtime !== activeRuntime || currentTool !== selectedTool) return;
		const item = createCurrentTaskbotFallback(fileId);
		loadedItems = [item];
		selectedIds = new Set([getAutomationAnywhereFileId(item)]);
		loadedOffset = 1;
		loadedTotal = 1;
		lastRawPageLength = 1;
		renderFileList();
		setSelectedToolPanel(selectedTool);
		setToolStatus(
			error instanceof Error
				? t('Current bot loaded from ID fallback: {message}', { message: error.message })
				: t('Current bot loaded from ID fallback.'),
			'warn'
		);
	} finally {
		if (runtime === activeRuntime && currentTool === selectedTool) {
			setBusy(loadMoreButton, false, t('Load more'));
		}
	}
}

function getResponseTotal(response: {
	page?: { totalFilter?: number; total?: number };
	total?: number;
}): number {
	return response.page?.totalFilter ?? response.page?.total ?? response.total ?? 0;
}

function packageMatchesQuery(pkg: AutomationAnywherePackage, query: string): boolean {
	const name = getAutomationAnywherePackageName(pkg).toLowerCase();
	return name.includes(query.toLowerCase());
}

function packageMatchesFilter(
	pkg: AutomationAnywherePackage,
	query: string,
	exactName: string | null
): boolean {
	return exactName
		? getAutomationAnywherePackageName(pkg) === exactName
		: !query || packageMatchesQuery(pkg, query);
}

function getPackageListCacheKey(
	activeRuntime: ToolsRuntime,
	query: string,
	exactName: string | null
): string {
	return [activeRuntime.context.baseUrl, exactName ?? '', query].join('\u0000');
}

function cacheCurrentPackageList(cacheKey: string): void {
	packageListCache.set(cacheKey, loadedItems.filter(isAutomationAnywherePackageItem));
}

function hydratePackageListCache(items: AutomationAnywherePackage[]): void {
	loadedItems = [...items];
	loadedOffset = items.length;
	loadedTotal = items.length;
	lastRawPageLength = items.length;
	packageScanOffset = 0;
	packageFallbackScan = false;
	pruneSelection();
	renderFileList();
}

async function refreshPackageListCache(
	cacheKey: string,
	activeRuntime: ToolsRuntime,
	selectedTool: ToolId,
	query: string,
	exactName: string | null
): Promise<void> {
	if (packageListRefreshes.has(cacheKey)) return;
	packageListRefreshes.add(cacheKey);
	try {
		const response = await activeRuntime.api.listPackages({
			offset: 0,
			length: PACKAGE_PAGE_LENGTH,
			query: query || undefined,
			exactName: exactName || undefined,
		});
		const responseList = response.list ?? [];
		const filterIgnored = responseList.some(
			(item) => !packageMatchesFilter(item, query, exactName)
		);
		if (filterIgnored || (exactName && !responseList.length)) return;

		const rawList = responseList.filter((item) =>
			packageMatchesFilter(item, query, exactName)
		);
		packageListCache.set(cacheKey, rawList);
		if (
			runtime !== activeRuntime ||
			currentTool !== selectedTool ||
			getPackageListCacheKey(activeRuntime, packageQuery, getPackageDetailsName()) !== cacheKey
		) return;
		hydratePackageListCache(rawList);
		setToolStatus(t('Package list refreshed.'));
	} catch (error) {
		if (
			runtime !== activeRuntime ||
			currentTool !== selectedTool ||
			getPackageListCacheKey(activeRuntime, packageQuery, getPackageDetailsName()) !== cacheKey
		) return;
		setToolStatus(
			error instanceof Error ? error.message : t('Package list failed.'),
			'warn'
		);
	} finally {
		packageListRefreshes.delete(cacheKey);
	}
}

async function scanPackagesFallback(
	activeRuntime: ToolsRuntime,
	selectedTool: ToolId,
	query: string,
	exactName: string | null
): Promise<void> {
	packageFallbackScan = true;
	const targetCount = loadedItems.length + PACKAGE_PAGE_LENGTH;
	const byId = new Map(loadedItems.map((item) => [getToolItemId(item), item]));

	for (;;) {
		const response = await activeRuntime.api.listPackages({
			offset: packageScanOffset,
			length: PAGE_LENGTH,
		});
		if (runtime !== activeRuntime || currentTool !== selectedTool) return;

		const rawList = response.list ?? [];
		lastRawPageLength = rawList.length;
		loadedTotal = getResponseTotal(response);
		packageScanOffset += PAGE_LENGTH;
		for (const item of rawList) {
			if (packageMatchesFilter(item, query, exactName)) {
				byId.set(getToolItemId(item), item);
			}
		}
		loadedItems = [...byId.values()];
		if (loadedItems.length >= targetCount || rawList.length < PAGE_LENGTH) break;
	}

	loadedOffset = loadedItems.length;
	packageListLoading = false;
	pruneSelection();
	renderFileList();
	setSelectedToolPanel(selectedTool);
	cacheCurrentPackageList(getPackageListCacheKey(activeRuntime, query, exactName));
	setToolStatus(
		exactName
			? t('{count} package version(s) loaded.', { count: loadedItems.length })
			: t('{count} package(s) loaded.', { count: loadedItems.length })
	);
}

async function loadPackagePage(
	reset: boolean,
	options: { keepSearch?: boolean } = {}
): Promise<void> {
	const activeRuntime = runtime;
	const selectedTool = currentTool;
	const packageDetailsName = getPackageDetailsName();
	if (
		!activeRuntime ||
		(selectedTool !== 'download-packages' && selectedTool !== 'package-usage')
	) {
		return;
	}

	let cacheKey = getPackageListCacheKey(activeRuntime, packageQuery, packageDetailsName);
	setBusy(loadMoreButton, true, reset ? t('Loading...') : t('Loading more...'));
	if (reset) {
		packageListLoading = true;
		loadedItems = [];
		selectedIds = new Set<string>();
		loadedOffset = 0;
		loadedTotal = 0;
		lastRawPageLength = 0;
		packageScanOffset = 0;
		packageFallbackScan = false;
		if (!options.keepSearch) searchInput.value = '';
		packageQuery = packageDetailsName ? '' : getPackageSearchQuery();
		cacheKey = getPackageListCacheKey(activeRuntime, packageQuery, packageDetailsName);
		resetToolProgress();
		if (selectedTool === 'package-usage') clearPackageUsageResults();
		const cached = packageListCache.get(cacheKey);
		if (cached) {
			packageListLoading = false;
			hydratePackageListCache(cached);
			setSelectedToolPanel(selectedTool);
			setBusy(loadMoreButton, false, t('Load more'));
			setToolStatus(t('Showing cached packages. Refreshing...'));
			void refreshPackageListCache(
				cacheKey,
				activeRuntime,
				selectedTool,
				packageQuery,
				packageDetailsName
			);
			return;
		}
		renderFileList();
		setToolStatus(t('Loading packages...'));
	}

	try {
		if (packageFallbackScan) {
			await scanPackagesFallback(
				activeRuntime,
				selectedTool,
				packageQuery,
				packageDetailsName
			);
			return;
		}

		const response = await activeRuntime.api.listPackages({
			offset: loadedOffset,
			length: PACKAGE_PAGE_LENGTH,
			query: packageQuery || undefined,
			exactName: packageDetailsName || undefined,
		});
		if (runtime !== activeRuntime || currentTool !== selectedTool) return;
		const responseList = response.list ?? [];
		const filterIgnored = responseList.some(
			(item) => !packageMatchesFilter(item, packageQuery, packageDetailsName)
		);
		if (filterIgnored || (packageDetailsName && reset && !responseList.length)) {
			await scanPackagesFallback(activeRuntime, selectedTool, packageQuery, packageDetailsName);
			return;
		}
		const rawList = responseList.filter((item) =>
			packageMatchesFilter(item, packageQuery, packageDetailsName)
		);
		lastRawPageLength = responseList.length;
		const byId = new Map(loadedItems.map((item) => [getToolItemId(item), item]));
		for (const item of rawList) byId.set(getToolItemId(item), item);
		loadedItems = [...byId.values()];
		loadedOffset += PACKAGE_PAGE_LENGTH;
		loadedTotal = getResponseTotal(response) || Math.max(loadedItems.length, loadedTotal);
		packageListLoading = false;
		pruneSelection();
		renderFileList();
		setSelectedToolPanel(selectedTool);
		cacheCurrentPackageList(cacheKey);
		const message = packageDetailsName
			? t('{count} package version(s) loaded.', { count: loadedItems.length })
			: t('{count} package(s) loaded.', { count: loadedItems.length });
		setToolStatus(message);
	} catch (error) {
		if (runtime !== activeRuntime || currentTool !== selectedTool) return;
		if (packageQuery || packageDetailsName) {
			await scanPackagesFallback(
				activeRuntime,
				selectedTool,
				packageQuery,
				packageDetailsName
			);
			return;
		}
		setToolStatus(
			error instanceof Error ? error.message : t('Package list failed.'),
			'error'
		);
	} finally {
		if (runtime === activeRuntime && currentTool === selectedTool) {
			packageListLoading = false;
			renderFileList();
			setBusy(loadMoreButton, false, t('Load more'));
		}
	}
}

function filterItemsForTool(
	items: AutomationAnywhereFile[],
	tool: ToolId
): AutomationAnywhereFile[] {
	if (tool === 'copy-files' || tool === 'export-bots') {
		return items.filter((item) => !isAutomationAnywhereFolder(item));
	}
	if (tool === 'update-packages') {
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

function getAutomationAnywherePackageTargetVersion(pkg: AutomationAnywherePackage): string {
	return String(pkg.targetVersion ?? '').trim();
}

function getAutomationAnywherePackageStatus(
	pkg: AutomationAnywherePackage
): AutomationAnywherePackageUsageStatus {
	return getAutomationAnywherePackageUsageStatusFilter(pkg.status ?? pkg.packageStatus);
}

function getAutomationAnywherePackageStatusLabel(pkg: AutomationAnywherePackage): string {
	return getAutomationAnywherePackageStatus(pkg) === 'DISABLED' ? t('Disabled') : t('Enabled');
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
	if (isCurrentTaskbotMode() && !isAutomationAnywherePackageItem(item)) {
		return t('ID: {fileId}', { fileId: getAutomationAnywhereFileId(item) });
	}
	if (!isAutomationAnywherePackageItem(item)) return getItemMeta(item);
	const version = getAutomationAnywherePackageVersion(item) || t('unknown');
	if (isCurrentTaskbotPackageSelectionMode()) {
		return t('Version {current} to {target}', {
			current: version,
			target: getAutomationAnywherePackageTargetVersion(item),
		});
	}
	if (currentTool === 'package-usage') {
		return t('Version {version} | {status}', {
			version,
			status: getAutomationAnywherePackageStatusLabel(item),
		});
	}
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
	const currentTaskbotMode = isCurrentTaskbotMode();
	const packageSelectionMode = isCurrentTaskbotPackageSelectionMode();
	const currentTaskbotFileMode = currentTaskbotMode && !packageSelectionMode;
	const packageUsageMode = currentTool === 'package-usage';
	const packageDetailsName = getPackageDetailsName();
	const packageDetailsUsageMode = isPackageDetailsUsageMode();
	const search = currentTaskbotMode ? '' : searchInput.value.trim().toLowerCase();
	const visible = currentTaskbotMode
		? loadedItems
		: loadedItems.filter((item) =>
				getToolItemSearchText(item).toLowerCase().includes(search)
			);
	searchInput.placeholder =
		currentTool === 'download-packages' || packageUsageMode
			? t('Search packages')
			: t('Search files');
	searchInput.hidden = currentTaskbotMode || Boolean(packageDetailsName);
	const selectAllLabel = selectAllInput.closest<HTMLElement>('.tools-select-all');
	if (selectAllLabel) {
		selectAllLabel.hidden =
			currentTaskbotFileMode || packageUsageMode || packageDetailsUsageMode;
	}

	listTitle.textContent =
		packageSelectionMode
			? t('Outdated packages')
			: currentTaskbotMode
			? t('Current bot')
			: currentTool === 'copy-files'
			? t('Copy Files')
			: currentTool === 'update-packages'
				? t('Update Packages')
				: currentTool === 'export-bots'
					? t('Export Bots')
					: packageUsageMode
						? t('Package Usage')
						: t('Download Packages');
	selectedCountText.textContent = packageDetailsUsageMode && packageDetailsName
		? t('Package {name}', { name: packageDetailsName })
		: currentTaskbotFileMode
		? t('Current bot selected')
		: t('{selected} selected / {loaded} loaded', {
				selected: selectedIds.size,
				loaded: loadedItems.length,
			});
	fileList.textContent = '';

	if (packageListLoading && (isPackageTool() || packageSelectionMode) && !loadedItems.length) {
		appendSkeletonRows(fileList, 6, 'package-list');
	} else if (!packageDetailsUsageMode && !visible.length) {
		const empty = document.createElement('p');
		empty.className = 'tools-empty';
		empty.textContent = packageSelectionMode
			? currentTaskbotPackageEmptyText || t('All package versions are current.')
			: currentTaskbotMode
			? t('Current bot not found.')
			: loadedItems.length
			? t('No matches.')
			: currentTool === 'download-packages' || packageUsageMode
				? t('No packages found.')
				: t('No files found.');
		fileList.appendChild(empty);
	}

	for (const item of visible) {
		const id = getToolItemId(item);
		const row = document.createElement(currentTaskbotFileMode ? 'div' : 'label');
		row.className = 'tool-file-row';
		row.classList.toggle('is-current-taskbot', currentTaskbotFileMode);
		const checkbox = document.createElement('input');
		checkbox.type = 'checkbox';
		checkbox.checked = selectedIds.has(id);
		checkbox.addEventListener('change', () => {
			if (checkbox.checked) {
				if (packageUsageMode) selectedIds = new Set([id]);
				else selectedIds.add(id);
			} else selectedIds.delete(id);
			if (packageUsageMode) clearPackageUsageResults();
			renderFileList();
		});
		const name = document.createElement('strong');
		name.textContent = getToolItemName(item);
		const meta = document.createElement('small');
		meta.textContent = getToolItemMeta(item);
		const text = document.createElement('span');
		text.className = 'tool-file-text';
		text.append(name, meta);
		if (currentTaskbotFileMode) row.append(text);
		else row.append(checkbox, text);
		fileList.appendChild(row);
	}

	const allVisibleSelected =
		visible.length > 0 && visible.every((item) => selectedIds.has(getToolItemId(item)));
	const someVisibleSelected = visible.some((item) => selectedIds.has(getToolItemId(item)));
	selectAllInput.checked = allVisibleSelected;
	selectAllInput.indeterminate = someVisibleSelected && !allVisibleSelected;
	updateActionBar();
}

function appendSkeletonRows(
	container: HTMLElement,
	count: number,
	type: 'package-list' | 'package-usage'
): void {
	const createSpan = (className: string): HTMLSpanElement => {
		const span = document.createElement('span');
		span.className = className;
		return span;
	};

	for (let index = 0; index < count; index++) {
		const row = document.createElement('div');
		row.className = type === 'package-list'
			? 'tool-file-row is-skeleton'
			: 'package-usage-row is-skeleton';
		row.setAttribute('aria-hidden', 'true');

		if (type === 'package-list') {
			const text = createSpan('tool-file-text');
			text.append(
				createSpan('skeleton-bar skeleton-title'),
				createSpan('skeleton-bar skeleton-meta')
			);
			row.append(createSpan('skeleton-checkbox'), text);
		} else {
			const text = createSpan('package-usage-text');
			text.append(
				createSpan('skeleton-bar skeleton-title'),
				createSpan('skeleton-bar skeleton-path'),
				createSpan('skeleton-bar skeleton-meta')
			);
			row.append(text, createSpan('skeleton-bar skeleton-button'));
		}

		container.appendChild(row);
	}
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
	const currentTaskbotMode = isCurrentTaskbotMode();
	const packageDetailsName = getPackageDetailsName();
	const packageDetailsUsageMode = isPackageDetailsUsageMode();
	const usagePackage = currentTool === 'package-usage' ? getSelectedPackageForUsage() : null;
	primaryActionButton.hidden = packageDetailsUsageMode;
	primaryActionButton.disabled =
		currentTool === 'package-usage' ? !usagePackage && !packageDetailsName : count === 0;
	if (currentTool === 'copy-files') primaryActionButton.textContent = t('Copy {count} file(s)', { count });
	if (currentTool === 'update-packages') {
		primaryActionButton.textContent = isCurrentTaskbotPackageSelectionMode()
			? t('Update {count} package(s)', { count })
			: currentTaskbotMode
			? t('Update current bot')
			: t('Update {count} bot(s)', { count });
	}
	if (currentTool === 'export-bots') {
		primaryActionButton.textContent = currentTaskbotMode
			? t('Export current bot')
			: t('Export {count} file(s)', { count });
	}
	if (currentTool === 'download-packages') {
		primaryActionButton.textContent = t('Download {count} package(s)', { count });
	}
	if (currentTool === 'package-usage') {
		primaryActionButton.textContent = t('View usage');
	}
	primaryActionButton.title = getPrimaryActionHelp(currentTool);

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

	loadMoreButton.hidden =
		currentTaskbotMode ||
		Boolean(packageDetailsName) ||
		!hasMoreItems();
}

function hasMoreItems(): boolean {
	if (isPackageTool() && loadedTotal > 0) return loadedItems.length < loadedTotal;
	if (isPackageTool() && packageFallbackScan) return lastRawPageLength >= PAGE_LENGTH;
	if (isPackageTool()) {
		return lastRawPageLength >= PACKAGE_PAGE_LENGTH;
	}
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

function getSelectedPackageForUsage(): AutomationAnywherePackage | null {
	const packages = getSelectedPackages();
	if (packages.length !== 1) return null;
	const name = getAutomationAnywherePackageName(packages[0]);
	const version = getAutomationAnywherePackageVersion(packages[0]);
	return name && version ? packages[0] : null;
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
		return;
	}
	if (currentTool === 'package-usage') {
		if (getPackageDetailsName()) {
			await loadPackageDetailsUsage();
			return;
		}
		await loadSelectedPackageUsage();
	}
}

function getPackageUsageVersion(row: AutomationAnywherePackageUsage): string {
	return String(row.packageVersion ?? t('unknown')).trim() || t('unknown');
}

function getPackageUsageStatusLabel(row: AutomationAnywherePackageUsage): string {
	const value = String(row.packageStatus ?? '').trim().toUpperCase();
	if (value === 'DISABLED') return t('Disabled');
	if (value === 'ENABLED') return t('Enabled');
	return '';
}

function isPackageStatusEnumError(message: string): boolean {
	return message.includes('PackageStatus') && message.includes('No enum constant');
}

function renderPackageUsageResults(): void {
	const visible = currentTool === 'package-usage' && Boolean(packageUsagePackageKey);
	packageUsageSection.hidden = !visible;
	packageUsageSection.setAttribute('aria-hidden', String(!visible));
	if (!visible) {
		packageUsageSummary.textContent = '';
		packageUsageList.textContent = '';
		return;
	}

	packageUsageSummary.textContent = t('{count} usage row(s)', {
		count: packageUsageItems.length,
	});
	packageUsageList.textContent = '';

	if (packageUsageLoading && !packageUsageItems.length) {
		appendSkeletonRows(packageUsageList, 5, 'package-usage');
	} else if (!packageUsageItems.length) {
		const empty = document.createElement('p');
		empty.className = 'tools-empty';
		empty.textContent = t('No usage found for selected package version.');
		packageUsageList.appendChild(empty);
	}

	if (isPackageDetailsUsageMode()) {
		const rowsByVersion = new Map<string, AutomationAnywherePackageUsage[]>();
		for (const row of packageUsageItems) {
			const version = getPackageUsageVersion(row);
			if (!rowsByVersion.has(version)) rowsByVersion.set(version, []);
			rowsByVersion.get(version)?.push(row);
		}
		for (const [version, rows] of rowsByVersion) {
			const group = document.createElement('details');
			group.className = 'package-usage-version-group';
			const summary = document.createElement('summary');
			const heading = document.createElement('h3');
			heading.textContent = t('Version {version}', { version });
			const count = document.createElement('small');
			count.textContent = t('{count} usage row(s)', { count: rows.length });
			summary.append(heading, count);
			group.appendChild(summary);
			for (const row of rows) appendPackageUsageRow(row, group);
			packageUsageList.appendChild(group);
		}
	} else {
		for (const row of packageUsageItems) {
			appendPackageUsageRow(row, packageUsageList);
		}
	}

}

function appendPackageUsageRow(
	row: AutomationAnywherePackageUsage,
	container: HTMLElement
): void {
	const item = document.createElement('div');
	item.className = 'package-usage-row';

	const text = document.createElement('span');
	text.className = 'package-usage-text';

	const name = document.createElement('strong');
	name.textContent = String(row.automationName ?? t('unknown'));

	const path = document.createElement('small');
	path.textContent = String(row.automationPath ?? '');

	const meta = document.createElement('small');
	const defaultVersionText =
		row.defaultVersion === true
			? t('default package version')
			: row.defaultVersion === false
				? t('non-default package version')
				: '';
	meta.textContent = [
		row.updatedOn ? t('Updated {date}', { date: String(row.updatedOn) }) : '',
		row.updatedBy ? t('By {user}', { user: String(row.updatedBy) }) : '',
		getPackageUsageStatusLabel(row),
		defaultVersionText,
	].filter(Boolean).join(' | ');

	text.append(name, path, meta);

	const copyButton = document.createElement('button');
	copyButton.type = 'button';
	copyButton.textContent = t('Copy path');
	copyButton.addEventListener('click', () => {
		void copyPackageUsagePath(row);
	});

	item.append(text, copyButton);
	container.appendChild(item);
}

async function loadSelectedPackageUsage(): Promise<void> {
	const pkg = getSelectedPackageForUsage();
	if (!pkg) return;

	await loadPackageUsage(getToolItemId(pkg), {
		name: getAutomationAnywherePackageName(pkg),
		version: getAutomationAnywherePackageVersion(pkg),
		status: getAutomationAnywherePackageStatus(pkg),
	});
}

async function loadPackageDetailsUsage(): Promise<void> {
	const packageName = getPackageDetailsName();
	if (!packageName) return;

	await loadPackageUsage(packageName, { name: packageName });
}

async function loadPackageUsage(
	packageKey: string,
	request: {
		name: string;
		version?: string;
		status?: AutomationAnywherePackageUsageStatus;
	}
): Promise<void> {
	const activeRuntime = runtime;
	const selectedTool = currentTool;
	if (!activeRuntime || selectedTool !== 'package-usage') return;

	setBusy(primaryActionButton, true, t('Loading usage...'));
	packageUsageLoading = true;
	packageUsageItems = [];
	packageUsagePackageKey = packageKey;
	resetToolProgress();
	renderPackageUsageResults();

	try {
		let offset = 0;
		for (;;) {
			const response = await activeRuntime.api.getPackageUsage({
				...request,
				offset,
				length: PAGE_LENGTH,
			});
			if (runtime !== activeRuntime || currentTool !== selectedTool) return;
			const rawList = response.list ?? [];
			packageUsageItems.push(...rawList);
			offset += rawList.length;
			if (
				!hasMoreAutomationAnywherePackageUsage(
					offset,
					rawList.length,
					getResponseTotal(response),
					PAGE_LENGTH
				)
			) break;
		}
		packageUsageLoading = false;
		renderPackageUsageResults();
		setToolStatus(t('{count} usage row(s) loaded.', { count: packageUsageItems.length }));
	} catch (error) {
		if (runtime !== activeRuntime || currentTool !== selectedTool) return;
		packageUsageLoading = false;
		renderPackageUsageResults();
		const message = error instanceof Error ? error.message : t('Package usage failed.');
		setToolStatus(
			message.startsWith('403 ')
				? t('Manage packages permission required.')
				: isPackageStatusEnumError(message)
					? t('Package status filter failed. Refresh packages and try again.')
				: message,
			'error'
		);
	} finally {
		if (runtime === activeRuntime && currentTool === selectedTool) {
			setBusy(primaryActionButton, false);
			updateActionBar();
		}
	}
}

async function copyPackageUsagePath(row: AutomationAnywherePackageUsage): Promise<void> {
	const path = String(row.automationPath ?? '').trim();
	if (!path) {
		setToolStatus(t('No path found.'), 'warn');
		return;
	}
	try {
		await navigator.clipboard.writeText(path);
		setToolStatus(t('Path copied.'));
	} catch (error) {
		setToolStatus(error instanceof Error ? error.message : t('Copy failed.'), 'error');
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
	}, { keepDetails: true, debugOnly: true });
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

async function updateCurrentTaskbotPackages(activeRuntime: ToolsRuntime): Promise<void> {
	const fileId = activeRuntime.context.fileId;
	if (!fileId) return;
	const versions = new Map<string, string>();
	for (const pkg of getSelectedPackages()) {
		const name = getAutomationAnywherePackageName(pkg);
		const targetVersion = getAutomationAnywherePackageTargetVersion(pkg);
		if (name && targetVersion) versions.set(name, targetVersion);
	}
	if (!versions.size) return;

	const selectedNames = new Set(versions.keys());
	const removeUpdatedRows = (): void => {
		loadedItems = loadedItems.filter(
			(item) => !selectedNames.has(getToolItemName(item))
		);
		selectedIds = new Set<string>();
		loadedOffset = loadedItems.length;
		loadedTotal = loadedItems.length;
		lastRawPageLength = loadedItems.length;
		currentTaskbotPackageEmptyText = t('All package versions are current.');
		renderFileList();
	};

	setBusy(primaryActionButton, true, t('Updating...'));
	startToolRun(
		t('Update Packages'),
		1,
		t('Updating {count} package(s)...', { count: versions.size })
	);
	try {
		const content = await activeRuntime.api.getBotContent(fileId);
		const updates = getAutomationAnywherePackageUpdates(
			extractAutomationAnywherePackages(content),
			versions
		);
		const result = applyPackageVersionsToContent(content, versions);
		if (!updates.length || !result.changed) {
			removeUpdatedRows();
			const message = t('Selected packages are already current.');
			setToolProgress(1, 1, message);
			setToolStatus(message);
			finishToolRun(message, 'info');
			return;
		}

		await activeRuntime.api.updateBotContent(fileId, result.content);
		removeUpdatedRows();
		const message = t('Updated {count} package(s) in current bot.', {
			count: updates.length,
		});
		appendToolLog(message);
		setToolProgress(1, 1, message);
		setToolStatus(message);
		finishToolRun(message, 'info');
		try {
			await browser.tabs.reload(activeRuntime.tabId);
		} catch {
			// Successful package writes must not appear as failures.
		}
	} catch (error) {
		const message = error instanceof Error ? error.message : t('Update packages failed.');
		setToolStatus(message, 'error');
		finishToolRun(message, 'error');
	} finally {
		setBusy(primaryActionButton, false);
		updateActionBar();
	}
}

async function updateSelectedPackages(): Promise<void> {
	const activeRuntime = runtime;
	if (!activeRuntime) return;
	if (isCurrentTaskbotPackageSelectionMode()) {
		await updateCurrentTaskbotPackages(activeRuntime);
		return;
	}
	const bots = getSelectedFiles();
	if (!bots.length) return;

	const taskbotTabId = isTaskbotContext(activeRuntime.context)
		? activeRuntime.tabId
		: undefined;

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

		if (updated > 0 && taskbotTabId !== undefined) {
			try {
				await browser.tabs.reload(taskbotTabId);
			} catch {
				// swallow — successful package writes must not appear as failures
			}
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
	const files = getSelectedFiles();
	if (!files.length) return;

	clearExportPackageInfo();
	setBusy(primaryActionButton, true, t('Exporting...'));
	try {
		if (getActiveExportFormat() === 'zip') {
			startToolRun(
				t('Export Bots'),
				5,
				t('Creating ZIP export for {count} file(s). Do not close sidepanel.', {
					count: files.length,
				})
			);
			try {
				await exportSelectedFilesAsZip(activeRuntime, files);
			} catch (error) {
				const message = getErrorMessage(error);
				appendToolLog(t('ZIP export failed: {message}', { message }), 'error');
				setToolStatus(t('ZIP export failed. Falling back to separate files.'), 'warn');
				await exportSelectedFilesSeparately(activeRuntime, files, true);
			}
		} else {
			startToolRun(
				t('Export Bots'),
				files.length,
				t('Exporting {count} file(s). Do not close sidepanel.', {
					count: files.length,
				})
			);
			await exportSelectedFilesSeparately(activeRuntime, files, true);
		}
	} catch (error) {
		const message = error instanceof Error ? error.message : t('Export failed.');
		setToolStatus(message, 'error');
		finishToolRun(message, 'error');
	} finally {
		setBusy(primaryActionButton, false);
		updateActionBar();
	}
}

async function exportSelectedFilesSeparately(
	activeRuntime: ToolsRuntime,
	files: AutomationAnywhereFile[],
	finishRun: boolean
): Promise<void> {
	let exported = 0;
	let failed = 0;
	setToolProgress(0, files.length, t('Exporting {count} file(s). Do not close sidepanel.', {
		count: files.length,
	}));
	for (let index = 0; index < files.length; index += 1) {
		const file = files[index];
		const fileId = getAutomationAnywhereFileId(file);
		const fileName = getAutomationAnywhereFileName(file);
		setToolProgress(index, files.length, t('Downloading file {count} of {total}: {name}', {
			count: index + 1,
			total: files.length,
			name: fileName,
		}));
		try {
			const response = await activeRuntime.api.downloadFileContent(fileId);
			const blob = automationAnywhereBlobResponseToBlob(response);
			downloadBlob(blob, fileName);
			exported += 1;
			appendToolLog(t('Downloaded: {fileName}', { fileName }));
		} catch (error) {
			failed += 1;
			appendToolLog(
				t('Failed: {name} - {message}', {
					name: fileName,
					message: getErrorMessage(error),
				}),
				'error'
			);
		}
		setToolProgress(index + 1, files.length, t('Processed {count}/{total}', {
			count: index + 1,
			total: files.length,
		}));
		if (index < files.length - 1) await delay(300);
	}
	const summary = t('Export files done. Exported {exported}, failed {failed}.', {
		exported,
		failed,
	});
	const severity = failed ? 'warn' : 'info';
	setToolStatus(summary, severity);
	if (finishRun) finishToolRun(summary, severity);
}

async function exportSelectedFilesAsZip(
	activeRuntime: ToolsRuntime,
	selectedFiles: AutomationAnywhereFile[]
): Promise<void> {
	const selectedIds = new Set(selectedFiles.map(getAutomationAnywhereFileId));
	const selectedTaskbots = selectedFiles.filter(isExportTaskbot);
	const selectedNonTaskbots = selectedFiles.filter((file) => !isExportTaskbot(file));
	let dependencyItems: AutomationAnywhereFile[] = [];

	if (selectedTaskbots.length) {
		setToolProgress(0, 5, t('Fetching taskbot dependencies...'));
		appendToolLog(t('Fetching taskbot dependencies...'));
		const dependencyResponse = await activeRuntime.api.getBotDependencies(
			selectedTaskbots.map(getAutomationAnywhereFileId)
		);
		dependencyItems = dependencyResponse.dependencies ?? [];
		appendToolLog(t('Dependency graph loaded: {count} file(s).', {
			count: dependencyItems.length,
		}));
	} else {
		appendToolLog(t('No taskbots selected. Skipping dependency lookup.'));
	}

	const exportItems = dedupeAutomationAnywhereFiles([...selectedFiles, ...dependencyItems]);
	if (!exportItems.length) throw new Error(t('No files found.'));

	const taskbots = exportItems.filter(isExportTaskbot);
	setToolProgress(1, 5, t('Scanning {count} taskbot file(s) for metadata paths...', {
		count: taskbots.length,
	}));
	appendToolLog(t('Scanning {count} taskbot file(s) for metadata paths...', {
		count: taskbots.length,
	}));
	const taskbotScan = await scanTaskbotExportContent(activeRuntime, taskbots);
	const metadataReferences = taskbotScan.metadataReferences;
	if (metadataReferences.length) {
		appendToolLog(t('Metadata references found: {count}.', {
			count: metadataReferences.length,
		}));
	}
	appendToolLog(t('Package references found: {count}.', {
		count: taskbotScan.packages.length,
	}));
	setToolProgress(2, 5, t('Metadata scan done: {count} reference(s).', {
		count: metadataReferences.length,
	}));

	appendToolLog(
		t('Downloading {count} export file(s)...', {
			count: exportItems.length + metadataReferences.length,
		})
	);
	const fileBlobs = await downloadExportFiles(activeRuntime, exportItems, selectedIds);
	const metadataBlobs = await downloadMetadataFiles(activeRuntime, metadataReferences);
	setToolProgress(3, 5, t('Creating ZIP...'));
	appendToolLog(t('Creating ZIP...'));
	const archive = await createExportArchive(
		exportItems,
		metadataReferences,
		fileBlobs,
		metadataBlobs,
		{
			selectedTaskbotIds: selectedTaskbots.map(getAutomationAnywhereFileId),
			dependencies: dependencyItems,
			includedNonTaskbotFiles: selectedNonTaskbots.map(getAutomationAnywhereFileName),
		}
	);
	setToolProgress(4, 5, t('Download ready.'));
	const fileName = `better-aa-export-${new Date().toISOString().replace(/[:.]/g, '-')}.zip`;
	downloadBlob(archive, fileName);
	appendToolLog(t('Downloaded: {fileName}', { fileName }));
	if (taskbotScan.packages.length) showExportPackageInfo(taskbotScan.packages);
	const summary = t('Export downloaded: {fileName}', { fileName });
	setToolStatus(summary);
	finishToolRun(summary);
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
	taskbotJsonWorkbench.setValue('');
	taskbotJsonBaseline = null;
	taskbotJsonFileId = fileId;
	try {
		const content = await activeRuntime.api.getBotContent(fileId);
		if (runtime !== activeRuntime || currentTool !== selectedTool || taskbotJsonFileId !== fileId) {
			return;
		}
		taskbotJsonBaseline = normalizeTaskbotJsonContent(content);
		taskbotJsonWorkbench.setValue(JSON.stringify(content, null, 2));
		setToolStatus(t('Taskbot JSON loaded.'));
		void options.addFeedback(
			'info',
			'tools',
			t('Taskbot JSON loaded.'),
			{
				tool: 'taskbot-json',
				fileId,
				bytes: taskbotJsonWorkbench.getValue().length,
			},
			{ keepDetails: true, debugOnly: true }
		);
	} catch (error) {
		if (runtime !== activeRuntime || currentTool !== selectedTool || taskbotJsonFileId !== fileId) {
			return;
		}
		setToolStatus(
			error instanceof Error ? error.message : t('Taskbot JSON load failed.'),
			'error'
		);
		taskbotJsonWorkbench.refresh();
	}
}

async function saveTaskbotJson(): Promise<void> {
	const activeRuntime = runtime;
	const fileId = taskbotJsonFileId;
	if (!activeRuntime || !fileId) return;

	let parsed: unknown;
	try {
		if (!taskbotJsonWorkbench.validate()) {
			setToolStatus(t('Invalid JSON.'), 'error');
			return;
		}
		parsed = JSON.parse(taskbotJsonWorkbench.getValue());
	} catch (error) {
		setToolStatus(error instanceof Error ? error.message : t('Invalid JSON.'), 'error');
		return;
	}

	try {
		if (taskbotJsonBaseline) {
			const remoteContent = await activeRuntime.api.getBotContent(fileId);
			const remoteBaseline = normalizeTaskbotJsonContent(remoteContent);
			if (remoteBaseline !== taskbotJsonBaseline) {
				setToolStatus(
					t('Taskbot JSON changed in Control Room. Reload before importing.'),
					'error'
				);
				return;
			}
		}

		const changeStatus =
			taskbotJsonBaseline && normalizeTaskbotJsonContent(parsed) === taskbotJsonBaseline
				? t('unchanged')
				: t('changed');
		if (
			!window.confirm(
				t('Import JSON to Control Room for file {fileId}? Status: {status}.', {
					fileId,
					status: changeStatus,
				})
			)
		) {
			return;
		}

		await activeRuntime.api.updateBotContent(fileId, parsed);
		taskbotJsonBaseline = normalizeTaskbotJsonContent(parsed);
		const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
		if (tab?.id) await browser.tabs.reload(tab.id);
		setToolStatus(t('Taskbot JSON imported to Control Room.'));
		void options.addFeedback(
			'info',
			'tools',
			t('Taskbot JSON imported to Control Room.'),
			{
				tool: 'taskbot-json',
				fileId,
				status: changeStatus,
				bytes: normalizeTaskbotJsonContent(parsed).length,
			},
			{ keepDetails: true, debugOnly: true }
		);
	} catch (error) {
		setToolStatus(error instanceof Error ? error.message : t('Taskbot JSON import failed.'), 'error');
	}
}

function isExportTaskbot(file: AutomationAnywhereFile): boolean {
	const type = getAutomationAnywhereFileType(file);
	return (
		type === AUTOMATION_ANYWHERE_TASKBOT_TYPE ||
		type === AUTOMATION_ANYWHERE_TASKBOT_TEMPLATE_TYPE
	);
}

async function scanTaskbotExportContent(
	activeRuntime: ToolsRuntime,
	taskbots: AutomationAnywhereFile[]
): Promise<ExportTaskbotScan> {
	const metadataReferences: ExportMetadataReference[] = [];
	const packagesByKey = new Map<string, ExportPackageReference>();
	for (let index = 0; index < taskbots.length; index += EXPORT_BATCH_SIZE) {
		const batch = taskbots.slice(index, index + EXPORT_BATCH_SIZE);
		const results = await Promise.allSettled(
			batch.map(async (bot) => {
				const content = await activeRuntime.api.getBotContent(getAutomationAnywhereFileId(bot));
				let packages: ExportPackageReference[] = [];
				let packageError: string | null = null;
				try {
					packages = extractAutomationAnywherePackages(content);
				} catch (error) {
					packageError = getErrorMessage(error);
				}
				const paths = collectMetadataPaths(content);
				return {
					metadataReferences: paths.map((metadataPath) => ({
						fileId: getAutomationAnywhereFileId(bot),
						botPath: getAutomationAnywherePath(bot),
						metadataPath,
						fileName: getPathFileName(metadataPath),
					})),
					packages,
					packageError,
				};
			})
		);

		for (const result of results) {
			if (result.status === 'fulfilled') {
				metadataReferences.push(...result.value.metadataReferences);
				addPackageReferences(packagesByKey, result.value.packages);
				if (result.value.packageError) {
					appendToolLog(
						t('Package scan skipped: {message}', {
							message: result.value.packageError,
						}),
						'warn'
					);
				}
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
	return {
		metadataReferences,
		packages: sortPackageReferences([...packagesByKey.values()]),
	};
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
	selectedIds: Set<string>
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
			if (selectedIds.has(id)) {
				throw new Error(t('Selected file download failed: {message}', { message }));
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
	metadataBlobs: Map<string, Blob>,
	summary: {
		selectedTaskbotIds: string[];
		dependencies: AutomationAnywhereFile[];
		includedNonTaskbotFiles: string[];
	}
): Promise<Blob> {
	const { default: JSZip } = await import('jszip');
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
		exportSummary: {
			selectedTaskbotIds: summary.selectedTaskbotIds,
			dependencyIds: summary.dependencies.map((item) => ({
				id: getAutomationAnywhereFileId(item),
				name: getAutomationAnywhereFileName(item),
				version: getFileVersion(item),
			})),
			includedNonTaskbotFiles: summary.includedNonTaskbotFiles,
		},
	};
	zip.file('manifest.json', JSON.stringify(manifest, null, 2));
	return zip.generateAsync({
		type: 'blob',
		compression: 'DEFLATE',
		compressionOptions: { level: 6 },
	});
}

function addBlobToZip(zip: ZipWriter, path: string, blob: Blob): void {
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

function getFileVersion(item: AutomationAnywhereFile): string | null {
	return (
		getOptionalString(item.version) ||
		getOptionalString(item.fileVersion) ||
		getOptionalString(item.currentVersion) ||
		getOptionalString(item.versionId)
	);
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
