import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { htmlFile, matchesSource, sourceRule } from "../extension/rules.js";

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

test("source exceptions match only the selected file, top-level navigation, and tab", () => {
  const rule = sourceRule(42, file + "?token=private-token#section");
  assert.equal(rule.action.type, "allow");
  assert.equal(rule.priority, 2);
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
  assert.ok(matchesSource(rule, file + "?token=rotated#section"));
  assert.equal(matchesSource(rule, undefined), false);
});

test("regular-expression characters in repository paths are escaped", () => {
  const url = file.replace("index.html", "demo+v1.2(test).html");
  const rule = sourceRule(1, url);
  assert.ok(matchesSource(rule, url));
  assert.equal(matchesSource(rule, url.replace("+", "")), false);
  assert.equal(matchesSource(rule, url.replace("1.2", "1x2")), false);
});

test("invalid rule targets fail closed", () => {
  for (const tabId of [-1, 1.5, undefined]) assert.throws(() => sourceRule(tabId, file));
  assert.throws(() => sourceRule(1, "https://github.com/index.html"));
});

test("automatic rendering is installed as a narrow, enabled static rule", async () => {
  const manifest = JSON.parse(await readFile(new URL("../extension/manifest.json", import.meta.url)));
  assert.deepEqual(manifest.declarative_net_request.rule_resources, [
    { id: "auto_preview", enabled: true, path: "preview-rules.json" },
  ]);
  const [rule] = JSON.parse(await readFile(new URL("../extension/preview-rules.json", import.meta.url)));
  assert.equal(rule.priority, 1);
  assert.equal(rule.action.type, "modifyHeaders");
  assert.deepEqual(rule.condition.resourceTypes, ["main_frame"]);
  assert.equal(rule.condition.tabIds, undefined);
  const matcher = new RegExp(rule.condition.regexFilter);
  for (const url of [file, file + "?token=secret", file.replace(".html", ".HTM"), file.replace("index", "nested/page")]) {
    assert.ok(matcher.test(url), url);
  }
  for (const url of [
    file.replace("https:", "http:"),
    file.replace("raw.githubusercontent.com", "github.com"),
    file.replace("raw.githubusercontent.com", "raw.githubusercontent.com.evil.test"),
    file.replace("raw.githubusercontent.com", "sub.raw.githubusercontent.com"),
    file.replace("raw.githubusercontent.com", "raw.githubusercontent.com:8443"),
    file.replace(".html", ".txt?file=index.html"),
    file + "/extra", file + ".js", "https://evil.test/?url=" + file,
  ]) {
    assert.equal(matcher.test(url), false, url);
  }
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
