import { useEffect } from 'react';
import { db } from '../db/schema.js';
import { SETTINGS_CHANGED_EVENT } from '../features/autoLock.js';
import { SAVER_SETTING_KEY, resolveSaver } from '../features/performance.js';

/** Sets <html data-saver="on|off"> from the Battery Saver setting + live battery state. */
export function usePerformanceMode() {
  useEffect(() => {
    let battery = null;
    let setting = 'auto';
    let cancelled = false;
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const apply = () => {
      document.documentElement.dataset.saver = resolveSaver(setting, battery, !!mq?.matches) ? 'on' : 'off';
    };
    const load = async () => {
      try {
        const rec = await db.settings.get(SAVER_SETTING_KEY);
        if (!cancelled) setting = rec?.value ?? 'auto';
      } catch {
        /* keep default */
      }
      apply();
    };
    load();
    window.addEventListener(SETTINGS_CHANGED_EVENT, load);
    mq?.addEventListener?.('change', apply);
    navigator.getBattery?.().then((b) => {
      if (cancelled) return;
      battery = b;
      b.addEventListener('levelchange', apply);
      b.addEventListener('chargingchange', apply);
      apply();
    }).catch(() => {});
    return () => {
      cancelled = true;
      window.removeEventListener(SETTINGS_CHANGED_EVENT, load);
      mq?.removeEventListener?.('change', apply);
    };
  }, []);
}
