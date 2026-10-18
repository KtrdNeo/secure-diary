/** Persistent storage: asks the browser not to evict the diary under storage pressure. */
export function formatBytes(n) {
  const v = Number(n);
  if (!Number.isFinite(v) || v < 0) return '0 B';
  if (v < 1024) return `${Math.round(v)} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let x = v / 1024;
  let i = 0;
  while (x >= 1024 && i < units.length - 1) {
    x /= 1024;
    i += 1;
  }
  return `${x >= 100 ? Math.round(x) : x.toFixed(1)} ${units[i]}`;
}

export async function getStorageStatus(nav = typeof navigator !== 'undefined' ? navigator : undefined) {
  const s = nav?.storage;
  if (!s) return { supported: false, persisted: false, usage: 0, quota: 0 };
  const [persisted, estimate] = await Promise.all([
    s.persisted?.().catch(() => false) ?? false,
    s.estimate?.().catch(() => ({})) ?? {},
  ]);
  return { supported: true, persisted: !!persisted, usage: estimate?.usage || 0, quota: estimate?.quota || 0 };
}

export async function requestPersistence(nav = typeof navigator !== 'undefined' ? navigator : undefined) {
  try {
    if (!nav?.storage?.persist) return false;
    if (await nav.storage.persisted?.()) return true;
    return !!(await nav.storage.persist());
  } catch {
    return false;
  }
}
