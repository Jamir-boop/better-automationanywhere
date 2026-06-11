const HELP_TIP_ID_PREFIX = 'help-tip-';
const HELP_TIP_MARGIN = 8;
const HELP_TIP_OFFSET = 8;
const HELP_TIP_MAX_WIDTH = 280;

let cleanupHelpTooltips: (() => void) | null = null;

function escapeHelpHtml(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

export function getHelpTipId(id: string): string {
	return `${HELP_TIP_ID_PREFIX}${id}`;
}

export function renderHelpTip(id: string, text: string): string {
	return `<span id="${getHelpTipId(id)}" class="help-tooltip" role="tooltip">${escapeHelpHtml(text)}</span>`;
}

export function createHelpTip(id: string, text: string): HTMLSpanElement {
	const tip = document.createElement('span');
	tip.id = getHelpTipId(id);
	tip.className = 'help-tooltip';
	tip.setAttribute('role', 'tooltip');
	tip.textContent = text;
	return tip;
}

export function setHelpTip(
	element: HTMLElement,
	id: string,
	text: string
): HTMLSpanElement {
	element.classList.add('help-anchor');
	element.setAttribute('aria-describedby', getHelpTipId(id));
	return createHelpTip(id, text);
}

export function initializeHelpTooltips(root: Document | HTMLElement = document): () => void {
	cleanupHelpTooltips?.();

	const ownerDocument = root instanceof Document ? root : root.ownerDocument;
	const ownerWindow = ownerDocument.defaultView ?? window;
	let activeTrigger: HTMLElement | null = null;
	let activeTooltip: HTMLElement | null = null;
	let activeFrame = 0;
	let suppressFocusTrigger: HTMLElement | null = null;
	let suppressFocusUntil = 0;

	function contains(node: Node): boolean {
		return root instanceof Document ? root.contains(node) : root.contains(node);
	}

	function getTooltip(trigger: HTMLElement): HTMLElement | null {
		const describedBy = trigger.getAttribute('aria-describedby') ?? '';
		for (const id of describedBy.split(/\s+/)) {
			if (!id.startsWith(HELP_TIP_ID_PREFIX)) continue;
			const tooltip = ownerDocument.getElementById(id);
			if (tooltip instanceof HTMLElement && tooltip.classList.contains('help-tooltip')) {
				return tooltip;
			}
		}
		return null;
	}

	function getTrigger(target: EventTarget | null): HTMLElement | null {
		if (!(target instanceof Element)) return null;
		const direct = target.closest<HTMLElement>('[aria-describedby]');
		if (direct && contains(direct) && getTooltip(direct)) return direct;
		const wrapper = target.closest<HTMLElement>('.help-wrapper');
		const wrapped = wrapper?.querySelector<HTMLElement>(
			`[aria-describedby*="${HELP_TIP_ID_PREFIX}"]`
		);
		return wrapped && contains(wrapped) && getTooltip(wrapped) ? wrapped : null;
	}

	function getHoverScope(trigger: HTMLElement): HTMLElement {
		return trigger.closest<HTMLElement>('.help-wrapper') ?? trigger;
	}

	function clamp(value: number, min: number, max: number): number {
		return Math.min(Math.max(value, min), Math.max(min, max));
	}

	function hideTooltip(): void {
		if (activeFrame) {
			ownerWindow.cancelAnimationFrame(activeFrame);
			activeFrame = 0;
		}
		activeTooltip?.classList.remove('is-visible');
		activeTooltip?.removeAttribute('data-placement');
		activeTrigger = null;
		activeTooltip = null;
	}

	function positionTooltip(trigger: HTMLElement, tooltip: HTMLElement): void {
		if (!contains(trigger) || !contains(tooltip)) {
			hideTooltip();
			return;
		}

		const availableWidth = Math.max(0, ownerWindow.innerWidth - HELP_TIP_MARGIN * 2);
		tooltip.style.maxWidth = `${Math.min(HELP_TIP_MAX_WIDTH, availableWidth)}px`;
		tooltip.style.left = '0px';
		tooltip.style.top = '0px';

		const triggerRect = trigger.getBoundingClientRect();
		const tooltipRect = tooltip.getBoundingClientRect();
		const maxLeft = ownerWindow.innerWidth - tooltipRect.width - HELP_TIP_MARGIN;
		const maxTop = ownerWindow.innerHeight - tooltipRect.height - HELP_TIP_MARGIN;
		const centeredLeft = triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2;
		const bottomTop = triggerRect.bottom + HELP_TIP_OFFSET;
		const topTop = triggerRect.top - tooltipRect.height - HELP_TIP_OFFSET;
		const hasBottomSpace = bottomTop + tooltipRect.height <= ownerWindow.innerHeight - HELP_TIP_MARGIN;
		const hasTopSpace = topTop >= HELP_TIP_MARGIN;
		const placement = hasBottomSpace || !hasTopSpace ? 'bottom' : 'top';
		const top = placement === 'top' ? topTop : bottomTop;

		tooltip.style.left = `${Math.round(clamp(centeredLeft, HELP_TIP_MARGIN, maxLeft))}px`;
		tooltip.style.top = `${Math.round(clamp(top, HELP_TIP_MARGIN, maxTop))}px`;
		tooltip.dataset.placement = placement;
		tooltip.classList.add('is-visible');
	}

	function showTooltip(trigger: HTMLElement): void {
		const tooltip = getTooltip(trigger);
		if (!tooltip) return;
		if (activeTrigger !== trigger) hideTooltip();
		activeTrigger = trigger;
		activeTooltip = tooltip;
		activeTooltip.classList.remove('is-visible');
		activeFrame = ownerWindow.requestAnimationFrame(() => {
			activeFrame = 0;
			positionTooltip(trigger, tooltip);
		});
	}

	const handlePointerOver: EventListener = (event) => {
		const trigger = getTrigger(event.target);
		if (trigger) showTooltip(trigger);
	};

	const handlePointerOut: EventListener = (event) => {
		if (!activeTrigger) return;
		const relatedTarget = (event as PointerEvent).relatedTarget;
		if (relatedTarget instanceof Node && getHoverScope(activeTrigger).contains(relatedTarget)) {
			return;
		}
		hideTooltip();
	};

	const handleFocusIn: EventListener = (event) => {
		const trigger = getTrigger(event.target);
		if (!trigger) return;
		if (trigger === suppressFocusTrigger && Date.now() < suppressFocusUntil) return;
		showTooltip(trigger);
	};

	const handleFocusOut: EventListener = () => {
		hideTooltip();
	};

	const handlePointerDown: EventListener = (event) => {
		const trigger = getTrigger(event.target);
		if (!trigger) return;
		suppressFocusTrigger = trigger;
		suppressFocusUntil = Date.now() + 250;
		hideTooltip();
	};

	const handleKeyDown: EventListener = (event) => {
		if ((event as KeyboardEvent).key === 'Escape') hideTooltip();
	};

	root.addEventListener('pointerover', handlePointerOver, true);
	root.addEventListener('pointerout', handlePointerOut, true);
	root.addEventListener('focusin', handleFocusIn, true);
	root.addEventListener('focusout', handleFocusOut, true);
	root.addEventListener('pointerdown', handlePointerDown, true);
	root.addEventListener('keydown', handleKeyDown, true);
	ownerDocument.addEventListener('scroll', hideTooltip, true);
	ownerDocument.addEventListener('visibilitychange', hideTooltip);
	ownerWindow.addEventListener('resize', hideTooltip);

	cleanupHelpTooltips = () => {
		hideTooltip();
		root.removeEventListener('pointerover', handlePointerOver, true);
		root.removeEventListener('pointerout', handlePointerOut, true);
		root.removeEventListener('focusin', handleFocusIn, true);
		root.removeEventListener('focusout', handleFocusOut, true);
		root.removeEventListener('pointerdown', handlePointerDown, true);
		root.removeEventListener('keydown', handleKeyDown, true);
		ownerDocument.removeEventListener('scroll', hideTooltip, true);
		ownerDocument.removeEventListener('visibilitychange', hideTooltip);
		ownerWindow.removeEventListener('resize', hideTooltip);
		cleanupHelpTooltips = null;
	};

	return cleanupHelpTooltips;
}
