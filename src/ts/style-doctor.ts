import {
	EDITOR_PALETTE_TOGGLE_SELECTOR,
	EDITOR_PALETTE_TOGGLE_QUERY_SELECTOR,
	isFolderRepositoryUrl,
	isTaskEditorUrl,
} from './automation-anywhere';

export type StyleDoctorView = 'taskbot-editor' | 'folder-navigation' | 'unsupported';
export type StyleDoctorResultStatus = 'pass' | 'fail' | 'warn' | 'skip';
export type StyleDoctorSeverity = 'required' | 'optional' | 'transient';
export type DoctorCheckGroup = 'general' | 'taskbot-editor' | 'folder-navigation' | 'taskbot-transient';

export interface StyleDoctorCheck {
	id: string;
	view: StyleDoctorView | 'shared';
	group: DoctorCheckGroup;
	label: string;
	selector: string;
	source: string;
	severity: StyleDoctorSeverity;
	requires?: 'bot-modal' | 'loading-indicator' | 'error-modal' | 'done-modal';
	triggerHint?: string;
}

export interface StyleDoctorCheckResult extends StyleDoctorCheck {
	status: StyleDoctorResultStatus;
	count: number;
	reason?: string;
}

export interface StyleDoctorReport {
	view: StyleDoctorView;
	url: string;
	checked: number;
	passed: number;
	failed: number;
	warnings: number;
	skipped: number;
	results: StyleDoctorCheckResult[];
	message?: string;
}

export interface DoctorComparisonResult {
	id: string;
	previousStatus: StyleDoctorResultStatus | null;
	currentStatus: StyleDoctorResultStatus;
	delta: 'fixed' | 'regressed' | 'unchanged' | 'new';
}

export const DOCTOR_CHECK_GROUPS: { key: DoctorCheckGroup; label: string }[] = [
	{ key: 'general', label: 'General' },
	{ key: 'taskbot-editor', label: 'Taskbot Editor' },
	{ key: 'taskbot-transient', label: 'Taskbot Transient' },
	{ key: 'folder-navigation', label: 'Folder Navigation' },
];

