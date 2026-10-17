import { useEffect, useState } from 'react';
import { db } from '../db/schema.js';
import { createStealthVault, removeStealthVault, stealthExists } from '../features/stealth.js';
import styles from './panels.module.css';

/** Settings section (real diary only - never rendered inside the stealth diary). */
export default function StealthSetup() {
  const [exists, setExists] = useState(null);
  const [pass, setPass] = useState('');
  const [confirm, setConfirm] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

  useEffect(() => {
    stealthExists().then(setExists);
  }, []);

  async function create(e) {
    e.preventDefault();
    setMessage('');
    if (pass !== confirm) {
      setMessage("Passphrases don't match.");
      return;
    }
    setBusy(true);
    try {
      const setup = (await db.settings.get('passphraseSetup'))?.value;
      const result = await createStealthVault(pass, setup);
      if (result.ok) {
        setExists(true);
        setPass('');
        setConfirm('');
        setMessage('Stealth vault ready. Unlock with that passphrase to open it and add a few harmless entries.');
      } else {
        setMessage(result.error);
      }
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    await removeStealthVault();
    setExists(false);
    setConfirmRemove(false);
    setMessage('Stealth vault removed.');
    setBusy(false);
  }

  if (exists === null) return null;

  return (
    <section aria-label="Stealth vault">
      <h3 className={styles.sectionTitle}>Stealth vault</h3>
      <p className={styles.note}>
        A second passphrase that opens a separate, empty diary instead of this one - for when someone makes
        you unlock the app. Nothing on screen reveals it. Unlock with it once and write a few ordinary entries
        so it looks lived-in. It protects against people looking over your shoulder, not a forensic
        examination of this device.
      </p>
      {exists ? (
        <div className={styles.row}>
          <p className={styles.note}>A stealth vault is set up.</p>
          {confirmRemove ? (
            <span className={styles.note}>
              Delete it and everything in it?{' '}
              <button type="button" className={styles.button} onClick={remove} disabled={busy}>
                Yes, remove
              </button>{' '}
              <button type="button" className={styles.button} onClick={() => setConfirmRemove(false)}>
                Cancel
              </button>
            </span>
          ) : (
            <button type="button" className={styles.button} onClick={() => setConfirmRemove(true)}>
              Remove stealth vault
            </button>
          )}
        </div>
      ) : (
        <form onSubmit={create}>
          <div className={styles.row}>
            <label htmlFor="stealth-pass">Stealth passphrase</label>
            <input id="stealth-pass" type="password" autoComplete="new-password" className={styles.select} value={pass} onChange={(e) => setPass(e.target.value)} />
            <label htmlFor="stealth-confirm">Confirm</label>
            <input id="stealth-confirm" type="password" autoComplete="new-password" className={styles.select} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            <button type="submit" className={styles.button} disabled={busy || !pass}>
              {busy ? 'Working…' : 'Create stealth vault'}
            </button>
          </div>
        </form>
      )}
      {message && (
        <p className={styles.note} role="status">
          {message}
        </p>
      )}
    </section>
  );
}
