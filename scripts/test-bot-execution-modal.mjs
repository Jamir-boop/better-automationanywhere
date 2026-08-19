#!/usr/bin/env node
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { parseHTML } from 'linkedom';
import { importTsModule, root } from './lib/ts-module-loader.mjs';

const [dom, selectors] = await Promise.all([
	importTsModule(join(root, 'src', 'ts', 'bot-execution-modal-dom.ts')),
	importTsModule(join(root, 'src', 'ts', 'automation-anywhere-selectors.ts')),
]);

const { document, window } = parseHTML(`
	<div class="modal-backdrop" aria-hidden="true"></div>
	<div role="dialog" aria-modal="true">
		<div data-modal-id="taskbot-action-loading">
			<header class="message__header">
				<div class="message__title-container">Deploying to your computer</div>
			</header>
			<div class="message__controls"><div class="alert__controls"></div></div>
		</div>
	</div>
`);
globalThis.HTMLElement = window.HTMLElement;

const modal = document.querySelector(selectors.BOT_MODAL_SELECTOR);
assert.ok(modal, 'loading modal matches the shared bot modal selector');
const dialog = dom.findBotExecutionModalDialog(modal, selectors.DIALOG_SELECTOR);
const host = dom.findBotExecutionModalControlHost(modal, [
	selectors.MESSAGE_HEADER_SELECTOR,
	selectors.MESSAGE_TITLE_CONTAINER_SELECTOR,
	selectors.ALERT_CONTROLS_SELECTOR,
	selectors.MESSAGE_CONTROLS_SELECTOR,
]);
const backdrop = dom.findBackdropNear(dialog, selectors.MODAL_BACKDROP_SELECTOR);
assert.equal(dialog?.getAttribute('role'), 'dialog');
assert.equal(host?.className, 'message__header');
assert.equal(backdrop?.className, 'modal-backdrop');

const control = document.createElement('button');
control.dataset.betterAaBotModalControl = 'minimize';
host.append(control);
modal.setAttribute('data-modal-id', 'taskbot-action-run-now');
assert.equal(document.querySelector(selectors.BOT_MODAL_SELECTOR), modal);
assert.equal(dom.findBotExecutionModalDialog(modal, selectors.DIALOG_SELECTOR), dialog);
assert.equal(control.closest(selectors.BOT_MODAL_SELECTOR), modal);

console.log('Bot execution modal DOM tests passed.');
