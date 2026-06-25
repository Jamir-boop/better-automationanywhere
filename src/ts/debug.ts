import { storage } from '#imports';
import { getDebugEnabled } from './settings';
import {
	appendFeedbackEvent,
	createFeedbackEvent,
	safeSource,
	sanitizeDetails,
	shouldStoreFeedback,
	type DebugEvent,
	type DebugLevel,
	type FeedbackOptions,
	type FeedbackSeverity,
} from './debug-utils';

export type { DebugEvent, DebugLevel, FeedbackOptions, FeedbackSeverity };

interface DebugOptions extends FeedbackOptions {
	feedback?: boolean;
}

export const feedbackHistory =
	storage.defineItem<DebugEvent[]>('local:debugFeedbackHistory');

function eventId(): string {
	if (crypto.randomUUID) return crypto.randomUUID();
	return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
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
	if (!shouldStoreFeedback(debugEnabled, options)) return;
	const event = createFeedbackEvent({
		id: eventId(),
		timestamp: new Date().toISOString(),
		level,
		source,
		message,
		details,
		debugEnabled,
		keepDetails: options.keepDetails,
	});
	await feedbackHistory.setValue(appendFeedbackEvent(await getFeedbackHistory(), event));
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
		await addFeedback(level, source, message, details, {
			keepDetails: options.keepDetails,
			debugOnly: options.debugOnly,
		});
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
