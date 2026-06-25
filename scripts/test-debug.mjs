#!/usr/bin/env node
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { importTsModule, root } from './lib/ts-module-loader.mjs';

const mod = await importTsModule(join(root, 'src', 'ts', 'debug-utils.ts'));

const long = 'x'.repeat(300);
const error = new Error('boom');
const sanitized = mod.sanitizeDetails(
	{
		authorization: 'Bearer token',
		authToken: 'token',
		cookie: 'session=abc',
		requestBody: '{"secret":true}',
		bodyKind: 'json-object',
		bodyBytes: 100,
		clipboardJson: '{"uid":"abc"}',
		name: 'Visible name',
		long,
		values: Array.from({ length: 20 }, (_, index) => index),
		error,
	},
	false
);

assert.equal(sanitized.authorization, '[redacted]');
assert.equal(sanitized.authToken, '[redacted]');
assert.equal(sanitized.cookie, '[redacted]');
assert.equal(sanitized.requestBody, '[redacted]');
assert.equal(sanitized.bodyKind, 'json-object');
assert.equal(sanitized.bodyBytes, 100);
assert.equal(sanitized.clipboardJson, '[redacted]');
assert.equal(sanitized.name, 'Visible name');
assert.equal(sanitized.long, `${'x'.repeat(240)}...`);
assert.deepEqual(sanitized.values, Array.from({ length: 12 }, (_, index) => index));
assert.deepEqual(sanitized.error, { name: 'Error', message: 'boom' });

const debugSanitized = mod.sanitizeDetails({ error }, true);
assert.equal(debugSanitized.error.name, 'Error');
assert.equal(debugSanitized.error.message, 'boom');
assert.equal(typeof debugSanitized.error.stack, 'string');

const kept = mod.sanitizeDetails({ long, values: [1, 2, 3] }, false, true);
assert.equal(kept.long, long);
assert.deepEqual(kept.values, [1, 2, 3]);

assert.equal(mod.safeSource('  api  '), 'api');
assert.equal(mod.safeSource('  '), 'unknown');
assert.equal(mod.shouldStoreFeedback(false, { debugOnly: true }), false);
assert.equal(mod.shouldStoreFeedback(true, { debugOnly: true }), true);
assert.equal(mod.shouldStoreFeedback(false), true);

const baseEvent = {
	id: '1',
	timestamp: '2026-06-25T00:00:00.000Z',
	level: 'info',
	source: 'tools',
	message: 'same',
};
assert.equal(
	mod.appendFeedbackEvent([baseEvent], {
		...baseEvent,
		id: '2',
		timestamp: '2026-06-25T00:00:01.000Z',
	}).length,
	1
);

const events = [];
for (let index = 0; index < 105; index += 1) {
	events.push({
		id: String(index),
		timestamp: new Date(Date.UTC(2026, 5, 25, 0, 0, index)).toISOString(),
		level: 'info',
		source: 'debug',
		message: `event ${index}`,
	});
}
const capped = mod.appendFeedbackEvent(events.slice(0, 99), events[104]);
assert.equal(capped.length, 100);
assert.equal(capped[0].message, 'event 104');

console.log('Debug tests passed.');
