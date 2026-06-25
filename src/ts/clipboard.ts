import * as ui from './ui';
import { debugError, debugInfo, debugWarn } from './debug';
import { t } from './i18n';
import {
	universalClipboard,
	universalClipboardSlot,
} from './universal-clipboard-storage';
import * as utils from './utils';

const UID_PLACEHOLDER = '__BETTER_AA_UID__';
const GLOBAL_CLIPBOARD_KEY = 'globalClipboard';
const GLOBAL_CLIPBOARD_UID_KEY = 'globalClipboardUid';
const GLOBAL_CLIPBOARD_WATCH_INTERVAL_MS = 500;
const CLIPBOARD_BUTTON_WAIT_MS = 1500;
const CLIPBOARD_COPY_WAIT_MS = 3000;
const CLIPBOARD_POLL_MS = 50;
const CLIPBOARD_PASTE_READY_WAIT_MS = 1500;
const CLIPBOARD_PASTE_BEFORE_CLICK_MS = 2500;
const CLIPBOARD_PASTE_AFTER_CLICK_LOCK_MS = 1500;
const TASK_EDITOR_SELECTORS = [
	'.aa-icon-action-clipboard-copy--shared',
	'.aa-icon-action-clipboard-paste--shared',
	'.taskbot-editor__toolbar__action',
	'.taskbot-canvas-list-node',
	'.editor-layout__canvas',
];

let globalClipboardWatcherStarted = false;
let globalClipboardWatcherOnEditorPage = false;
let lastSeenGlobalClipboard: string | null = null;
let ignoredGlobalClipboardWrite: string | null = null;
let pasteInFlight = false;

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
		'.aa-icon-action-clipboard-copy--shared',
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
	return globalClipboardJSON;
}

function isTaskEditorPage(): boolean {
	const hash = location.hash.toLowerCase();
	if (hash.includes('taskbot') || hash.includes('editor')) return true;
	return TASK_EDITOR_SELECTORS.some((selector) => !!document.querySelector(selector));
}

function serializeClipboardJsonWithPlaceholder(globalClipboardJSON: string): string {
	const clipboardData = JSON.parse(globalClipboardJSON) as unknown;
	if (
		!clipboardData ||
		typeof clipboardData !== 'object' ||
		Array.isArray(clipboardData)
	) {
		throw new Error('globalClipboard JSON is not an object.');
	}
	(clipboardData as Record<string, unknown>).uid = UID_PLACEHOLDER;
	return JSON.stringify(clipboardData);
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
		const serialized = serializeClipboardJsonWithPlaceholder(globalClipboardJSON);
		await universalClipboard.setValue(serialized);
		void debugInfo('clipboard', 'Default universal clipboard slot saved.', {
			source,
		}, { feedback: true });
		ui.showNotification(
			source === 'watcher' ? t('Universal clipboard updated') : t('Copied'),
			source === 'watcher'
				? t('Auto slot saved from Automation Anywhere copy.')
				: t('Saved current Automation Anywhere clipboard to auto slot.')
		);
		return serialized;
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

export async function saveGlobalClipboardToDefaultSlot(
	source: string
): Promise<string | null> {
	return saveGlobalClipboardValueToDefaultSlot(getGlobalClipboardValue(), source);
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
		const clipboardData = JSON.parse(globalClipboardJSON);
		clipboardData.uid = UID_PLACEHOLDER;
		const serialized = JSON.stringify(clipboardData);
		await universalClipboardSlot(slot).setValue(serialized);
		void debugInfo('clipboard', 'Clipboard slot saved.', { slot }, { feedback: true });
		ui.showNotification(t('Copied'), t('Saved current selection to slot {slot}.', { slot }));
		return serialized;
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

async function requestSharedPaste(
	clipboardData: string,
	context: string,
	slot?: number,
	notify = true
): Promise<void> {
	const uid = generateUid();
	const cleanedData = cleanAutomationAnywhereJson(replaceStoredUid(clipboardData, uid));
	markGlobalClipboardWrite(cleanedData);

	localStorage.removeItem(GLOBAL_CLIPBOARD_KEY);
	localStorage.removeItem(GLOBAL_CLIPBOARD_UID_KEY);
	await utils.sleep(0);

	localStorage.setItem(GLOBAL_CLIPBOARD_KEY, cleanedData);
	localStorage.setItem(GLOBAL_CLIPBOARD_UID_KEY, `"${uid}"`);

	const stable = await waitForPasteClipboardValue(cleanedData, uid);
	if (!stable) {
		throw new Error('Automation Anywhere clipboard write failed.');
	}
	await utils.sleep(CLIPBOARD_PASTE_BEFORE_CLICK_MS);

	const pasteButton = await waitForSharedClipboardButton(
		'.aa-icon-action-clipboard-paste--shared',
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
	void debugInfo('clipboard', 'Clipboard paste requested.', { slot }, { feedback: true });
	if (notify) {
		ui.showNotification(
			t('Paste sent'),
			slot === undefined
				? t('Sent content from universal clipboard to Automation Anywhere.')
				: t('Sent content from slot {slot} to Automation Anywhere.', { slot })
		);
	}

	await utils.sleep(CLIPBOARD_PASTE_AFTER_CLICK_LOCK_MS);
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
	await universalPaste(false);
	ui.showNotification(t('Import queued'), t('JSON accepted. Pasting action now.'));
}

export function clearSensitiveFields(obj: unknown): void {
	if (!obj || typeof obj !== 'object') return;
	for (const key in obj) {
		if (!Object.prototype.hasOwnProperty.call(obj, key)) continue;
		const record = obj as Record<string, unknown>;
		if (
			key === 'blob' ||
			key === 'thumbnailMetadataPath' ||
			key === 'screenshotMetadataPath'
		) {
			record[key] = '';
		} else {
			clearSensitiveFields(record[key]);
		}
	}
}

export function cleanAutomationAnywhereJson(jsonString: string): string {
	let data: unknown;
	try {
		data = JSON.parse(jsonString);
	} catch (error) {
		void debugWarn('json', 'Clipboard cleanup received invalid JSON.', { error }, {
			feedback: true,
		});
		return jsonString;
	}

	if (
		!data ||
		typeof data !== 'object' ||
		!Array.isArray((data as { nodes?: unknown }).nodes)
	) {
		return JSON.stringify(data);
	}

	for (const node of (data as { nodes: unknown[] }).nodes) {
		if (
			!node ||
			typeof node !== 'object' ||
			!Array.isArray((node as { attributes?: unknown }).attributes)
		) {
			continue;
		}
		for (const attr of (node as { attributes: unknown[] }).attributes) {
			if (!attr || typeof attr !== 'object') continue;
			const value = (attr as { value?: unknown }).value;
			clearSensitiveFields(value);
		}
	}
	return JSON.stringify(data);
}
