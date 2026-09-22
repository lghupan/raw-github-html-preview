export const RAW_ORIGIN = "https://raw.githubusercontent.com";

// Keep the document in an opaque origin while allowing standalone interactions.
export const PREVIEW_POLICY = [
  "sandbox allow-scripts",
  "default-src 'none'",
  "script-src 'unsafe-inline'",
  "style-src 'unsafe-inline'",
  "img-src data: blob:",
  "font-src data:",
  "media-src data: blob:",
  "connect-src 'none'",
  "object-src 'none'",
  "frame-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join("; ");

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

export function previewRule(tabId, url) {
  const file = htmlFile(url);
  if (!file || !Number.isInteger(tabId) || tabId < 0) {
    throw new Error("Open an HTTPS .html or .htm file on raw.githubusercontent.com.");
  }

  return {
    id: tabId + 1,
    priority: 1,
    action: {
      type: "modifyHeaders",
      responseHeaders: [
        { header: "content-type", operation: "set", value: "text/html; charset=utf-8" },
        { header: "content-security-policy", operation: "set", value: PREVIEW_POLICY },
        { header: "referrer-policy", operation: "set", value: "no-referrer" },
      ],
    },
    condition: {
      // Ignore the query so private raw tokens never enter extension rules.
      regexFilter: "^" + file.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(\\?.*)?$",
      isUrlFilterCaseSensitive: true,
      resourceTypes: ["main_frame"],
      tabIds: [tabId],
    },
  };
}

export function matchesPreview(rule, url) {
  const file = htmlFile(url);
  return Boolean(file && new RegExp(rule.condition.regexFilter).test(file));
}
