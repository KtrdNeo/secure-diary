import 'fake-indexeddb/auto';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import Dexie from 'dexie';
import { db } from '../src/db/schema.js';
import { generateSalt, deriveKeyFromPassphrase, encryptData, decryptData, encryptBinary, decryptBinary } from '../src/utils/crypto.js';
import { createEmptyYDoc, encodeYDoc, decodeYDoc, yDocToPlainText, YJS_CONTENT_FIELD } from '../src/components/editor/yjsUtils.js';
import { pushPendingChanges, pullAndMergeEntries, pullNewAttachments } from '../src/sync/syncEngine.js';
import * as Y from 'yjs';

const USER_ID = 'test-user-123';

function makeFakeRemoteAdapter({ failUpsertEntry = false } = {}) {
  const entries = new Map();
  const attachments = new Map();
  return {
    async upsertEntry(row) {
      if (failUpsertEntry) throw new Error('simulated network failure');
      entries.set(row.id, row);
    },
    async upsertAttachment(row) {
      attachments.set(row.id, row);
    },
    async fetchEntriesSince(userId, sinceIso) {
      return [...entries.values()].filter((e) => e.user_id === userId && e.updated_at >= sinceIso);
    },
    async fetchAttachmentsSince(userId, sinceIso) {
      return [...attachments.values()].filter((a) => a.user_id === userId && a.created_at >= sinceIso);
    },
    _entries: entries,
    _attachments: attachments,
  };
}

function docWithText(text) {
  const ydoc = createEmptyYDoc();
  ydoc.get(YJS_CONTENT_FIELD, Y.XmlFragment).insert(0, [new Y.XmlText(text)]);
  return ydoc;
}

beforeEach(async () => {
  if (db.isOpen()) db.close();
  await Dexie.delete('SecureDiaryDB');
  await db.open();
});

test('pushPendingChanges sends a queued entry to the remote and marks it synced', async () => {
  const salt = generateSalt();
  const key = await deriveKeyFromPassphrase('push-test', salt);
  const ydoc = docWithText('hello from device A');

  const titlePayload = await encryptData({ title: 'My Entry' }, key);
  const contentPayload = await encryptBinary(encodeYDoc(ydoc), key);
  const remoteId = crypto.randomUUID();
  const now = Date.now();

  const localId = await db.entries.add({
    notebookId: null,
    type: 'text',
    titlePayload,
    contentPayload,
    createdAt: now,
    updatedAt: now,
    isPinned: 0,
    isDeleted: 0,
    syncStatus: 'pending',
    remoteId,
  });
  await db.syncQueue.add({ entityType: 'entry', entityId: localId, operation: 'update', createdAt: now, attempts: 0 });

  const remote = makeFakeRemoteAdapter();
  const result = await pushPendingChanges(db, remote, USER_ID);

  assert.equal(result.pushed, 1);
  assert.equal(result.failed, 0);
  assert.equal((await db.syncQueue.toArray()).length, 0, 'queue item should be removed after a successful push');

  const pushedRow = remote._entries.get(remoteId);
  assert.ok(pushedRow, 'entry should have been upserted to the remote');
  assert.equal(pushedRow.user_id, USER_ID);

  const localAfter = await db.entries.get(localId);
  assert.equal(localAfter.syncStatus, 'synced');
});

test('pushPendingChanges increments attempts and keeps the item queued on failure', async () => {
  const salt = generateSalt();
  const key = await deriveKeyFromPassphrase('fail-test', salt);
  const ydoc = docWithText('will fail to push');

  const localId = await db.entries.add({
    notebookId: null,
    type: 'text',
    titlePayload: await encryptData({ title: 'x' }, key),
    contentPayload: await encryptBinary(encodeYDoc(ydoc), key),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    isPinned: 0,
    isDeleted: 0,
    syncStatus: 'pending',
    remoteId: crypto.randomUUID(),
  });
  await db.syncQueue.add({ entityType: 'entry', entityId: localId, operation: 'update', createdAt: Date.now(), attempts: 0 });

  const remote = makeFakeRemoteAdapter({ failUpsertEntry: true });
  const result = await pushPendingChanges(db, remote, USER_ID);

  assert.equal(result.pushed, 0);
  assert.equal(result.failed, 1);
  const queued = await db.syncQueue.toArray();
  assert.equal(queued.length, 1, 'failed item should stay in the queue');
  assert.equal(queued[0].attempts, 1);
});

test('pullAndMergeEntries adopts a brand-new remote entry with no local counterpart', async () => {
  const salt = generateSalt();
  const key = await deriveKeyFromPassphrase('adopt-test', salt);
  const ydoc = docWithText('written entirely on another device');

  const remote = makeFakeRemoteAdapter();
  const remoteId = crypto.randomUUID();
  remote._entries.set(remoteId, {
    id: remoteId,
    user_id: USER_ID,
    title_payload: await encryptData({ title: 'From device B' }, key),
    content_payload: (await import('../src/sync/payloadCodec.js')).binaryPayloadToWire(
      await encryptBinary(encodeYDoc(ydoc), key)
    ),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    is_pinned: false,
    is_deleted: false,
  });

  const result = await pullAndMergeEntries(db, remote, key, USER_ID, '2000-01-01T00:00:00.000Z');
  assert.equal(result.created, 1);

  const localEntries = await db.entries.toArray();
  assert.equal(localEntries.length, 1);
  assert.equal(localEntries[0].remoteId, remoteId);
});

