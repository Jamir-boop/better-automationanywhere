export function parseContentDispositionFileName(
	disposition: string | null
): string | undefined {
	if (!disposition) return undefined;
	const encoded = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
	if (encoded) {
		const value = encoded.replace(/"/g, '');
		try {
			return decodeURIComponent(value);
		} catch {
			return value;
		}
	}
	const plain = disposition.match(/filename="?([^";]+)"?/i)?.[1];
	return plain ? plain.trim() : undefined;
}

export function parseJsonLike(value: string): unknown {
	const trimmed = value.trim();
	if (!trimmed) return '';
	try {
		return JSON.parse(trimmed);
	} catch {
		try {
			return JSON.parse(decodeURIComponent(trimmed));
		} catch {
			return trimmed;
		}
	}
}

export function extractApiErrorMessage(data: unknown): string | null {
	if (!data || typeof data !== 'object') return null;
	const record = data as Record<string, unknown>;
	for (const key of ['message', 'error', 'errorMessage', 'detail']) {
		if (typeof record[key] === 'string' && record[key]) return record[key];
	}
	if (Array.isArray(record.errors) && record.errors.length) {
		const first = record.errors[0];
		if (typeof first === 'string') return first;
		if (first && typeof first === 'object') {
			const nested = first as Record<string, unknown>;
			if (typeof nested.message === 'string') return nested.message;
		}
	}
	return null;
}
