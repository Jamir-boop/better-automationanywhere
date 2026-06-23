#!/usr/bin/env node
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { importTsModule, root } from './lib/ts-module-loader.mjs';

const mod = await importTsModule(join(root, 'src', 'ts', 'automation-anywhere.ts'));
const tools = await importTsModule(
	join(root, 'src', 'ts', 'automation-anywhere-tools.ts')
);

const privateRoute = mod.parseAutomationAnywhereTaskEditorRoute(
	'https://tenant.my.automationanywhere.digital/bots/repository/private/folders/abc%20123/files/taskbot/bot%20456/edit'
);

assert.deepEqual(privateRoute, {
	workspace: 'private',
	folderId: 'abc 123',
	fileId: 'bot 456',
});

const publicRoute = mod.parseAutomationAnywhereTaskEditorRoute(
	'https://tenant.my.automationanywhere.digital/bots/repository/public/files/task/789/view'
);

assert.deepEqual(publicRoute, {
	workspace: 'public',
	folderId: undefined,
	fileId: '789',
});

assert.equal(
	mod.parseAutomationAnywhereTaskEditorRoute(
		'https://tenant.my.automationanywhere.digital/bots/repository/private/folders/abc'
	),
	null
);

assert.deepEqual(
	tools.getAvailableAutomationAnywhereTools(
		{
			url: '',
			baseUrl: '',
			hostname: '',
			pageType: 'private-taskbot',
		},
		{ universalClipboard: false }
	),
	['taskbot-json', 'update-packages', 'export-bots']
);

assert.deepEqual(
	tools.getAvailableAutomationAnywhereTools(
		{
			url: '',
			baseUrl: '',
			hostname: '',
			pageType: 'public-taskbot',
		},
		{ universalClipboard: false }
	),
	['taskbot-json', 'export-bots']
);

assert.equal(
	tools
		.getAvailableAutomationAnywhereTools(
			{
				url: '',
				baseUrl: '',
				hostname: '',
				pageType: 'private-taskbot',
			},
			{ universalClipboard: false }
		)
		.includes('copy-files'),
	false
);

assert.equal(
	tools.getDefaultTaskbotTool({
		url: '',
		baseUrl: '',
		hostname: '',
		pageType: 'private-taskbot',
	}, { universalClipboard: true }),
	'universal-clipboard'
);

assert.equal(
	tools.getDefaultTaskbotTool({
		url: '',
		baseUrl: '',
		hostname: '',
		pageType: 'private-taskbot',
	}, { universalClipboard: false }),
	'taskbot-json'
);

console.log('Taskbot tools tests passed.');
