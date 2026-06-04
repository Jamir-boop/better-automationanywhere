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

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
	return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function readText(value: unknown): string {
	return typeof value === 'string' && value.trim() ? value : 'unknown';
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
