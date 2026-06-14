import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

export const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const aaRoot =
	process.env.BETTER_AA_SAVED_STATE_ROOT ??
	'C:\\Users\\superuser\\OneDrive\\dev\\userstyle maintenance framework\\AA';

export async function importTsModule(path) {
	const source = await readFile(path, 'utf8');
	const { outputText } = ts.transpileModule(source, {
		compilerOptions: {
			module: ts.ModuleKind.ES2022,
			target: ts.ScriptTarget.ES2022,
		},
		fileName: path,
	});
	return import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
}
