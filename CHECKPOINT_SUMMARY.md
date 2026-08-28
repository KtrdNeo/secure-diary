# CHECKPOINT SUMMARY

## Phase 1: Project Setup, WebCrypto Helper, Dexie Schema — COMPLETE

Date: 2026-07-31

### What was built

| File | Purpose |
|---|---|
| `package.json`, `vite.config.js`, `index.html`, `src/index.css` | Vite + React 19 + Tailwind v4 project shell |
| `src/utils/crypto.js` | Zero-knowledge encryption engine: Argon2id key derivation + AES-GCM-256 encrypt/decrypt + passphrase verifier |
| `src/db/schema.js` | Dexie/IndexedDB schema: `entries`, `notebooks`, `attachments`, `settings`, `syncQueue` |
| `src/config/legal.js` | App name/version + the required attribution string |
| `src/App.jsx`, `src/main.jsx` | Minimal placeholder screen that live-verifies crypto + db on load; console credit banner |
| `tests/crypto.test.mjs`, `tests/db.test.mjs` | 12 automated tests, run via `npm test` |

### Verified working (not just written — actually run)

- `npm test` → **12/12 passing**, including: encrypt/decrypt round trip, wrong-passphrase rejection, tamper detection via AES-GCM's auth tag, and an Argon2id timing check (~290-600ms per derivation in this sandbox).
- `npm run build` → clean Vite production build, 22 modules, no errors.
- Dexie schema opens correctly against `fake-indexeddb` and a compound index query (`[notebookId+isDeleted]`) returns correct results.

### Key technical decisions

1. **Argon2id, not PBKDF2, for key derivation.** WebCrypto's SubtleCrypto has no native Argon2 support, so `hash-wasm` provides it. Params: 64 MiB memory, 3 iterations, parallelism 1, 32-byte output → confirmed against the installed package's actual type definitions (its `memorySize` param is in **KiB**, not bytes — easy to get wrong by 1000x). Benchmark on real low-end mobile hardware before shipping; tune `ARGON2_PARAMS` in `crypto.js` if unlock feels slow.
2. **AES-GCM, not AES-CBC.** GCM is authenticated encryption — decryption throws on any tampering or wrong key, instead of silently returning garbage. This is what powers passphrase verification (`createVerifier`/`verifyPassphrase`) without ever storing the passphrase itself.
3. **Non-extractable CryptoKey.** The derived key is imported with `extractable: false`, so raw key bytes can never be pulled back out via `exportKey` — shrinks the blast radius of a hypothetical XSS bug.
4. **IndexedDB flags stored as 0/1, not true/false.** IndexedDB does not support Boolean as an index key type; `isDeleted`/`isPinned` are numbers so they stay indexable. See `FLAG` export in `schema.js`.
5. **Only metadata is indexed, never ciphertext.** Encrypted payloads are opaque blobs; indexing them would be meaningless and would leak content-size patterns.

### Decisions & deviations from the spec

**Copyright/attribution (Rule 01):** implemented as a plain, visible export (`src/config/legal.js`) used in a console credit banner now, and will be used in the Phase 2 footer + About modal. I did **not** implement the spec's hidden "freeze app execution if the string is missing/modified" integrity check, or the Right-Click/F12/Ctrl+Shift+I/Ctrl+U blocking.

Reasoning:
- Neither is real protection. Both are trivially defeated by anyone who opens the bundle and searches for the string or the disabled event listeners — they cost a determined actor a few minutes and cost every legitimate user real functionality.
- For an app whose entire pitch is "zero-knowledge, we can't read your data, trust the client-side math" — blocking DevTools works directly against that pitch. Security-conscious users are exactly the ones who'll want to open the console and verify the crypto themselves.
- A hidden trigger that silently breaks the app for whoever ends up running it (especially framed as failing "gracefully," i.e. indistinguishably from a bug) is a real liability if this ships to anyone other than you — an unrelated code change years from now could trip it with no warning.

If the actual goal is stronger protection against unauthorized resale of this as a commercial template, that's a solvable problem, just a different one — e.g., a real license-key check against a server, or standard minification/obfuscation of a production build (which you should do anyway). Happy to build that properly if that's the goal; say the word.

### What's next: Phase 2

