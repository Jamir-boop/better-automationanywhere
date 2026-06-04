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
	type ActiveAutomationAnywhereContext,
	type AutomationAnywhereFile,
	type AutomationAnywherePackageInfo,
	type AutomationAnywherePageContext,
} from '@/src/ts/automation-anywhere-api';
import type {
	ContentActionMessage,
	ContentActionResponse,
} from '@/src/ts/messages';

type FeedbackSeverity = 'info' | 'warn' | 'error';
type ToolId = 'copy-files' | 'update-packages' | 'export-bots' | 'taskbot-json';

interface ToolsRuntime extends ActiveAutomationAnywhereContext {
	api: AutomationAnywhereApi;
}

interface CopiedToolFile {
	id: string;
	name: string;
	sourceFolderId: string;
	hostname: string;
}

interface InitializeToolsOptions {
	setStatus(message: string, severity?: FeedbackSeverity, source?: string): void;
	prettyJson(json: string): string;
	sendActiveTabMessage(message: ContentActionMessage): Promise<ContentActionResponse>;
}

const PAGE_LENGTH = 200;
const EXPORT_POLL_LIMIT = 60;
const EXPORT_POLL_DELAY_MS = 2000;

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

let contextText: HTMLElement;
let actionsContainer: HTMLElement;
let fileSection: HTMLElement;
let listTitle: HTMLElement;
let searchInput: HTMLInputElement;
let selectAllInput: HTMLInputElement;
let selectedCountText: HTMLElement;
let fileList: HTMLElement;
let primaryActionButton: HTMLButtonElement;
let pasteActionButton: HTMLButtonElement;
let loadMoreButton: HTMLButtonElement;
let resultsSection: HTMLElement;
let resultsText: HTMLElement;
let taskbotSection: HTMLElement;
let taskbotJson: HTMLTextAreaElement;
let taskbotJsonMeta: HTMLElement;

export function renderToolsPanel(): string {
	return `
		<section class="tab-panel is-active" role="tabpanel" data-panel="tools">
			<section class="panel-section">
				<div class="section-heading-row">
					<h2>Tools</h2>
					<button id="toolsRefresh" type="button">Refresh</button>
				</div>
				<p id="toolsContext" class="tools-context">Open Automation Anywhere folder or taskbot.</p>
				<div id="toolsActions" class="tool-action-grid"></div>
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
			</section>

			<section id="taskbotJsonSection" class="panel-section" hidden>
				<div class="section-heading-row">
					<h2>Taskbot JSON</h2>
					<span id="taskbotJsonMeta" class="tools-count"></span>
				</div>
				<textarea id="taskbotJson" class="json-area tools-json-area" spellcheck="false"></textarea>
				<div class="button-grid">
					<button id="taskbotLoadJson" type="button">Load</button>
					<button id="taskbotCopyJson" type="button">Copy</button>
					<button id="taskbotFormatJson" type="button">Format</button>
					<button id="taskbotValidateJson" type="button">Validate</button>
				</div>
				<button id="taskbotSaveJson" type="button">Save JSON</button>
			</section>

			<section id="toolsResultsSection" class="panel-section" hidden>
				<h2>Result</h2>
				<pre id="toolsResultsText" class="tools-results"></pre>
			</section>
		</section>
	`;
}

