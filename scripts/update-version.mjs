#!/usr/bin/env node
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pkgPath = join(root, 'package.json');
const readmePath = join(root, 'README.md');
const outputPath = join(root, '.output');

const SEMVER_RE = /^\d+\.\d+\.\d+$/;
const README_VERSION_ROW_RE =
	/^(\|\s*)(?:TODO|\d+\.\d+\.\d+)(\s*)(\|\s*A360 v\.40\+\s*\|)/m;

function relativePath(path) {
	return relative(root, path).replaceAll('\\', '/');
}

async function readTextIfExists(path) {
	try {
		return await readFile(path, 'utf8');
	} catch (error) {
		if (error?.code === 'ENOENT') return null;
		throw error;
	}
}

async function getGeneratedManifestPaths() {
	let entries;
	try {
		entries = await readdir(outputPath, { withFileTypes: true });
	} catch (error) {
		if (error?.code === 'ENOENT') return [];
		throw error;
	}

	return entries
		.filter((entry) => entry.isDirectory())
		.map((entry) => join(outputPath, entry.name, 'manifest.json'));
}

async function collectWrites(newVersion) {
	const writes = [];
	const pkgContent = await readFile(pkgPath, 'utf8');
	const pkg = JSON.parse(pkgContent);
	const currentVersion = pkg.version;

	if (currentVersion !== newVersion) {
		pkg.version = newVersion;
		writes.push({
			path: pkgPath,
			content: `${JSON.stringify(pkg, null, 2)}\n`,
			from: currentVersion,
		});
	}

	const readmeContent = await readTextIfExists(readmePath);
	if (readmeContent) {
		const readmeNext = readmeContent.replace(
			README_VERSION_ROW_RE,
			(_, prefix, _space, suffix) => `${prefix}${newVersion.padEnd(17)}${suffix}`
		);
		if (readmeNext !== readmeContent) {
			writes.push({ path: readmePath, content: readmeNext });
		}
	}

	for (const manifestPath of await getGeneratedManifestPaths()) {
		const manifestContent = await readTextIfExists(manifestPath);
		if (!manifestContent) continue;
		const manifest = JSON.parse(manifestContent);
		if (manifest.version === newVersion) continue;
		manifest.version = newVersion;
		writes.push({
			path: manifestPath,
			content: `${JSON.stringify(manifest)}\n`,
			from: manifestContent.match(/"version":"([^"]+)"/)?.[1],
		});
	}

	return { currentVersion, writes };
}

async function confirm(currentVersion, newVersion, writes) {
	console.log(`Current package: ${currentVersion}`);
	console.log(`New version:     ${newVersion}`);
	console.log('Files:');
	writes.forEach((write) => {
		const suffix = write.from ? ` (${write.from} -> ${newVersion})` : '';
		console.log(`- ${relativePath(write.path)}${suffix}`);
	});

	const rl = createInterface({ input: stdin, output: stdout });
	try {
		const answer = await rl.question('Proceed? [y/N] ');
		return answer.toLowerCase() === 'y';
	} finally {
		rl.close();
	}
}

async function main() {
	const newVersion = process.argv[2];

	if (!newVersion || !SEMVER_RE.test(newVersion)) {
		console.error('Usage: node scripts/update-version.mjs <semver>');
		console.error('Example: node scripts/update-version.mjs 1.10.8');
		process.exit(1);
	}

	const { currentVersion, writes } = await collectWrites(newVersion);
	if (!writes.length) {
		console.log(`Already at version ${newVersion}`);
		return;
	}

	if (!(await confirm(currentVersion, newVersion, writes))) {
		console.log('Aborted');
		process.exit(2);
	}

	await Promise.all(writes.map((write) => writeFile(write.path, write.content)));
	console.log(`Updated ${writes.length} file(s) to ${newVersion}`);
}

main().catch((error) => {
	console.error('Error:', error.message);
	process.exit(3);
});
