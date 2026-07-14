#!/usr/bin/env node
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { importTsModule, root } from './lib/ts-module-loader.mjs';

const mod = await importTsModule(join(root, 'src', 'ts', 'automation-anywhere.ts'));
const tools = await importTsModule(
	join(root, 'src', 'ts', 'automation-anywhere-tools.ts')
);
const response = await importTsModule(
	join(root, 'src', 'ts', 'automation-anywhere-response.ts')
);
const clipboard = await importTsModule(join(root, 'src', 'ts', 'clipboard-json.ts'));

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

assert.deepEqual(
	tools.splitAutomationPath('\\bots//folder/.././bot.atmx'),
	['bots', 'folder', 'bot.atmx']
);
assert.deepEqual(tools.splitAutomationPath('../.\\'), []);
assert.equal(tools.sanitizeDownloadFileName(' bot:name?.atmx. '), 'bot_name_.atmx');
assert.equal(tools.sanitizeDownloadFileName('CON'), '_CON');
assert.equal(tools.sanitizeDownloadFileName('nul.json'), '_nul.json');
assert.equal(tools.sanitizeDownloadFileName('... '), 'package');
assert.equal(
	tools.getMetadataZipPath({
		botPath: '\\Bots\\..\\Finance\\Invoice.atmx',
		fileName: '..\\variables.json',
	}),
	'Bots\\Finance\\Invoice.atmxMetadata\\variables.json'
);
assert.equal(
	tools.getMetadataZipPath({ botPath: '..\\..', fileName: '..\\..' }),
	'botMetadata\\metadata'
);

assert.deepEqual(
	tools.createDependencyManifestEntry({
		path: '\\Bots\\Invoice.atmx',
		contentType: 'application/vnd.aa.taskbot',
		scannedDependencies: ['\\Bots\\Child.atmx'],
		tags: ['finance'],
	}),
	{
		path: '\\Bots\\Invoice.atmx',
		newPath: null,
		contentType: 'application/vnd.aa.taskbot',
		metadataForFile: null,
		manualDependencies: [],
		scannedDependencies: ['\\Bots\\Child.atmx'],
		manualDependenciesNewPaths: [],
		scannedDependenciesNewPaths: [],
		description: '',
		author: '',
		tags: ['finance'],
		excluded: false,
	}
);

assert.deepEqual(
	tools.createMetadataManifestEntry(
		{ botPath: '\\Bots\\Invoice.atmx', fileName: 'variables.json' },
		'application/json'
	),
	{
		path: '\\Bots\\Invoice.atmx\\variables.json',
		newPath: null,
		contentType: 'application/json',
		metadataForFile: '\\Bots\\Invoice.atmx',
		manualDependencies: null,
		scannedDependencies: null,
		manualDependenciesNewPaths: [],
		scannedDependenciesNewPaths: [],
		description: '',
		author: '',
		tags: [],
		excluded: false,
	}
);

assert.equal(tools.packageMatchesFilter('Browser', 'brow', null), true);
assert.equal(tools.packageMatchesFilter('Browser', 'excel', null), false);
assert.equal(tools.packageMatchesFilter('Browser', '', 'Browser'), true);
assert.equal(tools.packageMatchesFilter('browser', '', 'Browser'), false);

const paginationState = {
	isPackageTool: false,
	packageFallbackScan: false,
	loadedCount: 180,
	loadedTotal: 220,
	lastRawPageLength: 180,
	pageLength: 200,
	packagePageLength: 20,
};
assert.equal(tools.hasMoreAutomationAnywhereItems(paginationState), true);
assert.equal(
	tools.hasMoreAutomationAnywhereItems({ ...paginationState, loadedCount: 220 }),
	false
);
assert.equal(
	tools.hasMoreAutomationAnywhereItems({
		...paginationState,
		isPackageTool: true,
		loadedCount: 20,
		loadedTotal: 40,
		lastRawPageLength: 20,
	}),
	true
);
assert.equal(
	tools.hasMoreAutomationAnywhereItems({
		...paginationState,
		isPackageTool: true,
		packageFallbackScan: true,
		loadedCount: 20,
		loadedTotal: 0,
		lastRawPageLength: 199,
	}),
	false
);

assert.equal(
	response.parseContentDispositionFileName("attachment; filename*=UTF-8''Quarter%201.csv"),
	'Quarter 1.csv'
);
assert.equal(
	response.parseContentDispositionFileName('attachment; filename="report.csv"'),
	'report.csv'
);
assert.equal(
	response.parseContentDispositionFileName("attachment; filename*=UTF-8''bad%name.csv"),
	'bad%name.csv'
);
assert.deepEqual(response.parseJsonLike('{"ok":true}'), { ok: true });
assert.deepEqual(response.parseJsonLike('%7B%22ok%22%3Atrue%7D'), { ok: true });
assert.equal(response.parseJsonLike(' not-json '), 'not-json');
assert.equal(response.extractApiErrorMessage({ errorMessage: 'Denied' }), 'Denied');
assert.equal(response.extractApiErrorMessage({ errors: [{ message: 'Invalid' }] }), 'Invalid');
assert.equal(response.extractApiErrorMessage({ errors: [] }), null);