export const CHECKS: StyleDoctorCheck[] = [
	{
		id: 'main-navigation',
		view: 'shared',
		group: 'general',
		label: 'Main navigation',
		selector: '.main-layout__navigation',
		source: 'src/styl/rootSidebarAutoHide.styl',
		severity: 'optional',
	},
	{
		id: 'pathfinder-expander',
		view: 'shared',
		group: 'general',
		label: 'Pathfinder expander',
		selector: 'button[data-path="Pathfinder.expander"], button.pathfinder-tray-expander',
		source: 'src/ts/ui.ts',
		severity: 'optional',
	},
	{
		id: 'pathfinder-collapsed',
		view: 'shared',
		group: 'general',
		label: 'Collapsed Pathfinder',
		selector: '.pathfinder--is_collapsed',
		source: 'src/styl/rootSidebarAutoHide.styl',
		severity: 'transient',
		triggerHint: 'Collapse the Pathfinder sidebar to trigger this state.',
	},
	{
		id: 'page-background',
		view: 'shared',
		group: 'general',
		label: 'Page background',
		selector: '.page, .main-layout__content',
		source: 'src/styl/background.styl',
		severity: 'optional',
	},
	{
		id: 'sidebar-nav-links',
		view: 'shared',
		group: 'general',
		label: 'Sidebar navigation links',
		selector: 'nav[data-path="Pathfinder.primaryItems"] a[href^="#/"]',
		source: 'src/ts/commands.ts',
		severity: 'optional',
	},
	{
		id: 'loading-indicator',
		view: 'shared',
		group: 'general',
		label: 'Loading indicator',
		selector: '.devicechannelmodal .icon-image-container, .rio-spinner--variant_LOADING, .rio-spinner--variant_WORKING',
		source: 'src/styl/customLoadingIcon.styl',
		severity: 'transient',
		requires: 'loading-indicator',
		triggerHint: 'Navigate to a page that triggers a loading spinner.',
	},
	{
		id: 'taskbot-editor-layout',
		view: 'taskbot-editor',
		group: 'taskbot-editor',
		label: 'Taskbot editor layout',
		selector: '.editor-layout__palette',
		source: 'src/ts/ui.ts',
		severity: 'required',
	},
	{
		id: 'taskbot-canvas-node',
		view: 'taskbot-editor',
		group: 'taskbot-editor',
		label: 'Taskbot canvas node',
		selector: '.taskbot-canvas-list-node',
		source: 'src/styl/editorMain.styl',
		severity: 'required',
	},
	{
		id: 'taskbot-line-number',
		view: 'taskbot-editor',
		group: 'taskbot-editor',
		label: 'Taskbot line numbers',
		selector: '.taskbot-canvas-list-node > .taskbot-canvas-list-node__number',
		source: 'src/ts/commands.ts',
		severity: 'optional',
	},
	{
		id: 'taskbot-clickable-line-number',
		view: 'taskbot-editor',
		group: 'taskbot-editor',
		label: 'Clickable line numbers',
		selector: '.taskbot-canvas-list-node > .taskbot-canvas-list-node__number.taskbot-canvas-list-node__number--clickable',
		source: 'src/styl/editorMain.styl',
		severity: 'optional',
	},
	{
		id: 'taskbot-node-link',
		view: 'taskbot-editor',
		group: 'taskbot-editor',
		label: 'Taskbot node label link',
		selector: '.taskbot-canvas-list-node__title a.taskbotnodelabel-details-link[href]',
		source: 'src/ts/utils.ts',
		severity: 'optional',
	},
	{
		id: 'editor-palette',
		view: 'taskbot-editor',
		group: 'taskbot-editor',
		label: 'Editor palette',
		selector: '.editor-palette',
		source: 'src/styl/editorActionsVariablesTriggers.styl',
		severity: 'required',
	},
	{
		id: 'editor-palette-scroller',
		view: 'taskbot-editor',
		group: 'taskbot-editor',
		label: 'Editor palette scroller',
		selector: '.editor-palette-section__scroller',
		source: 'src/ts/ui.ts',
		severity: 'optional',
	},
	{
		id: 'editor-palette-toggle',
		view: 'taskbot-editor',
		group: 'taskbot-editor',
		label: 'Editor palette toggle',
		selector: EDITOR_PALETTE_TOGGLE_QUERY_SELECTOR,
		source: 'src/ts/utils.ts',
		severity: 'optional',
	},
	{
		id: 'editor-palette-actions',
		view: 'taskbot-editor',
		group: 'taskbot-editor',
		label: 'Actions palette button',
		selector: 'div.editor-palette__accordion button[aria-label="Actions"], button[data-path="EditorPalette.section.button"][aria-label="Actions"]',
		source: 'src/ts/commands.ts',
		severity: 'optional',
	},
	{
		id: 'editor-palette-variables',
		view: 'taskbot-editor',
		group: 'taskbot-editor',
		label: 'Variables palette button',
		selector: 'button[data-path="EditorPalette.section.button"][aria-label="Variables"]',
		source: 'src/ts/commands.ts',
		severity: 'optional',
	},
	{
		id: 'editor-palette-triggers',
		view: 'taskbot-editor',
		group: 'taskbot-editor',
		label: 'Triggers palette button',
		selector: 'button.editor-palette-section__header-button[data-path="EditorPalette.section.button"][aria-label="Triggers"]',
		source: 'src/ts/commands.ts',
		severity: 'optional',
	},
	{
		id: 'editor-palette-search-cancel',
		view: 'taskbot-editor',
		group: 'taskbot-editor',
		label: 'Palette search cancel',
		selector: '.editor-palette-search__cancel button[type="button"][tabindex="-1"]',
		source: 'src/ts/commands.ts',
		severity: 'transient',
	},
	{
		id: 'editor-draggable-child',
		view: 'taskbot-editor',
		group: 'taskbot-editor',
		label: 'Draggable palette item',
		selector: '.editor-palette-item__child--is_draggable',
		source: 'src/styl/taskbot.styl',
		severity: 'optional',
	},
	{
		id: 'editor-tabs',
		view: 'taskbot-editor',
		group: 'taskbot-editor',
		label: 'Editor tabs',
		selector: '.taskbot-editor__toolbar__tabs > .editortabs[role="tablist"][data-path="EditorTabs"]',
		source: 'src/styl/editorTabsButtons.styl',
		severity: 'optional',
	},
	{
		id: 'run-button',
		view: 'taskbot-editor',
		group: 'taskbot-editor',
		label: 'Run button',
		selector: 'button[aria-label="Run"][name="run"], button[name="run"]',
		source: 'src/styl/editorRunButton.styl',
		severity: 'optional',
	},
	{
		id: 'code-input',
		view: 'taskbot-editor',
		group: 'taskbot-editor',
		label: 'Code input',
		selector: '[data-path="CodeInput"]',
		source: 'src/styl/codeInput.styl',
		severity: 'optional',
	},
	{
		id: 'shared-copy-button',
		view: 'taskbot-editor',
		group: 'taskbot-editor',
		label: 'Shared copy button',
		selector: '.aa-icon-action-clipboard-copy--shared',
		source: 'src/ts/clipboard.ts',
		severity: 'optional',
	},
	{
		id: 'shared-paste-button',
		view: 'taskbot-editor',
		group: 'taskbot-editor',
		label: 'Shared paste button',
		selector: '.aa-icon-action-clipboard-paste--shared',
		source: 'src/ts/clipboard.ts',
		severity: 'optional',
	},
	{
		id: 'bot-modal',
		view: 'taskbot-editor',
		group: 'taskbot-transient',
		label: 'Running bot modal',
		selector: '[data-modal-id="taskbot-action-run-now"]',
		source: 'src/ts/bot-execution-modal.ts',
		severity: 'transient',
		requires: 'bot-modal',
		triggerHint: 'Click Run on a taskbot to trigger the running bot modal.',
	},
	{
		id: 'bot-modal-controls',
		view: 'taskbot-editor',
		group: 'taskbot-transient',
		label: 'Running bot modal controls',
		selector: '.alert__controls, .message__controls, .message__title-container',
		source: 'src/ts/bot-execution-modal.ts',
		severity: 'transient',
		requires: 'bot-modal',
		triggerHint: 'Click Run on a taskbot to trigger the running bot modal.',
	},
	{
		id: 'bot-modal-dialog',
		view: 'taskbot-editor',
		group: 'taskbot-transient',
		label: 'Running bot dialog',
		selector: '[data-modal-id="taskbot-action-run-now"] [role="dialog"], [role="dialog"] [data-modal-id="taskbot-action-run-now"]',
		source: 'src/ts/bot-execution-modal.ts',
		severity: 'transient',
		requires: 'bot-modal',
		triggerHint: 'Click Run on a taskbot to trigger the running bot modal.',
	},
	{
		id: 'bot-modal-running-indicator',
		view: 'taskbot-editor',
		group: 'taskbot-transient',
		label: 'Running indicator',
		selector: '.devicechannelmodal, .rio-spinner--variant_WORKING',
		source: 'src/ts/bot-execution-modal.ts',
		severity: 'transient',
		requires: 'bot-modal',
		triggerHint: 'Click Run on a taskbot to trigger the running indicator.',
	},
	{
		id: 'error-modal',
		view: 'taskbot-editor',
		group: 'taskbot-transient',
		label: 'Error modal',
		selector: '.modal--theme_error',
		source: 'src/ts/sounds.ts',
		severity: 'transient',
		requires: 'error-modal',
		triggerHint: 'Run a taskbot that triggers an error to see this modal.',
	},
	{
		id: 'done-modal',
		view: 'taskbot-editor',
		group: 'taskbot-transient',
		label: 'Done modal',
		selector: '.taskbot-success',
		source: 'src/ts/sounds.ts',
		severity: 'transient',
		requires: 'done-modal',
		triggerHint: 'Run a taskbot to completion to see the done modal.',
	},
	{
		id: 'folder-list',
		view: 'folder-navigation',
		group: 'folder-navigation',
		label: 'Folder list',
		selector: '.folder-list__items',
		source: 'src/styl/foldersScrollable.styl',
		severity: 'required',
	},
	{
		id: 'folder-list-item',
		view: 'folder-navigation',
		group: 'folder-navigation',
		label: 'Folder list item',
		selector: '.folder-list-item',
		source: 'src/styl/foldersScrollable.styl',
		severity: 'required',
	},
	{
		id: 'active-folder',
		view: 'folder-navigation',
		group: 'folder-navigation',
		label: 'Active folder',
		selector: '.folder-list-item--is_active',
		source: 'src/ts/folders.ts',
		severity: 'optional',
	},
	{
		id: 'folder-table-row',
		view: 'folder-navigation',
		group: 'folder-navigation',
		label: 'Folder table row',
		selector: '.datatable-row',
		source: 'src/styl/foldersColumns.styl',
		severity: 'optional',
	},
	{
		id: 'folder-table-column',
		view: 'folder-navigation',
		group: 'folder-navigation',
		label: 'Folder table column',
		selector: '.datatable-column',
		source: 'src/styl/foldersColumns.styl',
		severity: 'required',
	},
	{
		id: 'folder-table-header',
		view: 'folder-navigation',
		group: 'folder-navigation',
		label: 'Folder table header',
		selector: '.datatable-header-container',
		source: 'src/styl/foldersColumns.styl',
		severity: 'optional',
	},
	{
		id: 'folder-refresh',
		view: 'folder-navigation',
		group: 'folder-navigation',
		label: 'Folder refresh button',
		selector: '[name="table-refresh"]',
		source: 'entrypoints/content.ts',
		severity: 'optional',
	},
	{
		id: 'folder-page-title',
		view: 'folder-navigation',
		group: 'folder-navigation',
		label: 'Folder page title',
		selector: '.pagetitle-label',
		source: 'src/styl/foldersScrollable.styl',
		severity: 'optional',
	},
];

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function countSelector(selector: string): number {
	return document.querySelectorAll(selector).length;
}

