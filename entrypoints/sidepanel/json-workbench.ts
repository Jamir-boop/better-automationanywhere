import { t } from '@/src/ts/i18n';
import {
	formatJsonText,
	getActiveTextMatchIndex,
	getTextMatches,
	replaceTextMatches,
	type TextMatch,
} from '@/src/ts/json-text';
import { getHelpTipId, renderHelpTip } from './help';
import {
	clearAutomationAnywhereJsonDetails,
	downloadJsonTextFile,
	getJsonDownloadText,
	renderAutomationAnywhereJsonDetails,
} from './json-info';

type FeedbackSeverity = 'info' | 'warn' | 'error';

export interface JsonWorkbench {
	getValue(): string;
	setValue(value: string): void;
	clear(): void;
	refresh(): void;
	validate(): boolean;
	canParseJson(): boolean;
	copyToClipboard(): Promise<void>;
	format(): void;
	exportFile(): void;
}

export interface InitializeJsonWorkbenchOptions {
	idPrefix: string;
	textarea: HTMLTextAreaElement;
	detailsContainer: HTMLElement;
	errorElement: HTMLElement;
	setStatus(message: string, severity?: FeedbackSeverity): void;
	getExportFileName(): string;
	onChange?(): void;
	emptyMessage?: string;
	copiedMessage?: string;
	formattedMessage?: string;
	exportedMessage?: string;
}

interface JsonWorkbenchElements {
	findInput: HTMLInputElement;
	replaceInput: HTMLInputElement;
	matchCaseInput: HTMLInputElement;
	previousButton: HTMLButtonElement;
	nextButton: HTMLButtonElement;
	replaceButton: HTMLButtonElement;
	replaceAllButton: HTMLButtonElement;
	searchStatus: HTMLElement;
	copyButton: HTMLButtonElement;
	formatButton: HTMLButtonElement;
	exportButton: HTMLButtonElement;
}

interface JsonWorkbenchActionLabels {
	copyLabel?: string;
	copyHelp?: string;
	formatLabel?: string;
	formatHelp?: string;
	exportLabel?: string;
	exportHelp?: string;
}

function getRequiredElement<T extends HTMLElement>(selector: string): T {
	const element = document.querySelector<T>(selector);
	if (!element) throw new Error(`Missing ${selector}.`);
	return element;
}

function getWorkbenchElements(idPrefix: string): JsonWorkbenchElements {
	return {
		findInput: getRequiredElement(`#${idPrefix}Find`),
		replaceInput: getRequiredElement(`#${idPrefix}Replace`),
		matchCaseInput: getRequiredElement(`#${idPrefix}MatchCase`),
		previousButton: getRequiredElement(`#${idPrefix}Previous`),
		nextButton: getRequiredElement(`#${idPrefix}Next`),
		replaceButton: getRequiredElement(`#${idPrefix}ReplaceCurrent`),
		replaceAllButton: getRequiredElement(`#${idPrefix}ReplaceAll`),
		searchStatus: getRequiredElement(`#${idPrefix}SearchStatus`),
		copyButton: getRequiredElement(`#${idPrefix}Copy`),
		formatButton: getRequiredElement(`#${idPrefix}Format`),
		exportButton: getRequiredElement(`#${idPrefix}Export`),
	};
}

export function renderJsonWorkbenchSearchTools(idPrefix: string): string {
	return `
		<div class="json-workbench-tools">
			<div class="json-workbench-fields">
				<label>
					<span>${t('Find')}</span>
					<input id="${idPrefix}Find" type="search" autocomplete="off">
				</label>
				<label>
					<span>${t('Replace')}</span>
					<input id="${idPrefix}Replace" type="text" autocomplete="off">
				</label>
			</div>
			<label class="json-workbench-checkbox">
				<input id="${idPrefix}MatchCase" type="checkbox">
				<span>${t('Match case')}</span>
			</label>
			<div class="button-grid json-workbench-actions">
				<button id="${idPrefix}Previous" type="button">${t('Previous')}</button>
				<button id="${idPrefix}Next" type="button">${t('Next')}</button>
				<button id="${idPrefix}ReplaceCurrent" type="button">${t('Replace')}</button>
				<button id="${idPrefix}ReplaceAll" type="button">${t('Replace all')}</button>
			</div>
			<p id="${idPrefix}SearchStatus" class="inline-hint" aria-live="polite"></p>
		</div>
	`;
}

