import * as utils from './utils';
import * as palette from './palette';
import * as cb from './clipboard';

export async function showActions(): Promise<void> {
	if (utils.getPaletteState() === "closed") {
		utils.toggleToolbar();
	}
	utils.clickIfExists(
		"div.editor-palette__accordion:nth-child(2) > div:nth-child(1) > header:nth-child(1) > div:nth-child(1) > button:nth-child(1) > div:nth-child(1) > div:nth-child(2)",
		"showActions"
	)
	await utils.sleep(100);
	utils.clickIfExists(
		'.editor-palette-search__cancel button[type="button"][tabindex="-1"]',
		"showActions"
	)
}

export async function showVariables(): Promise<void> {
	if (utils.getPaletteState() === "closed") {
		utils.toggleToolbar();
		await utils.sleep(1000);
	}
	for (let i = 0; i < 10; i++) {
		const el = document.querySelector(
			'span.clipped-text.clipped-text--no_wrap.editor-palette-section__header-title[title="Variables"]'
		) as HTMLElement | null;
		if (el) {
			el.click();
			return;
		}
		await utils.sleep(300);
	}
}

export function showTriggers(): void {
	if (utils.getPaletteState() === "closed") {
		utils.toggleToolbar();
	}

	utils.clickIfExists('span.clipped-text.clipped-text--no_wrap.editor-palette-section__header-title[title="Triggers"]');
}

/**
 * Adds a new variable via the UI.
 */
export async function addVariable(): Promise<void> {
	if (utils.getPaletteState() === "closed") {
		utils.toggleToolbar();
		await utils.sleep(300);
	}
	utils.clickIfExists('div.editor-palette__accordion header button', "addVariable");
	await utils.sleep(200);
	utils.clickIfExists('button[name="create"]', "addVariable");
	await utils.sleep(200);
	utils.clickIfExists('div.action-bar--theme_default button:nth-child(2)', "addVariable");
}

/**
 * Deletes unused variables via the UI.
 */
export async function deleteUnusedVariables(): Promise<void> {
	await showVariables();
	await utils.sleep(1000);
	utils.clickIfExists("button.action-bar__item--is_menu:nth-child(5)", "deleteUnusedVariables");
	await utils.sleep(1000);
	utils.clickIfExists(".dropdown-options.g-scroller button.rio-focus--inset_4px:nth-child(2)", "deleteUnusedVariables");
}

/**
 * Scrolls to a specific line number in the editor.
 */
export function scrollToLineNumber(lineNumber: number): void {
	const lineElements = document.querySelectorAll('.taskbot-canvas-list-node > .taskbot-canvas-list-node__number');
	if (lineNumber < 1 || lineNumber > lineElements.length) {
		console.warn(`Line ${lineNumber} is out of range. Total lines: ${lineElements.length}`);
		return;
	}
	const targetElement = lineElements[lineNumber - 1] as HTMLElement;
	document.querySelectorAll('.line-highlighted').forEach(el => el.classList.remove('line-highlighted'));
	targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
	targetElement.classList.add('line-highlighted');
	setTimeout(() => {
		targetElement.classList.remove('line-highlighted');
	}, 2000);
}

