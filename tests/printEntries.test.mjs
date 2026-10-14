import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPrintHtml, escapeHtml } from '../src/features/printEntries.js';
import { APP_CREDIT } from '../src/config/legal.js';

test('escapeHtml neutralises markup', () => {
  assert.equal(escapeHtml('<b>"a"&\'</b>'), '&lt;b&gt;&quot;a&quot;&amp;&#39;&lt;/b&gt;');
});

test('buildPrintHtml keeps Sinhala, escapes HTML and carries the credit', () => {
  const html = buildPrintHtml([
    { title: 'අම්මා <script>', bodyText: 'කොහොමද?\n\nline2', createdAt: 0 },
    { title: '', bodyText: '', createdAt: 0 },
  ]);
  assert.ok(html.includes('අම්මා'));
  assert.ok(html.includes('කොහොමද?'));
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('Untitled entry'));
  assert.ok(html.includes(escapeHtml(APP_CREDIT)));
  assert.equal((html.match(/<section>/g) || []).length, 2);
});
