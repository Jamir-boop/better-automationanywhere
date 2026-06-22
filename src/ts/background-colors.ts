const MIN_BACKGROUND_LUMA = 136;

export type RgbColor = {
	red: number;
	green: number;
	blue: number;
};

export type ParsedColor = {
	rgb: RgbColor;
	alpha: number;
};

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

function colorLuma({ red, green, blue }: RgbColor): number {
	return red * 0.299 + green * 0.587 + blue * 0.114;
}

export function toHex(value: number): string {
	return clamp(Math.round(value), 0, 255).toString(16).padStart(2, '0');
}

export function hexToRgb(hex: string): RgbColor {
	const normalized = hex.replace('#', '');
	return {
		red: Number.parseInt(normalized.slice(0, 2), 16),
		green: Number.parseInt(normalized.slice(2, 4), 16),
		blue: Number.parseInt(normalized.slice(4, 6), 16),
	};
}

export function formatAlpha(alpha: number): string {
	return String(Math.round(clamp(alpha, 0, 1) * 100) / 100);
}

export function parseCssColorValue(value: string): ParsedColor | null {
	const normalized = value.trim();
	const hexMatch = normalized.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
	if (hexMatch) {
		const hex = hexMatch[1];
		const expanded =
			hex.length === 3
				? hex
						.split('')
						.map((char) => `${char}${char}`)
						.join('')
				: hex;
		return { rgb: hexToRgb(expanded), alpha: 1 };
	}

	const rgbaMatch = normalized.match(
		/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*([0-9.]+))?\s*\)$/i
	);
	if (!rgbaMatch) return null;

	return {
		rgb: {
			red: clamp(Number(rgbaMatch[1]), 0, 255),
			green: clamp(Number(rgbaMatch[2]), 0, 255),
			blue: clamp(Number(rgbaMatch[3]), 0, 255),
		},
		alpha: clamp(rgbaMatch[4] === undefined ? 1 : Number(rgbaMatch[4]), 0, 1),
	};
}

export function clampBackgroundRgb(rgb: RgbColor): RgbColor {
	const luma = colorLuma(rgb);
	if (luma >= MIN_BACKGROUND_LUMA) return rgb;

	const mix = (MIN_BACKGROUND_LUMA - luma) / (255 - luma);
	return {
		red: Math.round(rgb.red + (255 - rgb.red) * mix),
		green: Math.round(rgb.green + (255 - rgb.green) * mix),
		blue: Math.round(rgb.blue + (255 - rgb.blue) * mix),
	};
}

export function formatRgba(rgb: RgbColor, alpha: number): string {
	return `rgba(${rgb.red}, ${rgb.green}, ${rgb.blue}, ${formatAlpha(alpha)})`;
}

export function clampBackgroundColorValue(value: string): string {
	const parsed = parseCssColorValue(value);
	if (!parsed) return value;
	return formatRgba(clampBackgroundRgb(parsed.rgb), parsed.alpha);
}
