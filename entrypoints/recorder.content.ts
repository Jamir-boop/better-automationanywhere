import { accessibleText, describeElement, summarizeSelectOptions } from '../src/ts/recorder/selector';
import { isRecorderVerb, type RecorderVerb } from '../src/ts/recorder/protocol';

type Target = {
	selector?: string;
	braId?: number | string;
	point?: { x: number; y: number };
};
type Request = { type: string; payload?: Record<string, any> };

const INTERACTIVE = 'a,button,input,select,textarea,[role="button"],[role="link"],[role="textbox"],[onclick],[contenteditable="true"],[tabindex]';

function fail(code: string, message: string): never {
	throw Object.assign(new Error(message), { code });
}

function visible(element: Element): boolean {
	const style = getComputedStyle(element);
	const box = element.getBoundingClientRect();
	return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) > 0 && box.width > 0 && box.height > 0;
}

function resolveSelector(selector: string, kind?: string): Element[] {
	try {
		if (kind === 'xpath' || /^[/(]/.test(selector)) {
			const result = document.evaluate(selector, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
			return Array.from({ length: result.snapshotLength }, (_, index) => result.snapshotItem(index))
				.filter((node): node is Element => node instanceof Element);
		}
		return [...document.querySelectorAll(selector)];
	} catch {
		return [];
	}
}

function resolveTarget(target: Target): Element {
	if (target.braId !== undefined) {
		const element = document.querySelector(`[data-bra-id="${CSS.escape(String(target.braId))}"]`);
		if (element) return element;
	}
	if (target.point) {
		const element = document.elementFromPoint(target.point.x, target.point.y);
		if (element) return element;
	}
	if (target.selector) {
		const element = resolveSelector(target.selector)[0];
		if (element) return element;
	}
	return fail('NO_MATCH', 'Element was not found.');
}

function rect(element: Element) {
	const box = element.getBoundingClientRect();
	return {
		x: Math.round(box.x),
		y: Math.round(box.y),
		width: Math.round(box.width),
		height: Math.round(box.height),
	};
}

let highlightCleanup: (() => void) | undefined;

function highlight(element: Element): void {
	highlightCleanup?.();
	const host = document.createElement('div');
	host.setAttribute('aria-hidden', 'true');
	host.style.cssText = 'all:initial;position:fixed;inset:0;pointer-events:none;z-index:2147483647';
	const shadow = host.attachShadow({ mode: 'closed' });
	const border = document.createElement('div');
	border.style.cssText = 'position:fixed;pointer-events:none;border:3px solid #38bdf8;border-radius:6px;box-shadow:0 0 8px #38bdf8,0 0 20px rgba(56,189,248,.9);transition:all 80ms ease-out;box-sizing:border-box';
	shadow.append(border);
	(document.documentElement || document.body).append(host);
	const update = () => {
		const box = element.getBoundingClientRect();
		border.style.left = `${box.left - 3}px`;
		border.style.top = `${box.top - 3}px`;
		border.style.width = `${box.width + 6}px`;
		border.style.height = `${box.height + 6}px`;
	};
	const cleanup = () => {
		clearTimeout(timer);
		removeEventListener('scroll', update, true);
		removeEventListener('resize', update);
		host.remove();
		if (highlightCleanup === cleanup) highlightCleanup = undefined;
	};
	const timer = setTimeout(cleanup, 1500);
	highlightCleanup = cleanup;
	addEventListener('scroll', update, true);
	addEventListener('resize', update);
	update();
}

function resultFor(element: Element) {
	const targetDescriptor = describeElement(element);
	return { selector: targetDescriptor.selector, xpath: targetDescriptor.xpath, targetDescriptor };
}

function actionable(target: Target): Element {
	const element = resolveTarget(target);
	element.scrollIntoView({ block: 'center', inline: 'center' });
	if (!visible(element)) fail('NOT_VISIBLE', 'Element is not visible.');
	highlight(element);
	return element;
}

function ensureBraId(element: Element): string {
	const html = element as HTMLElement;
	if (html.dataset.braId) return html.dataset.braId;
	const ids = [...document.querySelectorAll<HTMLElement>('[data-bra-id]')]
		.map((candidate) => Number(candidate.dataset.braId) || 0);
	html.dataset.braId = String(Math.max(0, ...ids) + 1);
	return html.dataset.braId;
}

function labelDom(maxChars = 60_000) {
	document.querySelectorAll<HTMLElement>('[data-bra-id]')
		.forEach((element) => element.removeAttribute('data-bra-id'));
	const lines = [
		`URL: ${location.href}`,
		`TITLE: ${document.title.replace(/\s+/g, ' ').trim()}`,
	];
	let length = lines.join('\n').length + 1;
	const elements: Array<Record<string, unknown>> = [];
	for (const element of document.querySelectorAll(INTERACTIVE)) {
		if (!visible(element)) continue;
		const id = elements.length + 1;
		const html = element as HTMLInputElement;
		const description = describeElement(element);
		const options = html instanceof HTMLSelectElement
			? summarizeSelectOptions([...html.options].map((option) => option.text), html.selectedIndex)
			: null;
		const attrs = [
			html.getAttribute('name') && `name=${JSON.stringify(html.getAttribute('name'))}`,
			html.getAttribute('data-testid') && `testid=${JSON.stringify(html.getAttribute('data-testid'))}`,
			html.getAttribute('aria-label') && `aria=${JSON.stringify(html.getAttribute('aria-label'))}`,
			html instanceof HTMLInputElement && `type=${JSON.stringify(html.type)}`,
			html instanceof HTMLInputElement && (html.type === 'checkbox' || html.type === 'radio')
				&& `checked=${html.checked}`,
			html instanceof HTMLInputElement && html.type !== 'password' && `value_present=${Boolean(html.value)}`,
			options && `options=${JSON.stringify(options.texts)} optionCount=${options.optionCount} optionsTruncated=${options.optionsTruncated}`,
		].filter(Boolean).join(' ');
		const box = rect(element);
		const line = `[${id}] <${element.tagName.toLowerCase()}> ${description.role} ${JSON.stringify(description.text)} ${attrs} @(${box.x},${box.y},${box.width},${box.height})`;
		if (length + line.length + 1 > maxChars) continue;
		(element as HTMLElement).dataset.braId = String(id);
		lines.push(line);
		elements.push({
			braId: id,
			selector: description.selector,
			tag: description.tag,
			role: description.role,
			accessibleName: description.accessibleName,
			label: description.label,
			placeholder: description.placeholder,
			name: description.name,
			testId: description.testId,
			radioGroup: description.radioGroup,
			optionValue: description.optionValue,
			type: html instanceof HTMLInputElement ? html.type : '',
			checked: html instanceof HTMLInputElement && (html.type === 'checkbox' || html.type === 'radio')
				? html.checked : undefined,
			selectedText: html instanceof HTMLSelectElement ? html.selectedOptions[0]?.text || '' : undefined,
		});
		length += line.length + 1;
	}
	return {
		dom: lines.join('\n').slice(0, maxChars),
		url: location.href,
		title: document.title,
		text: (document.body?.innerText ?? '').replace(/\s+/g, ' ').trim().slice(0, maxChars),
		braIds: elements.map((element) => element.braId),
		elements,
	};
}

function dispatchMouse(element: Element, type: string, button = 0): void {
	const box = element.getBoundingClientRect();
	element.dispatchEvent(new MouseEvent(type, {
		bubbles: true,
		cancelable: true,
		view: window,
		button,
		clientX: box.left + box.width / 2,
		clientY: box.top + box.height / 2,
	}));
}

function syntheticClick(element: Element, button = 0, double = false): void {
	const count = double ? 2 : 1;
	for (let index = 0; index < count; index += 1) {
		for (const type of ['mousemove', 'mouseover', 'mousedown', 'mouseup']) {
			dispatchMouse(element, type, button);
		}
		dispatchMouse(element, button === 2 ? 'contextmenu' : 'click', button);
	}
	if (double) dispatchMouse(element, 'dblclick', button);
}

const MAX_KEYSTROKE_DELAY_MS = 5000;

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function appendChar(element: Element, char: string): void {
	const input = element as HTMLInputElement | HTMLTextAreaElement;
	if (input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement) {
		Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), 'value')?.set?.call(input, `${input.value}${char}`);
	} else if ((element as HTMLElement).isContentEditable) {
		(element as HTMLElement).textContent = `${(element as HTMLElement).textContent ?? ''}${char}`;
	}
}

