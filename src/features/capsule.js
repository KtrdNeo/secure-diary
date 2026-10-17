/**
 * Time Capsule: an entry can be sealed until a date. The date is stored
 * INSIDE the encrypted title payload ({ title, sealUntil }), so it syncs and
 * stays private. It is a commitment device, not cryptography - the author
 * can always open early (with a confirmation).
 */
const DAY = 86400000;

export function isSealed(sealUntil, now = Date.now()) {
  return typeof sealUntil === 'number' && Number.isFinite(sealUntil) && sealUntil > now;
}

/** 'YYYY-MM-DD' (from <input type=date>) -> local midnight at the START of that day, or null. */
export function parseSealDate(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || '');
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 0, 0, 0, 0);
  return Number.isNaN(d.getTime()) ? null : d.getTime();
}

export function toDateInputValue(ms) {
  const d = new Date(ms);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Earliest allowed seal date = tomorrow (local). */
export function minSealDate(now = Date.now()) {
  return toDateInputValue(now + DAY);
}

export function isValidSealTarget(ms, now = Date.now()) {
  return typeof ms === 'number' && ms > now;
}

export function describeRemaining(sealUntil, now = Date.now()) {
  const days = Math.ceil((sealUntil - now) / DAY);
  if (days <= 1) return 'opens tomorrow';
  if (days < 60) return `opens in ${days} days`;
  const months = Math.round(days / 30.4);
  return months < 24 ? `opens in about ${months} months` : `opens in about ${Math.round(months / 12)} years`;
}
