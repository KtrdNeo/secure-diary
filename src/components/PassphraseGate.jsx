import { useState, useEffect, useRef } from 'react';
import { db, activateDb } from '../db/schema.js';
import { tryStealthUnlock } from '../features/stealth.js';
import {
  generateSalt,
  deriveKeyFromPassphrase,
  createVerifier,
  verifyPassphrase,
} from '../utils/crypto.js';
import { useSessionKey } from '../session/SessionKeyProvider.jsx';
import { importBackup } from '../health/backup.js';
import { throttleDelayMs } from '../features/unlockThrottle.js';
import styles from './PassphraseGate.module.css';

const MIN_LENGTH = 8;

/**
 * Blocks rendering of `children` until a valid passphrase has derived a
 * session key. First run: create a passphrase (stores only a salt + a
 * verifier blob, never the passphrase itself). Returning: re-derive the
 * key and check it against the stored verifier.
 *
 * Fetches the setup record with a plain one-time Promise (useEffect +
 * useState), not dexie-react-hooks' useLiveQuery. This is deliberate,
 * fixed after a real production bug report (not something the Node/
 * jsdom test suite could have caught, since it depends on IndexedDB's
 * live-query/observable behavior in a real browser): this check only
 * ever needs to run once at startup, and the live-query version could
 * apparently get stuck never resolving in at least one real deployment,
 * which - combined with the loading state below previously being a
 * completely empty <div> - produced a permanent blank screen with no
 * console error at all, since nothing ever threw. A one-time fetch is
 * both the more correct tool for a value that's checked once, not
 * subscribed to, AND lets failures be caught and shown explicitly
 * instead of hanging silently forever.
 */
