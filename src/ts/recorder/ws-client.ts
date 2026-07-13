import {
	DEFAULT_RECORDER_BRIDGE_ENABLED,
	DEFAULT_RECORDER_BRIDGE_PORT,
	getRecorderBridgeEnabled,
	getRecorderBridgePort,
	getRecorderBridgeToken,
} from '../settings';
import { chooseRecorderTab, unwrapContentResponse } from './protocol';

type Envelope = { id: string; type: string; payload?: Record<string, unknown> };

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
	let stopped = false;
	let tabId: number | undefined;

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
		if (stopped || reconnectTimer) return;
		reconnectTimer = setTimeout(() => {
			reconnectTimer = undefined;
			void connect();
		}, 3000) as unknown as number;
	};
	const capture = async () => {
		if (tabId === undefined) throw new Error('No controlled tab.');
		const tab = await browser.tabs.get(tabId);
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
	const navigate = async (url: string) => {
		if (tabId === undefined) throw new Error('No controlled tab.');
		await browser.tabs.update(tabId, { url });
		await new Promise<void>((resolve, reject) => {
			const timeout = setTimeout(() => {
				browser.tabs.onUpdated.removeListener(listener);
				reject(new Error('Navigation timed out.'));
			}, 15_000);
			const listener = (updatedId: number, info: { status?: string }) => {
				if (updatedId !== tabId || info.status !== 'complete') return;
				clearTimeout(timeout);
				browser.tabs.onUpdated.removeListener(listener);
				resolve();
			};
			browser.tabs.onUpdated.addListener(listener);
		});
		return { url };
	};
	const selectTab = async (url: string) => {
		const tab = chooseRecorderTab(await browser.tabs.query({}), url);
		if (tab?.id === undefined) {
			throw Object.assign(new Error(`No open browser tab matches captured URL: ${url}`), { code: 'NO_TAB' });
		}
		tabId = tab.id;
		await browser.tabs.update(tabId, { active: true });
		return { tabId, url: tab.url };
	};
	const debuggerClick = async (message: Envelope) => {
		if (!import.meta.env.CHROME) {
			throw Object.assign(new Error('debugger click unsupported on this browser'), { code: 'INTERNAL' });
		}
		if (tabId === undefined) throw Object.assign(new Error('No controlled tab.'), { code: 'NO_TAB' });
		const prepared = unwrapContentResponse<{
			token: string;
			rect: { x: number; y: number; width: number; height: number };
			selector: string;
			xpath: string;
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
			return message.type === 'executeVerb' ? { selector: prepared.selector, xpath: prepared.xpath } : {};
		} finally {
			if (attached) await chromeApi.debugger.detach(target).catch(() => {});
			await browser.tabs.sendMessage(tabId, { type: 'RECORDER_CLEANUP_DEBUGGER_CLICK', token: prepared.token }).catch(() => {});
		}
	};
	const handle = async (message: Envelope) => {
		if (message.type === 'ping') return response(message.id, { pong: true });
		try {
			if (message.type === 'selectTab') return response(message.id, await selectTab(String(message.payload?.url ?? '')));
			if (message.type === 'screenshot') return response(message.id, await capture());
			if (message.type === 'navigate') return response(message.id, await navigate(String(message.payload?.url ?? '')));
			if (message.type === 'debuggerClick' || (message.type === 'executeVerb' && message.payload?.verb === 'debuggerClick')) {
				return response(message.id, await debuggerClick(message));
			}
			return response(message.id, await forward(message));
		} catch (cause) {
			const bridgeError = cause as { code?: string; message?: string };
			const messageText = cause instanceof Error ? cause.message : bridgeError?.message || 'Request failed.';
			const noTab = ['No controlled', 'Receiving end does not exist', 'Invalid tab', 'Cannot access'].some((text) => messageText.includes(text));
			const code = bridgeError?.code || (noTab ? 'NO_TAB' : messageText.includes('timed out') ? 'TIMEOUT' : 'INTERNAL');
			return { id: message.id, ...error(code, messageText) };
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
			if (socket === next) send({ type: 'hello', token, tabId, extVersion: browser.runtime.getManifest().version });
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
	if (DEFAULT_RECORDER_BRIDGE_ENABLED) void connect();
	else void getRecorderBridgeEnabled().then((enabled) => { if (enabled) void connect(); });
}
