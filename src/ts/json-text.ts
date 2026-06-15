export interface TextMatch {
	start: number;
	end: number;
}

export function getTextMatches(
	text: string,
	query: string,
	matchCase = false
): TextMatch[] {
	if (!query) return [];

	const haystack = matchCase ? text : text.toLowerCase();
	const needle = matchCase ? query : query.toLowerCase();
	const matches: TextMatch[] = [];
	let offset = 0;
	while (offset <= haystack.length) {
		const start = haystack.indexOf(needle, offset);
		if (start < 0) break;
		matches.push({ start, end: start + query.length });
		offset = start + Math.max(query.length, 1);
	}
	return matches;
}

export function getActiveTextMatchIndex(
	matches: TextMatch[],
	selectionStart: number,
	selectionEnd: number
): number {
	return matches.findIndex(
		(match) => match.start === selectionStart && match.end === selectionEnd
	);
}

export function replaceTextMatches(
	text: string,
	matches: TextMatch[],
	replacement: string
): string {
	let result = '';
	let offset = 0;
	for (const match of matches) {
		result += text.slice(offset, match.start);
		result += replacement;
		offset = match.end;
	}
	return result + text.slice(offset);
}

export function formatJsonText(json: string): string {
	return JSON.stringify(JSON.parse(json), null, 2) ?? 'null';
}
