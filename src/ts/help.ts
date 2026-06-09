import { getActiveLocale, t } from './i18n';

export interface HelpCommandInfo {
	aliases: readonly string[];
	description: string;
}

function aliases(english: readonly string[], spanish: readonly string[]): string[] {
	const ordered = getActiveLocale() === 'es' ? [...spanish, ...english] : [...english, ...spanish];
	return [...new Set(ordered)];
}

export function getCommandHelp(): Record<string, HelpCommandInfo> {
	return {
		openSidebar: {
			aliases: aliases(['open sidebar', 'sidepanel', 'sidebar'], ['abrir panel', 'panel']),
			description: t('Open the extension sidebar.'),
		},
		addVariable: {
			aliases: aliases(['adv', 'addvar', 'add variable'], ['agregar variable', 'crear variable']),
			description: t('Open the dialog to create a new variable.'),
		},
		showActions: {
			aliases: aliases(['a', 'showactions', 'actions'], ['acciones', 'mostrar acciones']),
			description: t('Show the Actions palette.'),
		},
		showVariables: {
			aliases: aliases(['v', 'showvars', 'list variables', 'variables'], ['variables', 'mostrar variables']),
			description: t('Show the Variables palette.'),
		},
		showTriggers: {
			aliases: aliases(['t', 'triggers'], ['disparadores', 'triggers']),
			description: t('Show the Triggers palette.'),
		},
		deleteUnusedVariables: {
			aliases: aliases(
				['duv', 'delete unused', 'remove unused variables'],
				['eliminar sin uso', 'borrar variables sin uso']
			),
			description: t('Open the dialog to select and delete unused variables.'),
		},
		showHelp: {
			aliases: aliases(['help', 'man', 'show help'], ['ayuda', 'mostrar ayuda']),
			description: t('Show help for available commands.'),
		},
		universalCopy: {
			aliases: aliases(['universal copy', 'copy universal'], ['copia universal', 'copiar universal']),
			description: t('Save current Automation Anywhere clipboard to default slot.'),
		},
		universalPaste: {
			aliases: aliases(['universal paste', 'paste universal'], ['pegado universal', 'pegar universal']),
			description: t('Paste default slot through Automation Anywhere shared paste.'),
		},
		exportActionToClipboard: {
			aliases: aliases(
				['export action', 'copy action json', 'export copied action', 'share action'],
				['exportar accion', 'copiar json de accion', 'compartir accion']
			),
			description: t('Export the currently copied action as JSON to your clipboard.'),
		},
		importActionFromJson: {
			aliases: aliases(
				['import action', 'paste action json', 'import shared action', 'load action json'],
				['importar accion', 'pegar json de accion', 'cargar json de accion']
			),
			description: t('Open sidebar Action JSON field for import.'),
		},
	};
}

export function escapeHelpHtml(value: unknown): string {
	return String(value).replace(/[&<>"']/g, (char) => {
		const map: Record<string, string> = {
			'&': '&amp;',
			'<': '&lt;',
			'>': '&gt;',
			'"': '&quot;',
			"'": '&#39;',
		};
		return map[char];
	});
}

function renderCommandList(commands: readonly HelpCommandInfo[]): string {
	return commands
		.map(
			({ aliases, description }) =>
				`<li><b>${escapeHelpHtml(aliases.join(', '))}</b>: ${escapeHelpHtml(description)}</li>`
		)
		.join('');
}

export function renderHelpHtml(options: {
	commands?: readonly HelpCommandInfo[];
	navigationCommands?: readonly HelpCommandInfo[];
	shortcutLabel: string;
	sidebarShortcutLabel?: string;
}): string {
	const commands = options.commands ?? Object.values(getCommandHelp());
	const navigationCommands = options.navigationCommands ?? [];
	let helpContent = `<h3>${escapeHelpHtml(t('List of Commands:'))}</h3><ul>`;
	helpContent += renderCommandList(commands);
	helpContent += `<li><b>:<i>line</i></b>: ${escapeHelpHtml(t('Scrolls to a specific line number (e.g. {example})', { example: ':25' }))}</li>`;
	helpContent += '</ul>';

	if (navigationCommands.length) {
		helpContent += `<h4>${escapeHelpHtml(t('Navigation:'))}</h4><ul>`;
		helpContent += renderCommandList(navigationCommands);
		helpContent += '</ul>';
	}

	helpContent += `
		<h4>${escapeHelpHtml(t('Keyboard Shortcuts:'))}</h4>
		<ul>
			<li><b>${escapeHelpHtml(options.shortcutLabel)}</b>: ${escapeHelpHtml(t('Open command palette'))}</li>
			<li><b>${escapeHelpHtml(options.sidebarShortcutLabel ?? 'Alt + Shift + L')}</b>: ${escapeHelpHtml(t('Open sidebar; configurable in extension sidebar.'))}</li>
			<li><b>Alt + V</b>: ${escapeHelpHtml(t('Show variables'))}</li>
			<li><b>Alt + A</b>: ${escapeHelpHtml(t('Show actions'))}</li>
		</ul>
		<h4>${escapeHelpHtml(t('Clipboard Slots:'))}</h4>
		<ul>
			<li>${escapeHelpHtml(t('Native Automation Anywhere shared copy auto-saves default slot. Use sidepanel controls for slots.'))}</li>
		</ul>
	`;

	return helpContent;
}
