import {
	AutomationAnywhereApi,
	AUTOMATION_ANYWHERE_TASKBOT_TYPE,
	applyPackageVersionsToContent,
	automationAnywhereBlobResponseToBlob,
	dedupeAutomationAnywhereFiles,
	extractAutomationAnywherePackages,
	getAutomationAnywhereContextForTab,
	getAutomationAnywhereAuthToken,
	getAutomationAnywhereFileId,
	getAutomationAnywhereFileName,
	getAutomationAnywhereFileType,
	parseAutomationAnywherePageContext,
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
	canUseSelectedTarget,
	formatControlRoomHostname,
	formatControlRoomPageTitle,
	getEligibleTargetForTab,
	getFirstEligibleTarget,
	getOnlyRoomCurrentEligibleTarget,
	getPreferredRoomTarget,
	getSingleControlRoomOrigin,
	groupAuthenticatedControlRoomTabs,
	markSelectedTargetDisconnected,
	markSelectedTargetRouteChanged,
	type ControlRoomTargetGroup,
	type ControlRoomTabCandidate,
	type SelectedControlRoomTarget,
} from '@/src/ts/control-room-targets';
import { findNonClosingMessageBoxes } from '@/src/ts/automation-anywhere-json';
import {
	getBackgroundJobNotificationsEnabled,
	getNonClosingMessageBoxWarningEnabled,
} from '@/src/ts/settings';
import {
	clearToolJobUnread,
	clearCompletedToolJobs,
	completeToolJob,
	getUnreadToolJobCount,
	createToolJob,
	prependToolJob,
	recoverInterruptedToolJobs,
	requestToolJobStop,
	type ToolJobRecord,
} from '@/src/ts/tool-jobs';
import { browser, storage } from '#imports';
import {
	initializeJsonWorkbench,
	renderJsonWorkbenchActionButtons,
	renderJsonWorkbenchSearchTools,
	type JsonWorkbench,
} from './json-workbench';
import { t } from '@/src/ts/i18n';
import { icon, type BetterAaIconName } from '@/src/ts/icons';
import {
	setSidepanelIconButtonContent,
	setSidepanelIconContent,
} from './icons';
import {
	createDependencyManifestEntry,
	createMetadataManifestEntry,
	getAvailableAutomationAnywhereTools,
	getAutomationAnywherePackageUpdates,
	getAutomationAnywherePackageUsageStatusFilter,
	getDefaultTaskbotTool,
	getImportTaskbotBaseName,
	isAutomationAnywhereLoggedOutError,
	getMetadataZipPath,
	hasMoreAutomationAnywhereItems,
	hasMoreAutomationAnywherePackageUsage,
	isTaskbotContentJson,
	pickAvailableTaskbotName,
	resolveAutomationAnywhereDownloadUrl,
	sanitizeDownloadFileName,
	splitAutomationPath,
	type AutomationAnywhereExportManifestEntry,
	type AutomationAnywhereToolId,
} from '@/src/ts/automation-anywhere-tools';
import type {
	ContentActionResponse,
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

class ToolJobStoppedError extends Error {}

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
	hidden?: boolean;
}

interface ToolsWindowSelection {
	target: SelectedControlRoomTarget | null;
	roomOrigin: string;
}

interface ExportMetadataReference {
	fileId: string;
	botPath: string;
	metadataPath: string;
	fileName: string;
}

