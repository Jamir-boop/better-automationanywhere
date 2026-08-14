#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { importTsModule, root } from './lib/ts-module-loader.mjs';

const targets = await importTsModule(join(root, 'src', 'ts', 'control-room-targets.ts'));
const jobs = await importTsModule(join(root, 'src', 'ts', 'tool-jobs.ts'));

const roomA = 'https://one.example.com';
const context = (url, pageType) => ({ url, baseUrl: roomA, hostname: 'one.example.com', pageType });
const tabs = [
	{ tabId: 1, windowId: 8, url: `${roomA}/#/automations/folder/12`, title: 'Folder', authenticated: true, context: context(`${roomA}/#/automations/folder/12`, 'folder') },
	{ tabId: 2, windowId: 8, url: `${roomA}/#/dashboard/home`, title: 'Home', authenticated: true, context: context(`${roomA}/#/dashboard/home`, 'unsupported') },
	{ tabId: 4, windowId: 8, url: `${roomA}/#/automations/folder/13`, title: 'Logged out', authenticated: false, context: context(`${roomA}/#/automations/folder/13`, 'folder') },
];
const groups = targets.groupAuthenticatedControlRoomTabs(tabs);
assert.equal(groups.length, 1);
assert.equal(groups[0].hostname, 'one.example.com');
assert.equal(groups[0].pages.length, 2);
assert.equal(groups[0].pages.filter((page) => page.eligible).length, 1);
assert.equal(targets.getSingleControlRoomOrigin(groups), roomA);
assert.equal(
	targets.formatControlRoomHostname('aa-se-latam-2.my.automationanywhere.digital'),
	'aa-se-latam-2'
);
assert.equal(targets.formatControlRoomHostname('control-room.example.com'), 'control-room.example.com');
assert.equal(
	targets.formatControlRoomPageTitle(
		'003_GeneraPDFyCopiaACompartido | Edit Task Bot | Control Room | Automation Anywhere'
	),
	'003_GeneraPDFyCopiaACompartido'
);
assert.equal(targets.formatControlRoomPageTitle('Packages | Control Room'), 'Packages | Control Room');

const selected = targets.getFirstEligibleTarget(groups);
assert.equal(selected.tabId, 1);
assert.equal(targets.canUseSelectedTarget(selected), true);
assert.equal(targets.markSelectedTargetRouteChanged(selected, 99, 'x'), selected);
const stale = targets.markSelectedTargetRouteChanged(selected, 1, `${roomA}/#/automations/folder/99`);
assert.equal(stale.stale, true);
assert.equal(targets.canUseSelectedTarget(stale), false);
const disconnected = targets.markSelectedTargetDisconnected(selected, 1);
assert.equal(disconnected.disconnected, true);
assert.equal(targets.canUseSelectedTarget(disconnected), false);
const secondEligible = {
	...groups[0].pages[0],
	tabId: 3,
	url: `${roomA}/#/automations/folder/13`,
	title: 'Second folder',
};
const multiPageGroups = [{ ...groups[0], pages: [...groups[0].pages, secondEligible] }];
assert.equal(targets.getFirstEligibleTarget(multiPageGroups).tabId, 1);
assert.equal(targets.getEligibleTargetForTab(multiPageGroups, 3).tabId, 3);
assert.equal(targets.getEligibleTargetForTab(multiPageGroups, 2), null);
assert.equal(targets.getPreferredRoomTarget(multiPageGroups[0], 3).tabId, 3);
assert.equal(targets.getPreferredRoomTarget(multiPageGroups[0]).tabId, 1);
assert.equal(targets.getOnlyRoomCurrentEligibleTarget(multiPageGroups, 3).tabId, 3);
assert.equal(targets.getOnlyRoomCurrentEligibleTarget(multiPageGroups, 2), null);
const multipleRooms = [...groups, { ...groups[0], origin: 'https://three.example.com' }];
assert.equal(targets.getSingleControlRoomOrigin(multipleRooms), null);
assert.equal(targets.getFirstEligibleTarget(multipleRooms), null);
assert.equal(targets.getOnlyRoomCurrentEligibleTarget(multipleRooms, 1), null);
assert.equal(targets.getFirstEligibleTarget([{ ...groups[0], pages: [groups[0].pages[1]] }]), null);

let history = [];
for (let index = 0; index < 12; index += 1) {
	history = jobs.prependToolJob(history, jobs.createToolJob(String(index), `Job ${index}`, 2, {
		controlRoom: 'one.example.com', pageTitle: 'Folder', tabId: 1,
	}, index));
}
assert.equal(history.length, 10);
let current = jobs.requestToolJobStop(history[0]);
assert.equal(current.status, 'stopping');
assert.equal(current.stopRequested, true);
current.completed = 1;
current = jobs.completeToolJob(current, 'stopped', 'Stopped', 20);
assert.equal(current.status, 'stopped');
assert.equal(current.completed, 1);
assert.equal(jobs.getUnreadToolJobCount([current]), 1);
assert.equal(jobs.getUnreadToolJobCount(jobs.clearToolJobUnread([current])), 0);
const recovered = jobs.recoverInterruptedToolJobs([jobs.createToolJob('run', 'Run', 1, {
	controlRoom: 'one.example.com', pageTitle: 'Folder', tabId: 1,
})]);
assert.equal(recovered[0].status, 'interrupted');
assert.equal(jobs.clearCompletedToolJobs([current, jobs.createToolJob('active', 'Active', 1, {
	controlRoom: 'one.example.com', pageTitle: 'Folder', tabId: 1,
})]).length, 1);

