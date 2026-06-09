const HELP_TIP_ID_PREFIX = 'help-tip-';

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