export function initializeToolsPanel(initOptions: InitializeToolsOptions): void {
	options = initOptions;
	contextText = getRequiredElement('#toolsContext');
	actionsContainer = getRequiredElement('#toolsActions');
	fileSection = getRequiredElement('#toolsFileSection');
	listTitle = getRequiredElement('#toolsListTitle');
	searchInput = getRequiredElement<HTMLInputElement>('#toolsSearch');
	selectAllInput = getRequiredElement<HTMLInputElement>('#toolsSelectAll');
	selectedCountText = getRequiredElement('#toolsSelectedCount');
	fileList = getRequiredElement('#toolsFileList');
	primaryActionButton = getRequiredElement<HTMLButtonElement>('#toolsPrimaryAction');
	pasteActionButton = getRequiredElement<HTMLButtonElement>('#toolsPasteAction');
	loadMoreButton = getRequiredElement<HTMLButtonElement>('#toolsLoadMore');
	resultsSection = getRequiredElement('#toolsResultsSection');
	resultsText = getRequiredElement('#toolsResultsText');
	taskbotSection = getRequiredElement('#taskbotJsonSection');
	taskbotJson = getRequiredElement<HTMLTextAreaElement>('#taskbotJson');
	taskbotJsonMeta = getRequiredElement('#taskbotJsonMeta');

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
	getRequiredElement<HTMLButtonElement>('#taskbotLoadJson').addEventListener('click', () => {
		void loadTaskbotJson();
	});
	getRequiredElement<HTMLButtonElement>('#taskbotCopyJson').addEventListener('click', () => {
		void copyTaskbotJson();
	});
	getRequiredElement<HTMLButtonElement>('#taskbotFormatJson').addEventListener('click', () => {
		formatTaskbotJson();
	});
	getRequiredElement<HTMLButtonElement>('#taskbotValidateJson').addEventListener('click', () => {
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

function setResults(text: string): void {
	resultsText.textContent = text;
	resultsSection.hidden = !text;
}

function appendResult(line: string): void {
	const current = resultsText.textContent?.trimEnd();
	setResults(current ? `${current}\n${line}` : line);
}

function setBusy(button: HTMLButtonElement, busy: boolean, label?: string): void {
	button.disabled = busy;
	if (label) button.textContent = label;
}

async function refreshToolsContext(): Promise<void> {
	setResults('');
	actionsContainer.textContent = '';
	fileSection.hidden = true;
	taskbotSection.hidden = true;
	taskbotJson.value = '';
	taskbotJsonFileId = null;

	try {
		const active = await getActiveAutomationAnywhereContext();
		if (!active || active.context.pageType === 'unsupported') {
			runtime = null;
			currentTool = null;
			contextText.textContent = 'Unsupported page. Open Automation Anywhere folder or taskbot.';
			return;
		}

		const authToken = await getAutomationAnywhereAuthToken(active.tabId);
		runtime = {
			...active,
			api: new AutomationAnywhereApi(active.context.baseUrl, authToken),
		};
		contextText.textContent = getContextLabel(active.context);
		renderActionButtons();

		if (isFolderContext(active.context)) {
			currentTool = getAvailableTools(active.context)[0] ?? null;
			renderActionButtons();
			if (currentTool) await loadFolderPage(true);
			return;
		}

		currentTool = 'taskbot-json';
		renderActionButtons();
		taskbotSection.hidden = false;
		await loadTaskbotJson();
	} catch (error) {
		runtime = null;
		currentTool = null;
		contextText.textContent =
			error instanceof Error ? error.message : 'Tools context failed.';
		setToolStatus(contextText.textContent, 'error');
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

function getAvailableTools(context: AutomationAnywherePageContext): ToolId[] {
	if (context.pageType === 'private-folder') {
		return ['copy-files', 'update-packages', 'export-bots'];
	}
	if (context.pageType === 'public-folder') return ['export-bots'];
	if (context.pageType === 'private-taskbot' || context.pageType === 'public-taskbot') {
		return ['taskbot-json'];
	}
	return [];
}

function getToolLabel(tool: ToolId): string {
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
	setResults('');
	taskbotSection.hidden = tool !== 'taskbot-json';
	fileSection.hidden = tool === 'taskbot-json';

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
	if (!activeRuntime || !folderId || !currentTool) return;

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
			taskbotsOnly: currentTool === 'update-packages' || currentTool === 'export-bots',
			filesOnly: currentTool === 'copy-files',
		});
		const rawList = response.list ?? [];
		lastRawPageLength = rawList.length;
		const filtered = filterItemsForTool(rawList);
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
		fileSection.hidden = false;
		setToolStatus(`${loadedItems.length} item(s) loaded.`);
	} catch (error) {
		setToolStatus(
			error instanceof Error ? error.message : 'Folder list failed.',
			'error'
		);
	} finally {
		setBusy(loadMoreButton, false, 'Load more');
	}
}

function filterItemsForTool(items: AutomationAnywhereFile[]): AutomationAnywhereFile[] {
	if (currentTool === 'copy-files') return items.filter((item) => !isAutomationAnywhereFolder(item));
	if (currentTool === 'update-packages' || currentTool === 'export-bots') {
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
	copiedFiles = getSelectedItems().map((item) => ({
		id: getAutomationAnywhereFileId(item),
		name: getAutomationAnywhereFileName(item),
		sourceFolderId: folderId,
		hostname: context.hostname,
	}));
	setResults(`Copied ${copiedFiles.length} file reference(s). Open target folder, then Paste.`);
	setToolStatus(`${copiedFiles.length} file reference(s) copied.`);
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
	setResults('Pasting copied files...');
	try {
		const destinationItems = await loadAllFolderItems(folderId, true);
		const destinationNames = new Set(
			destinationItems.map((item) => getAutomationAnywhereFileName(item).toLowerCase())
		);
		let copied = 0;
		let skipped = 0;
		let failed = 0;

		for (const item of copiedFiles) {
			if (destinationNames.has(item.name.toLowerCase())) {
				skipped += 1;
				appendResult(`Skipped duplicate: ${item.name}`);
				continue;
			}
			try {
				await activeRuntime.api.copyFile(item.id, item.name, folderId);
				copied += 1;
				destinationNames.add(item.name.toLowerCase());
				appendResult(`Copied: ${item.name}`);
			} catch (error) {
				failed += 1;
				appendResult(
					`Failed: ${item.name} - ${
						error instanceof Error ? error.message : 'copy failed'
					}`
				);
			}
		}

		await options.sendActiveTabMessage({ type: 'REFRESH_AA_FOLDER_LIST' });
		await loadFolderPage(true);
		setToolStatus(
			`Paste done. Copied ${copied}, skipped ${skipped}, failed ${failed}.`,
			failed ? 'warn' : 'info'
		);
	} catch (error) {
		setToolStatus(error instanceof Error ? error.message : 'Paste failed.', 'error');
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
	setResults('Loading default package versions...');
	try {
		const defaults = await activeRuntime.api.getDefaultPackageVersions();
		const changedFileIds: string[] = [];
		const packageInfo = new Map<string, AutomationAnywherePackageInfo>();

		for (const bot of bots) {
			const fileId = getAutomationAnywhereFileId(bot);
			const content = await activeRuntime.api.getBotContent(fileId);
			const packages = extractAutomationAnywherePackages(content);
			const changes = packages.filter((pkg) => {
				const target = defaults.get(pkg.name);
				return target && target !== pkg.version;
			});
			if (!changes.length) {
				appendResult(`Skipped: ${getAutomationAnywhereFileName(bot)} - no package change`);
				continue;
			}
			changedFileIds.push(fileId);
			for (const change of changes) {
				const target = defaults.get(change.name);
				if (!target) continue;
				packageInfo.set(change.name, {
					package_name: change.name,
					package_version: target,
				});
			}
			appendResult(`Queued: ${getAutomationAnywhereFileName(bot)} - ${changes.length} package(s)`);
		}

		if (!changedFileIds.length) {
			setToolStatus('No package updates needed.');
			return;
		}

		try {
			await activeRuntime.api.updatePackageVersions(changedFileIds, [...packageInfo.values()]);
			appendResult(`packagesVersionUpdate succeeded for ${changedFileIds.length} bot(s).`);
			setToolStatus(`Updated ${changedFileIds.length} bot(s).`);
		} catch (error) {
			appendResult(
				`packagesVersionUpdate failed: ${
					error instanceof Error ? error.message : 'request failed'
				}`
			);
			await fallbackUpdatePackageJson(activeRuntime, bots, defaults, changedFileIds);
		}
	} catch (error) {
		setToolStatus(
			error instanceof Error ? error.message : 'Update packages failed.',
			'error'
		);
	} finally {
		setBusy(primaryActionButton, false);
		updateActionBar();
	}
}

async function fallbackUpdatePackageJson(
	activeRuntime: ToolsRuntime,
	bots: AutomationAnywhereFile[],
	defaults: Map<string, string>,
	changedFileIds: string[]
): Promise<void> {
	let updated = 0;
	let failed = 0;
	const changedSet = new Set(changedFileIds);
	for (const bot of bots) {
		const fileId = getAutomationAnywhereFileId(bot);
		if (!changedSet.has(fileId)) continue;
		try {
			const content = await activeRuntime.api.getBotContent(fileId);
			const result = applyPackageVersionsToContent(content, defaults);
			if (!result.changed) {
				appendResult(`Skipped fallback: ${getAutomationAnywhereFileName(bot)}`);
				continue;
			}
			await activeRuntime.api.updateBotContent(fileId, result.content);
			updated += 1;
			appendResult(`Fallback updated: ${getAutomationAnywhereFileName(bot)}`);
		} catch (error) {
			failed += 1;
			appendResult(
				`Fallback failed: ${getAutomationAnywhereFileName(bot)} - ${
					error instanceof Error ? error.message : 'update failed'
				}`
			);
		}
	}
	setToolStatus(`Fallback done. Updated ${updated}, failed ${failed}.`, failed ? 'warn' : 'info');
}

async function exportSelectedBots(): Promise<void> {
	const activeRuntime = runtime;
	if (!activeRuntime) return;
	const bots = getSelectedItems().filter(isAutomationAnywhereTaskbot);
	if (!bots.length) return;

	setBusy(primaryActionButton, true, 'Exporting...');
	const exportName = `better-aa-export-${new Date().toISOString().replace(/[:.]/g, '-')}`;
	setResults('Starting BLM export. Do not close sidepanel.');
	try {
		const exportResponse = await activeRuntime.api.exportBots(
			bots.map(getAutomationAnywhereFileId),
			exportName
		);
		const requestId = findStringByKeys(exportResponse, ['requestId', 'id']);
		let downloadFileId = findStringByKeys(exportResponse, [
			'downloadFileId',
			'download_file_id',
			'fileId',
		]);

		if (!downloadFileId) {
			if (!requestId) throw new Error('BLM export did not return requestId.');
			for (let attempt = 1; attempt <= EXPORT_POLL_LIMIT; attempt += 1) {
				await sleep(EXPORT_POLL_DELAY_MS);
				const status = await activeRuntime.api.getBlmStatus(requestId);
				const state = String(status.status ?? '').toUpperCase();
				appendResult(`BLM status ${attempt}: ${state || 'UNKNOWN'}`);
				if (state === 'FAILED' || state === 'ERROR') {
					throw new Error(status.message || 'BLM export failed.');
				}
				downloadFileId = findStringByKeys(status, [
					'downloadFileId',
					'download_file_id',
					'fileId',
				]);
				if (state === 'COMPLETED' || state === 'SUCCESS' || downloadFileId) break;
			}
		}

		if (!downloadFileId) throw new Error('BLM export completed without downloadFileId.');
		const download = await activeRuntime.api.downloadBlmExport(downloadFileId);
		const blob = automationAnywhereBlobResponseToBlob(download);
		const fileName = download.fileName || `${exportName}.zip`;
		downloadBlob(blob, fileName);
		appendResult(`Downloaded: ${fileName}`);
		setToolStatus(`Export downloaded: ${fileName}`);
	} catch (error) {
		setToolStatus(error instanceof Error ? error.message : 'Export failed.', 'error');
	} finally {
		setBusy(primaryActionButton, false);
		updateActionBar();
	}
}

async function loadTaskbotJson(): Promise<void> {
	const activeRuntime = runtime;
	const fileId = activeRuntime?.context.fileId;
	if (!activeRuntime || !fileId) return;

	taskbotSection.hidden = false;
	taskbotJsonMeta.textContent = `File ${fileId}`;
	taskbotJson.value = '';
	taskbotJsonFileId = fileId;
	setResults('');
	try {
		const content = await activeRuntime.api.getBotContent(fileId);
		taskbotJson.value = JSON.stringify(content, null, 2);
		setToolStatus('Taskbot JSON loaded.');
	} catch (error) {
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
		setToolStatus('Taskbot JSON formatted.');
	} catch {
		setToolStatus('Invalid JSON.', 'error');
	}
}

function validateTaskbotJson(): void {
	try {
		JSON.parse(taskbotJson.value);
		setToolStatus('Taskbot JSON valid.');
	} catch (error) {
		setToolStatus(error instanceof Error ? error.message : 'Invalid JSON.', 'error');
	}
}

async function saveTaskbotJson(): Promise<void> {
	const activeRuntime = runtime;
	const fileId = taskbotJsonFileId;
	if (!activeRuntime || !fileId) return;

	let parsed: unknown;
	try {
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

function findStringByKeys(value: unknown, keys: string[]): string | null {
	if (!value || typeof value !== 'object') return null;
	const record = value as Record<string, unknown>;
	for (const key of keys) {
		const candidate = record[key];
		if (typeof candidate === 'string' && candidate) return candidate;
		if (typeof candidate === 'number') return String(candidate);
	}
	for (const nested of Object.values(record)) {
		if (!nested || typeof nested !== 'object') continue;
		const found = findStringByKeys(nested, keys);
		if (found) return found;
	}
	return null;
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

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => {
		setTimeout(resolve, ms);
	});
}