export function renderJsonWorkbenchActionButtons(
	idPrefix: string,
	labels: JsonWorkbenchActionLabels = {}
): string {
	const copyHelpId = `${idPrefix}-copy-json`;
	const formatHelpId = `${idPrefix}-format-json`;
	const exportHelpId = `${idPrefix}-export-json`;
	return `
		<span class="help-wrapper">
			<button id="${idPrefix}Copy" class="help-anchor" type="button" aria-describedby="${getHelpTipId(copyHelpId)}">${t(labels.copyLabel ?? 'Copy JSON')}</button>
			${renderHelpTip(copyHelpId, t(labels.copyHelp ?? 'Copy textarea JSON to system clipboard.'))}
		</span>
		<span class="help-wrapper">
			<button id="${idPrefix}Format" class="help-anchor" type="button" aria-describedby="${getHelpTipId(formatHelpId)}">${t(labels.formatLabel ?? 'Format')}</button>
			${renderHelpTip(formatHelpId, t(labels.formatHelp ?? 'Format textarea JSON.'))}
		</span>
		<span class="help-wrapper">
			<button id="${idPrefix}Export" class="help-anchor" type="button" aria-describedby="${getHelpTipId(exportHelpId)}">${t(labels.exportLabel ?? 'Export JSON')}</button>
			${renderHelpTip(exportHelpId, t(labels.exportHelp ?? 'Download textarea JSON as a .json file.'))}
		</span>
	`;
}

function getMatches(
	options: InitializeJsonWorkbenchOptions,
	elements: JsonWorkbenchElements
): TextMatch[] {
	return getTextMatches(
		options.textarea.value,
		elements.findInput.value,
		elements.matchCaseInput.checked
	);
}

function canParseJson(options: InitializeJsonWorkbenchOptions): boolean {
	if (!options.textarea.value.trim()) return false;
	try {
		JSON.parse(options.textarea.value);
		return true;
	} catch {
		return false;
	}
}

function validateJson(options: InitializeJsonWorkbenchOptions): boolean {
	const value = options.textarea.value.trim();
	if (!value) {
		options.textarea.classList.remove('is-invalid');
		options.textarea.removeAttribute('aria-invalid');
		options.errorElement.textContent = '';
		options.errorElement.hidden = true;
		return true;
	}

	try {
		JSON.parse(options.textarea.value);
		options.textarea.classList.remove('is-invalid');
		options.textarea.removeAttribute('aria-invalid');
		options.errorElement.textContent = '';
		options.errorElement.hidden = true;
		return true;
	} catch (error) {
		options.textarea.classList.add('is-invalid');
		options.textarea.setAttribute('aria-invalid', 'true');
		options.errorElement.textContent =
			error instanceof Error ? error.message : t('Invalid JSON.');
		options.errorElement.hidden = false;
		return false;
	}
}

function updateDetails(options: InitializeJsonWorkbenchOptions): void {
	const value = options.textarea.value.trim();
	if (!value) {
		clearAutomationAnywhereJsonDetails(options.detailsContainer);
		return;
	}

	try {
		renderAutomationAnywhereJsonDetails(options.detailsContainer, JSON.parse(value));
	} catch {
		clearAutomationAnywhereJsonDetails(options.detailsContainer);
	}
}

function getActiveMatchIndex(
	options: InitializeJsonWorkbenchOptions,
	matches: TextMatch[]
): number {
	return getActiveTextMatchIndex(
		matches,
		options.textarea.selectionStart,
		options.textarea.selectionEnd
	);
}

