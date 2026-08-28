// Polyfills globalThis.indexedDB so Dexie can run under plain Node - must
// be imported before the schema module touches indexedDB.
import 'fake-indexeddb/auto';

import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import Dexie from 'dexie';
import { db, FLAG, SYNC_STATUS } from '../src/db/schema.js';
import { generateSalt, deriveKeyFromPassphrase, encryptData } from '../src/utils/crypto.js';

// Fresh database state before each test. Dexie only auto-opens a table on
// its very first use - after an explicit close() it must be reopened
// explicitly, so we do that here rather than relying on implicit open.
beforeEach(async () => {
  if (db.isOpen()) db.close();
  await Dexie.delete('SecureDiaryDB');
  await db.open();
});

test('schema opens and creates all expected tables', async () => {
  await db.open();
  const tableNames = db.tables.map((t) => t.name).sort();
  assert.deepEqual(tableNames, [
    'attachments',
    'entries',
    'entryVersions',
    'notebooks',
    'settings',
    'syncQueue',
  ]);
});

test('an entry stores an encrypted payload and only plaintext metadata', async () => {
  const salt = generateSalt();
  const key = await deriveKeyFromPassphrase('test-pass', salt);
  const payload = await encryptData({ title: 'Today', body: 'It rained.' }, key);

  const id = await db.entries.add({
    notebookId: 1,
    type: 'text',
    payload,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    isPinned: FLAG.FALSE,
    isDeleted: FLAG.FALSE,
    syncStatus: SYNC_STATUS.PENDING,
    remoteId: null,
  });

  const stored = await db.entries.get(id);
  assert.equal(stored.payload.ciphertext.includes('rained'), false);
  assert.equal(stored.isDeleted, 0);
});

test('compound index filters non-deleted entries within a notebook', async () => {
  await db.entries.bulkAdd([
    { notebookId: 1, type: 'text', createdAt: 1, isDeleted: FLAG.FALSE, syncStatus: 'pending' },
    { notebookId: 1, type: 'text', createdAt: 2, isDeleted: FLAG.TRUE, syncStatus: 'pending' },
    { notebookId: 2, type: 'text', createdAt: 3, isDeleted: FLAG.FALSE, syncStatus: 'pending' },
  ]);

  const live = await db.entries.where('[notebookId+isDeleted]').equals([1, FLAG.FALSE]).toArray();

  assert.equal(live.length, 1);
  assert.equal(live[0].createdAt, 1);
});

test('settings table works as a plain key/value store', async () => {
  await db.settings.put({ key: 'theme', value: 'dark-obsidian' });
  const theme = await db.settings.get('theme');
  assert.equal(theme.value, 'dark-obsidian');
});

test('syncQueue records a queued mutation for the Phase 4 sync engine', async () => {
  await db.syncQueue.add({
    entityType: 'entry',
    entityId: 42,
    operation: 'update',
    createdAt: Date.now(),
    attempts: 0,
  });
  const queued = await db.syncQueue.toArray();
  assert.equal(queued.length, 1);
  assert.equal(queued[0].operation, 'update');
});
