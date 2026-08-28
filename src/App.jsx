import { useEffect } from 'react';
import { ThemeProvider } from './theme/ThemeProvider.jsx';
import { SessionKeyProvider } from './session/SessionKeyProvider.jsx';
import { SearchIndexProvider } from './search/SearchIndexProvider.jsx';
import { SyncProvider } from './sync/SyncProvider.jsx';
import PassphraseGate from './components/PassphraseGate.jsx';
import DiaryShell from './components/DiaryShell.jsx';
import ErrorBoundary from './health/ErrorBoundary.jsx';
import UpdatePrompt from './health/UpdatePrompt.jsx';
import { generateSalt, deriveKeyFromPassphrase, encryptData, decryptData } from './utils/crypto.js';
import { db } from './db/schema.js';

// Quiet, console-only regression check for the crypto/db foundation -
// uses its own throwaway key, entirely independent of the real
// passphrase/session key. The real safety net is `npm test`; this is
// just a live signal in the browser that nothing broke.
function useFoundationSmokeTest() {
  useEffect(() => {
    (async () => {
      try {
        const salt = generateSalt();
        const key = await deriveKeyFromPassphrase('smoke-test', salt);
        const decrypted = await decryptData(await encryptData({ ok: true }, key), key);
        await db.open();
        // eslint-disable-next-line no-console
        console.log(
          `%cFoundation check: crypto ${decrypted.ok ? 'OK' : 'FAILED'}, db ${db.isOpen() ? 'OK' : 'FAILED'}`,
          'color:#888;font-size:11px;'
        );
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Foundation check failed:', err);
      }
    })();
  }, []);
}

export default function App() {
  useFoundationSmokeTest();

  return (
    <ErrorBoundary level="app">
      <ThemeProvider>
        <SessionKeyProvider>
          <PassphraseGate>
            <SearchIndexProvider>
              <SyncProvider>
                <DiaryShell />
              </SyncProvider>
            </SearchIndexProvider>
          </PassphraseGate>
        </SessionKeyProvider>
      </ThemeProvider>
      <UpdatePrompt />
    </ErrorBoundary>
  );
}
