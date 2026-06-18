#!/usr/bin/env node
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { importTsModule, root } from './lib/ts-module-loader.mjs';

const mod = await importTsModule(join(root, 'src', 'ts', 'control-room-version.ts'));
const target = mod.SUPPORTED_CONTROL_ROOM_TARGET;

assert(mod.SUPPORTED_CONTROL_ROOM_TARGETS.length >= 1, 'targets has entries');
assert.strictEqual(mod.SUPPORTED_CONTROL_ROOM_TARGET, mod.SUPPORTED_CONTROL_ROOM_TARGETS[0], 'alias is first');

const mismatch = mod.evaluateControlRoomCompatibility({
	versionNumber: target.versionNumber,
	versionRelease: target.versionRelease,
	buildNumber: '99999',
});
assert.strictEqual(mismatch.supported, true);
assert.strictEqual(mismatch.buildMismatch, true);
assert.strictEqual(mismatch.state, 'supported');

const exact = mod.evaluateControlRoomCompatibility({
	versionNumber: target.versionNumber,
	versionRelease: target.versionRelease,
	buildNumber: target.buildNumber,
});
assert.strictEqual(exact.supported, true);
assert.strictEqual(exact.buildMismatch, false);
assert.strictEqual(exact.state, 'supported');

const unsupported = mod.evaluateControlRoomCompatibility({
	versionNumber: '99.99.99.99',
	versionRelease: 'UNKNOWN',
	buildNumber: '12345',
});
assert.strictEqual(unsupported.supported, false);
assert.strictEqual(unsupported.state, 'unsupported');

const noCurrent = mod.evaluateControlRoomCompatibility(undefined);
assert.strictEqual(noCurrent.state, 'unknown');
assert.strictEqual(noCurrent.supported, false);

const withMessage = mod.evaluateControlRoomCompatibility(undefined, 'test error');
assert.strictEqual(withMessage.message, 'test error');
assert.strictEqual(withMessage.state, 'unknown');

console.log('Control room version tests passed.');
