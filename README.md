# Zendesk Markdown Paste

A small Chrome Manifest V3 extension that converts Markdown into rich text when
pasting into Zendesk comment editors.

The extension listens for paste events in Zendesk content-editable fields. When
the clipboard text contains a supported Markdown pattern, it converts the text
to HTML and passes the paste back to Zendesk's editor. Plain-text pastes are
left unchanged.

## Supported Markdown

| Markdown | Result |
| --- | --- |
| `` `code` `` | Inline code |
| ` ```code``` ` | Fenced code block |
| `**bold**` or `__bold__` | Bold |
| `*italic*` or `_italic_` | Italic |
| `***text***` | Bold and italic |
| `~~text~~` | Strikethrough |
| `# H1`, `## H2`, `### H3` | Headings |
| `- item`, `* item`, `+ item` | Bulleted list |
| `1. item` | Numbered list |
| `> quote` | Blockquote |
| `[text](https://example.com)` | Link |
| `---`, `***`, or `___` | Horizontal rule |

Links are limited to HTTP and HTTPS URLs. Raw HTML is escaped rather than
inserted into the editor.

## Install unpacked in Chrome

1. Clone or download this repository and keep the folder in a permanent
   location.
2. Open `chrome://extensions`.
3. Enable **Developer mode**.
4. Click **Load unpacked** and choose the repository folder containing
   `manifest.json`.
5. Open a Zendesk page and paste Markdown into a comment editor.

When updating the extension files, use the reload button in
`chrome://extensions`, then refresh the Zendesk tab.

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
node --check content.js
python3 -c "import json; json.load(open('manifest.json'))"
```
