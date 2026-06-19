import type {
	AutomationAnywhereApiRequestMessage,
	AutomationAnywhereApiResponse,
	ContentActionResponse,
	ControlRoomCompatibilityMessage,
	ControlRoomCompatibilityResponse,
	RuntimeMessage,
	SettingsBackgroundMessage,
} from '../src/ts/messages';
import {
	sidepanelRequest,
	type SidepanelFocusTarget,
	type SidepanelTab,
} from '../src/ts/sidepanel-state';
import {
	AUTOMATION_ANYWHERE_MATCHES,
	isAutomationAnywhereUrl,
} from '../src/ts/automation-anywhere';
import {
	getAutomationAnywhereAuthToken,
	parseAutomationAnywherePageContext,
} from '../src/ts/automation-anywhere-api';
import {
	createUnknownControlRoomCompatibility,
	evaluateControlRoomCompatibility,
	type ControlRoomCompatibilityStatus,
	type ControlRoomVersionDetails,
} from '../src/ts/control-room-version';
import {
	botExecutionModalPosition,
	blockTaskbotNodeLabelClicks,
	commandPaletteEnabled,
	commandPaletteShortcut,
	debugEnabled,
	extensionLanguage,
	forceEnglishLocale,
	forceUnsupportedControlRoomStyles,
	getCommandPaletteShortcut,
	getCommandPaletteShortcutLabel,
	getOpenSidebarShortcut,
	getOpenSidebarShortcutLabel,
	getStylesEnabled,
	keepAliveEnabled,
	normalizeBotExecutionModalPosition,
	normalizeCommandPaletteShortcut,
	normalizeExtensionLanguage,
	normalizeOpenSidebarShortcut,
	openSidebarShortcut,
	runButton,
	runButtonWaves,
	showSuggestions,
	soundsEnabled,
	styleFeatureItems,
	styleValueItems,
	stylesEnabled,
} from '../src/ts/settings';
import { debugError, debugInfo, debugWarn } from '../src/ts/debug';

const FALLBACK_OPEN_SIDEBAR_SHORTCUT = 'Alt + Shift + L';
const CONTROL_ROOM_VERSION_CACHE_TTL_MS = 5 * 60 * 1000;

const controlRoomVersionCache = new Map<
	string,
	{ expiresAt: number; compatibility: ControlRoomCompatibilityStatus }
>();

async function broadcastToAutomationTabs(
	message: SettingsBackgroundMessage
): Promise<void> {
	const tabs = await queryAutomationAnywhereTabs();
	await Promise.all(
		tabs.map(async (tab) => {
			if (tab.id === undefined) return;
			try {
				await browser.tabs.sendMessage(tab.id, message);
			} catch (error) {
				// Content script not present in every matched tab state.
				void debugWarn('background', 'Could not broadcast settings to tab.', {
					error,
					messageType: message.type,
					tabId: tab.id,
				});
			}
		})
	);
}

async function queryAutomationAnywhereTabs(): Promise<
	Array<Awaited<ReturnType<typeof browser.tabs.query>>[number]>
> {
	const tabsById = new Map<number, Awaited<ReturnType<typeof browser.tabs.query>>[number]>();
	for (const url of AUTOMATION_ANYWHERE_MATCHES) {
		const tabs = await browser.tabs.query({ url });
		for (const tab of tabs) {
			if (tab.id === undefined || !isAutomationAnywhereUrl(tab.url)) continue;
			tabsById.set(tab.id, tab);
		}
	}
	return [...tabsById.values()];
}

async function getCompatibilityTab(
	sender: Parameters<typeof browser.runtime.onMessage.addListener>[0] extends (
		message: any,
		sender: infer Sender,
		...args: any[]
	) => any
		? Sender
		: never
): Promise<{ tabId: number; url: string } | null> {
	if (sender.tab?.id !== undefined && sender.tab.url) {
		return { tabId: sender.tab.id, url: sender.tab.url };
	}
	const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
	if (tab?.id === undefined || !tab.url || !isAutomationAnywhereUrl(tab.url)) {
		return null;
	}
	return { tabId: tab.id, url: tab.url };
}

