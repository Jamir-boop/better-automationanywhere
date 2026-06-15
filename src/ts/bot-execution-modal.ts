import { isTaskEditorUrl } from './automation-anywhere';
import { t } from './i18n';
import {
	DEFAULT_BOT_EXECUTION_MODAL_POSITION,
	normalizeBotExecutionModalPosition,
	type BotExecutionModalPosition,
} from './settings';

const BOT_MODAL_SELECTOR = '[data-modal-id="taskbot-action-run-now"]';
const DIALOG_SELECTOR = '[role="dialog"]';
const ALERT_CONTROLS_SELECTOR = '.alert__controls';
const MESSAGE_CONTROLS_SELECTOR = '.message__controls';
const MESSAGE_TITLE_SELECTOR = '.message__title';
const MESSAGE_TITLE_CONTAINER_SELECTOR = '.message__title-container';
const RUNNING_INDICATOR_SELECTOR = '.devicechannelmodal, .rio-spinner--variant_WORKING';
const BACKDROP_SELECTOR = '.modal-backdrop';
const CONTROL_ATTR = 'data-better-aa-bot-modal-control';
const WIRED_ATTR = 'data-better-aa-bot-modal-wired';
const DIALOG_CLASS = 'better-aa-bot-modal-dialog';
const MODAL_CLASS = 'better-aa-bot-modal';
const BACKDROP_CLASS = 'better-aa-bot-modal-backdrop';
const BODY_MINIMIZED_CLASS = 'better-aa-bot-modal-body-is-minimized';
const MINIMIZED_CLASS = 'better-aa-bot-modal-is-minimized';
const BACKDROP_MINIMIZED_CLASS = 'better-aa-bot-modal-backdrop-is-minimized';
const CONTROL_CLASS = 'better-aa-bot-modal-control';
const SYNC_DEBOUNCE_MS = 50;

type BotModalControl = 'minimize' | 'maximize';

interface BotModalRecord {
	dialog: HTMLElement;
	modal: HTMLElement;
	backdrop: HTMLElement;
	originalAriaModal: string | null;
	minimized: boolean;
}

let enabled = false;
let observer: MutationObserver | null = null;
let syncTimer: ReturnType<typeof setTimeout> | null = null;
let position: BotExecutionModalPosition = DEFAULT_BOT_EXECUTION_MODAL_POSITION;

const recordsByDialog = new WeakMap<HTMLElement, BotModalRecord>();
const activeRecords = new Set<BotModalRecord>();

function getBackdrop(dialog: HTMLElement): HTMLElement | null {
	const previousSibling = dialog.previousElementSibling;
	if (
		previousSibling instanceof HTMLElement &&
		previousSibling.matches(BACKDROP_SELECTOR)
	) {
		return previousSibling;
	}

	const nextSibling = dialog.nextElementSibling;
	if (nextSibling instanceof HTMLElement && nextSibling.matches(BACKDROP_SELECTOR)) {
		return nextSibling;
	}

	const parent = dialog.parentElement;
	if (!parent) return null;
	const children = Array.from(parent.children);
	const dialogIndex = children.indexOf(dialog);
	if (dialogIndex < 0) return null;

	for (let index = dialogIndex - 1; index >= 0; index -= 1) {
		const child = children[index];
		if (child instanceof HTMLElement && child.matches(BACKDROP_SELECTOR)) {
			return child;
		}
	}

	for (const child of children.slice(dialogIndex + 1)) {
		if (child instanceof HTMLElement && child.matches(BACKDROP_SELECTOR)) {
			return child;
		}
	}
	return null;
}

function getDialog(modal: HTMLElement): HTMLElement | null {
	const dialog = modal.closest<HTMLElement>(DIALOG_SELECTOR);
	return dialog instanceof HTMLElement ? dialog : null;
}

function getControlHost(modal: HTMLElement): HTMLElement | null {
	return (
		modal.querySelector<HTMLElement>(MESSAGE_TITLE_CONTAINER_SELECTOR) ??
		modal.querySelector<HTMLElement>(ALERT_CONTROLS_SELECTOR) ??
		modal.querySelector<HTMLElement>(MESSAGE_CONTROLS_SELECTOR)
	);
}

