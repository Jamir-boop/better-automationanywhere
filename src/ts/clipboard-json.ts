export const AUTOMATION_ANYWHERE_UID_PLACEHOLDER = '__BETTER_AA_UID__';

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

export function clearSensitiveFields(obj: unknown): void {
	if (!obj || typeof obj !== 'object') return;
	for (const key in obj) {
		if (!Object.prototype.hasOwnProperty.call(obj, key)) continue;
		const record = obj as Record<string, unknown>;
		if (
			key === 'blob' ||
			key === 'thumbnailMetadataPath' ||
			key === 'screenshotMetadataPath'
		) {
			record[key] = '';
		} else {
			clearSensitiveFields(record[key]);
		}
	}
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

	if (
		!data ||
		typeof data !== 'object' ||
		!Array.isArray((data as { nodes?: unknown }).nodes)
	) {
		return JSON.stringify(data);
	}

	for (const node of (data as { nodes: unknown[] }).nodes) {
		if (
			!node ||
			typeof node !== 'object' ||
			!Array.isArray((node as { attributes?: unknown }).attributes)
		) {
			continue;
		}
		for (const attr of (node as { attributes: unknown[] }).attributes) {
			if (!attr || typeof attr !== 'object') continue;
			const value = (attr as { value?: unknown }).value;
			clearSensitiveFields(value);
		}
	}
	return JSON.stringify(data);
}
