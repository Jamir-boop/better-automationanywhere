import { extractAutomationAnywherePackages } from '@/src/ts/automation-anywhere-api';
import {
	flattenNodes,
	getAutomationAnywhereJsonStats,
} from '@/src/ts/automation-anywhere-json';
import { t } from '@/src/ts/i18n';

const JSON_INFO_TAB_IDS = ['packages', 'actions', 'variables'] as const;
type JsonInfoTabId = (typeof JSON_INFO_TAB_IDS)[number];

interface JsonInfoItem {
	label: string;
	count: number;
}

interface JsonInfoTab {
	id: JsonInfoTabId;
	label: string;
	count: number;
	items: JsonInfoItem[];
	emptyText: string;
}

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
	return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function isJsonInfoTabId(value: string | undefined): value is JsonInfoTabId {
	return JSON_INFO_TAB_IDS.includes(value as JsonInfoTabId);
}

function readLabelValue(value: unknown): string {
	if (typeof value === 'string') return value.trim();
	if (typeof value === 'number' && Number.isFinite(value)) return String(value);
	if (typeof value === 'boolean') return String(value);
	return '';
}

function readItemLabel(item: unknown, keys: string[]): string {
	if (!isRecord(item)) return readLabelValue(item) || 'unknown';
	for (const key of keys) {
		const value = readLabelValue(item[key]);
		if (value) return value;
	}
	return 'unknown';
}

function countLabels(labels: string[]): JsonInfoItem[] {
	const byLabel = new Map<string, JsonInfoItem>();
	for (const label of labels) {
		const normalizedLabel = label || 'unknown';
		const existing = byLabel.get(normalizedLabel);
		if (existing) {
			existing.count += 1;
		} else {
			byLabel.set(normalizedLabel, { label: normalizedLabel, count: 1 });
		}
	}
	return [...byLabel.values()].sort((left, right) =>
		left.label.localeCompare(right.label, undefined, { sensitivity: 'base' })
	);
}

function getVariables(content: unknown): unknown[] {
	return isRecord(content) && Array.isArray(content.variables) ? content.variables : [];
}

function getActionItems(content: unknown): JsonInfoItem[] {
	const nodes = flattenNodes(isRecord(content) ? content.nodes : undefined);
	return countLabels(
		nodes.map((node) =>
			readItemLabel(node, ['commandName', 'name', 'displayName', 'label', 'id'])
		)
	);
}

function getVariableItems(content: unknown): JsonInfoItem[] {
	return countLabels(
		getVariables(content).map((variable) =>
			readItemLabel(variable, ['name', 'variableName', 'displayName', 'key', 'id'])
		)
	);
}

function getPackageItems(content: unknown): JsonInfoItem[] {
	return countLabels(
		extractAutomationAnywherePackages(content).map(
			(pkg) => `${pkg.name} ${pkg.version}`
		)
	);
}

function formatInfoItem(item: JsonInfoItem): string {
	return item.count > 1 ? `${item.label} x${item.count}` : item.label;
}

function getJsonInfoTabs(content: unknown): JsonInfoTab[] {
	const stats = getAutomationAnywhereJsonStats(content);
	const packageCount = extractAutomationAnywherePackages(content).length;
	return [
		{
			id: 'packages',
			label: t('Packages'),
			count: packageCount,
			items: getPackageItems(content),
			emptyText: t('No packages found.'),
		},
		{
			id: 'actions',
			label: t('Actions'),
			count: stats.actionCount,
			items: getActionItems(content),
			emptyText: t('No actions found.'),
		},
		{
			id: 'variables',
			label: t('Variables'),
			count: stats.variableCount,
			items: getVariableItems(content),
			emptyText: t('No variables found.'),
		},
	];
}

export function clearAutomationAnywhereJsonDetails(container: HTMLElement): void {
	delete container.dataset.jsonInfoTab;
	container.replaceChildren();
	container.hidden = true;
}

export function renderAutomationAnywhereJsonDetails(
	container: HTMLElement,
	content: unknown
): void {
	const tabs = getJsonInfoTabs(content);
	const requestedTabId = container.dataset.jsonInfoTab;
	const activeTabId: JsonInfoTabId = isJsonInfoTabId(requestedTabId)
		? requestedTabId
		: 'packages';

	const tabList = document.createElement('div');
	tabList.className = 'json-info-tabs';
	tabList.setAttribute('role', 'tablist');
	tabList.setAttribute('aria-label', t('JSON details'));

	const panel = document.createElement('div');
	panel.className = 'json-info-list';
	panel.setAttribute('role', 'tabpanel');

	const tabButtons = new Map<JsonInfoTabId, HTMLButtonElement>();

	function showTab(tabId: JsonInfoTabId): void {
		const activeTab = tabs.find((tab) => tab.id === tabId) ?? tabs[0];
		container.dataset.jsonInfoTab = activeTab.id;
		for (const tab of tabs) {
			const button = tabButtons.get(tab.id);
			if (!button) continue;
			const isActive = tab.id === activeTab.id;
			button.classList.toggle('is-active', isActive);
			button.setAttribute('aria-selected', String(isActive));
			button.tabIndex = isActive ? 0 : -1;
		}
		panel.textContent = activeTab.items.length
			? activeTab.items.map(formatInfoItem).join('\n')
			: activeTab.emptyText;
	}

	for (const tab of tabs) {
		const button = document.createElement('button');
		button.type = 'button';
		button.className = 'json-info-tab';
		button.setAttribute('role', 'tab');
		button.dataset.jsonInfoTab = tab.id;

		const label = document.createElement('span');
		label.className = 'json-info-tab-label';
		label.textContent = tab.label;

		const count = document.createElement('strong');
		count.className = 'json-info-tab-count';
		count.textContent = String(tab.count);

		button.append(label, count);
		button.addEventListener('click', () => showTab(tab.id));
		tabButtons.set(tab.id, button);
		tabList.appendChild(button);
	}

	container.replaceChildren(tabList, panel);
	showTab(activeTabId);
	container.hidden = false;
}

function getSafeJsonFileName(fileName: string): string {
	const sanitized = fileName
		.trim()
		.replace(/[<>:"/\\|?*\u0000-\u001F]+/g, '-')
		.replace(/^\.+$/, '')
		.replace(/\.+$/g, '');
	const baseName = sanitized || 'export';
	return baseName.toLowerCase().endsWith('.json') ? baseName : `${baseName}.json`;
}

export function getJsonDownloadText(json: string): string {
	return JSON.stringify(JSON.parse(json), null, 2) ?? 'null';
}

export function downloadJsonTextFile(json: string, fileName: string): void {
	const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
	const url = URL.createObjectURL(blob);
	const anchor = document.createElement('a');
	anchor.href = url;
	anchor.download = getSafeJsonFileName(fileName);
	anchor.style.display = 'none';
	document.body.appendChild(anchor);
	anchor.click();
	anchor.remove();
	setTimeout(() => URL.revokeObjectURL(url), 1000);
}
