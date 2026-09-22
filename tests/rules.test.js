import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { htmlFile, matchesPreview, previewRule } from "../extension/rules.js";

const file = "https://raw.githubusercontent.com/owner/repo/main/index.html";

test("only HTTPS HTML files on the exact raw GitHub origin are accepted", () => {
  for (const url of [file, file + "?token=secret#heading", file.replace(".html", ".htm"), file.replace(".html", ".HTML")]) {
    assert.ok(htmlFile(url), url);
  }
  for (const url of [
    undefined, "", "not a URL", file.replace("https:", "http:"),
    file.replace("raw.githubusercontent.com", "github.com"),
    file.replace("raw.githubusercontent.com", "raw.githubusercontent.com.example.com"),
    file.replace("raw.githubusercontent.com", "sub.raw.githubusercontent.com"),
    file.replace("raw.githubusercontent.com", "raw.githubusercontent.com:8443"),
    file.replace("https://", "https://user:password@"),
    file.replace(".html", ".txt?file=index.html"), file + "/extra", "file:///tmp/index.html",
  ]) {
    assert.equal(htmlFile(url), null, String(url));
  }
});

test("rules match only the selected file, top-level navigation, and tab", () => {
  const rule = previewRule(42, file + "?token=private-token#section");
  assert.deepEqual(rule.condition.tabIds, [42]);
  assert.deepEqual(rule.condition.resourceTypes, ["main_frame"]);
  assert.equal(rule.condition.isUrlFilterCaseSensitive, true);
  assert.ok(!JSON.stringify(rule).includes("private-token"));
  const matcher = new RegExp(rule.condition.regexFilter);
  assert.ok(matcher.test(file));
  assert.ok(matcher.test(file + "?token=rotated"));
  for (const url of [file + "/other", file + ".js", file.replace("index", "INDEX"), "https://evil.example/?" + file, file.replace(".com/", ".com.evil/")]) {
    assert.equal(matcher.test(url), false, url);
  }
  assert.ok(matchesPreview(rule, file + "?token=rotated#section"));
  assert.equal(matchesPreview(rule, undefined), false);
});

test("regular-expression characters in repository paths are escaped", () => {
  const url = file.replace("index.html", "demo+v1.2(test).html");
  const rule = previewRule(1, url);
  assert.ok(matchesPreview(rule, url));
  assert.equal(matchesPreview(rule, url.replace("+", "")), false);
  assert.equal(matchesPreview(rule, url.replace("1.2", "1x2")), false);
});

test("invalid rule targets fail closed", () => {
  for (const tabId of [-1, 1.5, undefined]) assert.throws(() => previewRule(tabId, file));
  assert.throws(() => previewRule(1, "https://github.com/index.html"));
});

test("installed permissions stay restricted to the raw host and header rules", async () => {
  const manifest = JSON.parse(await readFile(new URL("../extension/manifest.json", import.meta.url)));
  assert.deepEqual(manifest.permissions, ["declarativeNetRequestWithHostAccess"]);
  assert.deepEqual(manifest.host_permissions, ["https://raw.githubusercontent.com/*"]);
  assert.equal(manifest.content_scripts, undefined);
  assert.equal(manifest.externally_connectable, undefined);
  assert.equal(manifest.web_accessible_resources, undefined);
  assert.equal(manifest.optional_permissions, undefined);
  assert.equal(manifest.optional_host_permissions, undefined);
});
