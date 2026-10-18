/**
 * Persistent storage: without it the browser may evict IndexedDB under disk
 * pressure - for a local-first diary that would mean losing entries.
 */
export async function requestPersistence(nav = typeof navigator !== 'undefined' ? navigator : undefined) {
  try {
    if (!nav?.storage?.persist) return { supported: false, persisted: false };
    if (await nav.storage.persisted?.()) return { supported: true, persisted: true };
    return { supported: true, persisted: !!(await nav.storage.persist()) };
  } catch {
    return { supported: false, persisted: false };
  }
}

export async function getStorageStatus(nav = typeof navigator !== 'undefined' ? navigator : undefined) {
  const out = { supported: !!nav?.storage?.persisted, persisted: false, usage: null, quota: null };
  try {
    out.persisted = !!(await nav?.storage?.persisted?.());
    const est = await nav?.storage?.estimate?.();
    if (est) {
      out.usage = est.usage ?? null;
      out.quota = est.quota ?? null;
    }
  } catch {
    /* leave defaults */
  }
  return out;
}
