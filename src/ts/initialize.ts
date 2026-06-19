import { openSidebarCommandPalette, showActions, showVariables } from './commands';
import { t } from './i18n';
import * as palette from './palette';
import { refreshSounds } from './sounds';
import {
	COMMAND_PALETTE_SHORTCUTS,
	DEFAULT_BLOCK_TASKBOT_NODE_LABEL_CLICKS,
	DEFAULT_COMMAND_PALETTE_ENABLED,
	DEFAULT_COMMAND_PALETTE_SHORTCUT,
	DEFAULT_OPEN_SIDEBAR_SHORTCUT,
	OPEN_SIDEBAR_SHORTCUTS,
	getCommandPaletteShortcutLabel,
	type CommandPaletteShortcut,
	type OpenSidebarShortcut,
} from './settings';
import { registerMouseClickSuggestions } from './suggestions';
import { toggleToolbar } from './utils';
import * as ui from './ui';

let initialized = false;
let forceEnglishLocaleEnabled = true;
let pathFinderSlimSidebarEnabled = false;

let activeCommandPaletteShortcut: CommandPaletteShortcut =
	DEFAULT_COMMAND_PALETTE_SHORTCUT;
let activeCommandPaletteEnabled = DEFAULT_COMMAND_PALETTE_ENABLED;
let activeOpenSidebarShortcut: OpenSidebarShortcut =
	DEFAULT_OPEN_SIDEBAR_SHORTCUT;
let activeBlockTaskbotNodeLabelClicks = DEFAULT_BLOCK_TASKBOT_NODE_LABEL_CLICKS;
let lastTaskbotLinkClickBlockedToastAt = 0;

const TASKBOT_NODE_LABEL_LINK_SELECTOR =
	'.taskbot-canvas-list-node__title a.taskbotnodelabel-details-link[href]';
const TASKBOT_LINK_CLICK_BLOCKED_TOAST_COOLDOWN_MS = 2000;

