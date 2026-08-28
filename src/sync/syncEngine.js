/**
 * src/sync/syncEngine.js
 *
 * The actual push/pull/merge logic, with all remote calls going through
 * an injected `remoteAdapter` (see remoteAdapter.js for the real
 * Supabase-backed one) rather than importing @supabase/supabase-js
 * directly. That's what makes this file testable: tests pass a small
 * fake adapter (a plain object backed by an in-memory array) and get
 * real coverage of the merge logic, retry/attempts bookkeeping, and
 * payload shaping - everything except the actual network call, which is
 * the one thing that fundamentally cannot be verified without a live
 * Supabase project (see CHECKPOINT_SUMMARY.md for why).
 */
import { encryptBinary, decryptBinary } from '../utils/crypto.js';
import { decodeYDoc, encodeYDoc, mergeStates } from '../components/editor/yjsUtils.js';
import { binaryPayloadToWire, wirePayloadToBinary } from './payloadCodec.js';

/**
 * Pushes every item currently in the local sync queue. Each item is
 * processed independently - one failure increments that item's
 * `attempts` and leaves it queued for the next pass rather than
 * blocking everything behind it.
 *
 * @returns {Promise<{pushed: number, failed: number}>}
 */
export async function pushPendingChanges(db, remoteAdapter, userId) {
  const queueItems = await db.syncQueue.orderBy('createdAt').toArray();
  const outcome = { pushed: 0, failed: 0 };

  for (const item of queueItems) {
    try {
      if (item.entityType === 'entry') {
        await pushEntry(db, remoteAdapter, userId, item.entityId);
      } else if (item.entityType === 'attachment') {
        await pushAttachment(db, remoteAdapter, userId, item.entityId);
      }
      await db.syncQueue.delete(item.id);
      outcome.pushed += 1;
    } catch {
      await db.syncQueue.update(item.id, { attempts: (item.attempts || 0) + 1 });
      outcome.failed += 1;
    }
  }

  return outcome;
}

async function pushEntry(db, remoteAdapter, userId, localId) {
  const entry = await db.entries.get(localId);
  if (!entry || !entry.remoteId) return; // deleted locally / never got a remoteId - nothing to push

  await remoteAdapter.upsertEntry({
    id: entry.remoteId,
    user_id: userId,
    notebook_id: null,
    title_payload: entry.titlePayload,
    content_payload: binaryPayloadToWire(entry.contentPayload),
    created_at: new Date(entry.createdAt).toISOString(),
    updated_at: new Date(entry.updatedAt).toISOString(),
    is_pinned: Boolean(entry.isPinned),
    is_deleted: Boolean(entry.isDeleted),
  });
  await db.entries.update(entry.id, { syncStatus: 'synced' });
}

async function pushAttachment(db, remoteAdapter, userId, localId) {
  const attachment = await db.attachments.get(localId);
  if (!attachment || !attachment.remoteId) return;

  const parentEntry = await db.entries.get(attachment.entryId);
  if (!parentEntry?.remoteId) return; // parent hasn't synced yet - will retry (parent's push enqueues first)

  // Drawings go through encryptData (already {iv, ciphertext} base64
  // strings); voice notes go through encryptBinary (raw bytes) - only
  // the latter needs the wire conversion.
  const isBinaryPayload = attachment.payload?.ciphertext instanceof ArrayBuffer;
  const wirePayload = isBinaryPayload ? binaryPayloadToWire(attachment.payload) : attachment.payload;

  await remoteAdapter.upsertAttachment({
    id: attachment.remoteId,
    user_id: userId,
    entry_id: parentEntry.remoteId,
    mime_type: attachment.mimeType,
    size_bytes: attachment.sizeBytes || 0,
    payload: wirePayload,
    created_at: new Date(attachment.createdAt).toISOString(),
  });
  await db.attachments.update(attachment.id, { syncStatus: 'synced' });
}

/**
 * Pulls remote entries changed since `sinceIso` and merges each one into
 * local state. An entry that doesn't exist locally yet is simply
 * adopted; one that already exists gets its *content* merged through
 * Yjs (decrypt both sides, CRDT-merge the decoded documents, re-encrypt
 * the result) rather than either side just overwriting the other - this
 * is the actual payoff of using a CRDT instead of last-write-wins.
 * Title is small enough that plain last-write-wins (by timestamp) is a
 * reasonable simplification; CRDT-merging a short string isn't worth
 * the complexity it would add.
 *
 * @returns {Promise<{created: number, merged: number}>}
 */
