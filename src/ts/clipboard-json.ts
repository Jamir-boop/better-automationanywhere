export const AUTOMATION_ANYWHERE_UID_PLACEHOLDER = '__BETTER_AA_UID__';
export const PORTABLE_CLIPBOARD_KEY = '__betterAutomationAnywhere';
export const PORTABLE_CLIPBOARD_VERSION = 1;

const METADATA_PATH_KEYS = new Set([
	'screenshotMetadataPath',
	'thumbnailMetadataPath',
]);
const SECURE_RECORDING_KEYS = [
	'secureRecorded',
	'secureRecording',
	'secureRecordingEnabled',
];

export interface PortableClipboardResource {
	contentType: string;
	base64: string;
}

export interface PortableClipboardEnvelope {
	version: 1;
	sourceOrigin: string;
	sourceFileId: string;
	resources: Record<string, PortableClipboardResource>;
	missing: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function hasSecureRecordingFlag(record: Record<string, unknown>): boolean {
	return SECURE_RECORDING_KEYS.some((key) => record[key] === true);
}

function hasSecureRecordingFlagDeep(value: unknown): boolean {
	if (!value || typeof value !== 'object') return false;
	if (Array.isArray(value)) return value.some(hasSecureRecordingFlagDeep);
	const record = value as Record<string, unknown>;
	return (
		hasSecureRecordingFlag(record) ||
		Object.values(record).some(hasSecureRecordingFlagDeep)
	);
}

function visitMetadataPaths(
	value: unknown,
	visitor: (record: Record<string, unknown>, key: string, path: string) => void,
	secure = false,
	skipSecure = true
): void {
	if (!value || typeof value !== 'object') return;
	if (Array.isArray(value)) {
		for (const item of value) visitMetadataPaths(item, visitor, secure, skipSecure);
		return;
	}

	const record = value as Record<string, unknown>;
	const branchIsSecure = secure || hasSecureRecordingFlag(record);
	for (const [key, child] of Object.entries(record)) {
		if (METADATA_PATH_KEYS.has(key) && typeof child === 'string' && child) {
			if (!skipSecure || !branchIsSecure) visitor(record, key, child);
			continue;
		}
		visitMetadataPaths(child, visitor, branchIsSecure, skipSecure);
	}
}

export function collectPortableMetadataPaths(value: unknown): string[] {
	const paths = new Set<string>();
	const visitor = (_record: Record<string, unknown>, _key: string, path: string) =>
		paths.add(path);
	if (isRecord(value) && Array.isArray(value.nodes)) {
		for (const node of value.nodes) {
			visitMetadataPaths(node, visitor, hasSecureRecordingFlagDeep(node));
		}
	} else {
		visitMetadataPaths(value, visitor, hasSecureRecordingFlagDeep(value));
	}
	return [...paths];
}

export function getNativeClipboardSourceFileId(value: unknown): string {
	if (!isRecord(value)) return '';
	const sourceFileId = value.sourceFileId;
	return typeof sourceFileId === 'string' || typeof sourceFileId === 'number'
		? String(sourceFileId)
		: '';
}

export function addPortableClipboardEnvelope(
	json: string,
	envelope: Omit<PortableClipboardEnvelope, 'version'>
): string {
	const value = JSON.parse(json) as unknown;
	if (!isRecord(value)) throw new Error('Clipboard JSON is not an object.');
	value[PORTABLE_CLIPBOARD_KEY] = {
		version: PORTABLE_CLIPBOARD_VERSION,
		...envelope,
	};
	return JSON.stringify(value);
}

export function getPortableClipboardEnvelope(
	value: unknown
): PortableClipboardEnvelope | null {
	if (!isRecord(value)) return null;
	const candidate = value[PORTABLE_CLIPBOARD_KEY];
	if (!isRecord(candidate) || candidate.version !== PORTABLE_CLIPBOARD_VERSION) {
		return null;
	}
	if (
		typeof candidate.sourceOrigin !== 'string' ||
		typeof candidate.sourceFileId !== 'string' ||
		!isRecord(candidate.resources) ||
		!Array.isArray(candidate.missing)
	) {
		return null;
	}

	const resources: Record<string, PortableClipboardResource> = {};
	const missing = candidate.missing.filter(
		(path): path is string => typeof path === 'string'
	);
	for (const [path, resource] of Object.entries(candidate.resources)) {
		if (
			isRecord(resource) &&
			typeof resource.contentType === 'string' &&
			resource.contentType.startsWith('image/') &&
			typeof resource.base64 === 'string'
		) {
			resources[path] = {
				contentType: resource.contentType,
				base64: resource.base64,
			};
		} else {
			missing.push(path);
		}
	}

	return {
		version: PORTABLE_CLIPBOARD_VERSION,
		sourceOrigin: candidate.sourceOrigin,
		sourceFileId: candidate.sourceFileId,
		resources,
		missing: [...new Set(missing)],
	};
}

export function preparePortableClipboardForPaste(
	json: string,
	options: {
		targetFileId?: string;
		reuseSourceMetadata?: boolean;
		replacements?: ReadonlyMap<string, string>;
	}
): string {
	const value = JSON.parse(json) as unknown;
	if (!isRecord(value)) return JSON.stringify(value);
	delete value[PORTABLE_CLIPBOARD_KEY];

	if (!options.reuseSourceMetadata) {
		const replacements = options.replacements ?? new Map<string, string>();
		visitMetadataPaths(
			value,
			(record, key, path) => {
				record[key] = replacements.get(path) ?? '';
			},
			false,
			false
		);
	}
	if (options.targetFileId) value.sourceFileId = options.targetFileId;
	return JSON.stringify(value);
}

export function serializeClipboardJsonWithPlaceholder(
	globalClipboardJSON: string
): string {
	const clipboardData = JSON.parse(globalClipboardJSON) as unknown;
	if (
		!clipboardData ||
		typeof clipboardData !== 'object' ||
		Array.isArray(clipboardData)
	) {
		throw new Error('globalClipboard JSON is not an object.');
	}
	(clipboardData as Record<string, unknown>).uid =
		AUTOMATION_ANYWHERE_UID_PLACEHOLDER;
	return JSON.stringify(clipboardData);
}

export function cleanAutomationAnywhereJson(
	jsonString: string,
	onParseError?: (error: unknown) => void
): string {
	let data: unknown;
	try {
		data = JSON.parse(jsonString);
	} catch (error) {
		onParseError?.(error);
		return jsonString;
	}

	return preparePortableClipboardForPaste(JSON.stringify(data), {});
}
