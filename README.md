# SecureDiary

Tactile, skeuomorphic, zero-knowledge encrypted, local-first diary PWA.

Created & developed by Prabhath Kaushalaya, call / WA +94 770020223

## Status: All 6 phases complete

See `CHECKPOINT_SUMMARY.md` for the full build log, key decisions, and
known limitations.

## Deploying

```bash
git push                    # to your own repo
```

**Simplest path (recommended):** import the repo into
[Vercel](https://vercel.com)'s dashboard once - it auto-builds and
deploys on every push after that, using `vercel.json`, no YAML needed.

**`.github/workflows/ci.yml`** runs `npm test` + `npm run build` on
every push/PR automatically, regardless of deploy method - a safety
check, not itself a deploy step.

**`.github/workflows/deploy.yml`** is an *optional* alternative if you
want GitHub Actions to trigger the Vercel deploy directly instead of
using Vercel's dashboard integration - inert until you add three
secrets (see the file's comments) and set repo variable
`ENABLE_VERCEL_DEPLOY=true`. Use this OR the dashboard method, not both.

For sync, add `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` under Vercel's
Project Settings \u2192 Environment Variables (see `.env.example`).

## Getting started (local)

```bash
npm install
npm run dev       # start the dev server
npm test          # run the test suite (76 tests)
npm run build     # production build to dist/
```

First run asks you to set a passphrase — **write it down somewhere safe**.
It's never stored, anywhere, which means it also can't be recovered if
it's lost. Once unlocked: click the folded corner to turn pages, the last
page is always blank and ready to write on, the pill in the top-right
switches themes, and **Search** (top-left) finds entries by content.

In the editor: the toolbar covers bold/italic/headings/lists/checklists
(with a progress bar)/a single-select choice list/tables/callouts, plus
buttons to insert a drawing or a voice note, and a **History** link for
past versions of the entry. Everything autosaves 2 seconds after you
stop typing.

### Optional: multi-device sync

Sync is entirely optional — the app is fully functional offline without
it. To turn it on:

```bash
cp .env.example .env.local
```

1. Create a project at [supabase.com](https://supabase.com)
2. In its SQL editor, run `supabase/schema.sql` from this repo
3. Fill in `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` in `.env.local`
   (Project Settings → API)
4. Restart `npm run dev`, open **Sync** in the footer, create an account

That account only identifies *which encrypted rows are yours* — it's a
separate secret from your diary passphrase and never sees it. **This
integration hasn't been tested against a live Supabase project** (see
`CHECKPOINT_SUMMARY.md` for exactly why and what has been verified
instead) — please try it and report back what breaks.

## Stack

- **React 19 + Vite 8** - app shell and dev/build tooling
- **Tailwind CSS v4** (layout) **+ CSS Modules** (textures/materials)
- **Dexie.js 4** + `dexie-react-hooks` - IndexedDB wrapper, local-first
  storage, reactive queries (`src/db/schema.js`)
- **WebCrypto (AES-GCM-256) + Argon2id via hash-wasm** - zero-knowledge
  client-side encryption, text and binary variants (`src/utils/crypto.js`)
- **Tiptap 3 (ProseMirror) + Yjs** - rich text editor with real CRDT
  content (via `@tiptap/extension-collaboration`), extended with custom
  checklist progress, callouts, a choice-list node, and inline
  drawing/voice-note blocks
- **Hand-built Canvas2D drawing engine** - pressure-sensitive ink,
  Douglas-Peucker stroke simplification, heuristic shape recognition
- **`MediaRecorder` + Web Audio** - voice notes with Opus compression and
  a live level meter, no extra libraries needed
- **FlexSearch** - local, in-memory-only full-text search
- **Supabase (Postgres + Auth)** - optional end-to-end-encrypted sync;
  see `supabase/schema.sql`
- **Fraunces / Source Serif 4 / Work Sans** (self-hosted via `@fontsource`)

## Project layout

```
src/
  utils/crypto.js          Zero-knowledge encryption engine (text + binary)
  db/schema.js               Dexie local database schema (v2: + entryVersions)
  session/                    In-memory session key (never persisted)
  theme/                       Theme tokens, provider, theme list
  search/                       FlexSearch index (in-memory only) + provider
  sync/
    syncEngine.js                Push/pull/CRDT-merge logic (tested)
    remoteAdapter.js               Real Supabase calls (the untested boundary)
    payloadCodec.js, supabaseClient.js, SyncProvider.jsx
  components/
    PassphraseGate.jsx          First-run setup / returning unlock
    SearchPanel.jsx, SyncPanel.jsx
    layout/                      LeatherCover, RingBinder
    pageflip/                     PaperSurface, PageFlipBook
    editor/
      EntryEditor.jsx              Orchestration: title, autosave, attachments
      RichTextEditor.jsx, Toolbar.jsx, VersionHistory.jsx
      yjsUtils.js                   Pure Yjs CRDT helpers (tested)
      extensions/                    Callout, RadioGroup, DrawingBlock, VoiceNoteBlock
    drawing/                       DrawingCanvas, stroke geometry + rendering
    voice/                          VoiceRecorder
    DiaryShell.jsx, ThemeSwitcher.jsx, Footer.jsx, LegalModal.jsx
  App.jsx, main.jsx             Entry point
supabase/schema.sql          Postgres tables + RLS policies
tests/
  crypto.test.mjs, crypto-binary.test.mjs   Encryption (text + binary)
  db.test.mjs                                 Schema, indexes
  theme.test.mjs                               Theme/CSS consistency
  strokeUtils.test.mjs                          Drawing geometry (13 tests)
  docUtils.test.mjs                              Checklist progress logic
  editor-schema.test.mjs                          jsdom Tiptap + Collaboration
  yjsUtils.test.mjs                                CRDT merge correctness (8 tests)
  searchIndex.test.mjs                              FlexSearch wrapper (9 tests)
  payloadCodec.test.mjs                              Sync payload conversion
  syncEngine.test.mjs                                 Push/pull/merge, fake remote
```

## Security model

All encryption happens client-side before anything is written to Dexie or
(in later phases) synced to Supabase. Supabase is designed to never hold
a plaintext note, an encryption key, or the user's passphrase - only
ciphertext. See the header comment in `src/utils/crypto.js` for the exact
algorithm choices and parameters.