function getCachedControlRoomCompatibility(
	baseUrl: string,
	forceRefresh?: boolean
): ControlRoomCompatibilityStatus | null {
	if (forceRefresh) return null;
	const cached = controlRoomVersionCache.get(baseUrl);
	if (!cached || cached.expiresAt < Date.now()) {
		controlRoomVersionCache.delete(baseUrl);
		return null;
	}
	return cached.compatibility;
}

function setCachedControlRoomCompatibility(
	baseUrl: string,
	compatibility: ControlRoomCompatibilityStatus
): void {
	const ttl =
		compatibility.state === 'unknown' ? 30_000 : CONTROL_ROOM_VERSION_CACHE_TTL_MS;
	controlRoomVersionCache.set(baseUrl, {
		expiresAt: Date.now() + ttl,
		compatibility,
	});
}

async function getControlRoomCompatibility(
	message: ControlRoomCompatibilityMessage,
	sender: Parameters<typeof browser.runtime.onMessage.addListener>[0] extends (
		message: any,
		sender: infer Sender,
		...args: any[]
	) => any
		? Sender
		: never
): Promise<ControlRoomCompatibilityResponse> {
	const target = await getCompatibilityTab(sender);
	if (!target) return { ok: false, error: 'Open an Automation Anywhere tab first.' };

	const context = parseAutomationAnywherePageContext(target.url);
	if (!context.baseUrl) {
		return { ok: false, error: 'Unsupported Automation Anywhere tab.' };
	}

	const cached = getCachedControlRoomCompatibility(
		context.baseUrl,
		message.forceRefresh
	);
	if (cached) return { ok: true, compatibility: cached };

	try {
		const authToken = await getAutomationAnywhereAuthToken(target.tabId);
		const response = await handleApiRequest({
			type: 'AA_API_REQUEST',
			config: {
				url: `${context.baseUrl}/v2/settings/version/details`,
				headers: {
					'X-Authorization': authToken,
				},
			},
		});

		if (!response.ok) throw new Error(response.error);
		const compatibility = evaluateControlRoomCompatibility(
			response.data as ControlRoomVersionDetails
		);
		setCachedControlRoomCompatibility(context.baseUrl, compatibility);
		return { ok: true, compatibility };
	} catch (error) {
		const compatibility = createUnknownControlRoomCompatibility(
			error instanceof Error ? error.message : 'Control Room version unavailable.'
		);
		setCachedControlRoomCompatibility(context.baseUrl, compatibility);
		return { ok: true, compatibility };
	}
}

function createNonce(): string {
	if (crypto.randomUUID) return crypto.randomUUID();
	return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

type SidebarOpenRequest = {
	tab?: SidepanelTab;
	focus?: SidepanelFocusTarget;
	userAction?: boolean;
};

async function writeSidepanelRequest(request?: SidebarOpenRequest): Promise<void> {
	if (!request) return;
	await sidepanelRequest.setValue({
		tab: request.tab ?? 'tools',
		focus: request.focus,
		nonce: createNonce(),
	});
}

function queueSidepanelRequest(request?: SidebarOpenRequest): void {
	void writeSidepanelRequest(request).catch((error) => {
		void debugWarn('background', 'Sidepanel request write failed.', {
			error,
		}, { feedback: true });
	});
}

function reportSidebarOpenBlocked(error: unknown, messageType: string): void {
	void debugWarn('background', 'Sidebar open was blocked by the browser.', {
		error,
		messageType,
	}, { feedback: true });
}

function openChromeSidePanel(options: { windowId?: number; tabId?: number }): void {
	const chromeApi = (globalThis as any).chrome;
	try {
		const result = chromeApi?.sidePanel?.open?.(options);
		void Promise.resolve(result).catch((error) => {
			reportSidebarOpenBlocked(error, 'open-sidebar');
		});
	} catch (error) {
		reportSidebarOpenBlocked(error, 'open-sidebar');
	}
}

function getErrorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error || 'Action failed.');
}

