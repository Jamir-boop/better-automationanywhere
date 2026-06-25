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
assert.equal(
	mod.getBackgroundColorRgbChannels('rgba(120, 0, 0, 0.25)'),
	'182, 117, 117'
);
assert.equal(mod.getBackgroundColorRgbChannels('#c96'), '204, 153, 102');
assert.deepEqual(
	mod.mixRgbColors(
		{ red: 10, green: 20, blue: 30 },
		{ red: 110, green: 220, blue: 130 },
		0.5
	),
	{ red: 60, green: 120, blue: 80 }
);
assert.equal(
	mod.formatRgbaColorMix(
		{ red: 10, green: 20, blue: 30 },
		{ red: 110, green: 220, blue: 130 },
		0.5,
		0.25
	),
	'rgba(60, 120, 80, 0.25)'
);

console.log('Background color tests passed.');
