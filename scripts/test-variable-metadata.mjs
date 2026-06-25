#!/usr/bin/env node
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { importTsModule, root } from './lib/ts-module-loader.mjs';

const mod = await importTsModule(join(root, 'src', 'ts', 'variable-metadata.ts'));

function labelFor(content, rowName) {
	const lookup = mod.extractVariableMetadataLookup(content);
	return mod.findVariableMetadata(lookup, rowName)?.label ?? null;
}

assert.equal(labelFor({}, 'missing'), null);
assert.equal(labelFor({ variables: 'bad' }, 'missing'), null);

assert.equal(
	labelFor(
		{
			variables: [
				{
					name: 'iStrNew',
					input: true,
					output: true,
					description: 'New\nstring\tvalue',
					defaultValue: 'hello',
				},
			],
		},
		'istrnew'
	),
	`${'\u2191'}${'\u2193'}iStrNew ${'\u2022'} hello`
);

assert.equal(
	labelFor(
		{
			variables: [
				{ name: 'Flag', input: false, output: false, defaultValue: false },
				{ name: 'Count', defaultValue: 0 },
				{ name: 'Empty', defaultValue: '' },
				{ name: 'Nil', defaultValue: null },
			],
		},
		'Flag'
	),
	`Flag ${'\u2022'} false`
);
assert.equal(labelFor({ variables: [{ name: 'Count', defaultValue: 0 }] }, 'count'), `Count ${'\u2022'} 0`);
assert.equal(labelFor({ variables: [{ name: 'Empty', defaultValue: '' }] }, 'empty'), 'Empty');
assert.equal(labelFor({ variables: [{ name: 'Nil', defaultValue: null }] }, 'nil'), 'Nil');
assert.equal(
	labelFor(
		{
			variables: [
				{ name: 'Fallback', description: 'Use description', defaultValue: null },
			],
		},
		'fallback'
	),
	`Fallback ${'\u2022'} Use description`
);

assert.equal(
	labelFor(
		{
			variables: [
				{
					name: 'JsonDefault',
					defaultValue: { path: 'C:\\temp', flags: [true, 0] },
				},
			],
		},
		'jsondefault'
	),
	`JsonDefault ${'\u2022'} {"path":"C:\\\\temp","flags":[true,0]}`
);

assert.equal(
	labelFor(
		{
			variables: [
				{
					name: 'TypedString',
					defaultValue: { type: 'STRING', string: 'hello' },
				},
			],
		},
		'typedstring'
	),
	`TypedString ${'\u2022'} hello`
);

assert.equal(
	labelFor(
		{
			variables: [
				{
					name: 'TypedList',
					defaultValue: { type: 'LIST', string: '["one",2,false]' },
				},
			],
		},
		'typedlist'
	),
	`TypedList ${'\u2022'} ["one",2,false]`
);

assert.equal(
	labelFor(
		{
			variables: [
				{
					name: 'EmptyTypedList',
					defaultValue: { type: 'LIST', string: '[]' },
				},
			],
		},
		'emptytypedlist'
	),
	'EmptyTypedList'
);

assert.equal(
	labelFor(
		{
			variables: [
				{
					name: 'pTableMaestro',
					defaultValue: {
						type: 'TABLE',
						table: {
							schema: [{ type: 'STRING' }],
							rows: [{ values: [{ type: 'STRING', string: '' }] }],
						},
					},
				},
				{
					name: 'pRecMaestro',
					defaultValue: {
						type: 'RECORD',
						record: { schema: [], values: [] },
					},
				},
			],
		},
		'ptablemaestro'
	),
	'pTableMaestro'
);
assert.equal(
	labelFor(
		{
			variables: [
				{
					name: 'pRecMaestro',
					defaultValue: {
						type: 'RECORD',
						record: { schema: [], values: [] },
					},
				},
			],
		},
		'precmaestro'
	),
	'pRecMaestro'
);

assert.equal(
	labelFor(
		{
			variables: [
				{ name: 'Foo', description: 'upper' },
				{ name: 'foo', description: 'lower' },
			],
		},
		'foo'
	),
	`foo ${'\u2022'} lower`
);

assert.equal(
	labelFor(
		{
			variables: [
				{
					name: 'iDictConfig',
					description: 'App config',
					type: 'DICTIONARY',
					input: true,
					subtype: 'STRING',
					defaultValue: { type: 'DICTIONARY', dictionary: [] },
				},
			],
		},
		'idictconfig'
	),
	`${'\u2193'}iDictConfig ${'\u2022'} App config`
);

assert.equal(
	labelFor(
		{
			variables: [
				{
					name: 'iDictEmpty',
					type: 'DICTIONARY',
					defaultValue: { type: 'DICTIONARY', dictionary: [] },
				},
			],
		},
		'idictempty'
	),
	'iDictEmpty'
);

assert.equal(
	labelFor(
		{
			variables: [
				{
					name: 'iDictFilled',
					type: 'DICTIONARY',
					defaultValue: { type: 'DICTIONARY', dictionary: [{ key: 'a', value: '1' }] },
				},
			],
		},
		'idictfilled'
	),
	`iDictFilled ${'\u2022'} [{"key":"a","value":"1"}]`
);

console.log('Variable metadata tests passed.');
