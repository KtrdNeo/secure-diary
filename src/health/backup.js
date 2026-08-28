/**
 * src/health/backup.js
 *
 * Exports/imports the entire local database as JSON. Deliberately
 * exports the ciphertext AS-IS rather than decrypting and re-encrypting
 * - the data is already encrypted at rest, so the safest and simplest
 * backup is just "serialize exactly what's already there." A backup
 * file is exactly as safe to store/share as the app's own IndexedDB
 * data: unreadable without the passphrase, useless to anyone who
 * doesn't have it.
 *
 * Binary fields (contentPayload, and attachment payloads that went
 * through encryptBinary) get the same base64 wire conversion the sync
 * engine uses, for the same reason: JSON can't carry raw ArrayBuffers.
 */
import { binaryPayloadToWire, wirePayloadToBinary } from '../sync/payloadCodec.js';

const BACKUP_VERSION = 1;

function isBinaryShape(payload) {
  return payload?.ciphertext instanceof ArrayBuffer;
}

function serializePayload(payload) {
  if (!payload) return null;
  return isBinaryShape(payload) ? { binary: true, ...binaryPayloadToWire(payload) } : { binary: false, ...payload };
}

function deserializePayload(wire) {
  if (!wire) return null;
  const { binary, ...rest } = wire;
  return binary ? wirePayloadToBinary(rest) : rest;
}

export async function exportBackup(db) {
  const [entries, notebooks, attachments, entryVersions] = await Promise.all([
    db.entries.toArray(),
    db.notebooks.toArray(),
    db.attachments.toArray(),
    db.entryVersions.toArray(),
  ]);

  return {
    backupVersion: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    entries: entries.map((e) => ({
      ...e,
      titlePayload: serializePayload(e.titlePayload),
      contentPayload: serializePayload(e.contentPayload),
      payload: serializePayload(e.payload),
    })),
    notebooks,
    attachments: attachments.map((a) => ({ ...a, payload: serializePayload(a.payload) })),
    entryVersions: entryVersions.map((v) => ({ ...v, payload: serializePayload(v.payload) })),
  };
}

/**
 * Restores from a backup object (already JSON.parse'd). `mode`
 * controls what happens on id collisions:
 *  - 'skip' (default): existing local records win, only new ones are added
 *  - 'replace': backup records overwrite local ones with the same id
 * Local auto-increment ids from the backup are reused as-is (Dexie's
 * `put` with an explicit id upserts at that id) - this is meant for
 * restoring onto a fresh/empty database or the same device it came
 * from, not merging two independently-evolved databases (that's what
 * the sync engine's CRDT merge is for).
 */
export async function importBackup(db, backup, { mode = 'skip' } = {}) {
  if (!backup || typeof backup !== 'object' || !Array.isArray(backup.entries)) {
    throw new Error('This file doesn\u2019t look like a SecureDiary backup.');
  }

  const result = { entries: 0, notebooks: 0, attachments: 0, entryVersions: 0, skipped: 0 };

  async function upsertTable(table, rows, countKey) {
    for (const row of rows) {
      const existing = row.id != null ? await table.get(row.id) : null;
      if (existing && mode === 'skip') {
        result.skipped += 1;
        continue;
      }
      await table.put(row);
      result[countKey] += 1;
    }
  }

  const entries = backup.entries.map((e) => ({
    ...e,
    titlePayload: deserializePayload(e.titlePayload),
    contentPayload: deserializePayload(e.contentPayload),
    payload: deserializePayload(e.payload),
  }));
  const attachments = (backup.attachments || []).map((a) => ({ ...a, payload: deserializePayload(a.payload) }));
  const entryVersions = (backup.entryVersions || []).map((v) => ({ ...v, payload: deserializePayload(v.payload) }));

  await upsertTable(db.entries, entries, 'entries');
  await upsertTable(db.notebooks, backup.notebooks || [], 'notebooks');
  await upsertTable(db.attachments, attachments, 'attachments');
  await upsertTable(db.entryVersions, entryVersions, 'entryVersions');

  return result;
}
