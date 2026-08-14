import {
	Activity,
	ArrowLeft,
	Braces,
	BriefcaseBusiness,
	ChevronLeft,
	ChevronRight,
	ChevronsDown,
	CircleCheckBig,
	CircleHelp,
	CircleMinus,
	CircleStop,
	CircleX,
	ClipboardCopy,
	ClipboardPaste,
	Copy,
	Download,
	ExternalLink,
	FileJson,
	FileUp,
	GitFork,
	Keyboard,
	ListTree,
	Mail,
	PackageCheck,
	PackageSearch,
	Palette,
	Play,
	RefreshCw,
	Replace,
	ReplaceAll,
	RotateCcw,
	ScanSearch,
	ScrollText,
	Settings,
	Share2,
	Square,
	Stethoscope,
	Terminal,
	Toolbox,
	Trash2,
	TriangleAlert,
	Undo2,
} from 'lucide';
import {
	renderIcons,
	setIconContent,
	type BetterAaIconName,
} from '@/src/ts/icons';

const SIDEPANEL_ICONS = {
	Activity,
	ArrowLeft,
	Braces,
	BriefcaseBusiness,
	ChevronLeft,
	ChevronRight,
	ChevronsDown,
	CircleCheckBig,
	CircleHelp,
	CircleMinus,
	CircleStop,
	CircleX,
	ClipboardCopy,
	ClipboardPaste,
	Copy,
	Download,
	ExternalLink,
	FileJson,
	FileUp,
	GitFork,
	Keyboard,
	ListTree,
	Mail,
	PackageCheck,
	PackageSearch,
	Palette,
	Play,
	RefreshCw,
	Replace,
	ReplaceAll,
	RotateCcw,
	ScanSearch,
	ScrollText,
	Settings,
	Share2,
	Square,
	Stethoscope,
	Terminal,
	Toolbox,
	Trash2,
	TriangleAlert,
	Undo2,
};

export function renderLucideIcons(root: Element | Document = document): void {
	renderIcons(SIDEPANEL_ICONS, root);
}

export function setSidepanelIconContent(
	element: HTMLElement,
	name: BetterAaIconName,
	label = ''
): void {
	setIconContent(SIDEPANEL_ICONS, element, name, label);
}

export function setSidepanelIconButtonContent(
	button: HTMLButtonElement,
	name: BetterAaIconName,
	label = ''
): void {
	setSidepanelIconContent(button, name, label);
}