function openChromeSidePanelFromSenderTab(
	tabId: number,
	request?: SidebarOpenRequest
): ContentActionResponse | Promise<ContentActionResponse> {
	const chromeApi = (globalThis as any).chrome;
	if (!chromeApi?.sidePanel?.open) {
		return { ok: false, error: 'Chrome side panel API unavailable.' };
	}
	queueSidepanelRequest(request);
	try {
		const result = chromeApi.sidePanel.open({ tabId });
		return Promise.resolve(result)
			.then(() => ({ ok: true, message: 'Sidebar opened.' }) as ContentActionResponse)
			.catch((error) => {
				reportSidebarOpenBlocked(error, 'OPEN_SIDEBAR');
				return { ok: false, error: getErrorMessage(error) } as ContentActionResponse;
			});
	} catch (error) {
		reportSidebarOpenBlocked(error, 'OPEN_SIDEBAR');
		return { ok: false, error: getErrorMessage(error) };
	}
}

function openChromeSidePanelFromUserAction(request?: SidebarOpenRequest): void {
	const chromeApi = (globalThis as any).chrome;
	if (!chromeApi?.tabs?.query) {
		openChromeSidePanel({ windowId: chromeApi?.windows?.WINDOW_ID_CURRENT ?? -2 });
		queueSidepanelRequest(request);
		return;
	}

	chromeApi?.tabs?.query?.(
		{ active: true, currentWindow: true },
		(tabs: Array<{ windowId?: number }> = []) => {
			const windowId = tabs[0]?.windowId;
			openChromeSidePanel(
				windowId === undefined
					? { windowId: chromeApi?.windows?.WINDOW_ID_CURRENT ?? -2 }
					: { windowId }
			);
			queueSidepanelRequest(request);
		}
	);
}

async function openSidebar(request?: SidebarOpenRequest): Promise<void> {
	if (import.meta.env.CHROME) {
		const activeTabs = await browser.tabs.query({ active: true, currentWindow: true });
		const windowId = activeTabs[0]?.windowId;
		try {
			await (globalThis as any).chrome?.sidePanel?.open?.({ windowId });
		} catch (error) {
			reportSidebarOpenBlocked(error, 'OPEN_SIDEBAR');
		}
		await writeSidepanelRequest(request);
		return;
	}

	await writeSidepanelRequest(request);
	if (!request?.userAction) return;

	const sidebarAction = (browser as any).sidebarAction;
	try {
		await sidebarAction?.toggle?.();
	} catch (error) {
		reportSidebarOpenBlocked(error, request ? 'OPEN_SIDEBAR' : 'open-sidebar');
	}
}

async function handleFirefoxOpenSidebarMessage(
	request?: SidebarOpenRequest
): Promise<ContentActionResponse> {
	await writeSidepanelRequest(request);
	const shortcut = getOpenSidebarShortcutLabel(await getOpenSidebarShortcut());
	return {
		ok: false,
		error: `Firefox blocks programmatic sidebar open. Use ${shortcut} or toolbar button.`,
	};
}

async function setPanelActionBehavior(): Promise<void> {
	if (import.meta.env.CHROME) {
		await (globalThis as any).chrome?.sidePanel
			?.setPanelBehavior?.({ openPanelOnActionClick: true })
			?.catch?.(() => {});
		return;
	}

	const action = (browser as any).action ?? (browser as any).browserAction;
	action?.onClicked?.addListener(() => {
		void openSidebar({ userAction: true });
	});
}

