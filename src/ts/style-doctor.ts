import { isFolderRepositoryUrl, isTaskEditorUrl } from './automation-anywhere';
import {
	AUTOMATION_ANYWHERE_SELECTOR_CHECKS,
	EDITOR_PALETTE_TOGGLE_QUERY_SELECTOR,
	EDITOR_PALETTE_TOGGLE_SELECTOR,
	EDITOR_PALETTE_CANVAS_SELECTOR,
	FOLDER_LIST_ITEM_SELECTOR,
	FOLDER_LIST_SELECTOR,
	FOLDER_TABLE_COLUMN_SELECTOR,
	TASKBOT_CANVAS_NODE_SELECTOR,
	TASKBOT_EDITOR_LAYOUT_SELECTOR,
	getAutomationAnywhereSelectorCheck,
	type AutomationAnywhereSelectorCheck,
	type AutomationAnywhereSelectorGroup,
	type AutomationAnywhereSelectorRequirement,
	type AutomationAnywhereSelectorSeverity,
	type AutomationAnywhereSelectorStatus,
} from './automation-anywhere-selectors';
import { debugInfo, debugWarn } from './debug';

export type StyleDoctorView = 'taskbot-editor' | 'folder-navigation' | 'unsupported';
export type StyleDoctorResultStatus = 'pass' | 'fail' | 'warn' | 'skip';
export type StyleDoctorSeverity = AutomationAnywhereSelectorSeverity;
export type DoctorCheckGroup = AutomationAnywhereSelectorGroup;

export interface StyleDoctorCheck
	extends Omit<AutomationAnywhereSelectorCheck, 'status' | 'view'> {
	view: Exclude<StyleDoctorView, 'unsupported'> | 'shared';
	selectorStatus: AutomationAnywhereSelectorStatus;
	requires?: AutomationAnywhereSelectorRequirement;
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

export const CHECKS: StyleDoctorCheck[] = AUTOMATION_ANYWHERE_SELECTOR_CHECKS.map(
	({ status, ...check }) => ({ ...check, selectorStatus: status })
);

const REQUIREMENT_CHECK_IDS: Record<AutomationAnywhereSelectorRequirement, string> = {
	'bot-modal': 'bot-modal',
	'loading-indicator': 'loading-indicator',
	'error-modal': 'error-modal',
	'done-modal': 'done-modal',
};

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
		hasSelector(
			`${TASKBOT_EDITOR_LAYOUT_SELECTOR}, ${TASKBOT_CANVAS_NODE_SELECTOR}, ${EDITOR_PALETTE_CANVAS_SELECTOR}`
		)
	) {
		return 'taskbot-editor';
	}
	if (
		isFolderRepositoryUrl(location.href) ||
		hasSelector(
			`${FOLDER_LIST_SELECTOR}, ${FOLDER_LIST_ITEM_SELECTOR}, ${FOLDER_TABLE_COLUMN_SELECTOR}`
		)
	) {
		return 'folder-navigation';
	}
	return 'unsupported';
}

function isPaletteClosed(): boolean {
	const palette = document.querySelector<HTMLElement>(TASKBOT_EDITOR_LAYOUT_SELECTOR);
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

function getRequirementSelector(requirement: AutomationAnywhereSelectorRequirement): string {
	const checkId = REQUIREMENT_CHECK_IDS[requirement];
	return getAutomationAnywhereSelectorCheck(checkId)?.selector ?? '';
}

function requirementPresent(requirement: StyleDoctorCheck['requires']): boolean {
	if (!requirement) return true;
	const selector = getRequirementSelector(requirement);
	return selector ? hasSelector(selector) : true;
}

function shouldRunCheck(check: StyleDoctorCheck, view: StyleDoctorView): boolean {
	return check.view === 'shared' || check.view === view;
}

function toResult(
	check: StyleDoctorCheck,
	status: StyleDoctorResultStatus,
	count: number,
	reason?: string
): StyleDoctorCheckResult {
	return {
		...check,
		status,
		count,
		reason,
	};
}

function checkSelector(check: StyleDoctorCheck): StyleDoctorCheckResult {
	if (!requirementPresent(check.requires)) {
		return toResult(check, 'skip', 0, 'Transient UI not present.');
	}

	try {
		const count = countSelector(check.selector);
		if (count > 0) return toResult(check, 'pass', count);
		if (check.severity === 'required') {
			return toResult(check, 'fail', count, 'Required selector missing.');
		}
		if (check.severity === 'optional') {
			return toResult(check, 'warn', count, 'Optional selector missing.');
		}
		return toResult(check, 'skip', count, 'Transient selector missing.');
	} catch (error) {
		void debugWarn(
			'selector',
			'Style Doctor selector query failed.',
			{
				checkId: check.id,
				selector: check.selector,
				error,
			},
			{ feedback: true, keepDetails: true }
		);
		return toResult(
			check,
			'fail',
			0,
			error instanceof Error ? error.message : 'Selector query failed.'
		);
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

function summarizeResults(results: StyleDoctorCheckResult[]): Record<string, unknown> {
	return {
		failed: results.filter((item) => item.status === 'fail').map((item) => item.id),
		warnings: results.filter((item) => item.status === 'warn').map((item) => item.id),
		skipped: results.filter((item) => item.status === 'skip').map((item) => item.id),
	};
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
		const report = {
			view,
			url: location.href,
			checked: results.length,
			passed: results.filter((item) => item.status === 'pass').length,
			failed: results.filter((item) => item.status === 'fail').length,
			warnings: results.filter((item) => item.status === 'warn').length,
			skipped: results.filter((item) => item.status === 'skip').length,
			results,
		};
		void debugInfo(
			'selector',
			'Style Doctor scan finished.',
			{
				view,
				checked: report.checked,
				passed: report.passed,
				...summarizeResults(results),
			},
			{ feedback: true, keepDetails: true, debugOnly: true }
		);
		return report;
	} finally {
		await restore();
	}
}