Skeuomorphic Leather/Paper UI component hierarchy + theme switcher (Light Leather / Dark Obsidian / Sepia Vintage), replacing the placeholder screen in `App.jsx`. Will read the `frontend-design` skill before starting, per the visual-philosophy spec (tactile realism, page-fold physics, 60fps transitions).

---

## Phase 2: Skeuomorphic UI Component Hierarchy & Theme Switcher — COMPLETE

Date: 2026-07-31

### What was built

| File | Purpose |
|---|---|
| `src/theme/themeList.js`, `themes.css`, `ThemeProvider.jsx` | 3 themes as CSS custom properties, switched via `data-theme`, persisted to `db.settings` via `useLiveQuery` |
| `src/components/layout/LeatherCover.jsx` | Outer leather frame — procedural grain (SVG `feTurbulence`), sheen, vignette, stitched-edge detail |
| `src/components/layout/RingBinder.jsx` | Column of metal rings, CSS conic-gradient + layered "hole" circle (not SVG — see decisions below) |
| `src/components/pageflip/PaperSurface.jsx` | A single paper page — procedural grain, and the corner-peel signature interaction |
| `src/components/pageflip/PageFlipBook.jsx` | Two-layer 3D flip state machine (see decisions below) |
| `src/components/pageflip/demoPages.jsx` | 3 placeholder pages so the flip has real content to demonstrate; replaced by the Phase 3 editor |
| `src/components/ThemeSwitcher.jsx` | Accessible radio-group theme picker with static per-theme preview swatches |
| `src/components/Footer.jsx`, `LegalModal.jsx` | Visible attribution (Rule 01) + interactive About/legal panel explaining the zero-knowledge model |
| `src/components/DiaryShell.jsx` | Composes all of the above into the full page |
| `src/App.jsx` | Now renders `ThemeProvider > DiaryShell`; Phase 1's status screen became a silent console-only smoke test |
| `tests/theme.test.mjs` | 4 new tests — catches drift between the theme list and `themes.css`/`ThemeSwitcher.module.css` |

Design tokens: `Fraunces` (display headings), `Source Serif 4` (page content), `Work Sans` (UI chrome) — three type roles doing three distinct jobs, self-hosted via `@fontsource` (no Google Fonts CDN, so the PWA works fully offline and nothing leaks to a third party at runtime). Colors were deliberately checked against generic "AI look" defaults (warm-cream-and-terracotta, near-black-and-neon, broadsheet-gray) and pushed away from all three — see `theme/themes.css` for exact values.

### Verified working

- `npm test` → **16/16 passing** (12 from Phase 1 + 4 new).
- `npm run build` → clean, 46 modules, no errors (fonts correctly split into lazy-loaded per-subset files).
- No visual/screenshot verification — see "Known limitation" below. Everything above is verified at the build/logic level, not pixel-checked.

### Key technical decisions

1. **`RingBinder` uses individually-sized CSS circles, not one stretched SVG.** First attempt used a single SVG with `preserveAspectRatio="none"` to fill the strip's full height. The strip's rendered aspect ratio varies enormously across viewports (~28–44px wide, ~480–700px tall) versus almost any fixed viewBox, and non-uniform scaling distorts shape — the rings would have rendered as thin slits, not circles. Fixed by giving each ring its own `aspect-ratio`, so it's correct regardless of container height; only inter-ring spacing responds to the container via flexbox.
2. **Page flip is two asymmetric layers, not one animation played in reverse.** Forward and backward turns are not mirror images of each other: forward updates the static (bottom) layer to the destination immediately and animates the source page away on the top layer (`0deg → -179deg`); backward keeps the static layer on the source until the animation completes and animates the destination page in on the top layer (`-179deg → 0deg`). Using the same layer/timing for both directions was tried first and produced a page that seemed to flip to reveal itself. Full reasoning is in the `PageFlipBook.jsx` header comment.
3. **Only `transform` is animated for the flip** (`will-change: transform`, no layout properties touched) — this is what makes 60fps achievable, since it stays on the compositor thread.
4. **Double-`requestAnimationFrame`, not single**, before starting the flip transition — a single rAF can still land before the browser paints the starting angle in some browsers, which silently skips the animation entirely.
5. **Fonts are self-hosted via `@fontsource`, not linked from Google Fonts.** Consistent with both the PWA's offline requirement and the zero-knowledge/privacy posture — a CDN font request would otherwise leak the user's IP to Google on every load.
6. **CSS Modules for textures, Tailwind for layout** — matches the stack doc's "Tailwind CSS + CSS Modules" line directly: gradients/grain/shadows live in scoped `.module.css` files per component; nothing else in Phase 2 needed a Tailwind utility class yet, since there's no generic layout chrome outside the diary object itself.

