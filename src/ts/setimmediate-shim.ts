type SetImmediateShim = (
	callback: (...args: unknown[]) => void,
	...args: unknown[]
) => ReturnType<typeof setTimeout>;

const target = globalThis as Record<string, unknown>;

// ponytail: JSZip only needs async scheduling in browser.
if (typeof target.setImmediate !== 'function') {
	target.setImmediate = ((callback, ...args) =>
		setTimeout(() => callback(...args), 0)) as SetImmediateShim;
}

export {};
