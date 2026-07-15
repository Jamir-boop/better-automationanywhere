#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { importTsModule, root } from './lib/ts-module-loader.mjs';

const { chooseRecorderTab, classifyRecorderError, isMissingRecorderReceiver, isRecorderVerb, normalizeRecorderTabUrl, RECORDER_VERBS, unwrapContentResponse } = await importTsModule(
	join(root, 'src', 'ts', 'recorder', 'protocol.ts')
);
const { summarizeSelectOptions } = await importTsModule(
	join(root, 'src', 'ts', 'recorder', 'selector.ts')
);
const result = { found: true };

assert.strictEqual(unwrapContentResponse(result), result);
assert.throws(
	() => unwrapContentResponse({ __error: { code: 'NO_MATCH', message: 'Missing' } }),
	(error) => error.code === 'NO_MATCH' && error.message === 'Missing'
);
assert.equal(RECORDER_VERBS.length, 17);
for (const verb of ['debuggerClick', 'toggle', 'selectItemByIndex', 'setFocus']) {
	assert.equal(isRecorderVerb(verb), true, `${verb} is supported`);
}
assert.equal(isRecorderVerb('navigate'), false);
assert.equal(isMissingRecorderReceiver(new Error('Could not establish connection. Receiving end does not exist.')), true);
assert.equal(isMissingRecorderReceiver(new Error('Navigation timed out.')), false);
assert.deepEqual(classifyRecorderError(new Error('No tab with id: 7.')), {
	code: 'NO_TAB', message: 'No tab with id: 7.',
});
assert.deepEqual(classifyRecorderError(new Error('Navigation timed out.')), {
	code: 'TIMEOUT', message: 'Navigation timed out.',
});
assert.deepEqual(classifyRecorderError({ code: 'NOT_ALLOWED', message: 'Denied' }), {
	code: 'NOT_ALLOWED', message: 'Denied',
});

assert.equal(normalizeRecorderTabUrl('https://example.com/form#person'), 'https://example.com/form');
assert.deepEqual(
	chooseRecorderTab([
		{ id: 1, url: 'https://control-room.example/bot', active: true },
		{ id: 2, url: 'https://example.com/form#old', lastAccessed: 10 },
		{ id: 3, url: 'https://example.com/form', active: true, lastAccessed: 5 },
	], 'https://example.com/form#person'),
	{ id: 3, url: 'https://example.com/form', active: true, lastAccessed: 5 }
);
assert.equal(chooseRecorderTab([{ id: 1, url: 'https://example.com/other' }], 'https://example.com/form'), undefined);

const summarizedOptions = summarizeSelectOptions(
	Array.from({ length: 30 }, (_, index) => index === 0 ? `  ${'x'.repeat(130)}  ` : `Option ${index + 1}`),
	29
);
assert.equal(summarizedOptions.texts.length, 26);
assert.equal(summarizedOptions.texts[0].length, 120);
assert.equal(summarizedOptions.texts[25], 'Option 30');
assert.equal(summarizedOptions.optionCount, 30);
assert.equal(summarizedOptions.optionsTruncated, true);
assert.equal(summarizeSelectOptions(['One', 'Two'], 0).optionsTruncated, false);

const recorderClientSource = await readFile(
	join(root, 'src', 'ts', 'recorder', 'ws-client.ts'),
	'utf8'
);
const recorderContentSource = await readFile(
	join(root, 'entrypoints', 'recorder.content.ts'),
	'utf8'
);
const backgroundSource = await readFile(join(root, 'entrypoints', 'background.ts'), 'utf8');
const sidepanelSource = await readFile(join(root, 'entrypoints', 'sidepanel', 'main.ts'), 'utf8');
const wxtConfigSource = await readFile(join(root, 'wxt.config.ts'), 'utf8');
assert.ok(recorderContentSource.includes("registration: 'runtime'"));
assert.ok(recorderContentSource.includes("include: ['chrome']"));
assert.ok(backgroundSource.includes('if (import.meta.env.CHROME) startRecorderBridge();'));
assert.equal(sidepanelSource.split("import.meta.env.CHROME ? '' : ' hidden'").length - 1, 3);
assert.ok(sidepanelSource.includes("!import.meta.env.CHROME || !recorderBridgeEnabledInput.checked"));
assert.ok(wxtConfigSource.includes("browser === 'chrome' ? ['<all_urls>'] : automationAnywhereMatches"));
assert.ok(!recorderContentSource.includes('RECORDER_CLEANUP_DEBUGGER_CLICK'));
assert.ok(!recorderContentSource.includes('DEBUGGER_TARGET_ATTRIBUTE'));
assert.ok(!recorderClientSource.includes('let stopped'));
assert.ok(recorderClientSource.includes('Controlled tab is no longer active.'));
assert.ok(recorderClientSource.includes("import.meta.env.CHROME ? ['aiSteps'] : []"));
assert.ok(recorderClientSource.includes("message.type === 'listTabs'"));
assert.ok(recorderClientSource.includes('payload.tabId'));
assert.ok(recorderContentSource.includes("request.type === 'observePage'"));
assert.ok(recorderContentSource.includes("element.removeAttribute('data-bra-id')"));
assert.ok(recorderContentSource.includes('braIds: elements.map'));
assert.ok(!recorderContentSource.includes("message.type === 'RECORDER_MASK_RECTS'"));
assert.ok(recorderContentSource.includes('checked=${html.checked}'));
assert.ok(recorderContentSource.includes('summarizeSelectOptions'));
assert.ok(recorderContentSource.includes('> maxChars) continue;'));
assert.ok(!recorderContentSource.includes('> maxChars) break;'));
assert.ok(recorderContentSource.includes('targetDescriptor'));
assert.ok(recorderContentSource.includes('elements,'));
assert.ok(recorderContentSource.includes('setTimeout(cleanup, 1500)'));
assert.ok(recorderContentSource.includes("attachShadow({ mode: 'closed' })"));
assert.ok(recorderContentSource.includes('changed: false'));
assert.ok(recorderClientSource.includes('CAPTURE_INTERVAL_MS = 550'));
assert.ok(
	recorderClientSource.indexOf('browser.tabs.onUpdated.addListener(listener)') <
		recorderClientSource.indexOf('start()'),
	'navigation listener is registered before navigation starts'
);

console.log('Recorder protocol tests passed.');
