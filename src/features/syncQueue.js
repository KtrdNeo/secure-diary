import { db as defaultDb } from '../db/schema.js';

/** Queue an upsert for sync, de-duplicated per entity. */
export async function enqueueSync(entityType, entityId, database = defaultDb) {
  const existing = await database.syncQueue.where({ entityType, entityId }).first();
  if (existing) return;
  await database.syncQueue.add({
    entityType,
    entityId,
    operation: 'upsert',
    createdAt: Date.now(),
    attempts: 0,
  });
}
