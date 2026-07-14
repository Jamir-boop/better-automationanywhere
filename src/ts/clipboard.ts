import * as ui from './ui';
import { debugError, debugInfo, debugWarn } from './debug';
import { t } from './i18n';
import {
	SHARED_COPY_BUTTON_SELECTOR,
	SHARED_PASTE_BUTTON_SELECTOR,
	TASKBOT_ACTIVE_CURSOR_SELECTOR,
	TASK_EDITOR_CAPABILITY_SELECTOR,
	TASKBOT_RENDERED_NODE_SELECTOR,
} from './automation-anywhere-selectors';
import {
	universalClipboard,
	universalClipboardSlot,
} from './universal-clipboard-storage';
import * as utils from './utils';
import {
	AUTOMATION_ANYWHERE_UID_PLACEHOLDER as UID_PLACEHOLDER,
	addPortableClipboardEnvelope,
	collectPortableMetadataPaths,
	cleanAutomationAnywhereJson as cleanClipboardJson,
	getNativeClipboardSourceFileId,
	getPortableClipboardEnvelope,
	isStorageQuotaExceededError,
	partitionClipboardJson,
	preparePortableClipboardForPaste,
	serializeClipboardJsonWithPlaceholder,
	type PortableClipboardEnvelope,
	type PortableClipboardResource,
} from './clipboard-json';
import { getChunkedClipboardPasteEnabled } from './settings';
import {
	AutomationAnywhereApi,
	parseAutomationAnywherePageContext,
	readAutomationAnywhereAuthTokenFromLocalStorage,
} from './automation-anywhere-api';

const GLOBAL_CLIPBOARD_KEY = 'globalClipboard';
const GLOBAL_CLIPBOARD_UID_KEY = 'globalClipboardUid';
const GLOBAL_CLIPBOARD_WATCH_INTERVAL_MS = 500;
const CLIPBOARD_BUTTON_WAIT_MS = 1500;
const CLIPBOARD_COPY_WAIT_MS = 3000;
const CLIPBOARD_POLL_MS = 50;
const CLIPBOARD_PASTE_READY_WAIT_MS = 1500;
const CLIPBOARD_PASTE_BEFORE_CLICK_MS = 2500;
const CLIPBOARD_PASTE_AFTER_CLICK_LOCK_MS = 1500;
const CLIPBOARD_CHUNK_COMPLETION_WAIT_MS = 120_000;
let globalClipboardWatcherStarted = false;
let globalClipboardWatcherOnEditorPage = false;
let lastSeenGlobalClipboard: string | null = null;
let ignoredGlobalClipboardWrite: string | null = null;
let pasteInFlight = false;
let watcherSaveGeneration = 0;

