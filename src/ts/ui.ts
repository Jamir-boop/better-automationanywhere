import * as commands from './commands';
import { debugWarn } from './debug';
import { escapeHtml } from './utils';

export function insertCustomEditorPaletteButtons(): void {
	if (document.getElementById('customActionVariableButtons')) {
		return;
	}
	const containerDiv = document.createElement('div');
	containerDiv.id = 'customActionVariableButtons';

	const variableButton = document.createElement('button');
	variableButton.className = 'customActionVariableButton';
	variableButton.textContent = 'Variables';
	variableButton.onclick = () => {
		void commands.showVariables();
		updateActiveButton();
	};

	const actionButton = document.createElement('button');
	actionButton.className = 'customActionVariableButton';
	actionButton.textContent = 'Actions';
	actionButton.onclick = () => {
		void commands.showActions();
		updateActiveButton();
	};

	const triggerButton = document.createElement('button');
	triggerButton.className = 'customActionVariableButton';
	triggerButton.textContent = 'Triggers';
	triggerButton.onclick = () => {
		commands.showTriggers();
		updateActiveButton();
	};

	containerDiv.appendChild(variableButton);
	containerDiv.appendChild(actionButton);
	containerDiv.appendChild(triggerButton);

	const palette = document.querySelector('.editor-layout__palette');
	if (palette) {
		palette.appendChild(containerDiv);
	}

	if (!document.getElementById('customActionVariableButtons-style')) {
		const style = document.createElement('style');
		style.id = 'customActionVariableButtons-style';
		style.textContent = `
			#customActionVariableButtons {
				display: flex;
				width: 100%;
				height: 38px !important;
				background: white;
			}
			#customActionVariableButtons button {
				all: unset;
				font-size: .85rem;
				font-weight: 300;
				cursor: pointer;
				margin: 4px;
				border-radius: 5px;
				border: 1px solid transparent;
				background-color: transparent;
				color: #3c5e83;
				flex-grow: 1;
				text-align: center;
				transition: background-color 0.3s;
			}
			#customActionVariableButtons button:hover {
				background-color: #dae9f3;
			}
			.buttonToolbarActive {
				border: 1px solid #3c5e83 !important;
				text-shadow: 0.5px 0 0 #3c5e83, -0.01px 0 0 #3c5e83 !important;
			}
			.editor-palette.g-box-sizing_border-box {
				margin-top: 38px;
			}
		`;
		document.head.appendChild(style);
	}
}

export function removeInlineWidth(): void {
	const nav = document.querySelector<HTMLElement>('.main-layout__navigation');
	const pathfinderCollapsed = document.querySelector('.pathfinder--is_collapsed');
	if (pathfinderCollapsed) {
		nav?.style.removeProperty('width');
		return;
	}
	const collapseButton = document.querySelector<HTMLElement>('button[aria-label="Collapse"]');
	if (collapseButton) {
		collapseButton.click();
		setTimeout(() => {
			nav?.style.removeProperty('width');
		}, 500);
	} else {
		void debugWarn('selector', 'Collapse button not found.', {
			selector: 'button[aria-label="Collapse"]',
		}, { feedback: true });
	}
}

export function updateActiveButton(): void {
	const activeSection = document.querySelector<HTMLElement>(
		'.editor-palette-section__header--is_active .clipped-text__string--for_presentation'
	)?.innerText;
	const buttons = document.querySelectorAll('.customActionVariableButton');
	buttons.forEach((button) => {
		button.classList.toggle('buttonToolbarActive', button.textContent === activeSection);
	});
}

