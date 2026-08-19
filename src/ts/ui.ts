import * as commands from './commands';
import { debugWarn } from './debug';
import { t } from './i18n';
import { setContentIconButton } from './content-icons';
import type { BetterAaIconName } from './icons';
import {
	ACTIVE_EDITOR_PALETTE_LABEL_SELECTOR,
	EDITOR_PALETTE_SCROLLER_SELECTOR,
	MAIN_NAVIGATION_SELECTOR,
	PATHFINDER_COLLAPSE_BUTTON_SELECTOR,
	PATHFINDER_COLLAPSED_SELECTOR,
	PATHFINDER_EXPANDER_SELECTOR,
	TASKBOT_EDITOR_LAYOUT_SELECTOR,
} from './automation-anywhere-selectors';

const NOTIFICATION_MIN_DURATION_MS = 8000;
const PATHFINDER_COLLAPSE_WAIT_TIMEOUT_MS = 10_000;
const DISABLED_PATHFINDER_EXPANDER_ATTR = 'data-better-aa-disabled-expander';
const ORIGINAL_PATHFINDER_EXPANDER_TITLE_ATTR =
	'data-better-aa-original-title';
const ORIGINAL_PATHFINDER_EXPANDER_ARIA_LABEL_ATTR =
	'data-better-aa-original-aria-label';
const PATHFINDER_EXPANDER_DISABLED_MESSAGE =
	'Disabled because Better AA Slim sidebar is enabled.';

let customEditorPaletteButtonsEnabled = true;
let pathFinderSlimSidebarEnabled = false;
let pathFinderExpanderGuardInstalled = false;
let pathFinderCollapseObserver: MutationObserver | null = null;
let pathFinderCollapseObserverRoot: Node | null = null;
let pathFinderCollapseObserverTimer: ReturnType<typeof setTimeout> | null = null;
let pathFinderCollapseWaitExpired = false;
let allowPathFinderExpanderClick = false;
let customEditorPaletteButtonsHoverRecoveryInstalled = false;

const EDITOR_PALETTE_ICONS: Record<string, BetterAaIconName> = {
	Variables: 'variable',
	Actions: 'workflow',
	Triggers: 'zap',
};

export function setCustomEditorPaletteButtonsEnabled(enabled: boolean): void {
	customEditorPaletteButtonsEnabled = enabled;
	syncCustomEditorPaletteButtons();
}

export function syncCustomEditorPaletteButtons(): void {
	installCustomEditorPaletteButtonsHoverRecovery();
	if (customEditorPaletteButtonsEnabled) {
		insertCustomEditorPaletteButtons();
		return;
	}
	removeCustomEditorPaletteButtons();
}

function recoverCustomEditorPaletteButtonsOnHover(event: PointerEvent): void {
	if (!customEditorPaletteButtonsEnabled) return;
	if (!(event.target instanceof Element)) return;
	if (!event.target.closest(EDITOR_PALETTE_SCROLLER_SELECTOR)) return;
	if (document.getElementById('customActionVariableButtons')) {
		updateCustomEditorPaletteButtonLabels();
		return;
	}
	insertCustomEditorPaletteButtons();
}

function installCustomEditorPaletteButtonsHoverRecovery(): void {
	if (customEditorPaletteButtonsHoverRecoveryInstalled) return;
	document.addEventListener('pointerover', recoverCustomEditorPaletteButtonsOnHover, true);
	customEditorPaletteButtonsHoverRecoveryInstalled = true;
}

export function removeCustomEditorPaletteButtons(): void {
	document.getElementById('customActionVariableButtons')?.remove();
}

function getPathFinderExpander(
	target: EventTarget | null
): HTMLButtonElement | null {
	if (!(target instanceof Element)) return null;
	const button = target.closest<HTMLButtonElement>(PATHFINDER_EXPANDER_SELECTOR);
	return button instanceof HTMLButtonElement ? button : null;
}

