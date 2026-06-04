import { showActions, showVariables } from './commands';
import { debugWarn } from './debug';
import * as palette from './palette';
import {
	COMMAND_PALETTE_SHORTCUTS,
	type CommandPaletteShortcut,
	DEFAULT_COMMAND_PALETTE_SHORTCUT,
} from './settings';
import * as ui from './ui';

let activeCommandPaletteShortcut: CommandPaletteShortcut =
	DEFAULT_COMMAND_PALETTE_SHORTCUT;

interface SelectorDebugOptions {
	feedback?: boolean;
	message?: string;
	source?: string;
}

export function setActiveCommandPaletteShortcut(shortcut: CommandPaletteShortcut): void {
	activeCommandPaletteShortcut = shortcut;
}

export function getActiveCommandPaletteShortcutLabel(): string {
	return activeCommandPaletteShortcut === COMMAND_PALETTE_SHORTCUTS.SLASH
		? '/'
		: 'Alt + P';
}

export function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function reportSelectorFailure(
	selector: string,
	context = '',
	options: SelectorDebugOptions = {}
): void {
	void debugWarn(
		options.source ?? 'selector',
		options.message ?? 'Selector not found.',
		{ selector, context },
		{ feedback: options.feedback }
	);
}

export function safeQuery(
	selector: string,
	context = '',
	options: SelectorDebugOptions = {}
): Element | null {
	const el = document.querySelector(selector);
	if (!el) {
		reportSelectorFailure(selector, context, options);
	}
	return el;
}

export function safeAddClick(
	el: HTMLElement | null,
	handler: (event: MouseEvent) => void
): void {
	if (el) el.addEventListener('click', handler);
}

export function escapeHtml(value: unknown): string {
	return String(value).replace(/[&<>"']/g, (char) => {
		const map: Record<string, string> = {
			'&': '&amp;',
			'<': '&lt;',
			'>': '&gt;',
			'"': '&quot;',
			"'": '&#39;',
		};
		return map[char];
	});
}

export function normalizeCommandText(value: unknown): string {
	return String(value || '')
		.replace(/[-_]+/g, ' ')
		.replace(/\s+/g, ' ')
		.trim()
		.toLowerCase();
}

export function isTypingTarget(target: EventTarget | null): boolean {
	if (!(target instanceof HTMLElement)) return false;
	const tagName = target.tagName;
	return (
		target.isContentEditable ||
		tagName === 'INPUT' ||
		tagName === 'TEXTAREA' ||
		tagName === 'SELECT' ||
		!!target.closest('[contenteditable="true"]')
	);
}

export function isCommandPaletteShortcutPressed(e: KeyboardEvent): boolean {
	if (activeCommandPaletteShortcut === COMMAND_PALETTE_SHORTCUTS.SLASH) {
		return (
			e.key === '/' &&
			!e.altKey &&
			!e.ctrlKey &&
			!e.metaKey &&
			!isTypingTarget(e.target)
		);
	}

	return (
		e.key.toLowerCase() === 'p' &&
		e.altKey &&
		!e.ctrlKey &&
		!e.metaKey &&
		!e.shiftKey
	);
}

export function waitForElement(
	selector: string,
	timeout = 5000,
	context = '',
	options: SelectorDebugOptions = {}
): Promise<Element | null> {
	return new Promise((resolve) => {
		const el = document.querySelector(selector);
		if (el) return resolve(el);

		const observer = new MutationObserver(() => {
			const found = document.querySelector(selector);
			if (found) {
				observer.disconnect();
				resolve(found);
			}
		});

		observer.observe(document.body, { childList: true, subtree: true });

		setTimeout(() => {
			observer.disconnect();
			reportSelectorFailure(selector, context, options);
			resolve(null);
		}, timeout);
	});
}

export async function waitForClipboardJson(
	timeout = 1500,
	interval = 50,
	previousValue: string | null = null
): Promise<string | null> {
	const start = Date.now();
	while (Date.now() - start < timeout) {
		const value = localStorage.getItem('globalClipboard');
		if (value && value !== previousValue) {
			try {
				JSON.parse(value);
				return value;
			} catch {
				// Keep waiting until Automation Anywhere finishes writing JSON.
			}
		}
		await sleep(interval);
	}
	return null;
}

export function getPaletteState(): 'opened' | 'closed' {
	const paletteElement = safeQuery(
		'.editor-layout__palette',
		'getPaletteState'
	) as HTMLElement | null;
	if (!paletteElement) return 'closed';
	return paletteElement.offsetWidth <= 8 ? 'closed' : 'opened';
}

export function registerKeyboardShortcuts(): void {
	document.addEventListener(
		'click',
		(e) => {
			const target = e.target as HTMLElement | null;
			const nodeLink = target?.closest?.(
				'.taskbot-canvas-list-node__title a.taskbotnodelabel-details-link[href]'
			);
			if (!nodeLink || e.button === 1) return;
			e.preventDefault();
			e.stopImmediatePropagation();
		},
		true
	);

	document.addEventListener('keydown', (e) => {
		if (e.key === 'Escape' && palette.isCommandPaletteVisible()) {
			palette.closeCommandPalette();
			e.preventDefault();
		}
	});

	document.addEventListener('mousedown', (e) => {
		if (!palette.isCommandPaletteVisible()) return;
		const commandPalette = palette.getCommandPalette();
		if (!commandPalette) return;
		const eventPath = e.composedPath?.();
		if (eventPath?.includes(commandPalette) || commandPalette.contains(e.target as Node)) {
			return;
		}
		palette.closeCommandPalette();
	});

	document.addEventListener('keydown', (e) => {
		if (isCommandPaletteShortcutPressed(e)) {
			e.preventDefault();
			palette.insertCommandPalette();
			ui.insertCustomEditorPaletteButtons();
			palette.togglePaletteVisibility();
		}
	});

	document.addEventListener('keydown', (e) => {
		if (e.code === 'KeyA' && e.altKey) {
			showActions();
			e.preventDefault();
		}
	});

	document.addEventListener('keydown', (e) => {
		if (e.code === 'KeyV' && e.altKey) {
			showVariables();
			e.preventDefault();
		}
	});

	document.addEventListener('keydown', (e) => {
		if (e.ctrlKey && e.code === 'KeyD') {
			toggleToolbar();
			e.preventDefault();
		}
	});
}

export function toggleToolbar(): void {
	void clickIfExists('div.editor-layout__resize:nth-child(2) > button:nth-child(2)');
}

export async function clickIfExists(
	selector: string,
	context?: string,
	retry = true,
	options: SelectorDebugOptions = {}
): Promise<void> {
	const el = document.querySelector(selector);
	if (el instanceof HTMLElement) {
		el.click();
		return;
	}
	if (retry) {
		await sleep(100);
		const retryEl = document.querySelector(selector);
		if (retryEl instanceof HTMLElement) {
			retryEl.click();
			return;
		}
		reportSelectorFailure(selector, context ? `${context} after retry` : 'after retry', options);
		return;
	}
	reportSelectorFailure(selector, context, options);
}

export function ensureEnglishLocale(): void {
	const lng = localStorage.getItem('i18nextLng');
	if (lng !== 'en-US') {
		ui.showNotification(
			'Language changed',
			'For correct functioning of this extension, the language will be set to English (en-US). The page will reload.',
			3600
		);
		localStorage.setItem('i18nextLng', 'en-US');
		setTimeout(() => window.location.reload(), 1800);
	}
}
