import { commandsWithAliases } from './commands';
import * as command from './commands';
import * as utils from './utils';

let activePredictionIndex = -1;

export function insertCommandPalette(retryCount = 0) {
	if (document.querySelector("#commandPalette")) {
		return;
	}
	const containerDiv = document.createElement("div");
	containerDiv.id = "commandPalette";
	containerDiv.className = "command_palette--hidden";
	containerDiv.innerHTML = `
		<input type="text" id="commandInput" placeholder="Enter command...">
		<div id="commandPredictions" class="command_predictions"></div>
	`;
	document.body.appendChild(containerDiv);

	if (!document.getElementById("commandPalette-style")) {
		const style = document.createElement("style");
		style.id = "commandPalette-style";
		style.type = "text/css";
		style.appendChild(document.createTextNode(`
			#commandPalette * { font-size: 1.15rem; font-family: Museo Sans,sans-serif; }
			#commandPalette { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
				background-color: white; border-radius: 10px 10px 0 0; display: flex; flex-direction: column;
				align-items: center; min-width: 30vw; max-width: 80vw; width: 600px; z-index: 99999;
				box-shadow: 0px 0px 0px 5000px #00000054; }
			#commandInput, #commandInput:focus-visible, #commandInput:active {
				unset: all; padding: 10px; width: 93%; margin-bottom: 10px; border: 2px solid transparent; border-radius: 5px;
			}
			#commandPalette:focus, #commandPalette:active { border-color: orange; }
			#commandPredictions { position: absolute; top: 100%; left: 0; width: 100%; background-color: white;
				box-shadow: 0 4px 8px rgba(0,0,0,0.1); border-radius: 0 0 10px 10px; max-height: 200px; overflow-y: auto; z-index: 100000; }
			.command_prediction-item.active { background-color: #f0f0f0; }
			.command_prediction-item strong { font-weight: bold; }
			.command_prediction-item { padding: 8px; cursor: pointer; border-bottom: 1px solid #eee; }
			.command_prediction-item:hover, .command_prediction-item.active { background-color: #f0f0f0; }
			@keyframes fadeIn { from { opacity: 0; transform: translate(-50%, -50%) scale(0.85); }
				to { opacity: 1; transform: translate(-50%, -50%) scale(1); } }
			@keyframes fadeOut { from { opacity: 1; transform: translate(-50%, -50%) scale(1); }
				to { opacity: 0; transform: translate(-50%, -50%) scale(0.95); } }
			.command_palette--visible { display: block; animation: fadeIn 0.25s ease-out forwards; }
			.command_palette--hidden { animation: fadeOut 0.25s ease-out forwards; display: none; pointer-events: none; opacity: 0; z-index: -1; }
		`));
		document.head.appendChild(style);
	}

	setupCommandInputEventListeners();

	if (!document.querySelector("#commandPalette")) {
		if (retryCount < 5) {
			setTimeout(() => insertCommandPalette(retryCount + 1), 3000);
		} else {
			console.error("Failed to insert command palette after 5 retries.");
		}
	}
}

export function setupCommandInputEventListeners() {
	const commandInput = getCommandInput();
	if (!commandInput) return;

	commandInput.addEventListener("input", function() {
		updatePredictions(this.value);
	});

	commandInput.addEventListener("keydown", navigatePredictions);
}

export function getCommandPredictions() {
	return document.getElementById("commandPredictions");
}

export function getCommandInput() {
	return document.getElementById("commandInput");
}

export function getCommandPalette() {
	return document.getElementById("commandPalette");
}

export function clearPredictions() {
	const predictions = getCommandPredictions();
	if (predictions) predictions.innerHTML = "";
}

export function updatePredictions(input) {
	clearPredictions();
	if (!input) {
		activePredictionIndex = -1;
		return;
	}

	// Check for ":<number>" syntax to scroll to a line
	const jumpToLineMatch = input.match(/^:(\d+)$/);
	if (jumpToLineMatch) {
		const lineNumber = parseInt(jumpToLineMatch[1], 10);
		const predictionItem = document.createElement("div");
		predictionItem.classList.add("command_prediction-item");
		predictionItem.innerHTML = `<strong>Go to line ${lineNumber}</strong>`;
		utils.safeAddClick(predictionItem, () => {
			command.scrollToLineNumber(lineNumber);
			clearPredictions();
			togglePaletteVisibility();
		});
		getCommandPredictions().appendChild(predictionItem);
		return;
	}

	Object.entries(commandsWithAliases).forEach(
		([, { action, aliases, description }]) => {
			const match = aliases.find((alias) =>
				alias.startsWith(input.toLowerCase())
			);
			if (match) {
				const predictionItem = document.createElement("div");
				predictionItem.classList.add("command_prediction-item");
				predictionItem.innerHTML = `<strong>${match}</strong> - ${description}`;
				utils.safeAddClick(predictionItem, () => {
					const inputEl = getCommandInput();
					if (inputEl) inputEl.value = match;
					executeCommand(action);
					clearPredictions();
				});
				getCommandPredictions().appendChild(predictionItem);
			}
		}
	);

	// Always select the first prediction if any
	const predictionsContainer = getCommandPredictions();
	const items = predictionsContainer ? predictionsContainer.getElementsByClassName("command_prediction-item") : [];
	if (items.length > 0) {
		activePredictionIndex = 0;
		updateActivePrediction(items);
	} else {
		activePredictionIndex = -1;
	}
}

export function executeCommand(action) {
	if (action) {
		action();
	} else {
		showHelp();
	}
	togglePaletteVisibility();
}

export function navigatePredictions(e) {
	const commandPredictions = getCommandPredictions();
	if (!commandPredictions) return;
	const items = commandPredictions.getElementsByClassName("command_prediction-item");
	if (!items.length) {
		if (e.key === "Escape") {
			togglePaletteVisibility();
			e.preventDefault();
		}
		return;
	}

	if (items.length === 1 && e.key === "Enter") {
		items[0].click();
		e.preventDefault();
		return;
	}

	if (["ArrowDown", "ArrowUp", "Enter"].includes(e.key)) {
		e.preventDefault();
		if (e.key === "ArrowDown") {
			activePredictionIndex = (activePredictionIndex + 1) % items.length;
			updateActivePrediction(items);
		} else if (e.key === "ArrowUp") {
			activePredictionIndex = activePredictionIndex <= 0 ? items.length - 1 : activePredictionIndex - 1;
			updateActivePrediction(items);
		} else if (e.key === "Enter" && activePredictionIndex >= 0) {
			items[activePredictionIndex].click();
		}
	} else if (e.key === "Escape") {
		togglePaletteVisibility();
		e.preventDefault();
	}
}

export function updateActivePrediction(items) {
	Array.from(items).forEach((item, index) => {
		item.classList.toggle("active", index === activePredictionIndex);
	});
}

export function togglePaletteVisibility() {
	const commandPalette = getCommandPalette();
	if (!commandPalette) return;
	const input = getCommandInput();
	if (commandPalette.classList.contains("command_palette--visible")) {
		commandPalette.classList.remove("command_palette--visible");
		commandPalette.classList.add("command_palette--hidden");
		if (input) {
			input.value = "";
			input.blur();
		}
		clearPredictions();
		activePredictionIndex = -1;
	} else {
		commandPalette.classList.remove("command_palette--hidden");
		commandPalette.classList.add("command_palette--visible");
		if (input) {
			input.focus();
		}
	}
}