async function handleSettingsMessage(message: SettingsBackgroundMessage): Promise<void> {
	if (message.type === 'OPEN_SIDEBAR') {
		await openSidebar({ tab: message.tab, focus: message.focus });
		return;
	}
	if (message.type === 'TOGGLE_STYLES') {
		const enabled = message.enabled ?? !(await getStylesEnabled());
		await stylesEnabled.setValue(enabled);
		void debugInfo('userstyle', 'Styles toggle saved.', { enabled });
		await broadcastToAutomationTabs({ type: 'TOGGLE_STYLES', enabled });
	}
	if (message.type === 'SET_RUN_BUTTON_STYLE') {
		await runButton.setValue(message.enabled);
		void debugInfo('userstyle', 'Style feature saved.', {
			key: 'runButton',
			enabled: message.enabled,
		});
		await broadcastToAutomationTabs(message);
	}
	if (message.type === 'SET_RUN_BUTTON_WAVES') {
		await runButtonWaves.setValue(message.enabled);
		void debugInfo('userstyle', 'Style feature saved.', {
			key: 'runButtonWaves',
			enabled: message.enabled,
		});
		await broadcastToAutomationTabs(message);
	}
	if (message.type === 'SET_SOUNDS_ENABLED') {
		await soundsEnabled.setValue(message.enabled);
		void debugInfo('sounds', 'Sound setting saved.', { enabled: message.enabled });
		await broadcastToAutomationTabs(message);
	}
	if (message.type === 'SET_SHOW_SUGGESTIONS') {
		await showSuggestions.setValue(message.enabled);
		void debugInfo('suggestions', 'Suggestion setting saved.', {
			enabled: message.enabled,
		});
		await broadcastToAutomationTabs(message);
	}
	if (message.type === 'SET_DEBUG_ENABLED') {
		await debugEnabled.setValue(message.enabled);
		void debugInfo('debug', 'Debug setting saved.', { enabled: message.enabled });
	}
	if (message.type === 'SET_COMMAND_PALETTE_ENABLED') {
		await commandPaletteEnabled.setValue(message.enabled);
		void debugInfo('settings', 'Command palette setting saved.', {
			enabled: message.enabled,
		});
		await broadcastToAutomationTabs(message);
	}
	if (message.type === 'SET_KEEP_ALIVE_ENABLED') {
		await keepAliveEnabled.setValue(message.enabled);
		void debugInfo('settings', 'Keep-alive setting saved.', {
			enabled: message.enabled,
		});
		await broadcastToAutomationTabs(message);
	}
	if (message.type === 'SET_BLOCK_TASKBOT_NODE_LABEL_CLICKS') {
		await blockTaskbotNodeLabelClicks.setValue(message.enabled);
		void debugInfo('settings', 'Taskbot link click setting saved.', {
			enabled: message.enabled,
		});
		await broadcastToAutomationTabs(message);
	}
	if (message.type === 'SET_FORCE_ENGLISH_LOCALE') {
		await forceEnglishLocale.setValue(message.enabled);
		void debugInfo('settings', 'Force English locale setting saved.', {
			enabled: message.enabled,
		});
		await broadcastToAutomationTabs(message);
	}
	if (message.type === 'SET_FORCE_UNSUPPORTED_CONTROL_ROOM_STYLES') {
		await forceUnsupportedControlRoomStyles.setValue(message.enabled);
		void debugInfo('userstyle', 'Unsupported Control Room force saved.', {
			enabled: message.enabled,
		});
		await broadcastToAutomationTabs(message);
	}
	if (message.type === 'SET_EXTENSION_LANGUAGE') {
		const language = normalizeExtensionLanguage(message.language);
		await extensionLanguage.setValue(language);
		void debugInfo('settings', 'Extension language setting saved.', {
			language,
		});
		await broadcastToAutomationTabs({
			type: 'SET_EXTENSION_LANGUAGE',
			language,
		});
	}
	if (message.type === 'SET_COMMAND_PALETTE_SHORTCUT') {
		const shortcut = normalizeCommandPaletteShortcut(message.shortcut);
		await commandPaletteShortcut.setValue(shortcut);
		await broadcastToAutomationTabs({
			type: 'SET_COMMAND_PALETTE_SHORTCUT',
			shortcut,
		});
	}
	if (message.type === 'SET_OPEN_SIDEBAR_SHORTCUT') {
		const shortcut = normalizeOpenSidebarShortcut(message.shortcut);
		await openSidebarShortcut.setValue(shortcut);
		await updateNativeOpenSidebarShortcut(shortcut);
		void debugInfo('settings', 'Sidebar shortcut saved.', {
			shortcut: getOpenSidebarShortcutLabel(shortcut),
		});
		await broadcastToAutomationTabs({
			type: 'SET_OPEN_SIDEBAR_SHORTCUT',
			shortcut,
		});
	}
	if (message.type === 'SET_BOT_EXECUTION_MODAL_POSITION') {
		const position = normalizeBotExecutionModalPosition(message.position);
		await botExecutionModalPosition.setValue(position);
		void debugInfo('userstyle', 'Bot execution modal position saved.', {
			position,
		});
		await broadcastToAutomationTabs({
			type: 'SET_BOT_EXECUTION_MODAL_POSITION',
			position,
		});
	}
	if (message.type === 'SET_STYLE_FEATURE') {
		await styleFeatureItems[message.key].setValue(message.enabled);
		void debugInfo('userstyle', 'Style feature saved.', {
			key: message.key,
			enabled: message.enabled,
		});
		await broadcastToAutomationTabs(message);
	}
	if (message.type === 'SET_STYLE_VALUE') {
		await styleValueItems[message.key].setValue(message.value);
		void debugInfo('userstyle', 'Style value saved.', { key: message.key });
		await broadcastToAutomationTabs(message);
	}
}

