# Raw GitHub HTML Preview

A small Chrome extension that renders standalone HTML from **`https://raw.githubusercontent.com/` only**. Click **Render HTML** to preview the current file; click **View source** to switch back.

The extension has no runtime dependencies, build step, account, analytics, or preview server.

## Install

1. Clone this private repository or download and extract its source ZIP.
2. Open `chrome://extensions` in Chrome 120 or newer.
3. Turn on **Developer mode**.
4. Click **Load unpacked** and select the repository's **`extension`** folder.
5. Pin **Raw GitHub HTML Preview** from Chrome's Extensions menu.

You do not need Node.js or npm to install or use the extension. Keep the folder in place while the extension is installed. After pulling updates, click **Reload** on its card in `chrome://extensions`.

## Use

1. On GitHub, open an `.html` or `.htm` file and click **Raw**.
2. Wait for the raw source to finish loading.
3. Click the extension icon, then **Render HTML**.
4. Open the extension again and choose **View source** to return to raw text.

Preview applies only to the selected file in that tab. A second tab stays as source. Navigating to another file or website clears the selection. Closing the tab or restarting Chrome also clears it.

Private repositories work when GitHub's raw URL already grants access, including URLs with a `token` query parameter. An expired token still produces GitHub's error; return to the file on GitHub and click **Raw** to obtain a fresh link. The extension cannot grant access to a repository.

## What it renders

- HTML and embedded styles.
- Inline JavaScript, including buttons, filters, and interactive diagrams.
- Embedded images, SVG, fonts, and media using data URLs. Images and media generated as blob URLs also work.

This is for self-contained files. External scripts, stylesheets, fonts, images, API requests, frames, and other network assets are blocked. Browser storage, cookies, forms, popups, and downloads are unavailable in the preview sandbox. Files that depend on these features need a normal local development server.

Previewing executes the file's inline scripts. Scripts can still navigate their own tab, so preview HTML you trust. The sandbox is not a general-purpose malware analysis environment.

## Permissions and privacy

| Permission | Purpose |
| --- | --- |
| `https://raw.githubusercontent.com/*` | Read the current raw tab's URL and apply response-header changes on this exact host. |
| `declarativeNetRequestWithHostAccess` | Ask Chrome to change response headers for the selected file and tab. |

There is no `activeTab`, `tabs`, `scripting`, `storage`, `cookies`, `webRequest`, or all-sites permission. There are no content scripts or external-message handlers.

The browser applies three response headers:

- `Content-Type: text/html; charset=utf-8` makes Chrome render the response.
- `Content-Security-Policy` permits inline styles and scripts while isolating the document in an opaque origin and blocking external assets.
- `Referrer-Policy: no-referrer` prevents the raw URL from being sent as a referrer.

Rules are scoped to top-level requests for the exact file path and tab ID. They do not change subresource headers, other tabs, other files, or other hosts. The popup shows only the file path, never its query string.

The extension never reads, copies, uploads, or stores response bodies. It does not make network requests. The current URL is read briefly in memory; query parameters, including private raw tokens, are excluded from its session rules. Chrome still handles the original URL normally, including its own history and requests to GitHub.

Chrome's host permission grants access to the raw host as a whole; the extension's own rules narrow its behavior to the selected HTML file. There is no permission for `github.com`, subdomains of the raw host, HTTP URLs, or unrelated sites.

## Source

All installed code is in `extension/`:

- `manifest.json`: the complete permission declaration.
- `rules.js`: exact-host validation, the preview policy, and per-tab rule construction.
- `popup.html`, `popup.css`, `popup.js`: the preview toggle.
- `background.js`: removes rules after navigation or tab closure.

## Verify

Node.js 22+ and OpenSSL are needed for development tests only. Playwright is a development dependency and is not shipped in the installed extension.

```sh
npm ci
npx playwright install chromium
npm test
npm run test:browser
```

The browser tests load the actual unpacked extension into an isolated Chromium profile. A temporary local HTTPS fixture simulates the raw host with GitHub-style content and security headers. The tests use the real extension popup, Chrome APIs, network stack, and response-header rules. They verify rendering, embedded JavaScript and images, isolation, token exclusion, host and file restrictions, source restoration, errors, and rule cleanup. The temporary browser profile and certificate are deleted afterward.

An optional regression check for the original logo-study page can be run with a local copy:

```sh
PRIVATE_HTML_FIXTURE=/absolute/path/to/logo-context-study/index.html npm run test:browser
```

That check renders the supplied file, exercises its theme toggle, and writes a screenshot under the ignored `artifacts/` directory. The private page itself is not included in this repository.
