import { storage } from '#imports';

export const DEFAULT_UNIVERSAL_CLIPBOARD_SLOT = 0;
export const UNIVERSAL_CLIPBOARD_SLOTS = [0, 1, 2, 3] as const;

export const universalClipboard =
	storage.defineItem<string | null>('local:universalClipboard');

export function universalClipboardSlot(slot: number): typeof universalClipboard {
	if (slot === DEFAULT_UNIVERSAL_CLIPBOARD_SLOT) return universalClipboard;
	return storage.defineItem<string | null>(`local:universalClipboardSlot${slot}`);
}
