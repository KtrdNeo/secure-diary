/** Battery Saver: 'auto' (low battery / reduced-motion), 'on', or 'off'. */
export const SAVER_SETTING_KEY = 'batterySaver';
export const SAVER_OPTIONS = [
  { value: 'auto', label: 'Automatic (low battery or reduced motion)' },
  { value: 'on', label: 'Always on' },
  { value: 'off', label: 'Off (full animations)' },
];
export const LOW_BATTERY_LEVEL = 0.2;

/**
 * @param {'auto'|'on'|'off'} setting
 * @param {{level:number, charging:boolean}|null} battery
 * @param {boolean} reducedMotion
 */
export function resolveSaver(setting, battery, reducedMotion) {
  if (setting === 'on') return true;
  if (setting === 'off') return false;
  if (reducedMotion) return true;
  return !!battery && !battery.charging && battery.level <= LOW_BATTERY_LEVEL;
}
