import * as cb from './clipboard';
import { debugError, debugWarn } from './debug';
import { getCommandHelp, renderHelpHtml } from './help';
import { t } from './i18n';
import type { ContentActionResponse } from './messages';
import type { SidepanelFocusTarget, SidepanelTab } from './sidepanel-state';
import * as ui from './ui';
import * as utils from './utils';

const SIDEBAR_NAVIGATION_SELECTOR = 'nav[data-path="Pathfinder.primaryItems"]';
const SIDEBAR_NAVIGATION_ALIAS_SYNONYMS: Record<string, string[]> = {
	home: ['dashboard', 'overview'],
	private: ['p', 'private bots'],
	public: ['pub', 'public bots'],
	historical: ['history', 'activity historical'],
	'in progress': ['inprogress', 'progress'],
	'audit log': ['audit'],
	users: ['admin users', 'manage users'],
	roles: ['admin roles', 'manage roles'],
	devices: ['admin devices', 'manage devices'],
	packages: ['pack'],
	'oauth connections': ['oauth'],
};

export interface Command {
	action: () => void | Promise<void>;
	aliases: readonly string[];
	description: string;
}

export async function showActions(): Promise<void> {
	if (utils.getPaletteState() === 'closed') {
		utils.toggleToolbar();
	}
	await utils.clickIfExists(
		'div.editor-palette__accordion button[aria-label="Actions"]',
		'showActions'
	);
	await utils.sleep(100);
	await utils.clickIfExists(
		'.editor-palette-search__cancel button[type="button"][tabindex="-1"]',
		'showActions'
	);
}

export async function showVariables(): Promise<void> {
	if (utils.getPaletteState() === 'closed') {
		utils.toggleToolbar();
		await utils.sleep(1000);
	}
	const selector =
		'button[data-path="EditorPalette.section.button"][aria-label="Variables"]';
	for (let i = 0; i < 10; i++) {
		const el = document.querySelector<HTMLElement>(selector);
		if (el) {
			el.click();
			return;
		}
		await utils.sleep(300);
	}
	void debugWarn('selector', 'Variables button not found.', { selector }, {
		feedback: true,
	});
	throw new Error(`Variables button not found: ${selector}`);
}

export function showTriggers(): void {
	if (utils.getPaletteState() === 'closed') {
		utils.toggleToolbar();
	}
	void utils.clickIfExists(
		'button.editor-palette-section__header-button[data-path="EditorPalette.section.button"][aria-label="Triggers"]',
		'showTriggers'
	);
}

export async function addVariable(): Promise<void> {
	if (utils.getPaletteState() === 'closed') {
		utils.toggleToolbar();
		await utils.sleep(300);
	}
	await utils.clickIfExists('div.editor-palette__accordion header button', 'addVariable');
	await utils.sleep(200);
	await utils.clickIfExists('button[name="create"]', 'addVariable');
	await utils.sleep(200);
	await utils.clickIfExists(
		'div.action-bar--theme_default button:nth-child(2)',
		'addVariable'
	);
}

export async function deleteUnusedVariables(): Promise<void> {
	await showVariables();
	await utils.sleep(1000);
	await utils.clickIfExists(
		'button.action-bar__item--is_menu:nth-child(5)',
		'deleteUnusedVariables'
	);
	await utils.sleep(1000);
	await utils.clickIfExists(
		'.dropdown-options.g-scroller button.rio-focus--inset_4px:nth-child(2)',
		'deleteUnusedVariables'
	);
}

export function scrollToLineNumber(lineNumber: number): void {
	const lineElements = document.querySelectorAll(
		'.taskbot-canvas-list-node > .taskbot-canvas-list-node__number'
	);
	if (lineNumber < 1 || lineNumber > lineElements.length) {
		void debugWarn('commands', 'Line number is out of range.', {
			lineNumber,
			totalLines: lineElements.length,
		});
		return;
	}
	const targetElement = lineElements[lineNumber - 1] as HTMLElement;
	document
		.querySelectorAll('.line-highlighted')
		.forEach((el) => el.classList.remove('line-highlighted'));
	targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
	targetElement.classList.add('line-highlighted');
	setTimeout(() => {
		targetElement.classList.remove('line-highlighted');
	}, 2000);
}

export function redirectToPath(targetPath: string): void {
	const currentUrl = window.location.href;
	const pattern = /^(https:\/\/[^/]*\.automationanywhere\.digital)/;
	const match = currentUrl.match(pattern);
	if (!match) {
		void debugError('commands', 'Automation Anywhere URL did not match redirect pattern.', {
			currentUrl,
		}, { feedback: true });
		return;
	}
	window.location.href = match[1] + targetPath;
}

