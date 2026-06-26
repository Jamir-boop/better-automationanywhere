import type { AutomationAnywherePageContext } from './automation-anywhere-api';
import type { ToolCapabilities } from './messages';

export type AutomationAnywhereToolId =
	| 'universal-clipboard'
	| 'copy-files'
	| 'update-packages'
	| 'export-bots'
	| 'download-packages'
	| 'package-usage'
	| 'taskbot-json';

export type AutomationAnywherePackageUsageStatusFilter = 'ENABLED' | 'DISABLED';

export function getAutomationAnywherePackageUsageStatusFilter(
	status: unknown
): AutomationAnywherePackageUsageStatusFilter {
	return String(status ?? '').trim().toLowerCase() === 'disabled'
		? 'DISABLED'
		: 'ENABLED';
}

export function hasMoreAutomationAnywherePackageUsage(
	loadedCount: number,
	pageLength: number,
	total: number,
	requestedLength: number
): boolean {
	return pageLength > 0 && (total > 0 ? loadedCount < total : pageLength >= requestedLength);
}

export function getAvailableAutomationAnywhereTools(
	context: AutomationAnywherePageContext,
	capabilities: ToolCapabilities = { universalClipboard: false }
): AutomationAnywhereToolId[] {
	const tools: AutomationAnywhereToolId[] = [];
	if (capabilities.universalClipboard) tools.push('universal-clipboard');
	if (context.pageType === 'private-folder') {
		tools.push('copy-files', 'update-packages', 'export-bots');
		return tools;
	}
	if (context.pageType === 'public-folder') {
		tools.push('copy-files', 'update-packages', 'export-bots');
		return tools;
	}
	if (context.pageType === 'private-taskbot') {
		tools.push('taskbot-json', 'update-packages', 'export-bots');
		return tools;
	}
	if (context.pageType === 'public-taskbot') {
		tools.push('taskbot-json', 'export-bots');
		return tools;
	}
	if (context.pageType === 'packages') {
		tools.push('download-packages', 'package-usage');
		return tools;
	}
	return tools;
}

export function getDefaultTaskbotTool(
	context: AutomationAnywherePageContext,
	capabilities: ToolCapabilities = { universalClipboard: false }
): AutomationAnywhereToolId | null {
	if (context.pageType !== 'private-taskbot' && context.pageType !== 'public-taskbot') {
		return null;
	}
	return capabilities.universalClipboard ? 'universal-clipboard' : 'taskbot-json';
}