interface ExportManifest {
	files: AutomationAnywhereExportManifestEntry[];
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

const PAGE_LENGTH = 200;
const PACKAGE_PAGE_LENGTH = 20;
const PACKAGE_SEARCH_MIN_LENGTH = 2;
const PACKAGE_SEARCH_DEBOUNCE_MS = 300;
const EXPORT_BATCH_SIZE = 20;
const AUTOMATION_ANYWHERE_TASKBOT_TEMPLATE_TYPE = 'application/vnd.aa.taskbot+template';
const CURRENT_TASKBOT_FALLBACK_NAME = 'Current bot';
const ALL_TOOL_IDS: readonly ToolId[] = [
	'universal-clipboard',
	'copy-files',
	'update-packages',
	'export-bots',
	'download-packages',
	'package-usage',
	'taskbot-json',
	'import-taskbot',
];
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
let activeToolRun: ToolJobRecord | null = null;
let packageSearchTimer: ReturnType<typeof setTimeout> | null = null;
let targetGroups: ControlRoomTargetGroup[] = [];
let selectedTarget: SelectedControlRoomTarget | null = null;
let selectedRoomOrigin = '';
let jobHistory: ToolJobRecord[] = [];
let showingJobs = false;
let refreshingTargets = false;
let toolsWindowId: number | undefined;
let pendingActiveTabId: number | null = null;
let targetSyncGeneration = 0;
let contextRefreshGeneration = 0;

function getWindowSelectionStorage(windowId: number) {
	return storage.defineItem<ToolsWindowSelection>(`session:toolsWindowSelection:${windowId}`, {
		fallback: { target: null, roomOrigin: '' },
	});
}

let windowSelectionStorage: ReturnType<typeof getWindowSelectionStorage> | null = null;
const toolJobHistoryStorage = storage.defineItem<ToolJobRecord[]>(
	'session:toolJobHistory',
	{ fallback: [] }
);

let contextText: HTMLElement;
let toolsClipboardStatus: HTMLElement;
let availabilityDot: HTMLElement;
let availabilityText: HTMLElement;
let refreshButton: HTMLButtonElement;
let actionsContainer: HTMLElement;
let roomSelect: HTMLSelectElement;
let pageSelect: HTMLSelectElement;
let toolsWorkspace: HTMLElement;
let toolsJobsSection: HTMLElement;
let toolsJobsButton: HTMLButtonElement;
let toolsJobsBackButton: HTMLButtonElement;
let toolsJobsBadge: HTMLElement;
let toolsJobsList: HTMLElement;
let toolsStopJobButton: HTMLButtonElement;
let universalClipboardSection: HTMLElement;
let fileSection: HTMLElement;
let listTitle: HTMLElement;
let searchInput: HTMLInputElement;
let selectAllInput: HTMLInputElement;
let selectedCountText: HTMLElement;
let fileList: HTMLElement;
let primaryActionButton: HTMLButtonElement;
let packageVersionsButton: HTMLButtonElement;
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
let taskbotSection: HTMLElement;
let importTaskbotSection: HTMLElement;
let importTaskbotFileInput: HTMLInputElement;
let importTaskbotRunButton: HTMLButtonElement;
let taskbotJson: HTMLTextAreaElement;
let taskbotJsonMeta: HTMLElement;
let taskbotJsonWorkbench: JsonWorkbench;
let taskbotJsonSaveButton: HTMLButtonElement;
let exportPackageListText = '';
let exportFormat: ExportFormat = 'zip';
let packageUsageItems: AutomationAnywherePackageUsage[] = [];
let packageUsagePackageKey = '';
let packageQuery = '';
let packageListLoading = false;
let packageLoadGeneration = 0;
let packageSessionExpired = false;
let packageUsageLoading = false;
let currentTaskbotPackageEmptyText = '';
let packageDrilldownName: string | null = null;
let packageRootSearch = '';
const packageListCache = new Map<string, AutomationAnywherePackage[]>();
const packageListRefreshes = new Set<string>();

export function renderToolsPanel(renderOptions: RenderToolsPanelOptions = {}): string {
	return `
		<section id="panel-tools" class="tab-panel${renderOptions.hidden ? '' : ' is-active'}" role="tabpanel" aria-labelledby="tab-tools" tabindex="0" data-panel="tools"${renderOptions.hidden ? ' hidden' : ''}>
			<section id="toolsOverviewSection" class="panel-section">
				<div class="section-heading-row">
					<h2>${t('Tools')}</h2>
					<span class="tools-refresh-group">
						<button id="toolsJobsButton" type="button" hidden>${icon('briefcase-business')}${t('Jobs')} <span id="toolsJobsBadge" class="count-badge" hidden>0</span></button>
						<button id="toolsRefresh" class="icon-button tools-refresh-button" type="button" aria-label="${t('Refresh Control Rooms and page')}" title="${t('Refresh Control Rooms and page')}" data-has-tools="false">
							${icon('refresh-cw', false)}
						</button>
					</span>
				</div>
				<div class="tools-target-group">
					<div class="tools-subheading-row">
						<strong>${t('Target page')}</strong>
						<span class="tools-availability" role="status">
							<span id="toolsAvailabilityDot" class="tools-availability-dot" data-available="false" aria-hidden="true"></span>
							<span id="toolsAvailabilityText">${t('Not connected')}</span>
						</span>
					</div>
					<div class="tools-target-picker" aria-label="${t('Control Room target')}">
						<label>${t('Control Room')}<select id="toolsRoomSelect"><option value="">${t('Select a Control Room')}</option></select></label>
						<label>${t('Page')}<select id="toolsPageSelect" disabled><option value="">${t('Select a page')}</option></select></label>
					</div>
					<p id="toolsContext" class="tools-context">${t('Open an Automation Anywhere folder, taskbot, or Packages page.')}</p>
					<p class="inline-hint">${t('The target follows supported AA tabs while no job is running.')}</p>
				</div>
				<p id="toolsClipboardStatus" class="tools-clipboard-status" hidden></p>
				<div class="tools-actions-group">
					<strong class="tools-subheading">${t('Available tools')}</strong>
					<div id="toolsActions" class="tool-action-grid"></div>
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
				<button id="toolsLoadMore" type="button" hidden>${icon('chevrons-down')}${t('Load more')}</button>
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
					<button id="toolsPrimaryAction" type="button" disabled title="${t('Run selected tool action.')}">${icon('play')}${t('Run')}</button>
					<button id="toolsPackageVersions" type="button" hidden>${icon('package-search')}${t('Browse versions')}</button>
					<span id="toolsPasteActionWrapper">
						<button id="toolsPasteAction" type="button" hidden title="${t('Paste into this folder. Duplicates are skipped.')}">${icon('clipboard-paste')}${t('Paste copied files')}</button>
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
						<button id="toolsCopyPackageList" type="button" title="${t('Copy package list to clipboard.')}">${icon('copy')}${t('Copy')}</button>
					</div>
					<div id="toolsPackageListContent" class="package-list-content"></div>
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
						<button id="taskbotSaveJson" type="button">${icon('file-up')}${t('Import JSON to control room')}</button>
					</div>
				</div>
			</section>

			<section id="importTaskbotSection" class="panel-section" hidden>
				<div class="section-heading-row">
					<h2>${t('Import Taskbot')}</h2>
				</div>
				<p class="inline-hint">${t('Creates a new taskbot in the current folder from a taskbot JSON file. Existing bots are never overwritten.')}</p>
				<input id="importTaskbotFile" type="file" aria-label="${t('Taskbot JSON file')}">
				<div class="button-grid">
					<button id="importTaskbotRun" type="button" disabled title="${t('Create a new taskbot in this folder from a JSON file.')}">${icon('file-up')}${t('Import to current folder')}</button>
				</div>
			</section>

			<section id="toolsJobsSection" class="panel-section" hidden>
				<div class="section-heading-row">
					<h2>${t('Jobs')}</h2>
					<span class="section-heading-actions">
						<button id="toolsJobsBack" type="button">${icon('arrow-left')}${t('Back to Tools')}</button>
						<button id="toolsClearCompleted" type="button">${icon('trash-2')}${t('Clear completed')}</button>
					</span>
				</div>
				<p class="inline-hint">${t('Jobs continue while you use other tabs or extension views. Closing this side panel interrupts them.')}</p>
				<button id="toolsStopJob" type="button" hidden>${icon('square')}${t('Stop after current item')}</button>
				<div id="toolsJobsList" class="tools-jobs-list" aria-live="polite"></div>
			</section>

		</section>
	`;
}

export function initializeToolsPanel(initOptions: InitializeToolsOptions): void {
	options = initOptions;
	contextText = getRequiredElement('#toolsContext');
	toolsClipboardStatus = getRequiredElement('#toolsClipboardStatus');
	availabilityDot = getRequiredElement('#toolsAvailabilityDot');
	availabilityText = getRequiredElement('#toolsAvailabilityText');
	refreshButton = getRequiredElement<HTMLButtonElement>('#toolsRefresh');
	actionsContainer = getRequiredElement('#toolsActions');
	roomSelect = getRequiredElement<HTMLSelectElement>('#toolsRoomSelect');
	pageSelect = getRequiredElement<HTMLSelectElement>('#toolsPageSelect');
	toolsWorkspace = getRequiredElement('#panel-tools');
	toolsJobsSection = getRequiredElement('#toolsJobsSection');
	toolsJobsButton = getRequiredElement<HTMLButtonElement>('#toolsJobsButton');
	toolsJobsBackButton = getRequiredElement<HTMLButtonElement>('#toolsJobsBack');
	toolsJobsBadge = getRequiredElement('#toolsJobsBadge');
	toolsJobsList = getRequiredElement('#toolsJobsList');
	toolsStopJobButton = getRequiredElement<HTMLButtonElement>('#toolsStopJob');
	universalClipboardSection = getRequiredElement('#universalClipboardSection');
	fileSection = getRequiredElement('#toolsFileSection');
	listTitle = getRequiredElement('#toolsListTitle');
	searchInput = getRequiredElement<HTMLInputElement>('#toolsSearch');
	selectAllInput = getRequiredElement<HTMLInputElement>('#toolsSelectAll');
	selectedCountText = getRequiredElement('#toolsSelectedCount');
	fileList = getRequiredElement('#toolsFileList');
	primaryActionButton = getRequiredElement<HTMLButtonElement>('#toolsPrimaryAction');
	packageVersionsButton = getRequiredElement<HTMLButtonElement>('#toolsPackageVersions');
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
		void scanControlRooms(true);
	});
	roomSelect.addEventListener('change', () => void handleRoomSelection());
	pageSelect.addEventListener('change', () => void handlePageSelection());
	toolsJobsButton.addEventListener('click', () => showToolsSubview(true));
	toolsJobsBackButton.addEventListener('click', () => showToolsSubview(false));
	toolsStopJobButton.addEventListener('click', requestActiveJobStop);
	getRequiredElement<HTMLButtonElement>('#toolsClearCompleted').addEventListener('click', clearCompletedJobs);
	searchInput.addEventListener('input', handleToolsSearchInput);
	selectAllInput.addEventListener('change', toggleVisibleSelection);
	primaryActionButton.addEventListener('click', () => {
		void runPrimaryToolAction();
	});
	packageVersionsButton.addEventListener('click', () => {
		void togglePackageVersionDrilldown();
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
	taskbotJsonSaveButton.addEventListener('click', () => {
		void saveTaskbotJson();
	});
	importTaskbotSection = getRequiredElement('#importTaskbotSection');
	importTaskbotFileInput = getRequiredElement<HTMLInputElement>('#importTaskbotFile');
	importTaskbotRunButton = getRequiredElement<HTMLButtonElement>('#importTaskbotRun');
	importTaskbotFileInput.addEventListener('change', () => {
		importTaskbotRunButton.disabled = !importTaskbotFileInput.files?.length;
	});
	importTaskbotRunButton.addEventListener('click', () => {
		void importTaskbotFromFile();
	});
	resetExportFormatToDefault();

	void initializeToolsSession();
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

async function persistWindowSelection(): Promise<void> {
	await windowSelectionStorage?.setValue({
		target: selectedTarget,
		roomOrigin: selectedRoomOrigin,
	});
}

async function initializeToolsSession(): Promise<void> {
	const [activeTab] = await browser.tabs.query({ active: true, currentWindow: true });
	toolsWindowId = activeTab?.windowId ?? (await browser.windows.getCurrent()).id;
	if (toolsWindowId === undefined) throw new Error(t('Current browser window is unavailable.'));
	windowSelectionStorage = getWindowSelectionStorage(toolsWindowId);
	const savedSelection = await windowSelectionStorage.getValue();
	selectedTarget = savedSelection.target;
	selectedRoomOrigin = savedSelection.roomOrigin || selectedTarget?.origin || '';
	const storedJobs = await toolJobHistoryStorage.getValue();
	const interruptedIds = new Set(
		storedJobs.filter((job) => job.status === 'running' || job.status === 'stopping').map((job) => job.id)
	);
	jobHistory = recoverInterruptedToolJobs(storedJobs);
	await toolJobHistoryStorage.setValue(jobHistory);
	renderJobs();
	for (const job of jobHistory) {
		if (interruptedIds.has(job.id)) void notifyJob(job);
	}
	await scanControlRooms();
}

async function scanControlRooms(manual = false): Promise<void> {
	if (activeToolRun || refreshingTargets) return;
	refreshingTargets = true;
	refreshButton.disabled = true;
	refreshButton.setAttribute('aria-busy', 'true');
	updateAvailabilityDot(false, t('Checking connections...'));
	contextText.textContent = t('Checking signed-in Control Rooms in this window...');
	try {
		const tabs = await browser.tabs.query({ currentWindow: true });
		const currentTabId = tabs.find((tab) => tab.active)?.id;
		const candidates = await Promise.all(tabs.map(async (tab) => {
			if (tab.id === undefined || tab.windowId === undefined || !tab.url || !isAutomationAnywhereUrl(tab.url)) return null;
			let authenticated = false;
			try {
				await getAutomationAnywhereAuthToken(tab.id);
				authenticated = true;
			} catch {
				// Logged-out pages remain excluded; credentials are never retained.
			}
			return {
				tabId: tab.id,
				windowId: tab.windowId,
				url: tab.url,
				title: tab.title,
				authenticated,
				context: parseAutomationAnywherePageContext(tab.url),
			};
		}));
		targetGroups = groupAuthenticatedControlRoomTabs(candidates.filter((candidate) => candidate !== null));
		const activeTarget = getEligibleTargetForTab(targetGroups, currentTabId);
		const singleRoomOrigin = getSingleControlRoomOrigin(targetGroups);
		if (singleRoomOrigin) selectedRoomOrigin = singleRoomOrigin;
		else if (!targetGroups.some((group) => group.origin === selectedRoomOrigin)) selectedRoomOrigin = '';
		if (selectedTarget) {
			const currentPage = targetGroups
				.find((group) => group.origin === selectedTarget?.origin)
				?.pages.find((page) => page.tabId === selectedTarget?.tabId);
			if (!currentPage?.eligible) {
				selectedTarget = { ...selectedTarget, disconnected: true };
			} else if (manual && !selectedTarget.disconnected) {
				selectedTarget = {
					...selectedTarget,
					url: currentPage.url,
					disconnected: false,
					stale: false,
				};
			} else if (!selectedTarget.disconnected && currentPage.url !== selectedTarget.url) {
				selectedTarget = markSelectedTargetRouteChanged(selectedTarget, currentPage.tabId, currentPage.url);
			}
		}
		if (activeTarget) {
			selectedTarget = activeTarget;
		} else if (manual && selectedTarget?.disconnected) {
			selectedTarget =
				getOnlyRoomCurrentEligibleTarget(targetGroups, currentTabId) ?? selectedTarget;
		}
		if (!selectedTarget) {
			selectedTarget = getFirstEligibleTarget(targetGroups);
		}
		if (selectedTarget && !selectedTarget.disconnected) {
			selectedRoomOrigin = selectedTarget.origin;
		}
		await persistWindowSelection();
		renderTargetSelectors();
		await refreshToolsContext();
	} finally {
		refreshingTargets = false;
		refreshButton.removeAttribute('aria-busy');
		updateTargetLocks();
	}
}

function renderTargetSelectors(): void {
	roomSelect.textContent = '';
	roomSelect.append(new Option(t('Select a Control Room'), ''));
	for (const group of targetGroups) {
		roomSelect.append(
			new Option(`${formatControlRoomHostname(group.hostname)} (${group.pages.length})`, group.origin)
		);
	}
	roomSelect.value = targetGroups.some((group) => group.origin === selectedRoomOrigin)
		? selectedRoomOrigin
		: '';
	pageSelect.textContent = '';
	pageSelect.append(new Option(t('Select a page'), ''));
	const group = targetGroups.find((item) => item.origin === roomSelect.value);
	for (const page of group?.pages ?? []) {
		const option = new Option(formatControlRoomPageTitle(page.title), String(page.tabId));
		option.disabled = !page.eligible;
		if (!page.eligible) option.textContent += ` — ${t('Unsupported page')}`;
		pageSelect.append(option);
	}
	pageSelect.value = selectedTarget && group?.pages.some((page) => page.tabId === selectedTarget?.tabId)
		? String(selectedTarget.tabId)
		: '';
	updateTargetLocks();
}

function updateTargetLocks(): void {
	const locked = Boolean(activeToolRun);
	roomSelect.disabled = locked || targetGroups.length === 0;
	pageSelect.disabled = locked || !roomSelect.value;
	refreshButton.disabled = locked || refreshingTargets;
}

async function getCurrentWindowActiveTabId(): Promise<number | undefined> {
	return (await browser.tabs.query({ active: true, currentWindow: true }))[0]?.id;
}

async function handleRoomSelection(): Promise<void> {
	if (activeToolRun) return;
	selectedRoomOrigin = roomSelect.value;
	const group = targetGroups.find((item) => item.origin === selectedRoomOrigin);
	selectedTarget = getPreferredRoomTarget(group, await getCurrentWindowActiveTabId());
	await persistWindowSelection();
	renderTargetSelectors();
	await refreshToolsContext();
}

async function handlePageSelection(): Promise<void> {
	if (activeToolRun) return;
	const group = targetGroups.find((item) => item.origin === roomSelect.value);
	const page = group?.pages.find((item) => String(item.tabId) === pageSelect.value && item.eligible);
	selectedRoomOrigin = group?.origin ?? '';
	selectedTarget = page
		? { origin: group!.origin, tabId: page.tabId, url: page.url, stale: false, disconnected: false }
		: getPreferredRoomTarget(group, await getCurrentWindowActiveTabId());
	await persistWindowSelection();
	renderTargetSelectors();
	await refreshToolsContext();
}

function upsertAuthenticatedTargetTab(
	tabId: number,
	windowId: number,
	url: string,
	title: string | undefined,
	context: AutomationAnywherePageContext
): void {
	const candidates: ControlRoomTabCandidate[] = targetGroups.flatMap((group) =>
		group.pages.map((page) => ({
			tabId: page.tabId,
			windowId: page.windowId,
			url: page.url,
			title: page.title,
			authenticated: true,
			context: page.context,
		}))
	);
	candidates.push({ tabId, windowId, url, title, authenticated: true, context });
	targetGroups = groupAuthenticatedControlRoomTabs(
		candidates.filter((candidate, index) =>
			candidate.tabId !== tabId || index === candidates.length - 1
		)
	);
}

async function disableSelectedTarget(tabId: number, url: string, disconnected: boolean): Promise<void> {
	if (selectedTarget?.tabId !== tabId) return;
	selectedTarget = disconnected
		? markSelectedTargetDisconnected(selectedTarget, tabId)
		: markSelectedTargetRouteChanged(selectedTarget, tabId, url);
	await persistWindowSelection();
	renderTargetSelectors();
	if (activeToolRun) return;
	runtime = null;
	await refreshToolsContext();
}

async function syncToolsTargetToTab(tabId: number, expectedUrl?: string): Promise<void> {
	const generation = ++targetSyncGeneration;
	let tab: Awaited<ReturnType<typeof browser.tabs.get>>;
	try {
		tab = await browser.tabs.get(tabId);
	} catch {
		return;
	}
	if (generation !== targetSyncGeneration || tab.windowId !== toolsWindowId) return;
	const url = expectedUrl ?? tab.url;
	if (!url || !isAutomationAnywhereUrl(url)) {
		await disableSelectedTarget(tabId, url ?? '', false);
		return;
	}
	const context = parseAutomationAnywherePageContext(url);
	if (context.pageType === 'unsupported') {
		await disableSelectedTarget(tabId, url, false);
		return;
	}

	let authToken: string;
	try {
		authToken = await getAutomationAnywhereAuthToken(tabId);
	} catch {
		await disableSelectedTarget(tabId, url, true);
		return;
	}
	if (generation !== targetSyncGeneration) return;
	upsertAuthenticatedTargetTab(tabId, tab.windowId, url, tab.title, context);
	const next = getEligibleTargetForTab(targetGroups, tabId);
	if (!next) return;
	selectedTarget = next;
	selectedRoomOrigin = next.origin;
	await persistWindowSelection();
	if (generation !== targetSyncGeneration) return;
	renderTargetSelectors();
	await refreshToolsContext(authToken);
}

export async function handleToolsTabActivated(tabId: number, windowId: number): Promise<void> {
	if (windowId !== toolsWindowId) return;
	if (activeToolRun) {
		pendingActiveTabId = tabId;
		return;
	}
	await syncToolsTargetToTab(tabId);
}

export async function markToolsTargetRouteChanged(
	tabId: number,
	url: string,
	windowId?: number,
	isActive = false
): Promise<void> {
	if (windowId !== undefined && windowId !== toolsWindowId) return;
	if (selectedTarget?.tabId !== tabId && !isActive) return;
	if (activeToolRun) {
		pendingActiveTabId = tabId;
		if (selectedTarget?.tabId === tabId) {
			selectedTarget = markSelectedTargetRouteChanged(selectedTarget, tabId, url);
			await persistWindowSelection();
			renderTargetSelectors();
		}
		return;
	}
	await syncToolsTargetToTab(tabId, url);
}

export async function markToolsTargetDisconnected(tabId: number, windowId?: number): Promise<void> {
	if (windowId !== undefined && windowId !== toolsWindowId) return;
	targetGroups = targetGroups
		.map((group) => ({ ...group, pages: group.pages.filter((page) => page.tabId !== tabId) }))
		.filter((group) => group.pages.length > 0);
	if (selectedTarget?.tabId !== tabId) {
		renderTargetSelectors();
		return;
	}
	selectedTarget = markSelectedTargetDisconnected(selectedTarget, tabId);
	await persistWindowSelection();
	renderTargetSelectors();
	if (activeToolRun) return;
	runtime = null;
	await refreshToolsContext();
}

export function getSelectedToolsTargetTabId(): number | undefined {
	return canUseSelectedTarget(selectedTarget) ? selectedTarget!.tabId : undefined;
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
	if (isPackageVersionSelectionMode()) {
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

function resetExportFormatToDefault(): void {
	exportFormat = 'zip';
	updateExportFormatControls();
}

function updateExportFormatControls(): void {
	toolsExportFormatZip.checked = exportFormat === 'zip';
	toolsExportFormatSeparate.checked = exportFormat === 'separate';
}

function updateExportFormatFromInput(): void {
	exportFormat = toolsExportFormatZip.checked ? 'zip' : 'separate';
	updateExportFormatControls();
	updateActionBar();
}

function getActiveExportFormat(): ExportFormat {
	return exportFormat;
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
	if (activeToolRun) jobHistory = prependToolJob(jobHistory, activeToolRun);
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
			...(activeToolRun ? { runId: activeToolRun.id } : {}),
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
		jobHistory = prependToolJob(jobHistory, activeToolRun);
		void persistJobs();
	}
}

function startToolRun(title: string, total: number, message: string): void {
	if (activeToolRun || !runtime) throw new Error(t('Another job is already running.'));
	activeToolRun = createToolJob(crypto.randomUUID(), title, total, {
		controlRoom: runtime.context.hostname,
		pageTitle: targetGroups.flatMap((group) => group.pages).find((page) => page.tabId === runtime?.tabId)?.title ?? getContextLabel(runtime.context),
		tabId: runtime.tabId,
	});
	jobHistory = prependToolJob(jobHistory, activeToolRun);
	void persistJobs();
	setJobLock(true);
	setToolProgress(0, total, message);
	appendToolLog(message);
}

function finishToolRun(
	summary: string,
	severity: FeedbackSeverity = 'info'
): void {
	const run = activeToolRun;
	if (!run) return;
	addRunLine(summary, severity);
	const status = run.stopRequested
		? 'stopped'
		: severity === 'error'
			? 'failed'
			: severity === 'warn'
				? 'warning'
				: 'completed';
	const completed = status === 'stopped' ? run.completed : run.total;
	setToolProgress(completed, run.total, summary);
	const finished = completeToolJob(run, status, summary);
	if (showingJobs) finished.unread = false;
	jobHistory = prependToolJob(jobHistory, finished);
	activeToolRun = null;
	void persistJobs();
	setJobLock(false);
	const pendingTabId = pendingActiveTabId;
	pendingActiveTabId = null;
	if (pendingTabId !== null) void syncToolsTargetToTab(pendingTabId);
	else if (!canUseSelectedTarget(selectedTarget)) void refreshToolsContext();
	void options.addFeedback(
		severity,
		'tools',
		t('{title} run finished.', { title: run.title }),
		{
			runId: run.id,
			tool: currentTool,
			title: finished.title,
			total: finished.total,
			completed: finished.completed,
			durationMs: (finished.finishedAt ?? Date.now()) - finished.startedAt,
			summary,
		},
		{ keepDetails: true, debugOnly: severity === 'info' }
	);
	void notifyJob(finished);
}

async function persistJobs(): Promise<void> {
	await toolJobHistoryStorage.setValue(jobHistory);
	renderJobs();
}

function setJobLock(locked: boolean): void {
	for (const button of toolsWorkspace.querySelectorAll<HTMLButtonElement>('button')) {
		if (
			button === toolsJobsButton ||
			button === toolsJobsBackButton ||
			button === toolsStopJobButton
		) continue;
		button.disabled = locked;
	}
	toolsStopJobButton.hidden = !locked;
	toolsStopJobButton.disabled = false;
	setSidepanelIconButtonContent(toolsStopJobButton, 'square', t('Stop after current item'));
	updateTargetLocks();
}

function requestActiveJobStop(): void {
	if (!activeToolRun) return;
	activeToolRun = requestToolJobStop(activeToolRun);
	jobHistory = prependToolJob(jobHistory, activeToolRun);
	toolsStopJobButton.disabled = true;
	setSidepanelIconButtonContent(toolsStopJobButton, 'circle-stop', t('Stopping after current item...'));
	void persistJobs();
}

function finishStoppedJob(): boolean {
	if (!activeToolRun?.stopRequested) return false;
	finishToolRun(t('Stopped after the current item. Completed work remains and is listed in the job log.'), 'warn');
	return true;
}

function showToolsSubview(jobs: boolean): void {
	showingJobs = jobs;
	toolsJobsSection.hidden = !jobs;
	for (const section of toolsWorkspace.querySelectorAll<HTMLElement>(':scope > .panel-section')) {
		if (section === toolsJobsSection || section.id === 'toolsOverviewSection') continue;
		if (jobs) section.hidden = true;
	}
	if (!jobs) setSelectedToolPanel(currentTool);
	if (jobs) {
		jobHistory = clearToolJobUnread(jobHistory);
		void persistJobs();
	}
	renderJobs();
}

export function openToolsJobs(): void {
	showToolsSubview(true);
}

function renderJobs(): void {
	if (!toolsJobsList) return;
	const unread = getUnreadToolJobCount(jobHistory);
	toolsJobsButton.hidden = !(showingJobs || Boolean(activeToolRun) || unread > 0);
	toolsJobsBadge.textContent = String(unread);
	toolsJobsBadge.hidden = unread === 0;
	document.querySelector<HTMLElement>('#jobsTabBadge')?.toggleAttribute('hidden', unread === 0);
	const topBadge = document.querySelector<HTMLElement>('#jobsTabBadge');
	if (topBadge) topBadge.textContent = String(unread);
	toolsJobsList.textContent = '';
	if (!jobHistory.length) {
		const empty = document.createElement('p');
		empty.className = 'inline-hint';
		empty.textContent = t('No jobs yet.');
		toolsJobsList.append(empty);
		return;
	}
	for (const job of jobHistory) {
		const card = document.createElement('article');
		card.className = 'tool-job-card';
		const title = document.createElement('div');
		title.className = 'tool-job-title';
		const statusIcon = document.createElement('span');
		statusIcon.className = `tool-job-status tool-job-status-${job.status}`;
		setSidepanelIconContent(
			statusIcon,
			job.status === 'completed'
				? 'circle-check-big'
				: job.status === 'warning'
					? 'triangle-alert'
					: job.status === 'running'
						? 'activity'
						: job.status === 'stopping' || job.status === 'stopped'
							? 'circle-stop'
							: 'circle-x'
		);
		const heading = document.createElement('strong');
		heading.textContent = job.title;
		title.append(statusIcon, heading);
		const meta = document.createElement('small');
		meta.textContent = `${job.controlRoom} · ${job.status} · ${job.completed}/${job.total}`;
		const summary = document.createElement('p');
		summary.textContent = job.summary || t('In progress');
		const details = document.createElement('details');
		const detailsSummary = document.createElement('summary');
		detailsSummary.textContent = t('Details');
		const log = document.createElement('pre');
		log.textContent = job.lines.map((line) => `${line.severity.toUpperCase()} ${line.message}`).join('\n');
		details.append(detailsSummary, log);
		card.append(title, meta, summary, details);
		toolsJobsList.append(card);
	}
}

function clearCompletedJobs(): void {
	jobHistory = clearCompletedToolJobs(jobHistory);
	void persistJobs();
}

async function notifyJob(job: ToolJobRecord): Promise<void> {
	if (!(await getBackgroundJobNotificationsEnabled())) return;
	const duration = Math.max(0, Math.round(((job.finishedAt ?? Date.now()) - job.startedAt) / 1000));
	const windowId = targetGroups.flatMap((group) => group.pages).find((page) => page.tabId === job.tabId)?.windowId;
	void browser.runtime.sendMessage({
		type: 'SHOW_JOB_NOTIFICATION',
		jobId: job.id,
		title: job.title,
		message: `${job.controlRoom} · ${job.status} · ${duration}s · ${job.completed}/${job.total}`,
		windowId,
	});
}

function setBusy(button: HTMLButtonElement, busy: boolean, label?: string): void {
	button.disabled = busy;
	if (label) button.textContent = label;
}

function updateAvailabilityDot(hasTools: boolean, unavailableLabel = t('Not connected')): void {
	availabilityDot.dataset.available = String(hasTools);
	availabilityText.textContent = hasTools ? t('Ready') : unavailableLabel;
	refreshButton.dataset.hasTools = String(hasTools);
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
	setToolPanelHidden(importTaskbotSection, tool !== 'import-taskbot');
	setToolPanelHidden(fileSection, !isListTool(tool));
	setExportFormatVisible(tool === 'export-bots');
}

function isCurrentContextRefresh(
	generation: number,
	target: SelectedControlRoomTarget
): boolean {
	return generation === contextRefreshGeneration &&
		selectedTarget?.tabId === target.tabId &&
		selectedTarget.url === target.url &&
		canUseSelectedTarget(selectedTarget);
}

async function refreshToolsContext(validatedAuthToken?: string): Promise<void> {
	const refreshGeneration = ++contextRefreshGeneration;
	const target = selectedTarget;
	clearPackageSearchTimer();
	packageLoadGeneration += 1;
	packageSessionExpired = false;
	packageDrilldownName = null;
	packageRootSearch = '';
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

	try {
		if (!target || !canUseSelectedTarget(target)) {
			runtime = null;
			currentTool = null;
			updateAvailabilityDot(
				false,
				selectedTarget?.disconnected
					? t('Disconnected')
					: selectedTarget?.stale
						? t('Unsupported page')
						: targetGroups.length === 0
							? t('No signed-in Control Room')
							: t('Select a supported page')
			);
			contextText.textContent = selectedTarget?.disconnected
				? t('The selected page is disconnected. Select Refresh to reconnect or choose another page.')
				: selectedTarget?.stale
					? t('The selected page is unsupported. Open a Folder, TaskBot, or Packages page.')
					: targetGroups.length === 0
						? t('No signed-in Control Rooms found in this window. Open one, then select Refresh.')
						: t('No supported page is open in this Control Room.');
			renderActionButtons();
			return;
		}
		const active = await getAutomationAnywhereContextForTab(target.tabId);
		if (!isCurrentContextRefresh(refreshGeneration, target)) return;
		if (!active || active.context.pageType === 'unsupported') {
			runtime = null;
			currentTool = null;
			updateAvailabilityDot(false, t('Unsupported page'));
			contextText.textContent = getUnsupportedToolsContextText(active);
			setSelectedToolPanel(null);
			renderActionButtons();
			void options.addFeedback(
				'info',
				'tools',
				t('Tools context unsupported.'),
				active
					? {
							pageType: active.context.pageType,
							host: active.context.hostname,
						}
					: { reason: 'selected-tab-unavailable' },
				{ keepDetails: true, debugOnly: true }
			);
			return;
		}

		const capabilities = await getToolCapabilities(active.tabId);
		if (!isCurrentContextRefresh(refreshGeneration, target)) return;
		let authToken = validatedAuthToken;
		try {
			authToken ??= await getAutomationAnywhereAuthToken(active.tabId);
		} catch {
			if (!isCurrentContextRefresh(refreshGeneration, target)) return;
			selectedTarget = { ...target, disconnected: true };
			await persistWindowSelection();
			renderTargetSelectors();
			throw new Error(t('The selected page is logged out. Sign in, then select Refresh.'));
		}
		if (!isCurrentContextRefresh(refreshGeneration, target)) return;
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
		updatePackagesDot = false;

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
			if (runtime) void refreshUpdatePackagesDot(runtime);
			if (currentTool === 'taskbot-json') await loadTaskbotJson();
			else if (currentTool !== 'universal-clipboard') await loadListPage(true);
			return;
		}

		currentTool = null;
		setSelectedToolPanel(null);
		renderActionButtons();
	} catch (error) {
		if (refreshGeneration !== contextRefreshGeneration) return;
		runtime = null;
		currentTool = null;
		updateAvailabilityDot(false, t('Connection failed'));
		setSelectedToolPanel(null);
		renderActionButtons();
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

function getPackageListExactName(): string | null {
	return getPackageDetailsName() ??
		(currentTool === 'download-packages' ? packageDrilldownName : null);
}

function isPackageVersionSelectionMode(): boolean {
	return currentTool === 'download-packages' && Boolean(getPackageListExactName());
}

function isPackageVersionDrilldownMode(): boolean {
	return isPackageVersionSelectionMode() && !getPackageDetailsName();
}

async function togglePackageVersionDrilldown(): Promise<void> {
	if (isPackageVersionDrilldownMode()) {
		packageDrilldownName = null;
		searchInput.value = packageRootSearch;
		packageRootSearch = '';
		await loadPackagePage(true, { keepSearch: true });
		return;
	}

	if (getPackageDetailsName()) return;
	const packages = getSelectedPackages();
	if (packages.length !== 1) return;
	const name = getAutomationAnywherePackageName(packages[0]);
	if (!name) return;

	packageRootSearch = searchInput.value;
	packageDrilldownName = name;
	searchInput.value = '';
	await loadPackagePage(true, { keepSearch: true });
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
	if (tool === 'export-bots') return t('Export Bots/Files');
	if (tool === 'download-packages') return t('Download Packages');
	if (tool === 'package-usage') return t('Package Usage');
	if (tool === 'import-taskbot') return t('Import Taskbot');
	return t('Taskbot JSON');
}

function getToolIcon(tool: ToolId): BetterAaIconName {
	if (tool === 'universal-clipboard') return 'clipboard-paste';
	if (tool === 'copy-files') return 'clipboard-copy';
	if (tool === 'update-packages') return 'package-check';
	if (tool === 'export-bots' || tool === 'download-packages') return 'download';
	if (tool === 'package-usage') return 'scan-search';
	if (tool === 'import-taskbot') return 'file-up';
	return 'file-json';
}

function getToolActionHelp(tool: ToolId): string {
	if (tool === 'universal-clipboard') return t('Use saved AA clipboard slots.');
	if (tool === 'copy-files') return t('Copy file references inside this extension.');
	if (tool === 'update-packages') return t('Apply default package versions to selected bots.');
	if (tool === 'export-bots') return t('Export selected files as a ZIP or separate downloads.');
	if (tool === 'download-packages') return t('Download packages from this page.');
	if (tool === 'package-usage') return t('Find bots using selected package version.');
	if (tool === 'import-taskbot') return t('Create a new taskbot in this folder from a JSON file.');
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
	if (tool === 'download-packages') {
		return isPackageVersionSelectionMode()
			? t('Select one or more package versions to download.')
			: t('Select one package to browse versions, or download the versions shown.');
	}
	if (tool === 'package-usage' && getPackageDetailsName()) {
		return t('Only versions with usage are shown. Missing versions have no usage found.');
	}
	if (tool === 'package-usage') return t('Shows bots using one selected package version.');
	return '';
}

let updatePackagesDot = false;

function applyUpdatePackagesDot(hasUpdates: boolean): void {
	const button = actionsContainer.querySelector<HTMLButtonElement>(
		'[data-tool-action="update-packages"]'
	);
	if (!button) return;
	button.dataset.hasUpdates = String(hasUpdates);
	button.title =
		getToolActionHelp('update-packages') +
		(hasUpdates ? ` ${t('Package updates available.')}` : '');
}

async function refreshUpdatePackagesDot(activeRuntime: ToolsRuntime): Promise<void> {
	const fileId = activeRuntime.context.fileId;
	if (!fileId) return;

	try {
		const [content, defaultVersions] = await Promise.all([
			activeRuntime.api.getBotContent(fileId),
			activeRuntime.api.getDefaultPackageVersions(),
		]);
		const updates = getAutomationAnywherePackageUpdates(
			extractAutomationAnywherePackages(content),
			defaultVersions
		);
		if (runtime !== activeRuntime) return;
		updatePackagesDot = updates.length > 0;
		applyUpdatePackagesDot(updatePackagesDot);
	} catch (error) {
		void options.addFeedback(
			'info',
			'tools',
			t('Package update check failed.'),
			{ tool: 'update-packages', fileId, error },
			{ keepDetails: true, debugOnly: true }
		);
	}
}

function renderActionButtons(): void {
	const context = runtime?.context;
	actionsContainer.textContent = '';
	actionsContainer.dataset.available = String(Boolean(context));

	for (const tool of context ? getAvailableTools(context) : ALL_TOOL_IDS) {
		const button = document.createElement('button');
		button.type = 'button';
		setSidepanelIconButtonContent(button, getToolIcon(tool), getToolLabel(tool));
		button.dataset.toolAction = tool;
		button.className = tool === currentTool ? 'is-active tool-action-button' : 'tool-action-button';
		button.title = getToolActionHelp(tool);
		button.disabled = !context;
		button.addEventListener('click', () => {
			void selectTool(tool);
		});
		actionsContainer.appendChild(button);
	}

	applyUpdatePackagesDot(updatePackagesDot);
}

async function selectTool(tool: ToolId): Promise<void> {
	const wasPackageTool = isPackageTool();
	const wasPackageVersionDrilldown = isPackageVersionDrilldownMode();
	const rootSearch = wasPackageVersionDrilldown ? packageRootSearch : '';
	clearPackageSearchTimer();
	packageDrilldownName = null;
	packageRootSearch = '';
	if (wasPackageVersionDrilldown) searchInput.value = rootSearch;
	currentTool = tool;
	clearExportPackageInfo();
	clearPackageUsageResults();
	resetToolProgress();
	if (tool === 'export-bots') resetExportFormatToDefault();
	renderActionButtons();
	setSelectedToolPanel(tool);

	if (tool === 'universal-clipboard') return;

	if (tool === 'import-taskbot') {
		importTaskbotRunButton.disabled = !importTaskbotFileInput.files?.length;
		return;
	}

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
	loadedTotal = 0;
	lastRawPageLength = items.length;
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
		const response = exactName
			? await activeRuntime.api.listPackageVersions(exactName)
			: await activeRuntime.api.listPackages({
					offset: 0,
					length: PACKAGE_PAGE_LENGTH,
					query: query || undefined,
				});
		const rawList = response.list ?? [];
		packageListCache.set(cacheKey, rawList);
		if (
			runtime !== activeRuntime ||
			currentTool !== selectedTool ||
			getPackageListCacheKey(activeRuntime, packageQuery, getPackageListExactName()) !== cacheKey
		) return;
		hydratePackageListCache(rawList);
		setToolStatus(t('Package list refreshed.'));
	} catch (error) {
		if (
			runtime !== activeRuntime ||
			currentTool !== selectedTool ||
			getPackageListCacheKey(activeRuntime, packageQuery, getPackageListExactName()) !== cacheKey
		) return;
		if (isAutomationAnywhereLoggedOutError(error)) {
			packageSessionExpired = true;
			setToolStatus(t('Control Room session expired. Log in, then click Refresh.'), 'warn');
			return;
		}
		setToolStatus(
			error instanceof Error ? error.message : t('Package list failed.'),
			'warn'
		);
	} finally {
		packageListRefreshes.delete(cacheKey);
	}
}

async function loadPackagePage(
	reset: boolean,
	options: { keepSearch?: boolean } = {}
): Promise<void> {
	const activeRuntime = runtime;
	const selectedTool = currentTool;
	const packageExactName = getPackageListExactName();
	if (
		!activeRuntime ||
		(selectedTool !== 'download-packages' && selectedTool !== 'package-usage')
	) {
		return;
	}
	if (packageSessionExpired) {
		setToolStatus(t('Control Room session expired. Log in, then click Refresh.'), 'warn');
		return;
	}

	let cacheKey = getPackageListCacheKey(activeRuntime, packageQuery, packageExactName);
	const loadGeneration = reset ? ++packageLoadGeneration : packageLoadGeneration;
	packageListLoading = true;
	setBusy(loadMoreButton, true, reset ? t('Loading...') : t('Loading more...'));
	if (reset) {
		loadedItems = [];
		selectedIds = new Set<string>();
		loadedOffset = 0;
		loadedTotal = 0;
		lastRawPageLength = 0;
		if (!options.keepSearch) searchInput.value = '';
		packageQuery = packageExactName ? '' : getPackageSearchQuery();
		cacheKey = getPackageListCacheKey(activeRuntime, packageQuery, packageExactName);
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
				packageExactName
			);
			return;
		}
		renderFileList();
		setToolStatus(t('Loading packages...'));
	}

	try {
		const response = packageExactName
			? await activeRuntime.api.listPackageVersions(packageExactName)
			: await activeRuntime.api.listPackages({
					offset: loadedOffset,
					length: PACKAGE_PAGE_LENGTH,
					query: packageQuery || undefined,
				});
		if (
			runtime !== activeRuntime ||
			currentTool !== selectedTool ||
			packageLoadGeneration !== loadGeneration
		) return;
		const rawList = response.list ?? [];
		lastRawPageLength = rawList.length;
		const byId = new Map(loadedItems.map((item) => [getToolItemId(item), item]));
		for (const item of rawList) byId.set(getToolItemId(item), item);
		loadedItems = [...byId.values()];
		loadedOffset = packageExactName ? loadedItems.length : loadedOffset + PACKAGE_PAGE_LENGTH;
		loadedTotal = getResponseTotal(response) || Math.max(loadedItems.length, loadedTotal);
		packageListLoading = false;
		pruneSelection();
		renderFileList();
		setSelectedToolPanel(selectedTool);
		cacheCurrentPackageList(cacheKey);
		const message = packageExactName
			? t('{count} package version(s) loaded.', { count: loadedItems.length })
			: t('{count} package(s) loaded.', { count: loadedItems.length });
		setToolStatus(message);
	} catch (error) {
		if (
			runtime !== activeRuntime ||
			currentTool !== selectedTool ||
			packageLoadGeneration !== loadGeneration
		) return;
		if (isAutomationAnywhereLoggedOutError(error)) {
			packageSessionExpired = true;
			setToolStatus(t('Control Room session expired. Log in, then click Refresh.'), 'warn');
			return;
		}
		setToolStatus(
			error instanceof Error ? error.message : t('Package list failed.'),
			'error'
		);
	} finally {
		if (
			runtime === activeRuntime &&
			currentTool === selectedTool &&
			packageLoadGeneration === loadGeneration
		) {
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
	if (isPackageVersionSelectionMode()) {
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
	const packageExactName = getPackageListExactName();
	const packageVersionSelectionMode = isPackageVersionSelectionMode();
	const packageDetailsUsageMode = isPackageDetailsUsageMode();
	const search = currentTaskbotMode ? '' : searchInput.value.trim().toLowerCase();
	const visible = currentTaskbotMode
		? loadedItems
		: loadedItems.filter((item) =>
				getToolItemSearchText(item).toLowerCase().includes(search)
			);
	searchInput.placeholder =
		packageVersionSelectionMode
			? t('Search loaded versions')
			: currentTool === 'download-packages' || packageUsageMode
			? t('Search packages')
			: t('Search files');
	searchInput.hidden = currentTaskbotMode || packageDetailsUsageMode;
	const selectAllLabel = selectAllInput.closest<HTMLElement>('.tools-select-all');
	if (selectAllLabel) {
		selectAllLabel.hidden =
			currentTaskbotFileMode || packageUsageMode || packageDetailsUsageMode;
	}

	listTitle.textContent =
		packageVersionSelectionMode && packageExactName
			? t('Package {name} versions', { name: packageExactName })
			: packageSelectionMode
			? t('Outdated packages')
			: currentTaskbotMode
			? t('Current bot')
			: currentTool === 'copy-files'
			? t('Copy Files')
			: currentTool === 'update-packages'
				? t('Update Packages')
				: currentTool === 'export-bots'
					? t('Export Bots/Files')
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
	const packageVersionDrilldownMode = isPackageVersionDrilldownMode();
	const usagePackage = currentTool === 'package-usage' ? getSelectedPackageForUsage() : null;
	primaryActionButton.hidden = packageDetailsUsageMode;
	primaryActionButton.disabled =
		currentTool === 'package-usage' ? !usagePackage && !packageDetailsName : count === 0;
	if (currentTool === 'copy-files') {
		setSidepanelIconButtonContent(primaryActionButton, 'clipboard-copy', t('Copy {count} file(s)', { count }));
	}
	if (currentTool === 'update-packages') {
		setSidepanelIconButtonContent(primaryActionButton, 'package-check', isCurrentTaskbotPackageSelectionMode()
			? t('Update {count} package(s)', { count })
			: currentTaskbotMode
			? t('Update current bot')
			: t('Update {count} bot(s)', { count }));
	}
	if (currentTool === 'export-bots') {
		setSidepanelIconButtonContent(primaryActionButton, 'download', currentTaskbotMode
			? t('Export current bot')
			: t('Export {count} file(s)', { count }));
	}
	if (currentTool === 'download-packages') {
		setSidepanelIconButtonContent(primaryActionButton, 'download', t('Download {count} package(s)', { count }));
	}
	if (currentTool === 'package-usage') {
		setSidepanelIconButtonContent(primaryActionButton, 'scan-search', t('View usage'));
	}
	primaryActionButton.title = getPrimaryActionHelp(currentTool);
	packageVersionsButton.hidden =
		currentTool !== 'download-packages' || Boolean(packageDetailsName);
	packageVersionsButton.disabled =
		packageListLoading ||
		(!packageVersionDrilldownMode && getSelectedPackages().length !== 1);
	setSidepanelIconButtonContent(
		packageVersionsButton,
		packageVersionDrilldownMode ? 'arrow-left' : 'package-search',
		packageVersionDrilldownMode ? t('Back to packages') : t('Browse versions')
	);
	packageVersionsButton.title = packageVersionDrilldownMode
		? t('Return to the package list.')
		: t('Browse all available versions of the selected package.');

	const hint = getToolInlineHint(currentTool);
	toolsActionHint.textContent = hint;
	toolsActionHint.hidden = !hint;

	const canPaste = canPasteCopiedFiles();
	pasteActionWrapper.hidden = !canPaste;
	pasteActionButton.hidden = !canPaste;
	pasteActionButton.disabled = !canPaste;
	setSidepanelIconButtonContent(
		pasteActionButton,
		'clipboard-paste',
		t('Paste {count} copied file(s)', { count: copiedFiles.length })
	);

	loadMoreButton.hidden =
		currentTaskbotMode ||
		packageDetailsUsageMode ||
		!hasMoreItems();
}

function hasMoreItems(): boolean {
	return hasMoreAutomationAnywhereItems({
		isPackageTool: isPackageTool(),
		loadedCount: loadedItems.length,
		loadedTotal,
		lastRawPageLength,
		pageLength: PAGE_LENGTH,
		packagePageLength: PACKAGE_PAGE_LENGTH,
	});
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
	setSidepanelIconButtonContent(copyButton, 'copy', t('Copy path'));
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
	startToolRun(t('Package Usage'), 1, t('Scanning package usage...'));

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
			setToolProgress(offset, Math.max(offset, getResponseTotal(response) ?? offset), t('Loaded {count} usage row(s).', { count: offset }));
			if (finishStoppedJob()) return;
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
		const summary = t('{count} usage row(s) loaded.', { count: packageUsageItems.length });
		setToolStatus(summary);
		finishToolRun(summary);
	} catch (error) {
		if (runtime !== activeRuntime || currentTool !== selectedTool) return;
		packageUsageLoading = false;
		renderPackageUsageResults();
		const message = error instanceof Error ? error.message : t('Package usage failed.');
		const recovery = message.startsWith('403 ')
				? t('Manage packages permission required.')
				: isPackageStatusEnumError(message)
					? t('Package status filter failed. Refresh packages and try again.')
					: message;
		setToolStatus(recovery, 'error');
		finishToolRun(recovery, 'error');
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
				if (finishStoppedJob()) return;
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
			if (finishStoppedJob()) return;
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
			await refreshUpdatePackagesDot(activeRuntime);
			const message = t('Selected packages are already current.');
			setToolProgress(1, 1, message);
			setToolStatus(message);
			finishToolRun(message, 'info');
			return;
		}

		await activeRuntime.api.updateBotContent(fileId, result.content);
		removeUpdatedRows();
		await refreshUpdatePackagesDot(activeRuntime);
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
					if (finishStoppedJob()) return;
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
			if (finishStoppedJob()) return;
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
				t('Export Bots/Files'),
				5,
				t('Creating ZIP export for {count} file(s). Do not close sidepanel.', {
					count: files.length,
				})
			);
			try {
				await exportSelectedFilesAsZip(activeRuntime, files);
			} catch (error) {
				if (error instanceof ToolJobStoppedError) {
					finishStoppedJob();
					return;
				}
				const message = getErrorMessage(error);
				appendToolLog(t('ZIP export failed: {message}', { message }), 'error');
				setToolStatus(t('ZIP export failed. Falling back to separate files.'), 'warn');
				await exportSelectedFilesSeparately(activeRuntime, files, true);
			}
		} else {
			startToolRun(
				t('Export Bots/Files'),
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
		const fileName = sanitizeDownloadFileName(getAutomationAnywhereFileName(file));
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
		if (finishStoppedJob()) return;
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
	if (activeToolRun?.stopRequested) throw new ToolJobStoppedError();

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
	if (activeToolRun?.stopRequested) throw new ToolJobStoppedError();
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
	if (activeToolRun?.stopRequested) throw new ToolJobStoppedError();
	const fileName = `better-aa-export-${new Date().toISOString().replace(/[:.]/g, '-')}.zip`;
	downloadBlob(archive, fileName);
	appendToolLog(t('Downloaded: {fileName}', { fileName }));
	if (taskbotScan.packages.length) showExportPackageInfo(taskbotScan.packages);
	const summary = t('Export downloaded: {fileName}', { fileName });
	setToolStatus(summary);
	finishToolRun(summary);
}

async function downloadSelectedPackages(): Promise<void> {
	const activeRuntime = runtime;
	const packages = getSelectedPackages();
	if (!activeRuntime || !packages.length) return;

	setBusy(primaryActionButton, true, t('Downloading...'));
	startToolRun(
		t('Download Packages'),
		packages.length,
		t('Downloading {count} package(s)...', { count: packages.length })
	);
	try {
		let started = 0;
		let skipped = 0;

		for (let index = 0; index < packages.length; index += 1) {
			const pkg = packages[index];
			const label = getPackageLabel(pkg);
			try {
				let downloadablePackage = pkg;
				let downloadUrl = getAutomationAnywherePackageDownloadUrl(downloadablePackage);
				const packageId = getOptionalString(pkg.id);
				if (!downloadUrl && packageId) {
					downloadablePackage = {
						...pkg,
						...(await activeRuntime.api.getPackageVersion(packageId)),
					};
					downloadUrl = getAutomationAnywherePackageDownloadUrl(downloadablePackage);
				}
				if (!downloadUrl) {
					throw new Error(t('missing pkgDownloadUrl'));
				}

				const fileName = getPackageJarFileName(downloadablePackage);
				downloadUrlFile(
					resolveAutomationAnywhereDownloadUrl(downloadUrl, activeRuntime.context.baseUrl),
					fileName
				);
				started += 1;
				appendToolLog(t('Download started: {fileName}', { fileName }));
			} catch (error) {
				if (isAutomationAnywhereLoggedOutError(error)) throw error;
				skipped += 1;
				appendToolLog(t('Skipped: {label} - {message}', {
					label,
					message: error instanceof Error ? error.message : t('Package details failed.'),
				}), 'warn');
			}

			setToolProgress(index + 1, packages.length, t('Processed {count}/{total}', {
				count: index + 1,
				total: packages.length,
			}));
			if (finishStoppedJob()) return;
			if (index < packages.length - 1) await delay(300);
		}

		const summary = t('Package downloads started. Started {started}, skipped {skipped}.', {
			started,
			skipped,
		});
		const severity = skipped ? 'warn' : 'info';
		setToolStatus(summary, severity);
		finishToolRun(summary, severity);
	} catch (error) {
		const sessionExpired = isAutomationAnywhereLoggedOutError(error);
		if (sessionExpired) packageSessionExpired = true;
		const message = sessionExpired
			? t('Control Room session expired. Log in, then click Refresh.')
			: error instanceof Error
				? error.message
				: t('Download packages failed.');
		setToolStatus(message, sessionExpired ? 'warn' : 'error');
		finishToolRun(message, sessionExpired ? 'warn' : 'error');
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
		const findings = (await getNonClosingMessageBoxWarningEnabled().catch(() => false))
			? findNonClosingMessageBoxes(parsed)
			: [];
		await browser.tabs.reload(activeRuntime.tabId);
		setToolStatus(
			findings.length
				? t('{count} message box action(s) may never close.', {
						count: findings.length,
					})
				: t('Taskbot JSON imported to Control Room.'),
			findings.length ? 'warn' : 'info'
		);
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
		if (findings.length) {
			void options.addFeedback(
				'warn',
				'tools',
				t('{count} message box action(s) may never close.', {
					count: findings.length,
				}),
				{ fileId, findings },
				{ keepDetails: true }
			);
		}
	} catch (error) {
		setToolStatus(error instanceof Error ? error.message : t('Taskbot JSON import failed.'), 'error');
	}
}

async function loadFolderFileNames(
	activeRuntime: ToolsRuntime,
	folderId: string
): Promise<string[]> {
	const names: string[] = [];
	let offset = 0;
	// ponytail: 50 pages x 200 = 10k entries; raise if real folders exceed it.
	for (let page = 0; page < 50; page++) {
		const response = await activeRuntime.api.listFolderContents({
			folderId,
			offset,
			length: PAGE_LENGTH,
		});
		const list = response.list ?? [];
		for (const file of list) names.push(getAutomationAnywhereFileName(file));
		if (list.length < PAGE_LENGTH) break;
		offset += PAGE_LENGTH;
	}
	return names;
}

async function importTaskbotFromFile(): Promise<void> {
	const activeRuntime = runtime;
	const folderId = getCurrentFolderId();
	if (!activeRuntime || !folderId || currentTool !== 'import-taskbot') return;

	const file = importTaskbotFileInput.files?.[0];
	if (!file) {
		setToolStatus(t('Choose a taskbot JSON file first.'), 'error');
		return;
	}

	let parsed: unknown;
	try {
		parsed = JSON.parse(await file.text());
	} catch (error) {
		setToolStatus(error instanceof Error ? error.message : t('Invalid JSON.'), 'error');
		return;
	}
	if (!isTaskbotContentJson(parsed)) {
		setToolStatus(
			t('Not taskbot content JSON. Expected an object with a nodes array.'),
			'error'
		);
		return;
	}

	const baseName = getImportTaskbotBaseName(file.name);
	setBusy(importTaskbotRunButton, true, t('Importing...'));
	startToolRun(t('Import Taskbot'), 1, t('Importing Taskbot...'));
	try {
		const existingNames = await loadFolderFileNames(activeRuntime, folderId);
		const finalName = pickAvailableTaskbotName(baseName, existingNames);
		const created = await activeRuntime.api.createTaskbotFile(folderId, finalName);
		await activeRuntime.api.updateBotContent(created.id, parsed);
		await refreshAutomationAnywhereFolderList(activeRuntime.tabId);
		importTaskbotFileInput.value = '';
		const summary =
			finalName === baseName
				? t('Imported {name}.', { name: finalName })
				: t('Name taken. Imported as {name}.', { name: finalName });
		setToolStatus(summary);
		finishToolRun(summary);
		void options.addFeedback(
			'info',
			'tools',
			t('Taskbot imported to Control Room.'),
			{
				tool: 'import-taskbot',
				folderId,
				fileId: created.id,
				name: finalName,
				renamed: finalName !== baseName,
			},
			{ keepDetails: true, debugOnly: true }
		);
	} catch (error) {
		const message = error instanceof Error ? error.message : t('Import failed.');
		setToolStatus(message, 'error');
		finishToolRun(message, 'error');
		void options.addFeedback(
			'error',
			'tools',
			t('Taskbot import failed.'),
			{ tool: 'import-taskbot', folderId, error },
			{ keepDetails: true }
		);
	} finally {
		setBusy(
			importTaskbotRunButton,
			!importTaskbotFileInput.files?.length,
			t('Import to current folder')
		);
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
		if (activeToolRun?.stopRequested) throw new ToolJobStoppedError();
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
		if (activeToolRun?.stopRequested) throw new ToolJobStoppedError();
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
		if (activeToolRun?.stopRequested) throw new ToolJobStoppedError();
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
	const fileEntries: AutomationAnywhereExportManifestEntry[] = [];
	const metadataEntries: AutomationAnywhereExportManifestEntry[] = [];
	const scannedDependencies = buildScannedDependencyPaths(items);

	for (const item of items) {
		const id = getAutomationAnywhereFileId(item);
		const blob = fileBlobs.get(id);
		if (!blob) continue;
		const path = getAutomationAnywherePath(item);
		addBlobToZip(zip, path, blob);
		fileEntries.push(
			createDependencyManifestEntry({
				path: getAutomationAnywherePath(item),
				contentType: getFileContentType(item),
				scannedDependencies: scannedDependencies.get(id) ?? [],
				tags: getFileTags(item),
			})
		);
	}

	for (const reference of metadataReferences) {
		const blob = metadataBlobs.get(getMetadataKey(reference));
		if (!blob) continue;
		addBlobToZip(zip, getMetadataZipPath(reference), blob);
		metadataEntries.push(
			createMetadataManifestEntry(
				reference,
				getContentTypeFromPath(reference.fileName)
			)
		);
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

function getPathFileName(path: string): string {
	return splitAutomationPath(path).pop() || path;
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

function getPackageLabel(pkg: AutomationAnywherePackage): string {
	const name = getAutomationAnywherePackageName(pkg) || 'package';
	const version = getAutomationAnywherePackageVersion(pkg) || 'unknown';
	return `${name} ${version}`;
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