export default function PassphraseGate({ children }) {
  const { cryptoKey, setCryptoKey } = useSessionKey();
  const [setupRecord, setSetupRecord] = useState(undefined); // undefined = loading, null = no record yet, object = found
  const [loadError, setLoadError] = useState(null);

  const [passphrase, setPassphrase] = useState('');
  const [confirmPassphrase, setConfirmPassphrase] = useState('');
  const [showPassphrase, setShowPassphrase] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [failures, setFailures] = useState(0);
  const [waitUntil, setWaitUntil] = useState(0);
  const [now, setNow] = useState(Date.now());
  const fileRef = useRef(null);

  useEffect(() => {
    if (waitUntil <= Date.now()) return undefined;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [waitUntil]);

  useEffect(() => {
    let cancelled = false;
    db.settings
      .get('passphraseSetup')
      .then((record) => {
        if (!cancelled) setSetupRecord(record ?? null);
      })
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.error('PassphraseGate: failed to read setup record:', err);
        if (!cancelled) setLoadError(err?.message || String(err));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Locking (or auto-lock) returns here with the gate still mounted: wipe the
  // typed passphrase so it can never be reused (or resubmitted by mistake).
  useEffect(() => {
    if (!cryptoKey) {
      activateDb('main'); // a stealth session never outlives a lock
      setPassphrase('');
      setConfirmPassphrase('');
      setShowPassphrase(false);
      setError('');
      setNotice('');
      setBusy(false);
    }
  }, [cryptoKey]);

  if (cryptoKey) return children;

  const isLoading = setupRecord === undefined && !loadError;
  const isFirstRun = setupRecord === null;
  const inputType = showPassphrase ? 'text' : 'password';
  const waitSeconds = Math.max(0, Math.ceil((waitUntil - now) / 1000));

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
      // Never overwrite an existing setup: replacing the salt would make every
      // existing entry permanently undecryptable.
      const existing = await db.settings.get('passphraseSetup');
      if (existing) {
        setSetupRecord(existing);
        setPassphrase('');
        setConfirmPassphrase('');
        setError('This diary already has a passphrase - enter it to unlock.');
        setBusy(false);
        return;
      }
      const salt = generateSalt();
      const key = await deriveKeyFromPassphrase(passphrase, salt);
      const verifier = await createVerifier(key);
      const record = { key: 'passphraseSetup', value: { salt, verifier } };
      await db.settings.put(record);
      setSetupRecord(record); // so a later Lock shows the unlock form, not first-run
      setCryptoKey(key);
    } catch {
      setError('Something went wrong setting up encryption. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function handleRestoreFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError('');
    setNotice('');
    setBusy(true);
    try {
      const parsed = JSON.parse(await file.text());
      if (!parsed?.passphraseSetup?.salt) {
        throw new Error(
          'This backup is from an older version and has no passphrase info, so it can only be restored on the device it came from.'
        );
      }
      const result = await importBackup(db, parsed, { mode: 'skip' });
      const rec = await db.settings.get('passphraseSetup');
      if (rec) setSetupRecord(rec);
      setNotice(
        `Restored ${result.entries} entr${result.entries === 1 ? 'y' : 'ies'}. Enter the passphrase you used when the backup was made.`
      );
    } catch (err) {
      setError(`Restore failed: ${err.message}`);
    } finally {
      setBusy(false);
    }
  }

  async function handleUnlock(e) {
    e.preventDefault();
    if (waitUntil > Date.now()) return;
    setError('');
    setBusy(true);
    try {
      const { salt, verifier } = setupRecord.value;
      const key = await deriveKeyFromPassphrase(passphrase, salt);
      const ok = await verifyPassphrase(key, verifier);
      if (!ok) {
        // Not the real passphrase - it may be the stealth one (a separate, harmless diary).
        const stealthKey = await tryStealthUnlock(passphrase);
        if (stealthKey) {
          activateDb('stealth');
          setFailures(0);
          setCryptoKey(stealthKey);
          return;
        }
        const n = failures + 1;
        setFailures(n);
        const delay = throttleDelayMs(n);
        if (delay > 0) {
          setNow(Date.now());
          setWaitUntil(Date.now() + delay);
        }
        setError('Incorrect passphrase.');
        setBusy(false);
        return;
      }
      setFailures(0);
      setCryptoKey(key);
    } catch {
      setError('Something went wrong unlocking. Please try again.');
      setBusy(false);
    }
  }

  if (isLoading) {
    return (
      <div className={styles.screen} aria-busy="true">
        <p className={styles.loadingText}>Opening your diary…</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className={styles.screen}>
        <div className={styles.card}>
          <h1 className={styles.title}>Couldn&rsquo;t open your diary</h1>
          <p className={styles.warning}>
            {loadError} - your entries are untouched either way, this is just a local
            database read that failed. Reloading usually fixes it.
          </p>
          <button type="button" className={styles.submit} onClick={() => window.location.reload()}>
            Reload
          </button>
          <a href="/diagnostics.html" className={styles.diagLink} target="_blank" rel="noopener noreferrer">
            Still stuck? Run diagnostics
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.screen}>
      <form
        className={styles.card}
        onSubmit={isFirstRun ? handleCreate : handleUnlock}
      >
        <div className={styles.intro}>
          <img className={styles.logo} src="/brand-mark.png" alt="" width="64" height="76" draggable="false" />
          <h1 className={styles.title}>{isFirstRun ? 'Set your passphrase' : 'Unlock your diary'}</h1>

          {isFirstRun && (
            <p className={styles.warning}>
              This passphrase encrypts everything you write. It is never stored anywhere,
              not even here - if you forget it, your entries cannot be recovered by
              anyone, including the developer.
            </p>
          )}
        </div>

        <div className={styles.fields}>
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
        {notice && (
          <p className={styles.notice} role="status">
            {notice}
          </p>
        )}
        {waitSeconds > 0 && (
          <p className={styles.error} role="status">
            Too many attempts - try again in {waitSeconds}s.
          </p>
        )}

        <button type="submit" className={styles.submit} disabled={busy || waitSeconds > 0}>
          {busy ? 'Please wait…' : isFirstRun ? 'Create & unlock' : 'Unlock'}
        </button>

        {isFirstRun && (
          <>
            <button type="button" className={styles.linkButton} onClick={() => fileRef.current?.click()} disabled={busy}>
              Already have a backup? Restore it
            </button>
            <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={handleRestoreFile} />
          </>
        )}
        </div>
      </form>
    </div>
  );
}
