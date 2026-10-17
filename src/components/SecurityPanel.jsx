import { useEffect, useState } from 'react';
import Modal from './Modal.jsx';
import { db } from '../db/schema.js';
import { useSync } from '../sync/SyncProvider.jsx';
import { isSupabaseConfigured } from '../sync/supabaseClient.js';
import { AUTO_LOCK_SETTING_KEY, DEFAULT_AUTO_LOCK_MINUTES, SETTINGS_CHANGED_EVENT } from '../features/autoLock.js';
import { SHIELD_SETTING_KEY, resolveShield } from '../features/privacy.js';
import { ShieldIcon } from './icons.jsx';
import styles from './panels.module.css';

function Row({ ok = true, title, children }) {
  return (
    <li className={styles.secItem}>
      <span className={ok ? styles.secOk : `${styles.secOk} ${styles.secWarn}`} aria-hidden="true">
        <ShieldIcon width={18} height={18} />
      </span>
      <strong className={styles.secTitle}>{title}</strong>
      <span className={styles.secBody}>{children}</span>
    </li>
  );
}

/** One-glance security status + the two controls people actually reach for. */
export default function SecurityPanel({ onClose, onLockNow, onOpenSettings, unlockedAt }) {
  const sync = useSync();
  const [minutes, setMinutes] = useState(DEFAULT_AUTO_LOCK_MINUTES);
  const [shield, setShield] = useState(false);
  const [counts, setCounts] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [lock, sh, total] = await Promise.all([
        db.settings.get(AUTO_LOCK_SETTING_KEY),
        db.settings.get(SHIELD_SETTING_KEY),
        db.entries.where('isDeleted').equals(0).count(),
      ]);
      if (cancelled) return;
      setMinutes(lock ? lock.value : DEFAULT_AUTO_LOCK_MINUTES);
      setShield(resolveShield(sh?.value, !!window.matchMedia?.('(pointer: coarse)').matches));
      setCounts(total);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function toggleShield(e) {
    setShield(e.target.checked);
    await db.settings.put({ key: SHIELD_SETTING_KEY, value: e.target.checked });
    window.dispatchEvent(new Event(SETTINGS_CHANGED_EVENT));
  }

  const syncOn = isSupabaseConfigured && !!sync?.user;

  return (
    <Modal title="Security" subtitle="Everything below is checked on this device." onClose={onClose}>
      <ul className={styles.secList}>
        <Row title="End-to-end encrypted">
          Entries, titles, drawings and recordings are sealed with AES-GCM-256 before they are stored. Your key
          comes from your passphrase (Argon2id) and lives only in memory.
        </Row>
        <Row title="Stored on this device">
          {counts === null ? 'Counting…' : `${counts} entr${counts === 1 ? 'y' : 'ies'}`} kept locally. The key is
          never written to disk, so closing or locking the diary wipes it.
        </Row>
        <Row title={syncOn ? 'Sync on (ciphertext only)' : 'Sync off'}>
          {syncOn
            ? 'Only encrypted data is sent; the server cannot read your diary.'
            : 'Nothing leaves this device. Turn on sync from the menu if you want a backup in the cloud.'}
        </Row>
        <Row ok={minutes > 0} title={minutes > 0 ? `Auto-lock after ${minutes} min` : 'Auto-lock is off'}>
          {minutes > 0 ? 'The key is wiped when you are away.' : 'Anyone with this open screen can read your diary.'}{' '}
          <button type="button" className={styles.linkBtn} onClick={onOpenSettings}>
            Change
          </button>
        </Row>
        {unlockedAt && (
          <Row title="This session">Unlocked at {new Date(unlockedAt).toLocaleTimeString()}.</Row>
        )}
      </ul>
      <label className={styles.toggleRow}>
        <input type="checkbox" checked={shield} onChange={toggleShield} />
        Hide the diary when I switch apps or tabs
      </label>
      <div className={styles.row}>
        <button type="button" className={styles.button} onClick={onLockNow}>
          Lock now
        </button>
      </div>
    </Modal>
  );
}
