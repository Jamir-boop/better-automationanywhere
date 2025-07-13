import { showActions, showVariables } from './commands';
import * as palette from './palette';
import * as ui from './ui';

export function sleep(ms: number): Promise<void> {
	return new Promise(resolve => setTimeout(resolve, ms));
}

export function safeQuery(selector: string, context = ""): Element | null {
	const el = document.querySelector(selector);
	if (!el) {
		console.warn(`Element not found: ${selector}${context ? " (" + context + ")" : ""}`);
	}
	return el;
}

export function safeAddClick(el: HTMLElement | null, handler: (event: MouseEvent) => void): void {
	if (el) el.addEventListener("click", handler);
}

export function waitForElement(selector: string, timeout = 5000): Promise<Element | null> {
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
			resolve(null);
		}, timeout);
	});
}

export function getPaletteState(): "opened" | "closed" {
	const paletteElement = safeQuery(".editor-layout__palette", "getPaletteState") as HTMLElement | null;
	if (!paletteElement) return "closed";
	return paletteElement.offsetWidth <= 8 ? "closed" : "opened";
}

export function registerKeyboardShortcuts(): void {
	document.addEventListener("keydown", function(e) {
		if (e.altKey && e.key === "p") {
			e.preventDefault();
			ui.insertCustomEditorPaletteButtons();
			palette.togglePaletteVisibility();
		}
	});

	document.addEventListener("keydown", function(e) {
		if (e.code === "KeyA" && e.altKey) {
			showActions();
			e.preventDefault();
		}
	});

	document.addEventListener("keydown", function(e) {
		if (e.code === "KeyV" && e.altKey) {
			showVariables();
			e.preventDefault();
		}
	});

	document.addEventListener("keydown", function(e) {
		if (e.ctrlKey && e.code === "KeyD") {
			toggleToolbar();
			e.preventDefault();
		}
	});
}

export function toggleToolbar(): void {
	clickIfExists("div.editor-layout__resize:nth-child(2) > button:nth-child(2)");
}

/**
 * Tries to find a DOM element by selector and click it.
 * If not found, retries once after 100ms.
 * Logs a warning if still not found.
 */
export async function clickIfExists(
	selector: string,
	context?: string,
	retry = true
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
		} else {
			console.warn(
				`[clickIfExists] Element not found: ${selector}${context ? ` (${context})` : ''} (after retry)`
			);
		}
	} else {
		console.warn(
			`[clickIfExists] Element not found: ${selector}${context ? ` (${context})` : ''}`
		);
	}
}

export function ensureEnglishLocale(): void {
  const lng = localStorage.getItem('i18nextLng');
  if (lng !== 'en-US') {
    ui.showToast(
      "For correct functioning of this extension, the language will be set to English (en-US). The page will reload.",
      'warning',
      3600
    );
    localStorage.setItem('i18nextLng', 'en-US');
    setTimeout(() => window.location.reload(), 1800);
  }
}