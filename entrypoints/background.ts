import type {
	AutomationAnywhereApiRequestMessage,
	AutomationAnywhereApiResponse,
	ContentActionMessage,
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
	isAutomationAnywhereApiUrl,
	isAutomationAnywhereUrl,
	parseAutomationAnywhereTaskEditorRoute,
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
	browserContextMenuEnabled,
	commandPaletteEnabled,
	commandPaletteShortcut,
	debugEnabled,
	extensionLanguage,
	forceEnglishLocale,
	forceUnsupportedControlRoomStyles,
	getCommandPaletteShortcut,
	getCommandPaletteShortcutLabel,
	getBrowserContextMenuEnabled,
	getOpenSidebarShortcut,
	getOpenSidebarShortcutLabel,
	getStylesEnabled,
	keepAliveEnabled,
	normalizeBotExecutionModalPosition,
	normalizeCommandPaletteShortcut,
	normalizeExtensionLanguage,
	normalizeOpenSidebarShortcut,
	openSidebarShortcut,
	runButtonWaves,
	showSuggestions,
	soundsEnabled,
	styleFeatureItems,
	styleValueItems,
	stylesEnabled,
} from '../src/ts/settings';
import { universalClipboardSlot } from '../src/ts/universal-clipboard-storage';
import { debugError, debugInfo, debugWarn } from '../src/ts/debug';
import {
	extractApiErrorMessage,
	parseContentDispositionFileName,
	parseJsonLike,
} from '../src/ts/automation-anywhere-response';
import { startRecorderBridge } from '../src/ts/recorder/ws-client';

const FALLBACK_OPEN_SIDEBAR_SHORTCUT = 'Alt + Shift + L';
const CONTROL_ROOM_VERSION_CACHE_TTL_MS = 5 * 60 * 1000;
const SLOW_API_REQUEST_MS = 2000;
const OPEN_SIDEBAR_CONTEXT_MENU_ID = 'open-better-aa-sidebar';
const UNIVERSAL_CLIPBOARD_CONTEXT_MENU_ID = 'better-aa-universal-clipboard';
const CONTEXT_MENU_CLIPBOARD_SLOTS = [1, 2, 3] as const;

type UniversalClipboardSlot = (typeof CONTEXT_MENU_CLIPBOARD_SLOTS)[number];

function getClipboardSlotContextMenuId(slot: UniversalClipboardSlot): string {
	return `better-aa-universal-slot-${slot}`;
}

function getClipboardCopyContextMenuId(slot: UniversalClipboardSlot): string {
	return `better-aa-universal-copy-${slot}`;
}

function getClipboardPasteContextMenuId(slot: UniversalClipboardSlot): string {
	return `better-aa-universal-paste-${slot}`;
}

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

function openFirefoxSidebarFromUserAction(request?: SidebarOpenRequest): void {
	try {
		const result = (browser as any).sidebarAction?.open?.();
		void Promise.resolve(result).catch((error) => {
			reportSidebarOpenBlocked(error, request ? 'OPEN_SIDEBAR' : 'open-sidebar');
		});
	} catch (error) {
		reportSidebarOpenBlocked(error, request ? 'OPEN_SIDEBAR' : 'open-sidebar');
	}
	queueSidepanelRequest(request);
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

	if (request?.userAction) {
		openFirefoxSidebarFromUserAction(request);
		return;
	}

	await writeSidepanelRequest(request);
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
		openFirefoxSidebarFromUserAction({ userAction: true });
	});
}

function getContextMenusApi(): any {
	return (
		(browser as any).menus ??
		(browser as any).contextMenus ??
		(globalThis as any).chrome?.contextMenus
	);
}

function getContextMenuTitle(
	key: Parameters<typeof browser.i18n.getMessage>[0],
	fallback: string
): string {
	return browser.i18n.getMessage(key) || fallback;
}

