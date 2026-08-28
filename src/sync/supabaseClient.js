import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/**
 * True once VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set (see
 * .env.example). Sync/auth UI checks this and shows a "not configured"
 * state rather than crashing - the app is fully usable locally without
 * either ever being set.
 */
export const isSupabaseConfigured = Boolean(url && anonKey);

export const supabase = isSupabaseConfigured ? createClient(url, anonKey) : null;
