import { test } from 'node:test';
import assert from 'node:assert/strict';
import { diagnoseTopic, DIAGNOSTIC_TOPICS } from '../src/health/diagnosticGuide.js';

function makeReport(overrides = {}) {
  return {
    ping: { ok: true },
    storage: { supported: true, usageBytes: 1000, quotaBytes: 100000, usagePct: 1 },
    entryStats: { totalEntries: 5, liveEntries: 5, deletedEntries: 0, attachmentCount: 2, versionCount: 3 },
    syncQueue: { pendingCount: 0, stuckCount: 0, oldestPendingAgeMs: null },
    integrity: { checked: 5, brokenCount: 0, broken: [] },
    ...overrides,
  };
}

test('every declared topic id is actually handled (no silent fallthrough to empty)', () => {
  for (const topic of DIAGNOSTIC_TOPICS) {
    const result = diagnoseTopic(topic.id, makeReport());
    assert.ok(result.findings.length > 0, `topic "${topic.id}" produced no findings`);
  }
});

test('sync diagnosis reports an empty queue as healthy', () => {
  const result = diagnoseTopic('sync', makeReport({ syncQueue: { pendingCount: 0, stuckCount: 0, oldestPendingAgeMs: null } }));
  assert.ok(result.findings.some((f) => f.includes('empty') || f.includes('Nothing')));
});

test('sync diagnosis flags stuck items specifically and suggests clearing them', () => {
  const result = diagnoseTopic('sync', makeReport({ syncQueue: { pendingCount: 3, stuckCount: 2, oldestPendingAgeMs: 1000 } }));
  assert.ok(result.findings.some((f) => f.includes('2')));
  assert.ok(result.suggestions.some((s) => s.toLowerCase().includes('stuck')));
});

test('sync diagnosis flags a long-stale queue (over 24h)', () => {
  const oneDayPlusMs = 25 * 60 * 60 * 1000;
  const result = diagnoseTopic('sync', makeReport({ syncQueue: { pendingCount: 1, stuckCount: 0, oldestPendingAgeMs: oneDayPlusMs } }));
  assert.ok(result.findings.some((f) => f.includes('day')));
});

test('missing-entry diagnosis reports broken entries when integrity check found some', () => {
  const result = diagnoseTopic(
    'missing',
    makeReport({ integrity: { checked: 5, brokenCount: 2, broken: [{ id: 1 }, { id: 2 }] } })
  );
  assert.ok(result.findings.some((f) => f.includes('2')));
  assert.ok(result.suggestions.length > 0);
});

test('missing-entry diagnosis handles a locked app (no integrity data) without crashing', () => {
  const result = diagnoseTopic('missing', makeReport({ integrity: null }));
  assert.ok(result.suggestions.some((s) => s.toLowerCase().includes('unlock')));
});

test('storage diagnosis computes MB from bytes correctly', () => {
  const result = diagnoseTopic(
    'storage',
    makeReport({ storage: { supported: true, usageBytes: 5 * 1024 * 1024, quotaBytes: 100 * 1024 * 1024, usagePct: 5 } })
  );
  assert.ok(result.findings.some((f) => f.includes('5.0 MB')));
});

test('storage diagnosis warns when usage is high', () => {
  const result = diagnoseTopic(
    'storage',
    makeReport({ storage: { supported: true, usageBytes: 90, quotaBytes: 100, usagePct: 90 } })
  );
  assert.ok(result.suggestions.some((s) => s.toLowerCase().includes('backup')));
});

test('an unknown topic id returns empty rather than throwing', () => {
  const result = diagnoseTopic('not-a-real-topic', makeReport());
  assert.deepEqual(result, { findings: [], suggestions: [] });
});
