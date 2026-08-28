/**
 * src/db/schema.js
 *
 * Local-first IndexedDB schema, via Dexie.js.
 *
 * Zero-knowledge boundary: every table below stores its real content as
 * encrypted payload field(s) produced by src/utils/crypto.js - never as
 * plaintext. `entries` specifically stores TWO payloads: `titlePayload`
 * (small, text, via encryptData) and `contentPayload` (the entry's Yjs
 * CRDT state, via encryptBinary - see components/editor/yjsUtils.js).
 * `attachments.payload` holds either an encryptData JSON blob (drawing
 * vector strokes) or an encryptBinary blob (audio), depending on
 * mimeType. None of these are indexed - you cannot meaningfully index
 * ciphertext, and doing so would leak content length/shape patterns.
 * Only structural metadata (timestamps, type, sync bookkeeping) is
 * indexed, which is what powers sorting/filtering in the UI without
 * ever touching plaintext.
 *
 * IndexedDB key-type note: IndexedDB does not support Boolean as an
 * index key type. Flags below (isDeleted, isPinned) are stored as the
 * numbers 0/1, not true/false, so they remain indexable.
 */

import Dexie from 'dexie';

export const db = new Dexie('SecureDiaryDB');

db.version(1).stores({
  // Diary/note entries. `titlePayload` + `contentPayload` = encrypted
  // (see top-of-file comment for the split). Compound index
  // [notebookId+isDeleted] powers the common "list live entries in this
  // notebook" query without a full scan.
  entries:
    '++id, notebookId, type, createdAt, updatedAt, isPinned, isDeleted, syncStatus, remoteId, [notebookId+isDeleted]',

  // Notebooks / folders entries can be grouped into.
  notebooks: '++id, createdAt, updatedAt, order, isDeleted, syncStatus, remoteId',

  // Binary attachments (drawing canvases, voice recordings) linked to an
  // entry. `payload` = encrypted blob. mimeType/sizeBytes stay in
  // plaintext deliberately - needed for storage-usage UI and gallery
  // thumbnails without decrypting every attachment just to list them.
  attachments: '++id, entryId, mimeType, sizeBytes, createdAt, syncStatus, remoteId',

  // Local key-value settings store (theme, autosave interval, etc.).
  // Anything sensitive (e.g. the panic-vault decoy PIN) must be
  // encrypted by the caller BEFORE being written here - this table
  // itself applies no encryption of its own.
  settings: 'key',

  // Outbox for the Phase 4 sync engine: queued local mutations waiting
  // to be pushed to Supabase once the device is back online.
  syncQueue: '++id, entityType, entityId, operation, createdAt, attempts',
});

// Phase 4: entries' content is now a Yjs CRDT document (see
// components/editor/yjsUtils.js) rather than a plain JSON snapshot - purely a
// change in what bytes `entries.contentPayload` holds, not an indexed
// field, so no migration logic is needed for that part. What DOES need
// a new table is version history: periodic encrypted snapshots of an
// entry's Yjs state, kept separately so browsing/restoring old versions
// doesn't require decrypting every version just to list them by date.
// Purely additive (new table, no changes to existing ones) - Dexie
// carries all existing local data forward automatically.
db.version(2).stores({
  entryVersions: '++id, entryId, createdAt',
});

/**
 * Convenience flag constants, since IndexedDB indexes need 0/1 rather
 * than true/false (see note above).
 */
export const FLAG = Object.freeze({ FALSE: 0, TRUE: 1 });

/** 'pending' -> queued locally, not yet pushed. 'synced' -> confirmed on
 *  the server. 'conflict' -> Phase 4's CRDT merge needs to resolve this. */
export const SYNC_STATUS = Object.freeze({
  PENDING: 'pending',
  SYNCED: 'synced',
  CONFLICT: 'conflict',
});

export default db;