const readSource = (...parts) => readFile(join(root, ...parts), 'utf8');
const [toolsSource, toolsStyle, mainSource, backgroundSource, configSource, optionsHtml, optionsMain] = await Promise.all([
	readSource('entrypoints', 'sidepanel', 'tools.ts'),
	readSource('entrypoints', 'sidepanel', 'style.styl'),
	readSource('entrypoints', 'sidepanel', 'main.ts'),
	readSource('entrypoints', 'background.ts'),
	readSource('wxt.config.ts'),
	readSource('entrypoints', 'options', 'index.html'),
	readSource('entrypoints', 'options', 'main.ts'),
]);
assert.ok(toolsSource.includes('session:toolsWindowSelection:${windowId}'));
assert.ok(toolsSource.includes("browser.tabs.query({ currentWindow: true })"));
assert.ok(toolsSource.includes('tabs.find((tab) => tab.active)?.id'));
assert.ok(toolsSource.includes('getAutomationAnywhereAuthToken(tab.id)'));
assert.ok(!toolsSource.includes('getActiveAutomationAnywhereContext'));
assert.ok(toolsSource.includes('EXPORT_BATCH_SIZE = 20'));
assert.ok(toolsSource.includes('throw new ToolJobStoppedError()'));
assert.ok(toolsSource.includes('finishStoppedJob'));
assert.ok(toolsSource.includes("startToolRun(t('Package Usage')"));
assert.ok(toolsSource.includes("startToolRun(t('Import Taskbot')"));
assert.ok(toolsSource.includes('Completed work remains and is listed in the job log.'));
assert.ok(toolsSource.includes('getOnlyRoomCurrentEligibleTarget(targetGroups, currentTabId)'));
assert.ok(toolsSource.includes('getFirstEligibleTarget(targetGroups)'));
assert.ok(toolsSource.includes('getEligibleTargetForTab(targetGroups, tabId)'));
assert.ok(toolsSource.includes('getPreferredRoomTarget(group, await getCurrentWindowActiveTabId())'));
assert.ok(toolsSource.includes('getSingleControlRoomOrigin(targetGroups)'));
assert.ok(toolsSource.includes('formatControlRoomPageTitle(page.title)'));
assert.ok(toolsSource.includes('context ? getAvailableTools(context) : ALL_TOOL_IDS'));
assert.ok(toolsSource.includes('button.disabled = !context'));
assert.ok(toolsSource.includes("refreshButton.setAttribute('aria-busy', 'true')"));
assert.equal(toolsSource.split("refreshButton.addEventListener('click'").length - 1, 1);
assert.ok(!toolsSource.includes('toolsWorkButton'));
assert.ok(!toolsSource.includes('toolsRefreshConnections'));
assert.ok(!toolsSource.includes('toolsRefreshPage'));
assert.ok(toolsSource.includes('toolsJobsButton.hidden = !(showingJobs || Boolean(activeToolRun) || unread > 0)'));
assert.ok(toolsSource.includes("toolsJobsBackButton.addEventListener('click', () => showToolsSubview(false))"));
assert.ok(toolsSource.includes('The selected page is logged out. Sign in, then select Refresh.'));
assert.ok(toolsSource.includes('await syncToolsTargetToTab(tabId)'));
assert.ok(toolsSource.includes('await refreshToolsContext(authToken)'));
assert.match(
	toolsStyle,
	/\.tools-target-picker\s+grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/,
	'Tools target selectors use equal-width columns'
);
assert.match(
	toolsStyle,
	/\.tools-target-picker select\s+width: 100%\s+max-width: none\s+min-height: 36px/,
	'Tools selectors fill their columns'
);
assert.ok(mainSource.includes("aria-controls=\"panel-appearance\""));
assert.ok(mainSource.includes("event.key === 'Home'"));
assert.ok(mainSource.includes('browser.tabs.onActivated'));
assert.ok(mainSource.includes('handleToolsTabActivated(tabId, windowId)'));
assert.ok(mainSource.includes("request.focus === 'jobs'"));
assert.ok(mainSource.includes('browser.permissions.request'));
assert.ok(mainSource.includes("'appearance-taskbot-editor'"));
assert.ok(mainSource.includes("id=\"settings-general\""));
assert.ok(mainSource.includes("id=\"help-about\""));
assert.ok(mainSource.includes("mailto:jeiser_vargas@outlook.com"));
assert.ok(mainSource.includes("https://github.com/Jamir-boop"));
assert.equal(
	mainSource.match(/data-help-section=/g)?.length,
	4,
	'Help has four subtabs'
);
assert.ok(mainSource.includes('aria-controls="help-panel-overview"'));
assert.ok(mainSource.includes('aria-controls="help-panel-commands"'));
assert.ok(mainSource.includes('aria-controls="help-panel-compatibility"'));
assert.ok(mainSource.includes('aria-controls="help-panel-diagnostics"'));
assert.ok(mainSource.includes("document.querySelector<HTMLElement>('.help-subtabs')?.addEventListener('keydown'"));
assert.ok(mainSource.includes("anchor === 'help-start' || anchor === 'help-about'"));
assert.ok(mainSource.includes('row.insertBefore(saved, row.lastElementChild)'));
assert.ok(!mainSource.includes('row.appendChild(saved)'));
assert.ok(backgroundSource.includes('notifications.onClicked'));
assert.ok(backgroundSource.includes("focus: 'jobs'"));
assert.ok(backgroundSource.includes('permissions.onRemoved'));
assert.ok(configSource.includes("optional_permissions: ['notifications']"));
assert.ok(optionsHtml.includes('manifest.open-in-tab'));
assert.ok(optionsMain.includes("import '../sidepanel/main'"));

console.log('Control Room selection and jobs tests passed.');
