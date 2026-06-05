export interface HelpCommandInfo {
	aliases: readonly string[];
	description: string;
}

export const COMMAND_HELP = {
	openSidebar: {
		aliases: ['open sidebar', 'sidepanel', 'sidebar'],
		description: 'Open extension sidebar.',
	},
	addVariable: {
		aliases: ['adv', 'addvar', 'add variable'],
		description: 'Shows dialog to create a new variable',
	},
	showActions: {
		aliases: ['a', 'showactions', 'actions'],
		description: 'Shows actions in sidebar',
	},
	showVariables: {
		aliases: ['v', 'showvars', 'list variables', 'variables'],
		description: 'Shows variables in sidebar',
	},
	showTriggers: {
		aliases: ['t', 'triggers'],
		description: 'Shows triggers in sidebar',
	},
	deleteUnusedVariables: {
		aliases: ['duv', 'delete unused', 'remove unused variables'],
		description: 'Shows dialog to select and delete unused variables',
	},
	showHelp: {
		aliases: ['help', 'man', 'show help'],
		description: 'Displays help information for available commands',
	},
	universalCopy: {
		aliases: ['universal copy', 'copy universal'],
		description: 'Save current Automation Anywhere clipboard to default slot.',
	},
	universalPaste: {
		aliases: ['universal paste', 'paste universal'],
		description: 'Paste default slot through Automation Anywhere shared paste.',
	},
	exportActionToClipboard: {
		aliases: ['export action', 'copy action json', 'export copied action', 'share action'],
		description: 'Export the currently copied action as JSON to your clipboard.',
	},
	importActionFromJson: {
		aliases: ['import action', 'paste action json', 'import shared action', 'load action json'],
		description: 'Open sidebar Action JSON field for import.',
	},
} as const satisfies Record<string, HelpCommandInfo>;

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
	const commands = options.commands ?? Object.values(COMMAND_HELP);
	const navigationCommands = options.navigationCommands ?? [];
	let helpContent = '<h3>List of Commands:</h3><ul>';
	helpContent += renderCommandList(commands);
	helpContent += '<li><b>:<i>line</i></b>: Scrolls to a specific line number (e.g. <code>:25</code>)</li>';
	helpContent += '</ul>';

	if (navigationCommands.length) {
		helpContent += '<h4>Navigation:</h4><ul>';
		helpContent += renderCommandList(navigationCommands);
		helpContent += '</ul>';
	}

	helpContent += `
		<h4>Keyboard Shortcuts:</h4>
		<ul>
			<li><b>${escapeHelpHtml(options.shortcutLabel)}</b>: Open command palette</li>
			<li><b>${escapeHelpHtml(options.sidebarShortcutLabel ?? 'Ctrl+Shift+L')}</b>: Open sidebar; configurable in browser extension shortcuts.</li>
			<li><b>Alt + V</b>: Show variables</li>
			<li><b>Alt + A</b>: Show actions</li>
		</ul>
		<h4>Clipboard Slots:</h4>
		<ul>
			<li>Native Automation Anywhere shared copy auto-saves default slot. Use sidepanel controls for slots.</li>
		</ul>
	`;

	return helpContent;
}
