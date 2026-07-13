#!/usr/bin/env node
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { importTsModule, root } from './lib/ts-module-loader.mjs';

const { chooseRecorderTab, isMissingRecorderReceiver, isRecorderVerb, normalizeRecorderTabUrl, RECORDER_VERBS, unwrapContentResponse } = await importTsModule(
	join(root, 'src', 'ts', 'recorder', 'protocol.ts')
);
const result = { found: true };

assert.strictEqual(unwrapContentResponse(result), result);
assert.throws(
	() => unwrapContentResponse({ __error: { code: 'NO_MATCH', message: 'Missing' } }),
	(error) => error.code === 'NO_MATCH' && error.message === 'Missing'
);
assert.equal(RECORDER_VERBS.length, 19);
for (const verb of ['debuggerClick', 'toggle', 'selectItemByIndex', 'exists']) {
	assert.equal(isRecorderVerb(verb), true, `${verb} is supported`);
}
assert.equal(isRecorderVerb('navigate'), false);
assert.equal(isMissingRecorderReceiver(new Error('Could not establish connection. Receiving end does not exist.')), true);
assert.equal(isMissingRecorderReceiver(new Error('Navigation timed out.')), false);

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

console.log('Recorder protocol tests passed.');
