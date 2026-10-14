import { useState } from 'react';
import { db } from '../db/schema.js';
import { changePassphrase, MIN_PASSPHRASE_LENGTH } from '../features/rekey.js';
import { FLUSH_BEFORE_LOCK_EVENT } from '../features/autoLock.js';
import styles from './panels.module.css';

/** Settings section: re-encrypts the whole diary under a new passphrase, then locks. */
export default function ChangePassphrase({ onDone }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (next.length < MIN_PASSPHRASE_LENGTH) {
      setError(`Use at least ${MIN_PASSPHRASE_LENGTH} characters.`);
      return;
    }
    if (next !== confirm) {
      setError("New passphrases don't match.");
      return;
    }
    setBusy(true);
    try {
      // Save any pending autosave under the OLD key before re-encrypting.
      const promises = [];
      window.dispatchEvent(new CustomEvent(FLUSH_BEFORE_LOCK_EVENT, { detail: { promises } }));
      await Promise.allSettled(promises);
      await changePassphrase(db, { currentPassphrase: current, newPassphrase: next });
      setDone(true);
      setCurrent('');
      setNext('');
      setConfirm('');
      setTimeout(() => onDone?.(), 1500);
    } catch (err) {
      setError(err.message || 'Could not change the passphrase.');
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} aria-label="Change passphrase">
      <div className={styles.row}>
        <strong>Change passphrase</strong>
        <span className={styles.note}>
          Re-encrypts every entry, drawing, recording and version on this device. Download a backup first
          (Admin &rarr; Backup). Other devices that sync must use the new passphrase afterwards.
        </span>
        <label htmlFor="cp-current">Current passphrase</label>
        <input id="cp-current" type="password" className={styles.input} value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" />
        <label htmlFor="cp-new">New passphrase</label>
        <input id="cp-new" type="password" className={styles.input} value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" />
        <label htmlFor="cp-confirm">Confirm new passphrase</label>
        <input id="cp-confirm" type="password" className={styles.input} value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
      </div>
      {error && <p className={styles.errorText} role="alert">{error}</p>}
      {done && <p className={styles.okText} role="status">Done - locking so you can unlock with the new passphrase.</p>}
      <button type="submit" className={styles.button} disabled={busy || !current || !next || !confirm}>
        {busy && !done ? 'Re-encrypting…' : 'Change passphrase'}
      </button>
    </form>
  );
}
