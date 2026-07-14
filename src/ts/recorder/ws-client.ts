import {
	DEFAULT_RECORDER_BRIDGE_PORT,
	getRecorderBridgeEnabled,
	getRecorderBridgePort,
	getRecorderBridgeToken,
} from '../settings';
import { chooseRecorderTab, classifyRecorderError, isMissingRecorderReceiver, unwrapContentResponse } from './protocol';

type Envelope = { id: string; type: string; payload?: Record<string, unknown> };
const CAPTURE_INTERVAL_MS = 550;

function error(code: string, message: string) {
	return { ok: false, error: { code, message } };
}

function response(id: string, result: unknown) {
	return { id, ok: true, result };
}

function dataUrlBase64(dataUrl: string): string {
	return dataUrl.slice(dataUrl.indexOf(',') + 1);
}

async function activeTab(): Promise<Awaited<ReturnType<typeof browser.tabs.query>>[number] | undefined> {
	return (await browser.tabs.query({ active: true, currentWindow: true }))[0];
}

export function startRecorderBridge(): void {
	let socket: WebSocket | undefined;
	let reconnectTimer: number | undefined;
	let tabId: number | undefined;
	let lastCaptureAt = 0;

	const send = (value: unknown) => {
		if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(value));
	};
	const close = () => {
		if (reconnectTimer) clearTimeout(reconnectTimer);
		reconnectTimer = undefined;
		socket?.close();
		socket = undefined;
	};
	const schedule = () => {
		if (reconnectTimer) return;
		reconnectTimer = setTimeout(() => {
			reconnectTimer = undefined;
			void connect();
		}, 3000) as unknown as number;
	};
	const ensureContentScript = async () => {
		if (tabId === undefined) throw new Error('No controlled tab.');
		try {
			await browser.tabs.sendMessage(tabId, { type: 'RECORDER_VIEWPORT' });
		} catch (cause) {
			if (!isMissingRecorderReceiver(cause)) throw cause;
			await browser.scripting.executeScript({
				target: { tabId },
				files: ['content-scripts/recorder.js'],
			});
			await browser.tabs.sendMessage(tabId, { type: 'RECORDER_VIEWPORT' });
		}
	};
	const capture = async () => {
		if (tabId === undefined) throw new Error('No controlled tab.');
		const wait = CAPTURE_INTERVAL_MS - (Date.now() - lastCaptureAt);
		if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
		lastCaptureAt = Date.now();
		const tab = await browser.tabs.get(tabId);
		if (!tab.active) {
			throw Object.assign(new Error('Controlled tab is no longer active.'), { code: 'NO_TAB' });
		}
		const [png, viewport] = await Promise.all([
			browser.tabs.captureVisibleTab(tab.windowId, { format: 'png' }),
			browser.tabs.sendMessage(tabId, { type: 'RECORDER_VIEWPORT' }),
		]);
		return { pngBase64: dataUrlBase64(png), ...viewport };
	};
	const forward = async (message: Envelope): Promise<unknown> => {
		if (tabId === undefined) throw new Error('No controlled tab.');
		return unwrapContentResponse(
			await browser.tabs.sendMessage(tabId, {
				type: 'RECORDER_REQUEST',
				request: message,
			})
		);
	};
	const waitForTabComplete = async (controlledTabId: number, start: () => Promise<unknown>) => {
		await new Promise<void>((resolve, reject) => {
			let settled = false;
			const finish = (cause?: unknown) => {
				if (settled) return;
				settled = true;
				clearTimeout(timeout);
				browser.tabs.onUpdated.removeListener(listener);
				if (cause) reject(cause); else resolve();
			};
			const timeout = setTimeout(() => finish(new Error('Navigation timed out.')), 15_000);
			const listener = (updatedId: number, info: { status?: string }) => {
				if (updatedId === controlledTabId && info.status === 'complete') finish();
			};
			browser.tabs.onUpdated.addListener(listener);
			void start()
				.then(() => browser.tabs.get(controlledTabId))
				.then((tab) => { if (tab.status !== 'loading') finish(); })
				.catch(finish);
		});
	};
	const navigate = async (url: string) => {
		if (tabId === undefined) throw new Error('No controlled tab.');
		const controlledTabId = tabId;
		await waitForTabComplete(controlledTabId, () => browser.tabs.update(controlledTabId, { url }));
		await ensureContentScript();
		return { url };
	};
	const settleAfterClick = async () => {
		if (tabId === undefined) return;
		await new Promise((resolve) => setTimeout(resolve, 250));
		const controlledTabId = tabId;
		await waitForTabComplete(controlledTabId, () => browser.tabs.get(controlledTabId));
		await ensureContentScript();
	};
	const selectTab = async (payload: Record<string, unknown>) => {
		const tabs = await browser.tabs.query({});
		const requestedId = Number(payload.tabId);
		const url = String(payload.url ?? '');
		const tab = Number.isInteger(requestedId)
			? tabs.find((candidate) => candidate.id === requestedId)
			: chooseRecorderTab(tabs, url);
		if (tab?.id === undefined) {
			throw Object.assign(new Error(Number.isInteger(requestedId)
				? `No open browser tab has id ${requestedId}`
				: `No open browser tab matches captured URL: ${url}`), { code: 'NO_TAB' });
		}
		tabId = tab.id;
		await browser.tabs.update(tabId, { active: true });
		if (tab.windowId !== undefined) await browser.windows.update(tab.windowId, { focused: true });
		await ensureContentScript();
		return { tabId, url: tab.url };
	};
	const listTabs = async () => ({
		currentTabId: tabId,
		tabs: (await browser.tabs.query({}))
			.filter((tab) => tab.id !== undefined && /^(https?|file):/i.test(tab.url ?? ''))
			.map((tab) => ({
				tabId: tab.id,
				title: tab.title ?? '',
				url: tab.url ?? '',
				active: Boolean(tab.active),
				lastAccessed: tab.lastAccessed ?? 0,
			})),
	});
	const debuggerClick = async (message: Envelope) => {
		if (!import.meta.env.CHROME) {
			throw Object.assign(new Error('debugger click unsupported on this browser'), { code: 'INTERNAL' });
		}
		if (tabId === undefined) throw Object.assign(new Error('No controlled tab.'), { code: 'NO_TAB' });
		const prepared = unwrapContentResponse<{
			rect: { x: number; y: number; width: number; height: number };
			selector: string;
			xpath: string;
			targetDescriptor: Record<string, unknown>;
		}>(await browser.tabs.sendMessage(tabId, { type: 'RECORDER_PREPARE_DEBUGGER_CLICK', request: message }));
		const chromeApi = (globalThis as any).chrome;
		const target = { tabId };
		const x = prepared.rect.x + prepared.rect.width / 2;
		const y = prepared.rect.y + prepared.rect.height / 2;
		let attached = false;
		try {
			await chromeApi.debugger.attach(target, '1.3');
			attached = true;
			await chromeApi.debugger.sendCommand(target, 'Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
			await chromeApi.debugger.sendCommand(target, 'Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
			await chromeApi.debugger.sendCommand(target, 'Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
			return message.type === 'executeVerb'
				? { selector: prepared.selector, xpath: prepared.xpath, targetDescriptor: prepared.targetDescriptor, changed: true }
				: {};
		} finally {
			if (attached) await chromeApi.debugger.detach(target).catch(() => {});
		}
	};
	const handle = async (message: Envelope) => {
		if (message.type === 'ping') return response(message.id, { pong: true });
		try {
			if (message.type === 'listTabs') return response(message.id, await listTabs());
			if (message.type === 'selectTab') return response(message.id, await selectTab(message.payload ?? {}));
			if (message.type === 'screenshot') return response(message.id, await capture());
			if (message.type === 'navigate') return response(message.id, await navigate(String(message.payload?.url ?? '')));
			if (message.type === 'debuggerClick' || (message.type === 'executeVerb' && message.payload?.verb === 'debuggerClick')) {
				const result = await debuggerClick(message);
				await settleAfterClick();
				return response(message.id, result);
			}
			if (message.type === 'executeVerb') {
				const result = await forward(message);
				if (message.payload?.verb === 'click') await settleAfterClick();
				return response(message.id, result);
			}
			return response(message.id, await forward(message));
		} catch (cause) {
			const failure = classifyRecorderError(cause);
			return { id: message.id, ...error(failure.code, failure.message) };
		}
	};
	const connect = async () => {
		if (socket?.readyState === WebSocket.OPEN || socket?.readyState === WebSocket.CONNECTING) return;
		if (!(await getRecorderBridgeEnabled())) return;
		const [port, token, tab] = await Promise.all([getRecorderBridgePort(), getRecorderBridgeToken(), activeTab()]);
		tabId = tab?.id;
		if (tabId === undefined) return schedule();
		const next = new WebSocket(`ws://127.0.0.1:${port || DEFAULT_RECORDER_BRIDGE_PORT}`);
		socket = next;
		next.onopen = () => {
			if (socket === next) send({
				type: 'hello', token, tabId,
				extVersion: browser.runtime.getManifest().version,
				capabilities: import.meta.env.CHROME ? ['aiSteps'] : [],
			});
		};
		next.onmessage = (event) => {
			if (socket !== next) return;
			try {
				const message = JSON.parse(String(event.data)) as Envelope;
				if (message.id && message.type) void handle(message).then(send);
			} catch { /* Ignore invalid server frames. */ }
		};
		next.onclose = () => { if (socket === next) { socket = undefined; schedule(); } };
		next.onerror = () => next.close();
	};
	browser.storage.onChanged.addListener((changes, area) => {
		if (area !== 'local' || !['recorderBridgeEnabled', 'recorderBridgePort', 'recorderBridgeToken'].some((key) => key in changes)) return;
		close();
		void connect();
	});
	void connect();
}