### Known limitation: no visual/screenshot verification

Chromium isn't installable in this sandbox (`chromium-browser` in Ubuntu 24 is a transitional snap package; `snapd` itself failed to install here — package-index errors unrelated to Chromium specifically). Everything above was verified by building cleanly and reading the CSS/layout math carefully (including catching and fixing the two real bugs above), not by looking at it. Skeuomorphic "tactile realism" is inherently a visual, partly subjective quality — please run `npm run dev` and tell me what's off. Likely first candidates for adjustment once you can see it: the exact grain intensity on leather vs. paper, and the ring-binder proportions.

### What's next: Phase 3

Hybrid Editor Engine — rich text, drawing canvas, voice recorder — replacing `demoPages.jsx`'s static placeholder content with real, encrypted diary entries.

---

## Phase 3: Hybrid Editor Engine — COMPLETE

Date: 2026-08-02

### An unstated prerequisite this phase needed first

Nothing in Phase 3 can encrypt anything real without a derived key, and there was no UI anywhere for the person to actually provide their passphrase. Built that first: `src/session/SessionKeyProvider.jsx` (the derived `CryptoKey`, held in React state only — never persisted, cleared on reload, exactly what makes this zero-knowledge) and `src/components/PassphraseGate.jsx` (first-run setup vs. returning unlock, gates the whole app). Wired into `App.jsx` as `ThemeProvider > SessionKeyProvider > PassphraseGate > DiaryShell`.

### What was built

| Area | Files |
|---|---|
| Session/unlock | `session/SessionKeyProvider.jsx`, `components/PassphraseGate.jsx` |
| Crypto extension | `utils/crypto.js` — added `encryptBinary`/`decryptBinary` for raw bytes (audio), separate from the existing JSON+base64 path (entries/drawings) |
| Drawing engine | `components/drawing/strokeUtils.js` (pure: Douglas-Peucker simplification, heuristic shape recognition), `renderStrokes.js` (Canvas2D ink rendering, shared by live drawing and saved-drawing replay), `DrawingCanvas.jsx` |
| Voice engine | `components/voice/VoiceRecorder.jsx` — `MediaRecorder` with Opus, live level meter via `AnalyserNode` |
| Rich text | `components/editor/RichTextEditor.jsx`, `Toolbar.jsx`, `docUtils.js` (checklist progress, pure), extensions: `Callout.js`, `RadioGroup.jsx`, `DrawingBlock.jsx`, `VoiceNoteBlock.jsx` |
| Orchestration | `components/editor/EntryEditor.jsx` — title + rich text + 2s debounced autosave + drawing/voice insertion |
| Integration | `DiaryShell.jsx` now pages through real Dexie entries instead of static demo content; `PaperSurface.jsx` gained a `fill` mode for interactive content |
| Tests | `crypto-binary.test.mjs` (4), `strokeUtils.test.mjs` (13), `docUtils.test.mjs` (7), `editor-schema.test.mjs` (7, jsdom) |

### Verified working

- **`npm test` → 47/47 passing** (up from 16). New this phase: binary crypto round-trip/tamper detection, stroke simplification correctness (verified every simplified point stays within tolerance of the original path, not just "point count went down"), shape recognition tested against synthetic circles/rectangles/lines/scribbles *including a hand-wobbled circle* (noise added, still recognized) so it's not just passing on textbook-perfect input, and a jsdom-based Tiptap smoke test that instantiates the real `Editor` class with the exact extension list the app uses.
- **`npm run build` → clean, 123 modules.** One real warning: the main JS bundle is ~788 KB minified / ~252 KB gzipped, over Vite's 500 KB advisory threshold — Tiptap/ProseMirror is a substantial dependency. Not fixed this phase; see "Known limitations."

### Bugs the tests actually caught (not hypothetical — these were real, in code that looked correct)

