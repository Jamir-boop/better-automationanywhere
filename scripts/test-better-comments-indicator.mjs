#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { DOMParser } from 'linkedom';
import { importTsModule, root } from './lib/ts-module-loader.mjs';

globalThis.DOMParser = DOMParser;

const json = await importTsModule(
	join(root, 'src', 'ts', 'automation-anywhere-json.ts')
);

const betterCommentsNode = (uid, html, overrides = {}) => ({
	uid,
	packageName: 'betterComments',
	commandName: 'BetterComments',
	attributes: [
		{
			name: 'aboutDescription',
			value: {
				type: 'DICTIONARY',
				dictionary: [
					{
						key: 'html',
						value: { type: 'STRING', string: html },
					},
				],
			},
		},
	],
	...overrides,
});

const htmlByUid = json.extractBetterCommentsHtmlByUid({
	nodes: [
		betterCommentsNode(
			'a75783c1-9a67-400a-9914-57e259e86909',
			'<p>this is an html inner comment&nbsp;</p>'
		),
		betterCommentsNode('whitespace', ' '),
		betterCommentsNode('markup-only', '<p><br></p>'),
		betterCommentsNode('empty', ''),
		betterCommentsNode('wrong-package', '<p>hidden</p>', {
			packageName: 'comment',
		}),
		betterCommentsNode('wrong-command', '<p>hidden</p>', {
			commandName: 'OtherAction',
		}),
		{
			uid: 'parent',
			children: [betterCommentsNode('nested', '<p>Nested documentation</p>')],
		},
	],
	packages: [{ name: 'betterComments', version: '99.0.0' }],
});

assert.equal(htmlByUid.size, 4);
assert.equal(
	htmlByUid.get('a75783c1-9a67-400a-9914-57e259e86909'),
	'<p>this is an html inner comment&nbsp;</p>'
);
assert.equal(htmlByUid.get('whitespace'), ' ');
assert.equal(htmlByUid.get('markup-only'), '<p><br></p>');
assert.equal(htmlByUid.get('nested'), '<p>Nested documentation</p>');
assert.equal(htmlByUid.has('empty'), false);
assert.equal(htmlByUid.has('wrong-package'), false);
assert.equal(htmlByUid.has('wrong-command'), false);
assert.deepEqual([...json.extractBetterCommentsHtmlByUid(null)], []);

assert.equal(
	json.getBetterCommentsHtmlPreview(
		'<p>Hello&nbsp; <strong>world</strong></p><script>secret()</script>'
	),
	'Hello world'
);
assert.equal(json.getBetterCommentsHtmlPreview('<p><br></p>'), '');
assert.equal(json.getBetterCommentsHtmlPreview(' '), '');
assert.equal(
	json.getBetterCommentsHtmlPreview(`<p>${'x'.repeat(170)}</p>`),
	`${'x'.repeat(160)}\u2026`
);

const readSource = (...parts) => readFile(join(root, ...parts), 'utf8');
const [content, settings, sidepanel, selectors, styles] = await Promise.all([
	readSource('entrypoints', 'content.ts'),
	readSource('src', 'ts', 'settings.ts'),
	readSource('entrypoints', 'sidepanel', 'main.ts'),
	readSource('src', 'ts', 'automation-anywhere-selectors.ts'),
	readSource('src', 'styl', 'taskbot.styl'),
]);

assert.ok(content.includes('taskbotMetadataCache'));
assert.ok(!content.includes('variableMetadataCache'));
assert.ok(content.includes('extractBetterCommentsHtmlByUid(content)'));
assert.ok(content.includes('analysis.variableMetadata'));
assert.ok(content.includes('analysis.betterCommentsHtmlByUid'));
assert.ok(content.includes('taskbotMetadataCache.delete(fileId)'));
assert.ok(content.includes('syncTaskbotMetadataRoute()'));
assert.ok(content.includes('betterCommentsIndicatorObserver?.disconnect()'));
assert.ok(content.includes("attributeFilter: ['data-node-uid']"));
assert.ok(content.includes("status.append(indicator)"));
assert.ok(content.includes("setContentIcon(indicator, 'message-square')"));
assert.ok(content.includes('TASKBOT_ACTIVE_LIST_TAB_SELECTOR'));
assert.ok(content.includes('TASKBOT_RENDERED_NODE_SELECTOR'));
const indicatorLifecycle = content.slice(
	content.indexOf('function getBetterCommentsIndicatorContext'),
	content.indexOf('const packageUpdateToastFileIds')
);
assert.ok(!indicatorLifecycle.includes('setInterval('));
assert.ok(!indicatorLifecycle.includes('setTimeout('));
assert.ok(settings.includes("'local:betterCommentsIndicatorEnabled'"));
assert.ok(settings.includes('DEFAULT_BETTER_COMMENTS_INDICATOR_ENABLED = true'));
assert.ok(sidepanel.includes('id="betterCommentsIndicatorEnabled"'));
assert.ok(selectors.includes('[data-tab-name="list"][aria-selected="true"]'));
assert.ok(!selectors.includes('TASKBOT_LIST_NODE_SELECTOR'));
assert.ok(styles.includes('.better-aa-better-comments-indicator'));

console.log('Better Comments indicator tests passed.');
