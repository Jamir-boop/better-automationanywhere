import {
	Maximize2,
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
	Minimize2,
	PanelRightOpen,
	Variable,
	Workflow,
	X,
	Zap,
};

export function setContentIconButton(
	button: HTMLButtonElement,
	name: BetterAaIconName,
	label = ''
): void {
	setIconContent(CONTENT_ICONS, button, name, label);
}
