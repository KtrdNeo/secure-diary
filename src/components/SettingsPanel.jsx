import { useEffect, useState } from 'react';
import Modal from './Modal.jsx';
import { db } from '../db/schema.js';
import {
  AUTO_LOCK_OPTIONS,
  AUTO_LOCK_SETTING_KEY,
  DEFAULT_AUTO_LOCK_MINUTES,
  SETTINGS_CHANGED_EVENT,
} from '../features/autoLock.js';
import styles from './panels.module.css';

export default function SettingsPanel({ onClose, onLockNow }) {
  const [minutes, setMinutes] = useState(null);

  useEffect(() => {
    let cancelled = false;
    db.settings.get(AUTO_LOCK_SETTING_KEY).then((rec) => {
      if (!cancelled) setMinutes(rec ? rec.value : DEFAULT_AUTO_LOCK_MINUTES);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function change(e) {
    const value = Number(e.target.value);
    setMinutes(value);
    await db.settings.put({ key: AUTO_LOCK_SETTING_KEY, value });
    window.dispatchEvent(new Event(SETTINGS_CHANGED_EVENT));
  }

  return (
    <Modal title="Settings" onClose={onClose}>
      <div className={styles.row}>
        <label htmlFor="autolock">Auto-lock after inactivity</label>
        <select id="autolock" className={styles.select} value={minutes ?? ''} onChange={change} disabled={minutes === null}>
          {AUTO_LOCK_OPTIONS.map((o) => (
            <option key={o.minutes} value={o.minutes}>
              {o.label}
            </option>
          ))}
        </select>
        <span className={styles.note}>
          When locked, the key is wiped from memory and your passphrase is needed again.
        </span>
      </div>
      <div className={styles.row}>
        <button type="button" className={styles.button} onClick={onLockNow}>
          Lock now
        </button>
      </div>
      <p className={styles.note}>Theme: use the switcher at the top right of the diary.</p>
    </Modal>
  );
}
