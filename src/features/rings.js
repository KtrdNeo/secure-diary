/** Binder ring sizing: rings are ALWAYS circles; only their number and spacing adapt. */
export const RING_MIN = 12;
export const RING_MAX = 34;
export const MIN_RINGS = 2;
export const MAX_RINGS = 9;

export function ringDiameter(columnWidth) {
  const d = Math.floor((Number(columnWidth) || 0) * 0.8);
  return Math.min(RING_MAX, Math.max(RING_MIN, d));
}

/** How many rings fit in `columnHeight` with at least ~1.3 ring-diameters of leather between them. */
export function ringCount(columnHeight, diameter) {
  const usable = Math.max(0, (Number(columnHeight) || 0) * 0.9);
  const per = diameter * 2.3;
  const n = Math.floor(usable / per);
  return Math.min(MAX_RINGS, Math.max(MIN_RINGS, n));
}
