-- SecureDiary Supabase schema
--
-- Run this in the Supabase SQL editor (or via `supabase db push` if using
-- the CLI) on a fresh project. Every payload column is ciphertext the
-- client produced with WebCrypto before it ever reached here - Postgres
-- (and therefore Supabase, and therefore its operators) never sees
-- plaintext, an encryption key, or the passphrase that derives one.
--
-- IMPORTANT - two different secrets, do not confuse them:
--   1. Supabase Auth email/password: authenticates WHICH ROWS are yours
--      (via auth.uid() in the RLS policies below). Supabase knows this.
--   2. The diary's own passphrase (Phase 3's PassphraseGate): derives
--      the AES key. NEVER sent here, in any form, ever. Supabase has no
--      way to know it and no way to decrypt anything below even with
--      full database access.
--
-- All payload columns are `jsonb` holding {"iv": "<base64>", "ciphertext":
-- "<base64>"} - base64/JSON rather than native `bytea`, deliberately: it
-- travels over Supabase's REST/JS client (which is JSON-based) without
-- any bytea hex-encoding edge cases to get wrong somewhere I can't test.
-- See src/sync/payloadCodec.js for the ArrayBuffer <-> base64 conversion
-- used for binary-origin content (Yjs state, audio) at the sync boundary.

create table if not exists public.notebooks (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  name_payload jsonb not null,
  "order" integer not null default 0,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  is_deleted boolean not null default false
);

create table if not exists public.entries (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  notebook_id uuid references public.notebooks (id) on delete set null,
  title_payload jsonb not null,
  -- The entry's Yjs CRDT state (see src/components/editor/yjsUtils.js).
  -- This is the one column where "merge" doesn't mean "last write
  -- wins" - the sync processor decodes both sides and merges via Yjs
  -- before writing back, which is what makes concurrent edits from two
  -- devices safe instead of one silently clobbering the other.
  content_payload jsonb not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  is_pinned boolean not null default false,
  is_deleted boolean not null default false
);

create table if not exists public.attachments (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  entry_id uuid not null references public.entries (id) on delete cascade,
  mime_type text not null,
  size_bytes integer not null default 0,
  payload jsonb not null,
  created_at timestamptz not null
);

create table if not exists public.entry_versions (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  entry_id uuid not null references public.entries (id) on delete cascade,
  payload jsonb not null,
  created_at timestamptz not null
);

create index if not exists notebooks_user_id_idx on public.notebooks (user_id);
create index if not exists entries_user_id_idx on public.entries (user_id);
create index if not exists entries_notebook_id_idx on public.entries (notebook_id);
create index if not exists attachments_user_id_idx on public.attachments (user_id);
create index if not exists attachments_entry_id_idx on public.attachments (entry_id);
create index if not exists entry_versions_entry_id_idx on public.entry_versions (entry_id);

alter table public.notebooks enable row level security;
alter table public.entries enable row level security;
alter table public.attachments enable row level security;
alter table public.entry_versions enable row level security;

-- One row-owns-itself policy per table: a signed-in user can only ever
-- see or modify rows where user_id matches their own auth.uid(). This
-- is defense in depth on top of the encryption, not a substitute for
-- it - RLS stops one user from reading/deleting another user's rows at
-- all (ciphertext or not); it was never meant to be the only thing
-- standing between an attacker and plaintext.
create policy "Users manage their own notebooks" on public.notebooks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users manage their own entries" on public.entries
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users manage their own attachments" on public.attachments
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users manage their own entry_versions" on public.entry_versions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
