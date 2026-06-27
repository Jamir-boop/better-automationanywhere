export type AutomationAnywhereSelectorView =
	| 'shared'
	| 'taskbot-editor'
	| 'folder-navigation';
export type AutomationAnywhereSelectorGroup =
	| 'general'
	| 'taskbot-editor'
	| 'taskbot-transient'
	| 'folder-navigation';
export type AutomationAnywhereSelectorSeverity = 'required' | 'optional' | 'transient';
export type AutomationAnywhereSelectorStatus =
	| 'active'
	| 'watch'
	| 'deprecated'
	| 'remove-candidate';
export type AutomationAnywhereSelectorRequirement =
	| 'bot-modal'
	| 'loading-indicator'
	| 'error-modal'
	| 'done-modal';

export interface AutomationAnywhereSelectorCheck {
	id: string;
	view: AutomationAnywhereSelectorView;
	group: AutomationAnywhereSelectorGroup;
	label: string;
	feature: string;
	selector: string;
	source: string;
	severity: AutomationAnywhereSelectorSeverity;
	status: AutomationAnywhereSelectorStatus;
	requires?: AutomationAnywhereSelectorRequirement;
	triggerHint?: string;
	notes?: string;
}

export const MAIN_NAVIGATION_SELECTOR = '.main-layout__navigation';
export const PATHFINDER_EXPANDER_SELECTOR =
	'button[data-path="Pathfinder.expander"], button.pathfinder-tray-expander';
export const PATHFINDER_COLLAPSE_BUTTON_SELECTOR =
	'button[data-path="Pathfinder.expander"][aria-expanded="true"], button.pathfinder-tray-expander[aria-expanded="true"], button[aria-label="Collapse"]';
export const PATHFINDER_COLLAPSED_SELECTOR = '.pathfinder--is_collapsed';
export const PAGE_BACKGROUND_SELECTOR = '.page, .main-layout__content';
export const SIDEBAR_NAVIGATION_LINKS_SELECTOR =
	'nav[data-path="Pathfinder.primaryItems"] a[href^="#/"]';
export const SIDEBAR_NAVIGATION_SELECTOR = 'nav[data-path="Pathfinder.primaryItems"]';
export const SIDEBAR_NAVIGATION_SECONDARY_SELECTOR =
	'.pathfinder-items--variant_secondary';
export const SIDEBAR_NAVIGATION_PRIMARY_ITEM_SELECTOR =
	'.pathfinder-items__item--variant_primary';
export const SIDEBAR_NAVIGATION_PRIMARY_LABEL_SELECTOR =
	'[data-path="Pathfinder.button"] .pathfinder-items__item-label';
export const SIDEBAR_NAVIGATION_ITEM_LABEL_SELECTOR =
	'.pathfinder-items__item-label';
export const LOADING_INDICATOR_SELECTOR =
	'.devicechannelmodal .icon-image-container, .rio-spinner--variant_LOADING, .rio-spinner--variant_WORKING';
export const TASKBOT_EDITOR_LAYOUT_SELECTOR = '.editor-layout__palette';
export const TASKBOT_CANVAS_NODE_SELECTOR = '.taskbot-canvas-list-node';
export const TASKBOT_LINE_NUMBER_SELECTOR =
	'.taskbot-canvas-list-node > .taskbot-canvas-list-node__number';
export const TASKBOT_CLICKABLE_LINE_NUMBER_SELECTOR =
	'.taskbot-canvas-list-node > .taskbot-canvas-list-node__number.taskbot-canvas-list-node__number--clickable';
export const TASKBOT_NODE_LINK_SELECTOR =
	'.taskbot-canvas-list-node__title a.taskbotnodelabel-details-link[href]';
export const EDITOR_PALETTE_SELECTOR = '.editor-palette';
export const EDITOR_PALETTE_CANVAS_SELECTOR = '.editor-layout__canvas';
export const EDITOR_PALETTE_SECTION_SELECTOR = '[data-path="EditorPalette.section"]';
export const ACTIVE_EDITOR_PALETTE_HEADER_SELECTOR =
	'.editor-palette-section__header--is_active';
