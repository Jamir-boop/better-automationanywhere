import * as command from './commands';
import { getCommandsWithNavigation } from './commands';
import { debugError } from './debug';
import { t } from './i18n';
import * as utils from './utils';

let activePredictionIndex = -1;

export function insertCommandPalette(retryCount = 0): void {
	if (document.querySelector('#commandPalette')) {
		updateCommandPaletteLanguage();
		return;
	}
	const containerDiv = document.createElement('div');
	containerDiv.id = 'commandPalette';
	containerDiv.className = 'command_palette--hidden';
	containerDiv.hidden = true;
	containerDiv.style.display = 'none';
	containerDiv.setAttribute('aria-hidden', 'true');
	containerDiv.innerHTML = `
		<input type="text" id="commandInput" placeholder="${utils.escapeHtml(t('Search commands...'))}" aria-label="${utils.escapeHtml(t('Search commands'))}">
		<div id="commandPredictions" class="command_predictions" role="listbox"></div>
	`;

	if (!document.getElementById('commandPalette-style')) {
		const style = document.createElement('style');
		style.id = 'commandPalette-style';
		style.type = 'text/css';
		style.appendChild(
			document.createTextNode(`
				#commandPalette,
				#commandPalette * {
					box-sizing: border-box !important;
					font-family: Museo Sans, Arial, sans-serif !important;
					letter-spacing: 0 !important;
				}
				#commandPalette {
					position: fixed;
					top: 50%;
					left: 50%;
					transform: translate(-50%, -50%);
					background-color: #000000 !important;
					color: #FFFFFF !important;
					border: 1px solid #664A00;
					border-radius: 4px;
					display: flex;
					flex-direction: column;
					align-items: stretch;
					width: min(640px, calc(100vw - 32px));
					max-width: calc(100vw - 32px);
					z-index: 99999 !important;
					box-shadow: 0 24px 80px rgba(0, 0, 0, 0.95);
				}
				#commandInput, #commandInput:focus-visible, #commandInput:active {
					all: unset;
					background-color: #050505 !important;
					color: #FFFFFF !important;
					caret-color: #FFB900 !important;
					padding: 12px;
					margin: 12px 12px 8px;
					border: 1px solid #332500;
					border-radius: 4px;
					font-size: 1rem !important;
					line-height: 1.35;
				}
				#commandInput:focus-visible {
					border-color: #FFB900;
					outline: 2px solid #FFB900;
					outline-offset: 2px;
					box-shadow: none;
				}
				#commandInput::placeholder {
					color: #A0A0A0 !important;
					opacity: 1 !important;
				}
				#commandPredictions {
					width: 100%;
					background-color: #000000 !important;
					color: #FFFFFF !important;
					border-top: 1px solid #332500;
					border-radius: 0 0 4px 4px;
					max-height: min(420px, 60vh);
					overflow-y: auto;
					z-index: 100000;
					padding: 6px;
				}
				.command_prediction-item {
					all: unset;
					box-sizing: border-box !important;
					display: grid;
					grid-template-columns: minmax(0, 1fr) auto;
					gap: 4px 12px;
					width: 100%;
					padding: 10px 12px;
					cursor: pointer;
					border: 1px solid transparent;
					border-radius: 0;
					background-color: transparent !important;
					color: #FFFFFF !important;
				}
				.command_prediction-item strong {
					display: block;
					color: #FFFFFF !important;
					font-weight: bold;
					font-size: 0.95rem !important;
					line-height: 1.3;
				}
				.command_prediction-description {
					display: block;
					margin-top: 2px;
					color: #A0A0A0 !important;
					font-size: 0.82rem !important;
					line-height: 1.35;
				}
				.command_prediction-aliases {
					align-self: center;
					max-width: 220px;
					overflow: hidden;
					text-overflow: ellipsis;
					white-space: nowrap;
					color: #A0A0A0 !important;
					font-size: 0.72rem !important;
				}
				.command_prediction-item:hover, .command_prediction-item.active {
					background-color: #FFB900 !important;
					border-color: #FFB900;
					color: #000000 !important;
				}
				.command_prediction-item:hover *,
				.command_prediction-item.active * {
					color: #000000 !important;
					-webkit-text-fill-color: #000000 !important;
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

	document.body.appendChild(containerDiv);
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

export function updateCommandPaletteLanguage(): void {
	const input = getCommandInput();
	if (!input) return;
	input.placeholder = t('Search commands...');
	input.setAttribute('aria-label', t('Search commands'));
	updatePredictions(input.value);
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
	commandPalette.style.display = 'none';
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

function createPredictionItem(options: {
	title: string;
	description: string;
	aliases?: readonly string[];
	action: () => void;
}): HTMLElement {
	const predictionItem = document.createElement('button');
	predictionItem.type = 'button';
	predictionItem.className = 'command_prediction-item';
	predictionItem.setAttribute('role', 'option');
	const aliasText = options.aliases?.length ? options.aliases.join(', ') : '';
	predictionItem.innerHTML = `
		<span>
			<strong>${utils.escapeHtml(options.title)}</strong>
			<span class="command_prediction-description">${utils.escapeHtml(options.description)}</span>
		</span>
		${aliasText ? `<span class="command_prediction-aliases">${utils.escapeHtml(aliasText)}</span>` : ''}
	`;
	utils.safeAddClick(predictionItem, options.action);
	return predictionItem;
}

function getDisplayAliases(aliases: readonly string[], title: string): string[] {
	return aliases.filter((alias) => alias !== title).slice(0, 4);
}

export function updatePredictions(input: string): void {
	clearPredictions();

	const normalizedInput = utils.normalizeCommandText(input);
	const jumpToLineMatch = input.match(/^:(\d+)$/);
	if (jumpToLineMatch) {
		const lineNumber = parseInt(jumpToLineMatch[1], 10);
		const predictionItem = createPredictionItem({
			title: t('Go to line {line}', { line: lineNumber }),
			description: t('Scroll the taskbot editor to a specific line.'),
			action: () => {
				command.scrollToLineNumber(lineNumber);
				clearPredictions();
				closeCommandPalette();
			},
		});
		getCommandPredictions()?.appendChild(predictionItem);
		const items = getCommandPredictions()?.getElementsByClassName(
			'command_prediction-item'
		);
		if (items) {
			activePredictionIndex = 0;
			updateActivePrediction(items);
		}
		return;
	}

	Object.entries(getCommandsWithNavigation()).forEach(
		([, { action, aliases, description }]) => {
			const match = normalizedInput
				? aliases.find((alias) => alias.startsWith(normalizedInput))
				: aliases[0];
			if (!match) return;

			const predictionItem = createPredictionItem({
				title: match,
				description,
				aliases: getDisplayAliases(aliases, match),
				action: () => {
					const inputEl = getCommandInput();
					if (inputEl) inputEl.value = match;
					executeCommand(action);
					clearPredictions();
				},
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
	commandPalette.style.removeProperty('display');
	commandPalette.setAttribute('aria-hidden', 'false');
	commandPalette.classList.remove('command_palette--hidden');
	commandPalette.classList.add('command_palette--visible');
	updatePredictions(input?.value ?? '');
	input?.focus();
}
