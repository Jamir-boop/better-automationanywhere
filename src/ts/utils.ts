import { debugWarn } from './debug';
import {
	EDITOR_PALETTE_TOGGLE_QUERY_SELECTOR,
	TASKBOT_EDITOR_LAYOUT_SELECTOR,
} from './automation-anywhere-selectors';

interface SelectorDebugOptions {
	feedback?: boolean;
	message?: string;
	source?: string;
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

// ponytail: extension-owned markup; build DOM manually if validator flags parsing.
export function htmlToFragment(html: string): DocumentFragment {
	const doc = new DOMParser().parseFromString(html, 'text/html');
	const fragment = document.createDocumentFragment();
	for (const node of Array.from(doc.body.childNodes)) {
		fragment.appendChild(document.importNode(node, true));
	}
	return fragment;
}

export function replaceChildrenFromHtml(element: Element, html: string): void {
	element.replaceChildren(htmlToFragment(html));
}

export function normalizeCommandText(value: unknown): string {
	return String(value || '')
		.replace(/[-_]+/g, ' ')
		.replace(/\s+/g, ' ')
		.trim()
		.toLowerCase();
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
		TASKBOT_EDITOR_LAYOUT_SELECTOR,
		'getPaletteState'
	) as HTMLElement | null;
	if (!paletteElement) return 'closed';
	return paletteElement.offsetWidth <= 8 ? 'closed' : 'opened';
}

export function toggleToolbar(): void {
	void clickIfExists(EDITOR_PALETTE_TOGGLE_QUERY_SELECTOR, 'toggleToolbar');
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