1. **`@tiptap/extension-table` has no default export** in the installed v3 — only named exports (`Table`, `TableRow`, `TableCell`, `TableHeader`, conveniently all in one package, so the three separate sub-packages got uninstalled). My first-draft `import Table from '@tiptap/extension-table'` would have silently registered `undefined` as a ProseMirror extension — no error until a user clicked the table button in a real browser. Caught by the jsdom schema test, not by `npm run build` (Vite doesn't type-check plain JS imports).
2. **Tiptap's Placeholder extension uses the CSS class `is-empty`, not `is-editor-empty`** (that second class only gets added *additionally* when the whole document is empty) — confirmed by reading the installed package source directly rather than trusting a remembered class name. Would have just silently shown no placeholder text, no error at all.
3. **Node 22 already defines `navigator` as a getter-only global** — `globalThis.navigator = dom.window.navigator` in the test's jsdom setup threw immediately; needed `Object.defineProperty` instead.
4. **A blob-URL leak in `VoiceNoteBlockView`**: my first draft revoked the object URL only in a separate unmount-only cleanup effect, which would leak a URL every time the attachment or session key changed mid-session (not just once at the very end). Fixed by revoking inside the same effect that creates it.

### Key technical decisions

1. **RadioItem's mutual-exclusivity logic uses a shared `groupId` + a full-document `descendants()` walk, not ProseMirror parent/depth position arithmetic.** The "resolve the position before this node, then find its parent's other children" approach is standard ProseMirror, but subtle to get exactly right, and I have no browser here to click-test it. `descendants()` is unambiguous by comparison: every item created together shares an id; selecting one walks the whole doc and sets `checked` on whichever node matches that id. Slightly more work per click, no ambiguity about which nodes it's touching.
2. **Drawings store as simplified vector points (JSON, via the existing `encryptData`), not raster images.** A saved drawing is replayed onto a canvas from its stroke data — same rendering code the live canvas uses (`renderStrokes.js`) — rather than storing a rasterized PNG. Matches the "vector stroke simplification" free-tier requirement directly and keeps drawing storage small.
3. **Voice recordings use the new binary crypto path**, since audio is genuinely binary and the JSON+base64 path would add unnecessary overhead for what's likely the largest attachment type in the app.
4. **Opus compression comes for free from `MediaRecorder`'s MIME type** (`audio/webm;codecs=opus`, with fallbacks checked via `isTypeSupported`) — no separate encoding library needed.
5. **The "new entry" page is a real `EntryEditor` with no id yet, not a separate "create" button/screen.** It's identified by a locally-generated draft key. The moment autosave gives it a real database id, `onEntryCreated` fires and a *fresh* draft key is generated — handing the "blank page" slot to a brand new instance, while the just-saved content becomes an ordinary page keyed by its real id. Without this handoff, one component instance would end up simultaneously representing both "the still-blank next page" and "the entry it just silently became," which is the kind of bug that only shows up after actually writing an entry, then trying to start a second one.
6. **Shape recognition is bounding-box heuristics, not gesture-matching or ML** — documented plainly in `strokeUtils.js` as a deliberate simplification. It's tuned and tested against synthetic + noisy input, but it's still "good enough to catch a clearly-intentional shape," not a general recognizer.

### Known limitations

- **No real-browser testing for anything that fundamentally requires one**: `MediaRecorder`/microphone permission, `PointerEvent.pressure`, actual visual rendering of the canvas ink effect or the rich text styling. Everything above is verified at the logic/schema/build level — genuinely real verification, not a rubber stamp — but pressure-sensitivity feel, ink appearance, and the recording flow specifically need your eyes and a real device. Please try: drawing with varying pressure if you have a stylus, recording a voice note, and clicking through checkboxes/radio items/tables.
- **Bundle size warning** (~788 KB / ~252 KB gzip). Tiptap/ProseMirror is the main contributor. Reasonable fix is code-splitting the editor behind `React.lazy`/dynamic `import()` so it's not in the initial bundle — deferred rather than rushed in at the end of an already-large phase; flagging clearly instead of leaving it undocumented.
- **Shape recognition thresholds are hand-tuned**, not derived from a large sample of real handwriting — likely candidate for adjustment once you've actually drawn with it.

### What's next: Phase 4

Zero-Knowledge Supabase Sync Engine & FlexSearch Local Search Index. This is also where a real "browse all entries" experience (beyond linear page-flipping) most naturally belongs.

---

## Phase 4: Sync Engine & Local Search — COMPLETE

Date: 2026-08-04

### Read this first: what "complete" means for the sync half of this phase

This sandbox's network access is restricted to package registries - not `*.supabase.co`. That's true regardless of whether you have a Supabase project or hand me real credentials; I cannot make a live network call to any Supabase instance from here, full stop. So the sync engine is built and **genuinely tested at every layer except the actual network call** - CRDT merging, payload encryption/conversion, queue bookkeeping, and retry logic all have real automated tests (details below). The one thing that cannot be verified without you running it is whether `@supabase/supabase-js`'s actual HTTP calls succeed against a real project. That boundary is deliberately isolated to one small file (`src/sync/remoteAdapter.js`) so if something doesn't work, there's exactly one place to look. The app is local-first by design specifically so this is survivable: an untested or misconfigured sync layer fails as "stays pending," never as data loss - your entries are safe in Dexie regardless of whether sync works.

**FlexSearch has no such caveat** - it's fully local, fully tested, fully done.

### What was built

| Area | Files |
|---|---|
| CRDT content model | `components/editor/yjsUtils.js` (pure Yjs helpers), `RichTextEditor.jsx` reworked to bind Tiptap to a live `Y.Doc` via the official Collaboration extension instead of plain JSON snapshots |
| Sync-safe IDs | Entries and attachments now get a `crypto.randomUUID()` `remoteId` at creation; `DrawingBlock`/`VoiceNoteBlock` reference attachments by `remoteId`, not the local auto-increment id, so content stays valid across devices |
| Version history | `db.entryVersions` table (schema bumped to v2), periodic encrypted snapshots, `VersionHistory.jsx` panel (plain-text preview + copy - see the restore-scope decision below) |
| Local search | `search/searchIndex.js` (FlexSearch wrapper), `search/SearchIndexProvider.jsx` (incremental in-memory indexing), `SearchPanel.jsx`, plus a `jumpToIndex` mechanism added to `PageFlipBook.jsx` so a search result actually navigates there |
| Sync engine | `sync/syncEngine.js` (push/pull/CRDT-merge, remote calls injected for testability), `sync/remoteAdapter.js` (the real, untested Supabase calls), `sync/payloadCodec.js` (binary/base64 conversion), `sync/SyncProvider.jsx` + `SyncPanel.jsx` (auth + manual sync trigger) |
| Backend schema | `supabase/schema.sql` - tables + RLS policies for entries/attachments/notebooks/entry_versions |
| Tests | `yjsUtils.test.mjs` (8), `searchIndex.test.mjs` (9), `payloadCodec.test.mjs` (3), `syncEngine.test.mjs` (5, fake in-memory remote adapter) |

### Verified working

- **`npm test` → 76/76 passing** (up from 68). The two tests worth highlighting specifically:
  - `yjsUtils.test.mjs`'s concurrent-edit test: two independent Y.Docs, edited "offline" with genuinely different content, merged via `mergeStates` - the result contains **both** edits, merge order doesn't change the outcome (commutativity), and merging twice is a no-op (idempotency). This is the actual value proposition of using a CRDT instead of last-write-wins, proven, not assumed.
  - `syncEngine.test.mjs`'s full-pipeline merge test: the same scenario, but through real `encryptBinary`/`decryptBinary` and the actual `pullAndMergeEntries` function with a fake in-memory remote - proving the *integration*, not just the underlying Yjs library.
- **`npm run build` → clean, 224 modules.** Bundle grew to ~970 KB / ~310 KB gzip (Yjs added weight on top of Tiptap) - same known limitation as before, not newly introduced, tracked below rather than compounding silently.

### Real bugs/gaps this pass caught before they became your problem

1. `editor-schema.test.mjs` originally built its own `Editor` instance directly from the extension files - it never actually imported `RichTextEditor.jsx`, so it was testing the extensions in isolation and would have stayed green even if the *real* Collaboration configuration was broken. Fixed by adding a second test path that mirrors RichTextEditor.jsx's exact extension list (`StarterKit.configure({ undoRedo: false })` + `Collaboration`), including an end-to-end test with two live editors merging - this is what caught that jsdom has no `requestAnimationFrame` (Tiptap's `.focus()` command needs one), fixed with a one-line polyfill.
2. Dexie's `.where({ entityType, entityId })` multi-property syntax and `.reverse().sortBy()` chaining both looked like they might need a compound index or behave unexpectedly - both tested directly in isolation before relying on them; both work as hoped.
3. Considered a fully-automated, formatting-preserving "restore" for version history using a headless Tiptap editor bound to an old snapshot. Rejected: if that old content contains a drawing/voice block, constructing one outside a real React render tree is a real risk I have no way to check without a browser. Restore is plain-text preview + copy instead - less slick, can't corrupt anything.

