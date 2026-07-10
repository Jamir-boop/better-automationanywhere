import type { AutomationAnywherePageContext } from './automation-anywhere-api';
import type { ToolCapabilities } from './messages';

export type AutomationAnywhereToolId =
	| 'universal-clipboard'
	| 'copy-files'
	| 'update-packages'
	| 'export-bots'
	| 'download-packages'
	| 'package-usage'
	| 'taskbot-json'
	| 'import-taskbot';

export type AutomationAnywherePackageUsageStatusFilter = 'ENABLED' | 'DISABLED';

export interface AutomationAnywherePackageUpdate {
	name: string;
	currentVersion: string;
	targetVersion: string;
}

export interface AutomationAnywhereExportManifestEntry {
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

export interface AutomationAnywherePaginationState {
	isPackageTool: boolean;
	packageFallbackScan: boolean;
	loadedCount: number;
	loadedTotal: number;
	lastRawPageLength: number;
	pageLength: number;
	packagePageLength: number;
}

const WINDOWS_RESERVED_FILE_NAME_RE =
	/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i;

export function splitAutomationPath(path: string): string[] {
	return path
		.split(/[\\/]+/)
		.filter((part) => part && part !== '.' && part !== '..');
}

export function sanitizeDownloadFileName(value: string): string {
	const sanitized = value
		.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
		.replace(/\s+/g, ' ')
		.trim()
		.replace(/[. ]+$/g, '');
	if (!sanitized) return 'package';
	return WINDOWS_RESERVED_FILE_NAME_RE.test(sanitized) ? `_${sanitized}` : sanitized;
}

export function getMetadataZipPath(reference: {
	botPath: string;
	fileName: string;
}): string {
	const botPath = splitAutomationPath(reference.botPath);
	const botFileName = botPath.pop() || 'bot';
	const metadataFileName = splitAutomationPath(reference.fileName).pop() || 'metadata';
	return [...botPath, `${botFileName}Metadata`, metadataFileName].join('\\');
}

export function createDependencyManifestEntry(input: {
	path: string;
	contentType: string;
	scannedDependencies: string[];
	tags: string[];
}): AutomationAnywhereExportManifestEntry {
	return {
		path: input.path,
		newPath: null,
		contentType: input.contentType,
		metadataForFile: null,
		manualDependencies: [],
		scannedDependencies: input.scannedDependencies,
		manualDependenciesNewPaths: [],
		scannedDependenciesNewPaths: [],
		description: '',
		author: '',
		tags: input.tags,
		excluded: false,
	};
}

export function createMetadataManifestEntry(
	reference: { botPath: string; fileName: string },
	contentType: string
): AutomationAnywhereExportManifestEntry {
	return {
		path: `${reference.botPath}\\${reference.fileName}`,
		newPath: null,
		contentType,
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

export function packageMatchesFilter(
	packageName: string,
	query: string,
	exactName: string | null
): boolean {
	return exactName
		? packageName === exactName
		: !query || packageName.toLowerCase().includes(query.toLowerCase());
}

export function hasMoreAutomationAnywhereItems(
	state: AutomationAnywherePaginationState
): boolean {
	if (state.isPackageTool && state.loadedTotal > 0) {
		return state.loadedCount < state.loadedTotal;
	}
	if (state.isPackageTool && state.packageFallbackScan) {
		return state.lastRawPageLength >= state.pageLength;
	}
	if (state.isPackageTool) {
		return state.lastRawPageLength >= state.packagePageLength;
	}
	return (
		state.lastRawPageLength >= state.pageLength ||
		state.loadedCount < state.loadedTotal
	);
}

export function getAutomationAnywherePackageUpdates(
	packages: ReadonlyArray<{ name: string; version: string }>,
	defaultVersions: ReadonlyMap<string, string>
): AutomationAnywherePackageUpdate[] {
	return packages.flatMap((pkg) => {
		const targetVersion = defaultVersions.get(pkg.name);
		return targetVersion && targetVersion !== pkg.version
			? [{ name: pkg.name, currentVersion: pkg.version, targetVersion }]
			: [];
	});
}

export function getAutomationAnywherePackageUsageStatusFilter(
	status: unknown
): AutomationAnywherePackageUsageStatusFilter {
	return String(status ?? '').trim().toLowerCase() === 'disabled'
		? 'DISABLED'
		: 'ENABLED';
}

export function hasMoreAutomationAnywherePackageUsage(
	loadedCount: number,
	pageLength: number,
	total: number,
	requestedLength: number
): boolean {
	return pageLength > 0 && (total > 0 ? loadedCount < total : pageLength >= requestedLength);
}

// Control Room caps bot names at 50 characters (create dialog limit).
const TASKBOT_NAME_MAX_LENGTH = 50;

export function getImportTaskbotBaseName(fileName: string): string {
	const withoutExtension = fileName.replace(/\.json$/i, '').trim();
	if (!withoutExtension) return 'imported-taskbot';
	const sanitized = sanitizeDownloadFileName(withoutExtension);
	return sanitized.slice(0, TASKBOT_NAME_MAX_LENGTH).trim() || 'imported-taskbot';
}

export function pickAvailableTaskbotName(
	baseName: string,
	existingNames: Iterable<string>
): string {
	const taken = new Set<string>();
	for (const name of existingNames) taken.add(name.trim().toLocaleLowerCase());
	if (!taken.has(baseName.toLocaleLowerCase())) return baseName;
	for (let suffix = 1; suffix <= 99; suffix++) {
		const tail = `_${suffix}`;
		const candidate =
			baseName.slice(0, TASKBOT_NAME_MAX_LENGTH - tail.length) + tail;
		if (!taken.has(candidate.toLocaleLowerCase())) return candidate;
	}
	// ponytail: 99 collisions means something else is wrong; timestamp breaks the tie.
	return `${baseName.slice(0, TASKBOT_NAME_MAX_LENGTH - 14)}_${Date.now()}`;
}

export function isTaskbotContentJson(value: unknown): value is Record<string, unknown> {
	return Boolean(
		value &&
			typeof value === 'object' &&
			!Array.isArray(value) &&
			Array.isArray((value as Record<string, unknown>).nodes)
	);
}

export function getAvailableAutomationAnywhereTools(
	context: AutomationAnywherePageContext,
	capabilities: ToolCapabilities = { universalClipboard: false }
): AutomationAnywhereToolId[] {
	const tools: AutomationAnywhereToolId[] = [];
	if (capabilities.universalClipboard) tools.push('universal-clipboard');
	if (context.pageType === 'private-folder' || context.pageType === 'public-folder') {
		tools.push('copy-files', 'update-packages', 'export-bots');
		// Public workspace does not allow direct file creation/edit.
		if (context.pageType === 'private-folder') tools.push('import-taskbot');
		return tools;
	}
	if (context.pageType === 'private-taskbot') {
		tools.push('taskbot-json', 'update-packages', 'export-bots');
		return tools;
	}
	if (context.pageType === 'public-taskbot') {
		tools.push('taskbot-json', 'export-bots');
		return tools;
	}
	if (context.pageType === 'packages') {
		tools.push('download-packages', 'package-usage');
		return tools;
	}
	return tools;
}

export function getDefaultTaskbotTool(
	context: AutomationAnywherePageContext,
	capabilities: ToolCapabilities = { universalClipboard: false }
): AutomationAnywhereToolId | null {
	if (context.pageType !== 'private-taskbot' && context.pageType !== 'public-taskbot') {
		return null;
	}
	return capabilities.universalClipboard ? 'universal-clipboard' : 'taskbot-json';
}
