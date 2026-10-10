import { enqueueSync } from './syncQueue.js';

export async function softDeleteEntry(db, id) {
  await db.entries.update(id, { isDeleted: 1, updatedAt: Date.now(), syncStatus: 'pending' });
  await enqueueSync('entry', id, db);
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
