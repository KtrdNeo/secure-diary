/**
 * src/sync/remoteAdapter.js
 *
 * The one file in the sync engine that actually talks to Supabase. This
 * is the genuinely untestable boundary flagged throughout this phase -
 * everything that COULD be tested without a live backend (queue
 * bookkeeping, retry logic, payload shaping, the Yjs merge itself) lives
 * in syncEngine.js instead and has real test coverage. This file is
 * deliberately kept to plain, boring, straight-off-the-documentation
 * PostgREST calls - each one a direct match to a table/policy in
 * supabase/schema.sql - specifically to minimize how much unverified
 * surface area exists. If something here doesn't work, it should be
 * obvious which single call to look at.
 */
import { supabase } from './supabaseClient.js';

export function createSupabaseRemoteAdapter() {
  return {
    async upsertEntry(row) {
      const { error } = await supabase.from('entries').upsert(row);
      if (error) throw error;
    },

    async upsertAttachment(row) {
      const { error } = await supabase.from('attachments').upsert(row);
      if (error) throw error;
    },

    async fetchEntriesSince(userId, sinceIso) {
      const { data, error } = await supabase
        .from('entries')
        .select('*')
        .eq('user_id', userId)
        .gte('updated_at', sinceIso);
      if (error) throw error;
      return data;
    },

    async fetchAttachmentsSince(userId, sinceIso) {
      const { data, error } = await supabase
        .from('attachments')
        .select('*')
        .eq('user_id', userId)
        .gte('created_at', sinceIso);
      if (error) throw error;
      return data;
    },
  };
}