export function showHelp(): void {
	const modalOverlay = document.createElement('div');
	const modal = document.createElement('div');
	const modalContent = document.createElement('div');
	const closeButton = document.createElement('button');
	const signature = document.createElement('div');

	// Overlay styles
	Object.assign(modalOverlay.style, {
		position: 'fixed',
		top: '0',
		left: '0',
		width: '100vw',
		height: '100vh',
		backgroundColor: 'rgba(0, 0, 0, 0.5)',
		display: 'flex',
		justifyContent: 'center',
		alignItems: 'center',
		zIndex: '1000',
		fontSize: '16px'
	});

	// Modal styles
	Object.assign(modal.style, {
		backgroundColor: 'white',
		padding: '20px',
		borderRadius: '8px',
		boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)',
		maxWidth: '800px',
		width: '80%',
		position: 'relative'
	});

	let helpContent = "<h3>List of Commands:</h3><ul>";
	for (const command in commandsWithAliases) {
		const { aliases, description } = commandsWithAliases[command];
		helpContent += `<li><b>${aliases.join(', ')}</b>: ${description}</li>`;
	}
	helpContent += `<li><b>:<i>line</i></b>: Scrolls to a specific line number (e.g. <code>:25</code>)</li>`;
	helpContent += "</ul>";

	helpContent += `
    <h4>Keyboard Shortcuts:</h4>
    <ul>
      <li><b>Alt + P</b>: Open the command palette</li>
      <li><b>Alt + V</b>: Show variables</li>
      <li><b>Alt + A</b>: Show actions</li>
    </ul>

    <h4>Clipboard Slots:</h4>
    <ul>
      <li>Use the context menu (Tampermonkey menu) to:
        <ul>
          <li><code>Copy to Slot 1</code>, <code>Slot 2</code>, <code>Slot 3</code></li>
          <li><code>Paste from Slot 1</code>, <code>Slot 2</code>, <code>Slot 3</code></li>
        </ul>
      </li>
      <li>You can also use the rocket icons in the top action bar to quickly copy/paste</li>
    </ul>
  `;

	modalContent.innerHTML = helpContent;

	closeButton.textContent = 'Close';
	Object.assign(closeButton.style, {
		marginTop: '10px',
		padding: '8px 16px',
		border: 'none',
		backgroundColor: 'var(--color_background_interactive)',
		color: 'white',
		cursor: 'pointer',
		borderRadius: '4px'
	});

	signature.innerHTML = `<a href="https://github.com/Jamir-boop/automationanywhere-improvements.git" target="_blank" style="text-decoration: none; color: #888; font-size: 12px;">made by jamir-boop</a>`;
	Object.assign(signature.style, {
		position: 'absolute',
		bottom: '8px',
		right: '12px'
	});

	modal.appendChild(modalContent);
	modal.appendChild(closeButton);
	modal.appendChild(signature);
	modalOverlay.appendChild(modal);
	document.body.appendChild(modalOverlay);

	function closeModal() {
		document.body.removeChild(modalOverlay);
	}

	// Overlay click closes modal (but only if background clicked)
	modalOverlay.addEventListener('click', (e: MouseEvent) => {
		if (e.target === modalOverlay) {
			closeModal();
		}
	});

	// Escape key closes modal (remove listener after close)
	const keydownHandler = (e: KeyboardEvent) => {
		if (e.key === 'Escape') {
			closeModal();
			document.removeEventListener('keydown', keydownHandler);
		}
	};
	document.addEventListener('keydown', keydownHandler);

	// Close button closes modal
	closeButton.addEventListener('click', closeModal);
}

export function universalCopyCommandPalette(): void {
	const btn = document.querySelector(".universalCopy") as HTMLElement | null;
	if (btn) {
		btn.click();
	} else {
		universalCopy();
	}
}

export function universalPasteCommandPalette(): void {
	const btn = document.querySelector(".universalPaste") as HTMLElement | null;
	if (btn) {
		btn.click();
	} else {
		universalPaste();
	}
}

/**
 * Exports the currently copied action as JSON to the user's clipboard,
 * with uid set to 🔥🔥🔥 (for universal sharing).
 */
export async function exportActionToClipboard(): Promise<void> {
	try {
		// Use universalCopy to set storage with 🔥🔥🔥 as uid
		universalCopy();
		await sleep(200);
		// TODO: Replace GM_getValue with extension storage in WXT
		const universalClipboard = GM_getValue('universalClipboard');
		if (!universalClipboard) return;
		await navigator.clipboard.writeText(universalClipboard);
	} catch (e) {
		console.warn("Failed to export action to clipboard:", e);
	}
}

/**
 * Shows a modal to import an action JSON and triggers universalPaste.
 */
