import 'fake-indexeddb/auto';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import Dexie from 'dexie';
import { db } from '../src/db/schema.js';
import { softDeleteEntry, countDeleted, restoreDeletedEntries } from '../src/features/trash.js';
import { enqueueSync } from '../src/features/syncQueue.js';

beforeEach(async () => {
  if (db.isOpen()) db.close();
  await Dexie.delete('SecureDiaryDB');
  await db.open();
});

const mk = () => db.entries.add({ notebookId: 1, type: 'text', createdAt: 1, updatedAt: 1, isDeleted: 0, isPinned: 0, syncStatus: 'synced' });

test('softDeleteEntry flags entry, marks pending, queues sync once', async () => {
  const id = await mk();
  await softDeleteEntry(db, id);
  await softDeleteEntry(db, id);
  const e = await db.entries.get(id);
  assert.equal(e.isDeleted, 1);
  assert.equal(e.syncStatus, 'pending');
  assert.equal(await db.syncQueue.count(), 1);
});

test('countDeleted counts only deleted', async () => {
  const a = await mk();
  await mk();
  assert.equal(await countDeleted(db), 0);
  await softDeleteEntry(db, a);
  assert.equal(await countDeleted(db), 1);
});

test('restoreDeletedEntries restores all and returns count', async () => {
  const a = await mk();
  const b = await mk();
  await softDeleteEntry(db, a);
  await softDeleteEntry(db, b);
  assert.equal(await restoreDeletedEntries(db), 2);
  assert.equal(await countDeleted(db), 0);
  assert.equal((await db.entries.get(a)).isDeleted, 0);
});

test('enqueueSync dedupes per entity but not across entities', async () => {
  await enqueueSync('entry', 5, db);
  await enqueueSync('entry', 5, db);
  await enqueueSync('attachment', 5, db);
  assert.equal(await db.syncQueue.count(), 2);
});