function createBrowserContextMenus(): void {
	const menus = getContextMenusApi();
	if (!menus?.create) return;

	menus.create({
		id: OPEN_SIDEBAR_CONTEXT_MENU_ID,
		title: getContextMenuTitle('openSidebarCommandDescription', 'Open extension sidebar'),
		contexts: ['all'],
		documentUrlPatterns: [...AUTOMATION_ANYWHERE_MATCHES],
		visible: false,
	});
	menus.create({
		id: UNIVERSAL_CLIPBOARD_CONTEXT_MENU_ID,
		title: getContextMenuTitle('universalClipboardContextMenu', 'Universal Clipboard'),
		contexts: ['all'],
		documentUrlPatterns: [...AUTOMATION_ANYWHERE_MATCHES],
		visible: false,
	});
	for (const slot of CONTEXT_MENU_CLIPBOARD_SLOTS) {
		menus.create({
			id: getClipboardSlotContextMenuId(slot),
			parentId: UNIVERSAL_CLIPBOARD_CONTEXT_MENU_ID,
			title: `${getContextMenuTitle('universalClipboardSlotContextMenu', 'Slot')} ${slot}`,
			contexts: ['all'],
		});
		menus.create({
			id: getClipboardCopyContextMenuId(slot),
			parentId: getClipboardSlotContextMenuId(slot),
			title: getContextMenuTitle('universalCopyContextMenu', 'Copy selected actions'),
			contexts: ['all'],
		});
		menus.create({
			id: getClipboardPasteContextMenuId(slot),
			parentId: getClipboardSlotContextMenuId(slot),
			title: getContextMenuTitle('universalPasteContextMenu', 'Paste copied actions'),
			contexts: ['all'],
			visible: false,
		});
	}
}

function openSidebarFromContextMenu(tabId?: number): void {
	const request: SidebarOpenRequest = { tab: 'tools', userAction: true };
	if (import.meta.env.CHROME) {
		if (tabId !== undefined) {
			void Promise.resolve(openChromeSidePanelFromSenderTab(tabId, request)).then(
				(response) => {
					if (!response.ok) {
						void debugWarn('background', 'Context menu sidebar open failed.', {
							error: response.error,
						});
					}
				}
			);
			return;
		}
		openChromeSidePanelFromUserAction(request);
		return;
	}

	openFirefoxSidebarFromUserAction(request);
}

function isTaskEditorContextMenuUrl(url: unknown): url is string {
	return isAutomationAnywhereUrl(url) && parseAutomationAnywhereTaskEditorRoute(url) !== null;
}

async function getActiveContextMenuTab(): Promise<
	Awaited<ReturnType<typeof browser.tabs.query>>[number] | undefined
> {
	return (await browser.tabs.query({ active: true, lastFocusedWindow: true }))[0];
}

async function refreshBrowserContextMenu(
	tab?: { id?: number; url?: string; active?: boolean }
): Promise<void> {
	const menus = getContextMenusApi();
	if (!menus?.update) return;

	try {
		const activeTab = tab ?? (await getActiveContextMenuTab());
		const enabled = await getBrowserContextMenuEnabled();
		const clipboardVisible = enabled && isTaskEditorContextMenuUrl(activeTab?.url);
		const clipboardValues = clipboardVisible
			? await Promise.all(
					CONTEXT_MENU_CLIPBOARD_SLOTS.map((slot) =>
						universalClipboardSlot(slot).getValue()
					)
				)
			: CONTEXT_MENU_CLIPBOARD_SLOTS.map(() => null);
		await Promise.all([
			Promise.resolve(
				menus.update(OPEN_SIDEBAR_CONTEXT_MENU_ID, {
					visible: enabled,
				})
			),
			Promise.resolve(
				menus.update(UNIVERSAL_CLIPBOARD_CONTEXT_MENU_ID, {
					visible: clipboardVisible,
				})
			),
			...CONTEXT_MENU_CLIPBOARD_SLOTS.map((slot, index) =>
				Promise.resolve(
					menus.update(getClipboardPasteContextMenuId(slot), {
						visible: clipboardVisible && Boolean(clipboardValues[index]?.trim()),
					})
				)
			),
		]);
	} catch (error) {
		void debugWarn('background', 'Context menu visibility update failed.', { error });
	}
}