async function getExtensionShortcuts(): Promise<{
	openSidebar: string;
	commandPalette: string;
}> {
	const openSidebar = await getOpenSidebarShortcut();
	const commandPalette = await getCommandPaletteShortcut();
	return {
		openSidebar:
			getOpenSidebarShortcutLabel(openSidebar) || FALLBACK_OPEN_SIDEBAR_SHORTCUT,
		commandPalette: getCommandPaletteShortcutLabel(commandPalette),
	};
}

function isSettingsBackgroundMessage(message: RuntimeMessage): message is SettingsBackgroundMessage {
	return (
		message.type === 'OPEN_SIDEBAR' ||
		message.type === 'TOGGLE_STYLES' ||
		message.type === 'SET_RUN_BUTTON_STYLE' ||
		message.type === 'SET_RUN_BUTTON_WAVES' ||
		message.type === 'SET_SOUNDS_ENABLED' ||
		message.type === 'SET_SHOW_SUGGESTIONS' ||
		message.type === 'SET_DEBUG_ENABLED' ||
		message.type === 'SET_COMMAND_PALETTE_ENABLED' ||
		message.type === 'SET_KEEP_ALIVE_ENABLED' ||
		message.type === 'SET_BLOCK_TASKBOT_NODE_LABEL_CLICKS' ||
		message.type === 'SET_FORCE_ENGLISH_LOCALE' ||
		message.type === 'SET_FORCE_UNSUPPORTED_CONTROL_ROOM_STYLES' ||
		message.type === 'SET_EXTENSION_LANGUAGE' ||
		message.type === 'SET_COMMAND_PALETTE_SHORTCUT' ||
		message.type === 'SET_OPEN_SIDEBAR_SHORTCUT' ||
		message.type === 'SET_BOT_EXECUTION_MODAL_POSITION' ||
		message.type === 'SET_STYLE_FEATURE' ||
		message.type === 'SET_STYLE_VALUE'
	);
}

function getNativeOpenSidebarCommandName(): string {
	return import.meta.env.FIREFOX ? '_execute_sidebar_action' : 'open-sidebar';
}

async function updateNativeOpenSidebarShortcut(
	shortcut: Awaited<ReturnType<typeof getOpenSidebarShortcut>>
): Promise<void> {
	const commandsApi = browser.commands as unknown as {
		update?: (details: { name: string; shortcut: string }) => Promise<void>;
	};
	if (typeof commandsApi.update !== 'function') return;

	try {
		await commandsApi.update({
			name: getNativeOpenSidebarCommandName(),
			shortcut: getOpenSidebarShortcutLabel(shortcut).replace(/\s+/g, ''),
		});
	} catch (error) {
		void debugWarn('settings', 'Native sidebar shortcut update failed.', {
			error,
			shortcut: getOpenSidebarShortcutLabel(shortcut),
		}, { feedback: true });
	}
}