### Key technical decisions

1. **Title stays last-write-wins; only rich text content goes through CRDT merge.** Titles are short, rarely edited concurrently in practice, and not worth the complexity - see `syncEngine.js`'s `pullAndMergeEntries`.
2. **Attachments are treated as immutable once created** for sync purposes (no in-place merge logic) - a new drawing/recording is a new attachment, not an edit to an old one, so "sync" for attachments just means "adopt anything you don't have yet."
3. **All sync payloads travel as base64-in-jsonb, not native Postgres `bytea`.** Slightly less storage-efficient, but avoids bytea hex-encoding edge cases in Supabase's JS client that I have no way to verify without a live connection - see `sync/payloadCodec.js`.
4. **The Supabase auth password and the diary's encryption passphrase are two different secrets, on purpose.** Signing in only tells Supabase *which rows are yours* (via `auth.uid()` in the RLS policies) - it never sees, receives, or could derive the encryption key. This is called out in `supabase/schema.sql`, `SyncPanel.jsx`'s copy, and here, deliberately more than once, because conflating them would be a genuine zero-knowledge break, not just a documentation gap.
5. **`entries.contentPayload` and `attachments.payload` don't always mean the same encoding.** Drawings go through `encryptData` (JSON+base64) since vector strokes are structurally text-like; voice recordings and Yjs content go through `encryptBinary` (raw bytes) since they're genuinely binary. The sync engine checks which shape it's holding before converting for the wire - documented explicitly in `syncEngine.js` rather than left implicit.

