import { storage } from '#imports';

export type SidepanelTab = 'tools' | 'appearance' | 'settings' | 'help';
export type SidepanelFocusTarget = 'actionJson' | 'jobs' | 'diagnostics';

export interface SidepanelRequest {
	tab: SidepanelTab;
	focus?: SidepanelFocusTarget;
	nonce: string;
}

export const sidepanelRequest = storage.defineItem<SidepanelRequest | null>(
	'local:sidepanelRequest'
);
