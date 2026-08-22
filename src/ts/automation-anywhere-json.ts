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

export interface NonClosingMessageBoxFinding {
	uid?: string;
	packageName: string;
	commandName: string;
	reason: 'auto-close-disabled' | 'timeout-missing' | 'timeout-not-positive';
}

export type BetterCommentsHtmlByUid = Map<string, string>;

export interface AutomationAnywhereRepositoryReference {
	value: string;
	count: number;
	paths: string[];
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

const MESSAGE_BOX_PLUS_COMMANDS = new Set([
	'showboolean',
	'showdictionary',
	'showlist',
	'shownumber',
	'showrecord',
	'showstring',
	'showtable',
]);

function findAttribute(node: JsonRecord, name: string): JsonRecord | undefined {
	if (!Array.isArray(node.attributes)) return undefined;
	return node.attributes.find(
		(attribute): attribute is JsonRecord =>
			isRecord(attribute) && String(attribute.name).toLowerCase() === name.toLowerCase()
	);
}

function readAttributeValue(attribute: JsonRecord | undefined): JsonRecord | undefined {
	return attribute && isRecord(attribute.value) ? attribute.value : undefined;
}

export function extractBetterCommentsHtmlByUid(
	content: unknown
): BetterCommentsHtmlByUid {
	const htmlByUid = new Map<string, string>();
	if (!isRecord(content) || !Array.isArray(content.nodes)) return htmlByUid;

	for (const node of flattenNodes(content.nodes)) {
		if (
			String(node.packageName).toLowerCase() !== 'bettercomments' ||
			String(node.commandName).toLowerCase() !== 'bettercomments' ||
			typeof node.uid !== 'string'
		) {
			continue;
		}

		const description = readAttributeValue(findAttribute(node, 'aboutDescription'));
		if (!Array.isArray(description?.dictionary)) continue;
		const htmlEntry = description.dictionary.find(
			(entry): entry is JsonRecord =>
				isRecord(entry) && String(entry.key).toLowerCase() === 'html'
		);
		const htmlValue = htmlEntry && isRecord(htmlEntry.value) ? htmlEntry.value : undefined;
		if (typeof htmlValue?.string === 'string' && htmlValue.string.length > 0) {
			htmlByUid.set(node.uid, htmlValue.string);
		}
	}

	return htmlByUid;
}

export function getBetterCommentsHtmlPreview(html: string): string {
	const document = new DOMParser().parseFromString(html, 'text/html');
	document.querySelectorAll('script, style, template').forEach((element) => element.remove());
	const text = (document.documentElement?.textContent ?? '')
		.replace(/\s+/g, ' ')
		.trim();
	if (text.length <= 160) return text;
	return `${text.slice(0, 160).trimEnd()}\u2026`;
}

export function findNonClosingMessageBoxes(content: unknown): NonClosingMessageBoxFinding[] {
	if (!isRecord(content) || !Array.isArray(content.nodes)) return [];
	const findings: NonClosingMessageBoxFinding[] = [];

	function visit(value: unknown): void {
		if (Array.isArray(value)) {
			value.forEach(visit);
			return;
		}
		if (!isRecord(value)) return;

		const packageName = typeof value.packageName === 'string' ? value.packageName : '';
		const commandName = typeof value.commandName === 'string' ? value.commandName : '';
		const normalizedPackage = packageName.toLowerCase();
		const normalizedCommand = commandName.toLowerCase();
		const autoCloseName =
			normalizedPackage === 'messagebox' && normalizedCommand === 'messagebox'
				? 'closeMsgBox'
				: normalizedPackage === 'messageboxplus' &&
					  MESSAGE_BOX_PLUS_COMMANDS.has(normalizedCommand)
					? 'isChecked'
					: null;

		if (autoCloseName) {
			const autoClose = readAttributeValue(findAttribute(value, autoCloseName));
			const timeout = readAttributeValue(findAttribute(value, 'timeOut'));
			let reason: NonClosingMessageBoxFinding['reason'] | null = null;
			if (autoClose?.boolean !== true) {
				reason = 'auto-close-disabled';
			} else if (!timeout) {
				reason = 'timeout-missing';
			} else if (
				String(timeout.type).toUpperCase() === 'NUMBER' &&
				!(Number(timeout.number) > 0)
			) {
				reason = 'timeout-not-positive';
			}

			if (reason) {
				findings.push({
					...(typeof value.uid === 'string' ? { uid: value.uid } : {}),
					packageName,
					commandName,
					reason,
				});
			}
		}

		for (const nested of Object.values(value)) visit(nested);
	}

	visit(content.nodes);
	return findings;
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
