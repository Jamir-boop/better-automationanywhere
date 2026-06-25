import {
	formatRgbaColorMix,
	type RgbColor,
} from './background-colors';

const RUN_BUTTON_SELECTOR =
	'button[aria-label="Run"][name="run"], button[name="run"]';
const STYLE_TAG_ID = 'better-aa-run-button-animation-style';
const PULSE_LAYER_ID = 'better-aa-run-button-pulse-layer';
const RUN_BUTTON_HOST_CLASS = 'better-aa-run-button-host';
const RUN_PRIMARY_RGB_VAR = '--better-aa-background-color-3-rgb';
const RUN_SECONDARY_RGB_VAR = '--better-aa-background-color-1-rgb';
const DEFAULT_RUN_COLOR: RgbColor = { red: 182, green: 182, blue: 182 };

export const BURST_ALPHAS = [1, 0.72, 0.44, 0.2];
export const BURST_GAP_MS = 120;
export const BURST_INTERVAL_MS = 2400;
export const RING_WIDTH_PX = 300;
export const PIXEL_SIZE = 40;
export const SEGMENTS = 5;
const PULSE_DURATION_MS = 3200;

function parseRgbChannels(value: string): RgbColor | null {
	const channels = value.split(',').map((part) => Number(part.trim()));
	if (
		channels.length !== 3 ||
		channels.some((channel) => !Number.isFinite(channel))
	) {
		return null;
	}
	const [red, green, blue] = channels;
	return { red, green, blue };
}

function getCssRgbColor(name: string): RgbColor {
	if (typeof document === 'undefined') return DEFAULT_RUN_COLOR;
	const value = getComputedStyle(document.documentElement).getPropertyValue(name);
	return parseRgbChannels(value) ?? DEFAULT_RUN_COLOR;
}

export function getGradientColor(
	t: number,
	alpha: number,
	primary: RgbColor = getCssRgbColor(RUN_PRIMARY_RGB_VAR),
	secondary: RgbColor = getCssRgbColor(RUN_SECONDARY_RGB_VAR)
): string {
	return formatRgbaColorMix(primary, secondary, t, alpha);
}

function getPulseData(button: HTMLButtonElement): {
	x: number;
	y: number;
	size: number;
} {
	const rect = button.getBoundingClientRect();
	const x = rect.left + rect.width / 2;
	const y = rect.top + rect.height / 2;
	const distances = [
		Math.hypot(x, y),
		Math.hypot(window.innerWidth - x, y),
		Math.hypot(x, window.innerHeight - y),
		Math.hypot(window.innerWidth - x, window.innerHeight - y),
	];
	const radius = Math.max(...distances);
	const size = Math.ceil(radius * 2 + RING_WIDTH_PX + PIXEL_SIZE * 4);
	return { x, y, size };
}

export function getPulseOpacity(progress: number): number {
	const clamped = Math.min(1, Math.max(0, progress));
	if (clamped <= 0.08) return clamped / 0.08;
	if (clamped <= 0.7) return 1 - ((clamped - 0.08) / 0.62) * 0.55;
	return Math.max(0, 0.45 * (1 - (clamped - 0.7) / 0.3));
}

function easePulse(progress: number): number {
	return 1 - (1 - progress) ** 3;
}

function drawPixelRingFrame(
	ctx: CanvasRenderingContext2D,
	canvasSize: number,
	alpha: number,
	progress: number
): void {
	ctx.clearRect(0, 0, canvasSize, canvasSize);

	ctx.lineWidth = Math.max(1, RING_WIDTH_PX / PIXEL_SIZE);
	ctx.lineCap = 'butt';

	const center = canvasSize / 2;
	const maxRadius = center - ctx.lineWidth / 2 - 2;
	const radius = Math.max(ctx.lineWidth / 2, maxRadius * easePulse(progress));

	for (let i = 0; i < SEGMENTS; i += 1) {
		const start = (i / SEGMENTS) * Math.PI * 2;
		const end = ((i + 1) / SEGMENTS) * Math.PI * 2;
		const colorProgress = i / Math.max(1, SEGMENTS - 1);
		ctx.beginPath();
		ctx.strokeStyle = getGradientColor(colorProgress, alpha);
		ctx.arc(center, center, radius, start, end);
		ctx.stroke();
	}
}

