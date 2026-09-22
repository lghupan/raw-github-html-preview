export const RAW_ORIGIN = "https://raw.githubusercontent.com";

export function htmlFile(value) {
  try {
    const url = new URL(value);
    if (
      url.origin !== RAW_ORIGIN ||
      url.username ||
      url.password ||
      !/\.html?$/i.test(url.pathname)
    ) {
      return null;
    }
    return RAW_ORIGIN + url.pathname;
  } catch {
    return null;
  }
}

export function sourceRule(tabId, url) {
  const file = htmlFile(url);
  if (!file || !Number.isInteger(tabId) || tabId < 0) {
    throw new Error("Open an HTTPS .html or .htm file on raw.githubusercontent.com.");
  }

  return {
    id: tabId + 1,
    // A higher-priority allow rule skips this extension's automatic headers.
    priority: 2,
    action: { type: "allow" },
    condition: {
      // Ignore the query so private raw tokens never enter extension rules.
      regexFilter: "^" + file.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(\\?.*)?$",
      isUrlFilterCaseSensitive: true,
      resourceTypes: ["main_frame"],
      tabIds: [tabId],
    },
  };
}

export function matchesSource(rule, url) {
  const file = htmlFile(url);
  return Boolean(file && new RegExp(rule.condition.regexFilter).test(file));
}