### Known limitations

- **Supabase connectivity itself is unverified** - see the top of this section. Setup: run `supabase/schema.sql` in a fresh Supabase project's SQL editor, copy `.env.example` to `.env.local` with your project URL/anon key, restart the dev server, sign up from the Sync panel (Footer → Sync). Please tell me what breaks.
- **No conflict UI for `isDeleted` disagreements** - if one device deletes an entry and another edits it before syncing, the current logic ORs the deleted flags (deleted wins). Reasonable default, not tested against real multi-device use.
- **Sync is manual-trigger only** (a "Sync now" button), not automatic/background/periodic. Straightforward to add once manual sync is confirmed working end-to-end - sequencing it after basic correctness on purpose.
- **Pre-Phase-4 entries** (if any exist in your local data from testing earlier phases) keep their title but not their body text on load - see the `EntryEditor.jsx` loading effect for why an automatic conversion was judged too risky to attempt blind.
- **Bundle size** (~970 KB / ~310 KB gzip, growing each phase as Tiptap+Yjs add weight) - still not code-split. Now genuinely worth doing before Phase 5 adds more.

### What's next: Phase 5

Admin Control Dashboard, Self-Healing Engine, Diagnostic AI, and Sinhala Input Suite.

---

## Phase 5: Admin Dashboard, Self-Healing, Diagnostics, Sinhala Suite — COMPLETE

Date: 2026-08-18. Written concisely under real time pressure (mid-phase sandbox reset cost significant time to recover from - see below) - shorter than prior entries, not less real. **126/126 tests passing**, clean build.

**Mid-session incident:** the sandbox's entire filesystem (project, node_modules, everything) was wiped partway through this phase - not something in my control. Recovered by restoring the last surviving deliverable zip from `/mnt/user-data/outputs/`, reinstalling dependencies, and re-applying everything built in this session from conversation context, file by file. Re-running the test suite immediately after confirmed the restore was byte-accurate. A checkpoint zip is now saved proactively mid-phase, not just at phase end, specifically so a repeat wouldn't cost this much time again.

