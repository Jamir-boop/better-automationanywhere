import * as command from './commands';
import { getCommandsWithNavigation } from './commands';
import { debugError } from './debug';
import * as utils from './utils';

let activePredictionIndex = -1;

export function insertCommandPalette(retryCount = 0): void {
	if (document.querySelector('#commandPalette')) {
		return;
	}
	const containerDiv = document.createElement('div');
	containerDiv.id = 'commandPalette';
	containerDiv.className = 'command_palette--hidden';
	containerDiv.hidden = true;
	containerDiv.setAttribute('aria-hidden', 'true');
	containerDiv.innerHTML = `
		<input type="text" id="commandInput" placeholder="Enter command...">
		<div id="commandPredictions" class="command_predictions"></div>
	`;
	document.body.appendChild(containerDiv);

	if (!document.getElementById('commandPalette-style')) {
		const style = document.createElement('style');
		style.id = 'commandPalette-style';
		style.type = 'text/css';
		style.appendChild(
			document.createTextNode(`
				#commandPalette,
				#commandPalette * {
					box-sizing: border-box !important;
					color: #000 !important;
					font-size: 1.15rem !important;
					font-family: Museo Sans, Arial, sans-serif !important;
					letter-spacing: 0 !important;
				}
				#commandPalette {
					position: fixed;
					top: 50%;
					left: 50%;
					transform: translate(-50%, -50%);
					background-color: #fff !important;
					color: #000 !important;
					border-radius: 8px 8px 0 0;
					display: flex !important;
					flex-direction: column;
					align-items: center;
					min-width: 30vw;
					max-width: 80vw;
					width: 600px;
					z-index: 99999 !important;
					box-shadow: 0 0 0 5000px #00000054;
				}
				#commandInput, #commandInput:focus-visible, #commandInput:active {
					all: unset;
					background-color: #fff !important;
					color: #000 !important;
					caret-color: #000 !important;
					padding: 10px;
					width: 93%;
					margin-bottom: 10px;
					border: 2px solid transparent;
					border-radius: 5px;
				}
				#commandInput::placeholder {
					color: #555 !important;
					opacity: 1 !important;
				}
				#commandPredictions {
					position: absolute;
					top: 100%;
					left: 0;
					width: 100%;
					background-color: #fff !important;
					color: #000 !important;
					box-shadow: 0 4px 8px rgba(0,0,0,0.1);
					border-radius: 0 0 8px 8px;
					max-height: 200px;
					overflow-y: auto;
					z-index: 100000;
				}
				.command_prediction-item {
					background-color: #fff !important;
					color: #000 !important;
					padding: 8px;
					cursor: pointer;
					border-bottom: 1px solid #eee;
				}
				.command_prediction-item strong {
					color: #000 !important;
					font-weight: bold;
				}
				.command_prediction-item:hover, .command_prediction-item.active {
					background-color: #f0f0f0 !important;
					color: #000 !important;
				}
				@keyframes fadeIn {
					from { opacity: 0; transform: translate(-50%, -50%) scale(0.85); }
					to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
				}
				@keyframes fadeOut {
					from { opacity: 1; transform: translate(-50%, -50%) scale(1); }
					to { opacity: 0; transform: translate(-50%, -50%) scale(0.95); }
				}
				.command_palette--visible { display: flex !important; animation: fadeIn 0.25s ease-out forwards; }
				.command_palette--hidden { animation: fadeOut 0.25s ease-out forwards; display: none !important; pointer-events: none; opacity: 0; z-index: -1 !important; }
			`)
		);
		document.head.appendChild(style);
	}

	setupCommandInputEventListeners();

	if (!document.querySelector('#commandPalette')) {
		if (retryCount < 5) {
			setTimeout(() => insertCommandPalette(retryCount + 1), 3000);
		} else {
			void debugError('palette', 'Failed to insert command palette after 5 retries.', {
				retryCount,
			}, { feedback: true });
		}
	}
}

export function setupCommandInputEventListeners(): void {
	const commandInput = getCommandInput();
	if (!commandInput) return;

	commandInput.addEventListener('input', function () {
		updatePredictions(this.value);
	});

	commandInput.addEventListener('keydown', navigatePredictions);
}

export function getCommandPredictions(): HTMLElement | null {
	return document.getElementById('commandPredictions');
}

export function getCommandInput(): HTMLInputElement | null {
	return document.getElementById('commandInput') as HTMLInputElement | null;
}

export function getCommandPalette(): HTMLElement | null {
	return document.getElementById('commandPalette');
}

export function isCommandPaletteVisible(): boolean {
	return !!getCommandPalette()?.classList.contains('command_palette--visible');
}

