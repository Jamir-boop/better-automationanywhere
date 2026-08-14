export type ToolJobStatus =
	| 'running'
	| 'stopping'
	| 'completed'
	| 'warning'
	| 'failed'
	| 'stopped'
	| 'interrupted';

export interface ToolJobLine {
	message: string;
	severity: 'info' | 'warn' | 'error';
}

export interface ToolJobRecord {
	id: string;
	title: string;
	controlRoom: string;
	pageTitle: string;
	tabId: number;
	status: ToolJobStatus;
	total: number;
	completed: number;
	startedAt: number;
	finishedAt?: number;
	summary: string;
	lines: ToolJobLine[];
	unread: boolean;
	stopRequested: boolean;
}

export const TOOL_JOB_HISTORY_LIMIT = 10;

export function createToolJob(
	id: string,
	title: string,
	total: number,
	target: { controlRoom: string; pageTitle: string; tabId: number },
	startedAt = Date.now()
): ToolJobRecord {
	return {
		id,
		title,
		controlRoom: target.controlRoom,
		pageTitle: target.pageTitle,
		tabId: target.tabId,
		status: 'running',
		total,
		completed: 0,
		startedAt,
		summary: '',
		lines: [],
		unread: false,
		stopRequested: false,
	};
}

export function prependToolJob(
	history: readonly ToolJobRecord[],
	job: ToolJobRecord
): ToolJobRecord[] {
	return [job, ...history.filter((item) => item.id !== job.id)].slice(
		0,
		TOOL_JOB_HISTORY_LIMIT
	);
}

export function recoverInterruptedToolJobs(
	history: readonly ToolJobRecord[],
	now = Date.now()
): ToolJobRecord[] {
	return history.map((job) =>
		job.status === 'running' || job.status === 'stopping'
			? {
					...job,
					status: 'interrupted',
					finishedAt: now,
					summary: 'The side panel closed before this job finished.',
					unread: true,
			  }
			: job
	);
}

export function requestToolJobStop(job: ToolJobRecord): ToolJobRecord {
	return job.status === 'running'
		? { ...job, status: 'stopping', stopRequested: true }
		: job;
}

export function completeToolJob(
	job: ToolJobRecord,
	status: Extract<ToolJobStatus, 'completed' | 'warning' | 'failed' | 'stopped'>,
	summary: string,
	now = Date.now()
): ToolJobRecord {
	return { ...job, status, summary, finishedAt: now, unread: true };
}

export function getUnreadToolJobCount(history: readonly ToolJobRecord[]): number {
	return history.filter((job) => job.unread).length;
}

export function clearToolJobUnread(history: readonly ToolJobRecord[]): ToolJobRecord[] {
	return history.map((job) => (job.unread ? { ...job, unread: false } : job));
}

export function clearCompletedToolJobs(history: readonly ToolJobRecord[]): ToolJobRecord[] {
	return history.filter((job) => job.status === 'running' || job.status === 'stopping');
}
