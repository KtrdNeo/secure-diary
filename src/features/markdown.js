/**
 * Y.Doc (Tiptap/ProseMirror via y-prosemirror) -> Markdown, without needing a
 * live editor. Covers the node types the editor can produce; unknown nodes
 * fall back to their text so nothing is silently dropped.
 */
import * as Y from 'yjs';
import { YJS_CONTENT_FIELD } from '../components/editor/yjsUtils.js';

function inline(text) {
  return text
    .toDelta()
    .map((op) => {
      let s = String(op.insert ?? '');
      if (!s) return '';
      const a = op.attributes || {};
      if (a.code) s = `\`${s}\``;
      if (a.bold) s = `**${s}**`;
      if (a.italic) s = `*${s}*`;
      if (a.strike) s = `~~${s}~~`;
      if (a.link?.href) s = `[${s}](${a.link.href})`;
      return s;
    })
    .join('');
}

function inlineChildren(node) {
  return node
    .toArray()
    .map((c) => (c instanceof Y.XmlText ? inline(c) : c.nodeName === 'hardBreak' ? '  \n' : blockText(c)))
    .join('');
}

function blockText(node) {
  if (node instanceof Y.XmlText) return inline(node);
  return node.toArray().map(blockText).join('');
}

function indent(text, prefix, firstPrefix = prefix) {
  return text
    .split('\n')
    .map((line, i) => (line ? (i === 0 ? firstPrefix : prefix) + line : line))
    .join('\n');
}

function renderList(node, ordered) {
  const items = node.toArray().filter((c) => c instanceof Y.XmlElement);
  return items
    .map((item, i) => {
      const body = renderChildren(item).trim();
      const bullet = ordered ? `${i + 1}. ` : '- ';
      return indent(body, ' '.repeat(bullet.length), bullet);
    })
    .join('\n');
}

function renderTable(node) {
  const rows = node
    .toArray()
    .filter((r) => r instanceof Y.XmlElement)
    .map((r) =>
      r
        .toArray()
        .filter((c) => c instanceof Y.XmlElement)
        .map((c) => blockText(c).replace(/\|/g, '\\|').replace(/\n/g, ' ').trim())
    );
  if (!rows.length) return '';
  const width = Math.max(...rows.map((r) => r.length));
  const pad = (r) => [...r, ...Array(width - r.length).fill('')];
  const line = (r) => `| ${pad(r).join(' | ')} |`;
  return [line(rows[0]), `| ${Array(width).fill('---').join(' | ')} |`, ...rows.slice(1).map(line)].join('\n');
}

function renderNode(node) {
  if (node instanceof Y.XmlText) return inline(node);
  const attrs = node.getAttributes?.() || {};
  switch (node.nodeName) {
    case 'paragraph':
      return inlineChildren(node);
    case 'heading':
      return `${'#'.repeat(Math.min(Math.max(Number(attrs.level) || 1, 1), 6))} ${inlineChildren(node)}`;
    case 'bulletList':
      return renderList(node, false);
    case 'orderedList':
      return renderList(node, true);
    case 'taskList':
      return node
        .toArray()
        .filter((c) => c instanceof Y.XmlElement)
        .map((item) => {
          const checked = item.getAttributes().checked === true || item.getAttributes().checked === 'true';
          return `- [${checked ? 'x' : ' '}] ${renderChildren(item).trim()}`;
        })
        .join('\n');
    case 'blockquote':
      return indent(renderChildren(node), '> ');
    case 'callout':
      return indent(renderChildren(node), '> ', '> **Note:** ');
    case 'codeBlock':
      return `\`\`\`\n${blockText(node)}\n\`\`\``;
    case 'horizontalRule':
      return '---';
    case 'table':
      return renderTable(node);
    case 'drawing':
    case 'drawingBlock':
      return '*[drawing]*';
    case 'voiceNote':
    case 'voiceNoteBlock':
      return '*[voice note]*';
    default:
      return renderChildren(node);
  }
}

function renderChildren(node) {
  return node
    .toArray()
    .map(renderNode)
    .filter((s) => s !== '')
    .join('\n\n');
}

export function yDocToMarkdown(ydoc) {
  const fragment = ydoc.get(YJS_CONTENT_FIELD, Y.XmlFragment);
  return renderChildren(fragment).trim();
}

/** One entry -> a Markdown document (title as H1, date line, body). */
export function entryToMarkdown({ title, bodyMarkdown, createdAt }) {
  const date = createdAt ? new Date(createdAt).toISOString().slice(0, 10) : '';
  return `# ${title?.trim() || 'Untitled entry'}\n\n${date ? `*${date}*\n\n` : ''}${bodyMarkdown || ''}\n`;
}

export function entriesToMarkdown(entries) {
  return entries.map((e) => entryToMarkdown(e)).join('\n---\n\n');
}
