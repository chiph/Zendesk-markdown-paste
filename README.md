# Zendesk Markdown Paste

A small Manifest V3 browser extension that converts Markdown into rich text when
pasting into Zendesk comment editors.

The repository ships two builds of the same extension, one per browser:

- [`chrome/`](chrome) — Chrome / Chromium (Edge, Brave, etc.)
- [`firefox/`](firefox) — Firefox

Both builds share identical `content.js` and `popup.html`; only the
`manifest.json` differs (Firefox adds a `browser_specific_settings.gecko` id).

The extension listens for paste events in Zendesk content-editable fields. When
the clipboard text contains a supported Markdown pattern, it converts the text
to HTML and passes the paste back to Zendesk's editor. Plain-text pastes are
left unchanged.

Before, pasting markdown into a Zendesk comment field resulted in something like this:

<img width="1522" height="302" alt="Screenshot 2026-08-25 at 11 56 04 AM" src="https://github.com/user-attachments/assets/22c25690-dde3-4bdd-b6d6-9607bd50d2d0" />

With the extension, the markdown is correctly rendered, with no "cleanup" needed:

<img width="1399" height="254" alt="Screenshot 2026-08-25 at 1 25 50 PM" src="https://github.com/user-attachments/assets/5e7c3f0e-10cf-4cb5-8fc8-b29f0fc53b58" />


## Supported Markdown

| Markdown | Result |
| --- | --- |
| `` `code` `` | Inline code |
| ` ```code``` ` | Fenced code block |
| Four-space or tab indentation | Indented code block |
| `**bold**` or `__bold__` | Bold |
| `*italic*` or `_italic_` | Italic |
| `***text***` | Bold and italic |
| `~~text~~` | Strikethrough (see note) |
| `# H1`, `## H2`, `### H3` | Headings |
| `- item`, `* item`, `+ item` | Bulleted list |
| `1. item` | Numbered list |
| `> quote` | Blockquote |
| `[text](https://example.com)` | Link |
| `---`, `***`, or `___` | Horizontal rule |

Links are limited to HTTP and HTTPS URLs. Raw HTML is escaped rather than
inserted into the editor.

> **Note on strikethrough:** Zendesk's comment editor has no strikethrough
> format of its own, so it strips any `<del>`/`<s>` HTML on paste. To make
> strikethrough survive, `~~text~~` is rendered with Unicode combining
> strike-through characters (e.g. `t̶e̶x̶t̶`) instead of an HTML tag.

## Install unpacked in Chrome

1. Clone or download this repository and keep the folder in a permanent
   location.
2. Open `chrome://extensions`.
3. Enable **Developer mode**.
4. Click **Load unpacked** and choose the [`chrome/`](chrome) folder containing
   `manifest.json`.
5. Open a Zendesk page and paste Markdown into a comment editor.

When updating the extension files, use the reload button in
`chrome://extensions`, then refresh the Zendesk tab.

## Install temporarily in Firefox

Because it is unsigned, an unpacked extension loads as a *temporary* add-on that
is removed when Firefox restarts.

1. Clone or download this repository.
2. Open `about:debugging#/runtime/this-firefox`.
3. Click **Load Temporary Add-on…**.
4. Select the `manifest.json` file inside the [`firefox/`](firefox) folder.
5. Open a Zendesk page and paste Markdown into a comment editor.

When updating the extension files, click **Reload** on the add-on in
`about:debugging`, then refresh the Zendesk tab. Firefox 128 or newer is
required.

## Usage

Copy Markdown as plain text and paste it into a Zendesk rich-text comment
field. The extension only intercepts the paste when it detects supported
Markdown; otherwise, Zendesk handles the paste normally.

Click the extension's toolbar icon to see a quick reference for the supported
syntax.

## Permissions and privacy

The extension requests:

- `activeTab`
- access to `https://*.zendesk.com/*` so the content script can run on Zendesk
  pages

All conversion happens locally in the browser. The extension makes no network
requests and does not store clipboard or ticket content.

## Validation

This extension has no build step or dependencies. Validate its source with:

```sh
node --check chrome/content.js
node --check firefox/content.js
python3 -c "import json; json.load(open('chrome/manifest.json'))"
python3 -c "import json; json.load(open('firefox/manifest.json'))"
```