export async function pullAndMergeEntries(db, remoteAdapter, cryptoKey, userId, sinceIso) {
  const remoteEntries = await remoteAdapter.fetchEntriesSince(userId, sinceIso);
  const outcome = { created: 0, merged: 0 };

  for (const remote of remoteEntries) {
    const local = await db.entries.where('remoteId').equals(remote.id).first();
    const remoteContentLocalShape = wirePayloadToBinary(remote.content_payload);

    if (!local) {
      await db.entries.add({
        notebookId: null,
        type: 'text',
        titlePayload: remote.title_payload,
        contentPayload: remoteContentLocalShape,
        createdAt: new Date(remote.created_at).getTime(),
        updatedAt: new Date(remote.updated_at).getTime(),
        isPinned: remote.is_pinned ? 1 : 0,
        isDeleted: remote.is_deleted ? 1 : 0,
        syncStatus: 'synced',
        remoteId: remote.id,
      });
      outcome.created += 1;
      continue;
    }

    const [localContentBytes, remoteContentBytes] = await Promise.all([
      decryptBinary(local.contentPayload, cryptoKey),
      decryptBinary(remoteContentLocalShape, cryptoKey),
    ]);
    const mergedYdoc = mergeStates(new Uint8Array(localContentBytes), new Uint8Array(remoteContentBytes));
    const mergedContentPayload = await encryptBinary(encodeYDoc(mergedYdoc), cryptoKey);

    const remoteUpdatedAt = new Date(remote.updated_at).getTime();
    const remoteTitleIsNewer = remoteUpdatedAt > local.updatedAt;

    await db.entries.update(local.id, {
      contentPayload: mergedContentPayload,
      titlePayload: remoteTitleIsNewer ? remote.title_payload : local.titlePayload,
      updatedAt: Math.max(local.updatedAt, remoteUpdatedAt),
      isDeleted: remote.is_deleted || local.isDeleted ? 1 : 0,
      syncStatus: 'synced',
    });
    outcome.merged += 1;
  }

  return outcome;
}

/**
 * Attachments are treated as immutable once created (no in-place edits
 * to a drawing or recording, only replacement via inserting a new
 * block) - so "merge" here just means "adopt anything that doesn't
 * exist locally yet," no CRDT needed.
 */
export async function pullNewAttachments(db, remoteAdapter, userId, sinceIso) {
  const remoteAttachments = await remoteAdapter.fetchAttachmentsSince(userId, sinceIso);
  let created = 0;

  for (const remote of remoteAttachments) {
    const existsLocally = await db.attachments.where('remoteId').equals(remote.id).first();
    if (existsLocally) continue;

    const parentEntry = await db.entries.where('remoteId').equals(remote.entry_id).first();
    if (!parentEntry) continue; // entry hasn't been pulled yet - will retry next pass

    const isBinaryMime = remote.mime_type?.startsWith('audio/');
    const payload = isBinaryMime ? wirePayloadToBinary(remote.payload) : remote.payload;

    await db.attachments.add({
      entryId: parentEntry.id,
      mimeType: remote.mime_type,
      sizeBytes: remote.size_bytes || 0,
      payload,
      createdAt: new Date(remote.created_at).getTime(),
      syncStatus: 'synced',
      remoteId: remote.id,
    });
    created += 1;
  }

  return { created };
}

/** Runs a full sync pass: push everything queued, then pull anything new. */
export async function runFullSync(db, remoteAdapter, cryptoKey, userId, lastSyncedAtIso) {
  const pushResult = await pushPendingChanges(db, remoteAdapter, userId);
  const entryResult = await pullAndMergeEntries(db, remoteAdapter, cryptoKey, userId, lastSyncedAtIso);
  const attachmentResult = await pullNewAttachments(db, remoteAdapter, userId, lastSyncedAtIso);
  return { push: pushResult, entries: entryResult, attachments: attachmentResult };
}