function disablePathFinderExpander(button: HTMLButtonElement): void {
	if (!button.hasAttribute(DISABLED_PATHFINDER_EXPANDER_ATTR)) {
		button.setAttribute(
			ORIGINAL_PATHFINDER_EXPANDER_TITLE_ATTR,
			button.getAttribute('title') ?? ''
		);
		button.setAttribute(
			ORIGINAL_PATHFINDER_EXPANDER_ARIA_LABEL_ATTR,
			button.getAttribute('aria-label') ?? ''
		);
	}
	const message = t(PATHFINDER_EXPANDER_DISABLED_MESSAGE);
	button.setAttribute(DISABLED_PATHFINDER_EXPANDER_ATTR, 'true');
	button.setAttribute('aria-disabled', 'true');
	button.setAttribute('title', message);
	button.setAttribute('aria-label', message);
}

function restorePathFinderExpander(button: HTMLButtonElement): void {
	if (!button.hasAttribute(DISABLED_PATHFINDER_EXPANDER_ATTR)) return;
	const originalTitle = button.getAttribute(ORIGINAL_PATHFINDER_EXPANDER_TITLE_ATTR);
	const originalAriaLabel = button.getAttribute(
		ORIGINAL_PATHFINDER_EXPANDER_ARIA_LABEL_ATTR
	);
	if (originalTitle) {
		button.setAttribute('title', originalTitle);
	} else {
		button.removeAttribute('title');
	}
	if (originalAriaLabel) {
		button.setAttribute('aria-label', originalAriaLabel);
	} else {
		button.removeAttribute('aria-label');
	}
	button.removeAttribute('aria-disabled');
	button.removeAttribute(DISABLED_PATHFINDER_EXPANDER_ATTR);
	button.removeAttribute(ORIGINAL_PATHFINDER_EXPANDER_TITLE_ATTR);
	button.removeAttribute(ORIGINAL_PATHFINDER_EXPANDER_ARIA_LABEL_ATTR);
}

function syncPathFinderExpanderDisabledState(disabled: boolean): void {
	document.querySelectorAll<HTMLButtonElement>(PATHFINDER_EXPANDER_SELECTOR).forEach(
		(button) => {
			if (disabled) {
				disablePathFinderExpander(button);
				return;
			}
			restorePathFinderExpander(button);
		}
	);
}

function isActivationKey(event: KeyboardEvent): boolean {
	return event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar';
}

function blockPathFinderExpanderEvent(event: Event): void {
	if (!pathFinderSlimSidebarEnabled || allowPathFinderExpanderClick) return;
	if (event instanceof KeyboardEvent && !isActivationKey(event)) return;
	const button = getPathFinderExpander(event.target);
	if (!button) return;
	disablePathFinderExpander(button);
	event.preventDefault();
	event.stopImmediatePropagation();
	removeInlineWidth();
}

function refreshPathFinderExpanderState(event: Event): void {
	if (!pathFinderSlimSidebarEnabled) return;
	const button = getPathFinderExpander(event.target);
	if (button) disablePathFinderExpander(button);
}

function installPathFinderExpanderGuard(): void {
	if (pathFinderExpanderGuardInstalled) return;
	document.addEventListener('pointerover', refreshPathFinderExpanderState, true);
	document.addEventListener('focusin', refreshPathFinderExpanderState, true);
	document.addEventListener('pointerdown', blockPathFinderExpanderEvent, true);
	document.addEventListener('mousedown', blockPathFinderExpanderEvent, true);
	document.addEventListener('click', blockPathFinderExpanderEvent, true);
	document.addEventListener('keydown', blockPathFinderExpanderEvent, true);
	document.addEventListener('keyup', blockPathFinderExpanderEvent, true);
	pathFinderExpanderGuardInstalled = true;
}

function stopPathFinderCollapseObserver(): void {
	pathFinderCollapseObserver?.disconnect();
	pathFinderCollapseObserver = null;
	pathFinderCollapseObserverRoot = null;
	if (pathFinderCollapseObserverTimer) {
		clearTimeout(pathFinderCollapseObserverTimer);
		pathFinderCollapseObserverTimer = null;
	}
}

function observePathFinderCollapseRoot(root: Node, scoped: boolean): void {
	pathFinderCollapseObserver?.disconnect();
	pathFinderCollapseObserver?.observe(root, {
		childList: true,
		subtree: true,
		...(scoped
			? {
					attributes: true,
					attributeFilter: ['class', 'aria-expanded'],
				}
			: {}),
	});
	pathFinderCollapseObserverRoot = root;
}