test('pullAndMergeEntries CRDT-merges concurrent edits from local and remote through the full encrypt/decrypt pipeline', async () => {
  const salt = generateSalt();
  const key = await deriveKeyFromPassphrase('merge-test', salt);
  const remoteId = crypto.randomUUID();

  // A shared starting point, as if both devices had synced this much already.
  const sharedYdoc = docWithText('Dear diary, ');
  const sharedState = encodeYDoc(sharedYdoc);

  // Local device edits further.
  const localYdoc = decodeYDoc(sharedState);
  localYdoc.get(YJS_CONTENT_FIELD, Y.XmlFragment).get(0).insert(12, 'sunny today.');
  const now = Date.now();
  const localId = await db.entries.add({
    notebookId: null,
    type: 'text',
    titlePayload: await encryptData({ title: 'Local title' }, key),
    contentPayload: await encryptBinary(encodeYDoc(localYdoc), key),
    createdAt: now,
    updatedAt: now,
    isPinned: 0,
    isDeleted: 0,
    syncStatus: 'pending',
    remoteId,
  });

  // Remote device (another device, synced earlier) edited the SAME
  // shared starting point differently, and its row is now on the server.
  const remoteYdoc = decodeYDoc(sharedState);
  remoteYdoc.get(YJS_CONTENT_FIELD, Y.XmlFragment).get(0).insert(12, 'I saw a whale!');
  const { binaryPayloadToWire } = await import('../src/sync/payloadCodec.js');

  const remote = makeFakeRemoteAdapter();
  remote._entries.set(remoteId, {
    id: remoteId,
    user_id: USER_ID,
    title_payload: await encryptData({ title: 'Remote title' }, key),
    content_payload: binaryPayloadToWire(await encryptBinary(encodeYDoc(remoteYdoc), key)),
    created_at: new Date(now - 1000).toISOString(),
    updated_at: new Date(now + 60_000).toISOString(), // "synced later than local's last local edit"
    is_pinned: false,
    is_deleted: false,
  });

  const result = await pullAndMergeEntries(db, remote, key, USER_ID, '2000-01-01T00:00:00.000Z');
  assert.equal(result.merged, 1);

  const mergedLocal = await db.entries.get(localId);
  const mergedBytes = await decryptBinary(mergedLocal.contentPayload, key);
  const mergedText = yDocToPlainText(decodeYDoc(new Uint8Array(mergedBytes)));

  assert.ok(mergedText.includes('Dear diary,'), 'lost the shared base text');
  assert.ok(mergedText.includes('sunny today.'), 'lost the local device\'s edit during merge');
  assert.ok(mergedText.includes('I saw a whale!'), 'lost the remote device\'s edit during merge');

  // Title uses last-write-wins by timestamp - remote's updated_at was
  // set later than local's, so the merged title should be remote's.
  const mergedTitleData = await decryptData(mergedLocal.titlePayload, key);
  assert.equal(mergedTitleData.title, 'Remote title');
});

test('pullNewAttachments adopts a remote attachment once its parent entry exists locally', async () => {
  const salt = generateSalt();
  const key = await deriveKeyFromPassphrase('attach-test', salt);
  const entryRemoteId = crypto.randomUUID();
  const now = Date.now();

  const localEntryId = await db.entries.add({
    notebookId: null,
    type: 'text',
    titlePayload: await encryptData({ title: 'Has an attachment' }, key),
    contentPayload: await encryptBinary(encodeYDoc(docWithText('body')), key),
    createdAt: now,
    updatedAt: now,
    isPinned: 0,
    isDeleted: 0,
    syncStatus: 'synced',
    remoteId: entryRemoteId,
  });

  const remote = makeFakeRemoteAdapter();
  const attachmentRemoteId = crypto.randomUUID();
  remote._attachments.set(attachmentRemoteId, {
    id: attachmentRemoteId,
    user_id: USER_ID,
    entry_id: entryRemoteId,
    mime_type: 'application/x-secure-diary-strokes',
    size_bytes: 42,
    payload: await encryptData({ strokes: [] }, key),
    created_at: new Date().toISOString(),
  });

  const result = await pullNewAttachments(db, remote, USER_ID, '2000-01-01T00:00:00.000Z');
  assert.equal(result.created, 1);

  const localAttachments = await db.attachments.where('entryId').equals(localEntryId).toArray();
  assert.equal(localAttachments.length, 1);
  assert.equal(localAttachments[0].remoteId, attachmentRemoteId);
});
