/**
 * Escalating pause after repeated wrong passphrases (a speed bump on top of
 * Argon2id, not a security boundary - it lives in memory only).
 * 1-2 failures: none; then 2s, 4s, 8s ... capped at 30s.
 */
export function throttleDelayMs(failures) {
  if (failures < 3) return 0;
  return Math.min(30000, 1000 * 2 ** (failures - 2));
}