function spawnPulseRing(
	button: HTMLButtonElement,
	pulseLayer: HTMLElement,
	alpha: number
): void {
	const { x, y, size } = getPulseData(button);
	const ring = document.createElement('canvas');
	ring.className = 'better-aa-pulse-ring';

	ring.style.setProperty('--pulse-x', `${x}px`);
	ring.style.setProperty('--pulse-y', `${y}px`);
	ring.style.setProperty('--pulse-size', `${size}px`);

	const canvasSize = Math.max(48, Math.ceil(size / PIXEL_SIZE));
	ring.width = canvasSize;
	ring.height = canvasSize;

	const ctx = ring.getContext('2d');
	if (!ctx) return;

	pulseLayer.appendChild(ring);

	const startedAt = performance.now();
	function drawFrame(now: number): void {
		if (!ring.isConnected) return;
		const progress = Math.min(1, (now - startedAt) / PULSE_DURATION_MS);
		ring.style.opacity = String(getPulseOpacity(progress));
		drawPixelRingFrame(ctx!, canvasSize, alpha, progress);
		if (progress < 1) {
			window.requestAnimationFrame(drawFrame);
			return;
		}
		ring.remove();
	}
	window.requestAnimationFrame(drawFrame);
}

function spawnPulseBurst(
	button: HTMLButtonElement,
	pulseLayer: HTMLElement,
	pulseTimeouts: number[]
): void {
	BURST_ALPHAS.forEach((alpha, index) => {
		const timeout = window.setTimeout(() => {
			spawnPulseRing(button, pulseLayer, alpha);
		}, index * BURST_GAP_MS);

		pulseTimeouts.push(timeout);
	});
}

function clearPulseTimeouts(pulseTimeouts: number[]): void {
	for (const timeout of pulseTimeouts) {
		window.clearTimeout(timeout);
	}
	pulseTimeouts.length = 0;
}

