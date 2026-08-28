import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase, isSupabaseConfigured } from './supabaseClient.js';
import { createSupabaseRemoteAdapter } from './remoteAdapter.js';
import { runFullSync } from './syncEngine.js';
import { useSessionKey } from '../session/SessionKeyProvider.jsx';
import { db } from '../db/schema.js';

const SyncContext = createContext(null);

const LAST_SYNCED_SETTINGS_KEY = 'lastSyncedAt';

export function SyncProvider({ children }) {
  const { cryptoKey } = useSessionKey();
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(isSupabaseConfigured);
  const [syncState, setSyncState] = useState('idle'); // idle | syncing | error
  const [lastSyncedAt, setLastSyncedAt] = useState(null);
  const [lastError, setLastError] = useState(null);
  const adapterRef = useRef(null);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setAuthLoading(false);
      return undefined;
    }
    adapterRef.current = createSupabaseRemoteAdapter();

    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setAuthLoading(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    db.settings.get(LAST_SYNCED_SETTINGS_KEY).then((record) => {
      if (record) setLastSyncedAt(record.value);
    });
  }, []);

  const signUp = useCallback(async (email, password) => {
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
  }, []);

  const signIn = useCallback(async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const sync = useCallback(async () => {
    if (!isSupabaseConfigured || !user || !cryptoKey) return;
    setSyncState('syncing');
    setLastError(null);
    try {
      const since = lastSyncedAt || new Date(0).toISOString();
      await runFullSync(db, adapterRef.current, cryptoKey, user.id, since);
      const now = new Date().toISOString();
      await db.settings.put({ key: LAST_SYNCED_SETTINGS_KEY, value: now });
      setLastSyncedAt(now);
      setSyncState('idle');
    } catch (err) {
      setLastError(err?.message || 'Sync failed');
      setSyncState('error');
    }
  }, [user, cryptoKey, lastSyncedAt]);

  const value = {
    configured: isSupabaseConfigured,
    authLoading,
    user,
    signUp,
    signIn,
    signOut,
    sync,
    syncState,
    lastSyncedAt,
    lastError,
  };

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

export function useSync() {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error('useSync must be used within a SyncProvider');
  return ctx;
}
