import { storage } from '#imports';

export type SidepanelTab = 'tools' | 'userstyle' | 'settings';
export type SidepanelFocusTarget = 'actionJson';

export interface SidepanelRequest {
	tab: SidepanelTab;
	focus?: SidepanelFocusTarget;
	nonce: string;
}

export const sidepanelRequest = storage.defineItem<SidepanelRequest | null>(
	'local:sidepanelRequest'
);