export function redirectToPrivateRepository(): void {
	redirectToPath('/#/bots/repository/private/');
}
export function redirectToPublicRepository(): void {
	redirectToPath('/#/bots/repository/public/');
}
export function redirectToActivityHistorical(): void {
	redirectToPath('/#/activity/historical/');
}
export function redirectToInProgress(): void {
	redirectToPath('/#/activity/inprogress/');
}
export function redirectToAuditLog(): void {
	redirectToPath('/#/audit');
}
export function redirectToAdminUsers(): void {
	redirectToPath('/#/admin/users/');
}
export function redirectToAdminRoles(): void {
	redirectToPath('/#/admin/roles/');
}
export function redirectToAdminDevices(): void {
	redirectToPath('/#/devices/');
}
export function redirectToPackages(): void {
	redirectToPath('/#/bots/packages/');
}
export function redirectToHome(): void {
	redirectToPath('/#/dashboard/home/overview');
}

async function openSidebar(
	tab: SidepanelTab = 'tools',
	focus?: SidepanelFocusTarget
): Promise<void> {
	try {
		const response = (await browser.runtime.sendMessage({
			type: 'OPEN_SIDEBAR',
			tab,
			focus,
		})) as ContentActionResponse | undefined;
		if (response && !response.ok) {
			ui.showNotification(t('Open sidebar manually'), response.error);
		}
	} catch (error) {
		void debugError('commands', 'Failed to open sidebar.', { error }, {
			feedback: true,
		});
		ui.showNotification(t('Sidebar failed'), t('Could not open extension sidebar.'));
	}
}

export function openSidebarCommandPalette(): void {
	void openSidebar('tools');
}

export function universalCopyCommandPalette(): void {
	void cb.universalCopy();
}

export function universalPasteCommandPalette(): void {
	void cb.universalPaste();
}

export async function exportActionToClipboard(): Promise<void> {
	try {
		const universalClipboard = await cb.universalCopy();
		if (!universalClipboard) {
			ui.showNotification(t('Export failed'), t('Universal clipboard is empty.'));
			return;
		}
		await navigator.clipboard.writeText(universalClipboard);
		ui.showNotification(t('Exported'), t('Action JSON copied to your clipboard.'));
	} catch (error) {
		void debugError('clipboard', 'Failed to export action to clipboard.', { error }, {
			feedback: true,
		});
		ui.showNotification(
			t('Export failed'),
			t('Could not write action JSON to the clipboard.')
		);
	}
}

export function importActionFromJson(): void {
	void openSidebar('tools', 'actionJson');
}

export function getCommandsWithAliases(): Record<string, Command> {
	const commandHelp = getCommandHelp();
	return {
		openSidebar: {
			action: openSidebarCommandPalette,
			...commandHelp.openSidebar,
		},
		addVariable: {
			action: addVariable,
			...commandHelp.addVariable,
		},
		showActions: {
			action: showActions,
			...commandHelp.showActions,
		},
		showVariables: {
			action: showVariables,
			...commandHelp.showVariables,
		},
		showTriggers: {
			action: showTriggers,
			...commandHelp.showTriggers,
		},
		deleteUnusedVariables: {
			action: deleteUnusedVariables,
			...commandHelp.deleteUnusedVariables,
		},
		showHelp: {
			action: showHelp,
			...commandHelp.showHelp,
		},
		universalCopy: {
			action: universalCopyCommandPalette,
			...commandHelp.universalCopy,
		},
		universalPaste: {
			action: universalPasteCommandPalette,
			...commandHelp.universalPaste,
		},
		exportActionToClipboard: {
			action: exportActionToClipboard,
			...commandHelp.exportActionToClipboard,
		},
		importActionFromJson: {
			action: importActionFromJson,
			...commandHelp.importActionFromJson,
		},
	};
}

function addAlias(aliases: string[], value: unknown): void {
	const alias = utils.normalizeCommandText(value);
	if (alias && !aliases.includes(alias)) aliases.push(alias);
}

function getCommandAliasSet(commands: Record<string, Command>): Set<string> {
	const aliases = new Set<string>();
	Object.values(commands).forEach((command) => {
		command.aliases.forEach((alias) => aliases.add(alias));
	});
	return aliases;
}

