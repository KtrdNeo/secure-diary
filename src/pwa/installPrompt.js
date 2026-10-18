/**
 * Install-to-home-screen support. The `beforeinstallprompt` event fires early,
 * so this module is imported from main.jsx to catch it before React mounts.
 */
let deferred = null;
let installed = false;
const listeners = new Set();
const emit = () => listeners.forEach((fn) => fn(getInstallState()));

export function detectIOS(ua = '', platform = '', maxTouchPoints = 0) {
  return /iphone|ipad|ipod/i.test(ua) || (platform === 'MacIntel' && maxTouchPoints > 1);
}

/**
 * Which browser is this iOS device using? On iOS every browser is WebKit, and
 * Safari / Chrome / Firefox / Edge (iOS 16.4+) can Add to Home Screen from their
 * Share menu, but another app's built-in browser ("inapp") cannot.
 */
export function detectIOSBrowser(ua = '') {
  if (/FBAN|FBAV|FB_IAB|Instagram|Line\/|MicroMessenger|Snapchat|musical_ly|TikTok|Twitter|LinkedInApp|Pinterest/i.test(ua)) return 'inapp';
  if (/CriOS/i.test(ua)) return 'chrome';
  if (/FxiOS/i.test(ua)) return 'firefox';
  if (/EdgiOS/i.test(ua)) return 'edge';
  if (/Safari\//i.test(ua)) return 'safari';
  return 'inapp'; // a WebKit view with no "Safari" token is an embedded web view
}

export function detectIPad(ua = '', platform = '', maxTouchPoints = 0) {
  return /ipad/i.test(ua) || (platform === 'MacIntel' && maxTouchPoints > 1);
}

export function isStandalone(win = typeof window !== 'undefined' ? window : undefined) {
  if (!win) return false;
  return !!(win.matchMedia?.('(display-mode: standalone)').matches || win.navigator?.standalone === true);
}

export function getInstallState() {
  const standalone = isStandalone();
  const ios = typeof navigator !== 'undefined' && detectIOS(navigator.userAgent, navigator.platform, navigator.maxTouchPoints);
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  return {
    standalone,
    iosBrowser: ios ? detectIOSBrowser(ua) : null,
    ipad: ios ? detectIPad(ua, navigator.platform, navigator.maxTouchPoints) : false,
    canPrompt: !!deferred && !standalone && !installed,
    iosHint: ios && !standalone && !installed, // iOS has no prompt API: show "Add to Home Screen" steps
  };
}

export function subscribeInstall(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export async function promptInstall() {
  if (!deferred) return 'unavailable';
  const evt = deferred;
  deferred = null;
  evt.prompt();
  const { outcome } = await evt.userChoice;
  if (outcome === 'accepted') installed = true;
  emit();
  return outcome;
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e;
    emit();
  });
  window.addEventListener('appinstalled', () => {
    installed = true;
    deferred = null;
    emit();
  });
}
