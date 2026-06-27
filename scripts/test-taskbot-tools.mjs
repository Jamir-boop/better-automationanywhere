#!/usr/bin/env node
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { importTsModule, root } from './lib/ts-module-loader.mjs';

const mod = await importTsModule(join(root, 'src', 'ts', 'automation-anywhere.ts'));
const tools = await importTsModule(
	join(root, 'src', 'ts', 'automation-anywhere-tools.ts')
);

assert.deepEqual(
	tools.getAutomationAnywherePackageUpdates(
		[
			{ name: 'Browser', version: '1.0.0' },
			{ name: 'Excel', version: '2.0.0' },
			{ name: 'MissingDefault', version: '3.0.0' },
		],
		new Map([
			['Browser', '1.1.0'],
			['Excel', '2.0.0'],
		])
	),
	[
		{
			name: 'Browser',
			currentVersion: '1.0.0',
			targetVersion: '1.1.0',
		},
	]
);

const privateRoute = mod.parseAutomationAnywhereTaskEditorRoute(
	'https://tenant.my.automationanywhere.digital/bots/repository/private/folders/abc%20123/files/taskbot/bot%20456/edit'
);

assert.deepEqual(privateRoute, {
	workspace: 'private',
	folderId: 'abc 123',
	fileId: 'bot 456',
	mode: 'edit',
});

const publicRoute = mod.parseAutomationAnywhereTaskEditorRoute(
	'https://tenant.my.automationanywhere.digital/bots/repository/public/files/task/789/view'
);

assert.deepEqual(publicRoute, {
	workspace: 'public',
	folderId: undefined,
	fileId: '789',
	mode: 'view',
});

assert.deepEqual(
	mod.parseAutomationAnywhereTaskEditorRoute(
		'https://tenant.my.automationanywhere.digital/#/bots/repository/private/files/task/101221277/view'
	),
	{
		workspace: 'private',
		folderId: undefined,
		fileId: '101221277',
		mode: 'view',
	}
);

assert.equal(
	mod.parseAutomationAnywhereTaskEditorRoute(
		'https://tenant.my.automationanywhere.digital/bots/repository/private/folders/abc'
	),
	null
);

assert.deepEqual(
	mod.parseAutomationAnywherePackageRoute(
		'https://tenant.my.automationanywhere.digital/#/bots/packages/versions/betterComments/view'
	),
	{ packageName: 'betterComments' }
);

assert.deepEqual(
	mod.parseAutomationAnywherePackageRoute(
		'https://tenant.my.automationanywhere.digital/#/bots/packages/versions'
	),
	{}
);

assert.equal(
	mod.isAutomationAnywhereUrl('https://tenant.my.automationanywhere.digital/#/bots/packages'),
	true
);
assert.equal(mod.isAutomationAnywhereUrl('https://chatgpt.com/'), false);

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

assert.deepEqual(
	tools.getAvailableAutomationAnywhereTools(
		{
			url: '',
			baseUrl: '',
			hostname: '',
			pageType: 'public-folder',
		},
		{ universalClipboard: false }
	),
	['copy-files', 'update-packages', 'export-bots']
);

assert.deepEqual(
	tools.getAvailableAutomationAnywhereTools(
		{
			url: '',
			baseUrl: '',
			hostname: '',
			pageType: 'private-folder',
		},
		{ universalClipboard: false }
	),
	['copy-files', 'update-packages', 'export-bots']
);

assert.deepEqual(
	tools.getAvailableAutomationAnywhereTools(
		{
			url: '',
			baseUrl: '',
			hostname: '',
			pageType: 'packages',
			packageName: 'betterComments',
		},
		{ universalClipboard: false }
	),
	['download-packages', 'package-usage']
);

assert.equal(tools.getAutomationAnywherePackageUsageStatusFilter('disabled'), 'DISABLED');
assert.equal(tools.getAutomationAnywherePackageUsageStatusFilter('Disabled'), 'DISABLED');
assert.equal(tools.getAutomationAnywherePackageUsageStatusFilter(undefined), 'ENABLED');
assert.equal(tools.getAutomationAnywherePackageUsageStatusFilter('enabled'), 'ENABLED');

assert.equal(tools.hasMoreAutomationAnywherePackageUsage(20, 20, 45, 200), true);
assert.equal(tools.hasMoreAutomationAnywherePackageUsage(45, 5, 45, 200), false);
assert.equal(tools.hasMoreAutomationAnywherePackageUsage(200, 200, 0, 200), true);
assert.equal(tools.hasMoreAutomationAnywherePackageUsage(201, 1, 0, 200), false);

assert.equal(
	tools.getDefaultTaskbotTool({
		url: '',
		baseUrl: '',
		hostname: '',
		pageType: 'public-folder',
	}, { universalClipboard: false }),
	null
);

console.log('Taskbot tools tests passed.');
