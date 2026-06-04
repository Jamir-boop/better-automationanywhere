import type {
	AutomationAnywhereApiBlobResponse,
	AutomationAnywhereApiResponse,
	ContentActionResponse,
} from './messages';

export const AUTOMATION_ANYWHERE_TASKBOT_TYPE = 'application/vnd.aa.taskbot';
export const AUTOMATION_ANYWHERE_DIRECTORY_TYPES = new Set([
	'application/vnd.aa.directory',
	'application/vnd.aa.folder',
]);

export type AutomationAnywherePageType =
	| 'unsupported'
	| 'private-folder'
	| 'public-folder'
	| 'private-taskbot'
	| 'public-taskbot';

export interface AutomationAnywherePageContext {
	url: string;
	baseUrl: string;
	hostname: string;
	pageType: AutomationAnywherePageType;
	folderId?: string;
	fileId?: string;
}

export interface AutomationAnywhereFile {
	id: string | number;
	name?: string;
	type?: string;
	contentType?: string;
	mimeType?: string;
	parentId?: string | number;
	directory?: boolean;
	folder?: boolean;
	lastModified?: string;
	modifiedOn?: string;
	updatedOn?: string;
	path?: string;
	[key: string]: unknown;
}

export interface AutomationAnywhereFolderListResponse {
	list?: AutomationAnywhereFile[];
	items?: AutomationAnywhereFile[];
	page?: {
		offset?: number;
		length?: number;
		total?: number;
		totalFilter?: number;
	};
	total?: number;
}

export interface AutomationAnywherePackageInfo {
	package_name: string;
	package_version: string;
}

export interface AutomationAnywhereBlmStatus {
	status?: string;
	progress?: number;
	message?: string;
	requestId?: string;
	downloadFileId?: string;
	download_file_id?: string;
	fileId?: string;
	[key: string]: unknown;
}

export interface ActiveAutomationAnywhereContext {
	context: AutomationAnywherePageContext;
	tabId: number;
}

function decodeRouteId(id: string | undefined): string | undefined {
	return id ? decodeURIComponent(id) : undefined;
}