export const EDITOR_PALETTE_SCROLLER_SELECTOR = '.editor-palette-section__scroller';
export const EDITOR_PALETTE_TOGGLE_SELECTOR =
	'div.editor-layout__resize[data-path="EditorLayout.paletteResize"] button.editor-layout__resize-toggle[aria-label="Toggle palette"]';
export const LEGACY_EDITOR_PALETTE_TOGGLE_SELECTOR =
	'div.editor-layout__resize:nth-child(2) > button:nth-child(2)';
export const EDITOR_PALETTE_TOGGLE_QUERY_SELECTOR = `${EDITOR_PALETTE_TOGGLE_SELECTOR}, ${LEGACY_EDITOR_PALETTE_TOGGLE_SELECTOR}`;
export const EDITOR_PALETTE_HINT_TOGGLE_SELECTOR =
	`${LEGACY_EDITOR_PALETTE_TOGGLE_SELECTOR}, button[aria-label="Expand"], button[aria-label="Collapse"]`;
export const EDITOR_PALETTE_ACTIONS_SELECTOR =
	'div.editor-palette__accordion button[aria-label="Actions"], button[data-path="EditorPalette.section.button"][aria-label="Actions"]';
export const LEGACY_EDITOR_PALETTE_ACTIONS_SELECTOR =
	'div.editor-palette__accordion button[aria-label="Actions"]';
export const EDITOR_PALETTE_VARIABLES_SELECTOR =
	'button[data-path="EditorPalette.section.button"][aria-label="Variables"]';
export const EDITOR_PALETTE_TRIGGERS_SELECTOR =
	'button.editor-palette-section__header-button[data-path="EditorPalette.section.button"][aria-label="Triggers"]';
export const EDITOR_PALETTE_SEARCH_CANCEL_SELECTOR =
	'.editor-palette-search__cancel button[type="button"][tabindex="-1"]';
export const ADD_VARIABLE_SECTION_BUTTON_SELECTOR =
	'div.editor-palette__accordion header button';
export const ADD_VARIABLE_CREATE_BUTTON_SELECTOR = 'button[name="create"]';
export const ADD_VARIABLE_CONFIRM_BUTTON_SELECTOR =
	'div.action-bar--theme_default button:nth-child(2)';
export const DELETE_UNUSED_VARIABLES_MENU_BUTTON_SELECTOR =
	'button.action-bar__item--is_menu:nth-child(5)';
export const DELETE_UNUSED_VARIABLES_OPTION_SELECTOR =
	'.dropdown-options.g-scroller button.rio-focus--inset_4px:nth-child(2)';
export const EDITOR_DRAGGABLE_CHILD_SELECTOR = '.editor-palette-item__child--is_draggable';
export const EDITOR_TABS_SELECTOR =
	'.taskbot-editor__toolbar__tabs > .editortabs[role="tablist"][data-path="EditorTabs"]';
export const RUN_BUTTON_SELECTOR =
	'button[aria-label="Run"][name="run"], button[name="run"]';
export const RUN_BUTTON_NAME_SELECTOR = 'button[name="run"]';
export const RUN_BUTTON_HOST_SELECTOR = '.icon-button, [data-path="IconButton"]';
export const RUN_BUTTON_PLAY_ICON_SELECTOR = '.rio-icon--icon_play-triangle';
export const CODE_INPUT_SELECTOR = '[data-path="CodeInput"]';
export const SHARED_COPY_BUTTON_SELECTOR = '.aa-icon-action-clipboard-copy--shared';
export const SHARED_PASTE_BUTTON_SELECTOR = '.aa-icon-action-clipboard-paste--shared';
export const BOT_MODAL_SELECTOR = '[data-modal-id="taskbot-action-run-now"]';
export const DIALOG_SELECTOR = '[role="dialog"]';
export const ALERT_CONTROLS_SELECTOR = '.alert__controls';
export const MESSAGE_CONTROLS_SELECTOR = '.message__controls';
export const MESSAGE_HEADER_SELECTOR = '.message__header';
export const MESSAGE_TITLE_SELECTOR = '.message__title';
export const MESSAGE_TITLE_CONTAINER_SELECTOR = '.message__title-container';
export const BOT_MODAL_CONTROLS_SELECTOR =
	'.alert__controls, .message__controls, .message__title-container';
