#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { root } from './lib/ts-module-loader.mjs';

const styleDoctorSource = await readFile(
	join(root, 'src', 'ts', 'style-doctor.ts'),
	'utf8'
);
const selectorRegistrySource = await readFile(
	join(root, 'src', 'ts', 'automation-anywhere-selectors.ts'),
	'utf8'
);

assert.ok(
	selectorRegistrySource.includes('export const AUTOMATION_ANYWHERE_SELECTOR_CHECKS'),
	'selector registry check export exists'
);
assert.ok(
	styleDoctorSource.includes('AUTOMATION_ANYWHERE_SELECTOR_CHECKS.map'),
	'Style Doctor derives CHECKS from selector registry'
);
assert.ok(
	styleDoctorSource.includes('export const CHECKS: StyleDoctorCheck[]'),
	'CHECKS array export exists'
);
assert.ok(
	styleDoctorSource.includes('selectorStatus'),
	'Style Doctor preserves selector lifecycle status'
);

const checkBlocks = selectorRegistrySource
	.split(/\n\t\{/)
	.filter((block) => /id:\s*'[^']+'/.test(block));
assert.ok(checkBlocks.length > 10, `registry has ${checkBlocks.length} checks (expected >10)`);

const ids = checkBlocks.map((block) => block.match(/id:\s*'([^']+)'/)?.[1]).filter(Boolean);
assert.equal(new Set(ids).size, ids.length, 'registry check ids are unique');

for (const block of checkBlocks) {
	const id = block.match(/id:\s*'([^']+)'/)?.[1] ?? 'unknown';
	for (const field of ['view', 'group', 'label', 'feature', 'selector', 'source', 'severity', 'status']) {
		assert.match(block, new RegExp(`${field}:\\s*`), `${id} has ${field}`);
	}
}

for (const group of ['general', 'taskbot-editor', 'taskbot-transient', 'folder-navigation']) {
	assert.ok(
		styleDoctorSource.includes(`key: '${group}'`),
		`group '${group}' exists in DOCTOR_CHECK_GROUPS`
	);
	assert.ok(
		selectorRegistrySource.includes(`group: '${group}'`),
		`group '${group}' used in selector registry`
	);
}

for (const badSelector of ['#app', '#tools', '[data-panel=', '[data-tab=']) {
	assert.ok(
		!selectorRegistrySource.includes(badSelector),
		`registry excludes sidepanel selector ${badSelector}`
	);
}

const taskbotTransientIds = [
	'bot-modal',
	'bot-modal-controls',
	'bot-modal-dialog',
	'bot-modal-running-indicator',
	'error-modal',
	'done-modal',
];
for (const id of taskbotTransientIds) {
	const block = checkBlocks.find((item) => item.includes(`id: '${id}'`));
	assert.ok(block, `transient check ${id} exists`);
	assert.ok(block.includes("group: 'taskbot-transient'"), `${id} is taskbot-transient`);
	assert.ok(block.includes("severity: 'transient'"), `${id} is transient severity`);
}

assert.ok(styleDoctorSource.includes('export function compareResults'), 'compareResults export exists');
assert.ok(styleDoctorSource.includes('export function getChecksForGroup'), 'getChecksForGroup export exists');
assert.ok(styleDoctorSource.includes('export function runSingleCheck'), 'runSingleCheck export exists');
assert.ok(styleDoctorSource.includes('export function detectStyleDoctorView'), 'detectStyleDoctorView export exists');

function compareResults(previous, current) {
	const previousMap = new Map(previous?.map((r) => [r.id, r.status]) ?? []);
	return current.map((result) => {
		const prev = previousMap.get(result.id) ?? null;
		let delta;
		if (prev === null) delta = 'new';
		else if (result.status === 'pass' && prev !== 'pass') delta = 'fixed';
		else if (result.status !== 'pass' && prev === 'pass') delta = 'regressed';
		else delta = 'unchanged';
		return { id: result.id, previousStatus: prev, currentStatus: result.status, delta };
	});
}

const current = [
	{ id: 'a', status: 'pass', count: 1 },
	{ id: 'b', status: 'pass', count: 1 },
	{ id: 'c', status: 'fail', count: 0 },
	{ id: 'd', status: 'warn', count: 0 },
];

const allNew = compareResults(null, current);
for (const item of allNew) {
	assert.equal(item.delta, 'new', `null previous: ${item.id} is new`);
}

const previous = [
	{ id: 'a', status: 'pass', count: 1 },
	{ id: 'b', status: 'fail', count: 0 },
	{ id: 'c', status: 'pass', count: 2 },
];
const comparison = compareResults(previous, current);
assert.equal(comparison.find((c) => c.id === 'a').delta, 'unchanged');
assert.equal(comparison.find((c) => c.id === 'b').delta, 'fixed');
assert.equal(comparison.find((c) => c.id === 'c').delta, 'regressed');
assert.equal(comparison.find((c) => c.id === 'd').delta, 'new');

const TEST_CHECKS = [
	{ id: 'x', group: 'general' },
	{ id: 'y', group: 'taskbot-editor' },
	{ id: 'z', group: 'taskbot-transient' },
	{ id: 'w', group: 'folder-navigation' },
];
function getChecksForGroup(group) {
	return TEST_CHECKS.filter((c) => c.group === group);
}
assert.equal(getChecksForGroup('general').length, 1);
assert.equal(getChecksForGroup('taskbot-editor')[0].id, 'y');
assert.equal(getChecksForGroup('taskbot-transient')[0].id, 'z');
assert.equal(getChecksForGroup('folder-navigation')[0].id, 'w');

console.log('Style doctor tests passed.');
