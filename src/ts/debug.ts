import { storage } from '#imports';
import { getDebugEnabled } from './settings';

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

interface DebugOptions {
	feedback?: boolean;
}

interface FeedbackOptions {
	keepDetails?: boolean;
}

const FEEDBACK_LIMIT = 25;
const SENSITIVE_KEY_RE = /blob|clipboard|dataurl|json|payload|password|secret|token/i;

export const feedbackHistory =
	storage.defineItem<DebugEvent[]>('local:debugFeedbackHistory');

function eventId(): string {
	if (crypto.randomUUID) return crypto.randomUUID();
	return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function safeSource(source: string): string {
	return source.trim() || 'unknown';
}

function sanitizeValue(
	key: string,
	value: unknown,
	debugEnabled: boolean,
	keepDetails: boolean
): unknown {
	if (SENSITIVE_KEY_RE.test(key)) return '[redacted]';
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

function sanitizeDetails(
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

async function isDebugEnabled(): Promise<boolean> {
	try {
		return await getDebugEnabled();
	} catch {
		return false;
	}
}

function writeConsole(
	level: DebugLevel,
	timestamp: string,
	source: string,
	message: string,
	details?: Record<string, unknown>
): void {
	const prefix = `[${timestamp}] [${level.toUpperCase()}] [${source}] ${message}`;
	if (details && Object.keys(details).length) {
		console[level](prefix, details);
		return;
	}
	console[level](prefix);
}

export async function getFeedbackHistory(): Promise<DebugEvent[]> {
	return (await feedbackHistory.getValue()) ?? [];
}

export async function clearFeedback(): Promise<void> {
	await feedbackHistory.setValue([]);
}

export async function addFeedback(
	level: FeedbackSeverity,
	source: string,
	message: string,
	details?: Record<string, unknown>,
	options: FeedbackOptions = {}
): Promise<void> {
	const debugEnabled = await isDebugEnabled();
	const keepDetails = Boolean(options.keepDetails);
	const event: DebugEvent = {
		id: eventId(),
		timestamp: new Date().toISOString(),
		level,
		source: safeSource(source),
		message,
		...((debugEnabled || keepDetails) && details
			? { details: sanitizeDetails(details, debugEnabled, keepDetails) }
			: {}),
	};
	const current = await getFeedbackHistory();
	const previous = current[0];
	if (
		previous &&
		previous.level === event.level &&
		previous.source === event.source &&
		previous.message === event.message &&
		Date.parse(event.timestamp) - Date.parse(previous.timestamp) < 2000
	) {
		return;
	}
	await feedbackHistory.setValue([event, ...current].slice(0, FEEDBACK_LIMIT));
}

export async function debugLog(
	level: DebugLevel,
	source: string,
	message: string,
	details?: Record<string, unknown>,
	options: DebugOptions = {}
): Promise<void> {
	const debugEnabled = await isDebugEnabled();
	if (level === 'debug' && !debugEnabled) return;

	const timestamp = new Date().toISOString();
	const safeDetails = details ? sanitizeDetails(details, debugEnabled) : undefined;
	if (debugEnabled || level === 'warn' || level === 'error') {
		writeConsole(
			level,
			timestamp,
			safeSource(source),
			message,
			debugEnabled ? safeDetails : undefined
		);
	}

	if (options.feedback && level !== 'debug') {
		await addFeedback(level, source, message, details);
	}
}

export function debugDebug(
	source: string,
	message: string,
	details?: Record<string, unknown>,
	options?: DebugOptions
): Promise<void> {
	return debugLog('debug', source, message, details, options);
}

export function debugInfo(
	source: string,
	message: string,
	details?: Record<string, unknown>,
	options?: DebugOptions
): Promise<void> {
	return debugLog('info', source, message, details, options);
}

export function debugWarn(
	source: string,
	message: string,
	details?: Record<string, unknown>,
	options?: DebugOptions
): Promise<void> {
	return debugLog('warn', source, message, details, options);
}

export function debugError(
	source: string,
	message: string,
	details?: Record<string, unknown>,
	options?: DebugOptions
): Promise<void> {
	return debugLog('error', source, message, details, options);
}