function syncWaitingPathFinderCollapseControl(): void {
	if (!pathFinderSlimSidebarEnabled) {
		stopPathFinderCollapseObserver();
		return;
	}

	const navigation = document.querySelector(MAIN_NAVIGATION_SELECTOR);
	if (navigation && pathFinderCollapseObserverRoot !== navigation) {
		observePathFinderCollapseRoot(navigation, true);
	}
	if (
		!document.querySelector(PATHFINDER_COLLAPSED_SELECTOR) &&
		!document.querySelector(PATHFINDER_COLLAPSE_BUTTON_SELECTOR)
	) {
		return;
	}

	stopPathFinderCollapseObserver();
	syncPathFinderSlimSidebar(true);
}

function waitForPathFinderCollapseControl(): void {
	if (pathFinderCollapseObserver || pathFinderCollapseWaitExpired) return;
	pathFinderCollapseObserver = new MutationObserver(syncWaitingPathFinderCollapseControl);
	pathFinderCollapseObserverTimer = setTimeout(() => {
		pathFinderCollapseWaitExpired = true;
		stopPathFinderCollapseObserver();
	}, PATHFINDER_COLLAPSE_WAIT_TIMEOUT_MS);
	const navigation = document.querySelector(MAIN_NAVIGATION_SELECTOR);
	observePathFinderCollapseRoot(navigation ?? document.documentElement, Boolean(navigation));
}

export function syncPathFinderSlimSidebar(enabled: boolean): void {
	const enabling = enabled && !pathFinderSlimSidebarEnabled;
	pathFinderSlimSidebarEnabled = enabled;
	installPathFinderExpanderGuard();
	if (!enabled) {
		pathFinderCollapseWaitExpired = false;
		stopPathFinderCollapseObserver();
		syncPathFinderExpanderDisabledState(false);
		return;
	}
	if (enabling) pathFinderCollapseWaitExpired = false;
	if (!removeInlineWidth()) {
		waitForPathFinderCollapseControl();
		return;
	}
	pathFinderCollapseWaitExpired = false;
	stopPathFinderCollapseObserver();
	syncPathFinderExpanderDisabledState(true);
	setTimeout(() => syncPathFinderExpanderDisabledState(true), 600);
}

export function updateCustomEditorPaletteButtonLabels(): void {
	document
		.querySelectorAll<HTMLButtonElement>('#customActionVariableButtons button')
		.forEach((button) => {
			const label = button.dataset.aaLabel;
			if (!label) return;
			setContentIconButton(button, EDITOR_PALETTE_ICONS[label], t(label));
		});
}

export function insertCustomEditorPaletteButtons(): void {
	if (document.getElementById('customActionVariableButtons')) {
		updateCustomEditorPaletteButtonLabels();
		return;
	}
	const containerDiv = document.createElement('div');
	containerDiv.id = 'customActionVariableButtons';

	const variableButton = document.createElement('button');
	variableButton.className = 'customActionVariableButton';
	variableButton.dataset.aaLabel = 'Variables';
	setContentIconButton(variableButton, 'variable', t('Variables'));
	variableButton.onclick = () => {
		void commands.showVariables();
		updateActiveButton();
	};

	const actionButton = document.createElement('button');
	actionButton.className = 'customActionVariableButton';
	actionButton.dataset.aaLabel = 'Actions';
	setContentIconButton(actionButton, 'workflow', t('Actions'));
	actionButton.onclick = () => {
		void commands.showActions();
		updateActiveButton();
	};

	const triggerButton = document.createElement('button');
	triggerButton.className = 'customActionVariableButton';
	triggerButton.dataset.aaLabel = 'Triggers';
	setContentIconButton(triggerButton, 'zap', t('Triggers'));
	triggerButton.onclick = () => {
		commands.showTriggers();
		updateActiveButton();
	};

	containerDiv.appendChild(variableButton);
	containerDiv.appendChild(actionButton);
	containerDiv.appendChild(triggerButton);

	const palette = document.querySelector(TASKBOT_EDITOR_LAYOUT_SELECTOR);
	if (palette) {
		palette.appendChild(containerDiv);
	}
}