assert.deepEqual(
	JSON.parse(clipboard.serializeClipboardJsonWithPlaceholder('{"uid":"old","nodes":[]}')),
	{ uid: '__BETTER_AA_UID__', nodes: [] }
);
assert.throws(
	() => clipboard.serializeClipboardJsonWithPlaceholder('[]'),
	/globalClipboard JSON is not an object/
);
assert.equal(
	clipboard.isStorageQuotaExceededError({ name: 'QuotaExceededError' }),
	true
);
assert.equal(
	clipboard.isStorageQuotaExceededError({ name: 'NS_ERROR_DOM_QUOTA_REACHED' }),
	true
);
assert.equal(clipboard.isStorageQuotaExceededError(new Error('write failed')), false);

const chunkSource = {
	uid: 'source',
	sourceFileId: '123',
	nodes: [
		{ uid: 'a', value: 'a'.repeat(20) },
		{ uid: 'b', children: [{ uid: 'nested' }], value: 'b'.repeat(20) },
		{ uid: 'c', value: 'c'.repeat(20) },
	],
	variables: [{ name: 'input' }],
	packages: [{ name: 'Recorder', version: '1' }],
};
const twoNodeLimit = JSON.stringify({
	...chunkSource,
	uid: 'chunk-id',
	nodes: chunkSource.nodes.slice(0, 2),
}).length;
const forwardChunks = clipboard
	.partitionClipboardJson(
		JSON.stringify(chunkSource),
		'forward',
		(candidate) => candidate.length <= twoNodeLimit,
		() => 'chunk-id'
	)
	.map(JSON.parse);
assert.deepEqual(
	forwardChunks.map((chunk) => chunk.nodes.map((node) => node.uid)),
	[
		['a', 'b'],
		['c'],
	]
);
assert.deepEqual(forwardChunks[0].variables, chunkSource.variables);
assert.deepEqual(forwardChunks[1].variables, []);
assert.deepEqual(forwardChunks[1].packages, []);
assert.equal(forwardChunks[0].nodes[1].children[0].uid, 'nested');

const reverseChunks = clipboard
	.partitionClipboardJson(
		JSON.stringify(chunkSource),
		'reverse',
		(candidate) => candidate.length <= twoNodeLimit,
		() => 'chunk-id'
	)
	.map(JSON.parse);
assert.deepEqual(
	reverseChunks.map((chunk) => chunk.nodes.map((node) => node.uid)),
	[
		['b', 'c'],
		['a'],
	]
);
assert.deepEqual(reverseChunks[0].variables, chunkSource.variables);
assert.throws(
	() =>
		clipboard.partitionClipboardJson(
			JSON.stringify({ ...chunkSource, nodes: [chunkSource.nodes[0]] }),
			'forward',
			() => false,
			() => 'chunk-id'
		),
	/single action block/
);
assert.deepEqual(
	JSON.parse(
		clipboard.cleanAutomationAnywhereJson(
			'{"nodes":[{"attributes":[{"value":{"blob":"secret","nested":{"screenshotMetadataPath":"shot","keep":1}}}]}]}'
		)
	),
	{
		nodes: [
			{
				attributes: [
				{
					value: {
						blob: 'secret',
						nested: { screenshotMetadataPath: '', keep: 1 },
					},
					},
				],
			},
		],
	}
);
assert.equal(clipboard.cleanAutomationAnywhereJson('{invalid'), '{invalid');

