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
let lastHref = '';
let navigationIntervalId: number | null = null;
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

function checkForErrorBadge(): void {
	const errorModal = document.querySelector(ERROR_MODAL_SELECTOR);
	if (!errorModal) return;

	document
		.querySelectorAll(ERROR_BADGE_ICON_SELECTOR)
		.forEach((span) => {
			if (handledBadges.has(span)) return;
			handledBadges.add(span);
			void playBundledSound('error');
		});
}

function checkForDoneBadge(): void {
	const doneModal = document.querySelector(DONE_MODAL_SELECTOR);
	if (!doneModal) return;

	document.querySelectorAll(DONE_BADGE_ICON_SELECTOR).forEach((span) => {
		if (handledBadges.has(span)) return;
		handledBadges.add(span);
		void playBundledSound('done');
	});
}

function observeBadges(): void {
	if (observer || !document.body) return;
	observer = new MutationObserver((mutationsList) => {
		if (!enabled || !shouldRun()) return;
		for (const mutation of mutationsList) {
			if (mutation.type === 'childList' || mutation.type === 'attributes') {
				checkForErrorBadge();
				checkForDoneBadge();
				return;
			}
		}
	});
	observer.observe(document.body, {
		childList: true,
		subtree: true,
		attributes: true,
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

function captureRunButton(attempts = 5): void {
	const runButton = document.querySelector<HTMLButtonElement>(RUN_BUTTON_SELECTOR);
	if (runButton) {
		wireRunButton(runButton);
		return;
	}
	if (attempts > 0) {
		window.setTimeout(() => captureRunButton(attempts - 1), 3000);
	}
}

function startNavigationWatch(): void {
	if (navigationIntervalId !== null) return;
	lastHref = document.location.href;
	navigationIntervalId = window.setInterval(() => {
		if (!enabled) return;
		const currentHref = document.location.href;
		if (lastHref === currentHref) return;
		lastHref = currentHref;
		refreshSounds();
	}, 5000);
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
	captureRunButton(5);
}

export function setSoundsEnabled(value: boolean): void {
	enabled = value;
	void debugInfo('sounds', value ? 'Sounds enabled.' : 'Sounds disabled.', { enabled });
	if (enabled) {
		refreshSounds();
		startNavigationWatch();
		return;
	}
	stopObserver();
}
