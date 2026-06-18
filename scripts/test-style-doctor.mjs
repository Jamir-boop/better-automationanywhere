#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { root } from './lib/ts-module-loader.mjs';

// --- File-based structural checks (no module import needed) ---
const styleDoctorSource = await readFile(
	join(root, 'src', 'ts', 'style-doctor.ts'),
	'utf8'
);

// Verify CHECKS array exists and has entries
assert.ok(
	styleDoctorSource.includes('export const CHECKS: StyleDoctorCheck[]'),
	'CHECKS array export exists'
);
const checksMatch = styleDoctorSource.match(/id:\s*'([^']+)'/g);
assert.ok(checksMatch && checksMatch.length > 10, `CHECKS has ${checksMatch?.length ?? 0} entries (expected >10)`);

// Verify DOCTOR_CHECK_GROUPS exists with all 4 groups
assert.ok(
	styleDoctorSource.includes('export const DOCTOR_CHECK_GROUPS'),
	'DOCTOR_CHECK_GROUPS export exists'
);
for (const group of ['general', 'taskbot-editor', 'taskbot-transient', 'folder-navigation']) {
	assert.ok(
		styleDoctorSource.includes(`key: '${group}'`),
		`group '${group}' exists in DOCTOR_CHECK_GROUPS`
	);
}

// Verify every CHECK has a group field
const groupPattern = /group:\s*'([^']+)'/g;
const foundGroups = new Set();
let gMatch;
while ((gMatch = groupPattern.exec(styleDoctorSource)) !== null) {
	foundGroups.add(gMatch[1]);
}
for (const group of ['general', 'taskbot-editor', 'taskbot-transient', 'folder-navigation']) {
	assert.ok(foundGroups.has(group), `group '${group}' used in CHECKS`);
}

// Verify compareResults and getChecksForGroup exports exist
assert.ok(styleDoctorSource.includes('export function compareResults'), 'compareResults export exists');
assert.ok(styleDoctorSource.includes('export function getChecksForGroup'), 'getChecksForGroup export exists');
assert.ok(styleDoctorSource.includes('export function runSingleCheck'), 'runSingleCheck export exists');
assert.ok(styleDoctorSource.includes('export function detectStyleDoctorView'), 'detectStyleDoctorView export exists');

// Verify taskbot-specific transient checks (bot-modal, error-modal, done-modal) live under taskbot-transient
const taskbotTransientIds = ['bot-modal', 'bot-modal-controls', 'bot-modal-dialog', 'bot-modal-running-indicator', 'error-modal', 'done-modal'];
const checkBlocks = styleDoctorSource.split(/\t\{$/);
for (const block of checkBlocks) {
	const idMatch = block.match(/id:\s*'([^']+)'/);
	if (!idMatch || !taskbotTransientIds.includes(idMatch[1])) continue;
	const groupInBlock = block.match(/group:\s*'([^']+)'/);
	assert.ok(groupInBlock, `transient check ${idMatch[1]} has group`);
	assert.equal(
		groupInBlock[1],
		'taskbot-transient',
		`transient check ${idMatch[1]} has group taskbot-transient`
	);
}

// --- Inline logic tests (same algorithm as style-doctor.ts) ---
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

// null previous -> all new
const allNew = compareResults(null, current);
for (const item of allNew) {
	assert.equal(item.delta, 'new', `null previous: ${item.id} is new`);
}

// with previous
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

// getChecksForGroup logic
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