export function parseAutomationAnywherePageContext(
	url: string
): AutomationAnywherePageContext {
	let parsed: URL;
	try {
		parsed = new URL(url);
	} catch {
		return {
			url,
			baseUrl: '',
			hostname: '',
			pageType: 'unsupported',
		};
	}

	const route = `${parsed.pathname}${parsed.hash}`;
	const privateFolder = route.match(/\/bots\/repository\/private\/folders\/([^/?#]+)/i);
	if (privateFolder) {
		return {
			url,
			baseUrl: parsed.origin,
			hostname: parsed.hostname,
			pageType: 'private-folder',
			folderId: decodeRouteId(privateFolder[1]),
		};
	}

	const publicFolder = route.match(/\/bots\/repository\/public\/folders\/([^/?#]+)/i);
	if (publicFolder) {
		return {
			url,
			baseUrl: parsed.origin,
			hostname: parsed.hostname,
			pageType: 'public-folder',
			folderId: decodeRouteId(publicFolder[1]),
		};
	}

	const privateTaskbot = route.match(
		/\/bots\/repository\/private\/files\/task\/([^/?#]+)\/edit/i
	);
	if (privateTaskbot) {
		return {
			url,
			baseUrl: parsed.origin,
			hostname: parsed.hostname,
			pageType: 'private-taskbot',
			fileId: decodeRouteId(privateTaskbot[1]),
		};
	}

	const publicTaskbot = route.match(
		/\/bots\/repository\/public\/files\/task\/([^/?#]+)\/view/i
	);
	if (publicTaskbot) {
		return {
			url,
			baseUrl: parsed.origin,
			hostname: parsed.hostname,
			pageType: 'public-taskbot',
			fileId: decodeRouteId(publicTaskbot[1]),
		};
	}

	return {
		url,
		baseUrl: parsed.origin,
		hostname: parsed.hostname,
		pageType: 'unsupported',
	};
}

export async function getActiveAutomationAnywhereContext(): Promise<
	ActiveAutomationAnywhereContext | null
> {
	const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
	if (!tab?.id || !tab.url) return null;
	return {
		context: parseAutomationAnywherePageContext(tab.url),
		tabId: tab.id,
	};
}

export async function getAutomationAnywhereAuthToken(tabId: number): Promise<string> {
	let response: ContentActionResponse | undefined;
	try {
		response = (await browser.tabs.sendMessage(tabId, {
			type: 'GET_AA_AUTH_TOKEN',
		})) as ContentActionResponse | undefined;
	} catch {
		throw new Error('Refresh Automation Anywhere tab.');
	}

	if (!response?.ok) {
		throw new Error(response?.error || 'Refresh Automation Anywhere tab.');
	}
	if (!response.authToken) {
		throw new Error('Log in to Control Room or refresh page.');
	}
	return response.authToken;
}

export function isAutomationAnywhereFolder(file: AutomationAnywhereFile): boolean {
	const type = getAutomationAnywhereFileType(file);
	return Boolean(
		file.directory ||
			file.folder ||
			(type && AUTOMATION_ANYWHERE_DIRECTORY_TYPES.has(type))
	);
}

export function isAutomationAnywhereTaskbot(file: AutomationAnywhereFile): boolean {
	return getAutomationAnywhereFileType(file) === AUTOMATION_ANYWHERE_TASKBOT_TYPE;
}

export function getAutomationAnywhereFileId(file: AutomationAnywhereFile): string {
	return String(file.id);
}

export function getAutomationAnywhereFileName(file: AutomationAnywhereFile): string {
	return file.name || String(file.id);
}

export function getAutomationAnywhereFileType(
	file: AutomationAnywhereFile
): string | undefined {
	return file.type || file.contentType || file.mimeType;
}

export function extractAutomationAnywherePackages(
	content: unknown
): Array<{ name: string; version: string }> {
	if (!content || typeof content !== 'object') return [];
	const packages = (content as { packages?: unknown }).packages;
	if (!Array.isArray(packages)) return [];
	return packages
		.map((item) => {
			if (!item || typeof item !== 'object') return null;
			const pkg = item as {
				name?: unknown;
				packageName?: unknown;
				package_name?: unknown;
				version?: unknown;
				packageVersion?: unknown;
				package_version?: unknown;
			};
			const name = String(pkg.name ?? pkg.packageName ?? pkg.package_name ?? '');
			const version = String(
				pkg.version ?? pkg.packageVersion ?? pkg.package_version ?? ''
			);
			return name && version ? { name, version } : null;
		})
		.filter((item): item is { name: string; version: string } => Boolean(item));
}

export function applyPackageVersionsToContent(
	content: unknown,
	versions: Map<string, string>
): { content: unknown; changed: boolean } {
	if (!content || typeof content !== 'object') return { content, changed: false };
	const packages = (content as { packages?: unknown }).packages;
	if (!Array.isArray(packages)) return { content, changed: false };

	let changed = false;
	for (const item of packages) {
		if (!item || typeof item !== 'object') continue;
		const pkg = item as {
			name?: unknown;
			packageName?: unknown;
			package_name?: unknown;
			version?: unknown;
			packageVersion?: unknown;
			package_version?: unknown;
		};
		const name = String(pkg.name ?? pkg.packageName ?? pkg.package_name ?? '');
		const version = versions.get(name);
		const current = pkg.version ?? pkg.packageVersion ?? pkg.package_version;
		if (!version || current === version) continue;
		if ('version' in pkg) pkg.version = version;
		else if ('packageVersion' in pkg) pkg.packageVersion = version;
		else if ('package_version' in pkg) pkg.package_version = version;
		else pkg.version = version;
		changed = true;
	}

	return { content, changed };
}

export function automationAnywhereBlobResponseToBlob(
	response: AutomationAnywhereApiBlobResponse
): Blob {
	const commaIndex = response.blob.indexOf(',');
	const base64 = commaIndex >= 0 ? response.blob.slice(commaIndex + 1) : response.blob;
	const binary = atob(base64);
	const bytes = new Uint8Array(binary.length);
	for (let index = 0; index < binary.length; index += 1) {
		bytes[index] = binary.charCodeAt(index);
	}
	return new Blob([bytes], { type: response.type || 'application/octet-stream' });
}

export class AutomationAnywhereApi {
	constructor(
		private readonly baseUrl: string,
		private readonly authToken: string
	) {}

	private async request<T>(
		path: string,
		options: {
			method?: string;
			headers?: Record<string, string>;
			body?: unknown;
			responseType?: 'json' | 'text' | 'blob' | 'bot-content';
		} = {}
	): Promise<T> {
		const headers: Record<string, string> = {
			'X-Authorization': this.authToken,
			...options.headers,
		};
		let body: string | undefined;
		if (options.body !== undefined) {
			body = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
			if (!headers['Content-Type']) headers['Content-Type'] = 'application/json';
		}

		const response = (await browser.runtime.sendMessage({
			type: 'AA_API_REQUEST',
			config: {
				url: `${this.baseUrl}${path}`,
				method: options.method ?? (body ? 'POST' : 'GET'),
				headers,
				body,
				responseType: options.responseType ?? 'json',
			},
		})) as AutomationAnywhereApiResponse;

		if (!response?.ok) {
			throw new Error(response?.error || 'Automation Anywhere API request failed.');
		}
		return response.data as T;
	}

	async listFolderContents(params: {
		folderId: string;
		offset?: number;
		length?: number;
		taskbotsOnly?: boolean;
		filesOnly?: boolean;
	}): Promise<AutomationAnywhereFolderListResponse> {
		const filter = params.taskbotsOnly
			? { operator: 'eq', field: 'type', value: AUTOMATION_ANYWHERE_TASKBOT_TYPE }
			: params.filesOnly
				? { operator: 'ne', field: 'type', value: 'application/vnd.aa.folder' }
				: undefined;
		const response = await this.request<AutomationAnywhereFolderListResponse>(
			`/v2/repository/folders/${params.folderId}/list`,
			{
				method: 'POST',
				body: {
					filter,
					page: {
						offset: params.offset ?? 0,
						length: params.length ?? 200,
					},
				},
			}
		);
		const list = response.list ?? response.items ?? [];
		return {
			...response,
			list,
		};
	}

	getBotContent(fileId: string): Promise<unknown> {
		return this.request<unknown>(`/v2/repository/files/${fileId}/content`, {
			responseType: 'bot-content',
		});
	}

	updateBotContent(fileId: string, content: unknown): Promise<unknown> {
		return this.request<unknown>(`/v2/repository/files/${fileId}/content`, {
			method: 'PUT',
			body: content,
		});
	}

	async getDefaultPackageVersions(): Promise<Map<string, string>> {
		const response = await this.request<{ list?: unknown[]; items?: unknown[] }>(
			'/v2/packages/package/list',
			{
				method: 'POST',
				body: {
					filter: { operator: 'eq', field: 'status', value: 'DEFAULT' },
					page: { offset: 0, length: 1000 },
				},
			}
		);
		const versions = new Map<string, string>();
		for (const item of response.list ?? response.items ?? []) {
			if (!item || typeof item !== 'object') continue;
			const pkg = item as {
				name?: unknown;
				packageName?: unknown;
				version?: unknown;
				packageVersion?: unknown;
				defaultVersion?: unknown;
			};
			const name = String(pkg.name ?? pkg.packageName ?? '');
			const version = String(pkg.version ?? pkg.packageVersion ?? pkg.defaultVersion ?? '');
			if (name && version) versions.set(name, version);
		}
		return versions;
	}

	updatePackageVersions(
		fileIds: string[],
		packageInfo: AutomationAnywherePackageInfo[]
	): Promise<unknown> {
		return this.request<unknown>('/v2/repository/files/packagesVersionUpdate', {
			method: 'POST',
			body: {
				name: 'Update packages',
				description: 'Better AA package version update',
				package_info: packageInfo,
				file_ids: fileIds,
				downgrade_version: true,
			},
		});
	}

	copyFile(fileId: string, name: string, parentId: string): Promise<unknown> {
		return this.request<unknown>(`/v2/repository/files/${fileId}/copy`, {
			method: 'POST',
			body: { name, parentId },
		});
	}

	exportBots(fileIds: string[], name: string): Promise<unknown> {
		return this.request<unknown>('/v2/blm/export', {
			method: 'POST',
			body: {
				name,
				fileIds,
				includePackages: true,
				includeGlobalValues: false,
			},
		});
	}

	getBlmStatus(requestId: string, timeout?: number): Promise<AutomationAnywhereBlmStatus> {
		const suffix =
			timeout === undefined
				? `/v2/blm/status/${requestId}`
				: `/v2/blm/status/${requestId}/timeout/${timeout}`;
		return this.request<AutomationAnywhereBlmStatus>(suffix);
	}

	downloadBlmExport(downloadFileId: string): Promise<AutomationAnywhereApiBlobResponse> {
		return this.request<AutomationAnywhereApiBlobResponse>(
			`/v2/blm/download/${downloadFileId}`,
			{ responseType: 'blob' }
		);
	}
}