function isTypingTarget(target: EventTarget | null): boolean {
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

function isCommandPaletteShortcutPressed(e: KeyboardEvent): boolean {
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

function isOpenSidebarShortcutPressed(e: KeyboardEvent): boolean {
	if (isTypingTarget(e.target)) return false;

	const withoutMeta = !e.metaKey;
	switch (activeOpenSidebarShortcut) {
		case OPEN_SIDEBAR_SHORTCUTS.CTRL_SHIFT_L:
			return e.code === 'KeyL' && e.ctrlKey && e.shiftKey && !e.altKey && withoutMeta;
		case OPEN_SIDEBAR_SHORTCUTS.ALT_SHIFT_S:
			return e.code === 'KeyS' && e.altKey && e.shiftKey && !e.ctrlKey && withoutMeta;
		case OPEN_SIDEBAR_SHORTCUTS.ALT_SHIFT_O:
			return e.code === 'KeyO' && e.altKey && e.shiftKey && !e.ctrlKey && withoutMeta;
		case OPEN_SIDEBAR_SHORTCUTS.CTRL_SHIFT_SPACE:
			return e.code === 'Space' && e.ctrlKey && e.shiftKey && !e.altKey && withoutMeta;
		case OPEN_SIDEBAR_SHORTCUTS.ALT_SHIFT_L:
		default:
			return e.code === 'KeyL' && e.altKey && e.shiftKey && !e.ctrlKey && withoutMeta;
	}
}

function showTaskbotLinkClickBlockedToast(): void {
	const now = Date.now();
	if (
		now - lastTaskbotLinkClickBlockedToastAt <
		TASKBOT_LINK_CLICK_BLOCKED_TOAST_COOLDOWN_MS
	) {
		return;
	}
	lastTaskbotLinkClickBlockedToastAt = now;
	ui.showNotification(
		t('Taskbot link click blocked'),
		t('Use middle-click to open this link.')
	);
}

function handleTaskbotNodeLinkClick(e: MouseEvent): void {
	if (!activeBlockTaskbotNodeLabelClicks) return;
	const target = e.target as HTMLElement | null;
	const nodeLink = target?.closest?.(TASKBOT_NODE_LABEL_LINK_SELECTOR);
	if (!nodeLink || e.button === 1) return;
	e.preventDefault();
	e.stopImmediatePropagation();
	showTaskbotLinkClickBlockedToast();
}

function handleCommandPaletteOutsideMouseDown(e: MouseEvent): void {
	if (!palette.isCommandPaletteVisible()) return;
	const commandPalette = palette.getCommandPalette();
	if (!commandPalette) return;
	const eventPath = e.composedPath?.();
	if (eventPath?.includes(commandPalette) || commandPalette.contains(e.target as Node)) {
		return;
	}
	palette.closeCommandPalette();
}

function handleGlobalKeyDown(e: KeyboardEvent): void {
	if (e.key === 'Escape' && palette.isCommandPaletteVisible()) {
		palette.closeCommandPalette();
		e.preventDefault();
		return;
	}

	if (!import.meta.env.FIREFOX && isOpenSidebarShortcutPressed(e)) {
		e.preventDefault();
		openSidebarCommandPalette();
	}

	if (activeCommandPaletteEnabled && isCommandPaletteShortcutPressed(e)) {
		e.preventDefault();
		palette.insertCommandPalette();
		ui.syncCustomEditorPaletteButtons();
		palette.togglePaletteVisibility();
	}

	if (e.code === 'KeyA' && e.altKey) {
		showActions();
		e.preventDefault();
	}

	if (e.code === 'KeyV' && e.altKey) {
		showVariables();
		e.preventDefault();
	}

	if (e.ctrlKey && e.code === 'KeyD') {
		toggleToolbar();
		e.preventDefault();
	}
}

function ensureEnglishLocale(): void {
	const lng = localStorage.getItem('i18nextLng');
	if (lng !== 'en-US') {
		ui.showNotification(
			t('Language changed'),
			t('For correct functioning of this extension, the language will be set to English (en-US). The page will reload.'),
			3600
		);
		localStorage.setItem('i18nextLng', 'en-US');
		setTimeout(() => window.location.reload(), 1800);
	}
}

export function setActiveCommandPaletteShortcut(shortcut: CommandPaletteShortcut): void {
	activeCommandPaletteShortcut = shortcut;
}

export function setActiveCommandPaletteEnabled(value: boolean): void {
	activeCommandPaletteEnabled = value;
	if (!value) palette.closeCommandPalette();
}

export function setActiveOpenSidebarShortcut(shortcut: OpenSidebarShortcut): void {
	activeOpenSidebarShortcut = shortcut;
}

export function setActiveBlockTaskbotNodeLabelClicks(value: boolean): void {
	activeBlockTaskbotNodeLabelClicks = value;
}

export function setCustomPaletteButtonsEnabled(enabled: boolean): void {
	ui.setCustomEditorPaletteButtonsEnabled(enabled);
}

export function setForceEnglishLocaleEnabled(enabled: boolean): void {
	forceEnglishLocaleEnabled = enabled;
	if (enabled && initialized) {
		ensureEnglishLocale();
	}
}

export function setPathFinderSlimSidebarEnabled(enabled: boolean): void {
	pathFinderSlimSidebarEnabled = enabled;
	if (initialized) {
		ui.syncPathFinderSlimSidebar(enabled);
	}
}

function injectUi(): void {
	ui.syncCustomEditorPaletteButtons();
	ui.syncPathFinderSlimSidebar(pathFinderSlimSidebarEnabled);
	refreshSounds();
}

function initialize(): void {
	injectUi();

	if (!initialized) {
		if (forceEnglishLocaleEnabled) {
			ensureEnglishLocale();
		}
		document.addEventListener('click', handleTaskbotNodeLinkClick, true);
		document.addEventListener('mousedown', handleCommandPaletteOutsideMouseDown);
		document.addEventListener('keydown', handleGlobalKeyDown);
		registerMouseClickSuggestions(() => getCommandPaletteShortcutLabel(activeCommandPaletteShortcut));
		setInterval(ui.updateActiveButton, 1000);
		initialized = true;

		let lastHref = document.location.href;
		setInterval(() => {
			const currentHref = document.location.href;
			if (lastHref !== currentHref) {
				lastHref = currentHref;
				injectUi();
			}
		}, 5000);
	}
}

export function callInitializeRepeatedly(times = 3, interval = 5000): void {
	if (times <= 0) return;
	initialize();
	let count = 1;
	if (count >= times) return;
	const intervalId = setInterval(() => {
		initialize();
		count++;
		if (count >= times) {
			clearInterval(intervalId);
		}
	}, interval);
}