export function removeInlineWidth(): boolean {
	const nav = document.querySelector<HTMLElement>(MAIN_NAVIGATION_SELECTOR);
	const pathfinderCollapsed = document.querySelector(PATHFINDER_COLLAPSED_SELECTOR);
	if (pathfinderCollapsed) {
		nav?.style.removeProperty('width');
		return true;
	}
	const collapseButton = document.querySelector<HTMLElement>(
		PATHFINDER_COLLAPSE_BUTTON_SELECTOR
	);
	if (collapseButton) {
		allowPathFinderExpanderClick = true;
		try {
			collapseButton.click();
		} finally {
			allowPathFinderExpanderClick = false;
		}
		setTimeout(() => {
			nav?.style.removeProperty('width');
		}, 500);
		return true;
	} else {
		void debugWarn('selector', 'Collapse button not found.', {
			selector: PATHFINDER_COLLAPSE_BUTTON_SELECTOR,
		}, { feedback: true });
		return false;
	}
}

export function updateActiveButton(): void {
	const activeSection = document.querySelector<HTMLElement>(
		ACTIVE_EDITOR_PALETTE_LABEL_SELECTOR
	)?.innerText;
	const buttons = document.querySelectorAll('.customActionVariableButton');
	buttons.forEach((button) => {
		button.classList.toggle(
			'buttonToolbarActive',
			(button as HTMLElement).dataset.aaLabel === activeSection
		);
	});
}

function getNotificationTray(): Element {
	let host = document.getElementById('better-aa-toast-host');
	if (!host) {
		host = document.createElement('div');
		host.id = 'better-aa-toast-host';
		const trayOuter = document.createElement('div');
		trayOuter.className = 'main-layout__toast-tray';
		const trayMiddle = document.createElement('div');
		trayMiddle.className = 'mainlayouttoasttray';
		const tray = document.createElement('div');
		tray.className = 'toasttray';
		tray.dataset.path = 'ToastTray';
		trayMiddle.appendChild(tray);
		trayOuter.appendChild(trayMiddle);
		host.appendChild(trayOuter);
		document.body.appendChild(host);
	}
	return host.querySelector('.toasttray') ?? host;
}

export function showNotification(
	title: string,
	message: string | readonly string[] = '',
	duration = NOTIFICATION_MIN_DURATION_MS
): void {
	const tray = getNotificationTray();
	const toastWrapper = document.createElement('div');
	toastWrapper.className = 'toasttray-toast';
	const toast = document.createElement('div');
	toast.dataset.path = 'Toast';
	toast.className = 'toast g-reset-element g-box-sizing_border-box toast--closable';
	const content = document.createElement('div');
	content.className = 'toast-content';

	if (title) {
		const titleEl = document.createElement('div');
		titleEl.className = 'toast-title';
		titleEl.textContent = title;
		content.appendChild(titleEl);
	}

	const messageItems = typeof message === 'string' ? null : message;
	if (messageItems ? messageItems.length : message) {
		const messageEl = document.createElement(messageItems ? 'ul' : 'div');
		messageEl.className = messageItems
			? 'toast-message toast-message-list'
			: 'toast-message';
		if (messageItems) {
			for (const item of messageItems) {
				const row = document.createElement('li');
				row.textContent = item;
				messageEl.appendChild(row);
			}
		} else {
			messageEl.textContent = typeof message === 'string' ? message : '';
		}
		content.appendChild(messageEl);
	}

	const closeButton = document.createElement('button');
	closeButton.type = 'button';
	closeButton.setAttribute('aria-label', t('Close notification'));
	closeButton.title = t('Close notification');
	closeButton.className = 'toast-close';
	setContentIconButton(closeButton, 'x');
	toast.append(content, closeButton);
	toastWrapper.appendChild(toast);

	let closeTimer: ReturnType<typeof setTimeout> | null = null;
	const close = () => {
		if (!toastWrapper.isConnected) return;
		if (closeTimer !== null) {
			clearTimeout(closeTimer);
			closeTimer = null;
		}
		toastWrapper.remove();
	};
	const clearCloseTimer = () => {
		if (closeTimer === null) return;
		clearTimeout(closeTimer);
		closeTimer = null;
	};
	const scheduleClose = () => {
		clearCloseTimer();
		closeTimer = setTimeout(close, Math.max(duration, NOTIFICATION_MIN_DURATION_MS));
	};

	closeButton.addEventListener('click', close);
	toast.addEventListener('mouseenter', clearCloseTimer);
	toast.addEventListener('mouseleave', close);
	tray.prepend(toastWrapper);
	scheduleClose();
}
