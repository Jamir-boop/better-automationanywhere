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

function markGlobalClipboardWrite(value: string): void {
	ignoredGlobalClipboardWrite = value;
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
				? t('Default slot saved from Automation Anywhere copy.')
				: t('Saved current Automation Anywhere clipboard to default slot.')
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
	const copyButton = utils.safeQuery(
		'.aa-icon-action-clipboard-copy--shared',
		'copyToSlot',
		{
			feedback: true,
			message: 'Shared copy button not found.',
			source: 'clipboard',
		}
	) as HTMLElement | null;
	if (!copyButton) {
		ui.showNotification(t('Copy failed'), t('Shared copy button not found.'));
		return null;
	}

	const previousClipboardJSON = getGlobalClipboardValue();
	copyButton.click();

	const globalClipboardJSON = await utils.waitForClipboardJson(
		1500,
		50,
		previousClipboardJSON
	);
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

export async function pasteFromSlot(slot: number): Promise<string | null> {
	const clipboardData = await universalClipboardSlot(slot).getValue();
	if (!clipboardData) {
		void debugWarn('clipboard', 'Clipboard slot is empty.', { slot }, { feedback: true });
		ui.showNotification(t('Nothing to paste'), t('Slot {slot} is empty.', { slot }));
		return null;
	}

	const uid = generateUid();
	const cleanedData = cleanAutomationAnywhereJson(replaceStoredUid(clipboardData, uid));
	markGlobalClipboardWrite(cleanedData);
	localStorage.setItem(GLOBAL_CLIPBOARD_KEY, cleanedData);
	localStorage.setItem(GLOBAL_CLIPBOARD_UID_KEY, `"${uid}"`);

	const pasteButton = utils.safeQuery(
		'.aa-icon-action-clipboard-paste--shared',
		'pasteFromSlot',
		{
			feedback: true,
			message: 'Shared paste button not found.',
			source: 'clipboard',
		}
	) as HTMLElement | null;
	if (!pasteButton) {
		ui.showNotification(t('Paste failed'), t('Shared paste button not found.'));
		throw new Error('Shared paste button not found.');
	}

	setTimeout(() => {
		pasteButton.click();
		void debugInfo('clipboard', 'Clipboard slot pasted.', { slot }, { feedback: true });
		ui.showNotification(t('Pasted'), t('Inserted content from slot {slot}.', { slot }));
	}, 500);
	return clipboardData;
}

export async function universalCopy(): Promise<string | null> {
	return saveGlobalClipboardToDefaultSlot('universalCopy');
}

export async function universalPaste(): Promise<string | null> {
	const clipboardData = await universalClipboard.getValue();
	if (!clipboardData) {
		void debugWarn('clipboard', 'Universal clipboard is empty.', undefined, {
			feedback: true,
		});
		ui.showNotification(t('Nothing to paste'), t('Universal clipboard is empty.'));
		return null;
	}

	const uid = generateUid();
	const cleanedData = cleanAutomationAnywhereJson(replaceStoredUid(clipboardData, uid));
	markGlobalClipboardWrite(cleanedData);
	localStorage.setItem(GLOBAL_CLIPBOARD_KEY, cleanedData);
	localStorage.setItem(GLOBAL_CLIPBOARD_UID_KEY, `"${uid}"`);

	setTimeout(() => {
		const pasteButton = utils.safeQuery(
			'.aa-icon-action-clipboard-paste--shared',
			'universalPaste',
			{
				feedback: true,
				message: 'Shared paste button not found.',
				source: 'clipboard',
			}
		) as HTMLElement | null;
		if (!pasteButton) {
			ui.showNotification(t('Paste failed'), t('Shared paste button not found.'));
			return;
		}
		pasteButton.click();
		void debugInfo('clipboard', 'Universal clipboard pasted.', undefined, {
			feedback: true,
		});
		ui.showNotification(t('Pasted'), t('Inserted content from universal clipboard.'));
	}, 1000);
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
