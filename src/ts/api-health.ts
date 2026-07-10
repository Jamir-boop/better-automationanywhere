import type {
	AutomationAnywhereApi,
	AutomationAnywhereApiProbeResult,
	AutomationAnywherePageContext,
} from './automation-anywhere-api';

export type ApiHealthStatus = 'pass' | 'fail' | 'warn' | 'skip';

export interface ApiHealthCheck {
	id: string;
	label: string;
	feature: string;
	method: 'GET' | 'POST';
	path: string;
}

export interface ApiHealthResult extends ApiHealthCheck {
	status: ApiHealthStatus;
	reason: string;
	httpStatus: number | null;
}

export const API_HEALTH_CHECKS: ApiHealthCheck[] = [
	{
		id: 'control-room-version',
		label: 'Control Room version',
		feature: 'Compatibility check',
		method: 'GET',
		path: '/v2/settings/version/details',
	},
	{
		id: 'packages-list',
		label: 'Packages list',
		feature: 'Update/Download Packages',
		method: 'POST',
		path: '/v2/packages/package/list',
	},
	{
		id: 'folder-list',
		label: 'Folder contents list',
		feature: 'Copy Files / Export Bots/Files / Import Taskbot',
		method: 'POST',
		path: '/v2/repository/folders/{folderId}/list',
	},
	{
		id: 'bot-content',
		label: 'Bot content read',
		feature: 'Variable metadata / Taskbot JSON / Export',
		method: 'GET',
		path: '/v2/repository/files/{fileId}/content',
	},
	{
		id: 'create-file-probe',
		label: 'Create file endpoint',
		feature: 'Import Taskbot',
		method: 'POST',
		path: '/v2/repository/files',
	},
];

interface ApiHealthOutcome {
	status: ApiHealthStatus;
	reason: string;
	httpStatus: number | null;
}

export function classifyReadProbe(probe: AutomationAnywhereApiProbeResult): ApiHealthOutcome {
	const httpStatus = probe.status;
	if (probe.ok) return { status: 'pass', reason: 'Endpoint responded.', httpStatus };
	if (httpStatus === 401 || httpStatus === 403) {
		return { status: 'warn', reason: 'Authentication or permission issue.', httpStatus };
	}
	if (httpStatus === 404 || httpStatus === 405) {
		return { status: 'fail', reason: 'Endpoint missing.', httpStatus };
	}
	return {
		status: 'fail',
		reason: probe.error || 'Request failed.',
		httpStatus,
	};
}

// Empty-body POST never creates anything; a 400-class response proves the
// endpoint still exists without touching Control Room data.
export function classifyCreateFileProbe(
	probe: AutomationAnywhereApiProbeResult
): ApiHealthOutcome {
	const httpStatus = probe.status;
	if (probe.ok) {
		return { status: 'warn', reason: 'Unexpected success for empty body.', httpStatus };
	}
	if (httpStatus === 400 || httpStatus === 415 || httpStatus === 422) {
		return {
			status: 'pass',
			reason: 'Endpoint alive; empty body rejected as expected.',
			httpStatus,
		};
	}
	if (httpStatus === 401 || httpStatus === 403) {
		return { status: 'warn', reason: 'Authentication or permission issue.', httpStatus };
	}
	if (httpStatus === 404 || httpStatus === 405) {
		return { status: 'fail', reason: 'Create endpoint missing.', httpStatus };
	}
	return {
		status: 'warn',
		reason: probe.error || `Unexpected status ${httpStatus ?? 'unknown'}.`,
		httpStatus,
	};
}

function skipped(check: ApiHealthCheck, reason: string): ApiHealthResult {
	return { ...check, status: 'skip', reason, httpStatus: null };
}

export function skipAllApiHealthChecks(reason: string): ApiHealthResult[] {
	return API_HEALTH_CHECKS.map((check) => skipped(check, reason));
}

export async function runApiHealthChecks(
	api: AutomationAnywhereApi,
	context: AutomationAnywherePageContext
): Promise<ApiHealthResult[]> {
	const results: ApiHealthResult[] = [];
	for (const check of API_HEALTH_CHECKS) {
		if (check.id === 'folder-list' && !context.folderId) {
			results.push(skipped(check, 'Open a folder page to probe.'));
			continue;
		}
		if (check.id === 'bot-content' && !context.fileId) {
			results.push(skipped(check, 'Open a taskbot to probe.'));
			continue;
		}

		const path = check.path
			.replace('{folderId}', context.folderId ?? '')
			.replace('{fileId}', context.fileId ?? '');
		const body =
			check.id === 'packages-list' || check.id === 'folder-list'
				? { page: { offset: 0, length: 1 } }
				: check.id === 'create-file-probe'
					? {}
					: undefined;

		const probe = await api.probe(path, { method: check.method, body });
		const outcome =
			check.id === 'create-file-probe'
				? classifyCreateFileProbe(probe)
				: classifyReadProbe(probe);
		results.push({ ...check, ...outcome });
	}
	return results;
}