export function importActionFromJson(): void {
	// Modal setup
	const overlay = document.createElement('div');
	overlay.style.position = 'fixed';
	overlay.style.top = '0';
	overlay.style.left = '0';
	overlay.style.width = '100vw';
	overlay.style.height = '100vh';
	overlay.style.background = 'rgba(0,0,0,0.5)';
	overlay.style.zIndex = '100000';
	overlay.style.display = 'flex';
	overlay.style.justifyContent = 'center';
	overlay.style.alignItems = 'center';

	const modal = document.createElement('div');
	modal.style.background = 'white';
	modal.style.padding = '24px';
	modal.style.borderRadius = '8px';
	modal.style.maxWidth = '600px';
	modal.style.width = '90%';
	modal.style.boxShadow = '0 4px 16px rgba(0,0,0,0.15)';
	modal.style.display = 'flex';
	modal.style.flexDirection = 'column';
	modal.style.alignItems = 'stretch';

	const label = document.createElement('label');
	label.textContent = "Paste Automation Anywhere Action JSON:";
	label.style.marginBottom = '8px';

	const textarea = document.createElement('textarea');
	textarea.style.width = '100%';
	textarea.style.height = '180px';
	textarea.style.marginBottom = '12px';
	textarea.style.fontFamily = 'monospace';
	textarea.style.fontSize = '1rem';

	const buttonRow = document.createElement('div');
	buttonRow.style.display = 'flex';
	buttonRow.style.justifyContent = 'flex-end';
	buttonRow.style.gap = '8px';

	const importBtn = document.createElement('button');
	importBtn.textContent = "Import & Paste";
	importBtn.style.padding = '8px 16px';
	importBtn.style.background = 'var(--color_background_interactive, #3c5e83)';
	importBtn.style.color = 'white';
	importBtn.style.border = 'none';
	importBtn.style.borderRadius = '4px';
	importBtn.style.cursor = 'pointer';

	const cancelBtn = document.createElement('button');
	cancelBtn.textContent = "Cancel";
	cancelBtn.style.padding = '8px 16px';
	cancelBtn.style.background = '#ccc';
	cancelBtn.style.color = '#222';
	cancelBtn.style.border = 'none';
	cancelBtn.style.borderRadius = '4px';
	cancelBtn.style.cursor = 'pointer';

	buttonRow.appendChild(cancelBtn);
	buttonRow.appendChild(importBtn);

	modal.appendChild(label);
	modal.appendChild(textarea);
	modal.appendChild(buttonRow);
	overlay.appendChild(modal);
	document.body.appendChild(overlay);
	textarea.focus();

	function closeModal() {
		document.body.removeChild(overlay);
	}

	cancelBtn.onclick = closeModal;
	overlay.onclick = (e) => { if (e.target === overlay) closeModal(); };
	document.addEventListener('keydown', function escListener(e) {
		if (e.key === 'Escape') {
			closeModal();
			document.removeEventListener('keydown', escListener);
		}
	});

	importBtn.onclick = async function() {
		const input = textarea.value.trim();
		if (!input) return;
		try {
			JSON.parse(input);
		} catch (e) {
			return;
		}

		await cb.universalClipboard.setValue(input);
		closeModal();
		await utils.sleep(200);
		cb.universalPaste();
	};
}

/**
 * Redirects to a given path within the Automation Anywhere domain.
 */
export function redirectToPath(targetPath: string): void {
	const currentUrl = window.location.href;
	const pattern = /^(https:\/\/[^\/]*\.automationanywhere\.digital)/;
	const match = currentUrl.match(pattern);
	if (match) {
		const baseUrl = match[1];
		const newUrl = baseUrl + targetPath;
		window.location.href = newUrl;
	} else {
		console.error(`[redirectToPath] Pattern didn't match. The URL might not be in the expected format: ${currentUrl}`);
	}
}