function hasSelector(selector: string): boolean {
	return countSelector(selector) > 0;
}

export function detectStyleDoctorView(): StyleDoctorView {
	if (
		isTaskEditorUrl(location.href) ||
		hasSelector('.editor-layout__palette, .taskbot-canvas-list-node, .editor-layout__canvas')
	) {
		return 'taskbot-editor';
	}
	if (
		isFolderRepositoryUrl(location.href) ||
		hasSelector('.folder-list__items, .folder-list-item, .datatable-column')
	) {
		return 'folder-navigation';
	}
	return 'unsupported';
}

function isPaletteClosed(): boolean {
	const palette = document.querySelector<HTMLElement>('.editor-layout__palette');
	return !palette || palette.offsetWidth <= 8;
}

async function openPaletteForProbe(view: StyleDoctorView): Promise<() => Promise<void>> {
	if (view !== 'taskbot-editor') return async () => {};
	const wasClosed = isPaletteClosed();
	if (!wasClosed) return async () => {};
	const toggle =
		document.querySelector<HTMLElement>(EDITOR_PALETTE_TOGGLE_SELECTOR) ??
		document.querySelector<HTMLElement>(EDITOR_PALETTE_TOGGLE_QUERY_SELECTOR);
	if (!toggle) return async () => {};
	toggle.click();
	await sleep(350);
	return async () => {
		const restoreToggle = document.querySelector<HTMLElement>(
			EDITOR_PALETTE_TOGGLE_QUERY_SELECTOR
		);
		if (restoreToggle && !isPaletteClosed()) {
			restoreToggle.click();
			await sleep(150);
		}
	};
}

