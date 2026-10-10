export const AUTO_LOCK_OPTIONS = [
  { minutes: 0, label: 'Off' },
  { minutes: 5, label: '5 minutes' },
  { minutes: 15, label: '15 minutes' },
  { minutes: 30, label: '30 minutes' },
  { minutes: 60, label: '1 hour' },
];
export const DEFAULT_AUTO_LOCK_MINUTES = 15;
export const AUTO_LOCK_SETTING_KEY = 'autoLockMinutes';
export const SETTINGS_CHANGED_EVENT = 'securediary:settings-changed';

export function isIdleLongEnough(lastActivityMs, nowMs, minutes) {
  if (!minutes || minutes <= 0) return false;
  return nowMs - lastActivityMs >= minutes * 60000;
}

/** Fired before any lock so open editors can flush pending autosaves. Listeners push promises to detail.promises. */
export const FLUSH_BEFORE_LOCK_EVENT = 'securediary:flush-before-lock';
