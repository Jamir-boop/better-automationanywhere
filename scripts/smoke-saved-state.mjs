#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { aaRoot, importTsModule, root } from './lib/ts-module-loader.mjs';
const renderedDir = join(aaRoot, '06-2026', 'rendered');

function escapeRegExp(value) {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function countText(text, value) {
	return (text.match(new RegExp(escapeRegExp(value), 'g')) ?? []).length;
}

function findFile(files, predicate, label) {
	const match = files.find(predicate);
	assert(match, `Missing rendered saved state: ${label}`);
	return match;
}

function assertCount(text, fileName, marker, minimum) {
	const count = countText(text, marker);
	assert(
		count >= minimum,
		`${fileName}: expected ${minimum}+ occurrence(s) of ${marker}, found ${count}`
	);
}

const automationAnywhere = await importTsModule(
	join(root, 'src', 'ts', 'automation-anywhere.ts')
);

assert.equal(
	automationAnywhere.isFolderRepositoryUrl(
		'https://aa-se-latam-2.my.automationanywhere.digital/#/bots/repository/private/folders/100'
	),
	true
);
assert.equal(
	automationAnywhere.isFolderRepositoryUrl(
		'https://aa-se-latam-2.my.automationanywhere.digital/#/bots/repository/private/folders/100/files/task/200/edit'
	),
	false
);
assert(automationAnywhere.EDITOR_PALETTE_TOGGLE_SELECTOR.includes('EditorLayout.paletteResize'));

const files = await readdir(renderedDir);
const folderFile = findFile(
	files,
	(name) => name.includes('Automation (Private)') && name.endsWith('.html'),
	'Automation (Private)'
);
const editorFile = findFile(
	files,
	(name) => name.includes('Edit Task Bot') && !name.includes('running') && name.endsWith('.html'),
	'Edit Task Bot'
);
const runningFile = findFile(
	files,
	(name) => name.includes('Edit Task Bot') && name.includes('running') && name.endsWith('.html'),
	'Edit Task Bot running'
);

const folderText = await readFile(join(renderedDir, folderFile), 'utf8');
assertCount(folderText, folderFile, 'folder-list__items', 1);
assertCount(folderText, folderFile, 'datatable-column', 1);
assertCount(folderText, folderFile, 'datatable-header-container', 1);
assertCount(folderText, folderFile, 'Pathfinder.primaryItems', 1);

const editorText = await readFile(join(renderedDir, editorFile), 'utf8');
assertCount(editorText, editorFile, 'taskbot-canvas-list-node', 1);
assertCount(editorText, editorFile, 'EditorPalette.section.button', 3);
assertCount(editorText, editorFile, 'aa-icon-action-clipboard', 1);
assertCount(editorText, editorFile, 'Pathfinder.primaryItems', 1);
assert(
	/data-path=EditorLayout\.paletteResize[\s\S]{0,700}aria-label="Toggle palette"/.test(
		editorText
	),
	`${editorFile}: missing stable palette toggle marker`
);

const runningText = await readFile(join(renderedDir, runningFile), 'utf8');
assertCount(runningText, runningFile, 'taskbot-canvas-list-node', 1);
assertCount(runningText, runningFile, 'aa-icon-action-clipboard', 1);

console.log('Saved-state smoke checks passed.');
