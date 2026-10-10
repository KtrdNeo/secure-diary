import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeStreaks, diaryStats, dayIndex } from '../src/features/stats.js';
import { countWords, readingMinutes } from '../src/features/textStats.js';
import { WRITING_PROMPTS, promptForDate, randomPrompt } from '../src/features/prompts.js';
import { isIdleLongEnough } from '../src/features/autoLock.js';
import { TEMPLATES, buildTemplate } from '../src/features/templates.js';

const at = (y, m, d, h = 12) => new Date(y, m - 1, d, h).getTime();

test('streaks: none, single, consecutive, broken', () => {
  const now = at(2026, 5, 10);
  assert.deepEqual(computeStreaks([], now), { current: 0, longest: 0 });
  assert.deepEqual(computeStreaks([at(2026, 5, 10)], now), { current: 1, longest: 1 });
  assert.deepEqual(computeStreaks([at(2026, 5, 8), at(2026, 5, 9), at(2026, 5, 10)], now), { current: 3, longest: 3 });
  assert.deepEqual(computeStreaks([at(2026, 5, 1), at(2026, 5, 2), at(2026, 5, 3), at(2026, 5, 10)], now), { current: 1, longest: 3 });
});

test('streak stays alive if yesterday written, dies after a gap', () => {
  const now = at(2026, 5, 10);
  assert.equal(computeStreaks([at(2026, 5, 8), at(2026, 5, 9)], now).current, 2);
  assert.equal(computeStreaks([at(2026, 5, 7), at(2026, 5, 8)], now).current, 0);
});

test('streaks cross month boundaries and ignore duplicates per day', () => {
  const now = at(2026, 3, 2);
  const ts = [at(2026, 2, 28), at(2026, 3, 1, 8), at(2026, 3, 1, 20), at(2026, 3, 2)];
  assert.deepEqual(computeStreaks(ts, now), { current: 3, longest: 3 });
});

test('dayIndex is consecutive across a DST change', () => {
  assert.equal(dayIndex(at(2026, 3, 9, 1)) - dayIndex(at(2026, 3, 8, 23)), 1);
  assert.equal(dayIndex(at(2026, 11, 2, 1)) - dayIndex(at(2026, 11, 1, 23)), 1);
});

test('diaryStats summarises totals, week and month', () => {
  const now = at(2026, 5, 10);
  const s = diaryStats([at(2026, 5, 10), at(2026, 5, 9), at(2026, 5, 2), at(2026, 4, 30)], now);
  assert.equal(s.total, 4);
  assert.equal(s.thisMonth, 3);
  assert.equal(s.last7Days, 2);
  assert.equal(s.currentStreak, 2);
});

test('countWords handles empty, whitespace, Sinhala', () => {
  assert.equal(countWords(''), 0);
  assert.equal(countWords('   \n '), 0);
  assert.equal(countWords('hello  big\nworld'), 3);
  assert.equal(countWords('මම ගෙදර යනවා'), 3);
  assert.equal(countWords(null), 0);
});

test('readingMinutes', () => {
  assert.equal(readingMinutes(0), 0);
  assert.equal(readingMinutes(1), 1);
  assert.equal(readingMinutes(200), 1);
  assert.equal(readingMinutes(201), 2);
});

test('prompts: unique, stable per day, random excludes', () => {
  assert.equal(new Set(WRITING_PROMPTS).size, WRITING_PROMPTS.length);
  const d = new Date(2026, 4, 10, 9);
  assert.equal(promptForDate(d), promptForDate(new Date(2026, 4, 10, 22)));
  assert.notEqual(promptForDate(d), promptForDate(new Date(2026, 4, 11, 9)));
  for (let i = 0; i < 50; i++) assert.notEqual(randomPrompt(WRITING_PROMPTS[0]), WRITING_PROMPTS[0]);
});

test('isIdleLongEnough', () => {
  assert.equal(isIdleLongEnough(0, 10 * 60000, 0), false);
  assert.equal(isIdleLongEnough(0, 4 * 60000, 5), false);
  assert.equal(isIdleLongEnough(0, 5 * 60000, 5), true);
});

test('templates: unique ids/titles, unknown id', () => {
  const ids = TEMPLATES.map((t) => t.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(buildTemplate('nope'), null);
  const d = new Date(2026, 4, 10);
  for (const id of ids) {
    const b = buildTemplate(id, d);
    assert.ok(b.title.length > 0);
    assert.equal(b.doc.type, 'doc');
    assert.ok(b.doc.content.length > 0);
  }
});
