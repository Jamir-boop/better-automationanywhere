export default defineBackground(() => {
  // Open sidebar with shortcut
  browser.commands.onCommand.addListener((command) => {
    if (command === 'open-sidebar' && import.meta.env.CHROME) {
      browser.sidePanel.open({ windowId: undefined });
    }

    if (command === 'open-sidebar' && import.meta.env.FIREFOX) {
      browser.sidebarAction.toggle();
    }
  });

  //idle panel auto-open on icon click
  if (import.meta.env.CHROME) {
    chrome.sidePanel
      .setPanelBehavior({ openPanelOnActionClick: true })
      .catch(() => {});
  }
  if (import.meta.env.FIREFOX) {
 	browser.browserAction.onClicked.addListener(() => {
	  console.log('[MV2] Icon clicked!');
	  browser.sidebarAction.toggle();
    });
  }

});
