/** PWA helpers (pure - take the window-ish object so they are testable). */

export function isStandalone(win = typeof window !== 'undefined' ? window : undefined) {
  if (!win) return false;
  return !!(win.matchMedia?.('(display-mode: standalone)').matches || win.navigator?.standalone === true);
}

export function isIos(ua = typeof navigator !== 'undefined' ? navigator.userAgent : '', maxTouch = typeof navigator !== 'undefined' ? navigator.maxTouchPoints : 0) {
  return /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && maxTouch > 1); // iPadOS reports as Mac
}

/** What the Install panel should offer. */
export function installMode({ standalone, canPrompt, ios }) {
  if (standalone) return 'installed';
  if (canPrompt) return 'prompt';
  if (ios) return 'ios';
  return 'manual';
}

/**
 * Launch params from the manifest: shortcuts (?action=new|search) and the
 * Web Share Target (?share=1&title=&text=&url=). Returns null when nothing to do.
 */
export function parseLaunch(search) {
  const q = new URLSearchParams(search || '');
  const action = q.get('action');
  if (q.get('share') === '1') {
    const parts = ['title', 'text', 'url'].map((k) => (q.get(k) || '').trim()).filter(Boolean);
    const seen = new Set();
    const unique = parts.filter((p) => (seen.has(p) ? false : (seen.add(p), true)));
    return { type: 'share', seedText: unique.join('\n\n').slice(0, 20000) };
  }
  if (action === 'new' || action === 'search') return { type: action };
  return null;
}

export function formatBytes(n) {
  if (!Number.isFinite(n) || n < 0) return '-';
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(0)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(1)} GB`;
}
