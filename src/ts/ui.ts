import * as utils from './utils';
import * as clipboard from './clipboard';
import * as commands from './commands';

export function insertCustomEditorPaletteButtons() {
	if (document.getElementById("customActionVariableButtons")) {
		return;
	}
	const containerDiv = document.createElement("div");
	containerDiv.id = "customActionVariableButtons";

	const variableButton = document.createElement("button");
	variableButton.className = "customActionVariableButton";
	variableButton.textContent = "Variables";
	variableButton.onclick = function() {
		commands.showVariables();
		updateActiveButton();
	};

	const actionButton = document.createElement("button");
	actionButton.className = "customActionVariableButton";
	actionButton.textContent = "Actions";
	actionButton.onclick = function() {
		commands.showActions();
		updateActiveButton();
	};

	const triggerButton = document.createElement("button");
	triggerButton.className = "customActionVariableButton";
	triggerButton.textContent = "Triggers";
	triggerButton.onclick = function() {
		commands.showTriggers();
		updateActiveButton();
	};

	containerDiv.appendChild(variableButton);
	containerDiv.appendChild(actionButton);
	containerDiv.appendChild(triggerButton);

	const palette = utils.safeQuery(".editor-layout__palette", "insertCustomEditorPaletteButtons");
	if (palette) {
		palette.appendChild(containerDiv);
	}

	if (!document.getElementById("customActionVariableButtons-style")) {
		const style = document.createElement("style");
		style.id = "customActionVariableButtons-style";
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
				text-shadow: 0.5px 0 0 #3c5e83 , -0.01px 0 0 #3c5e83 !important;
			}
			.editor-palette.g-box-sizing_border-box {
				margin-top: 38px;
			}
		`;
		document.head.appendChild(style);
	}
}

export function insertUniversalCopyPasteButtons(attempt = 1) {
	setTimeout(() => {
		const actionBar = document.querySelector('.action-bar--theme_info');
		if (actionBar && !actionBar.querySelector('.universalCopy')) {
			const separator = document.createElement('div');
			separator.className = 'action-bar__separator';
			actionBar.appendChild(separator);

			// Universal Copy button
			const copyButton = document.createElement('button');
			copyButton.className = 'universalCopy rio-focus rio-focus--inset_0 rio-focus--border-radius_4px rio-focus--has_element-focus-visible rio-bare-button g-reset-element rio-bare-button--is_interactive rio-bare-button--rio_interactive-softest rio-bare-button--is_parent rio-bare-button--is_clickable rio-bare-button--size_14px rio-bare-button--is_square rio-bare-button--square_26x26 action-bar__item action-bar__item--is_action taskbot-editor__toolbar__action';
			copyButton.innerHTML = `<span class="icon fa fa-rocket icon--block"></span>`;
			copyButton.title = 'Universal Copy';
			copyButton.onclick = clipboard.universalCopy;
			actionBar.appendChild(copyButton);

			// Universal Paste button
			const pasteButton = document.createElement('button');
			pasteButton.className = 'universalPaste rio-focus rio-focus--inset_0 rio-focus--border-radius_4px rio-focus--has_element-focus-visible rio-bare-button g-reset-element rio-bare-button--is_interactive rio-bare-button--rio_interactive-softest rio-bare-button--is_parent rio-bare-button--is_clickable rio-bare-button--size_14px rio-bare-button--is_square rio-bare-button--square_26x26 action-bar__item action-bar__item--is_action taskbot-editor__toolbar__action';
			pasteButton.innerHTML = `<span class="icon fa fa-rocket icon--block" style="transform: rotate(180deg);"></span>`;
			pasteButton.title = 'Universal Paste';
			pasteButton.onclick = clipboard.universalPaste;
			actionBar.appendChild(pasteButton);
		} else if (attempt < 3) {
			insertUniversalCopyPasteButtons(attempt + 1);
		}
	}, 1000 * attempt);
}

export function removeInlineWidth() {
	const nav = document.querySelector('.main-layout__navigation');
	const pathfinderCollapsed = document.querySelector('.pathfinder--is_collapsed');
	if (pathfinderCollapsed) {
		if (nav?.style?.width) {
			nav.style.removeProperty('width');
		}
		return;
	}
	const collapseButton = document.querySelector('button[aria-label="Collapse"]');
	if (collapseButton) {
		collapseButton.click();
		setTimeout(() => {
			if (nav?.style?.width) {
				nav.style.removeProperty('width');
			}
		}, 500);
	} else {
		console.warn('Collapse button not found');
	}
}

export function updateActiveButton() {
	const activeSection = document.querySelector(
		".editor-palette-section__header--is_active .clipped-text__string--for_presentation"
	)?.innerText;
	const buttons = document.querySelectorAll(".customActionVariableButton");
	buttons.forEach((button) => {
		if (button.textContent === activeSection) {
			button.classList.add("buttonToolbarActive");
		} else {
			button.classList.remove("buttonToolbarActive");
		}
	});
}


type ToastType = 'error' | 'warning' | 'alert';

export function showToast(message: string, type: ToastType = 'alert', duration = 5000): void {
  // Remove any existing toast
  const prev = document.getElementById('ba-toast');
  if (prev) prev.remove();

  const toast = document.createElement('div');
  toast.id = 'ba-toast';
  toast.textContent = message;
  toast.style.position = 'fixed';
  toast.style.bottom = '40px';
  toast.style.left = '50%';
  toast.style.transform = 'translateX(-50%)';
  toast.style.zIndex = '100000';
  toast.style.padding = '12px 24px';
  toast.style.borderRadius = '8px';
  toast.style.fontSize = '16px';
  toast.style.color = 'white';
  toast.style.boxShadow = '0 4px 16px rgba(0,0,0,0.15)';
  toast.style.opacity = '0';
  toast.style.transition = 'opacity 0.3s';

  // Set background color based on type
  switch (type) {
    case 'error':
      toast.style.background = '#e53e3e'; // red
      break;
    case 'warning':
      toast.style.background = '#ecc94b'; // yellow
      toast.style.color = '#2d3748';
      break;
    case 'alert':
    default:
      toast.style.background = '#3182ce'; // blue
      break;
  }

  document.body.appendChild(toast);
  // animate in
  setTimeout(() => { toast.style.opacity = '1'; }, 20);
  // animate out and remove
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}