function requirementPresent(requirement: StyleDoctorCheck['requires']): boolean {
	if (!requirement) return true;
	if (requirement === 'bot-modal') {
		return hasSelector('[data-modal-id="taskbot-action-run-now"]');
	}
	if (requirement === 'loading-indicator') {
		return hasSelector('.devicechannelmodal, .rio-spinner--variant_LOADING, .rio-spinner--variant_WORKING');
	}
	if (requirement === 'error-modal') return hasSelector('.modal--theme_error');
	if (requirement === 'done-modal') return hasSelector('.taskbot-success');
	return true;
}

function shouldRunCheck(check: StyleDoctorCheck, view: StyleDoctorView): boolean {
	return check.view === 'shared' || check.view === view;
}

function checkSelector(check: StyleDoctorCheck): StyleDoctorCheckResult {
	if (!requirementPresent(check.requires)) {
		return {
			...check,
			status: 'skip',
			count: 0,
			reason: 'Transient UI not present.',
		};
	}

	try {
		const count = countSelector(check.selector);
		if (count > 0) return { ...check, status: 'pass', count };
		if (check.severity === 'required') {
			return { ...check, status: 'fail', count, reason: 'Required selector missing.' };
		}
		if (check.severity === 'optional') {
			return { ...check, status: 'warn', count, reason: 'Optional selector missing.' };
		}
		return { ...check, status: 'skip', count, reason: 'Transient selector missing.' };
	} catch (error) {
		return {
			...check,
			status: 'fail',
			count: 0,
			reason: error instanceof Error ? error.message : 'Selector query failed.',
		};
	}
}

