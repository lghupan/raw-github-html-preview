import { matchesSource } from "./rules.js";

async function clearSource(tabId) {
  await chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: [tabId + 1] });
}

chrome.tabs.onRemoved.addListener((tabId) => {
  clearSource(tabId).catch(() => {});
});

chrome.tabs.onUpdated.addListener((tabId, change, tab) => {
  if (!change.status && !change.url) return;
  void (async () => {
    const rules = await chrome.declarativeNetRequest.getSessionRules();
    const rule = rules.find((item) => item.id === tabId + 1);
    if (rule && !matchesSource(rule, tab.pendingUrl || tab.url)) {
      await clearSource(tabId);
      await chrome.action.setBadgeText({ tabId, text: "" });
    }
  })().catch(() => {});
});
