/** Privacy shield: hide the diary while the app is in the background / app switcher. */
export const SHIELD_SETTING_KEY = 'privacyShield';

/** Touch devices default ON (app-switcher thumbnails); desktops default OFF. */
export function defaultShield(coarsePointer) {
  return !!coarsePointer;
}

export function resolveShield(stored, coarsePointer) {
  return typeof stored === 'boolean' ? stored : defaultShield(coarsePointer);
}

export function shouldCover({ enabled, hidden, focused }) {
  return !!enabled && (!!hidden || !focused);
}
