#!/usr/bin/env node
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { importTsModule, root } from './lib/ts-module-loader.mjs';

const mod = await importTsModule(join(root, 'src', 'ts', 'api-health.ts'));

// Registry shape
const ids = mod.API_HEALTH_CHECKS.map((check) => check.id);
assert.ok(ids.length >= 5, 'registry has checks');
assert.equal(new Set(ids).size, ids.length, 'check ids unique');
for (const check of mod.API_HEALTH_CHECKS) {
	for (const field of ['id', 'label', 'feature', 'method', 'path']) {
		assert.ok(check[field], `${check.id} has ${field}`);
	}
	assert.ok(['GET', 'POST'].includes(check.method), `${check.id} method valid`);
	assert.ok(check.path.startsWith('/'), `${check.id} path absolute`);
}
assert.ok(ids.includes('create-file-probe'), 'create probe registered');

// classifyCreateFileProbe
const create = (ok, status, error) => mod.classifyCreateFileProbe({ ok, status, error });
assert.equal(create(false, 400).status, 'pass');
assert.equal(create(false, 415).status, 'pass');
assert.equal(create(false, 422).status, 'pass');
assert.equal(create(false, 404).status, 'fail');
assert.equal(create(false, 405).status, 'fail');
assert.equal(create(false, 401).status, 'warn');
assert.equal(create(false, 403).status, 'warn');
assert.equal(create(true, 200).status, 'warn');
assert.equal(create(false, null).status, 'warn');
assert.equal(create(false, 500).status, 'warn');

// classifyReadProbe
const read = (ok, status, error) => mod.classifyReadProbe({ ok, status, error });
assert.equal(read(true, 200).status, 'pass');
assert.equal(read(false, 404).status, 'fail');
assert.equal(read(false, 405).status, 'fail');
assert.equal(read(false, 401).status, 'warn');
assert.equal(read(false, 403).status, 'warn');
assert.equal(read(false, 500).status, 'fail');

// skipAllApiHealthChecks
const skipped = mod.skipAllApiHealthChecks('no tab');
assert.equal(skipped.length, mod.API_HEALTH_CHECKS.length);
assert.ok(skipped.every((result) => result.status === 'skip' && result.reason === 'no tab'));

// runApiHealthChecks: context gating + create probe never sends non-empty body
{
	const calls = [];
	const fakeApi = {
		probe(path, options) {
			calls.push({ path, ...options });
			return Promise.resolve({ ok: false, status: 400 });
		},
	};
	const results = await mod.runApiHealthChecks(fakeApi, {
		url: '',
		baseUrl: 'https://x',
		hostname: 'x',
		pageType: 'private-folder',
		folderId: '42',
	});
	const byId = new Map(results.map((result) => [result.id, result]));
	assert.equal(byId.get('bot-content').status, 'skip');
	assert.equal(byId.get('folder-list').httpStatus, 400);
	const createCall = calls.find((call) => call.path === '/v2/repository/files');
	assert.deepEqual(createCall.body, {}, 'create probe sends empty body only');
	assert.ok(
		calls.every((call) => !call.path.includes('{')),
		'no unreplaced path placeholders'
	);
}

console.log('API health tests passed.');
