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
} from '@/src/ts/automation-anywhere-api';
import type {
	ContentActionResponse,
	ToolCapabilities,
} from '@/src/ts/messages';
import JSZip from 'jszip';
type FeedbackSeverity = 'info' | 'warn' | 'error';
type ToolId =
	| 'universal-clipboard'
	| 'copy-files'
	| 'update-packages'
	| 'export-bots'
	| 'taskbot-json';

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
let loadedItems: AutomationAnywhereFile[] = [];
let selectedIds = new Set<string>();
let loadedOffset = 0;
let loadedTotal = 0;
let lastRawPageLength = 0;
let copiedFiles: CopiedToolFile[] = [];
let taskbotJsonFileId: string | null = null;
let activeToolRun: ToolRunState | null = null;

let contextText: HTMLElement;
let availabilityDot: HTMLElement;
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
let loadMoreButton: HTMLButtonElement;
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
					<h2>Tools</h2>
					<span class="tools-refresh-group">
						<span id="toolsAvailabilityDot" class="tools-availability-dot" data-available="false" aria-hidden="true"></span>
						<button id="toolsRefresh" class="icon-button" type="button" aria-label="Refresh tools" title="Refresh tools">
							<span aria-hidden="true">&#8635;</span>
						</button>
					</span>
				</div>
				<p id="toolsContext" class="tools-context">Open Automation Anywhere folder or taskbot.</p>
				<div id="toolsActions" class="tool-action-grid"></div>
			</section>

			<section id="universalClipboardSection" class="panel-section" hidden>
				${renderOptions.universalClipboardHtml ?? ''}
			</section>

			<section id="toolsFileSection" class="panel-section" hidden>
				<div class="section-heading-row">
					<h2 id="toolsListTitle">Files</h2>
					<span id="toolsSelectedCount" class="tools-count">0 selected</span>
				</div>
				<div class="tools-list-toolbar">
					<input id="toolsSearch" type="text" placeholder="Search files" autocomplete="off">
					<label class="tools-select-all">
						<input id="toolsSelectAll" type="checkbox">
						<span>Select visible</span>
					</label>
				</div>
				<div id="toolsFileList" class="tools-file-list"></div>
				<button id="toolsLoadMore" type="button" hidden>Load more</button>
				<div class="tools-action-bar">
					<button id="toolsPrimaryAction" type="button" disabled>Run</button>
					<button id="toolsPasteAction" type="button" hidden>Paste copied files</button>
				</div>
				<div id="toolsProgress" class="tools-progress" hidden aria-live="polite">
					<div class="tools-progress-meta">
						<span id="toolsProgressLabel">Idle</span>
						<span id="toolsProgressPercent">0%</span>
					</div>
					<div id="toolsProgressBar" class="tools-progress-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
						<span id="toolsProgressFill" class="tools-progress-fill"></span>
					</div>
				</div>
				<div id="toolsFinishModal" class="tools-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="toolsFinishTitle" hidden>
					<div class="tools-modal">
						<h2 id="toolsFinishTitle">Tool finished</h2>
						<p id="toolsFinishSummary"></p>
						<div id="toolsFinishLog" class="tools-finish-log"></div>
						<button id="toolsFinishClose" type="button">Close</button>
					</div>
				</div>
			</section>

			<section id="taskbotJsonSection" class="panel-section" hidden>
				<div class="section-heading-row">
					<h2>Taskbot JSON</h2>
					<span id="taskbotJsonMeta" class="tools-count"></span>
				</div>
				<textarea id="taskbotJson" class="json-area tools-json-area" spellcheck="false" aria-describedby="taskbotJsonError"></textarea>
				<p id="taskbotJsonError" class="json-inline-error" hidden></p>
				<div class="button-grid">
					<button id="taskbotLoadJson" type="button">Load from Control Room</button>
					<button id="taskbotCopyJson" type="button">Copy to clipboard</button>
					<button id="taskbotFormatJson" type="button">Format</button>
				</div>
				<button id="taskbotSaveJson" type="button">Save JSON</button>
			</section>

		</section>
	`;
}

export function initializeToolsPanel(initOptions: InitializeToolsOptions): void {
	options = initOptions;
	contextText = getRequiredElement('#toolsContext');
	availabilityDot = getRequiredElement('#toolsAvailabilityDot');
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
	loadMoreButton = getRequiredElement<HTMLButtonElement>('#toolsLoadMore');
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

	getRequiredElement<HTMLButtonElement>('#toolsRefresh').addEventListener('click', () => {
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
		void loadFolderPage(false);
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
			? `${run.title} failed`
			: severity === 'warn'
				? `${run.title} finished with warnings`
				: `${run.title} finished`;
	const seconds = Math.max(0, Math.round((Date.now() - run.startedAt) / 1000));
	toolsFinishSummary.textContent = `${summary} Duration: ${seconds}s.`;
	toolsFinishLog.textContent = '';
	if (!run.lines.length) {
		const empty = document.createElement('p');
		empty.className = 'tools-finish-empty';
		empty.textContent = 'No actions recorded.';
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
	availabilityDot.title = hasTools ? 'Tools available' : 'No tools available';
}

function isFolderTool(
	tool: ToolId | null
): tool is Exclude<ToolId, 'universal-clipboard' | 'taskbot-json'> {
	return tool === 'copy-files' || tool === 'update-packages' || tool === 'export-bots';
}

function setToolPanelHidden(panel: HTMLElement, hidden: boolean): void {
	panel.hidden = hidden;
	panel.setAttribute('aria-hidden', String(hidden));
}

function setSelectedToolPanel(tool: ToolId | null): void {
	setToolPanelHidden(universalClipboardSection, tool !== 'universal-clipboard');
	setToolPanelHidden(taskbotSection, tool !== 'taskbot-json');
	setToolPanelHidden(fileSection, !isFolderTool(tool));
}

async function refreshToolsContext(): Promise<void> {
	actionsContainer.textContent = '';
	setSelectedToolPanel(null);
	taskbotJson.value = '';
	validateTaskbotJson();
	taskbotJsonFileId = null;
	updateAvailabilityDot(false);

	try {
		const active = await getActiveAutomationAnywhereContext();
		if (!active || active.context.pageType === 'unsupported') {
			runtime = null;
			currentTool = null;
			contextText.textContent = 'Unsupported page. Open Automation Anywhere folder or taskbot.';
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
			currentTool = null;
			setSelectedToolPanel(null);
			renderActionButtons();
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
			error instanceof Error ? error.message : 'Tools context failed.';
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
		return `Private folder ${context.folderId} on ${context.hostname}`;
	}
	if (context.pageType === 'public-folder') {
		return `Public folder ${context.folderId} on ${context.hostname}`;
	}
	if (context.pageType === 'private-taskbot') {
		return `Private taskbot ${context.fileId} on ${context.hostname}`;
	}
	if (context.pageType === 'public-taskbot') {
		return `Public taskbot ${context.fileId} on ${context.hostname}`;
	}
	return 'Unsupported page.';
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
	return tools;
}

function getToolLabel(tool: ToolId): string {
	if (tool === 'universal-clipboard') return 'Universal Clipboard';
	if (tool === 'copy-files') return 'Copy Files';
	if (tool === 'update-packages') return 'Update Packages';
	if (tool === 'export-bots') return 'Export Bots';
	return 'Taskbot JSON';
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
		button.addEventListener('click', () => {
			void selectTool(tool);
		});
		actionsContainer.appendChild(button);
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

	await loadFolderPage(true);
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

	setBusy(loadMoreButton, true, reset ? 'Loading...' : 'Loading more...');
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
		const byId = new Map(loadedItems.map((item) => [getAutomationAnywhereFileId(item), item]));
		for (const item of filtered) byId.set(getAutomationAnywhereFileId(item), item);
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
		setToolStatus(`${loadedItems.length} item(s) loaded.`);
	} catch (error) {
		if (runtime !== activeRuntime || currentTool !== selectedTool) return;
		setToolStatus(
			error instanceof Error ? error.message : 'Folder list failed.',
			'error'
		);
	} finally {
		if (runtime === activeRuntime && currentTool === selectedTool) {
			setBusy(loadMoreButton, false, 'Load more');
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

function pruneSelection(): void {
	const available = new Set(loadedItems.map(getAutomationAnywhereFileId));
	selectedIds = new Set([...selectedIds].filter((id) => available.has(id)));
}

function renderFileList(): void {
	const search = searchInput.value.trim().toLowerCase();
	const visible = loadedItems.filter((item) =>
		getAutomationAnywhereFileName(item).toLowerCase().includes(search)
	);

	listTitle.textContent =
		currentTool === 'copy-files'
			? 'Copy Files'
			: currentTool === 'update-packages'
				? 'Update Packages'
				: 'Export Bots';
	selectedCountText.textContent = `${selectedIds.size} selected / ${loadedItems.length} loaded`;
	fileList.textContent = '';

	if (!visible.length) {
		const empty = document.createElement('p');
		empty.className = 'tools-empty';
		empty.textContent = loadedItems.length ? 'No matches.' : 'No files found.';
		fileList.appendChild(empty);
	}

	for (const item of visible) {
		const id = getAutomationAnywhereFileId(item);
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
		name.textContent = getAutomationAnywhereFileName(item);
		const meta = document.createElement('small');
		meta.textContent = getItemMeta(item);
		const text = document.createElement('span');
		text.className = 'tool-file-text';
		text.append(name, meta);
		row.append(checkbox, text);
		fileList.appendChild(row);
	}

	const allVisibleSelected =
		visible.length > 0 && visible.every((item) => selectedIds.has(getAutomationAnywhereFileId(item)));
	const someVisibleSelected = visible.some((item) => selectedIds.has(getAutomationAnywhereFileId(item)));
	selectAllInput.checked = allVisibleSelected;
	selectAllInput.indeterminate = someVisibleSelected && !allVisibleSelected;
	updateActionBar();
}

function getItemMeta(item: AutomationAnywhereFile): string {
	const type = getAutomationAnywhereFileType(item) ?? 'unknown';
	const modified = item.lastModified ?? item.modifiedOn ?? item.updatedOn;
	return modified ? `${type} | ${modified}` : type;
}

function toggleVisibleSelection(): void {
	const search = searchInput.value.trim().toLowerCase();
	const visible = loadedItems.filter((item) =>
		getAutomationAnywhereFileName(item).toLowerCase().includes(search)
	);
	for (const item of visible) {
		const id = getAutomationAnywhereFileId(item);
		if (selectAllInput.checked) selectedIds.add(id);
		else selectedIds.delete(id);
	}
	renderFileList();
}

function updateActionBar(): void {
	const count = selectedIds.size;
	primaryActionButton.disabled = count === 0;
	if (currentTool === 'copy-files') primaryActionButton.textContent = `Copy ${count} file(s)`;
	if (currentTool === 'update-packages') primaryActionButton.textContent = `Update ${count} bot(s)`;
	if (currentTool === 'export-bots') primaryActionButton.textContent = `Export ${count} bot(s)`;

	const canPaste = canPasteCopiedFiles();
	pasteActionButton.hidden = !canPaste;
	pasteActionButton.disabled = !canPaste;
	pasteActionButton.textContent = `Paste ${copiedFiles.length} copied file(s)`;

	loadMoreButton.hidden = !hasMoreItems();
}

function hasMoreItems(): boolean {
	return lastRawPageLength >= PAGE_LENGTH || loadedItems.length < loadedTotal;
}

function getSelectedItems(): AutomationAnywhereFile[] {
	return loadedItems.filter((item) => selectedIds.has(getAutomationAnywhereFileId(item)));
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
	}
}

function copySelectedFiles(): void {
	const folderId = getCurrentFolderId();
	const context = runtime?.context;
	if (!folderId || !context) return;
	const items = getSelectedItems();
	if (!items.length) return;
	startToolRun('Copy Files', items.length, `Copying ${items.length} file reference(s)...`);
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
		appendToolLog(`Copied reference: ${name}`);
		setToolProgress(index + 1, items.length, `Copied ${index + 1}/${items.length}`);
	}
	const summary = `${copiedFiles.length} file reference(s) copied. Open target folder, then Paste.`;
	setToolStatus(summary);
	finishToolRun(summary);
	updateActionBar();
}

function canPasteCopiedFiles(): boolean {
	const folderId = getCurrentFolderId();
	const context = runtime?.context;
	return Boolean(
		currentTool === 'copy-files' &&
			folderId &&
			context &&
			copiedFiles.length &&
			copiedFiles[0].hostname === context.hostname &&
			copiedFiles[0].sourceFolderId !== folderId
	);
}

async function pasteCopiedFiles(): Promise<void> {
	const activeRuntime = runtime;
	const folderId = getCurrentFolderId();
	if (!activeRuntime || !folderId || !canPasteCopiedFiles()) return;

	setBusy(pasteActionButton, true, 'Pasting...');
	startToolRun(
		'Paste Copied Files',
		copiedFiles.length,
		`Pasting ${copiedFiles.length} copied file(s)...`
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
				appendToolLog(`Skipped duplicate: ${item.name}`, 'warn');
				setToolProgress(
					index + 1,
					copiedFiles.length,
					`Processed ${index + 1}/${copiedFiles.length}`
				);
				continue;
			}
			try {
				await activeRuntime.api.copyFile(item.id, item.name, folderId);
				copied += 1;
				destinationNames.add(item.name.toLowerCase());
				appendToolLog(`Copied: ${item.name}`);
			} catch (error) {
				failed += 1;
				appendToolLog(
					`Failed: ${item.name} - ${
						error instanceof Error ? error.message : 'copy failed'
					}`,
					'error'
				);
			}
			setToolProgress(
				index + 1,
				copiedFiles.length,
				`Processed ${index + 1}/${copiedFiles.length}`
			);
		}

		await refreshAutomationAnywhereFolderList(activeRuntime.tabId);
		await loadFolderPage(true);
		const summary = `Paste done. Copied ${copied}, skipped ${skipped}, failed ${failed}.`;
		const severity = failed ? 'warn' : 'info';
		setToolStatus(summary, severity);
		finishToolRun(summary, severity);
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Paste failed.';
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
	const bots = getSelectedItems();
	if (!bots.length) return;

	setBusy(primaryActionButton, true, 'Updating...');
	startToolRun('Update Packages', bots.length, 'Loading default package versions...');
	try {
		const defaults = await activeRuntime.api.getDefaultPackageVersions();
		if (!defaults.size) {
			const message = 'No default package versions found.';
			setToolStatus(message, 'error');
			finishToolRun(message, 'error');
			return;
		}

		appendToolLog(`Loaded ${defaults.size} default package version(s).`);
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
					appendToolLog(`Skipped: ${botName} - no package change`);
					setToolProgress(index + 1, bots.length, `Processed ${index + 1}/${bots.length}`);
					continue;
				}
				await activeRuntime.api.updateBotContent(fileId, result.content);
				updated += 1;
				appendToolLog(`Updated: ${botName} - ${changes.length} package(s)`);
			} catch (error) {
				failed += 1;
				appendToolLog(
					`Failed: ${botName} - ${
						error instanceof Error ? error.message : 'update failed'
					}`,
					'error'
				);
			}
			setToolProgress(index + 1, bots.length, `Processed ${index + 1}/${bots.length}`);
		}
		const summary = `Update packages done. Updated ${updated}, skipped ${skipped}, failed ${failed}.`;
		const severity = failed ? 'warn' : 'info';
		setToolStatus(summary, severity);
		finishToolRun(summary, severity);
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Update packages failed.';
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
	const bots = getSelectedItems().filter(isAutomationAnywhereTaskbot);
	if (!bots.length) return;

	setBusy(primaryActionButton, true, 'Exporting...');
	const exportName = `better-aa-export-${new Date().toISOString().replace(/[:.]/g, '-')}`;
	startToolRun(
		'Export Bots',
		5,
		`Starting ZIP export for ${bots.length} bot(s). Do not close sidepanel.`
	);
	try {
		const rootIds = new Set(bots.map(getAutomationAnywhereFileId));
		setToolProgress(0, 5, 'Fetching dependency graph...');
		appendToolLog('Fetching dependency graph...');
		const dependencyResponse = await activeRuntime.api.getBotDependencies([...rootIds]);
		const dependencyItems = dependencyResponse.dependencies ?? [];
		const exportItems = dedupeAutomationAnywhereFiles([...bots, ...dependencyItems]);
		if (!exportItems.length) {
			throw new Error(
				`Dependency graph is empty. Response: ${stringifyForFeedback(dependencyResponse)}`
			);
		}

		appendToolLog(`Dependency graph loaded: ${exportItems.length} file(s).`);
		const taskbots = exportItems.filter(isExportTaskbot);
		setToolProgress(1, 5, `Dependency graph loaded: ${exportItems.length} file(s).`);
		appendToolLog(`Scanning ${taskbots.length} taskbot file(s) for metadata paths...`);
		const metadataReferences = await scanMetadataReferences(activeRuntime, taskbots);
		if (metadataReferences.length) {
			appendToolLog(`Metadata references found: ${metadataReferences.length}.`);
		}
		setToolProgress(2, 5, `Metadata scan done: ${metadataReferences.length} reference(s).`);

		appendToolLog(
			`Downloading ${exportItems.length + metadataReferences.length} export file(s)...`
		);
		const fileBlobs = await downloadExportFiles(activeRuntime, exportItems, rootIds);
		const metadataBlobs = await downloadMetadataFiles(activeRuntime, metadataReferences);
		setToolProgress(3, 5, 'Export file downloads done.');
		appendToolLog('Creating export archive...');
		const archive = await createExportArchive(
			exportItems,
			metadataReferences,
			fileBlobs,
			metadataBlobs
		);
		setToolProgress(4, 5, 'Export archive created.');
		const fileName = `${exportName}.zip`;
		downloadBlob(archive, fileName);
		appendToolLog(`Downloaded: ${fileName}`);
		const summary = `Export downloaded: ${fileName}`;
		setToolStatus(summary);
		finishToolRun(summary);
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Export failed.';
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
	taskbotJsonMeta.textContent = `File ${fileId}`;
	taskbotJson.value = '';
	taskbotJsonFileId = fileId;
	try {
		const content = await activeRuntime.api.getBotContent(fileId);
		if (runtime !== activeRuntime || currentTool !== selectedTool || taskbotJsonFileId !== fileId) {
			return;
		}
		taskbotJson.value = JSON.stringify(content, null, 2);
		validateTaskbotJson();
		setToolStatus('Taskbot JSON loaded.');
	} catch (error) {
		if (runtime !== activeRuntime || currentTool !== selectedTool || taskbotJsonFileId !== fileId) {
			return;
		}
		setToolStatus(
			error instanceof Error ? error.message : 'Taskbot JSON load failed.',
			'error'
		);
	}
}

async function copyTaskbotJson(): Promise<void> {
	if (!taskbotJson.value.trim()) {
		setToolStatus('Taskbot JSON is empty.', 'warn');
		return;
	}
	try {
		await navigator.clipboard.writeText(taskbotJson.value);
		setToolStatus('Taskbot JSON copied.');
	} catch {
		setToolStatus('Clipboard write failed.', 'error');
	}
}

function formatTaskbotJson(): void {
	try {
		taskbotJson.value = options.prettyJson(taskbotJson.value);
		JSON.parse(taskbotJson.value);
		validateTaskbotJson();
		setToolStatus('Taskbot JSON formatted.');
	} catch (error) {
		validateTaskbotJson();
		setToolStatus(error instanceof Error ? error.message : 'Invalid JSON.', 'error');
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
		taskbotJsonError.textContent = error instanceof Error ? error.message : 'Invalid JSON.';
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
			setToolStatus(taskbotJsonError.textContent || 'Invalid JSON.', 'error');
			return;
		}
		parsed = JSON.parse(taskbotJson.value);
	} catch (error) {
		setToolStatus(error instanceof Error ? error.message : 'Invalid JSON.', 'error');
		return;
	}

	if (!window.confirm('Update taskbot content in Control Room?')) return;
	try {
		await activeRuntime.api.updateBotContent(fileId, parsed);
		const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
		if (tab?.id) await browser.tabs.reload(tab.id);
		setToolStatus('Taskbot JSON saved.');
	} catch (error) {
		setToolStatus(error instanceof Error ? error.message : 'Taskbot JSON save failed.', 'error');
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
				appendToolLog(`Metadata scan skipped: ${getErrorMessage(result.reason)}`, 'warn');
			}
		}
		appendToolLog(
			`Metadata scan progress: ${Math.min(index + batch.length, taskbots.length)}/${taskbots.length}`
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
			if (rootIds.has(id)) throw new Error(`Selected bot download failed: ${message}`);
			appendToolLog(`Dependency omitted: ${message}`, 'warn');
		}
		appendToolLog(
			`File download progress: ${Math.min(index + batch.length, items.length)}/${items.length}`
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
			appendToolLog(`Metadata omitted: ${getErrorMessage(result.reason)}`, 'warn');
		}
		appendToolLog(
			`Metadata download progress: ${Math.min(
				index + batch.length,
				references.length
			)}/${references.length}`
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
		if (!next) throw new Error(`Failed to create ZIP folder: ${part}`);
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