export const BOT_MODAL_DIALOG_SELECTOR =
	'[data-modal-id="taskbot-action-run-now"] [role="dialog"], [role="dialog"] [data-modal-id="taskbot-action-run-now"]';
export const BOT_MODAL_RUNNING_INDICATOR_SELECTOR =
	'.devicechannelmodal, .rio-spinner--variant_WORKING';
export const MODAL_BACKDROP_SELECTOR = '.modal-backdrop';
export const ERROR_MODAL_SELECTOR = '.modal--theme_error';
export const ERROR_BADGE_ICON_SELECTOR =
	'span.rio-icon.rio-icon--icon_exclamation-mark--internal-use';
export const DONE_MODAL_SELECTOR = '.taskbot-success';
export const DONE_BADGE_ICON_SELECTOR = 'span.rio-icon.rio-icon--icon_checkmark';
export const FOLDER_LIST_SELECTOR = '.folder-list__items';
export const FOLDER_LIST_ITEM_SELECTOR = '.folder-list-item';
export const ACTIVE_FOLDER_SELECTOR = '.folder-list-item--is_active';
export const FOLDER_TABLE_ROW_SELECTOR = '.datatable-row';
export const FOLDER_TABLE_COLUMN_SELECTOR = '.datatable-column';
export const FOLDER_TABLE_HEADER_SELECTOR = '.datatable-header-container';
export const FOLDER_REFRESH_SELECTOR = '[name="table-refresh"]';
export const VARIABLE_ROW_SELECTOR = '.editor-palette-item[data-item-name]';
export const VARIABLE_LABEL_SELECTOR =
	'.editor-palette-item__child-label[data-path="ClippedText"]';
export const VARIABLE_LABEL_TEXT_SELECTOR = '.clipped-text__string--for_presentation';
export const ACTIVE_EDITOR_PALETTE_LABEL_SELECTOR =
	'.editor-palette-section__header--is_active .clipped-text__string--for_presentation';
export const TASK_EDITOR_CAPABILITY_SELECTOR =
	`${SHARED_COPY_BUTTON_SELECTOR}, ${SHARED_PASTE_BUTTON_SELECTOR}, .taskbot-editor__toolbar__action, ${TASKBOT_CANVAS_NODE_SELECTOR}, ${EDITOR_PALETTE_CANVAS_SELECTOR}`;