export function closeCommandPalette(): void {
	const commandPalette = getCommandPalette();
	if (!commandPalette) return;
	const input = getCommandInput();
	commandPalette.classList.remove('command_palette--visible');
	commandPalette.classList.add('command_palette--hidden');
	commandPalette.hidden = true;
	commandPalette.setAttribute('aria-hidden', 'true');
	if (input) {
		input.value = '';
		input.blur();
	}
	clearPredictions();
	activePredictionIndex = -1;
}

export function clearPredictions(): void {
	const predictions = getCommandPredictions();
	if (predictions) predictions.innerHTML = '';
}

export function updatePredictions(input: string): void {
	clearPredictions();
	if (!input) {
		activePredictionIndex = -1;
		return;
	}

	const normalizedInput = utils.normalizeCommandText(input);
	const jumpToLineMatch = input.match(/^:(\d+)$/);
	if (jumpToLineMatch) {
		const lineNumber = parseInt(jumpToLineMatch[1], 10);
		const predictionItem = document.createElement('div');
		predictionItem.classList.add('command_prediction-item');
		predictionItem.innerHTML = `<strong>Go to line ${lineNumber}</strong>`;
		utils.safeAddClick(predictionItem, () => {
			command.scrollToLineNumber(lineNumber);
			clearPredictions();
			closeCommandPalette();
		});
		getCommandPredictions()?.appendChild(predictionItem);
		return;
	}

	Object.entries(getCommandsWithNavigation()).forEach(
		([, { action, aliases, description }]) => {
			const match = aliases.find((alias) => alias.startsWith(normalizedInput));
			if (!match) return;

			const predictionItem = document.createElement('div');
			predictionItem.classList.add('command_prediction-item');
			predictionItem.innerHTML = `<strong>${utils.escapeHtml(match)}</strong> - ${utils.escapeHtml(description)}`;
			utils.safeAddClick(predictionItem, () => {
				const inputEl = getCommandInput();
				if (inputEl) inputEl.value = match;
				executeCommand(action);
				clearPredictions();
			});
			getCommandPredictions()?.appendChild(predictionItem);
		}
	);

	const items = getCommandPredictions()?.getElementsByClassName(
		'command_prediction-item'
	);
	if (items && items.length > 0) {
		activePredictionIndex = 0;
		updateActivePrediction(items);
	} else {
		activePredictionIndex = -1;
	}
}

export function executeCommand(action?: () => void | Promise<void>): void {
	const runAction = () => {
		if (action) {
			void action();
		} else {
			command.showHelp();
		}
	};

	if (isCommandPaletteVisible()) {
		closeCommandPalette();
		requestAnimationFrame(() => requestAnimationFrame(runAction));
		return;
	}

	runAction();
}

export function navigatePredictions(e: KeyboardEvent): void {
	const commandPredictions = getCommandPredictions();
	if (!commandPredictions) return;
	const items = commandPredictions.getElementsByClassName('command_prediction-item');
	if (!items.length) {
		if (e.key === 'Escape') {
			closeCommandPalette();
			e.preventDefault();
		}
		return;
	}

	if (items.length === 1 && e.key === 'Enter') {
		(items[0] as HTMLElement).click();
		e.preventDefault();
		return;
	}

	if (['ArrowDown', 'ArrowUp', 'Enter'].includes(e.key)) {
		e.preventDefault();
		if (e.key === 'ArrowDown') {
			activePredictionIndex = (activePredictionIndex + 1) % items.length;
			updateActivePrediction(items);
		} else if (e.key === 'ArrowUp') {
			activePredictionIndex =
				activePredictionIndex <= 0 ? items.length - 1 : activePredictionIndex - 1;
			updateActivePrediction(items);
		} else if (e.key === 'Enter' && activePredictionIndex >= 0) {
			(items[activePredictionIndex] as HTMLElement).click();
		}
	} else if (e.key === 'Escape') {
		closeCommandPalette();
		e.preventDefault();
	}
}

export function updateActivePrediction(items: HTMLCollectionOf<Element>): void {
	Array.from(items).forEach((item, index) => {
		item.classList.toggle('active', index === activePredictionIndex);
	});
}

export function togglePaletteVisibility(): void {
	const commandPalette = getCommandPalette();
	if (!commandPalette) return;
	const input = getCommandInput();
	if (isCommandPaletteVisible()) {
		closeCommandPalette();
		return;
	}

	commandPalette.hidden = false;
	commandPalette.setAttribute('aria-hidden', 'false');
	commandPalette.classList.remove('command_palette--hidden');
	commandPalette.classList.add('command_palette--visible');
	input?.focus();
}