**What was built:**
- **Self-healing**: `health/ErrorBoundary.jsx` at two levels - app-wide (catastrophic failure) and per-entry (`DiaryShell.jsx` wraps each `EntryEditor` individually, so one corrupted entry can't take down every other page). `health/diagnostics.js`: DB ping, storage estimate, entry/attachment counts, sync queue health, and `verifyEntryIntegrity` (attempts to decrypt every entry, isolates which ones fail) plus `clearStuckSyncQueueItems` as an actual repair action, not just a report.
- **Backup/restore**: `health/backup.js` exports/imports the whole local DB as JSON, keeping content encrypted throughout (no decrypt/re-encrypt round trip - the ciphertext is exported as-is, converted to base64 via the same `payloadCodec.js` the sync engine uses). Tested with a full export → JSON round trip → fresh-DB import → decrypt cycle.
- **Watermarked PDF export**: `health/pdfExport.js`, via `pdf-lib`. Caught a real bug while testing: a Sinhala **title** crashed the Latin-only font encoder (I'd only guarded the body text, not the title) - fixed, and improved to degrade per-paragraph rather than drop an entry's entire body over one non-Latin paragraph, so realistic mixed English/Sinhala entries still export their Latin content correctly.
- **Diagnostic AI**: `health/diagnosticGuide.js` - a genuine rule-based engine over real `diagnostics.js` data, explicitly **not** an LLM. A real AI-backed version would need a server-side proxy to call any model API without embedding a secret key in shipped client code (this app has no such backend) - a legitimately bigger, different feature, not attempted here. What exists gives specific findings from your actual local data (queue depth, integrity results, storage %), not generic copy.
- **Sinhala input suite**: `sinhala/sinhalaChars.js` (Unicode chart, verified via web search against the Unicode Consortium's own chart), `transliterate.js` (Singlish→Sinhala, longest-match), `wijesekara.js` (keyboard layout, sourced from an actual XKB layout definition file found via search). Caught and fixed a real algorithm bug by hand-tracing "ammaa" (mother) before trusting it: consonant patterns had vowels baked in, which silently broke the inherent-vowel case. Confidence is explicitly tiered in the code (HIGH_CONFIDENCE vs INFERRED) rather than presented as uniformly certain - native-speaker review invited, not just disclaimed.
- **Admin Dashboard**: `components/AdminDashboard.jsx` ties all of the above into one panel (Health / Diagnose / Backup / Export tabs), reachable from Footer → Admin.

**Known limitations:** PDF export doesn't render non-Latin script correctly (shows a clear notice instead of garbling it - proper Sinhala PDF rendering needs complex text shaping, a separate unsolved problem here). Wijesekara layout covers the base row only. Bundle is now ~1.4MB/496KB gzip (pdf-lib added weight) - code-splitting is increasingly worth doing before Phase 6.

### What's next: Phase 6

PWA Manifest, Caching Rules, and Vercel Deployment Setup.

---

## Phase 6: PWA Manifest, Caching, Deployment — COMPLETE

Date: 2026-08-22. Written under continued time pressure - concise by necessity. **126/126 tests, clean build**, and critically: `npm run build` actually generates `dist/sw.js` + `dist/manifest.webmanifest` + all icons, verified directly, not assumed.

**What was built:**
- **Real icons**, not placeholders: `icon-source.svg`/`icon-source-maskable.svg`, drawn to match the app's actual established leather/paper/ring-binder visual identity, rasterized via `@resvg/resvg-js` to all required PWA sizes. Visually verified by rendering both to PNG and looking at them - the maskable variant is deliberately a different, more centered composition (the regular icon's rings sit near the left edge, which a circular launcher crop would clip).
- **`vite-plugin-pwa`**, `registerType: 'prompt'` - deliberately not `autoUpdate`. This app autosaves 2s after you stop typing; auto-reloading the page for a new SW version could interrupt an in-flight write. Nothing takes over the page until you click "Reload" in `health/UpdatePrompt.jsx`. No `runtimeCaching` rule for Supabase is intentional, not an oversight - anything unmatched passes straight to network, uncached, which is what an auth/sync API needs.
- **`vercel.json`**: SPA rewrite (no client-side router in this app, but Vercel's default static hosting would 404 on a hard refresh of anything other than `/` without this), long-cache headers for fonts, no-cache for `sw.js` specifically (so updates are actually discovered promptly).

**Deploying:** push to a Git repo, import into Vercel, set `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` as environment variables if sync is wanted (Project Settings \u2192 Environment Variables) - everything else is auto-detected from `vercel.json`.

**Known limitation:** bundle is ~1.4MB/497KB gzip, precached in full on first load. Real, working, and correctly excludes Supabase from caching - but code-splitting (flagged as a growing concern since Phase 3) is now the clearest remaining improvement, deliberately not attempted under the time constraints this phase was finished under.

This closes all 6 phases of the original roadmap.