function parseContentDispositionFileName(disposition: string | null): string | undefined {
	if (!disposition) return undefined;
	const encoded = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
	if (encoded) return decodeURIComponent(encoded.replace(/"/g, ''));
	const plain = disposition.match(/filename="?([^";]+)"?/i)?.[1];
	return plain ? plain.trim() : undefined;
}

async function blobToDataUrl(blob: Blob): Promise<string> {
	const bytes = new Uint8Array(await blob.arrayBuffer());
	let binary = '';
	const chunkSize = 0x8000;
	for (let index = 0; index < bytes.length; index += chunkSize) {
		const chunk = bytes.subarray(index, index + chunkSize);
		binary += String.fromCharCode(...chunk);
	}
	return `data:${blob.type || 'application/octet-stream'};base64,${btoa(binary)}`;
}

function parseJsonLike(value: string): unknown {
	const trimmed = value.trim();
	if (!trimmed) return '';
	try {
		return JSON.parse(trimmed);
	} catch {
		try {
			return JSON.parse(decodeURIComponent(trimmed));
		} catch {
			return trimmed;
		}
	}
}

function extractApiErrorMessage(data: unknown): string | null {
	if (!data || typeof data !== 'object') return null;
	const record = data as Record<string, unknown>;
	for (const key of ['message', 'error', 'errorMessage', 'detail']) {
		if (typeof record[key] === 'string' && record[key]) return record[key];
	}
	if (Array.isArray(record.errors) && record.errors.length) {
		const first = record.errors[0];
		if (typeof first === 'string') return first;
		if (first && typeof first === 'object') {
			const nested = first as Record<string, unknown>;
			if (typeof nested.message === 'string') return nested.message;
		}
	}
	return null;
}

async function readApiError(response: Response): Promise<string> {
	const text = await response.text().catch(() => '');
	let message = text.trim();
	if (text) {
		const parsed = parseJsonLike(text);
		message = extractApiErrorMessage(parsed) ?? message;
	}
	return `${response.status} ${response.statusText}${message ? `: ${message}` : ''}`;
}

async function handleApiRequest(
	message: AutomationAnywhereApiRequestMessage
): Promise<AutomationAnywhereApiResponse> {
	try {
		const response = await fetch(message.config.url, {
			method: message.config.method ?? 'GET',
			headers: message.config.headers,
			body: message.config.body,
		});

		if (!response.ok) {
			return {
				ok: false,
				status: response.status,
				error: await readApiError(response),
			};
		}

		if (message.config.responseType === 'blob') {
			const blob = await response.blob();
			return {
				ok: true,
				data: {
					blob: await blobToDataUrl(blob),
					type: blob.type,
					size: blob.size,
					fileName: parseContentDispositionFileName(
						response.headers.get('content-disposition')
					),
				},
			};
		}

		if (message.config.responseType === 'text') {
			return { ok: true, data: await response.text() };
		}

		if (message.config.responseType === 'bot-content') {
			const headerContent =
				response.headers.get('x-bot-content') ?? response.headers.get('X-Bot-Content');
			if (headerContent) return { ok: true, data: parseJsonLike(headerContent) };
			const text = await response.text();
			return { ok: true, data: parseJsonLike(text) };
		}

		const contentType = response.headers.get('content-type') ?? '';
		if (contentType.includes('application/json')) {
			return { ok: true, data: await response.json() };
		}
		const text = await response.text();
		return { ok: true, data: text ? parseJsonLike(text) : undefined };
	} catch (error) {
		return {
			ok: false,
			error: error instanceof Error ? error.message : 'Automation Anywhere API request failed.',
		};
	}
}

export default defineBackground(() => {
	browser.commands.onCommand.addListener((command) => {
		if (command === 'open-sidebar') {
			if (import.meta.env.CHROME) {
				openChromeSidePanelFromUserAction({ userAction: true });
			} else {
				void openSidebar({ userAction: true });
			}
		}
		if (command === 'toggle-styles') {
			void handleSettingsMessage({ type: 'TOGGLE_STYLES' });
		}
	});

	browser.runtime.onMessage.addListener((message: RuntimeMessage, sender) => {
		if (!message || typeof message.type !== 'string') return;
		if (message.type === 'AA_ROUTE_CHANGED') return;
		if (
			message.type === 'OPEN_SIDEBAR' &&
			import.meta.env.CHROME &&
			sender.tab?.id !== undefined
		) {
			return openChromeSidePanelFromSenderTab(sender.tab.id, {
				tab: message.tab,
				focus: message.focus,
				userAction: true,
			});
		}
		if (message.type === 'OPEN_SIDEBAR' && import.meta.env.FIREFOX) {
			return handleFirefoxOpenSidebarMessage({
				tab: message.tab,
				focus: message.focus,
			});
		}
		if (message.type === 'AA_API_REQUEST') return handleApiRequest(message);
		if (message.type === 'GET_CONTROL_ROOM_COMPATIBILITY') {
			return getControlRoomCompatibility(message, sender);
		}
		if (message.type === 'GET_EXTENSION_SHORTCUTS') return getExtensionShortcuts();
		if (!isSettingsBackgroundMessage(message)) return;
		void handleSettingsMessage(message).catch((error) => {
			void debugError('background', 'Settings message failed.', {
				error,
				messageType: message.type,
			}, { feedback: true });
		});
	});

	void setPanelActionBehavior();
});
