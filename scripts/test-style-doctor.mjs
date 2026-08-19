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
assert.match(
	selectorRegistrySource,
	/export const BOT_MODAL_SELECTOR =\s*'\[data-modal-id="taskbot-action-loading"\], \[data-modal-id="taskbot-action-run-now"\]';/,
	'bot modal selector covers loading and running states'
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

const variableMetadataCheck = checkBlocks.find((block) =>
	block.includes("id: 'editor-palette-variables'")
);
assert.ok(variableMetadataCheck, 'Variable metadata Doctor check exists');
assert.ok(
	variableMetadataCheck.includes('selector: ACTIVE_EDITOR_PALETTE_VARIABLES_SELECTOR'),
	'Variable metadata Doctor check validates active Variables selector'
);
assert.ok(
	variableMetadataCheck.includes("source: 'entrypoints/content.ts'"),
	'Variable metadata Doctor check points to runtime source'
);

const variableMetadataSelectorChecks = [
	['editor-palette-section', 'EDITOR_PALETTE_SECTION_SELECTOR'],
	['variable-row', 'VARIABLE_ROW_SELECTOR'],
	['variable-label', 'VARIABLE_LABEL_SELECTOR'],
	['variable-label-text', 'VARIABLE_LABEL_TEXT_SELECTOR'],
];
for (const [id, constant] of variableMetadataSelectorChecks) {
	const block = checkBlocks.find((candidate) => candidate.includes(`id: '${id}'`));
	assert.ok(block, `${id} Doctor check exists`);
	assert.ok(block.includes(`selector: ${constant}`), `${id} uses ${constant}`);
	assert.ok(block.includes("feature: 'Variable metadata'"), `${id} tagged Variable metadata`);
}

for (const block of checkBlocks) {
	const id = block.match(/id:\s*'([^']+)'/)?.[1] ?? 'unknown';
	for (const field of ['view', 'group', 'label', 'feature', 'selector', 'source', 'severity', 'status']) {
		assert.match(block, new RegExp(`${field}:\\s*`), `${id} has ${field}`);
	}
}

for (const group of ['general', 'taskbot-editor', 'taskbot-transient', 'folder-navigation']) {
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

console.log('Style doctor tests passed.');
