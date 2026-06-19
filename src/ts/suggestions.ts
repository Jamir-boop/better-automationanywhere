import * as palette from './palette';
import { debugInfo } from './debug';
import { t } from './i18n';
import * as ui from './ui';

const TIP_COOLDOWN_MS = 10000;

let enabled = true;
let initialized = false;
let lastTipAt = 0;
const shownTips = new Set<string>();

export function setSuggestionsEnabled(value: boolean): void {
	enabled = value;
	void debugInfo('suggestions', value ? 'Suggestions enabled.' : 'Suggestions disabled.', {
		enabled,
	});
}

function isTrustedMouseClick(event: MouseEvent): boolean {
	return event.isTrusted && event.button === 0 && event.detail > 0;
}

function showTip(key: string, message: string): void {
	if (!enabled || shownTips.has(key)) return;
	const now = Date.now();
	if (now - lastTipAt < TIP_COOLDOWN_MS) return;
	shownTips.add(key);
	lastTipAt = now;
	ui.showNotification(t('Tip'), message, 4200);
}

function getCustomPaletteButtonLabel(target: HTMLElement): string {
	return target
		.closest<HTMLElement>('.customActionVariableButton')
		?.dataset.aaLabel?.trim()
		.toLowerCase() ?? '';
}

function handleClick(event: MouseEvent, getShortcutLabel: () => string): void {
	if (!isTrustedMouseClick(event)) return;
	const target = event.target instanceof HTMLElement ? event.target : null;
	if (!target) return;

	if (
		target.closest(
			'div.editor-layout__resize:nth-child(2) > button:nth-child(2), button[aria-label="Expand"], button[aria-label="Collapse"]'
		)
	) {
		showTip('editorPalette', t('Tip: toggle editor palette with Ctrl+D.'));
		return;
	}

	const customPaletteLabel = getCustomPaletteButtonLabel(target);
	if (
		customPaletteLabel === 'variables' ||
		target.closest('button[data-path="EditorPalette.section.button"][aria-label="Variables"]')
	) {
		showTip('variables', t('Tip: open variables with Alt+V.'));
		return;
	}

	if (
		customPaletteLabel === 'actions' ||
		target.closest(
			'div.editor-palette__accordion button[aria-label="Actions"], button[data-path="EditorPalette.section.button"][aria-label="Actions"]'
		)
	) {
		showTip('actions', t('Tip: open actions with Alt+A.'));
		return;
	}

	if (
		target.closest('#commandPalette, #commandInput, #commandPredictions, .command_prediction-item')
	) {
		showTip(
			'commandPalette',
			t('Tip: open command palette with {shortcut}.', {
				shortcut: getShortcutLabel(),
			})
		);
		return;
	}

	if (palette.isCommandPaletteVisible()) {
		showTip(
			'commandPalette',
			t('Tip: open command palette with {shortcut}.', {
				shortcut: getShortcutLabel(),
			})
		);
	}
}

export function registerMouseClickSuggestions(getShortcutLabel: () => string): void {
	if (initialized) return;
	initialized = true;
	document.addEventListener('click', (e) => handleClick(e, getShortcutLabel), true);
}
