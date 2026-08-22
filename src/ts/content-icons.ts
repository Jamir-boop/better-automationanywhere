import {
	Maximize2,
	MessageSquare,
	Minimize2,
	PanelRightOpen,
	Variable,
	Workflow,
	X,
	Zap,
} from 'lucide';
import { setIconContent, type BetterAaIconName } from './icons';

const CONTENT_ICONS = {
	Maximize2,
	MessageSquare,
	Minimize2,
	PanelRightOpen,
	Variable,
	Workflow,
	X,
	Zap,
};

export function setContentIcon(
	element: HTMLElement,
	name: BetterAaIconName,
	label = ''
): void {
	setIconContent(CONTENT_ICONS, element, name, label);
}
