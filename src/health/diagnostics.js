/**
 * src/health/diagnostics.js
 *
 * Local-only health checks - no external telemetry service, on purpose.
 * "DB ping/telemetry" (Feature 6) is interpreted here as diagnostic
 * info displayed TO the person about THEIR OWN local database, never
 * transmitted anywhere - sending usage analytics about a privacy-first
 * encrypted diary to a third party would cut directly against the
 * app's whole premise, spec wording or not.
 *
 * Functions take `db` as a parameter (rather than importing the
 * singleton directly) so tests can exercise them against a fresh
 * fake-indexeddb instance without touching real app state.
 */
import { decryptData, decryptBinary } from '../utils/crypto.js';

/** A trivial round-trip write+read+delete - proves IndexedDB is actually usable right now, not just that db.open() resolved. */
export async function pingDatabase(db) {
  const testKey = `__ping__${Date.now()}`;
  try {
    await db.settings.put({ key: testKey, value: true });
    const readBack = await db.settings.get(testKey);
    await db.settings.delete(testKey);
    return { ok: readBack?.value === true };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}

/** Wraps navigator.storage.estimate() - not available in every browser, so this degrades gracefully. */
export async function getStorageEstimate() {
  if (!navigator.storage?.estimate) return { supported: false };
  try {
    const { usage, quota } = await navigator.storage.estimate();
    return {
      supported: true,
      usageBytes: usage ?? 0,
      quotaBytes: quota ?? 0,
      usagePct: quota ? Math.round(((usage ?? 0) / quota) * 100) : null,
    };
  } catch {
    return { supported: false };
  }
}

export async function getEntryStats(db) {
  const [totalEntries, deletedEntries, attachmentCount, versionCount] = await Promise.all([
    db.entries.count(),
    db.entries.where('isDeleted').equals(1).count(),
    db.attachments.count(),
    db.entryVersions.count(),
  ]);
  return {
    totalEntries,
    liveEntries: totalEntries - deletedEntries,
    deletedEntries,
    attachmentCount,
    versionCount,
  };
}

export async function getSyncQueueStats(db) {
  const items = await db.syncQueue.toArray();
  const stuck = items.filter((i) => (i.attempts || 0) >= 5);
  const oldestCreatedAt = items.length ? Math.min(...items.map((i) => i.createdAt)) : null;
  return {
    pendingCount: items.length,
    stuckCount: stuck.length,
    oldestPendingAgeMs: oldestCreatedAt ? Date.now() - oldestCreatedAt : null,
  };
}

/**
 * Removes sync queue items that have failed repeatedly (5 attempts is
 * a reasonable default, not a spec'd number) rather than retrying
 * forever. The underlying entity keeps its `syncStatus: 'pending'` and
 * will be picked up again on its next edit - this only stops one
 * specific stuck queue row from blocking/retrying indefinitely.
 */
export async function clearStuckSyncQueueItems(db, maxAttempts = 5) {
  const items = await db.syncQueue.toArray();
  const stuckIds = items.filter((i) => (i.attempts || 0) >= maxAttempts).map((i) => i.id);
  if (stuckIds.length > 0) {
    await db.syncQueue.bulkDelete(stuckIds);
  }
  return { cleared: stuckIds.length };
}

/**
 * Attempts to decrypt every entry's title/content to find which, if
 * any, are unreadable - the same failure mode ErrorBoundary's
 * entry-level fallback exists for, surfaced here as an actionable list
 * instead of only appearing one entry at a time as you happen to page
 * to it.
 */
export async function verifyEntryIntegrity(db, cryptoKey) {
  const entries = await db.entries.where('isDeleted').equals(0).toArray();
  const broken = [];

  for (const entry of entries) {
    try {
      if (entry.titlePayload) {
        await decryptData(entry.titlePayload, cryptoKey);
      }
      if (entry.contentPayload) {
        await decryptBinary(entry.contentPayload, cryptoKey);
      }
    } catch {
      broken.push({ id: entry.id, createdAt: entry.createdAt });
    }
  }

  return { checked: entries.length, brokenCount: broken.length, broken };
}

/** Combines every check above into one report for the Admin Dashboard. */
export async function runFullDiagnostics(db, cryptoKey) {
  const [ping, storage, entryStats, syncQueue, integrity] = await Promise.all([
    pingDatabase(db),
    getStorageEstimate(),
    getEntryStats(db),
    getSyncQueueStats(db),
    cryptoKey ? verifyEntryIntegrity(db, cryptoKey) : Promise.resolve(null),
  ]);
  return { ping, storage, entryStats, syncQueue, integrity, ranAt: Date.now() };
}
