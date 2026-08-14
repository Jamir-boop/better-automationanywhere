import { isTaskEditorUrl } from './automation-anywhere';
import {
	DONE_BADGE_ICON_SELECTOR,
	DONE_MODAL_SELECTOR,
	ERROR_BADGE_ICON_SELECTOR,
	ERROR_MODAL_SELECTOR,
	RUN_BUTTON_SELECTOR,
} from './automation-anywhere-selectors';
import { debugInfo, debugWarn } from './debug';

let enabled = false;
let observer: MutationObserver | null = null;
const handledBadges = new WeakSet<Element>();
const wiredRunButtons = new WeakSet<HTMLButtonElement>();
const warnedSoundFailures = new Set<SoundAction>();

type SoundAction = 'run' | 'error' | 'done';

const SOUND_ASSET_PATHS: Record<SoundAction, string[]> = {
	run: [
		'sounds/run-10.mp3',
		'sounds/run-14.mp3',
		'sounds/run-15.mp3',
		'sounds/run-16.mp3',
		'sounds/run-17.mp3',
		'sounds/run-18.mp3',
		'sounds/run-1.mp3',
		'sounds/run-24.mp3',
		'sounds/run-3.mp3',
		'sounds/run-5.mp3',
		'sounds/run-6.mp3',
		'sounds/run-9.mp3',
	],
	error: ['sounds/error.mp3'],
	done: ['sounds/done.mp3'],
};

function shouldRun(url = location.href): boolean {
	return isTaskEditorUrl(url);
}

function pickRandom<T>(items: T[]): T | undefined {
	if (!items.length) return undefined;
	return items[Math.floor(Math.random() * items.length)];
}

async function playAudioUrl(url: string): Promise<void> {
	await new Promise<void>((resolve, reject) => {
		const audio = new Audio(url);
		audio.volume = 0.5;
		audio.addEventListener('ended', () => resolve(), { once: true });
		audio.addEventListener('error', () => reject(new Error('Audio playback failed.')), {
			once: true,
		});
		audio.play().catch(reject);
	});
}

async function playBundledSound(action: SoundAction): Promise<boolean> {
	const url = pickRandom(
		SOUND_ASSET_PATHS[action].map((path) => browser.runtime.getURL(path as any))
	);
	if (!url) {
		warnSoundFailure(action);
		return false;
	}
	try {
		await playAudioUrl(url);
		return true;
	} catch (error) {
		warnSoundFailure(action, error);
		return false;
	}
}

function warnSoundFailure(action: SoundAction, error?: unknown): void {
	if (warnedSoundFailures.has(action)) return;
	warnedSoundFailures.add(action);
	void debugWarn('sounds', 'Sound asset unavailable or playback failed.', {
		action,
		error,
	}, { feedback: true });
}

function checkForBadges(
	root: ParentNode,
	modalSelector: string,
	badgeSelector: string,
	action: SoundAction
): void {
	const modals = new Set<Element>();
	if (root instanceof Element) {
		const closest = root.closest(modalSelector);
		if (closest) modals.add(closest);
		if (root.matches(modalSelector)) modals.add(root);
	}
	root.querySelectorAll(modalSelector).forEach((modal) => modals.add(modal));
	for (const modal of modals) {
		modal.querySelectorAll(badgeSelector).forEach((badge) => {
			if (handledBadges.has(badge)) return;
			handledBadges.add(badge);
			void playBundledSound(action);
		});
	}
}

function checkForResultBadges(root: ParentNode = document): void {
	checkForBadges(root, ERROR_MODAL_SELECTOR, ERROR_BADGE_ICON_SELECTOR, 'error');
	checkForBadges(root, DONE_MODAL_SELECTOR, DONE_BADGE_ICON_SELECTOR, 'done');
}

function observeBadges(): void {
	if (observer || !document.body) return;
	observer = new MutationObserver((mutationsList) => {
		if (!enabled || !shouldRun()) return;
		for (const mutation of mutationsList) {
			if (mutation.type === 'attributes') {
				if (mutation.target instanceof Element) {
					checkForResultBadges(mutation.target);
					wireRunButtons(mutation.target);
				}
				continue;
			}
			for (const node of mutation.addedNodes) {
				if (node instanceof Element) {
					checkForResultBadges(node);
					wireRunButtons(node);
				}
			}
		}
	});
	observer.observe(document.body, {
		childList: true,
		subtree: true,
		attributes: true,
		attributeFilter: ['class'],
	});
}

function wireRunButton(runButton: HTMLButtonElement): void {
	if (wiredRunButtons.has(runButton)) return;
	wiredRunButtons.add(runButton);

	runButton.addEventListener(
		'click',
		() => {
			if (enabled && shouldRun()) void playBundledSound('run');
		},
		true
	);
}

function wireRunButtons(root: ParentNode = document): void {
	if (root instanceof HTMLButtonElement && root.matches(RUN_BUTTON_SELECTOR)) {
		wireRunButton(root);
	}
	root.querySelectorAll<HTMLButtonElement>(RUN_BUTTON_SELECTOR).forEach(wireRunButton);
}

function stopObserver(): void {
	observer?.disconnect();
	observer = null;
}

export function refreshSounds(): void {
	if (!enabled || !shouldRun()) {
		stopObserver();
		return;
	}
	observeBadges();
	checkForResultBadges();
	wireRunButtons();
}

export function setSoundsEnabled(value: boolean): void {
	enabled = value;
	void debugInfo('sounds', value ? 'Sounds enabled.' : 'Sounds disabled.', { enabled });
	if (enabled) {
		refreshSounds();
		return;
	}
	stopObserver();
}
