#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const source = await readFile(join(root, 'entrypoints', 'background.ts'), 'utf8');
const listenerStart = source.indexOf('menus.onClicked.addListener');
const listenerEnd = source.indexOf('browserContextMenuEnabled.watch', listenerStart);
assert.ok(listenerStart >= 0 && listenerEnd > listenerStart);

const listener = source.slice(listenerStart, listenerEnd);
const sidebarBranch = listener.indexOf('info?.menuItemId === OPEN_SIDEBAR_CONTEXT_MENU_ID');
const sidebarOpen = listener.indexOf('openSidebarFromContextMenu(tab?.id)', sidebarBranch);
const asyncWork = listener.indexOf('void (async () =>', sidebarBranch);
assert.ok(sidebarBranch >= 0);
assert.ok(sidebarOpen > sidebarBranch && sidebarOpen < asyncWork);
assert.ok(!listener.slice(sidebarBranch, sidebarOpen).includes('await '));
assert.ok(listener.slice(asyncWork).includes('await getBrowserContextMenuEnabled()'));

const firefoxOpenStart = source.indexOf('function openFirefoxSidebarFromUserAction');
const firefoxOpenEnd = source.indexOf('async function openSidebar', firefoxOpenStart);
const firefoxOpen = source.slice(firefoxOpenStart, firefoxOpenEnd);
assert.ok(firefoxOpen.indexOf('sidebarAction?.open?.()') < firefoxOpen.indexOf('queueSidepanelRequest(request)'));

console.log('Firefox sidebar user-action tests passed.');
