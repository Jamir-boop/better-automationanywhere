#!/usr/bin/env node
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { importTsModule, root } from './lib/ts-module-loader.mjs';

const mod = await importTsModule(join(root, 'src', 'ts', 'background-colors.ts'));

assert.equal(
	mod.clampBackgroundColorValue('rgba(0, 0, 0, 1)'),
	'rgba(136, 136, 136, 1)'
);
assert.equal(
	mod.clampBackgroundColorValue('rgba(190, 150, 120, 0.5)'),
	'rgba(190, 150, 120, 0.5)'
);
assert.equal(
	mod.clampBackgroundColorValue('rgba(120, 0, 0, 0.25)'),
	'rgba(182, 117, 117, 0.25)'
);

console.log('Background color tests passed.');
