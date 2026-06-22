#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const base = `${pkg.name}-${pkg.version}`;
const output = join(root, '.output');

const artifacts = {
	chrome: join(output, `${base}-chrome.zip`),
	firefox: join(output, `${base}-firefox.zip`),
	sources: join(output, `${base}-sources.zip`),
};

for (const artifact of Object.values(artifacts)) {
	if (existsSync(artifact)) continue;
	console.error(`Missing artifact: ${artifact}`);
	console.error('Run `pnpm zip && pnpm zip:firefox` first.');
	process.exit(1);
}

const args = [
	...process.argv.slice(2),
	'--chrome-zip',
	artifacts.chrome,
	'--firefox-zip',
	artifacts.firefox,
	'--firefox-sources-zip',
	artifacts.sources,
];

const bin = join(root, 'node_modules', 'publish-browser-extension', 'bin', 'publish-extension.mjs');
const result = spawnSync(process.execPath, [bin, ...args], { cwd: root, stdio: 'inherit' });

if (result.error) {
	console.error(result.error.message);
	process.exit(1);
}

process.exit(result.status ?? 1);
