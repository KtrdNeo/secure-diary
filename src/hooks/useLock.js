import { useCallback, useEffect, useRef } from 'react';
import { useSessionKey } from '../session/SessionKeyProvider.jsx';
import { db } from '../db/schema.js';
import {
  AUTO_LOCK_SETTING_KEY,
  DEFAULT_AUTO_LOCK_MINUTES,
  SETTINGS_CHANGED_EVENT,
  FLUSH_BEFORE_LOCK_EVENT,
  isIdleLongEnough,
} from '../features/autoLock.js';

const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'touchstart', 'wheel'];

/** Returns lockNow(); also locks automatically after the configured idle time. */
export function useLock() {
  const { lock } = useSessionKey();
  const lastActivity = useRef(Date.now());
  const minutesRef = useRef(DEFAULT_AUTO_LOCK_MINUTES);

  const lockNow = useCallback(async () => {
    const promises = [];
    window.dispatchEvent(new CustomEvent(FLUSH_BEFORE_LOCK_EVENT, { detail: { promises } }));
    await Promise.allSettled(promises);
    lock();
  }, [lock]);

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      db.settings
        .get(AUTO_LOCK_SETTING_KEY)
        .then((rec) => {
          if (!cancelled) minutesRef.current = rec ? rec.value : DEFAULT_AUTO_LOCK_MINUTES;
        })
        .catch(() => {});
    load();
    window.addEventListener(SETTINGS_CHANGED_EVENT, load);

    const touch = () => {
      lastActivity.current = Date.now();
    };
    ACTIVITY_EVENTS.forEach((ev) => window.addEventListener(ev, touch, { passive: true }));

    const check = () => {
      if (isIdleLongEnough(lastActivity.current, Date.now(), minutesRef.current)) lockNow();
    };
    const timer = setInterval(check, 15000);
    // A tab that slept past the limit locks as soon as it wakes.
    const onVisible = () => document.visibilityState === 'visible' && check();
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      clearInterval(timer);
      window.removeEventListener(SETTINGS_CHANGED_EVENT, load);
      ACTIVITY_EVENTS.forEach((ev) => window.removeEventListener(ev, touch));
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [lockNow]);

  return lockNow;
}
