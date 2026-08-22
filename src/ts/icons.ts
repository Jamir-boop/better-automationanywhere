import { createIcons, type IconNode } from 'lucide';

export type BetterAaIconName =
	| 'activity'
	| 'arrow-left'
	| 'braces'
	| 'briefcase-business'
	| 'chevron-left'
	| 'chevron-right'
	| 'chevrons-down'
	| 'circle-check-big'
	| 'circle-help'
	| 'circle-minus'
	| 'circle-stop'
	| 'circle-x'
	| 'clipboard-copy'
	| 'clipboard-paste'
	| 'copy'
	| 'download'
	| 'external-link'
	| 'file-json'
	| 'file-up'
	| 'git-fork'
	| 'keyboard'
	| 'list-tree'
	| 'mail'
	| 'message-square'
	| 'maximize-2'
	| 'minimize-2'
	| 'package-check'
	| 'package-search'
	| 'palette'
	| 'panel-right-open'
	| 'play'
	| 'refresh-cw'
	| 'replace'
	| 'replace-all'
	| 'rotate-ccw'
	| 'scan-search'
	| 'scroll-text'
	| 'settings'
	| 'share-2'
	| 'square'
	| 'stethoscope'
	| 'terminal'
	| 'toolbox'
	| 'trash-2'
	| 'triangle-alert'
	| 'undo-2'
	| 'variable'
	| 'workflow'
	| 'x'
	| 'zap';

export type BetterAaIconRegistry = Record<string, IconNode>;

export function icon(name: BetterAaIconName, leading = true): string {
	return `<i class="better-aa-icon${leading ? ' better-aa-icon-leading' : ''}" data-lucide="${name}" aria-hidden="true"></i>`;
}

export function renderIcons(
	icons: BetterAaIconRegistry,
	root: Element | Document = document
): void {
	createIcons({ icons, root });
}

export function setIconContent(
	icons: BetterAaIconRegistry,
	element: HTMLElement,
	name: BetterAaIconName,
	label = ''
): void {
	const placeholder = document.createElement('i');
	placeholder.className = `better-aa-icon${label ? ' better-aa-icon-leading' : ''}`;
	placeholder.dataset.lucide = name;
	placeholder.setAttribute('aria-hidden', 'true');
	element.replaceChildren(placeholder);
	if (label) element.append(document.createTextNode(label));
	renderIcons(icons, element);
}
