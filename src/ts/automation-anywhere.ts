export const AUTOMATION_ANYWHERE_URL_RE = /.*automationanywhere\.digital.*/i;

export const AUTOMATION_ANYWHERE_MATCHES = [
	'*://automationanywhere.digital/*',
	'*://*.automationanywhere.digital/*',
] as const;

export const AUTOMATION_ANYWHERE_TASK_EDITOR_ROUTE_RE =
	/\/(?:bots\/repository\/)?(private|public)\/(?:folders\/[^/?#]+\/)?files\/(?:task|taskbot)\/([^/?#]+)(?:\/(?:edit|view))?(?:[/?#]|$)/i;

export const AUTOMATION_ANYWHERE_TASK_EDITOR_URL_RE =
	/.*automationanywhere\.digital.*\/(?:bots\/repository\/)?(private|public)\/(?:folders\/[^/?#]+\/)?files\/(?:task|taskbot)\/([^/?#]+)(?:\/(?:edit|view))?(?:[/?#]|$)/i;

export function isAutomationAnywhereUrl(url: unknown): url is string {
	return typeof url === 'string' && AUTOMATION_ANYWHERE_URL_RE.test(url);
}

export function isTaskEditorUrl(url: string): boolean {
	return AUTOMATION_ANYWHERE_TASK_EDITOR_URL_RE.test(url);
}