function injectStyles(): void {
	if (document.getElementById(STYLE_TAG_ID)) return;

	const style = document.createElement('style');
	style.id = STYLE_TAG_ID;
	style.textContent = `
		/* ── Idle glow + base emphasis ── */
		button[aria-label="Run"][name="run"],
		button[name="run"] {
			position: relative !important;
			z-index: 2147483642 !important;
			overflow: hidden !important;
			isolation: isolate !important;
			transition:
				transform 160ms ease,
				border-color 160ms ease,
				background 160ms ease,
				color 160ms ease,
				box-shadow 160ms ease !important;
			--better-aa-run-color-primary-rgb: var(--better-aa-background-color-3-rgb, 182, 182, 182);
			--better-aa-run-color-secondary-rgb: var(--better-aa-background-color-1-rgb, 182, 182, 182);
			background:
				linear-gradient(
					135deg,
					rgba(var(--better-aa-run-color-primary-rgb), 0.16),
					rgba(var(--better-aa-run-color-secondary-rgb), 0.1)
				),
				#ffffff !important;
			border-color: rgba(var(--better-aa-run-color-primary-rgb), 0.72) !important;
			box-shadow:
				0 0 0 1px rgba(var(--better-aa-run-color-primary-rgb), 0.2),
				0 0 22px rgba(var(--better-aa-run-color-primary-rgb), 0.24),
				0 0 42px rgba(var(--better-aa-run-color-secondary-rgb), 0.16) !important;
		}

		.${RUN_BUTTON_HOST_CLASS} {
			position: relative !important;
			z-index: 2147483642 !important;
		}

		/* ── Sweep fill pseudo-element ── */
		button[aria-label="Run"][name="run"]::before,
		button[name="run"]::before {
			content: "" !important;
			position: absolute !important;
			inset: -1px !important;
			z-index: 0 !important;
			pointer-events: none !important;
			background:
				linear-gradient(
					110deg,
					transparent 0%,
					transparent 22%,
					rgba(var(--better-aa-run-color-primary-rgb), 0.22) 34%,
					rgba(var(--better-aa-run-color-primary-rgb), 0.65) 45%,
					rgba(var(--better-aa-run-color-secondary-rgb), 0.45) 56%,
					rgba(var(--better-aa-run-color-secondary-rgb), 0.35) 66%,
					transparent 78%,
					transparent 100%
				) !important;
			transform: translateX(-130%);
		}

		/* ── Fill overlay pseudo-element ── */
		button[aria-label="Run"][name="run"]::after,
		button[name="run"]::after {
			content: "" !important;
			position: absolute !important;
			inset: 0 !important;
			z-index: 0 !important;
			pointer-events: none !important;
			opacity: 0;
			background:
				linear-gradient(
					135deg,
					rgba(var(--better-aa-run-color-primary-rgb), 0.18),
					rgba(var(--better-aa-run-color-secondary-rgb), 0.18)
				) !important;
		}

		/* ── Lift + glow on hover/focus ── */
		button[aria-label="Run"][name="run"]:hover,
		button[name="run"]:hover,
		button[aria-label="Run"][name="run"]:focus-visible,
		button[name="run"]:focus-visible {
			transform: translateY(-1px) !important;
			background:
				linear-gradient(
					135deg,
					rgba(var(--better-aa-run-color-primary-rgb), 0.22),
					rgba(var(--better-aa-run-color-secondary-rgb), 0.14)
				),
				#ffffff !important;
			border-color: rgba(var(--better-aa-run-color-primary-rgb), 0.85) !important;
			box-shadow:
				0 0 0 1px rgba(var(--better-aa-run-color-primary-rgb), 0.3),
				0 12px 32px rgba(var(--better-aa-run-color-primary-rgb), 0.24),
				0 0 46px rgba(var(--better-aa-run-color-secondary-rgb), 0.24),
				0 0 54px rgba(var(--better-aa-run-color-secondary-rgb), 0.16) !important;
		}

		/* ── Sweep animation on hover/focus ── */
		button[aria-label="Run"][name="run"]:hover::before,
		button[name="run"]:hover::before {
			animation: better-aa-sweep 850ms cubic-bezier(.2,.8,.2,1) both !important;
		}

		/* ── Fill animation on hover/focus ── */
		button[aria-label="Run"][name="run"]:hover::after,
		button[name="run"]:hover::after {
			animation: better-aa-fill 850ms cubic-bezier(.2,.8,.2,1) both !important;
		}

		/* ── Icon pop ── */
		button[aria-label="Run"][name="run"]:hover .rio-icon--icon_play-triangle,
		button[name="run"]:hover .rio-icon--icon_play-triangle {
			animation: better-aa-icon-pop 850ms cubic-bezier(.2,.8,.2,1) both !important;
		}

		/* ── Pulse layer ── */
		#${PULSE_LAYER_ID} {
			position: fixed !important;
			inset: 0 !important;
			pointer-events: none !important;
			overflow: hidden !important;
			z-index: 2147483640 !important;
		}

		/* ── Pulse ring ── */
		.better-aa-pulse-ring {
			position: fixed !important;
			left: var(--pulse-x) !important;
			top: var(--pulse-y) !important;
			width: var(--pulse-size) !important;
			height: var(--pulse-size) !important;
			transform: translate(-50%, -50%);
			opacity: 0;
			image-rendering: pixelated !important;
			image-rendering: crisp-edges !important;
			pointer-events: none !important;
			will-change: opacity !important;
		}

		@keyframes better-aa-sweep {
			from { transform: translateX(-130%); }
			to { transform: translateX(130%); }
		}

		@keyframes better-aa-fill {
			0% { opacity: 0; }
			35% { opacity: 1; }
			100% { opacity: 0.85; }
		}

		@keyframes better-aa-icon-pop {
			0% { transform: scale(1) rotate(0deg); }
			38% { transform: scale(1.22) rotate(-4deg); }
			100% { transform: scale(1) rotate(0deg); }
		}

	`;

	document.head.appendChild(style);
}

function removeStyles(): void {
	const style = document.getElementById(STYLE_TAG_ID);
	if (style) style.remove();
}

