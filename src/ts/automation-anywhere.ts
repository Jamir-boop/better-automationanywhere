const AUTOMATION_ANYWHERE_HOSTNAME = 'automationanywhere.digital';

export const AUTOMATION_ANYWHERE_MATCHES = [
	'*://automationanywhere.digital/*',
	'*://*.automationanywhere.digital/*',
] as const;

const AUTOMATION_ANYWHERE_TASK_EDITOR_ROUTE_DETAILS_RE =
	/\/(?:bots\/repository\/)?(private|public)\/(?:folders\/([^/?#]+)\/)?files\/(?:task|taskbot)\/([^/?#]+)(?:\/(edit|view))?(?:[/?#]|$)/i;

const AUTOMATION_ANYWHERE_FOLDER_ROUTE_RE =
	/\/bots\/repository\/(private|public)\/folders\/([^/?#]+)\/?(?:[?#].*)?$/i;

const AUTOMATION_ANYWHERE_PACKAGE_DETAILS_ROUTE_RE =
	/\/bots\/packages\/versions\/([^/?#]+)\/view(?:[/?#]|$)/i;

export const AUTOMATION_ANYWHERE_TASK_EDITOR_URL_RE =
	/.*automationanywhere\.digital.*\/(?:bots\/repository\/)?(private|public)\/(?:folders\/[^/?#]+\/)?files\/(?:task|taskbot)\/([^/?#]+)(?:\/(?:edit|view))?(?:[/?#]|$)/i;

export const AUTOMATION_ANYWHERE_TEXT_FILE_URL_RE =
	/.*automationanywhere\.digital.*\/(?:bots\/repository\/)?(private|public)\/(?:folders\/[^/?#]+\/)?files\/text\/([^/?#]+)(?:\/(?:edit|view))?(?:[/?#]|$)/i;

function parseAutomationAnywhereUrl(url: unknown): URL | null {
	if (typeof url !== 'string') return null;
	try {
		return new URL(url);
	} catch {
		return null;
	}
}

function isAutomationAnywhereHostname(hostname: string): boolean {
	return (
		hostname === AUTOMATION_ANYWHERE_HOSTNAME ||
		hostname.endsWith(`.${AUTOMATION_ANYWHERE_HOSTNAME}`)
	);
}

export function isAutomationAnywhereUrl(url: unknown): url is string {
	const parsed = parseAutomationAnywhereUrl(url);
	return parsed !== null && isAutomationAnywhereHostname(parsed.hostname);
}

export function isAutomationAnywhereApiUrl(url: unknown): url is string {
	const parsed = parseAutomationAnywhereUrl(url);
	return (
		parsed?.protocol === 'https:' && isAutomationAnywhereHostname(parsed.hostname)
	);
}

function getAutomationAnywhereRoute(url: string): string {
	try {
		const parsed = new URL(url);
		return `${parsed.pathname}${parsed.hash}`;
	} catch {
		return url;
	}
}

export interface AutomationAnywhereTaskEditorRoute {
	workspace: 'private' | 'public';
	folderId?: string;
	fileId: string;
	mode?: 'edit' | 'view';
}

export interface AutomationAnywherePackageRoute {
	packageName?: string;
}

export function decodeAutomationAnywhereRoutePart(
	value: string | undefined
): string | undefined {
	if (!value) return undefined;
	try {
		return decodeURIComponent(value);
	} catch {
		return value;
	}
}

export function parseAutomationAnywhereTaskEditorRoute(
	url: string
): AutomationAnywhereTaskEditorRoute | null {
	const match = getAutomationAnywhereRoute(url).match(
		AUTOMATION_ANYWHERE_TASK_EDITOR_ROUTE_DETAILS_RE
	);
	if (!match) return null;
	const fileId = decodeAutomationAnywhereRoutePart(match[3]);
	if (!fileId) return null;
	const mode = match[4]?.toLowerCase();
	return {
		workspace: match[1].toLowerCase() === 'public' ? 'public' : 'private',
		folderId: decodeAutomationAnywhereRoutePart(match[2]),
		fileId,
		mode: mode === 'edit' || mode === 'view' ? mode : undefined,
	};
}

export function parseAutomationAnywherePackageRoute(
	url: string
): AutomationAnywherePackageRoute | null {
	const route = getAutomationAnywhereRoute(url);
	const packageDetails = route.match(AUTOMATION_ANYWHERE_PACKAGE_DETAILS_ROUTE_RE);
	if (packageDetails) {
		return {
			packageName: decodeAutomationAnywhereRoutePart(packageDetails[1]),
		};
	}
	return /\/bots\/packages\/versions(?:[/?#]|$)/i.test(route) ? {} : null;
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
