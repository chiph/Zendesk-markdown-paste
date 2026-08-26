/**
 * Zendesk Markdown Paste
 *
 * Intercepts paste events inside Zendesk rich-text comment editors and converts
 * markdown syntax to formatted HTML before insertion.
 *
 * Supported markdown:
 *   **bold**, *italic*, `inline code`, fenced/indented code blocks,
 *   # Headings (h1–h3), - / * / 1. lists, > blockquote,
 *   [link](url), ---/*** horizontal rule
 */

(function () {
  "use strict";

  // ── Markdown → HTML conversion ──────────────────────────────────────────────

  /**
   * Convert a markdown string to an HTML string suitable for insertion into a
   * contenteditable rich-text editor.
   */
  function markdownToHtml(md) {

    // Normalise line endings
    let text = md.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

    // Escape HTML entities in the raw text BEFORE adding our own tags
    // We'll unescape them selectively after processing.
    // Strategy: process block-by-block so we can escape content inside code
    // blocks without mangling the surrounding HTML.

    const blocks = [];
    const lines = text.split("\n");
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];

      // ── Indented code block ───────────────────────────────────────────────
      if (/^( {4}|\t)/.test(line)) {
        const codeLines = [];
        while (i < lines.length) {
          if (/^( {4}|\t)/.test(lines[i])) {
            codeLines.push(escapeHtml(lines[i].replace(/^( {4}|\t)/, "")));
            i++;
            continue;
          }

          // Keep blank lines within a code block when another indented line
          // follows; otherwise leave the blank line for paragraph handling.
          if (
            lines[i].trim() === "" &&
            i + 1 < lines.length &&
            /^( {4}|\t)/.test(lines[i + 1])
          ) {
            codeLines.push("");
            i++;
            continue;
          }
          break;
        }
        blocks.push(`<pre><code>${codeLines.join("\n")}</code></pre>`);
        continue;
      }

      // ── Fenced code block  ```...``` ──────────────────────────────────────
      if (/^```/.test(line)) {
        const lang = line.slice(3).trim();
        const codeLines = [];
        i++;
        while (i < lines.length && !/^```/.test(lines[i])) {
          codeLines.push(escapeHtml(lines[i]));
          i++;
        }
        i++; // skip closing ```
        const langAttr = lang ? ` data-language="${escapeHtml(lang)}"` : "";
        blocks.push(
          `<pre${langAttr}><code>${codeLines.join("\n")}</code></pre>`
        );
        continue;
      }

      // ── Heading ──────────────────────────────────────────────────────────
      const headingMatch = line.match(/^(#{1,3})\s+(.+)/);
      if (headingMatch) {
        const level = headingMatch[1].length;
        blocks.push(`<h${level}>${inlineMarkdown(headingMatch[2])}</h${level}>`);
        i++;
        continue;
      }

      // ── Horizontal rule ──────────────────────────────────────────────────
      if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
        blocks.push("<hr>");
        i++;
        continue;
      }

      // ── Blockquote ───────────────────────────────────────────────────────
      if (/^>\s/.test(line)) {
        const quoteLines = [];
        while (i < lines.length && /^>\s?/.test(lines[i])) {
          quoteLines.push(lines[i].replace(/^>\s?/, ""));
          i++;
        }
        blocks.push(
          `<blockquote>${inlineMarkdown(quoteLines.join("<br>"))}</blockquote>`
        );
        continue;
      }

      // ── Unordered list ───────────────────────────────────────────────────
      if (/^[-*+]\s/.test(line)) {
        const items = [];
        while (i < lines.length && /^[-*+]\s/.test(lines[i])) {
          items.push(`<li>${inlineMarkdown(lines[i].replace(/^[-*+]\s/, ""))}</li>`);
          i++;
        }
        blocks.push(`<ul>${items.join("")}</ul>`);
        continue;
      }

      // ── Ordered list ─────────────────────────────────────────────────────
      if (/^\d+\.\s/.test(line)) {
        const items = [];
        while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
          items.push(`<li>${inlineMarkdown(lines[i].replace(/^\d+\.\s/, ""))}</li>`);
          i++;
        }
        blocks.push(`<ol>${items.join("")}</ol>`);
        continue;
      }

      // ── Blank line → paragraph break ─────────────────────────────────────
      if (line.trim() === "") {
        blocks.push("<p></p>");
        i++;
        continue;
      }

      // ── Normal paragraph line ────────────────────────────────────────────
      // Collect consecutive non-special lines into a single paragraph
      const paraLines = [];
      while (
        i < lines.length &&
        lines[i].trim() !== "" &&
        !/^(#{1,3}\s|```|>\s|[-*+]\s|\d+\.\s|(-{3,}|\*{3,}|_{3,})\s*$)/.test(lines[i])
      ) {
        paraLines.push(lines[i]);
        i++;
      }
      blocks.push(`<p>${inlineMarkdown(paraLines.join("<br>"))}</p>`);
    }

    return blocks.join("");
  }

  /**
   * Process inline markdown within a single line of text.
   * Order matters: code spans must be extracted first to protect their content.
   */
  function inlineMarkdown(text) {
    // Temporarily extract inline code spans to protect their content
    const codeSpans = [];
    text = text.replace(/`([^`]+)`/g, (_, code) => {
      codeSpans.push(`<code>${escapeHtml(code)}</code>`);
      return `\x00CODE${codeSpans.length - 1}\x00`;
    });

    // Strikethrough  ~~text~~
    // Zendesk's editor has no strikethrough mark, so any <del>/<s>/<strike>
    // tag (or text-decoration style) is stripped on paste. Instead, render the
    // struck text with Unicode combining long-stroke-overlay characters, which
    // survive as plain text in any editor. Done before escaping so the combining
    // marks are applied to the visible characters, not HTML entities.
    text = text.replace(/~~(.+?)~~/g, (_, struck) => strikeText(struck));

    // Escape HTML in the remaining text
    text = escapeHtml(text);

    // Bold + italic  ***text***
    text = text.replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>");
    // Bold  **text** or __text__
    text = text.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    text = text.replace(/__(.+?)__/g, "<strong>$1</strong>");
    // Italic  *text* or _text_
    text = text.replace(/\*(.+?)\*/g, "<em>$1</em>");
    text = text.replace(/_(.+?)_/g, "<em>$1</em>");
    // Links  [label](url)
    text = text.replace(
      /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
    );

    // Restore code spans (already HTML-escaped internally)
    text = text.replace(/\x00CODE(\d+)\x00/g, (_, idx) => codeSpans[Number(idx)]);

    return text;
  }

  function escapeHtml(str) {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /**
   * Render text as strikethrough using the Unicode combining long stroke
   * overlay (U+0336) after each visible character. This survives editors (like
   * Zendesk's) that have no strikethrough formatting of their own. Array.from
   * keeps astral characters (emoji, etc.) intact instead of splitting surrogate
   * pairs.
   */
  function strikeText(str) {
    return Array.from(str)
      .map((ch) => ch + "\u0336")
      .join("");
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  /**
   * Returns true when the pasted text contains at least one markdown pattern
   * worth converting (avoids interfering with plain-text pastes).
   */
  function looksLikeMarkdown(text) {
    return /(`{1,3}|\*\*|__|\*[^*\s]|_[^_\s]|^#{1,3}\s|^[-*+]\s|\d+\.\s|^>\s|^( {4}|\t)\S|~~|\[.+\]\(https?:\/\/)/m.test(
      text
    );
  }

  // ── Paste interception ──────────────────────────────────────────────────────

  // Tag re-dispatched events so we don't intercept our own synthetic paste.
  const REdispatched = Symbol("zdMdPasteReDispatched");

  function handlePaste(event) {
    // Skip our own re-dispatched events
    if (event[REdispatched]) return;

    const clipboardData = event.clipboardData;
    if (!clipboardData) return;

    const plainText = clipboardData.getData("text/plain");
    if (!plainText || !looksLikeMarkdown(plainText)) return;

    // Only act when the paste target is (or is inside) a contenteditable element
    const target = event.target;
    if (!target || !target.closest) return;
    const editor = target.closest('[contenteditable], [contenteditable="true"]');
    if (!editor) return;

    // Stop the original paste so the editor doesn't also handle it
    event.preventDefault();
    event.stopPropagation();

    const html = markdownToHtml(plainText);

    // Build a new ClipboardEvent that carries text/html so TipTap/ProseMirror
    // will render it as rich text (they prefer text/html over text/plain).
    const dt = new DataTransfer();
    dt.setData("text/html", html);
    dt.setData("text/plain", plainText);

    const syntheticPaste = new ClipboardEvent("paste", {
      bubbles: true,
      cancelable: true,
      clipboardData: dt,
    });

    // Mark it so our listener ignores it on the way back down
    syntheticPaste[REdispatched] = true;

    target.dispatchEvent(syntheticPaste);
  }

  // Capture phase so we fire before TipTap's own paste listener
  document.addEventListener("paste", handlePaste, true);
})();
