import { createContext, useContext, useState, useCallback } from 'react';

/**
 * Holds the derived CryptoKey for this session, in React state only.
 * Never written to Dexie, localStorage, or anywhere else persistent -
 * that's what makes this zero-knowledge. A page reload clears it, which
 * is intentional: the passphrase must be re-entered every session.
 */
const SessionKeyContext = createContext(null);

export function SessionKeyProvider({ children }) {
  const [cryptoKey, setCryptoKey] = useState(null);
  const lock = useCallback(() => setCryptoKey(null), []);

  return (
    <SessionKeyContext.Provider value={{ cryptoKey, setCryptoKey, lock }}>
      {children}
    </SessionKeyContext.Provider>
  );
}

export function useSessionKey() {
  const ctx = useContext(SessionKeyContext);
  if (!ctx) throw new Error('useSessionKey must be used within a SessionKeyProvider');
  return ctx;
}
