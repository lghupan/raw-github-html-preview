import { htmlFile, matchesSource, sourceRule } from "./rules.js";

const status = document.getElementById("status");
const fileLabel = document.getElementById("file");
const toggle = document.getElementById("toggle");

async function initialize() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const file = htmlFile(tab?.url);
  if (!file || tab.pendingUrl || tab.status === "loading") {
    status.textContent = "Open a .html or .htm file on https://raw.githubusercontent.com, wait for it to load, then reopen this menu.";
    return;
  }

  const rules = await chrome.declarativeNetRequest.getSessionRules();
  const existing = rules.find((rule) => rule.id === tab.id + 1);
  const enabled = !(existing && matchesSource(existing, tab.url));
  status.textContent = enabled ? "HTML renders automatically." : "Source view is on for this file and tab.";
  fileLabel.textContent = new URL(file).pathname;
  fileLabel.hidden = false;
  toggle.textContent = enabled ? "View source" : "Render HTML";
  toggle.disabled = false;

  toggle.addEventListener("click", async () => {
    toggle.disabled = true;
    try {
      const current = await chrome.tabs.get(tab.id);
      if (current.pendingUrl || htmlFile(current.url) !== file) {
        throw new Error("The page changed. Reopen this menu to preview it.");
      }
      await chrome.declarativeNetRequest.updateSessionRules({
        removeRuleIds: [tab.id + 1],
        addRules: enabled ? [sourceRule(tab.id, current.url)] : [],
      });
      await chrome.action.setBadgeBackgroundColor({ tabId: tab.id, color: "#285b3b" });
      await chrome.action.setBadgeText({ tabId: tab.id, text: enabled ? "SRC" : "" });
      await chrome.tabs.reload(tab.id, { bypassCache: true });
      window.close();
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : "Could not change the preview. Reopen this menu and try again.";
    }
  });
}

initialize().catch(() => {
  status.textContent = "Could not read this tab. Open a raw GitHub HTML file and try again.";
});
