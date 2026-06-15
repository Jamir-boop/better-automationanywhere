#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = join(dirname(fileURLToPath(import.meta.url)), '..');
const pkgPath = join(__dirname, 'package.json');
const wxtPath = join(__dirname, 'wxt.config.ts');

const SEMVER_RE = /^\d+\.\d+\.\d+$/;

async function main() {
  const newVersion = process.argv[2];

  if (!newVersion || !SEMVER_RE.test(newVersion)) {
    console.error('Usage: node scripts/update-version.mjs <semver>');
    console.error('Example: node scripts/update-version.mjs 1.9.2');
    process.exit(1);
  }

  const pkgContent = await readFile(pkgPath, 'utf8');
  const pkg = JSON.parse(pkgContent);
  const currentVersion = pkg.version;

  if (currentVersion === newVersion) {
    console.log(`Already at version ${currentVersion}`);
    process.exit(0);
  }

  console.log(`Current: ${currentVersion}`);
  console.log(`New:     ${newVersion}`);

  const rl = createInterface({ input: stdin, output: stdout });
  const answer = await rl.question('Proceed? [y/N] ');
  rl.close();

  if (answer.toLowerCase() !== 'y') {
    console.log('Aborted');
    process.exit(2);
  }

  pkg.version = newVersion;
  await writeFile(pkgPath, JSON.stringify(pkg, null, 2) + '\n');

  let wxtContent = await readFile(wxtPath, 'utf8');
  wxtContent = wxtContent.replace(/version:\s*'[\d.]+'/, `version: '${newVersion}'`);
  await writeFile(wxtPath, wxtContent);

  console.log(`Updated to ${newVersion}`);
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(3);
});