/** Official Recorder keystroke semantics: per char keydown -> keypress -> value+=c -> input -> keyup. */
async function typeText(element: Element, value: string, delayMs: number, clear: boolean): Promise<void> {
	const input = element as HTMLInputElement | HTMLTextAreaElement;
	const editable = (element as HTMLElement).isContentEditable;
	if (!(input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement || editable)) {
		fail('NO_MATCH', 'Element cannot accept text.');
	}
	input.focus();
	if (clear) {
		if (input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement) {
			Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), 'value')?.set?.call(input, '');
		} else {
			(element as HTMLElement).textContent = '';
		}
		element.dispatchEvent(new Event('input', { bubbles: true }));
	}
	const delay = Math.min(Math.max(0, delayMs), MAX_KEYSTROKE_DELAY_MS);
	for (const char of value) {
		element.dispatchEvent(new KeyboardEvent('keydown', { key: char, bubbles: true, cancelable: true }));
		element.dispatchEvent(new KeyboardEvent('keypress', { key: char, bubbles: true, cancelable: true }));
		appendChar(element, char);
		element.dispatchEvent(new Event('input', { bubbles: true }));
		element.dispatchEvent(new KeyboardEvent('keyup', { key: char, bubbles: true, cancelable: true }));
		if (delay > 0) await sleep(delay);
	}
	element.dispatchEvent(new Event('change', { bubbles: true }));
}

