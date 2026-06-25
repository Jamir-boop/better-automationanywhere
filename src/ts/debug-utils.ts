export type DebugLevel = 'debug' | 'info' | 'warn' | 'error';
export type FeedbackSeverity = Exclude<DebugLevel, 'debug'>;

export interface DebugEvent {
	id: string;
	timestamp: string;
	level: FeedbackSeverity;
	source: string;
	message: string;
	details?: Record<string, unknown>;
}

export interface FeedbackOptions {
	keepDetails?: boolean;
	debugOnly?: boolean;
}

export const FEEDBACK_LIMIT = 100;

const FEEDBACK_DUPLICATE_WINDOW_MS = 2000;
const SENSITIVE_KEY_PARTS = [
	'auth',
	'authorization',
	'body',
	'blob',
	'clipboard',
	'cookie',
	'dataurl',
	'headers',
	'json',
	'password',
	'payload',
	'secret',
	'session',
	'token',
];
const SAFE_DETAIL_KEYS = new Set(['bodybytes', 'bodykind']);

export function safeSource(source: string): string {
	return source.trim() || 'unknown';
}

function sanitizeValue(
	key: string,
	value: unknown,
	debugEnabled: boolean,
	keepDetails: boolean
): unknown {
	const normalizedKey = key.replace(/[^a-z0-9]/gi, '').toLowerCase();
	if (
		!SAFE_DETAIL_KEYS.has(normalizedKey) &&
		SENSITIVE_KEY_PARTS.some((part) => normalizedKey.includes(part))
	) {
		return '[redacted]';
	}
	if (value instanceof Error) {
		return debugEnabled
			? { name: value.name, message: value.message, stack: value.stack }
			: { name: value.name, message: value.message };
	}
	if (typeof value === 'string') {
		return !keepDetails && value.length > 240
			? `${value.slice(0, 240)}...`
			: value;
	}
	if (typeof value === 'number' || typeof value === 'boolean' || value === null) {
		return value;
	}
	if (Array.isArray(value)) {
		const items = keepDetails ? value : value.slice(0, 12);
		return items.map((item, index) =>
			sanitizeValue(`${key}[${index}]`, item, debugEnabled, keepDetails)
		);
	}
	if (value && typeof value === 'object') {
		return sanitizeDetails(value as Record<string, unknown>, debugEnabled, keepDetails);
	}
	return String(value);
}

export function sanitizeDetails(
	details: Record<string, unknown>,
	debugEnabled: boolean,
	keepDetails = false
): Record<string, unknown> {
	const sanitized: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(details)) {
		sanitized[key] = sanitizeValue(key, value, debugEnabled, keepDetails);
	}
	return sanitized;
}

export function shouldStoreFeedback(
	debugEnabled: boolean,
	options: FeedbackOptions = {}
): boolean {
	return !options.debugOnly || debugEnabled;
}

export function createFeedbackEvent(params: {
	id: string;
	timestamp: string;
	level: FeedbackSeverity;
	source: string;
	message: string;
	details?: Record<string, unknown>;
	debugEnabled: boolean;
	keepDetails?: boolean;
}): DebugEvent {
	const keepDetails = Boolean(params.keepDetails);
	return {
		id: params.id,
		timestamp: params.timestamp,
		level: params.level,
		source: safeSource(params.source),
		message: params.message,
		...((params.debugEnabled || keepDetails) && params.details
			? { details: sanitizeDetails(params.details, params.debugEnabled, keepDetails) }
			: {}),
	};
}

export function appendFeedbackEvent(
	current: DebugEvent[],
	event: DebugEvent,
	limit = FEEDBACK_LIMIT
): DebugEvent[] {
	const previous = current[0];
	if (
		previous &&
		previous.level === event.level &&
		previous.source === event.source &&
		previous.message === event.message &&
		Date.parse(event.timestamp) - Date.parse(previous.timestamp) <
			FEEDBACK_DUPLICATE_WINDOW_MS
	) {
		return current;
	}
	return [event, ...current].slice(0, limit);
}
