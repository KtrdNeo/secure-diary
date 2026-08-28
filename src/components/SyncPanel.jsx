import { useState } from 'react';
import { useSync } from '../sync/SyncProvider.jsx';
import styles from './SyncPanel.module.css';

export default function SyncPanel({ onClose }) {
  const { configured, authLoading, user, signUp, signIn, signOut, sync, syncState, lastSyncedAt, lastError } =
    useSync();
  const [mode, setMode] = useState('signIn'); // 'signIn' | 'signUp'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError('');
    setBusy(true);
    try {
      if (mode === 'signUp') {
        await signUp(email, password);
      } else {
        await signIn(email, password);
      }
    } catch (err) {
      setFormError(err?.message || 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.overlay} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.panel} role="dialog" aria-modal="true" aria-label="Sync settings">
        <div className={styles.header}>
          <h2 className={styles.title}>Sync</h2>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        {!configured && (
          <div>
            <p className={styles.hint}>
              Sync isn&rsquo;t set up yet. This needs a Supabase project - see <code>README.md</code>{' '}
              for setup steps (run <code>supabase/schema.sql</code>, then add your project URL and
              anon key to <code>.env.local</code>).
            </p>
            <p className={styles.hint}>
              Everything works fully offline without this - sync only adds multi-device access.
            </p>
          </div>
        )}

        {configured && authLoading && <p className={styles.hint}>Loading…</p>}

        {configured && !authLoading && !user && (
          <form onSubmit={handleSubmit}>
            <p className={styles.hint}>
              This is a separate account from your diary passphrase - it only identifies which
              encrypted rows are yours. It never sees your passphrase or your entries in
              readable form.
            </p>
            <label className={styles.label} htmlFor="sync-email">
              Email
            </label>
            <input
              id="sync-email"
              type="email"
              className={styles.input}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <label className={styles.label} htmlFor="sync-password">
              Password
            </label>
            <input
              id="sync-password"
              type="password"
              className={styles.input}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            {formError && (
              <p className={styles.error} role="alert">
                {formError}
              </p>
            )}
            <button type="submit" className={styles.submit} disabled={busy}>
              {busy ? 'Please wait…' : mode === 'signUp' ? 'Create account' : 'Sign in'}
            </button>
            <button
              type="button"
              className={styles.switchMode}
              onClick={() => setMode((m) => (m === 'signUp' ? 'signIn' : 'signUp'))}
            >
              {mode === 'signUp' ? 'Already have an account? Sign in' : 'New here? Create an account'}
            </button>
          </form>
        )}

        {configured && !authLoading && user && (
          <div>
            <p className={styles.hint}>Signed in as {user.email}</p>
            <p className={styles.hint}>
              {syncState === 'syncing'
                ? 'Syncing…'
                : lastSyncedAt
                  ? `Last synced ${new Date(lastSyncedAt).toLocaleString()}`
                  : 'Never synced yet'}
            </p>
            {syncState === 'error' && (
              <p className={styles.error} role="alert">
                {lastError}
              </p>
            )}
            <button type="button" className={styles.submit} onClick={sync} disabled={syncState === 'syncing'}>
              Sync now
            </button>
            <button type="button" className={styles.switchMode} onClick={signOut}>
              Sign out
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