export function redirectToPrivateRepository() { redirectToPath('/#/bots/repository/private/'); }
export function redirectToPublicRepository() { redirectToPath('/#/bots/repository/public/'); }
export function redirectToActivityHistorical() { redirectToPath('/#/activity/historical/'); }
export function redirectToInProgress() { redirectToPath('/#/activity/inprogress/'); }
export function redirectToAuditLog() { redirectToPath('/#/audit'); }
export function redirectToAdminUsers() { redirectToPath('/#/admin/users/'); }
export function redirectToAdminRoles() { redirectToPath('/#/admin/roles/'); }
export function redirectToAdminDevices() { redirectToPath('/#/devices/'); }
export function redirectToPackages() { redirectToPath('/#/bots/packages/'); }
export function redirectToHome() { redirectToPath('/#/dashboard/home/overview'); }



export interface Command {
	action: () => void | Promise<void>;
	aliases: string[];
	description: string;
}

export const commandsWithAliases: Record<string, Command> = {
	addVariable: {
		action: addVariable,
		aliases: ["adv", "addvar", "add variable"],
		description: "Shows dialog to create a new variable",
	},
	deleteUnusedVariables: {
		action: deleteUnusedVariables,
		aliases: ["duv", "delete unused", "remove unused variables"],
		description: "Shows dialog to select and delete unused variables",
	},
	redirectToPrivateRepository: {
		action: redirectToPrivateRepository,
		aliases: ["p", "private", "private bots"],
		description: "Redirects to the private bots folder",
	},
	redirectToPublicRepository: {
		action: redirectToPublicRepository,
		aliases: ["pub", "public", "public bots"],
		description: "Redirects to the public bots folder",
	},
	redirectToActivityHistorical: {
		action: redirectToActivityHistorical,
		aliases: ["historical", "history", "activity historical"],
		description: "Redirects to the activities historical tab",
	},
	redirectToInProgress: {
		action: redirectToInProgress,
		aliases: ["inprogress", "progress", "in progress"],
		description: "Redirects to the in-progress activities tab",
	},
	redirectToAuditLog: {
		action: redirectToAuditLog,
		aliases: ["audit", "audit log"],
		description: "Redirects to the activities historical tab",
	},
	redirectToAdminUsers: {
		action: redirectToAdminUsers,
		aliases: ["users", "admin users", "manage users"],
		description: "Redirects to the admin users page",
	},
	redirectToAdminRoles: {
		action: redirectToAdminRoles,
		aliases: ["roles", "admin roles", "manage roles"],
		description: "Redirects to the admin roles page",
	},
	redirectToAdminDevices: {
		action: redirectToAdminDevices,
		aliases: ["devices", "admin devices", "manage devices"],
		description: "Redirects to the admin devices page",
	},
	redirectToHome: {
		action: redirectToHome,
		aliases: ["home", "dashboard", "overview"],
		description: "Redirects to the dashboard home overview",
	},
	showHelp: {
		action: showHelp,
		aliases: ["help", "man", "show help"],
		description: "Displays help information for available commands",
	},
	universalCopy: {
		action: universalCopyCommandPalette,
		aliases: ["universal copy", "copy universal", "rocket copy"],
		description: "Copy actions between control rooms.",
	},
	universalPaste: {
		action: universalPasteCommandPalette,
		aliases: ["universal paste", "paste universal", "rocket paste"],
		description: "Paste actions between control rooms.",
	},
	exportActionToClipboard: {
		action: exportActionToClipboard,
		aliases: ["export action", "copy action json", "export copied action", "share action"],
		description: "Export the currently copied action as JSON to your clipboard.",
	},
	importActionFromJson: {
		action: importActionFromJson,
		aliases: ["import action", "paste action json", "import shared action", "load action json"],
		description: "Import an action from JSON and paste it as if copied locally.",
	},
	redirectToPackages: {
		action: redirectToPackages,
		aliases: ["packages", "pack"],
		description: "Redirects to the admin packages page",
	},
};