async function resetBrowserContextMenus(): Promise<void> {
	const menus = getContextMenusApi();
	if (!menus?.removeAll) return;

	try {
		await Promise.resolve(menus.removeAll());
		createBrowserContextMenus();
		await refreshBrowserContextMenu();
	} catch (error) {
		void debugWarn('background', 'Context menu synchronization failed.', { error });
	}
}

async function runClipboardContextMenuAction(
	action: 'copy' | 'paste',
	slot: UniversalClipboardSlot,
	tab?: { id?: number; url?: string }
): Promise<void> {
	if (tab?.id === undefined || !isTaskEditorContextMenuUrl(tab.url)) {
		return;
	}
	if (action === 'paste' && !(await universalClipboardSlot(slot).getValue())?.trim()) return;
	const message: ContentActionMessage = {
		type: action === 'copy' ? 'COPY_TO_SLOT' : 'PASTE_FROM_SLOT',
		slot,
	};

	try {
		await browser.tabs.sendMessage(tab.id, message);
	} catch (error) {
		void debugWarn('background', 'Universal Clipboard context menu action failed.', {
			action,
			slot,
			tabId: tab.id,
			error,
		});
	}
}

function registerBrowserContextMenus(): void {
	const menus = getContextMenusApi();
	if (!menus?.onClicked?.addListener) return;
	if (import.meta.env.FIREFOX) {
		void resetBrowserContextMenus();
	} else {
		browser.runtime.onInstalled.addListener(() => void resetBrowserContextMenus());
	}

	menus.onClicked.addListener((info: any, tab?: { id?: number; url?: string }) => {
		void (async () => {
			if (!(await getBrowserContextMenuEnabled())) return;
			if (info?.menuItemId === OPEN_SIDEBAR_CONTEXT_MENU_ID) {
				openSidebarFromContextMenu(tab?.id);
				return;
			}
			for (const slot of CONTEXT_MENU_CLIPBOARD_SLOTS) {
				if (info?.menuItemId === getClipboardCopyContextMenuId(slot)) {
					await runClipboardContextMenuAction('copy', slot, tab);
					return;
				}
				if (info?.menuItemId === getClipboardPasteContextMenuId(slot)) {
					await runClipboardContextMenuAction('paste', slot, tab);
					return;
				}
			}
		})();
	});

	browserContextMenuEnabled.watch(() => void refreshBrowserContextMenu());
	CONTEXT_MENU_CLIPBOARD_SLOTS.forEach((slot) => {
		universalClipboardSlot(slot).watch(() => void refreshBrowserContextMenu());
	});
	browser.tabs.onActivated.addListener(({ tabId }) => {
		void browser.tabs.get(tabId).then(refreshBrowserContextMenu);
	});
	browser.tabs.onUpdated.addListener((_tabId, changeInfo, tab) => {
		if (!tab.active || (!changeInfo.url && changeInfo.status !== 'complete')) return;
		void refreshBrowserContextMenu(tab);
	});
	browser.windows.onFocusChanged.addListener(() => void refreshBrowserContextMenu());
	void refreshBrowserContextMenu();
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

function getApiRequestTarget(url: string, includeFullUrl = false): Record<string, string> {
	try {
		const parsed = new URL(url);
		return {
			host: parsed.hostname,
			path: `${parsed.pathname}${parsed.search}`,
			...(includeFullUrl ? { url } : {}),
		};
	} catch {
		return includeFullUrl ? { url } : { path: url };
	}
}

function getApiRequestBodyKind(message: AutomationAnywhereApiRequestMessage): string {
	if (message.config.bodyBase64 !== undefined) return 'base64';
	const body = message.config.body;
	if (body === undefined) return 'none';
	const trimmed = body.trim();
	if (!trimmed) return 'empty';
	if (trimmed.startsWith('{')) return 'json-object';
	if (trimmed.startsWith('[')) return 'json-array';
	return 'string';
}

function getApiRequestLogDetails(
	message: AutomationAnywhereApiRequestMessage,
	requestId: string,
	durationMs: number,
	extra: Record<string, unknown> = {},
	includeFullUrl = false
): Record<string, unknown> {
	const method = message.config.method ?? 'GET';
	return {
		requestId,
		method,
		responseType: message.config.responseType ?? 'json',
		bodyKind: getApiRequestBodyKind(message),
		bodyBytes:
			message.config.bodyBase64 === undefined
				? (message.config.body?.length ?? 0)
				: Math.floor((message.config.bodyBase64.length * 3) / 4),
		durationMs,
		...getApiRequestTarget(message.config.url, includeFullUrl),
		...extra,
	};
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
	if (!isAutomationAnywhereApiUrl(message.config.url)) {
		return { ok: false, error: 'Blocked non-Control-Room URL.' };
	}
	const requestId = createNonce();
	const startedAt = Date.now();
	const method = message.config.method ?? 'GET';
	try {
		if (
			message.config.body !== undefined &&
			message.config.bodyBase64 !== undefined
		) {
			throw new Error('API request cannot contain text and binary bodies.');
		}
		const binaryBody = message.config.bodyBase64;
		const body =
			binaryBody === undefined
				? message.config.body
				: Uint8Array.from(atob(binaryBody), (character) => character.charCodeAt(0));
		const response = await fetch(message.config.url, {
			method,
			headers: message.config.headers,
			body,
		});

		if (!response.ok) {
			const error = await readApiError(response);
			void debugWarn(
				'api',
				'Automation Anywhere API request failed.',
				getApiRequestLogDetails(
					message,
					requestId,
					Date.now() - startedAt,
					{ status: response.status, error },
					true
				),
				{ feedback: true, keepDetails: true }
			);
			return {
				ok: false,
				status: response.status,
				error,
			};
		}

		let data: unknown;
		if (message.config.responseType === 'blob') {
			const blob = await response.blob();
			data = {
				blob: await blobToDataUrl(blob),
				type: blob.type,
				size: blob.size,
				fileName: parseContentDispositionFileName(
					response.headers.get('content-disposition')
				),
			};
		} else if (message.config.responseType === 'text') {
			data = await response.text();
		} else if (message.config.responseType === 'bot-content') {
			const headerContent =
				response.headers.get('x-bot-content') ?? response.headers.get('X-Bot-Content');
			data = headerContent
				? parseJsonLike(headerContent)
				: parseJsonLike(await response.text());
		} else {
			const contentType = response.headers.get('content-type') ?? '';
			if (contentType.includes('application/json')) data = await response.json();
			else {
				const text = await response.text();
				data = text ? parseJsonLike(text) : undefined;
			}
		}

		const durationMs = Date.now() - startedAt;
		if (method !== 'GET' || durationMs >= SLOW_API_REQUEST_MS) {
			void debugInfo(
				'api',
				method === 'GET'
					? 'Automation Anywhere API request slow.'
					: 'Automation Anywhere API write completed.',
				getApiRequestLogDetails(message, requestId, durationMs, {
					status: response.status,
				}),
				{ feedback: true, keepDetails: true, debugOnly: true }
			);
		}
		return { ok: true, data };
	} catch (error) {
		void debugError(
			'api',
			'Automation Anywhere API request crashed.',
			getApiRequestLogDetails(
				message,
				requestId,
				Date.now() - startedAt,
				{ error },
				true
			),
			{ feedback: true, keepDetails: true }
		);
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
				openFirefoxSidebarFromUserAction({ userAction: true });
			}
		}
		if (command === 'toggle-styles') {
			void handleSettingsMessage({ type: 'TOGGLE_STYLES' });
		}
	});

	browser.runtime.onMessage.addListener((message: RuntimeMessage, sender) => {
		if (!message || typeof message.type !== 'string') return;
		if (message.type === 'AA_ROUTE_CHANGED') {
			if (sender.tab?.active !== false) {
				void refreshBrowserContextMenu({ ...sender.tab, url: message.url });
			}
			return;
		}
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
	registerBrowserContextMenus();
	if (import.meta.env.CHROME) startRecorderBridge();
});