export function ensureNotificationStyles(): void {
	if (document.getElementById('better-aa-toast-style')) return;

	const style = document.createElement('style');
	style.id = 'better-aa-toast-style';
	style.textContent = `
		@keyframes betterToastInOut {
			0% { opacity: 0; transform: translateX(-20px); }
			15% { opacity: 1; transform: translateX(0); }
			85% { opacity: 1; transform: translateX(0); }
			100% { opacity: 0; transform: translateX(20px); }
		}
		#better-aa-toast-host {
			position: fixed;
			top: 50px;
			left: 50%;
			transform: translateX(-50%);
			z-index: 2147483647;
			pointer-events: none;
			max-width: calc(100vw - 24px);
		}
		#better-aa-toast-host .toasttray-toast {
			position: static !important;
			display: block !important;
			margin-bottom: 8px;
			opacity: 0;
			transform: translateX(-20px);
			animation: betterToastInOut 3s ease forwards;
		}
		#better-aa-toast-host .toast {
			position: relative;
			display: flex;
			gap: 8px;
			align-items: flex-start;
			inline-size: min(460px, calc(100vw - 24px)) !important;
			max-inline-size: min(460px, calc(100vw - 24px)) !important;
			width: 300px !important;
			padding: 10px 12px;
			border-radius: 10px;
			background: #000 !important;
			color: #fff !important;
			box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35) !important;
			pointer-events: auto;
		}
		#better-aa-toast-host .toast-content {
			flex: 1 1 auto;
			min-inline-size: 0;
			font-size: 12px;
			line-height: 1.35;
		}
		#better-aa-toast-host .toast-title {
			font-weight: 700;
			color: #fff !important;
		}
		#better-aa-toast-host .toast-message {
			margin-top: 2px;
			color: #fff !important;
			word-break: break-word;
		}
		#better-aa-toast-host .toast-close {
			all: unset;
			box-sizing: border-box;
			flex: 0 0 auto;
			display: inline-flex;
			align-items: center;
			justify-content: center;
			min-width: 20px;
			height: 20px;
			padding: 0 6px;
			border: 1px solid #fff !important;
			border-radius: 6px;
			background: #000 !important;
			color: #fff !important;
			font-size: 14px;
			font-weight: 700;
			line-height: 1;
			cursor: pointer;
			transition: background-color 0.15s ease, color 0.15s ease, border-color 0.15s ease;
		}
		#better-aa-toast-host .toast-close:hover {
			background: #fff !important;
			color: #000 !important;
			border-color: #000 !important;
		}
		#better-aa-toast-host .toast-close:focus-visible {
			outline: 2px solid #fff;
			outline-offset: 2px;
		}
		#better-aa-toast-host .toast-close svg,
		#better-aa-toast-host .toast-close svg * {
			fill: currentColor !important;
			stroke: currentColor !important;
		}
	`;
	document.head.appendChild(style);
}

function getNotificationTray(): Element {
	let host = document.getElementById('better-aa-toast-host');
	if (!host) {
		host = document.createElement('div');
		host.id = 'better-aa-toast-host';
		host.innerHTML = `
			<div class="main-layout__toast-tray">
				<div class="mainlayouttoasttray">
					<div class="toasttray" data-path="ToastTray"></div>
				</div>
			</div>
		`;
		document.body.appendChild(host);
	}
	return host.querySelector('.toasttray') ?? host;
}

export function showNotification(
	title: string,
	message = '',
	duration = 5000
): void {
	ensureNotificationStyles();

	const tray = getNotificationTray();
	const toastWrapper = document.createElement('div');
	toastWrapper.className = 'toasttray-toast';
	toastWrapper.innerHTML = `
		<div data-path="Toast" class="toast g-reset-element g-box-sizing_border-box toast--closable">
			<div class="toast-content">
				${title ? `<div class="toast-title">${escapeHtml(title)}</div>` : ''}
				${message ? `<div class="toast-message">${escapeHtml(message)}</div>` : ''}
			</div>
			<button type="button" aria-label="Close notification" class="toast-close">×</button>
		</div>
	`;

	const close = () => {
		if (!toastWrapper.isConnected) return;
		toastWrapper.remove();
	};

	toastWrapper.querySelector('.toast-close')?.addEventListener('click', close);
	tray.prepend(toastWrapper);
	setTimeout(close, duration);
}

export function showToast(message: string, _type = 'alert', duration = 5000): void {
	showNotification('', message, duration);
}