import { browser } from 'wxt/browser';

/** Opens the organizer page, or focuses it when it is already open. */
async function openApp(): Promise<void> {
  const url = browser.runtime.getURL('/app.html');
  const contexts = browser.runtime.getContexts ? await browser.runtime.getContexts({ contextTypes: ['TAB' as never], documentUrls: [url] }) : [];
  const ctx = contexts.find((c) => (c.tabId ?? -1) >= 0);
  if (ctx) {
    await browser.tabs.update(ctx.tabId, { active: true });
    if (ctx.windowId !== undefined && ctx.windowId >= 0) await browser.windows.update(ctx.windowId, { focused: true });
    return;
  }
  await browser.tabs.create({ url });
}

export default defineBackground(() => {
  browser.action.onClicked.addListener(() => void openApp());
  browser.runtime.onInstalled.addListener(({ reason }) => {
    if (reason === 'install') void openApp();
  });
});
