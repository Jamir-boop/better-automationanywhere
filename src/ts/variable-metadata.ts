type JsonRecord = Record<string, unknown>;

export interface VariableMetadata {
	name: string;
	label: string;
	title: string;
	unused: boolean;
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
		const isDictionary = type.includes('dictionary');
		if (isDictionary) {
			const dictValue = value.dictionary ?? value.value;
			if (isEmptyArray(dictValue)) return null;
			return formatJsonValue(dictValue);
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

// Mirrors Control Room's expression tokenizer: name = WORD_PATTERN
// [^\[\]{}$.:"]+ ending at one of $ [ { . : — covers $var$, $list[0]$,
// $dict{key}$, $var.Number:toString$, and the inner var of $list[$i$]$.
// ponytail: regex heuristic (CR uses a full parser); extra junk matches
// are harmless since only declared names are compared.
const VARIABLE_REFERENCE_RE = /\$([^\[\]{}$.:"]+)(?=[$\[{.:])/g;

export function collectUsedVariableNames(content: unknown): Set<string> {
	const used = new Set<string>();
	const addName = (value: unknown): void => {
		if (typeof value !== 'string') return;
		const name = collapseWhitespace(value);
		if (name) used.add(name.toLocaleLowerCase());
	};

	const visit = (value: unknown): void => {
		if (typeof value === 'string') {
			for (const match of value.matchAll(VARIABLE_REFERENCE_RE)) {
				addName(match[1]);
			}
			return;
		}
		if (Array.isArray(value)) {
			value.forEach(visit);
			return;
		}
		if (!isRecord(value)) return;
		if (value.objectTypeName === 'VARIABLE' && typeof value.string === 'string') {
			addName(value.string);
		}
		// CR value shapes: {type: 'VARIABLE', variableName} and
		// {type: 'VARIABLE_MAP', variableMapNames: [...]}.
		addName(value.variableName);
		if (Array.isArray(value.variableMapNames)) {
			value.variableMapNames.forEach(addName);
		}
		for (const child of Object.values(value)) visit(child);
	};

	if (!isRecord(content)) return used;
	for (const [key, child] of Object.entries(content)) {
		if (key === 'variables') continue;
		visit(child);
	}
	return used;
}

function createVariableMetadata(
	record: JsonRecord,
	usedNames: Set<string>,
	unusedBadge: string
): VariableMetadata | null {
	const name = readText(record.name);
	if (!name) return null;

	// Control Room parity: output and workItem variables are never unused.
	const unused =
		record.output !== true &&
		!record.workItem &&
		!usedNames.has(name.toLocaleLowerCase());
	const prefix =
		`${record.output === true ? '\u2191' : ''}${record.input === true ? '\u2193' : ''}`;
	const segments = [`${prefix}${name}${unused ? ` ${unusedBadge}` : ''}`];

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
	return { name, label, title: label, unused };
}

export function extractVariableMetadataLookup(
	content: unknown,
	unusedBadge = '(unused)'
): VariableMetadataLookup {
	const lookup = new Map<string, VariableMetadata>();
	const usedNames = collectUsedVariableNames(content);

	for (const variable of getVariables(content)) {
		if (!isRecord(variable)) continue;
		const metadata = createVariableMetadata(variable, usedNames, unusedBadge);
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
