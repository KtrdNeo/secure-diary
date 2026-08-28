import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/schema.js';
import {
  generateSalt,
  deriveKeyFromPassphrase,
  createVerifier,
  verifyPassphrase,
} from '../utils/crypto.js';
import { useSessionKey } from '../session/SessionKeyProvider.jsx';
import styles from './PassphraseGate.module.css';

const MIN_LENGTH = 8;

/**
 * Blocks rendering of `children` until a valid passphrase has derived a
 * session key. First run: create a passphrase (stores only a salt + a
 * verifier blob, never the passphrase itself). Returning: re-derive the
 * key and check it against the stored verifier.
 */
export default function PassphraseGate({ children }) {
  const { cryptoKey, setCryptoKey } = useSessionKey();
  const setupRecord = useLiveQuery(() => db.settings.get('passphraseSetup'), []);

  const [passphrase, setPassphrase] = useState('');
  const [confirmPassphrase, setConfirmPassphrase] = useState('');
  const [showPassphrase, setShowPassphrase] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (cryptoKey) return children;

  const isLoading = setupRecord === undefined;
  const isFirstRun = !isLoading && !setupRecord;
  const inputType = showPassphrase ? 'text' : 'password';

  async function handleCreate(e) {
    e.preventDefault();
    setError('');
    if (passphrase.length < MIN_LENGTH) {
      setError(`Use at least ${MIN_LENGTH} characters - this is the only thing protecting your entries.`);
      return;
    }
    if (passphrase !== confirmPassphrase) {
      setError("Passphrases don't match.");
      return;
    }
    setBusy(true);
    try {
      const salt = generateSalt();
      const key = await deriveKeyFromPassphrase(passphrase, salt);
      const verifier = await createVerifier(key);
      await db.settings.put({ key: 'passphraseSetup', value: { salt, verifier } });
      setCryptoKey(key);
    } catch {
      setError('Something went wrong setting up encryption. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function handleUnlock(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const { salt, verifier } = setupRecord.value;
      const key = await deriveKeyFromPassphrase(passphrase, salt);
      const ok = await verifyPassphrase(key, verifier);
      if (!ok) {
        setError('Incorrect passphrase.');
        setBusy(false);
        return;
      }
      setCryptoKey(key);
    } catch {
      setError('Something went wrong unlocking. Please try again.');
      setBusy(false);
    }
  }

  if (isLoading) {
    return <div className={styles.screen} aria-busy="true" />;
  }

  return (
    <div className={styles.screen}>
      <form
        className={styles.card}
        onSubmit={isFirstRun ? handleCreate : handleUnlock}
      >
        <h1 className={styles.title}>{isFirstRun ? 'Set your passphrase' : 'Unlock your diary'}</h1>

        {isFirstRun && (
          <p className={styles.warning}>
            This passphrase encrypts everything you write. It is never stored anywhere,
            not even here - if you forget it, your entries cannot be recovered by
            anyone, including the developer.
          </p>
        )}

        <label className={styles.label} htmlFor="passphrase">
          Passphrase
        </label>
        <input
          id="passphrase"
          type={inputType}
          className={styles.input}
          value={passphrase}
          onChange={(e) => setPassphrase(e.target.value)}
          autoFocus
          autoComplete={isFirstRun ? 'new-password' : 'current-password'}
        />

        {isFirstRun && (
          <>
            <label className={styles.label} htmlFor="confirm">
              Confirm passphrase
            </label>
            <input
              id="confirm"
              type={inputType}
              className={styles.input}
              value={confirmPassphrase}
              onChange={(e) => setConfirmPassphrase(e.target.value)}
              autoComplete="new-password"
            />
          </>
        )}

        <label className={styles.showToggle}>
          <input
            type="checkbox"
            checked={showPassphrase}
            onChange={(e) => setShowPassphrase(e.target.checked)}
          />
          Show passphrase
        </label>

        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}

        <button type="submit" className={styles.submit} disabled={busy}>
          {busy ? 'Please wait…' : isFirstRun ? 'Create & unlock' : 'Unlock'}
        </button>
      </form>
    </div>
  );
}
