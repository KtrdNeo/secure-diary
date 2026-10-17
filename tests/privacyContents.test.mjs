import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveShield, shouldCover } from '../src/features/privacy.js';
import { groupByMonth, filterItems, monthKey } from '../src/features/contents.js';

test('shield defaults by pointer type and respects stored choice', () => {
  assert.equal(resolveShield(undefined, true), true);
  assert.equal(resolveShield(undefined, false), false);
  assert.equal(resolveShield(false, true), false);
  assert.equal(resolveShield(true, false), true);
});
test('cover only when enabled and hidden or unfocused', () => {
  assert.equal(shouldCover({ enabled: false, hidden: true, focused: false }), false);
  assert.equal(shouldCover({ enabled: true, hidden: false, focused: true }), false);
  assert.equal(shouldCover({ enabled: true, hidden: true, focused: true }), true);
  assert.equal(shouldCover({ enabled: true, hidden: false, focused: false }), true);
});
test('contents grouped newest-first by month and filterable', () => {
  const d = (y, m, day) => new Date(y, m - 1, day, 12).getTime();
  const items = [
    { id: 1, title: 'Garden', createdAt: d(2026, 9, 3) },
    { id: 2, title: 'Work', createdAt: d(2026, 10, 2) },
    { id: 3, title: 'Garden again', createdAt: d(2026, 10, 9) },
    { id: 4, title: '', createdAt: d(2026, 10, 1) },
  ];
  const g = groupByMonth(items);
  assert.deepEqual(g.map((x) => x.key), ['2026-10', '2026-09']);
  assert.deepEqual(g[0].entries.map((e) => e.id), [3, 2, 4]);
  assert.equal(monthKey(d(2026, 1, 31)), '2026-01');
  assert.deepEqual(filterItems(items, 'garden').map((e) => e.id), [1, 3]);
  assert.deepEqual(filterItems(items, 'untitled').map((e) => e.id), [4]);
  assert.equal(filterItems(items, '  ').length, 4);
});
