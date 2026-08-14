#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const readSource = (...parts) => readFile(join(root, ...parts), 'utf8');
const [packageJson, icons, sidepanelIcons, contentIcons, main, tools, workbench, content, ui, botModal, sidepanelStyle] =
	await Promise.all([
		readSource('package.json').then(JSON.parse),
		readSource('src', 'ts', 'icons.ts'),
		readSource('entrypoints', 'sidepanel', 'icons.ts'),
		readSource('src', 'ts', 'content-icons.ts'),
		readSource('entrypoints', 'sidepanel', 'main.ts'),
		readSource('entrypoints', 'sidepanel', 'tools.ts'),
		readSource('entrypoints', 'sidepanel', 'json-workbench.ts'),
		readSource('entrypoints', 'content.ts'),
		readSource('src', 'ts', 'ui.ts'),
		readSource('src', 'ts', 'bot-execution-modal.ts'),
		readSource('entrypoints', 'sidepanel', 'style.styl'),
	]);

assert.equal(packageJson.dependencies.lucide, '1.31.0');
assert.ok(icons.includes("from 'lucide'"));
assert.ok(icons.includes('createIcons({ icons, root })'));
assert.ok(!icons.includes('icons as icons'));
assert.ok(icons.includes('aria-hidden="true"'));
assert.ok(sidepanelIcons.includes('SIDEPANEL_ICONS'));
assert.ok(contentIcons.includes('CONTENT_ICONS'));
assert.ok(!contentIcons.includes('BriefcaseBusiness'));
assert.ok(main.includes("icon('toolbox')"));
assert.ok(main.includes("icon('palette')"));
assert.ok(main.includes("icon('settings')"));
assert.ok(main.includes("icon('circle-help')"));
assert.ok(main.includes("icon('git-fork', false)"));
assert.ok(main.includes("icon('mail', false)"));
assert.ok(sidepanelIcons.includes('GitFork'));
assert.ok(sidepanelIcons.includes('Mail'));
assert.equal(
	main.match(/<summary>[^\n]*icon\('chevron-right', false\)/g)?.length,
	5,
	'all shared settings groups show a disclosure chevron'
);
assert.ok(!main.includes('<svg'));
assert.ok(tools.includes('function getToolIcon'));
assert.ok(tools.includes("icon('refresh-cw', false)"));
assert.ok(workbench.includes("icon('replace-all')"));
assert.ok(content.includes("setContentIconButton(button, 'panel-right-open'"));
assert.ok(ui.includes("'variable'"));
assert.ok(ui.includes("'workflow'"));
assert.ok(ui.includes("'zap'"));
assert.ok(botModal.includes("'minimize-2'"));
assert.ok(botModal.includes("'maximize-2'"));
assert.ok(sidepanelStyle.includes('.better-aa-icon'));
assert.ok(sidepanelStyle.includes('fill: none !important'));
assert.ok(sidepanelStyle.includes("&[open] > summary .better-aa-icon"));

console.log('Lucide icon integration tests passed.');
