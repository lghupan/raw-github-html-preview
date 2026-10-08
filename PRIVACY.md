# Privacy policy

Raw GitHub HTML Preview

Last updated: October 8, 2026

## Purpose

Raw GitHub HTML Preview renders standalone HTML files that you open on `https://raw.githubusercontent.com`. It also provides a per-tab switch between rendered HTML and source text.

## Information processed locally

The extension reads the current raw GitHub tab's URL and tab ID to identify HTML files and manage the source-view switch. A URL can contain a temporary access token for a private repository. The extension processes the URL in memory and excludes query parameters, including tokens, from the popup and its session rules.

When you select View source, Chrome keeps an exception containing the file path and tab ID in its extension session rules. The exception is removed when you navigate to a different file or website, close the tab, or restart Chrome. The extension does not maintain a browsing-history database or use Chrome Sync.

Chrome renders the HTML response. The extension does not read, copy, upload, or store response bodies.

## Data transmission and sharing

The extension does not make its own network requests. It has no analytics, advertising, accounts, or tracking services. The developer does not receive, sell, or share your URLs, access tokens, browsing activity, or file contents.

Chrome still makes your original request to GitHub and may record the URL in its normal browser history. These browser and GitHub activities are separate from the extension. GitHub's handling of requests is described in its [privacy statement](https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement).

## Preview behavior

Opening a matching HTML file automatically runs its inline scripts in an isolated page without extension API access. The preview policy blocks external scripts, stylesheets, images, API requests, and frames. Cookies, browser storage, forms, popups, and downloads are unavailable in the preview sandbox. A script can still navigate its own tab, which causes Chrome to make a new request. Only open HTML that you trust.

## Permissions

- Access to `https://raw.githubusercontent.com/*` lets the extension identify raw HTML tabs and apply its header rules on this host.
- `declarativeNetRequestWithHostAccess` lets Chrome change response headers for matching HTML documents and maintain the per-tab source exception.

## Contact

For privacy questions, [open an issue in the project repository](https://github.com/lghupan/raw-github-html-preview/issues). Do not include private repository URLs, access tokens, or other sensitive information in a public issue.