const resourceClipboard = {
	uid: 'old',
	sourceFileId: 123,
	nodes: [
		{
			attributes: [
				{
					value: {
						blob: 'selector',
						screenshotMetadataPath: 'shot.png',
						nested: { thumbnailMetadataPath: 'shot.png' },
					},
				},
			],
		},
		{
			attributes: [
				{
					value: {
						secure: {
							secureRecordingEnabled: true,
							thumbnailMetadataPath: 'secure.png',
						},
					},
				},
			],
		},
	],
};
assert.deepEqual(clipboard.collectPortableMetadataPaths(resourceClipboard), [
	'shot.png',
]);
assert.equal(clipboard.getNativeClipboardSourceFileId(resourceClipboard), '123');
const portableJson = clipboard.addPortableClipboardEnvelope(
	JSON.stringify(resourceClipboard),
	{
		sourceOrigin: 'https://source.my.automationanywhere.digital',
		sourceFileId: '123',
		resources: {
			'shot.png': { contentType: 'image/png', base64: 'cG5n' },
		},
		missing: [],
	}
);
assert.deepEqual(
	clipboard.getPortableClipboardEnvelope(JSON.parse(portableJson)),
	{
		version: 1,
		sourceOrigin: 'https://source.my.automationanywhere.digital',
		sourceFileId: '123',
		resources: {
			'shot.png': { contentType: 'image/png', base64: 'cG5n' },
		},
		missing: [],
	}
);
const preparedResourceClipboard = JSON.parse(
	clipboard.preparePortableClipboardForPaste(portableJson, {
		targetFileId: '456',
		replacements: new Map([['shot.png', 'target.png']]),
	})
);
assert.equal(preparedResourceClipboard.sourceFileId, '456');
assert.equal(
	preparedResourceClipboard.nodes[0].attributes[0].value.screenshotMetadataPath,
	'target.png'
);
assert.equal(
	preparedResourceClipboard.nodes[0].attributes[0].value.nested.thumbnailMetadataPath,
	'target.png'
);
assert.equal(
	preparedResourceClipboard.nodes[1].attributes[0].value.secure.thumbnailMetadataPath,
	''
);
assert.equal(preparedResourceClipboard.nodes[0].attributes[0].value.blob, 'selector');
assert.equal(
	Object.hasOwn(preparedResourceClipboard, clipboard.PORTABLE_CLIPBOARD_KEY),
	false
);
const reusedResourceClipboard = JSON.parse(
	clipboard.preparePortableClipboardForPaste(portableJson, {
		targetFileId: '123',
		reuseSourceMetadata: true,
	})
);
assert.equal(
	reusedResourceClipboard.nodes[1].attributes[0].value.secure.thumbnailMetadataPath,
	'secure.png'
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

assert.equal(mod.decodeAutomationAnywhereRoutePart('%E0%A4%A'), '%E0%A4%A');
assert.deepEqual(
	mod.parseAutomationAnywhereTaskEditorRoute(
		'https://tenant.my.automationanywhere.digital/bots/repository/private/files/task/%E0%A4%A/edit'
	),
	{
		workspace: 'private',
		folderId: undefined,
		fileId: '%E0%A4%A',
		mode: 'edit',
	}
);

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
assert.equal(mod.isAutomationAnywhereUrl('https://automationanywhere.digital/'), true);
assert.equal(mod.isAutomationAnywhereUrl('https://chatgpt.com/'), false);
assert.equal(
	mod.isAutomationAnywhereUrl('https://evil.example/#automationanywhere.digital'),
	false
);
assert.equal(
	mod.isAutomationAnywhereUrl('https://automationanywhere.digital.evil.example/'),
	false
);
assert.equal(mod.isAutomationAnywhereUrl('not a URL'), false);

assert.equal(
	mod.isAutomationAnywhereApiUrl('https://tenant.my.automationanywhere.digital/v2/files'),
	true
);
assert.equal(mod.isAutomationAnywhereApiUrl('https://automationanywhere.digital/v2/files'), true);
assert.equal(
	mod.isAutomationAnywhereApiUrl('http://tenant.my.automationanywhere.digital/v2/files'),
	false
);
assert.equal(
	mod.isAutomationAnywhereApiUrl('https://evilautomationanywhere.digital/v2/files'),
	false
);
assert.equal(
	mod.isAutomationAnywhereApiUrl('https://evil.example/v2/files#automationanywhere.digital'),
	false
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
	['copy-files', 'update-packages', 'export-bots', 'import-taskbot']
);

// Import taskbot helpers
assert.equal(tools.getImportTaskbotBaseName('My Bot.JSON'), 'My Bot');
assert.equal(tools.getImportTaskbotBaseName('in<va|id?.json'), 'in_va_id_');
assert.equal(tools.getImportTaskbotBaseName('.json'), 'imported-taskbot');
assert.equal(
	tools.getImportTaskbotBaseName(`${'x'.repeat(80)}.json`).length,
	50
);

assert.equal(tools.pickAvailableTaskbotName('Bot', ['Other']), 'Bot');
assert.equal(tools.pickAvailableTaskbotName('Bot', ['bot']), 'Bot_1');
assert.equal(tools.pickAvailableTaskbotName('Bot', ['BOT', 'Bot_1 ']), 'Bot_2');
{
	const longBase = 'x'.repeat(50);
	const next = tools.pickAvailableTaskbotName(longBase, [longBase]);
	assert.equal(next.length, 50);
	assert.ok(next.endsWith('_1'));
}

assert.equal(tools.isTaskbotContentJson({ nodes: [] }), true);
assert.equal(tools.isTaskbotContentJson({ nodes: [], variables: [] }), true);
assert.equal(tools.isTaskbotContentJson({ variables: [] }), false);
assert.equal(tools.isTaskbotContentJson([]), false);
assert.equal(tools.isTaskbotContentJson('{"nodes":[]}'), false);
assert.equal(tools.isTaskbotContentJson(null), false);

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
