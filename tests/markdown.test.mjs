import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as Y from 'yjs';
import { createEmptyYDoc, YJS_CONTENT_FIELD } from '../src/components/editor/yjsUtils.js';
import { yDocToMarkdown, entryToMarkdown } from '../src/features/markdown.js';

function el(name, attrs, children) {
  const e = new Y.XmlElement(name);
  Object.entries(attrs || {}).forEach(([k, v]) => e.setAttribute(k, v));
  e.insert(0, children);
  return e;
}
function txt(s, attrs) {
  const t = new Y.XmlText();
  t.insert(0, s, attrs);
  return t;
}
function build(nodes) {
  const d = createEmptyYDoc();
  d.get(YJS_CONTENT_FIELD, Y.XmlFragment).insert(0, nodes);
  return d;
}

test('headings, marks and paragraphs', () => {
  const md = yDocToMarkdown(build([
    el('heading', { level: 2 }, [txt('Day one')]),
    el('paragraph', {}, [txt('Hello '), txt('world', { bold: true }), txt(' and '), txt('you', { italic: true })]),
  ]));
  assert.equal(md, '## Day one\n\nHello **world** and *you*');
});

test('lists, tasks, quote and Sinhala survive', () => {
  const md = yDocToMarkdown(build([
    el('bulletList', {}, [el('listItem', {}, [el('paragraph', {}, [txt('අම්මා')])]), el('listItem', {}, [el('paragraph', {}, [txt('two')])])]),
    el('taskList', {}, [el('taskItem', { checked: true }, [el('paragraph', {}, [txt('done')])]), el('taskItem', { checked: false }, [el('paragraph', {}, [txt('todo')])])]),
    el('blockquote', {}, [el('paragraph', {}, [txt('wise')])]),
  ]));
  assert.equal(md, '- අම්මා\n- two\n\n- [x] done\n- [ ] todo\n\n> wise');
});

test('table renders as pipe table; entryToMarkdown adds title and date', () => {
  const cell = (n, s) => el(n, {}, [el('paragraph', {}, [txt(s)])]);
  const md = yDocToMarkdown(build([el('table', {}, [el('tableRow', {}, [cell('tableHeader', 'A'), cell('tableHeader', 'B')]), el('tableRow', {}, [cell('tableCell', '1'), cell('tableCell', '2')])])]));
  assert.equal(md, '| A | B |\n| --- | --- |\n| 1 | 2 |');
  assert.match(entryToMarkdown({ title: 'T', bodyMarkdown: 'x', createdAt: Date.UTC(2026, 0, 2) }), /^# T\n\n\*2026-01-02\*\n\nx\n$/);
});
