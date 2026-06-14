#!/usr/bin/env node
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { aaRoot, importTsModule, root } from './lib/ts-module-loader.mjs';

async function readJson(path) {
	return JSON.parse(await readFile(path, 'utf8'));
}

const jsonHelpers = await importTsModule(
	join(root, 'src', 'ts', 'automation-anywhere-json.ts')
);

const fixture = await readJson(
	join(root, 'scripts', 'fixtures', 'taskbot-json-repository-refs.json')
);
assert.equal(jsonHelpers.isAutomationAnywhereJson(fixture), true);
assert.deepEqual(jsonHelpers.getAutomationAnywhereJsonStats(fixture), {
	actionCount: 3,
	variableCount: 1,
});

const references = jsonHelpers.extractAutomationAnywhereRepositoryReferences(fixture);
assert.equal(references.length, 2);
assert.equal(
	references.reduce((total, reference) => total + reference.count, 0),
	3
);
assert(references.every((reference) => reference.paths.every((path) => path.startsWith('$'))));

const childRef = 'repository:///Automation%20Anywhere/Bots/Sample/tasks/child_bot';
const newChildRef = 'repository:///Automation%20Anywhere/Bots/Sample/tasks/new_child_bot';
const replaced = jsonHelpers.replaceAutomationAnywhereRepositoryReferences(
	fixture,
	childRef,
	newChildRef
);
assert.equal(replaced.replaced, 2);
assert.equal(JSON.stringify(replaced.content).includes(childRef), false);
assert.equal(JSON.stringify(replaced.content).includes(newChildRef), true);

const summary = jsonHelpers.summarizeAutomationAnywhereJson(fixture);
assert.equal(summary.actionCount, 3);
assert(summary.packages.some((pkg) => pkg.name === 'TaskBot' && pkg.version === '3.1.0'));
assert(summary.actionsByPackage.some((pkg) => pkg.packageName === 'TaskBot' && pkg.total === 2));

const examplesDir = join(aaRoot, 'taskbot json examples');
if (existsSync(examplesDir)) {
	const exampleNames = (await readdir(examplesDir)).filter((name) =>
		name.toLowerCase().endsWith('.json')
	);
	assert(exampleNames.length > 0);
	for (const name of exampleNames) {
		const content = await readJson(join(examplesDir, name));
		jsonHelpers.getAutomationAnywhereJsonStats(content);
		jsonHelpers.extractAutomationAnywhereRepositoryReferences(content);
		if (jsonHelpers.isAutomationAnywhereJson(content)) {
			jsonHelpers.summarizeAutomationAnywhereJson(content);
		}
	}
}

console.log('TaskBot JSON checks passed.');