function getSidebarNavigationGroupLabel(link: Element): string {
	const secondaryList = link.closest('.pathfinder-items--variant_secondary');
	if (!secondaryList) return '';

	const primaryItem = secondaryList.parentElement?.closest(
		'.pathfinder-items__item--variant_primary'
	);
	return (
		primaryItem
			?.querySelector('[data-path="Pathfinder.button"] .pathfinder-items__item-label')
			?.textContent || ''
	);
}

function getSidebarNavigationLabel(link: Element): string {
	return (
		link.querySelector('.pathfinder-items__item-label')?.textContent ||
		link.getAttribute('aria-label') ||
		link.getAttribute('title') ||
		link.getAttribute('name') ||
		''
	);
}

function getSidebarNavigationAliases(link: Element): string[] {
	const aliases: string[] = [];
	const label = getSidebarNavigationLabel(link);
	const normalizedLabel = utils.normalizeCommandText(label);
	const groupLabel = getSidebarNavigationGroupLabel(link);

	addAlias(aliases, label);
	addAlias(aliases, link.getAttribute('title'));
	addAlias(aliases, link.getAttribute('aria-label'));
	addAlias(aliases, link.getAttribute('name'));

	if (groupLabel && label) {
		addAlias(aliases, `${groupLabel} ${label}`);
	}

	(SIDEBAR_NAVIGATION_ALIAS_SYNONYMS[normalizedLabel] || []).forEach((alias) => {
		addAlias(aliases, alias);
	});

	return aliases;
}

function toInternalNavigationPath(href: string | null): string {
	if (!href || !href.startsWith('#/')) return '';
	return `/${href}`;
}

function createNavigationCommand(
	key: string,
	path: string,
	aliases: string[],
	label: string
): Command & { key: string } {
	return {
		key,
		action: () => redirectToPath(path),
		aliases,
		description: t('Go to {label}.', { label }),
	};
}

function getSidebarNavigationCommandDefinitions(): Array<Command & { key: string }> {
	const commands: Array<Command & { key: string }> = [];
	const navigationLinks = document.querySelectorAll(
		`${SIDEBAR_NAVIGATION_SELECTOR} a[href^="#/"]`
	);

	navigationLinks.forEach((link, index) => {
		const path = toInternalNavigationPath(link.getAttribute('href'));
		if (!path) return;

		const label = utils.normalizeCommandText(getSidebarNavigationLabel(link));
		const aliases = getSidebarNavigationAliases(link);
		commands.push(
			createNavigationCommand(`sidebarNavigation${index}`, path, aliases, label || path)
		);
	});

	return commands;
}

function getSidebarNavigationCommands(
	staticAliases = getCommandAliasSet(getCommandsWithAliases())
): Array<Command & { key: string }> {
	const usedAliases = new Set(staticAliases);
	return getSidebarNavigationCommandDefinitions().reduce<Array<Command & { key: string }>>(
		(filteredCommands, command) => {
			const aliases = command.aliases.filter((alias) => !usedAliases.has(alias));
			if (!aliases.length) return filteredCommands;

			aliases.forEach((alias) => usedAliases.add(alias));
			filteredCommands.push({ ...command, aliases });
			return filteredCommands;
		},
		[]
	);
}

export function getCommandsWithNavigation(): Record<string, Command> {
	const commandsWithAliases = getCommandsWithAliases();
	const mergedCommands: Record<string, Command> = { ...commandsWithAliases };
	const staticAliases = getCommandAliasSet(commandsWithAliases);

	getSidebarNavigationCommands(staticAliases).forEach((command) => {
		mergedCommands[command.key] = {
			action: command.action,
			aliases: command.aliases,
			description: command.description,
		};
	});

	return mergedCommands;
}

export function getHelpHtml(): string {
	const commandsWithAliases = getCommandsWithAliases();
	return renderHelpHtml({
		commands: Object.values(commandsWithAliases),
		navigationCommands: getSidebarNavigationCommands(),
		shortcutLabel: utils.getActiveCommandPaletteShortcutLabel(),
	});
}

async function getOpenSidebarShortcut(): Promise<string> {
	try {
		const response = (await browser.runtime.sendMessage({
			type: 'GET_EXTENSION_SHORTCUTS',
		})) as { openSidebar?: string } | undefined;
		return response?.openSidebar || 'Alt + Shift + L';
	} catch {
		return 'Alt + Shift + L';
	}
}

export function showHelp(): void {
	void getOpenSidebarShortcut().then((shortcut) => {
		ui.showNotification(
			t('Help'),
			t('Open sidebar with {shortcut}, then go to Settings/About for help.', {
				shortcut,
			})
		);
	});
}