function currentValue(element: Element): string {
	if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) {
		return element.value;
	}
	return (element as HTMLElement).isContentEditable ? element.textContent || '' : '';
}

function setValue(element: Element, value: string): boolean {
	const input = element as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
	const editable = (element as HTMLElement).isContentEditable;
	if (!(input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement || input instanceof HTMLSelectElement || editable)) {
		fail('NO_MATCH', 'Element cannot accept text.');
	}
	if (currentValue(element) === value) return false;
	input.focus();
	if (input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement) {
		Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), 'value')?.set?.call(input, value);
	} else if (input instanceof HTMLSelectElement) {
		input.value = value;
	} else {
		(element as HTMLElement).textContent = value;
	}
	input.dispatchEvent(new Event('input', { bubbles: true }));
	input.dispatchEvent(new Event('change', { bubbles: true }));
	return true;
}

function isPassword(element: Element): boolean {
	return element instanceof HTMLInputElement && element.type.toLowerCase() === 'password';
}

function checked(element: Element): boolean {
	if (element instanceof HTMLInputElement && (element.type === 'checkbox' || element.type === 'radio')) return element.checked;
	const aria = element.getAttribute('aria-checked');
	if (aria !== null) return aria === 'true';
	return fail('NO_MATCH', 'Element is not a checkbox or radio button.');
}

function setChecked(element: Element, desired?: boolean): { status: boolean; changed: boolean } {
	const before = checked(element);
	const target = desired ?? !before;
	if (before === target) return { status: target, changed: false };
	let changeFired = false;
	element.addEventListener('change', () => { changeFired = true; }, { once: true });
	syntheticClick(element);
	if (checked(element) !== target) {
		if (element instanceof HTMLInputElement) element.checked = target;
		else element.setAttribute('aria-checked', String(target));
		element.dispatchEvent(new Event('input', { bubbles: true }));
	}
	if (!changeFired) element.dispatchEvent(new Event('change', { bubbles: true }));
	return { status: target, changed: true };
}

function selectItem(element: Element, value: unknown, byIndex: boolean): { text: string; changed: boolean } {
	if (!(element instanceof HTMLSelectElement)) fail('NO_MATCH', 'Select item requires an HTML select element.');
	let index: number;
	if (byIndex) {
		const requested = Number(value);
		index = Number.isInteger(requested) ? requested - 1 : -1;
	} else {
		const text = String(value ?? '').trim();
		index = [...element.options].findIndex((option) => option.text.trim() === text || option.label.trim() === text);
	}
	if (index < 0 || index >= element.options.length) fail('NO_MATCH', 'Select item was not found.');
	const changed = element.selectedIndex !== index;
	if (!changed) return { text: element.options[index].text, changed: false };
	element.selectedIndex = index;
	dispatchMouse(element, 'click');
	element.dispatchEvent(new Event('input', { bubbles: true }));
	element.dispatchEvent(new Event('change', { bubbles: true }));
	return { text: element.options[index].text, changed: true };
}

function propertyValue(element: Element, propertyName: unknown): string {
	const key = String(propertyName ?? '').replace(/[\s_-]/g, '').toLowerCase();
	if ((key === 'value' || key === 'ievalue') && isPassword(element)) {
		fail('NOT_ALLOWED', 'Reading password values is not allowed.');
	}
	switch (key) {
		case 'id': case 'ieid': return element.id;
		case 'name': case 'iename': return element.getAttribute('name') ?? '';
		case 'class': case 'classname': case 'ieclass': return element.getAttribute('class') ?? '';
		case 'href': case 'iehref': return (element as HTMLAnchorElement).href || '';
		case 'title': case 'ietitle': return element.getAttribute('title') ?? '';
		case 'value': case 'ievalue': return String((element as HTMLInputElement).value ?? '');
		case 'innertext': case 'ieinnertext': return (element as HTMLElement).innerText ?? element.textContent ?? '';
		case 'tagname': case 'ietag': return element.tagName;
		default: return fail('NO_MATCH', `Unsupported property: ${String(propertyName ?? '')}`);
	}
}

