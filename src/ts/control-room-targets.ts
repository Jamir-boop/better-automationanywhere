import type { AutomationAnywherePageContext } from './automation-anywhere-api';

export interface ControlRoomTabCandidate {
	tabId: number;
	windowId: number;
	url: string;
	title?: string;
	authenticated: boolean;
	context: AutomationAnywherePageContext;
}

export interface ControlRoomPageTarget {
	tabId: number;
	windowId: number;
	url: string;
	title: string;
	context: AutomationAnywherePageContext;
	eligible: boolean;
}

export interface ControlRoomTargetGroup {
	origin: string;
	hostname: string;
	pages: ControlRoomPageTarget[];
}

export interface SelectedControlRoomTarget {
	origin: string;
	tabId: number;
	url: string;
	stale: boolean;
	disconnected: boolean;
}

const AUTOMATION_ANYWHERE_CLOUD_HOST_SUFFIX = '.my.automationanywhere.digital';

export function formatControlRoomHostname(hostname: string): string {
	return hostname.endsWith(AUTOMATION_ANYWHERE_CLOUD_HOST_SUFFIX)
		? hostname.slice(0, -AUTOMATION_ANYWHERE_CLOUD_HOST_SUFFIX.length)
		: hostname;
}

export function formatControlRoomPageTitle(title: string): string {
	return title.replace(/\s*\|\s*Edit Task Bot(?:\s*\|.*)?$/i, '').trim() || title;
}

export function getSingleControlRoomOrigin(
	groups: readonly ControlRoomTargetGroup[]
): string | null {
	return groups.length === 1 ? groups[0].origin : null;
}

export function isEligibleControlRoomPage(
	context: AutomationAnywherePageContext
): boolean {
	return context.pageType !== 'unsupported';
}

export function groupAuthenticatedControlRoomTabs(
	tabs: readonly ControlRoomTabCandidate[]
): ControlRoomTargetGroup[] {
	const groups = new Map<string, ControlRoomTargetGroup>();
	for (const tab of tabs) {
		if (!tab.authenticated) continue;
		const context = tab.context;
		if (!context.baseUrl || !context.hostname) continue;
		let group = groups.get(context.baseUrl);
		if (!group) {
			group = { origin: context.baseUrl, hostname: context.hostname, pages: [] };
			groups.set(context.baseUrl, group);
		}
		group.pages.push({
			tabId: tab.tabId,
			windowId: tab.windowId,
			url: tab.url,
			title: tab.title?.trim() || context.pageType,
			context,
			eligible: isEligibleControlRoomPage(context),
		});
	}
	return [...groups.values()]
		.map((group) => ({
			...group,
			pages: [...group.pages].sort((left, right) =>
				Number(right.eligible) - Number(left.eligible) || left.title.localeCompare(right.title)
			),
		}))
		.sort((left, right) => left.hostname.localeCompare(right.hostname));
}

export function getFirstEligibleTarget(
	groups: readonly ControlRoomTargetGroup[]
): SelectedControlRoomTarget | null {
	return groups.length === 1 ? getPreferredRoomTarget(groups[0]) : null;
}

export function getEligibleTargetForTab(
	groups: readonly ControlRoomTargetGroup[],
	tabId: number | undefined
): SelectedControlRoomTarget | null {
	if (tabId === undefined) return null;
	for (const group of groups) {
		const page = group.pages.find((candidate) => candidate.eligible && candidate.tabId === tabId);
		if (page) return createSelectedTarget(group, page);
	}
	return null;
}

export function getPreferredRoomTarget(
	group: ControlRoomTargetGroup | undefined,
	currentTabId?: number
): SelectedControlRoomTarget | null {
	if (!group) return null;
	const page = group.pages.find(
		(candidate) => candidate.eligible && candidate.tabId === currentTabId
	) ?? group.pages.find((candidate) => candidate.eligible);
	return page ? createSelectedTarget(group, page) : null;
}

export function getOnlyRoomCurrentEligibleTarget(
	groups: readonly ControlRoomTargetGroup[],
	currentTabId: number | undefined
): SelectedControlRoomTarget | null {
	return groups.length === 1 ? getEligibleTargetForTab(groups, currentTabId) : null;
}

function createSelectedTarget(
	group: ControlRoomTargetGroup,
	page: ControlRoomPageTarget
): SelectedControlRoomTarget {
	return {
		origin: group.origin,
		tabId: page.tabId,
		url: page.url,
		stale: false,
		disconnected: false,
	};
}

export function markSelectedTargetRouteChanged(
	target: SelectedControlRoomTarget,
	tabId: number,
	url: string
): SelectedControlRoomTarget {
	if (target.tabId !== tabId || target.url === url) return target;
	return { ...target, stale: true };
}

export function markSelectedTargetDisconnected(
	target: SelectedControlRoomTarget,
	tabId: number
): SelectedControlRoomTarget {
	return target.tabId === tabId ? { ...target, disconnected: true } : target;
}

export function canUseSelectedTarget(target: SelectedControlRoomTarget | null): boolean {
	return Boolean(target && !target.stale && !target.disconnected);
}
