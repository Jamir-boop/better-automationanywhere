export function findBackdropNear(
	element: HTMLElement,
	selector: string
): HTMLElement | null {
	const previousSibling = element.previousElementSibling;
	if (previousSibling instanceof HTMLElement && previousSibling.matches(selector)) {
		return previousSibling;
	}

	const nextSibling = element.nextElementSibling;
	if (nextSibling instanceof HTMLElement && nextSibling.matches(selector)) {
		return nextSibling;
	}

	const parent = element.parentElement;
	if (!parent) return null;
	const children = Array.from(parent.children);
	const elementIndex = children.indexOf(element);
	if (elementIndex < 0) return null;

	for (let index = elementIndex - 1; index >= 0; index -= 1) {
		const child = children[index];
		if (child instanceof HTMLElement && child.matches(selector)) return child;
	}

	for (const child of children.slice(elementIndex + 1)) {
		if (child instanceof HTMLElement && child.matches(selector)) return child;
	}
	return null;
}

export function findBotExecutionModalDialog(
	modal: HTMLElement,
	selector: string
): HTMLElement | null {
	return modal.closest<HTMLElement>(selector) ?? modal.querySelector<HTMLElement>(selector);
}

export function findBotExecutionModalControlHost(
	modal: HTMLElement,
	selectors: readonly string[]
): HTMLElement | null {
	for (const selector of selectors) {
		const host = modal.querySelector<HTMLElement>(selector);
		if (host) return host;
	}
	return null;
}