export function runSingleCheck(checkId: string): StyleDoctorCheckResult | null {
	const check = CHECKS.find((c) => c.id === checkId);
	if (!check) return null;
	return checkSelector(check);
}

export function getChecksForGroup(group: DoctorCheckGroup): StyleDoctorCheck[] {
	return CHECKS.filter((c) => c.group === group);
}

export function getChecksForView(view: StyleDoctorView): StyleDoctorCheck[] {
	return CHECKS.filter((c) => shouldRunCheck(c, view));
}

export function compareResults(
	previous: StyleDoctorCheckResult[] | null,
	current: StyleDoctorCheckResult[]
): DoctorComparisonResult[] {
	const previousMap = new Map(previous?.map((r) => [r.id, r.status]) ?? []);
	return current.map((result) => {
		const prev = previousMap.get(result.id) ?? null;
		let delta: DoctorComparisonResult['delta'];
		if (prev === null) {
			delta = 'new';
		} else if (result.status === 'pass' && prev !== 'pass') {
			delta = 'fixed';
		} else if (result.status !== 'pass' && prev === 'pass') {
			delta = 'regressed';
		} else {
			delta = 'unchanged';
		}
		return {
			id: result.id,
			previousStatus: prev,
			currentStatus: result.status,
			delta,
		};
	});
}

export async function runStyleDoctor(): Promise<StyleDoctorReport> {
	const view = detectStyleDoctorView();
	if (view === 'unsupported') {
		return {
			view,
			url: location.href,
			checked: 0,
			passed: 0,
			failed: 0,
			warnings: 0,
			skipped: 0,
			results: [],
			message: 'Unsupported page.',
		};
	}

	const restore = await openPaletteForProbe(view);
	try {
		const results = CHECKS.filter((check) => shouldRunCheck(check, view)).map(checkSelector);
		return {
			view,
			url: location.href,
			checked: results.length,
			passed: results.filter((item) => item.status === 'pass').length,
			failed: results.filter((item) => item.status === 'fail').length,
			warnings: results.filter((item) => item.status === 'warn').length,
			skipped: results.filter((item) => item.status === 'skip').length,
			results,
		};
	} finally {
		await restore();
	}
}
