export type ElementDescription = {
	selector: string;
	xpath: string;
	text: string;
	role: string;
	tag: string;
	accessibleName: string;
	label: string;
	placeholder: string;
	name: string;
	testId: string;
	radioGroup: string;
	optionValue: string;
};

export function summarizeSelectOptions(options: string[], selectedIndex: number) {
	const texts = options.slice(0, 25).map((text) => text.replace(/\s+/g, ' ').trim().slice(0, 120));
	if (selectedIndex >= 25 && selectedIndex < options.length) {
		texts.push(options[selectedIndex].replace(/\s+/g, ' ').trim().slice(0, 120));
	}
	return { texts, optionCount: options.length, optionsTruncated: options.length > texts.length };
}

function cssEscape(value: string): string {
	return CSS.escape(value);
}

function isStableId(id: string): boolean {
	return Boolean(id) && !/\d{5,}/.test(id);
}

function unique(selector: string): boolean {
	try {
		return document.querySelectorAll(selector).length === 1;
	} catch {
		return false;
	}
}

export function buildSelector(element: Element): string {
	const html = element as HTMLElement;
	if (isStableId(html.id)) {
		const selector = `#${cssEscape(html.id)}`;
		if (unique(selector)) return selector;
	}
	for (const attribute of ['data-testid', 'name', 'aria-label']) {
		const value = html.getAttribute(attribute);
		if (!value) continue;
		const selector = `[${attribute}="${cssEscape(value)}"]`;
		if (unique(selector)) return selector;
	}

	const parts: string[] = [];
	for (let current: Element | null = element; current && current !== document.body; current = current.parentElement) {
		let part = current.tagName.toLowerCase();
		const siblings = [...(current.parentElement?.children ?? [])].filter(
			(sibling) => sibling.tagName === current!.tagName
		);
		if (siblings.length > 1) part += `:nth-of-type(${siblings.indexOf(current) + 1})`;
		parts.unshift(part);
		const selector = parts.join(' > ');
		if (unique(selector)) return selector;
	}
	return parts.join(' > ');
}

export function buildXPath(element: Element): string {
	const parts: string[] = [];
	for (let current: Element | null = element; current; current = current.parentElement) {
		const siblings = current.parentElement
			? [...current.parentElement.children].filter((sibling) => sibling.tagName === current!.tagName)
			: [];
		const index = siblings.length > 1 ? `[${siblings.indexOf(current) + 1}]` : '';
		parts.unshift(`${current.tagName.toLowerCase()}${index}`);
	}
	return `/${parts.join('/')}`;
}

function labelText(element: Element): string {
	const html = element as HTMLElement;
	return ((html.id
		? document.querySelector(`label[for="${cssEscape(html.id)}"]`)?.textContent
		: html.closest('label')?.textContent) || '').replace(/\s+/g, ' ').trim().slice(0, 240);
}

export function accessibleText(element: Element): string {
	const html = element as HTMLElement;
	return (
		html.getAttribute('aria-label') ||
		html.getAttribute('title') ||
		labelText(element) ||
		(html instanceof HTMLInputElement ? html.placeholder || html.name : '') ||
		html.innerText ||
		html.textContent ||
		''
	)
		.replace(/\s+/g, ' ')
		.trim()
		.slice(0, 240);
}

export function describeElement(element: Element): ElementDescription {
	const html = element as HTMLElement;
	const accessibleName = accessibleText(element);
	return {
		selector: buildSelector(element),
		xpath: buildXPath(element),
		text: accessibleName,
		role: html.getAttribute('role') || html.tagName.toLowerCase(),
		tag: html.tagName.toLowerCase(),
		accessibleName,
		label: labelText(element),
		placeholder: html.getAttribute('placeholder') || '',
		name: html.getAttribute('name') || '',
		testId: html.getAttribute('data-testid') || '',
		radioGroup: html instanceof HTMLInputElement && html.type === 'radio' ? html.name : '',
		optionValue: html instanceof HTMLInputElement && html.type === 'radio' ? html.value : '',
	};
}