async function executeVerb(target: Target, verb: RecorderVerb, payload: Record<string, any>) {
	if (verb === 'debuggerClick') fail('INTERNAL', 'Debugger click must be handled by the extension background.');

	const element = actionable(target);
	const result = resultFor(element);
	switch (verb) {
		case 'click': syntheticClick(element); return { ...result, changed: true };
		case 'doubleClick': syntheticClick(element, 0, true); return { ...result, changed: true };
		case 'rightClick': syntheticClick(element, 2); return { ...result, changed: true };
		case 'setText':
			if (currentValue(element) === String(payload.value ?? '')) return { ...result, changed: false };
			if (Number(payload.delay) > 0) await typeText(element, String(payload.value ?? ''), Number(payload.delay), true);
			else setValue(element, String(payload.value ?? ''));
			return { ...result, changed: true };
		case 'appendText':
			if (String(payload.value ?? '') === '') return { ...result, changed: false };
			if (Number(payload.delay) > 0) await typeText(element, String(payload.value ?? ''), Number(payload.delay), false);
			else setValue(element, `${currentValue(element)}${String(payload.value ?? '')}`);
			return { ...result, changed: true };
		case 'getText':
			if (isPassword(element)) fail('NOT_ALLOWED', 'Reading password text is not allowed.');
			return { ...result, text: (element as HTMLElement).innerText ?? element.textContent ?? '', changed: false };
		case 'getProperty': return { ...result, text: propertyValue(element, payload.propertyName), changed: false };
		case 'getValue':
			if (isPassword(element)) fail('NOT_ALLOWED', 'Reading password values is not allowed.');
			return { ...result, text: String((element as HTMLInputElement).value ?? ''), changed: false };
		case 'check': return { ...result, ...setChecked(element, true) };
		case 'uncheck': return { ...result, ...setChecked(element, false) };
		case 'toggle': return { ...result, ...setChecked(element) };
		case 'select': return { ...result, ...setChecked(element, true) };
		case 'selectItemByText': return { ...result, ...selectItem(element, payload.value, false) };
		case 'selectItemByIndex': return { ...result, ...selectItem(element, payload.index, true) };
		case 'getStatus': return { ...result, status: checked(element), changed: false };
		case 'setFocus': {
			const changed = document.activeElement !== element;
			(element as HTMLElement).focus();
			return { ...result, changed };
		}
	}
	return { ...result, changed: false };
}

async function handle(request: Request): Promise<unknown> {
	const payload = request.payload ?? {};
	if (request.type === 'resolveSelector') {
		const matches = resolveSelector(String(payload.selector ?? ''), String(payload.kind ?? ''));
		const element = matches[0];
		return {
			found: Boolean(element),
			count: matches.length,
			rect: element ? rect(element) : undefined,
			visible: Boolean(element && visible(element)),
			braId: element ? Number(ensureBraId(element)) : undefined,
			targetDescriptor: element ? describeElement(element) : undefined,
		};
	}
	if (request.type === 'getLabeledDom') return labelDom(Number(payload.maxChars) || 60_000);
	if (request.type === 'observePage') return labelDom(Number(payload.maxChars) || 60_000);
	if (request.type === 'elementFromPoint') {
		const element = document.elementFromPoint(Number(payload.x), Number(payload.y));
		if (!element) fail('NO_MATCH', 'No element at point.');
		return { braId: ensureBraId(element), tag: element.tagName.toLowerCase(), text: accessibleText(element) };
	}
	if (request.type === 'describeElement') return describeElement(resolveTarget({ braId: payload.braId }));
	if (request.type === 'executeVerb') {
		if (!isRecorderVerb(payload.verb)) fail('INTERNAL', `Unsupported verb: ${String(payload.verb)}`);
		return executeVerb(payload.target ?? {}, payload.verb, payload);
	}
	fail('INTERNAL', `Unknown recorder request: ${request.type}`);
}

export default defineContentScript({
	matches: ['<all_urls>'],
	registration: 'runtime',
	allFrames: false,
	runAt: 'document_idle',
	main() {
		const page = globalThis as typeof globalThis & { __betterAaRecorderLoaded?: boolean };
		if (page.__betterAaRecorderLoaded) return;
		page.__betterAaRecorderLoaded = true;
		browser.runtime.onMessage.addListener((message: { type?: string; request?: Request }) => {
			if (message.type === 'RECORDER_VIEWPORT') return { devicePixelRatio, viewportW: innerWidth, viewportH: innerHeight };
			if (message.type === 'RECORDER_PREPARE_DEBUGGER_CLICK' && message.request) {
				try {
					const element = actionable(message.request.payload?.target ?? {});
					return { rect: rect(element), ...resultFor(element) };
				} catch (cause) {
					return { __error: { code: (cause as any)?.code ?? 'INTERNAL', message: (cause as any)?.message ?? 'Request failed.' } };
				}
			}
			if (message.type !== 'RECORDER_REQUEST' || !message.request) return;
			return handle(message.request).catch((cause) => ({
				__error: {
					code: cause?.code ?? 'INTERNAL',
					message: cause?.message ?? 'Request failed.',
				},
			}));
		});
	},
});
