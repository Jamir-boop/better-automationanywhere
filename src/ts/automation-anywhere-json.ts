export interface AutomationAnywherePackageSummary {
	name: string;
	version: string;
}

export interface AutomationAnywhereActionSummary {
	commandName: string;
	count: number;
}

export interface AutomationAnywhereActionsByPackageSummary {
	packageName: string;
	version: string;
	total: number;
	actions: AutomationAnywhereActionSummary[];
}

export interface AutomationAnywhereJsonSummary {
	actionCount: number;
	packages: AutomationAnywherePackageSummary[];
	actionsByPackage: AutomationAnywhereActionsByPackageSummary[];
}

export interface AutomationAnywhereJsonStats {
	actionCount: number;
	variableCount: number;
}

export interface AutomationAnywhereRepositoryReference {
	value: string;
	count: number;
	paths: string[];
}

export interface AutomationAnywhereRepositoryReplaceResult {
	content: unknown;
	replaced: number;
}

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
	return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function readText(value: unknown): string {
	return typeof value === 'string' && value.trim() ? value : 'unknown';
}

function formatJsonPathSegment(key: string): string {
	return /^[A-Za-z_$][\w$]*$/.test(key) ? `.${key}` : `[${JSON.stringify(key)}]`;
}

function getJsonPath(parentPath: string, key: string | number): string {
	return typeof key === 'number'
		? `${parentPath}[${key}]`
		: `${parentPath}${formatJsonPathSegment(key)}`;
}

function isRepositoryReference(value: string): boolean {
	return value.startsWith('repository:');
}

export function isAutomationAnywhereJson(value: unknown): value is JsonRecord & {
	nodes: unknown[];
	packages: unknown[];
} {
	return Boolean(
		isRecord(value) &&
			Array.isArray(value.nodes) &&
			Array.isArray(value.packages)
	);
}

export function flattenNodes(nodes: unknown): JsonRecord[] {
	const result: JsonRecord[] = [];

	function visit(node: unknown): void {
		if (!isRecord(node)) return;
		result.push(node);

		if (Array.isArray(node.children)) {
			node.children.forEach(visit);
		}
	}

	if (Array.isArray(nodes)) {
		nodes.forEach(visit);
	}

	return result;
}

export function getAutomationAnywhereJsonStats(value: unknown): AutomationAnywhereJsonStats {
	if (!isRecord(value)) return { actionCount: 0, variableCount: 0 };
	return {
		actionCount: Array.isArray(value.nodes) ? flattenNodes(value.nodes).length : 0,
		variableCount: Array.isArray(value.variables) ? value.variables.length : 0,
	};
}

export function extractAutomationAnywhereRepositoryReferences(
	content: unknown
): AutomationAnywhereRepositoryReference[] {
	const referencesByValue = new Map<string, AutomationAnywhereRepositoryReference>();

	function add(value: string, path: string): void {
		const existing = referencesByValue.get(value);
		if (existing) {
			existing.count += 1;
			existing.paths.push(path);
		} else {
			referencesByValue.set(value, { value, count: 1, paths: [path] });
		}
	}

	function visit(value: unknown, path: string): void {
		if (typeof value === 'string') {
			if (isRepositoryReference(value)) add(value, path);
			return;
		}

		if (Array.isArray(value)) {
			value.forEach((item, index) => visit(item, getJsonPath(path, index)));
			return;
		}

		if (!isRecord(value)) return;
		for (const [key, item] of Object.entries(value)) {
			visit(item, getJsonPath(path, key));
		}
	}

	visit(content, '$');
	return [...referencesByValue.values()].sort((left, right) =>
		left.value.localeCompare(right.value, undefined, { sensitivity: 'base' })
	);
}

export function replaceAutomationAnywhereRepositoryReferences(
	content: unknown,
	from: string,
	to: string
): AutomationAnywhereRepositoryReplaceResult {
	let replaced = 0;

	function replace(value: unknown): unknown {
		if (typeof value === 'string') {
			if (value === from) {
				replaced += 1;
				return to;
			}
			return value;
		}

		if (Array.isArray(value)) return value.map(replace);

		if (!isRecord(value)) return value;
		return Object.fromEntries(
			Object.entries(value).map(([key, item]) => [key, replace(item)])
		);
	}

	return { content: replace(content), replaced };
}

export function summarizeAutomationAnywhereJson(
	value: JsonRecord & { nodes: unknown[]; packages: unknown[] }
): AutomationAnywhereJsonSummary {
	const nodes = flattenNodes(value.nodes);
	const packages: AutomationAnywherePackageSummary[] = [];
	const packageKeys = new Set<string>();
	const packageVersionByName = new Map<string, string>();

	for (const pkg of value.packages) {
		const record = isRecord(pkg) ? pkg : {};
		const name = readText(record.name);
		const version = readText(record.version);
		const key = `${name}\u0000${version}`;

		if (!packageKeys.has(key)) {
			packageKeys.add(key);
			packages.push({ name, version });
		}

		if (!packageVersionByName.has(name)) {
			packageVersionByName.set(name, version);
		}
	}

	const actionsByPackage = new Map<
		string,
		{
			packageName: string;
			version: string;
			total: number;
			actions: Map<string, number>;
		}
	>();

	for (const node of nodes) {
		const packageName = readText(node.packageName);
		const commandName = readText(node.commandName);
		const version = packageVersionByName.get(packageName) || 'unknown';
		const key = `${packageName}\u0000${version}`;

		if (!actionsByPackage.has(key)) {
			actionsByPackage.set(key, {
				packageName,
				version,
				total: 0,
				actions: new Map<string, number>(),
			});
		}

		const entry = actionsByPackage.get(key)!;
		entry.total += 1;
		entry.actions.set(commandName, (entry.actions.get(commandName) || 0) + 1);
	}

	return {
		actionCount: nodes.length,
		packages,
		actionsByPackage: [...actionsByPackage.values()].map((entry) => ({
			packageName: entry.packageName,
			version: entry.version,
			total: entry.total,
			actions: [...entry.actions.entries()].map(([commandName, count]) => ({
				commandName,
				count,
			})),
		})),
	};
}