function setSearchStatus(
	options: InitializeJsonWorkbenchOptions,
	elements: JsonWorkbenchElements,
	matches: TextMatch[]
): void {
	if (!elements.findInput.value) {
		elements.searchStatus.textContent = t('No search term.');
		return;
	}
	if (!matches.length) {
		elements.searchStatus.textContent = t('No matches.');
		return;
	}

	const activeIndex = getActiveMatchIndex(options, matches);
	elements.searchStatus.textContent =
		activeIndex >= 0
			? t('Match {current} of {count}.', {
					current: activeIndex + 1,
					count: matches.length,
				})
			: t('{count} match(es).', { count: matches.length });
}

function updateSearchState(
	options: InitializeJsonWorkbenchOptions,
	elements: JsonWorkbenchElements
): void {
	const matches = getMatches(options, elements);
	const hasMatches = matches.length > 0;
	const validJson = canParseJson(options);
	elements.previousButton.disabled = !hasMatches;
	elements.nextButton.disabled = !hasMatches;
	elements.replaceButton.disabled = !validJson || !hasMatches;
	elements.replaceAllButton.disabled = !validJson || !hasMatches;
	setSearchStatus(options, elements, matches);
}

function refreshWorkbench(
	options: InitializeJsonWorkbenchOptions,
	elements: JsonWorkbenchElements
): void {
	validateJson(options);
	updateDetails(options);
	updateSearchState(options, elements);
	options.onChange?.();
}

function findMatch(
	options: InitializeJsonWorkbenchOptions,
	elements: JsonWorkbenchElements,
	direction: 1 | -1
): void {
	const matches = getMatches(options, elements);
	if (!matches.length) {
		updateSearchState(options, elements);
		return;
	}

	const position =
		direction > 0 ? options.textarea.selectionEnd : options.textarea.selectionStart;
	const match =
		direction > 0
			? matches.find((item) => item.start >= position) ?? matches[0]
			: [...matches].reverse().find((item) => item.end <= position) ??
				matches[matches.length - 1];
	options.textarea.focus();
	options.textarea.setSelectionRange(match.start, match.end);
	setSearchStatus(options, elements, matches);
}

function replaceCurrent(
	options: InitializeJsonWorkbenchOptions,
	elements: JsonWorkbenchElements
): void {
	if (!canParseJson(options)) {
		options.setStatus(t('Invalid JSON.'), 'error');
		return;
	}

	let matches = getMatches(options, elements);
	let activeIndex = getActiveMatchIndex(options, matches);
	if (activeIndex < 0) {
		findMatch(options, elements, 1);
		matches = getMatches(options, elements);
		activeIndex = getActiveMatchIndex(options, matches);
	}
	const match = matches[activeIndex];
	if (!match) {
		options.setStatus(t('No matches.'), 'warn');
		return;
	}

	const replacement = elements.replaceInput.value;
	options.textarea.value = replaceTextMatches(options.textarea.value, [match], replacement);
	options.textarea.focus();
	options.textarea.setSelectionRange(match.start, match.start + replacement.length);
	refreshWorkbench(options, elements);
	options.setStatus(t('Replaced 1 match.'));
}

function replaceAll(
	options: InitializeJsonWorkbenchOptions,
	elements: JsonWorkbenchElements
): void {
	if (!canParseJson(options)) {
		options.setStatus(t('Invalid JSON.'), 'error');
		return;
	}

	const matches = getMatches(options, elements);
	if (!matches.length) {
		options.setStatus(t('No matches.'), 'warn');
		return;
	}
	if (!window.confirm(t('Replace {count} match(es)?', { count: matches.length }))) {
		return;
	}

	options.textarea.value = replaceTextMatches(
		options.textarea.value,
		matches,
		elements.replaceInput.value
	);
	options.textarea.focus();
	options.textarea.setSelectionRange(0, 0);
	refreshWorkbench(options, elements);
	options.setStatus(t('Replaced {count} match(es).', { count: matches.length }));
}

