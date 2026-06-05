import type {
	AutomationAnywhereApiRequestMessage,
	AutomationAnywhereApiResponse,
	BackgroundMessage,
	ContentActionResponse,
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
	commandPaletteShortcut,
	debugEnabled,
	getCommandPaletteShortcut,
	getCommandPaletteShortcutLabel,
	getOpenSidebarShortcut,
	getOpenSidebarShortcutLabel,
	getStylesEnabled,
	normalizeCommandPaletteShortcut,
	normalizeOpenSidebarShortcut,
	openSidebarShortcut,
	runButton,
	showSuggestions,
	soundsEnabled,
	styleFeatureItems,
	styleValueItems,
	stylesEnabled,
} from '../src/ts/settings';
import { debugError, debugInfo, debugWarn } from '../src/ts/debug';

const FALLBACK_OPEN_SIDEBAR_SHORTCUT = 'Alt + Shift + L';

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

	const sidebarAction = (browser as any).sidebarAction;
	try {
		if (request?.userAction) {
			await sidebarAction?.toggle?.();
		} else {
			await sidebarAction?.open?.();
		}
	} catch (error) {
		reportSidebarOpenBlocked(error, request ? 'OPEN_SIDEBAR' : 'open-sidebar');
	}
	await writeSidepanelRequest(request);
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

	browser.runtime.onMessage.addListener((message: BackgroundMessage, sender) => {
		if (!message || typeof message.type !== 'string') return;
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
		if (message.type === 'AA_API_REQUEST') return handleApiRequest(message);
		if (message.type === 'GET_EXTENSION_SHORTCUTS') return getExtensionShortcuts();
		void handleSettingsMessage(message).catch((error) => {
			void debugError('background', 'Settings message failed.', {
				error,
				messageType: message.type,
			}, { feedback: true });
		});
	});

	void setPanelActionBehavior();
});