function hasBotExecutionTitle(modal: HTMLElement): boolean {
	const title = modal.querySelector<HTMLElement>(MESSAGE_TITLE_SELECTOR);
	const text = title?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
	return text.startsWith('Deploying to your computer') || text.startsWith('Running bot');
}

function isBotExecutionModal(modal: HTMLElement): boolean {
	return (
		modal.matches(BOT_MODAL_SELECTOR) &&
		Boolean(getControlHost(modal)) &&
		(hasBotExecutionTitle(modal) ||
			Boolean(modal.querySelector(RUNNING_INDICATOR_SELECTOR)))
	);
}

function getTargetModals(): HTMLElement[] {
	if (!enabled || !isTaskEditorUrl(location.href)) return [];
	return Array.from(document.querySelectorAll<HTMLElement>(BOT_MODAL_SELECTOR)).filter(
		isBotExecutionModal
	);
}

function createControl(action: BotModalControl, label: string): HTMLElement {
	const wrapper = document.createElement('div');
	wrapper.className = CONTROL_CLASS;
	wrapper.setAttribute(CONTROL_ATTR, action);

	const button = document.createElement('button');
	button.type = 'button';
	button.tabIndex = 0;
	button.className = 'better-aa-bot-modal-control-button';
	button.setAttribute('aria-label', label);
	button.title = label;

	const icon = document.createElement('span');
	icon.className = 'better-aa-bot-modal-control-icon';
	icon.setAttribute('aria-hidden', 'true');
	icon.textContent = action === 'minimize' ? '\u2212' : '\u25A1';

	button.append(icon);
	wrapper.append(button);
	wireControl(wrapper);
	return wrapper;
}

function getRecordFromControl(control: HTMLElement): BotModalRecord | null {
	const modal = control.closest<HTMLElement>(BOT_MODAL_SELECTOR);
	const dialog = modal ? getDialog(modal) : null;
	return dialog ? recordsByDialog.get(dialog) ?? null : null;
}

function wireControl(control: HTMLElement): void {
	const button = control.querySelector<HTMLButtonElement>('button');
	if (!button || button.hasAttribute(WIRED_ATTR)) return;
	button.setAttribute(WIRED_ATTR, 'true');
	button.addEventListener('click', (event) => {
		event.preventDefault();
		event.stopImmediatePropagation();
		const record = getRecordFromControl(button);
		if (!record) return;
		setMinimized(record, control.getAttribute(CONTROL_ATTR) === 'minimize');
	});
}

function ensureControls(record: BotModalRecord): void {
	const host = getControlHost(record.modal);
	if (!host) return;

	let minimizeControl = record.modal.querySelector<HTMLElement>(
		`[${CONTROL_ATTR}="minimize"]`
	);
	if (!minimizeControl) {
		minimizeControl = createControl('minimize', t('Minimize'));
	} else {
		wireControl(minimizeControl);
	}
	host.append(minimizeControl);

	let maximizeControl = record.modal.querySelector<HTMLElement>(
		`[${CONTROL_ATTR}="maximize"]`
	);
	if (!maximizeControl) {
		maximizeControl = createControl('maximize', t('Maximize'));
	} else {
		wireControl(maximizeControl);
	}
	host.append(maximizeControl);

	minimizeControl.hidden = record.minimized;
	maximizeControl.hidden = !record.minimized;
}

function getOrCreateRecord(modal: HTMLElement): BotModalRecord | null {
	const dialog = getDialog(modal);
	if (!dialog) return null;
	const backdrop = getBackdrop(dialog);
	if (!backdrop) return null;

	const existingRecord = recordsByDialog.get(dialog);
	if (existingRecord) {
		existingRecord.modal = modal;
		existingRecord.backdrop = backdrop;
		modal.classList.add(MODAL_CLASS);
		backdrop.classList.add(BACKDROP_CLASS);
		return existingRecord;
	}

	const record: BotModalRecord = {
		dialog,
		modal,
		backdrop,
		originalAriaModal: dialog.getAttribute('aria-modal'),
		minimized: false,
	};
	recordsByDialog.set(dialog, record);
	activeRecords.add(record);
	dialog.classList.add(DIALOG_CLASS);
	modal.classList.add(MODAL_CLASS);
	backdrop.classList.add(BACKDROP_CLASS);
	return record;
}

