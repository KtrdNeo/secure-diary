import 'fake-indexeddb/auto';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import Dexie from 'dexie';
import { db } from '../src/db/schema.js';
import { generateSalt, deriveKeyFromPassphrase, encryptData, encryptBinary, decryptData, decryptBinary } from '../src/utils/crypto.js';
import { exportBackup, importBackup } from '../src/health/backup.js';

beforeEach(async () => {
  if (db.isOpen()) db.close();
  await Dexie.delete('SecureDiaryDB');
  await db.open();
});

async function seedOneEntry(key) {
  const now = Date.now();
  const entryId = await db.entries.add({
    notebookId: null,
    type: 'text',
    titlePayload: await encryptData({ title: 'Backup me' }, key),
    contentPayload: await encryptBinary(new TextEncoder().encode('real content bytes'), key),
    createdAt: now,
    updatedAt: now,
    isPinned: 0,
    isDeleted: 0,
    syncStatus: 'synced',
    remoteId: 'entry-remote-1',
  });
  const attachmentId = await db.attachments.add({
    entryId,
    mimeType: 'audio/webm',
    sizeBytes: 10,
    payload: await encryptBinary(new TextEncoder().encode('audio bytes'), key),
    createdAt: now,
    syncStatus: 'synced',
    remoteId: 'attach-remote-1',
  });
  return { entryId, attachmentId };
}

test('exportBackup produces a plain-JSON-serializable object (no raw ArrayBuffers survive)', async () => {
  const salt = generateSalt();
  const key = await deriveKeyFromPassphrase('backup-test', salt);
  await seedOneEntry(key);

  const backup = await exportBackup(db);
  const roundTripped = JSON.parse(JSON.stringify(backup));
  assert.deepEqual(roundTripped, backup);
});

test('a full export -> JSON round trip -> import -> decrypt recovers the exact original content', async () => {
  const salt = generateSalt();
  const key = await deriveKeyFromPassphrase('roundtrip-test', salt);
  await seedOneEntry(key);

  const backup = await exportBackup(db);
  const asFileText = JSON.stringify(backup);

  await Dexie.delete('SecureDiaryDB');
  await db.open();

  const parsedBackup = JSON.parse(asFileText);
  const result = await importBackup(db, parsedBackup);
  assert.equal(result.entries, 1);
  assert.equal(result.attachments, 1);

  const restoredEntry = await db.entries.toArray().then((rows) => rows[0]);
  const titleData = await decryptData(restoredEntry.titlePayload, key);
  assert.equal(titleData.title, 'Backup me');

  const contentBytes = await decryptBinary(restoredEntry.contentPayload, key);
  assert.equal(new TextDecoder().decode(contentBytes), 'real content bytes');

  const restoredAttachment = await db.attachments.toArray().then((rows) => rows[0]);
  const attachmentBytes = await decryptBinary(restoredAttachment.payload, key);
  assert.equal(new TextDecoder().decode(attachmentBytes), 'audio bytes');
});

test('importBackup rejects a file that is not a recognizable backup', async () => {
  await assert.rejects(() => importBackup(db, { not: 'a backup' }));
  await assert.rejects(() => importBackup(db, null));
});

test('importBackup in "skip" mode (default) does not overwrite an existing record at the same id', async () => {
  const salt = generateSalt();
  const key = await deriveKeyFromPassphrase('skip-test', salt);
  const { entryId } = await seedOneEntry(key);

  const backup = await exportBackup(db);
  await db.entries.update(entryId, { titlePayload: await encryptData({ title: 'Changed locally' }, key) });

  const result = await importBackup(db, JSON.parse(JSON.stringify(backup)), { mode: 'skip' });
  // seedOneEntry creates both an entry AND an attachment, and this test
  // never clears the db between backup and reimport - both already
  // exist locally, so both get skipped.
  assert.equal(result.skipped, 2);
  assert.equal(result.entries, 0);

  const stillLocal = await db.entries.get(entryId);
  const titleData = await decryptData(stillLocal.titlePayload, key);
  assert.equal(titleData.title, 'Changed locally');
});

test('importBackup in "replace" mode overwrites an existing record at the same id', async () => {
  const salt = generateSalt();
  const key = await deriveKeyFromPassphrase('replace-test', salt);
  const { entryId } = await seedOneEntry(key);

  const backup = await exportBackup(db);
  await db.entries.update(entryId, { titlePayload: await encryptData({ title: 'Changed locally' }, key) });

  await importBackup(db, JSON.parse(JSON.stringify(backup)), { mode: 'replace' });

  const replaced = await db.entries.get(entryId);
  const titleData = await decryptData(replaced.titlePayload, key);
  assert.equal(titleData.title, 'Backup me');
});
