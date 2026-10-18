import { enqueueSync } from './syncQueue.js';

export async function softDeleteEntry(db, id) {
  await db.entries.update(id, { isDeleted: 1, updatedAt: Date.now(), syncStatus: 'pending' });
  await enqueueSync('entry', id, db);
}
/** Bring one entry back from the trash (it returns to its original place in the diary). */
export async function restoreEntry(db, id) {
  await db.entries.update(id, { isDeleted: 0, updatedAt: Date.now(), syncStatus: 'pending' });
  await enqueueSync('entry', id, db);
}
/** Entries currently in the trash, newest deletion first. */
export async function listDeleted(db) {
  const rows = await db.entries.where('isDeleted').equals(1).toArray();
  return rows.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
}
export async function countDeleted(db) {
  return db.entries.where('isDeleted').equals(1).count();
}
export async function restoreDeletedEntries(db) {
  const rows = await db.entries.where('isDeleted').equals(1).toArray();
  for (const r of rows) {
    await db.entries.update(r.id, { isDeleted: 0, updatedAt: Date.now(), syncStatus: 'pending' });
    await enqueueSync('entry', r.id, db);
  }
  return rows.length;
}

/** Permanently remove the given trashed entries (with their attachments and version history). Local only. */
export async function purgeEntries(db, ids) {
  if (!ids.length) return 0;
  let removed = 0;
  await db.transaction('rw', [db.entries, db.attachments, db.entryVersions, db.syncQueue], async () => {
    const trashed = await db.entries.where('id').anyOf(ids).filter((e) => e.isDeleted === 1).primaryKeys();
    if (!trashed.length) return;
    removed = trashed.length;
    ids = trashed;
    await db.attachments.where('entryId').anyOf(ids).delete();
    await db.entryVersions.where('entryId').anyOf(ids).delete();
    const attachmentIdsLeft = new Set((await db.attachments.toArray()).map((a) => a.id));
    const stale = await db.syncQueue.toArray();
    const toDrop = stale
      .filter((q) => (q.entityType === 'entry' && ids.includes(q.entityId)) || (q.entityType === 'attachment' && !attachmentIdsLeft.has(q.entityId)))
      .map((q) => q.id);
    if (toDrop.length) await db.syncQueue.bulkDelete(toDrop);
    await db.entries.bulkDelete(ids);
  });
  return removed;
}

/** Permanently remove everything in the trash. */
export async function purgeDeletedEntries(db) {
  const rows = await db.entries.where('isDeleted').equals(1).toArray();
  return purgeEntries(db, rows.map((r) => r.id));
}
