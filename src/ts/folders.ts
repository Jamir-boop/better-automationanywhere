const ACTIVE_FOLDER_SELECTOR = '.folder-list-item--is_active';
const SCROLL_DEBOUNCE_MS = 100;

let autoScrollEnabled = false;
let observer: MutationObserver | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let lastScrollKey = '';

function getActiveFolder(): HTMLElement | null {
	const element = document.querySelector(ACTIVE_FOLDER_SELECTOR);
	return element instanceof HTMLElement ? element : null;
}

function getActiveFolderKey(element: HTMLElement): string {
	const link =
		element.closest<HTMLAnchorElement>('a[href]') ??
		element.querySelector<HTMLAnchorElement>('a[href]');
	const identifier =
		link?.href ||
		element.getAttribute('data-id') ||
		element.getAttribute('data-path') ||
		element.textContent?.trim() ||
		ACTIVE_FOLDER_SELECTOR;
	return `${location.href}\n${identifier}`;
}

function getScrollBehavior(): ScrollBehavior {
	return window.matchMedia('(prefers-reduced-motion: reduce)').matches
		? 'auto'
		: 'smooth';
}

function scrollToActiveFolder(): void {
	if (!autoScrollEnabled) return;
	const activeFolder = getActiveFolder();
	if (!activeFolder) return;

	const scrollKey = getActiveFolderKey(activeFolder);
	if (scrollKey === lastScrollKey) return;
	lastScrollKey = scrollKey;

	activeFolder.scrollIntoView({
		behavior: getScrollBehavior(),
		block: 'center',
		inline: 'center',
	});
}

function scheduleScrollToActiveFolder(): void {
	if (!autoScrollEnabled) return;
	if (debounceTimer) clearTimeout(debounceTimer);
	debounceTimer = setTimeout(() => {
		debounceTimer = null;
		requestAnimationFrame(scrollToActiveFolder);
	}, SCROLL_DEBOUNCE_MS);
}

function observeFolderChanges(): void {
	if (observer || !document.body) return;
	observer = new MutationObserver(scheduleScrollToActiveFolder);
	observer.observe(document.body, {
		childList: true,
		subtree: true,
		attributes: true,
		attributeFilter: ['class', 'href', 'data-id', 'data-path'],
	});
}

function stopFolderObserver(): void {
	observer?.disconnect();
	observer = null;
	if (debounceTimer) {
		clearTimeout(debounceTimer);
		debounceTimer = null;
	}
}

export function setScrollableFoldersAutoScrollEnabled(enabled: boolean): void {
	if (autoScrollEnabled === enabled) {
		if (enabled) scheduleScrollToActiveFolder();
		return;
	}

	autoScrollEnabled = enabled;
	if (!enabled) {
		stopFolderObserver();
		lastScrollKey = '';
		return;
	}

	observeFolderChanges();
	scheduleScrollToActiveFolder();
}
