import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, readFile, rm, mkdir } from "node:fs/promises";
import { createServer } from "node:https";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = fileURLToPath(new URL("../", import.meta.url));
const extension = path.join(root, "extension");
const rawOrigin = "https://raw.githubusercontent.com";
const rawFile = rawOrigin + "/owner/repo/main/index.html?token=test-only";

test("the installed extension automatically renders only raw HTML files", { timeout: 120_000 }, async (t) => {
  const temp = await mkdtemp(path.join(tmpdir(), "raw-html-preview-"));
  let context;
  let server;
  try {
    execFileSync("openssl", [
      "req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "1",
      "-subj", "/CN=raw.githubusercontent.com",
      "-keyout", path.join(temp, "key.pem"), "-out", path.join(temp, "cert.pem"),
    ], { stdio: "ignore" });
    const fixture = await readFile(new URL("./fixture.html", import.meta.url));
    const privateFixture = process.env.PRIVATE_HTML_FIXTURE ? await readFile(process.env.PRIVATE_HTML_FIXTURE) : null;
    const requests = [];
    server = createServer({
      key: await readFile(path.join(temp, "key.pem")),
      cert: await readFile(path.join(temp, "cert.pem")),
    }, (req, res) => {
      requests.push({ host: req.headers.host, url: req.url });
      res.writeHead(req.url.includes("expired") ? 404 : 200, {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "no-store",
      });
      res.end(req.url.includes("expired") ? "404: Not Found" : req.url.startsWith("/private/") && privateFixture ? privateFixture : fixture);
    });
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const port = server.address().port;
    const hosts = ["raw.githubusercontent.com", "github.com", "example.test", "raw.githubusercontent.com.evil.test"];
    context = await chromium.launchPersistentContext(path.join(temp, "profile"), {
      channel: "chromium",
      headless: true,
      ignoreHTTPSErrors: true,
      viewport: { width: 1440, height: 1000 },
      args: [
        `--disable-extensions-except=${extension}`,
        `--load-extension=${extension}`,
        "--no-proxy-server",
        `--host-resolver-rules=${hosts.map((host) => `MAP ${host} 127.0.0.1:${port}`).join(", ")}`,
      ],
    });
    const worker = context.serviceWorkers()[0] || await context.waitForEvent("serviceworker");
    const extensionId = worker.url().split("/")[2];
    const page = context.pages()[0];
    const rules = () => worker.evaluate(() => chrome.declarativeNetRequest.getSessionRules());

    async function popupFor(target) {
      // A background extension tab exposes the same popup UI to Playwright.
      const popup = await context.newPage();
      await target.bringToFront();
      await worker.evaluate(async () => {
        for (let i = 0; i < 100; i++) {
          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
          if (tab?.status === "complete" && !tab.pendingUrl) return;
          await new Promise((resolve) => setTimeout(resolve, 25));
        }
        throw new Error("The source tab did not finish loading.");
      });
      await popup.goto(`chrome-extension://${extensionId}/popup.html`);
      await popup.waitForFunction(() => document.getElementById("status").textContent !== "Checking this tab...");
      return popup;
    }

    async function toggle(target, label) {
      const popup = await popupFor(target);
      assert.equal(await popup.locator("#toggle").textContent(), label);
      assert.equal(await popup.locator("#toggle").isEnabled(), true);
      await Promise.all([
        target.waitForEvent("load"),
        popup.locator("#toggle").click(),
      ]);
    }

    await t.test("Chrome grants only the raw host and header-rule permission", async () => {
      const permissions = await worker.evaluate(() => chrome.permissions.getAll());
      assert.deepEqual(permissions.origins, [rawOrigin + "/*"]);
      assert.deepEqual(permissions.permissions, ["declarativeNetRequestWithHostAccess"]);
    });

    await t.test("HTML renders on the first navigation without opening the extension", async () => {
      await page.goto(rawFile);
      assert.equal(await page.evaluate(() => document.contentType), "text/html");
      assert.equal(requests.filter((request) => request.url === new URL(rawFile).pathname + new URL(rawFile).search).length, 1);
      assert.equal(await page.locator("h1").textContent(), "Rendered HTML");
      assert.equal(await page.locator("h1").evaluate((node) => getComputedStyle(node).color), "rgb(31, 94, 48)");
      await page.locator("#increment").click();
      assert.equal(await page.locator("#count").textContent(), "1");
      assert.equal(await page.locator("#embedded").evaluate((node) => node.naturalWidth), 24);
      assert.ok(!JSON.stringify(await rules()).includes("test-only"));
    });

    await t.test("preview scripts cannot access cookies, storage, or external assets", async () => {
      assert.equal(await page.locator("body").getAttribute("data-network"), "blocked");
      assert.equal(await page.locator("body").getAttribute("data-storage"), "blocked");
      assert.equal(await page.locator("body").getAttribute("data-cookies"), "blocked");
      assert.equal(await page.evaluate(() => Boolean(globalThis.chrome?.runtime?.id)), false);
      assert.equal(requests.filter((request) => request.host === "example.test").length, 0);
    });

    await t.test("View source reverses rendering and survives a page reload", async () => {
      await toggle(page, "View source");
      assert.equal(await page.evaluate(() => document.contentType), "text/plain");
      assert.equal((await rules()).length, 1);
      assert.ok(!JSON.stringify(await rules()).includes("test-only"));
      await page.reload();
      assert.equal(await page.evaluate(() => document.contentType), "text/plain");
    });

    await t.test("another tab renders automatically while the first stays as source", async () => {
      const other = await context.newPage();
      await other.goto(rawFile);
      assert.equal(await other.evaluate(() => document.contentType), "text/html");
      assert.equal(await page.evaluate(() => document.contentType), "text/plain");
      await other.close();
    });

    await t.test("Render HTML restores automatic rendering", async () => {
      await toggle(page, "Render HTML");
      assert.equal(await page.evaluate(() => document.contentType), "text/html");
      assert.equal((await rules()).length, 0);
    });

    await t.test("navigation to another file clears the source exception and renders it", async () => {
      await toggle(page, "View source");
      await page.goto(rawOrigin + "/owner/repo/main/other.html");
      assert.equal(await page.evaluate(() => document.contentType), "text/html");
      await page.waitForTimeout(100);
      assert.equal((await rules()).length, 0);
      await page.goto(rawFile);
      assert.equal(await page.evaluate(() => document.contentType), "text/html");
    });

    await t.test("navigating away from the raw host clears the source exception", async () => {
      await toggle(page, "View source");
      await page.goto("https://github.com/index.html");
      assert.equal(await page.evaluate(() => document.contentType), "text/plain");
      const popup = await popupFor(page);
      assert.equal((await rules()).length, 0);
      assert.equal(await popup.locator("#toggle").isDisabled(), true);
      await popup.close();
    });

    await t.test("other hosts, lookalikes, and non-HTML files have no render action", async () => {
      for (const url of ["https://github.com/index.html", "https://raw.githubusercontent.com.evil.test/index.html", rawOrigin + "/owner/repo/main/file.txt"]) {
        await page.goto(url);
        const popup = await popupFor(page);
        assert.equal(await popup.locator("#toggle").isDisabled(), true);
        await popup.close();
        assert.equal(await page.evaluate(() => document.contentType), "text/plain");
      }
    });

    await t.test("expired raw links remain visible as an error", async () => {
      await page.goto(rawFile.replace("index.html", "expired.html"));
      assert.match(await page.locator("body").textContent(), /404: Not Found/);
    });

    await t.test("mixed-case HTM filenames with query strings render automatically", async () => {
      await page.goto(rawFile.replace("index.html", "sample.HtM"));
      assert.equal(await page.evaluate(() => document.contentType), "text/html");
      assert.equal(await page.locator("h1").textContent(), "Rendered HTML");
    });

    await t.test("closing the tab removes its source exception", async () => {
      await toggle(page, "View source");
      await page.close();
      await worker.evaluate(async () => {
        for (let i = 0; i < 40; i++) {
          if (!(await chrome.declarativeNetRequest.getSessionRules()).length) return;
          await new Promise((resolve) => setTimeout(resolve, 25));
        }
      });
      assert.equal((await rules()).length, 0);
    });

    if (privateFixture) {
      await t.test("the supplied standalone page renders and its theme toggle works", async () => {
        const privatePage = await context.newPage();
        const errors = [];
        privatePage.on("pageerror", (error) => errors.push(error.message));
        await privatePage.goto(rawOrigin + "/private/repo/main/index.html?token=test-only");
        await privatePage.locator("#grid .tile").first().waitFor();
        const before = await privatePage.locator("body").getAttribute("data-theme");
        await privatePage.locator("#theme").click();
        assert.notEqual(await privatePage.locator("body").getAttribute("data-theme"), before);
        assert.deepEqual(errors, []);
        await mkdir(path.join(root, "artifacts"), { recursive: true });
        await privatePage.screenshot({ path: path.join(root, "artifacts", "private-preview.png") });
        await privatePage.close();
      });
    }
  } finally {
    await context?.close();
    server?.closeAllConnections();
    if (server) await new Promise((resolve) => server.close(resolve));
    await rm(temp, { recursive: true, force: true });
  }
});