function ensurePulseLayer(): HTMLElement {
	let layer = document.getElementById(PULSE_LAYER_ID);
	if (!layer) {
		layer = document.createElement('div');
		layer.id = PULSE_LAYER_ID;
		document.body.appendChild(layer);
	}
	return layer;
}

function removePulseLayer(): void {
	const layer = document.getElementById(PULSE_LAYER_ID);
	if (layer) layer.remove();
}

let activeButton: HTMLButtonElement | null = null;
let activeHost: HTMLElement | null = null;
let pulseLayer: HTMLElement | null = null;
let pulseInterval: number | null = null;
let pulseTimeouts: number[] = [];
let delegatedHandler: ((event: Event) => void) | null = null;
let currentStyleEnabled = false;
let currentWavesEnabled = false;

function getRunButtonHost(button: HTMLButtonElement): HTMLElement | null {
	return button.closest<HTMLElement>('.icon-button, [data-path="IconButton"]');
}

function setActiveRunButton(button: HTMLButtonElement | null): void {
	if (activeButton === button) return;
	activeHost?.classList.remove(RUN_BUTTON_HOST_CLASS);
	activeHost = null;
	activeButton = button;
	if (button) {
		activeHost = getRunButtonHost(button);
		activeHost?.classList.add(RUN_BUTTON_HOST_CLASS);
	}
}

function startPulse(): void {
	if (!activeButton || !pulseLayer) return;
	if (pulseInterval !== null) return;
	spawnPulseBurst(activeButton, pulseLayer, pulseTimeouts);
	pulseInterval = window.setInterval(() => {
		if (activeButton && pulseLayer) {
			spawnPulseBurst(activeButton, pulseLayer, pulseTimeouts);
		}
	}, BURST_INTERVAL_MS);
}

function stopPulse(): void {
	if (pulseInterval !== null) {
		window.clearInterval(pulseInterval);
		pulseInterval = null;
	}
	clearPulseTimeouts(pulseTimeouts);
}

function handleWaveEvent(event: Event): void {
	const target = event.target as Element | null;
	if (!target) return;

	const matchedButton = target.matches(RUN_BUTTON_SELECTOR)
		? target
		: target.closest(RUN_BUTTON_SELECTOR);

	if (!(matchedButton instanceof HTMLButtonElement)) return;
	if (
		!matchedButton.matches(
			'button[aria-label="Run"][name="run"], button[name="run"]'
		)
	)
		return;

	if (activeButton !== matchedButton) {
		stopPulse();
		setActiveRunButton(matchedButton);
	}

	if (event.type === 'pointerover') {
		startPulse();
		return;
	}

	if (
		event instanceof PointerEvent &&
		event.relatedTarget instanceof Node &&
		matchedButton.contains(event.relatedTarget)
	) {
		return;
	}
	stopPulse();
}

export function setRunButtonAnimationEnabled(
	nextStyleEnabled: boolean,
	nextWavesEnabled: boolean
): void {
	if (
		currentStyleEnabled === nextStyleEnabled &&
		currentWavesEnabled === nextWavesEnabled
	)
		return;

	if (nextStyleEnabled) {
		injectStyles();
		if (nextWavesEnabled) {
			pulseLayer = ensurePulseLayer();
			if (!delegatedHandler) {
				delegatedHandler = handleWaveEvent;
				document.addEventListener('pointerover', delegatedHandler, true);
				document.addEventListener('pointerout', delegatedHandler, true);
			}
		} else {
			if (delegatedHandler) {
				document.removeEventListener('pointerover', delegatedHandler, true);
				document.removeEventListener('pointerout', delegatedHandler, true);
				delegatedHandler = null;
			}
			stopPulse();
			removePulseLayer();
			pulseLayer = null;
		}
	} else {
		if (delegatedHandler) {
			document.removeEventListener('pointerover', delegatedHandler, true);
			document.removeEventListener('pointerout', delegatedHandler, true);
			delegatedHandler = null;
		}
		stopPulse();
		removePulseLayer();
		pulseLayer = null;
		setActiveRunButton(null);
		removeStyles();
	}

	currentStyleEnabled = nextStyleEnabled;
	currentWavesEnabled = nextWavesEnabled;
}
