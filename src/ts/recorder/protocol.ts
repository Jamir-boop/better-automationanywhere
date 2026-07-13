export type RecorderContentError = {
	__error: { code: string; message: string };
};

export const RECORDER_VERBS = [
	'click',
	'debuggerClick',
	'doubleClick',
	'rightClick',
	'setText',
	'appendText',
	'getText',
	'getProperty',
	'getValue',
	'check',
	'uncheck',
	'toggle',
	'select',
	'selectItemByText',
	'selectItemByIndex',
	'getStatus',
	'setFocus',
	'hover',
	'exists',
] as const;

export type RecorderVerb = (typeof RECORDER_VERBS)[number];

export function isRecorderVerb(value: unknown): value is RecorderVerb {
	return RECORDER_VERBS.includes(value as RecorderVerb);
}

export function unwrapContentResponse<T>(value: T | RecorderContentError): T {
	if (!value || typeof value !== 'object' || !('__error' in value)) return value as T;
	const wrapped = value as RecorderContentError;
	throw Object.assign(new Error(wrapped.__error.message), {
		code: wrapped.__error.code,
	});
}

export function isMissingRecorderReceiver(cause: unknown): boolean {
	const message = cause instanceof Error ? cause.message : String(cause);
	return message.includes('Receiving end does not exist')
		|| message.includes('Could not establish connection');
}

export type RecorderTabCandidate = {
	id?: number;
	url?: string;
	active?: boolean;
	lastAccessed?: number;
};

export function normalizeRecorderTabUrl(value: string): string {
	try {
		const url = new URL(value);
		url.hash = '';
		return url.href;
	} catch {
		return value.split('#', 1)[0];
	}
}

/** Exact page match, ignoring only the fragment. Prefer the active/newest matching tab. */
export function chooseRecorderTab(tabs: RecorderTabCandidate[], targetUrl: string): RecorderTabCandidate | undefined {
	const normalized = normalizeRecorderTabUrl(targetUrl);
	return tabs
		.filter((tab) => tab.id !== undefined && tab.url && normalizeRecorderTabUrl(tab.url) === normalized)
		.sort((left, right) => Number(Boolean(right.active)) - Number(Boolean(left.active))
			|| (right.lastAccessed ?? 0) - (left.lastAccessed ?? 0))[0];
}