async function copyToClipboard(options: InitializeJsonWorkbenchOptions): Promise<void> {
	if (!options.textarea.value.trim()) {
		options.setStatus(options.emptyMessage ?? t('JSON textarea is empty.'), 'warn');
		return;
	}
	try {
		await navigator.clipboard.writeText(options.textarea.value);
		options.setStatus(options.copiedMessage ?? t('JSON copied to clipboard.'));
	} catch {
		options.setStatus(t('Clipboard write failed.'), 'error');
	}
}

function formatWorkbench(
	options: InitializeJsonWorkbenchOptions,
	elements: JsonWorkbenchElements
): void {
	try {
		options.textarea.value = formatJsonText(options.textarea.value);
		refreshWorkbench(options, elements);
		options.setStatus(options.formattedMessage ?? t('JSON formatted.'));
	} catch (error) {
		validateJson(options);
		updateSearchState(options, elements);
		options.setStatus(error instanceof Error ? error.message : t('Invalid JSON.'), 'error');
	}
}

function exportWorkbench(
	options: InitializeJsonWorkbenchOptions,
	elements: JsonWorkbenchElements
): void {
	const json = options.textarea.value.trim();
	if (!json) {
		options.setStatus(options.emptyMessage ?? t('JSON textarea is empty.'), 'warn');
		return;
	}
	try {
		downloadJsonTextFile(getJsonDownloadText(json), options.getExportFileName());
		options.setStatus(options.exportedMessage ?? t('JSON exported.'));
	} catch (error) {
		validateJson(options);
		updateSearchState(options, elements);
		options.setStatus(error instanceof Error ? error.message : t('Invalid JSON.'), 'error');
	}
}

function bindWorkbenchEvents(
	workbench: JsonWorkbench,
	options: InitializeJsonWorkbenchOptions,
	elements: JsonWorkbenchElements
): void {
	elements.findInput.addEventListener('input', () => updateSearchState(options, elements));
	elements.findInput.addEventListener('keydown', (event) => {
		if (event.key !== 'Enter') return;
		event.preventDefault();
		findMatch(options, elements, event.shiftKey ? -1 : 1);
	});
	elements.replaceInput.addEventListener('input', () => updateSearchState(options, elements));
	elements.matchCaseInput.addEventListener('change', () => updateSearchState(options, elements));
	elements.previousButton.addEventListener('click', () => findMatch(options, elements, -1));
	elements.nextButton.addEventListener('click', () => findMatch(options, elements, 1));
	elements.replaceButton.addEventListener('click', () => replaceCurrent(options, elements));
	elements.replaceAllButton.addEventListener('click', () => replaceAll(options, elements));
	elements.copyButton.addEventListener('click', () => {
		void workbench.copyToClipboard();
	});
	elements.formatButton.addEventListener('click', () => workbench.format());
	elements.exportButton.addEventListener('click', () => workbench.exportFile());
	options.textarea.addEventListener('input', () => workbench.refresh());
}

export function initializeJsonWorkbench(
	options: InitializeJsonWorkbenchOptions
): JsonWorkbench {
	const elements = getWorkbenchElements(options.idPrefix);
	const workbench: JsonWorkbench = {
		getValue: () => options.textarea.value,
		setValue(value: string) {
			options.textarea.value = value;
			refreshWorkbench(options, elements);
		},
		clear() {
			this.setValue('');
		},
		refresh: () => refreshWorkbench(options, elements),
		validate: () => validateJson(options),
		canParseJson: () => canParseJson(options),
		copyToClipboard: () => copyToClipboard(options),
		format: () => formatWorkbench(options, elements),
		exportFile: () => exportWorkbench(options, elements),
	};

	bindWorkbenchEvents(workbench, options, elements);
	workbench.refresh();
	return workbench;
}
