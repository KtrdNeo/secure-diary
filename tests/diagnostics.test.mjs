import 'fake-indexeddb/auto';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import Dexie from 'dexie';
import { db } from '../src/db/schema.js';
import { generateSalt, deriveKeyFromPassphrase, encryptData, encryptBinary } from '../src/utils/crypto.js';
import {
  pingDatabase,
  getStorageEstimate,
  getEntryStats,
  getSyncQueueStats,
  clearStuckSyncQueueItems,
  verifyEntryIntegrity,
  runFullDiagnostics,
} from '../src/health/diagnostics.js';

beforeEach(async () => {
  if (db.isOpen()) db.close();
  await Dexie.delete('SecureDiaryDB');
  await db.open();
});

test('pingDatabase succeeds against a working IndexedDB', async () => {
  const result = await pingDatabase(db);
  assert.equal(result.ok, true);
});

test('pingDatabase leaves no trace behind (the test key is cleaned up)', async () => {
  await pingDatabase(db);
  const remaining = await db.settings.toArray();
  assert.equal(remaining.some((r) => r.key.startsWith('__ping__')), false);
});

test('getStorageEstimate degrades gracefully when navigator.storage is unavailable (as in this Node test environment)', async () => {
  const result = await getStorageEstimate();
  assert.equal(result.supported, false);
});

test('getEntryStats counts live vs deleted entries correctly', async () => {
  const now = Date.now();
  await db.entries.bulkAdd([
    { notebookId: null, type: 'text', createdAt: now, updatedAt: now, isPinned: 0, isDeleted: 0, syncStatus: 'synced', remoteId: 'a' },
    { notebookId: null, type: 'text', createdAt: now, updatedAt: now, isPinned: 0, isDeleted: 0, syncStatus: 'synced', remoteId: 'b' },
    { notebookId: null, type: 'text', createdAt: now, updatedAt: now, isPinned: 0, isDeleted: 1, syncStatus: 'synced', remoteId: 'c' },
  ]);
  const stats = await getEntryStats(db);
  assert.equal(stats.totalEntries, 3);
  assert.equal(stats.liveEntries, 2);
  assert.equal(stats.deletedEntries, 1);
});

test('getSyncQueueStats reports pending count and flags stuck items', async () => {
  await db.syncQueue.bulkAdd([
    { entityType: 'entry', entityId: 1, operation: 'upsert', createdAt: Date.now(), attempts: 0 },
    { entityType: 'entry', entityId: 2, operation: 'upsert', createdAt: Date.now(), attempts: 7 },
  ]);
  const stats = await getSyncQueueStats(db);
  assert.equal(stats.pendingCount, 2);
  assert.equal(stats.stuckCount, 1);
});

test('clearStuckSyncQueueItems removes only items past the attempt threshold', async () => {
  await db.syncQueue.bulkAdd([
    { entityType: 'entry', entityId: 1, operation: 'upsert', createdAt: Date.now(), attempts: 1 },
    { entityType: 'entry', entityId: 2, operation: 'upsert', createdAt: Date.now(), attempts: 5 },
    { entityType: 'entry', entityId: 3, operation: 'upsert', createdAt: Date.now(), attempts: 10 },
  ]);
  const result = await clearStuckSyncQueueItems(db, 5);
  assert.equal(result.cleared, 2);
  const remaining = await db.syncQueue.toArray();
  assert.equal(remaining.length, 1);
  assert.equal(remaining[0].entityId, 1);
});

test('verifyEntryIntegrity finds no broken entries when everything decrypts correctly', async () => {
  const salt = generateSalt();
  const key = await deriveKeyFromPassphrase('integrity-test', salt);
  const now = Date.now();
  await db.entries.add({
    notebookId: null,
    type: 'text',
    titlePayload: await encryptData({ title: 'fine' }, key),
    contentPayload: await encryptBinary(new TextEncoder().encode('{}'), key),
    createdAt: now,
    updatedAt: now,
    isPinned: 0,
    isDeleted: 0,
    syncStatus: 'synced',
    remoteId: 'x',
  });

  const result = await verifyEntryIntegrity(db, key);
  assert.equal(result.checked, 1);
  assert.equal(result.brokenCount, 0);
});

test('verifyEntryIntegrity isolates a genuinely corrupted entry without throwing', async () => {
  const salt = generateSalt();
  const key = await deriveKeyFromPassphrase('integrity-test-2', salt);
  const now = Date.now();

  const brokenId = await db.entries.add({
    notebookId: null,
    type: 'text',
    titlePayload: { iv: 'not-valid-base64!!', ciphertext: 'also-not-valid!!' },
    contentPayload: await encryptBinary(new TextEncoder().encode('{}'), key),
    createdAt: now,
    updatedAt: now,
    isPinned: 0,
    isDeleted: 0,
    syncStatus: 'synced',
    remoteId: 'y',
  });

  const result = await verifyEntryIntegrity(db, key);
  assert.equal(result.checked, 1);
  assert.equal(result.brokenCount, 1);
  assert.equal(result.broken[0].id, brokenId);
});

test('runFullDiagnostics combines every check into one report', async () => {
  const salt = generateSalt();
  const key = await deriveKeyFromPassphrase('full-diag-test', salt);
  const report = await runFullDiagnostics(db, key);

  assert.equal(report.ping.ok, true);
  assert.equal(typeof report.entryStats.totalEntries, 'number');
  assert.equal(typeof report.syncQueue.pendingCount, 'number');
  assert.equal(report.integrity.checked, 0);
  assert.equal(typeof report.ranAt, 'number');
});

test('runFullDiagnostics skips integrity checking gracefully when no cryptoKey is available', async () => {
  const report = await runFullDiagnostics(db, null);
  assert.equal(report.integrity, null);
});