export const AUTOMATION_ANYWHERE_SELECTOR_CHECKS: AutomationAnywhereSelectorCheck[] = [
	{
		id: 'main-navigation',
		view: 'shared',
		group: 'general',
		label: 'Main navigation',
		feature: 'Slim sidebar',
		selector: MAIN_NAVIGATION_SELECTOR,
		source: 'src/styl/rootSidebarAutoHide.styl',
		severity: 'optional',
		status: 'active',
	},
	{
		id: 'pathfinder-expander',
		view: 'shared',
		group: 'general',
		label: 'Pathfinder expander',
		feature: 'Slim sidebar',
		selector: PATHFINDER_EXPANDER_SELECTOR,
		source: 'src/ts/ui.ts',
		severity: 'optional',
		status: 'active',
	},
	{
		id: 'pathfinder-collapsed',
		view: 'shared',
		group: 'general',
		label: 'Collapsed Pathfinder',
		feature: 'Slim sidebar',
		selector: PATHFINDER_COLLAPSED_SELECTOR,
		source: 'src/styl/rootSidebarAutoHide.styl',
		severity: 'transient',
		status: 'active',
		triggerHint: 'Collapse the Pathfinder sidebar to trigger this state.',
	},
	{
		id: 'page-background',
		view: 'shared',
		group: 'general',
		label: 'Page background',
		feature: 'Custom background',
		selector: PAGE_BACKGROUND_SELECTOR,
		source: 'src/styl/background.styl',
		severity: 'optional',
		status: 'active',
	},
	{
		id: 'sidebar-nav-links',
		view: 'shared',
		group: 'general',
		label: 'Sidebar navigation links',
		feature: 'Dynamic navigation commands',
		selector: SIDEBAR_NAVIGATION_LINKS_SELECTOR,
		source: 'src/ts/commands.ts',
		severity: 'optional',
		status: 'active',
	},
	{
		id: 'loading-indicator',
		view: 'shared',
		group: 'general',
		label: 'Loading indicator',
		feature: 'Loading animation',
		selector: LOADING_INDICATOR_SELECTOR,
		source: 'src/styl/customLoadingIcon.styl',
		severity: 'transient',
		status: 'active',
		requires: 'loading-indicator',
		triggerHint: 'Navigate to a page that triggers a loading spinner.',
	},
	{
		id: 'taskbot-editor-layout',
		view: 'taskbot-editor',
		group: 'taskbot-editor',
		label: 'Taskbot editor layout',
		feature: 'Taskbot editor detection',
		selector: TASKBOT_EDITOR_LAYOUT_SELECTOR,
		source: 'src/ts/ui.ts',
		severity: 'required',
		status: 'active',
	},
	{
		id: 'taskbot-canvas-node',
		view: 'taskbot-editor',
		group: 'taskbot-editor',
		label: 'Taskbot canvas node',
		feature: 'Taskbot editor UI',
		selector: TASKBOT_CANVAS_NODE_SELECTOR,
		source: 'src/styl/editorMain.styl',
		severity: 'required',
		status: 'active',
	},
	{
		id: 'taskbot-line-number',
		view: 'taskbot-editor',
		group: 'taskbot-editor',
		label: 'Taskbot line numbers',
		feature: 'Line jump',
		selector: TASKBOT_LINE_NUMBER_SELECTOR,
		source: 'src/ts/commands.ts',
		severity: 'optional',
		status: 'active',
	},
	{
		id: 'taskbot-clickable-line-number',
		view: 'taskbot-editor',
		group: 'taskbot-editor',
		label: 'Clickable line numbers',
		feature: 'Taskbot editor UI',
		selector: TASKBOT_CLICKABLE_LINE_NUMBER_SELECTOR,
		source: 'src/styl/editorMain.styl',
		severity: 'optional',
		status: 'active',
	},
	{
		id: 'taskbot-node-link',
		view: 'taskbot-editor',
		group: 'taskbot-editor',
		label: 'Taskbot node label link',
		feature: 'Block node label clicks',
		selector: TASKBOT_NODE_LINK_SELECTOR,
		source: 'src/ts/utils.ts',
		severity: 'optional',
		status: 'active',
	},
	{
		id: 'editor-palette',
		view: 'taskbot-editor',
		group: 'taskbot-editor',
		label: 'Editor palette',
		feature: 'Palette buttons',
		selector: EDITOR_PALETTE_SELECTOR,
		source: 'src/styl/editorActionsVariablesTriggers.styl',
		severity: 'required',
		status: 'active',
	},
	{
		id: 'editor-palette-scroller',
		view: 'taskbot-editor',
		group: 'taskbot-editor',
		label: 'Editor palette scroller',
		feature: 'Palette buttons',
		selector: EDITOR_PALETTE_SCROLLER_SELECTOR,
		source: 'src/ts/ui.ts',
		severity: 'optional',
		status: 'active',
	},
	{
		id: 'editor-palette-toggle',
		view: 'taskbot-editor',
		group: 'taskbot-editor',
		label: 'Editor palette toggle',
		feature: 'Palette commands',
		selector: EDITOR_PALETTE_TOGGLE_QUERY_SELECTOR,
		source: 'src/ts/utils.ts',
		severity: 'optional',
		status: 'watch',
		notes: 'Includes legacy nth-child fallback.',
	},
	{
		id: 'editor-palette-actions',
		view: 'taskbot-editor',
		group: 'taskbot-editor',
		label: 'Actions palette button',
		feature: 'Palette commands',
		selector: EDITOR_PALETTE_ACTIONS_SELECTOR,
		source: 'src/ts/commands.ts',
		severity: 'optional',
		status: 'active',
	},
	{
		id: 'editor-palette-variables',
		view: 'taskbot-editor',
		group: 'taskbot-editor',
		label: 'Variables palette button',
		feature: 'Variable metadata',
		selector: EDITOR_PALETTE_VARIABLES_SELECTOR,
		source: 'src/ts/commands.ts',
		severity: 'optional',
		status: 'active',
	},
	{
		id: 'editor-palette-triggers',
		view: 'taskbot-editor',
		group: 'taskbot-editor',
		label: 'Triggers palette button',
		feature: 'Palette commands',
		selector: EDITOR_PALETTE_TRIGGERS_SELECTOR,
		source: 'src/ts/commands.ts',
		severity: 'optional',
		status: 'active',
	},
	{
		id: 'editor-palette-search-cancel',
		view: 'taskbot-editor',
		group: 'taskbot-editor',
		label: 'Palette search cancel',
		feature: 'Palette commands',
		selector: EDITOR_PALETTE_SEARCH_CANCEL_SELECTOR,
		source: 'src/ts/commands.ts',
		severity: 'transient',
		status: 'watch',
	},
	{
		id: 'editor-draggable-child',
		view: 'taskbot-editor',
		group: 'taskbot-editor',
		label: 'Draggable palette item',
		feature: 'Taskbot editor UI',
		selector: EDITOR_DRAGGABLE_CHILD_SELECTOR,
		source: 'src/styl/taskbot.styl',
		severity: 'optional',
		status: 'active',
	},
	{
		id: 'editor-tabs',
		view: 'taskbot-editor',
		group: 'taskbot-editor',
		label: 'Editor tabs',
		feature: 'Hide editor tabs',
		selector: EDITOR_TABS_SELECTOR,
		source: 'src/styl/editorTabsButtons.styl',
		severity: 'optional',
		status: 'active',
	},
	{
		id: 'run-button',
		view: 'taskbot-editor',
		group: 'taskbot-editor',
		label: 'Run button',
		feature: 'Run button style',
		selector: RUN_BUTTON_SELECTOR,
		source: 'src/ts/run-button-animation.ts',
		severity: 'optional',
		status: 'active',
	},
	{
		id: 'code-input',
		view: 'taskbot-editor',
		group: 'taskbot-editor',
		label: 'Code input',
		feature: 'Long text/code input',
		selector: CODE_INPUT_SELECTOR,
		source: 'src/styl/codeInput.styl',
		severity: 'optional',
		status: 'active',
	},
	{
		id: 'shared-copy-button',
		view: 'taskbot-editor',
		group: 'taskbot-editor',
		label: 'Shared copy button',
		feature: 'Universal clipboard',
		selector: SHARED_COPY_BUTTON_SELECTOR,
		source: 'src/ts/clipboard.ts',
		severity: 'optional',
		status: 'active',
	},
	{
		id: 'shared-paste-button',
		view: 'taskbot-editor',
		group: 'taskbot-editor',
		label: 'Shared paste button',
		feature: 'Universal clipboard',
		selector: SHARED_PASTE_BUTTON_SELECTOR,
		source: 'src/ts/clipboard.ts',
		severity: 'optional',
		status: 'active',
	},
	{
		id: 'bot-modal',
		view: 'taskbot-editor',
		group: 'taskbot-transient',
		label: 'Running bot modal',
		feature: 'Minimize running bot window',
		selector: BOT_MODAL_SELECTOR,
		source: 'src/ts/bot-execution-modal.ts',
		severity: 'transient',
		status: 'active',
		requires: 'bot-modal',
		triggerHint: 'Click Run on a taskbot to trigger the running bot modal.',
	},
	{
		id: 'bot-modal-controls',
		view: 'taskbot-editor',
		group: 'taskbot-transient',
		label: 'Running bot modal controls',
		feature: 'Minimize running bot window',
		selector: BOT_MODAL_CONTROLS_SELECTOR,
		source: 'src/ts/bot-execution-modal.ts',
		severity: 'transient',
		status: 'active',
		requires: 'bot-modal',
		triggerHint: 'Click Run on a taskbot to trigger the running bot modal.',
	},
	{
		id: 'bot-modal-dialog',
		view: 'taskbot-editor',
		group: 'taskbot-transient',
		label: 'Running bot dialog',
		feature: 'Minimize running bot window',
		selector: BOT_MODAL_DIALOG_SELECTOR,
		source: 'src/ts/bot-execution-modal.ts',
		severity: 'transient',
		status: 'active',
		requires: 'bot-modal',
		triggerHint: 'Click Run on a taskbot to trigger the running bot modal.',
	},
	{
		id: 'bot-modal-running-indicator',
		view: 'taskbot-editor',
		group: 'taskbot-transient',
		label: 'Running indicator',
		feature: 'Minimize running bot window',
		selector: BOT_MODAL_RUNNING_INDICATOR_SELECTOR,
		source: 'src/ts/bot-execution-modal.ts',
		severity: 'transient',
		status: 'active',
		requires: 'bot-modal',
		triggerHint: 'Click Run on a taskbot to trigger the running indicator.',
	},
	{
		id: 'error-modal',
		view: 'taskbot-editor',
		group: 'taskbot-transient',
		label: 'Error modal',
		feature: 'Sounds',
		selector: ERROR_MODAL_SELECTOR,
		source: 'src/ts/sounds.ts',
		severity: 'transient',
		status: 'active',
		requires: 'error-modal',
		triggerHint: 'Run a taskbot that triggers an error to see this modal.',
	},
	{
		id: 'done-modal',
		view: 'taskbot-editor',
		group: 'taskbot-transient',
		label: 'Done modal',
		feature: 'Sounds',
		selector: DONE_MODAL_SELECTOR,
		source: 'src/ts/sounds.ts',
		severity: 'transient',
		status: 'active',
		requires: 'done-modal',
		triggerHint: 'Run a taskbot to completion to see the done modal.',
	},
	{
		id: 'folder-list',
		view: 'folder-navigation',
		group: 'folder-navigation',
		label: 'Folder list',
		feature: 'Scrollable folders',
		selector: FOLDER_LIST_SELECTOR,
		source: 'src/styl/foldersScrollable.styl',
		severity: 'required',
		status: 'active',
	},
	{
		id: 'folder-list-item',
		view: 'folder-navigation',
		group: 'folder-navigation',
		label: 'Folder list item',
		feature: 'Scrollable folders',
		selector: FOLDER_LIST_ITEM_SELECTOR,
		source: 'src/styl/foldersScrollable.styl',
		severity: 'required',
		status: 'active',
	},
	{
		id: 'active-folder',
		view: 'folder-navigation',
		group: 'folder-navigation',
		label: 'Active folder',
		feature: 'Scrollable folders',
		selector: ACTIVE_FOLDER_SELECTOR,
		source: 'src/ts/folders.ts',
		severity: 'optional',
		status: 'active',
	},
	{
		id: 'folder-table-row',
		view: 'folder-navigation',
		group: 'folder-navigation',
		label: 'Folder table row',
		feature: 'Folder columns',
		selector: FOLDER_TABLE_ROW_SELECTOR,
		source: 'src/styl/foldersColumns.styl',
		severity: 'optional',
		status: 'active',
	},
	{
		id: 'folder-table-column',
		view: 'folder-navigation',
		group: 'folder-navigation',
		label: 'Folder table column',
		feature: 'Folder columns',
		selector: FOLDER_TABLE_COLUMN_SELECTOR,
		source: 'src/styl/foldersColumns.styl',
		severity: 'required',
		status: 'active',
	},
	{
		id: 'folder-table-header',
		view: 'folder-navigation',
		group: 'folder-navigation',
		label: 'Folder table header',
		feature: 'Folder columns',
		selector: FOLDER_TABLE_HEADER_SELECTOR,
		source: 'src/styl/foldersColumns.styl',
		severity: 'optional',
		status: 'active',
	},
	{
		id: 'folder-refresh',
		view: 'folder-navigation',
		group: 'folder-navigation',
		label: 'Folder refresh button',
		feature: 'Tools folder refresh',
		selector: FOLDER_REFRESH_SELECTOR,
		source: 'entrypoints/content.ts',
		severity: 'optional',
		status: 'active',
	},
];

export function getAutomationAnywhereSelectorCheck(
	id: string
): AutomationAnywhereSelectorCheck | undefined {
	return AUTOMATION_ANYWHERE_SELECTOR_CHECKS.find((check) => check.id === id);
}
