type JsonRecord = Record<string, unknown>;

export interface VariableMetadata {
	name: string;
	label: string;
	title: string;
}

export type VariableMetadataLookup = Map<string, VariableMetadata>;

function isRecord(value: unknown): value is JsonRecord {
	return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function collapseWhitespace(value: string): string {
	return value.replace(/\s+/g, ' ').trim();
}

function readText(value: unknown): string | null {
	return typeof value === 'string' ? collapseWhitespace(value) || null : null;
}

function parseJsonText(value: string): unknown {
	try {
		return JSON.parse(value);
	} catch {
		return value;
	}
}

function formatJsonValue(value: unknown): string | null {
	try {
		const json = JSON.stringify(value);
		return json ? collapseWhitespace(json) : null;
	} catch {
		return null;
	}
}

function isEmptyArray(value: unknown): boolean {
	return Array.isArray(value) && value.length === 0;
}

function formatDefaultValue(value: unknown): string | null {
	if (value === null || value === undefined) return null;
	if (typeof value === 'string') return collapseWhitespace(value) || null;
	if (typeof value === 'number' || typeof value === 'boolean') return String(value);
	if (Array.isArray(value)) return formatJsonValue(value);

	if (isRecord(value)) {
		const type = readText(value.type)?.toLocaleLowerCase() ?? '';
		if (type.includes('table') || type.includes('record')) return null;
		const isList = type.includes('list');
		if (isList) {
			const listValue =
				value.list ??
				value.value ??
				(typeof value.string === 'string' ? parseJsonText(value.string) : undefined);
			if (isEmptyArray(listValue)) return null;
			return formatDefaultValue(listValue);
		}
		if (Object.prototype.hasOwnProperty.call(value, 'string')) {
			return formatDefaultValue(value.string);
		}

		const { type: _type, ...withoutType } = value;
		const keys = Object.keys(withoutType);
		if (keys.length === 1) return formatDefaultValue(withoutType[keys[0]]);
		return formatJsonValue(withoutType);
	}

	return null;
}

function getVariables(content: unknown): unknown[] {
	if (!isRecord(content) || !Array.isArray(content.variables)) return [];
	return content.variables;
}

function createVariableMetadata(record: JsonRecord): VariableMetadata | null {
	const name = readText(record.name);
	if (!name) return null;

	const prefix =
		`${record.output === true ? '\u2191' : ''}${record.input === true ? '\u2193' : ''}`;
	const segments = [`${prefix}${name}`];

	const defaultValue = Object.prototype.hasOwnProperty.call(record, 'defaultValue')
		? formatDefaultValue(record.defaultValue)
		: null;
	const description = readText(record.description);
	if (defaultValue) {
		segments.push(defaultValue);
	} else if (description) {
		segments.push(description);
	}

	const label = segments.join(' \u2022 ');
	return { name, label, title: label };
}

export function extractVariableMetadataLookup(content: unknown): VariableMetadataLookup {
	const lookup = new Map<string, VariableMetadata>();

	for (const variable of getVariables(content)) {
		if (!isRecord(variable)) continue;
		const metadata = createVariableMetadata(variable);
		if (metadata) lookup.set(metadata.name.toLocaleLowerCase(), metadata);
	}

	return lookup;
}

export function findVariableMetadata(
	lookup: VariableMetadataLookup,
	rowName: string | null | undefined
): VariableMetadata | null {
	const name = collapseWhitespace(rowName ?? '');
	if (!name) return null;

	return lookup.get(name.toLocaleLowerCase()) ?? null;
}
