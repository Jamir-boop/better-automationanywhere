export const AUTOMATION_ANYWHERE_URL_RE = /.*automationanywhere\.digital.*/i;

export const AUTOMATION_ANYWHERE_MATCHES = [
	'*://automationanywhere.digital/*',
	'*://*.automationanywhere.digital/*',
] as const;

export const AUTOMATION_ANYWHERE_TASK_EDITOR_ROUTE_RE =
	/\/(?:bots\/repository\/)?(private|public)\/(?:folders\/[^/?#]+\/)?files\/(?:task|taskbot)\/([^/?#]+)(?:\/(?:edit|view))?(?:[/?#]|$)/i;

const AUTOMATION_ANYWHERE_FOLDER_ROUTE_RE =
	/\/bots\/repository\/(private|public)\/folders\/([^/?#]+)\/?(?:[?#].*)?$/i;

export const AUTOMATION_ANYWHERE_TASK_EDITOR_URL_RE =
	/.*automationanywhere\.digital.*\/(?:bots\/repository\/)?(private|public)\/(?:folders\/[^/?#]+\/)?files\/(?:task|taskbot)\/([^/?#]+)(?:\/(?:edit|view))?(?:[/?#]|$)/i;

export const AUTOMATION_ANYWHERE_TEXT_FILE_URL_RE =
	/.*automationanywhere\.digital.*\/(?:bots\/repository\/)?(private|public)\/(?:folders\/[^/?#]+\/)?files\/text\/([^/?#]+)(?:\/(?:edit|view))?(?:[/?#]|$)/i;

export const EDITOR_PALETTE_TOGGLE_SELECTOR =
	'div.editor-layout__resize[data-path="EditorLayout.paletteResize"] button.editor-layout__resize-toggle[aria-label="Toggle palette"]';
const LEGACY_EDITOR_PALETTE_TOGGLE_SELECTOR =
	'div.editor-layout__resize:nth-child(2) > button:nth-child(2)';
export const EDITOR_PALETTE_TOGGLE_QUERY_SELECTOR = `${EDITOR_PALETTE_TOGGLE_SELECTOR}, ${LEGACY_EDITOR_PALETTE_TOGGLE_SELECTOR}`;

export function isAutomationAnywhereUrl(url: unknown): url is string {
	return typeof url === 'string' && AUTOMATION_ANYWHERE_URL_RE.test(url);
}

function getAutomationAnywhereRoute(url: string): string {
	try {
		const parsed = new URL(url);
		return `${parsed.pathname}${parsed.hash}`;
	} catch {
		return url;
	}
}

export function isFolderRepositoryUrl(url: string): boolean {
	return AUTOMATION_ANYWHERE_FOLDER_ROUTE_RE.test(getAutomationAnywhereRoute(url));
}

export function isTaskEditorUrl(url: string): boolean {
	return AUTOMATION_ANYWHERE_TASK_EDITOR_URL_RE.test(url);
}

export function isTextFileUrl(url: string): boolean {
	return AUTOMATION_ANYWHERE_TEXT_FILE_URL_RE.test(url);
}
