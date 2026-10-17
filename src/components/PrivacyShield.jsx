import { useEffect, useState } from 'react';
import { db } from '../db/schema.js';
import { SETTINGS_CHANGED_EVENT } from '../features/autoLock.js';
import { SHIELD_SETTING_KEY, resolveShield, shouldCover } from '../features/privacy.js';
import { LockIcon } from './icons.jsx';
import styles from './PrivacyShield.module.css';

/** Covers the diary while the app is in the background / app switcher (when enabled). */
export default function PrivacyShield() {
  const [enabled, setEnabled] = useState(false);
  const [away, setAway] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const coarse = !!window.matchMedia?.('(pointer: coarse)').matches;
    const load = async () => {
      try {
        const rec = await db.settings.get(SHIELD_SETTING_KEY);
        if (!cancelled) setEnabled(resolveShield(rec?.value, coarse));
      } catch {
        if (!cancelled) setEnabled(resolveShield(undefined, coarse));
      }
    };
    load();
    window.addEventListener(SETTINGS_CHANGED_EVENT, load);
    return () => {
      cancelled = true;
      window.removeEventListener(SETTINGS_CHANGED_EVENT, load);
    };
  }, []);

  useEffect(() => {
    const update = () =>
      setAway(shouldCover({ enabled, hidden: document.visibilityState === 'hidden', focused: document.hasFocus() }));
    update();
    window.addEventListener('blur', update);
    window.addEventListener('focus', update);
    window.addEventListener('pagehide', update);
    document.addEventListener('visibilitychange', update);
    return () => {
      window.removeEventListener('blur', update);
      window.removeEventListener('focus', update);
      window.removeEventListener('pagehide', update);
      document.removeEventListener('visibilitychange', update);
    };
  }, [enabled]);

  if (!away) return null;
  return (
    <div className={styles.shield} role="presentation" onPointerDown={() => setAway(false)}>
      <LockIcon width={34} height={34} />
      <p>SecureDiary is hidden</p>
      <small>Tap to continue</small>
    </div>
  );
}
