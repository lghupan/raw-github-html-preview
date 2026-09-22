import { matchesPreview } from "./rules.js";

async function clearPreview(tabId) {
  await chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: [tabId + 1] });
}

chrome.tabs.onRemoved.addListener((tabId) => {
  clearPreview(tabId).catch(() => {});
});

chrome.tabs.onUpdated.addListener((tabId, change, tab) => {
  if (!change.status && !change.url) return;
  void (async () => {
    const rules = await chrome.declarativeNetRequest.getSessionRules();
    const rule = rules.find((item) => item.id === tabId + 1);
    if (rule && !matchesPreview(rule, tab.pendingUrl || tab.url)) {
      await clearPreview(tabId);
      await chrome.action.setBadgeText({ tabId, text: "" });
    }
  })().catch(() => {});
});