function generateUid(): string {
	if (crypto.randomUUID) return crypto.randomUUID();
	return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function replaceStoredUid(value: string, uid: string): string {
	return value.replaceAll(UID_PLACEHOLDER, uid);
}

function getGlobalClipboardValue(): string | null {
	return localStorage.getItem(GLOBAL_CLIPBOARD_KEY);
}

function isClickableButton(el: Element | null): el is HTMLElement {
	if (!(el instanceof HTMLElement)) return false;
	if (el.closest('[aria-hidden="true"]')) return false;
	if (el.closest<HTMLButtonElement>('button:disabled')) return false;
	if (el instanceof HTMLButtonElement && el.disabled) return false;
	return el.offsetParent !== null;
}

async function waitForSharedClipboardButton(
	selector: string,
	context: string,
	message: string
): Promise<HTMLElement | null> {
	const start = Date.now();
	while (Date.now() - start < CLIPBOARD_BUTTON_WAIT_MS) {
		const el = document.querySelector(selector);
		if (isClickableButton(el)) return el;
		await utils.sleep(CLIPBOARD_POLL_MS);
	}
	void debugWarn('clipboard', message, { selector, context }, { feedback: true });
	return null;
}

function markGlobalClipboardWrite(value: string): void {
	ignoredGlobalClipboardWrite = value;
}

async function waitForPasteClipboardValue(
	cleanedData: string,
	uid: string
): Promise<boolean> {
	const targetUid = `"${uid}"`;
	let consecutive = 0;
	const start = Date.now();
	while (Date.now() - start < CLIPBOARD_PASTE_READY_WAIT_MS) {
		const match =
			localStorage.getItem(GLOBAL_CLIPBOARD_KEY) === cleanedData &&
			localStorage.getItem(GLOBAL_CLIPBOARD_UID_KEY) === targetUid;
		consecutive = match ? consecutive + 1 : 0;
		if (consecutive >= 2) return true;
		await utils.sleep(CLIPBOARD_POLL_MS);
	}
	return false;
}

async function readFreshSharedCopy(context: string): Promise<string | null> {
	const copyButton = await waitForSharedClipboardButton(
		SHARED_COPY_BUTTON_SELECTOR,
		context,
		'Shared copy button not found.'
	);
	if (!copyButton) {
		ui.showNotification(t('Copy failed'), t('Shared copy button not found.'));
		return null;
	}

	const previousClipboardJSON = getGlobalClipboardValue();
	localStorage.removeItem(GLOBAL_CLIPBOARD_KEY);
	copyButton.click();

	const globalClipboardJSON = await utils.waitForClipboardJson(
		CLIPBOARD_COPY_WAIT_MS,
		CLIPBOARD_POLL_MS
	);
	if (!globalClipboardJSON && previousClipboardJSON !== null) {
		markGlobalClipboardWrite(previousClipboardJSON);
		localStorage.setItem(GLOBAL_CLIPBOARD_KEY, previousClipboardJSON);
	}
	if (globalClipboardJSON) markGlobalClipboardWrite(globalClipboardJSON);
	return globalClipboardJSON;
}

function isTaskEditorPage(): boolean {
	const hash = location.hash.toLowerCase();
	if (hash.includes('taskbot') || hash.includes('editor')) return true;
	return Boolean(document.querySelector(TASK_EDITOR_CAPABILITY_SELECTOR));
}

function getBase64Resource(
	dataUrl: string,
	contentType: string
): PortableClipboardResource | null {
	const match = dataUrl.match(/^data:([^;,]*)(?:;[^,]*)*;base64,(.*)$/s);
	if (!match) return null;
	const resolvedContentType = contentType || match[1] || 'image/png';
	if (!resolvedContentType.startsWith('image/')) return null;
	return { contentType: resolvedContentType, base64: match[2] };
}

async function serializePortableClipboardJson(
	globalClipboardJSON: string
): Promise<{ json: string; missing: number }> {
	const serialized = serializeClipboardJsonWithPlaceholder(globalClipboardJSON);
	const value = JSON.parse(serialized) as unknown;
	const paths = collectPortableMetadataPaths(value);
	if (!paths.length) return { json: serialized, missing: 0 };

	const context = parseAutomationAnywherePageContext(location.href);
	const sourceFileId = getNativeClipboardSourceFileId(value) || context.fileId || '';
	const authToken = readAutomationAnywhereAuthTokenFromLocalStorage();
	const resources: Record<string, PortableClipboardResource> = {};
	const missing: string[] = [];

	if (!sourceFileId || !authToken) {
		missing.push(...paths);
	} else {
		const api = new AutomationAnywhereApi(location.origin, authToken);
		const results = await Promise.allSettled(
			paths.map(async (path) => {
				const response = await api.downloadMetadataContent(sourceFileId, path);
				const resource = getBase64Resource(response.blob, response.type);
				if (!resource) throw new Error('Capture metadata is not an image.');
				return { path, resource };
			})
		);
		for (let index = 0; index < results.length; index += 1) {
			const result = results[index];
			if (result.status === 'fulfilled') {
				resources[result.value.path] = result.value.resource;
			} else {
				missing.push(paths[index]);
			}
		}
	}

	return {
		json: addPortableClipboardEnvelope(serialized, {
			sourceOrigin: location.origin,
			sourceFileId,
			resources,
			missing,
		}),
		missing: missing.length,
	};
}

function showCopyResult(source: string, missing: number, slot?: number): void {
	if (missing) {
		ui.showNotification(
			t('Copied with missing captures'),
			t('{count} capture image(s) could not be included.', { count: missing })
		);
		return;
	}
	ui.showNotification(
		source === 'watcher' ? t('Universal clipboard updated') : t('Copied'),
		source === 'watcher'
			? t('Auto slot saved from Automation Anywhere copy.')
			: slot === undefined
				? t('Saved current Automation Anywhere clipboard to auto slot.')
				: t('Saved current selection to slot {slot}.', { slot })
	);
}

async function saveGlobalClipboardValueToDefaultSlot(
	globalClipboardJSON: string | null,
	source: string
): Promise<string | null> {
	if (!globalClipboardJSON?.trim()) {
		void debugWarn('clipboard', 'globalClipboard is empty.', { source }, {
			feedback: true,
		});
		if (source !== 'watcher') {
			ui.showNotification(t('Copy failed'), t('Automation Anywhere clipboard is empty.'));
		}
		return null;
	}

	try {
		const generation = source === 'watcher' ? ++watcherSaveGeneration : 0;
		const portable = await serializePortableClipboardJson(globalClipboardJSON);
		if (source === 'watcher' && generation !== watcherSaveGeneration) return null;
		await universalClipboard.setValue(portable.json);
		void debugInfo('clipboard', 'Default universal clipboard slot saved.', {
			missingResources: portable.missing,
			source,
		}, { feedback: true });
		showCopyResult(source, portable.missing);
		return portable.json;
	} catch (error) {
		void debugWarn('clipboard', 'globalClipboard JSON is invalid.', {
			error,
			source,
		}, { feedback: true });
		if (source !== 'watcher') {
			ui.showNotification(t('Copy failed'), t('Could not read current clipboard JSON.'));
		}
		return null;
	}
}

export function startGlobalClipboardWatcher(): void {
	if (globalClipboardWatcherStarted) return;
	globalClipboardWatcherStarted = true;
	lastSeenGlobalClipboard = getGlobalClipboardValue();

	setInterval(() => {
		if (!isTaskEditorPage()) {
			globalClipboardWatcherOnEditorPage = false;
			return;
		}

		const currentClipboard = getGlobalClipboardValue();
		if (pasteInFlight) {
			lastSeenGlobalClipboard = currentClipboard;
			ignoredGlobalClipboardWrite = null;
			return;
		}
		if (!globalClipboardWatcherOnEditorPage) {
			lastSeenGlobalClipboard = currentClipboard;
			globalClipboardWatcherOnEditorPage = true;
			return;
		}
		if (currentClipboard === lastSeenGlobalClipboard) return;

		lastSeenGlobalClipboard = currentClipboard;
		if (!currentClipboard?.trim()) return;
		if (currentClipboard === ignoredGlobalClipboardWrite) {
			ignoredGlobalClipboardWrite = null;
			return;
		}

		void saveGlobalClipboardValueToDefaultSlot(currentClipboard, 'watcher');
	}, GLOBAL_CLIPBOARD_WATCH_INTERVAL_MS);
}

function getNodeUids(selector: string): Set<string> {
	return new Set(
		[...document.querySelectorAll<HTMLElement>(selector)]
			.map((element) => element.dataset.nodeUid)
			.filter((uid): uid is string => Boolean(uid))
	);
}

function setsEqual(left: ReadonlySet<string>, right: ReadonlySet<string>): boolean {
	return left.size === right.size && [...left].every((value) => right.has(value));
}

async function waitForNewRenderedNode(
	previousUids: ReadonlySet<string>,
	startUrl: string
): Promise<boolean> {
	const start = Date.now();
	while (Date.now() - start < CLIPBOARD_CHUNK_COMPLETION_WAIT_MS) {
		if (location.href !== startUrl) return false;
		const currentUids = getNodeUids(TASKBOT_RENDERED_NODE_SELECTOR);
		if ([...currentUids].some((uid) => !previousUids.has(uid))) return true;
		await utils.sleep(100);
	}
	return false;
}

async function stageSharedClipboard(json: string, uid: string): Promise<void> {
	markGlobalClipboardWrite(json);
	localStorage.removeItem(GLOBAL_CLIPBOARD_KEY);
	localStorage.removeItem(GLOBAL_CLIPBOARD_UID_KEY);
	await utils.sleep(0);
	localStorage.setItem(GLOBAL_CLIPBOARD_KEY, json);
	localStorage.setItem(GLOBAL_CLIPBOARD_UID_KEY, `"${uid}"`);
	if (!(await waitForPasteClipboardValue(json, uid))) {
		throw new Error('Automation Anywhere clipboard write failed.');
	}
}

function clipboardUid(json: string): string {
	const value = JSON.parse(json) as { uid?: unknown };
	if (typeof value.uid !== 'string' || !value.uid) {
		throw new Error('Automation Anywhere clipboard uid is missing.');
	}
	return value.uid;
}

function canStageClipboardChunk(json: string): boolean {
	try {
		// Reserve room for globalClipboardUid without waking AA during capacity probes.
		localStorage.setItem(GLOBAL_CLIPBOARD_KEY, `${json}${' '.repeat(256)}`);
		return true;
	} catch (error) {
		if (isStorageQuotaExceededError(error)) return false;
		throw error;
	}
}

async function clickSharedPaste(context: string): Promise<void> {
	await utils.sleep(CLIPBOARD_PASTE_BEFORE_CLICK_MS);
	const pasteButton = await waitForSharedClipboardButton(
		SHARED_PASTE_BUTTON_SELECTOR,
		context,
		'Shared paste button not found.'
	);
	if (!pasteButton) {
		ui.showNotification(t('Paste failed'), t('Shared paste button not found.'));
		throw new Error('Shared paste button not found.');
	}
	window.focus();
	pasteButton.focus({ preventScroll: true });
	pasteButton.click();
}

function showPasteResult(missing: number, slot?: number): void {
	if (missing) {
		ui.showNotification(
			t('Pasted with missing captures'),
			t('{count} capture image(s) were omitted.', { count: missing })
		);
		return;
	}
	ui.showNotification(
		t('Paste sent'),
		slot === undefined
			? t('Sent content from universal clipboard to Automation Anywhere.')
			: t('Sent content from slot {slot} to Automation Anywhere.', { slot })
	);
}

export async function copyToSlot(slot: number): Promise<string | null> {
	const globalClipboardJSON = await readFreshSharedCopy('copyToSlot');
	if (!globalClipboardJSON) {
		void debugWarn('clipboard', 'Clipboard JSON was not available for slot copy.', {
			slot,
		}, { feedback: true });
		ui.showNotification(
			t('Copy failed'),
			t('Clipboard JSON was not available in time for slot {slot}.', { slot })
		);
		return null;
	}

	try {
		const portable = await serializePortableClipboardJson(globalClipboardJSON);
		await universalClipboardSlot(slot).setValue(portable.json);
		void debugInfo('clipboard', 'Clipboard slot saved.', {
			missingResources: portable.missing,
			slot,
		}, { feedback: true });
		showCopyResult('copyToSlot', portable.missing, slot);
		return portable.json;
	} catch (error) {
		void debugError('clipboard', 'Failed to copy data to slot.', {
			error,
			slot,
		}, { feedback: true });
		ui.showNotification(t('Copy failed'), t('Could not save data to slot {slot}.', { slot }));
		return null;
	}
}

async function withPasteLock<T>(fn: () => Promise<T>): Promise<T> {
	if (pasteInFlight) throw new Error(t('Paste already in progress.'));
	pasteInFlight = true;
	try {
		return await fn();
	} finally {
		pasteInFlight = false;
	}
}

async function uploadPortableResources(
	envelope: PortableClipboardEnvelope,
	targetFileId: string
): Promise<{ replacements: Map<string, string>; missing: number }> {
	const replacements = new Map<string, string>();
	const entries = Object.entries(envelope.resources);
	const authToken = readAutomationAnywhereAuthTokenFromLocalStorage();
	if (!authToken) {
		return { replacements, missing: envelope.missing.length + entries.length };
	}

	const api = new AutomationAnywhereApi(location.origin, authToken);
	const results = await Promise.allSettled(
		entries.map(async ([path, resource]) => {
			const created = await api.createMetadataFile(targetFileId, resource.contentType);
			await api.uploadMetadataContent(created.id, resource.contentType, resource.base64);
			return { path, name: created.name };
		})
	);
	let missing = envelope.missing.length;
	for (const result of results) {
		if (result.status === 'fulfilled') {
			replacements.set(result.value.path, result.value.name);
		} else {
			missing += 1;
		}
	}
	return { replacements, missing };
}

async function prepareSharedPasteData(
	clipboardData: string,
	uid: string
): Promise<{ json: string; missing: number }> {
	const withUid = replaceStoredUid(clipboardData, uid);
	let value: unknown;
	try {
		value = JSON.parse(withUid);
	} catch {
		return { json: cleanAutomationAnywhereJson(withUid), missing: 0 };
	}

	const envelope = getPortableClipboardEnvelope(value);
	if (!envelope) {
		return { json: cleanAutomationAnywhereJson(withUid), missing: 0 };
	}
	const targetFileId = parseAutomationAnywherePageContext(location.href).fileId;
	const reuseSourceMetadata = Boolean(
		targetFileId &&
		envelope.sourceOrigin === location.origin &&
		envelope.sourceFileId === targetFileId
	);
	if (reuseSourceMetadata) {
		return {
			json: preparePortableClipboardForPaste(withUid, {
				targetFileId,
				reuseSourceMetadata: true,
			}),
			missing: 0,
		};
	}

	const uploaded = targetFileId
		? await uploadPortableResources(envelope, targetFileId)
		: {
				replacements: new Map<string, string>(),
				missing:
					envelope.missing.length + Object.keys(envelope.resources).length,
			};
	return {
		json: preparePortableClipboardForPaste(withUid, {
			targetFileId,
			replacements: uploaded.replacements,
		}),
		missing: uploaded.missing,
	};
}

async function requestSharedPaste(
	clipboardData: string,
	context: string,
	slot?: number,
	notify = true
): Promise<void> {
	const uid = generateUid();
	const prepared = await prepareSharedPasteData(clipboardData, uid);
	const cleanedData = prepared.json;
	try {
		await stageSharedClipboard(cleanedData, uid);
		await clickSharedPaste(context);
		void debugInfo('clipboard', 'Clipboard paste requested.', { slot }, {
			feedback: true,
		});
		if (notify) showPasteResult(prepared.missing, slot);
		await utils.sleep(CLIPBOARD_PASTE_AFTER_CLICK_LOCK_MS);
		return;
	} catch (error) {
		if (!isStorageQuotaExceededError(error)) throw error;
	}

	if (!(await getChunkedClipboardPasteEnabled())) {
		const message = t('Automation Anywhere clipboard storage limit exceeded.');
		ui.showNotification(t('Paste failed'), message);
		throw new Error(message);
	}
	const pageType = parseAutomationAnywherePageContext(location.href).pageType;
	if (pageType !== 'private-taskbot' && pageType !== 'public-taskbot') {
		const message = t('Chunked paste is supported only in TaskBot editors.');
		ui.showNotification(t('Paste failed'), message);
		throw new Error(message);
	}

	const cursorUids = getNodeUids(TASKBOT_ACTIVE_CURSOR_SELECTOR);
	localStorage.removeItem(GLOBAL_CLIPBOARD_KEY);
	localStorage.removeItem(GLOBAL_CLIPBOARD_UID_KEY);
	let chunks: string[];
	try {
		chunks = partitionClipboardJson(
			cleanedData,
			cursorUids.size ? 'reverse' : 'forward',
			canStageClipboardChunk,
			generateUid
		);
	} catch (error) {
		const message =
			error instanceof Error ? t(error.message) : t('Clipboard content cannot be split safely.');
		ui.showNotification(t('Paste failed'), message);
		throw new Error(message);
	} finally {
		localStorage.removeItem(GLOBAL_CLIPBOARD_KEY);
		localStorage.removeItem(GLOBAL_CLIPBOARD_UID_KEY);
	}

	ui.showNotification(
		t('Large paste'),
		t('Sending {count} chunks. Keep the TaskBot cursor unchanged.', {
			count: chunks.length,
		})
	);
	const startUrl = location.href;
	for (let index = 0; index < chunks.length; index += 1) {
		if (!setsEqual(cursorUids, getNodeUids(TASKBOT_ACTIVE_CURSOR_SELECTOR))) {
			ui.showNotification(
				t('Paste incomplete'),
				t('TaskBot cursor changed after {count} chunk(s).', { count: index })
			);
			throw new Error(t('TaskBot cursor changed during chunked paste.'));
		}
		const chunk = chunks[index];
		const renderedUids = getNodeUids(TASKBOT_RENDERED_NODE_SELECTOR);
		await stageSharedClipboard(chunk, clipboardUid(chunk));
		await clickSharedPaste(`${context}:chunk-${index + 1}`);
		if (!(await waitForNewRenderedNode(renderedUids, startUrl))) {
			ui.showNotification(
				t('Paste incomplete'),
				t('Automation Anywhere did not finish chunk {current} of {total}.', {
					current: index + 1,
					total: chunks.length,
				})
			);
			throw new Error(t('Chunked paste timed out or the editor changed.'));
		}
		await utils.sleep(CLIPBOARD_PASTE_AFTER_CLICK_LOCK_MS);
	}
	void debugInfo('clipboard', 'Chunked clipboard paste completed.', {
		chunks: chunks.length,
		slot,
	}, { feedback: true });
	if (notify) showPasteResult(prepared.missing, slot);
}

export async function pasteFromSlot(slot: number): Promise<string | null> {
	const clipboardData = await universalClipboardSlot(slot).getValue();
	if (!clipboardData) {
		void debugWarn('clipboard', 'Clipboard slot is empty.', { slot }, { feedback: true });
		ui.showNotification(t('Nothing to paste'), t('Slot {slot} is empty.', { slot }));
		return null;
	}

	await withPasteLock(() => requestSharedPaste(clipboardData, 'pasteFromSlot', slot));
	return clipboardData;
}

export async function universalCopy(): Promise<string | null> {
	const globalClipboardJSON = await readFreshSharedCopy('universalCopy');
	if (!globalClipboardJSON) {
		void debugWarn('clipboard', 'Fresh clipboard JSON was not available.', undefined, {
			feedback: true,
		});
		ui.showNotification(
			t('Copy failed'),
			t('Automation Anywhere did not produce fresh clipboard JSON.')
		);
		return null;
	}
	return saveGlobalClipboardValueToDefaultSlot(globalClipboardJSON, 'universalCopy');
}

export async function universalPaste(notify = true): Promise<string | null> {
	const clipboardData = await universalClipboard.getValue();
	if (!clipboardData) {
		void debugWarn('clipboard', 'Universal clipboard is empty.', undefined, {
			feedback: true,
		});
		ui.showNotification(t('Nothing to paste'), t('Universal clipboard is empty.'));
		return null;
	}

	await withPasteLock(() =>
		requestSharedPaste(clipboardData, 'universalPaste', undefined, notify)
	);
	return clipboardData;
}

export async function importActionJson(json: string): Promise<void> {
	const input = json.trim();
	if (!input) {
		ui.showNotification(t('Import failed'), t('Paste the action JSON first.'));
		throw new Error('Action JSON is empty.');
	}

	try {
		JSON.parse(input);
	} catch (error) {
		void debugWarn('json', 'Import JSON parse failed.', { error }, { feedback: true });
		ui.showNotification(t('Import failed'), t('Invalid JSON.'));
		throw new Error('Invalid JSON.');
	}

	await universalClipboard.setValue(input);
	void debugInfo('clipboard', 'Universal clipboard updated from imported JSON.', undefined, {
		feedback: true,
	});
	await utils.sleep(200);
	await universalPaste();
}

function cleanAutomationAnywhereJson(jsonString: string): string {
	return cleanClipboardJson(jsonString, (error) => {
		void debugWarn('json', 'Clipboard cleanup received invalid JSON.', { error }, {
			feedback: true,
		});
	});
}