function restoreAriaModal(record: BotModalRecord): void {
	if (record.originalAriaModal === null) {
		record.dialog.removeAttribute('aria-modal');
		return;
	}
	record.dialog.setAttribute('aria-modal', record.originalAriaModal);
}

function syncBodyMinimizedState(): void {
	document.body?.classList.toggle(
		BODY_MINIMIZED_CLASS,
		Array.from(activeRecords).some((record) => record.minimized)
	);
}

function setMinimized(record: BotModalRecord, minimized: boolean): void {
	record.minimized = minimized;
	record.dialog.classList.toggle(MINIMIZED_CLASS, minimized);
	record.modal.classList.toggle(MINIMIZED_CLASS, minimized);
	record.backdrop.classList.toggle(BACKDROP_MINIMIZED_CLASS, minimized);

	if (minimized) {
		record.dialog.setAttribute('aria-modal', 'false');
	} else {
		restoreAriaModal(record);
	}

	ensureControls(record);
	syncBodyMinimizedState();
}

function restoreRecord(record: BotModalRecord): void {
	setMinimized(record, false);
	record.modal
		.querySelectorAll<HTMLElement>(`[${CONTROL_ATTR}]`)
		.forEach((control) => control.remove());
	record.dialog.classList.remove(DIALOG_CLASS, MINIMIZED_CLASS);
	record.modal.classList.remove(MODAL_CLASS, MINIMIZED_CLASS);
	record.backdrop.classList.remove(BACKDROP_CLASS, BACKDROP_MINIMIZED_CLASS);
	restoreAriaModal(record);
	activeRecords.delete(record);
	recordsByDialog.delete(record.dialog);
	syncBodyMinimizedState();
}

function syncBotExecutionModals(): void {
	if (!enabled) return;

	const currentDialogs = new Set<HTMLElement>();
	for (const modal of getTargetModals()) {
		const record = getOrCreateRecord(modal);
		if (!record) continue;
		currentDialogs.add(record.dialog);
		ensureControls(record);
		setMinimized(record, record.minimized);
	}

	for (const record of Array.from(activeRecords)) {
		const stillCurrent =
			currentDialogs.has(record.dialog) &&
			document.documentElement.contains(record.dialog);
		if (!stillCurrent) restoreRecord(record);
	}
}

function scheduleSync(): void {
	if (!enabled) return;
	if (syncTimer) clearTimeout(syncTimer);
	syncTimer = setTimeout(() => {
		syncTimer = null;
		requestAnimationFrame(syncBotExecutionModals);
	}, SYNC_DEBOUNCE_MS);
}

function observeBotExecutionModals(): void {
	if (observer || !document.body) return;
	observer = new MutationObserver(scheduleSync);
	observer.observe(document.body, {
		childList: true,
		subtree: true,
		attributes: true,
		attributeFilter: ['class', 'data-modal-id', 'aria-modal'],
	});
}

function stopObserver(): void {
	observer?.disconnect();
	observer = null;
	if (syncTimer) {
		clearTimeout(syncTimer);
		syncTimer = null;
	}
}

function restoreAllRecords(): void {
	for (const record of Array.from(activeRecords)) {
		restoreRecord(record);
	}
}

export function setBotExecutionModalPosition(value: BotExecutionModalPosition): void {
	position = normalizeBotExecutionModalPosition(value);
	document.documentElement.dataset.betterAaBotModalPosition = position;
}

export function setBotExecutionModalEnabled(nextEnabled: boolean): void {
	if (enabled === nextEnabled) {
		if (enabled) scheduleSync();
		return;
	}

	enabled = nextEnabled;
	if (!enabled) {
		stopObserver();
		restoreAllRecords();
		return;
	}

	setBotExecutionModalPosition(position);
	observeBotExecutionModals();
	scheduleSync();
}
