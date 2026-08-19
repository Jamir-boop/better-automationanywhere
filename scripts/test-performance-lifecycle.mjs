#!/usr/bin/env node
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { importTsModule, root } from './lib/ts-module-loader.mjs';

const protocol = await importTsModule(
	join(root, 'src', 'ts', 'recorder', 'protocol.ts')
);
assert.deepEqual(protocol.RECORDER_RECONNECT_DELAYS_MS, [3000, 6000, 12000, 20000]);
let elapsed = 0;
let attempts = 1;
for (let index = 0; ; index += 1) {
	const delay = protocol.RECORDER_RECONNECT_DELAYS_MS[
		Math.min(index, protocol.RECORDER_RECONNECT_DELAYS_MS.length - 1)
	];
	if (elapsed + delay > 120_000) break;
	elapsed += delay;
	attempts += 1;
}
assert.equal(attempts, 8);

const readSource = (...parts) => readFile(join(root, ...parts), 'utf8');
const [recorder, content, clipboard, initialize, sounds, sidepanel, ui, slimSidebarStyle, debug, botExecutionModal] = await Promise.all([
	readSource('src', 'ts', 'recorder', 'ws-client.ts'),
	readSource('entrypoints', 'content.ts'),
	readSource('src', 'ts', 'clipboard.ts'),
	readSource('src', 'ts', 'initialize.ts'),
	readSource('src', 'ts', 'sounds.ts'),
	readSource('entrypoints', 'sidepanel', 'main.ts'),
	readSource('src', 'ts', 'ui.ts'),
	readSource('src', 'styl', 'rootSidebarAutoHide.styl'),
	readSource('src', 'ts', 'debug.ts'),
	readSource('src', 'ts', 'bot-execution-modal.ts'),
]);

assert.ok(recorder.includes('RECORDER_RECONNECT_DELAYS_MS'));
assert.ok(recorder.split('reconnectAttempt = 0').length - 1 >= 3);
assert.ok(!content.includes('VARIABLE_METADATA_TTL_MS'));
assert.ok(content.includes('variableMetadataCache.delete(fileId)'));
assert.ok(content.includes('variableMetadataObserver.observe(section'));
assert.ok(content.includes('installNativeSaveListener'));
assert.ok(clipboard.includes('export function setGlobalClipboardWatcherEnabled'));
assert.ok(clipboard.includes('clearInterval(globalClipboardWatcherTimer)'));
assert.ok(content.includes('setGlobalClipboardWatcherEnabled(isTaskEditorUrl(href))'));
assert.ok(content.includes('if (updateScheduled) return'));
assert.ok(!initialize.includes('setInterval('));
assert.ok(initialize.includes('requestAnimationFrame'));
assert.ok(!sounds.includes('setInterval('));
assert.ok(!sounds.includes('captureRunButton'));
assert.ok(!sounds.includes('setTimeout('));
assert.ok(sounds.includes("attributeFilter: ['class']"));
assert.ok(sounds.includes('mutation.addedNodes'));
assert.ok(sounds.includes('wireRunButtons(node)'));
await assert.rejects(access(join(root, 'entrypoints', 'options', 'main.ts')), { code: 'ENOENT' });
assert.ok(sidepanel.includes("await import('./tools')"));
assert.ok(!sidepanel.includes("from './tools'"));
assert.ok(slimSidebarStyle.includes('.main-layout__navigation:has(.pathfinder--is_collapsed):hover'));
assert.ok(!slimSidebarStyle.includes('\n.main-layout__navigation:hover'));
assert.ok(ui.includes('pathFinderCollapseObserver = new MutationObserver'));
assert.ok(ui.includes('pathFinderCollapseObserver?.disconnect()'));
assert.ok(ui.includes('syncPathFinderSlimSidebar(true)'));
assert.ok(ui.includes("attributeFilter: ['class', 'aria-expanded']"));
assert.ok(ui.includes('PATHFINDER_COLLAPSE_WAIT_TIMEOUT_MS'));
assert.ok(ui.includes('observePathFinderCollapseRoot(navigation ?? document.documentElement'));
assert.ok(ui.includes('clearTimeout(pathFinderCollapseObserverTimer)'));
assert.match(
	botExecutionModal,
	/return modal\.matches\(BOT_MODAL_SELECTOR\) && Boolean\(getControlHost\(modal\)\);/,
	'the first Run modal is accepted before its title or spinner updates'
);
assert.ok(!botExecutionModal.includes('hasBotExecutionTitle'));
assert.ok(!botExecutionModal.includes('BOT_MODAL_RUNNING_INDICATOR_SELECTOR'));
const debugLogSource = debug.slice(
	debug.indexOf('export async function debugLog'),
	debug.indexOf('export function debugInfo')
);
assert.ok(debug.includes('async function storeFeedback('));
assert.ok(debugLogSource.includes('await storeFeedback(debugEnabled'));
assert.ok(!debugLogSource.includes('await addFeedback('));

console.log('Performance lifecycle tests passed.');
