// lib/legal/get-legal-content.ts
// ─────────────────────────────────────────────
// Loads legal markdown files and converts to HTML.
// Uses a lightweight parser (no external dependency).
// For production, you could swap this for 'marked' or 'remark'.
// ─────────────────────────────────────────────

import { readFile } from 'fs/promises';
import { join } from 'path';
import type { Locale } from '@/lib/i18n/config';

type LegalPage = 'cgu' | 'privacy' | 'mentions';

export async function getLegalContent(
  locale: Locale,
  page: LegalPage
): Promise<string> {
  const filePath = join(process.cwd(), 'content', locale, `${page}.md`);
  const markdown = await readFile(filePath, 'utf-8');
  return markdownToHtml(markdown);
}

/**
 * Minimal markdown → HTML converter.
 * Handles: headings, paragraphs, bold, italic, links, lists, tables, code, hr.
 * Good enough for legal pages. For anything more complex, use 'marked'.
 */
function markdownToHtml(md: string): string {
  const lines = md.split('\n');
  const htmlLines: string[] = [];
  let inList = false;
  let inTable = false;
  let tableHeaderDone = false;

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    // Skip empty lines (close open lists/tables)
    if (line.trim() === '') {
      if (inList) {
        htmlLines.push('</ul>');
        inList = false;
      }
      if (inTable) {
        htmlLines.push('</tbody></table>');
        inTable = false;
        tableHeaderDone = false;
      }
      continue;
    }

    // Headings
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      if (inList) { htmlLines.push('</ul>'); inList = false; }
      if (inTable) { htmlLines.push('</tbody></table>'); inTable = false; tableHeaderDone = false; }
      const level = headingMatch[1].length;
      htmlLines.push(`<h${level}>${inlineFormat(headingMatch[2])}</h${level}>`);
      continue;
    }

    // Horizontal rule
    if (line.match(/^---+$/)) {
      htmlLines.push('<hr />');
      continue;
    }

    // Table row
    if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
      const cells = line
        .split('|')
        .slice(1, -1)
        .map((c) => c.trim());

      // Separator row (|---|---|)
      if (cells.every((c) => /^[-:]+$/.test(c))) {
        tableHeaderDone = true;
        continue;
      }

      if (!inTable) {
        htmlLines.push('<table><thead><tr>');
        cells.forEach((c) => htmlLines.push(`<th>${inlineFormat(c)}</th>`));
        htmlLines.push('</tr></thead><tbody>');
        inTable = true;
        continue;
      }

      htmlLines.push('<tr>');
      cells.forEach((c) => htmlLines.push(`<td>${inlineFormat(c)}</td>`));
      htmlLines.push('</tr>');
      continue;
    }

    // Unordered list
    if (line.match(/^[-*]\s+/)) {
      if (!inList) {
        htmlLines.push('<ul>');
        inList = true;
      }
      htmlLines.push(`<li>${inlineFormat(line.replace(/^[-*]\s+/, ''))}</li>`);
      continue;
    }

    // Paragraph (default)
    if (inList) { htmlLines.push('</ul>'); inList = false; }
    if (inTable) { htmlLines.push('</tbody></table>'); inTable = false; tableHeaderDone = false; }

    // Italic line (e.g. *Dernière mise à jour...*)
    htmlLines.push(`<p>${inlineFormat(line)}</p>`);
  }

  // Close any open tags
  if (inList) htmlLines.push('</ul>');
  if (inTable) htmlLines.push('</tbody></table>');

  return htmlLines.join('\n');
}

/** Inline formatting: bold, italic, code, links */
function inlineFormat(text: string): string {
  return (
    text
      // Links: [text](url)
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
      // Bold + italic: ***text***
      .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
      // Bold: **text**
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      // Italic: *text*
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      // Inline code: `text`
      .replace(/`([^`]+)`/g, '<code>$1</code>')
  );
}
