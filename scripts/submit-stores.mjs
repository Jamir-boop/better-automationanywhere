#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const CWS_SCOPE = 'https://www.googleapis.com/auth/chromewebstore';
const CWS_BASE_URL = 'https://chromewebstore.googleapis.com';
const POLL_INTERVAL_MS = 5_000;
const MAX_POLL_ATTEMPTS = 12;

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const envFile = join(root, '.env.submit');
if (existsSync(envFile)) process.loadEnvFile(envFile);

const args = new Set(process.argv.slice(2));
for (const arg of args) {
	if (arg !== '--dry-run') throw new Error(`Unknown argument: ${arg}`);
}

const dryRun = args.has('--dry-run');
const uploadOnly = readBoolean('CHROME_UPLOAD_ONLY', false);
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
	throw new Error(`Missing artifact: ${artifact}\nRun \`pnpm zip && pnpm zip:firefox\` first.`);
}

function requiredEnv(name) {
	const value = process.env[name]?.trim();
	if (!value) throw new Error(`Missing required environment variable: ${name}`);
	return value;
}

function readBoolean(name, fallback) {
	const value = process.env[name]?.trim().toLowerCase();
	if (!value) return fallback;
	if (value === 'true') return true;
	if (value === 'false') return false;
	throw new Error(`${name} must be true or false`);
}

function safeGcloudValue(name) {
	const value = requiredEnv(name);
	if (!/^[a-zA-Z0-9@._-]+$/.test(value)) throw new Error(`${name} contains invalid characters`);
	return value;
}

function getChromeAccessToken() {
	const existing = process.env.CWS_ACCESS_TOKEN?.trim();
	if (existing) return existing;

	const gcloudArgs = [
		'auth',
		'print-access-token',
		`--impersonate-service-account=${safeGcloudValue('SERVICE_ACCOUNT_EMAIL')}`,
		`--scopes=${CWS_SCOPE}`,
		`--project=${safeGcloudValue('CHROME_PROJECT_ID')}`,
	];
	const command = process.platform === 'win32' ? (process.env.ComSpec || 'cmd.exe') : 'gcloud';
	const commandArgs = process.platform === 'win32'
		? ['/d', '/s', '/c', 'gcloud.cmd', ...gcloudArgs]
		: gcloudArgs;
	const result = spawnSync(command, commandArgs, {
		cwd: root,
		encoding: 'utf8',
		windowsHide: true,
	});

	const stderr = result.stderr?.trim() || '';
	if (result.error?.code === 'ENOENT' || /not recognized|not found/i.test(stderr)) {
		throw new Error('Google Cloud CLI not found. Install gcloud, then run `gcloud auth login`.');
	}
	if (result.error) throw result.error;
	if (result.status !== 0) {
		throw new Error(`gcloud failed: ${stderr || `exit code ${result.status}`}`);
	}

	const token = result.stdout.trim();
	if (!token) throw new Error('gcloud returned an empty access token');
	return token;
}

async function chromeRequest(path, token, options = {}) {
	const headers = new Headers(options.headers);
	headers.set('Authorization', `Bearer ${token}`);
	const response = await fetch(`${CWS_BASE_URL}${path}`, { ...options, headers });
	const text = await response.text();
	let body;
	try {
		body = text ? JSON.parse(text) : {};
	} catch {
		body = {};
	}

	if (!response.ok) {
		const message = body.error?.message || text || response.statusText;
		throw new Error(`Chrome Web Store API ${response.status}: ${message}`);
	}
	return body;
}

async function waitForChromeUpload(itemPath, token, initialState) {
	let state = initialState;
	for (let attempt = 0; state === 'IN_PROGRESS' || state === 'UPLOAD_IN_PROGRESS'; attempt++) {
		if (attempt >= MAX_POLL_ATTEMPTS) throw new Error('Chrome upload timed out after 60 seconds');
		await delay(POLL_INTERVAL_MS);
		const status = await chromeRequest(`/v2/${itemPath}:fetchStatus`, token);
		state = status.lastAsyncUploadState;
	}
	if (state !== 'SUCCEEDED') throw new Error(`Chrome upload failed with state: ${state || 'unknown'}`);
}

async function submitChrome() {
	const publisherId = encodeURIComponent(requiredEnv('CHROME_PUBLISHER_ID'));
	const extensionId = encodeURIComponent(requiredEnv('CHROME_EXTENSION_ID'));
	const itemPath = `publishers/${publisherId}/items/${extensionId}`;
	const token = getChromeAccessToken();

	if (dryRun) {
		const status = await chromeRequest(`/v2/${itemPath}:fetchStatus`, token);
		const state = status.submittedItemRevisionStatus?.state
			|| status.publishedItemRevisionStatus?.state
			|| 'NOT_PUBLISHED';
		console.log(`Chrome Web Store: authenticated (${state})`);
		if (status.warned) console.warn('Chrome Web Store: item has a policy warning');
		if (status.takenDown) console.warn('Chrome Web Store: item is taken down');
		return;
	}

	console.log('Chrome Web Store: uploading ZIP');
	const upload = await chromeRequest(`/upload/v2/${itemPath}:upload`, token, {
		method: 'POST',
		headers: { 'Content-Type': 'application/zip' },
		body: readFileSync(artifacts.chrome),
	});
	await waitForChromeUpload(itemPath, token, upload.uploadState);
	console.log(`Chrome Web Store: uploaded ${upload.crxVersion || pkg.version}`);

	if (uploadOnly) {
		console.log('Chrome Web Store: upload-only mode, skipping publish');
		return;
	}

	const published = await chromeRequest(`/v2/${itemPath}:publish`, token, { method: 'POST' });
	console.log(`Chrome Web Store: submitted (${published.state || 'accepted'})`);
}

async function submitFirefox() {
	const bin = join(root, 'node_modules', 'publish-browser-extension', 'bin', 'publish-extension.mjs');
	const firefoxArgs = [
		...(dryRun ? ['--dry-run'] : []),
		'--firefox-zip',
		artifacts.firefox,
		'--firefox-sources-zip',
		artifacts.sources,
	];
	const result = spawnSync(process.execPath, [bin, ...firefoxArgs], {
		cwd: root,
		stdio: 'inherit',
	});
	if (result.error) throw result.error;
	if (result.status !== 0) throw new Error(`Firefox submission failed with exit code ${result.status}`);
}

const failures = [];
for (const [name, submit] of [
	['Chrome Web Store', submitChrome],
	['Firefox Add-ons', submitFirefox],
]) {
	try {
		await submit();
	} catch (error) {
		failures.push(`${name}: ${error.message}`);
	}
}

if (failures.length) {
	for (const failure of failures) console.error(failure);
	process.exitCode = 1;
}
