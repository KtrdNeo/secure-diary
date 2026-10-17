import { useState, useEffect, useCallback, useMemo, useRef, lazy, Suspense } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import LeatherCover from './layout/LeatherCover.jsx';
import RingBinder from './layout/RingBinder.jsx';
import PageFlipBook from './pageflip/PageFlipBook.jsx';
import EntryEditor from './editor/EntryEditor.jsx';
import ErrorBoundary from '../health/ErrorBoundary.jsx';
import ThemeSwitcher from './ThemeSwitcher.jsx';
import SearchPanel from './SearchPanel.jsx';
import Footer from './Footer.jsx';
import { stopAmbient } from '../features/ambient.js';
const HelpModal = lazy(() => import('./HelpModal.jsx'));
const StatsPanel = lazy(() => import('./StatsPanel.jsx'));
const SettingsPanel = lazy(() => import('./SettingsPanel.jsx'));
const AdminDashboard = lazy(() => import('./AdminDashboard.jsx'));
const MeshPanel = lazy(() => import('./MeshPanel.jsx'));
const AmbientPanel = lazy(() => import('./AmbientPanel.jsx'));
const ContentsPanel = lazy(() => import('./ContentsPanel.jsx'));
const SecurityPanel = lazy(() => import('./SecurityPanel.jsx'));
const SyncPanel = lazy(() => import('./SyncPanel.jsx'));
const LegalModal = lazy(() => import('./LegalModal.jsx'));
import OverflowMenu from './OverflowMenu.jsx';
import { PlusIcon, SearchIcon, LockIcon, ShieldIcon, ListIcon } from './icons.jsx';
import PrivacyShield from './PrivacyShield.jsx';
import { useMediaQuery } from '../hooks/useMediaQuery.js';
import { useLock } from '../hooks/useLock.js';
import { APP_NAME } from '../config/legal.js';
import { db } from '../db/schema.js';
import styles from './DiaryShell.module.css';

/**
 * The last "page" is always a genuinely blank entry, ready to write on -
 * matching a real diary, where the next blank page is just sitting
 * there. It's identified by a locally-generated draft key rather than a
 * real entry id. Once autosave gives it a real id (via onEntryCreated),
 * a fresh draft key is generated so a brand new, truly-blank instance
 * takes over the slot - the just-saved content shows up as its own
 * ordinary page instead, keyed by its real id. Without this handoff, the
 * same component instance would end up simultaneously representing both
 * "the new blank page" and "the entry it just saved," which is exactly
 * the kind of bug that would only surface after actually writing
 * something, closing the draft, and starting a second entry.
 *
 * Layout: a fixed-height app (100dvh) - slim app bar, the diary filling
 * the middle, a one-line footer. Nothing makes the window itself scroll;
 * only the editor's own page scrolls.
 */
export default function DiaryShell() {
  const [draftKey, setDraftKey] = useState(() => `draft-${Date.now()}`);
  const [searchOpen, setSearchOpen] = useState(false);
  const [jumpToIndex, setJumpToIndex] = useState(null);
  const [panel, setPanel] = useState(null); // 'help' | 'stats' | 'settings' | 'admin' | 'sync' | 'legal' | 'ambient' | 'mesh' | 'contents' | 'security' | null
  const lockNow = useLock();
  const unlockedAt = useRef(Date.now());
  const [pageIndex, setPageIndex] = useState(0);
  const wide = useMediaQuery('(min-width: 720px) and (min-height: 501px)');
  const desktop = useMediaQuery('(min-width: 1024px) and (min-height: 641px)');
  useEffect(() => stopAmbient, []); // silence when the diary locks/unmounts
  const openHelp = useCallback(() => setPanel('help'), []);
  const closePanel = useCallback(() => setPanel(null), []);

  const entries = useLiveQuery(
    () => db.entries.orderBy('createdAt').filter((e) => e.isDeleted === 0).toArray(),
    []
  );

  const pages = useMemo(() => {
    const entryPages = (entries ?? []).map((entry) => (
      <ErrorBoundary key={entry.id} level="entry">
        <EntryEditor entryId={entry.id} onOpenHelp={openHelp} />
      </ErrorBoundary>
    ));
    const draftPage = (
      <ErrorBoundary key={draftKey} level="entry">
        <EntryEditor
          entryId={null}
          onEntryCreated={() => setDraftKey(`draft-${Date.now()}`)}
          onOpenHelp={openHelp}
        />
      </ErrorBoundary>
    );
    return [...entryPages, draftPage];
  }, [entries, draftKey, openHelp]);

  function handleSelectSearchResult(entryId) {
    const index = (entries ?? []).findIndex((e) => e.id === entryId);
    if (index >= 0) setJumpToIndex(index);
  }

  const currentEntryId = (entries ?? [])[pageIndex]?.id ?? null;

  const menuItems = [
    ...(wide
      ? []
      : [
          { key: 'contents', label: 'Contents', onSelect: () => setPanel('contents') },
          { key: 'security', label: 'Security', onSelect: () => setPanel('security') },
        ]),
    { key: 'stats', label: 'Stats & streak', onSelect: () => setPanel('stats') },
    { key: 'mesh', label: 'Connections', onSelect: () => setPanel('mesh') },
    { key: 'ambient', label: 'Ambient sounds', onSelect: () => setPanel('ambient') },
    { key: 'settings', label: 'Settings', onSelect: () => setPanel('settings') },
    { key: 'help', label: 'Help / Getting started', onSelect: () => setPanel('help') },
    { key: 'admin', label: 'Admin (backup, trash, health)', onSelect: () => setPanel('admin') },
    { key: 'sync', label: 'Sync', onSelect: () => setPanel('sync') },
    { key: 'legal', label: 'Legal & About', onSelect: () => setPanel('legal') },
    { key: 'diag', label: 'Diagnostics', href: '/diagnostics.html' },
  ];

  return (
    <div className={styles.app}>
      <header className={styles.appBar}>
        <div className={styles.brand}>
          <img className={styles.brandMark} src="/brand-mark.png" alt="" width="28" height="30" draggable="false" />
          <span className={styles.brandName}>{APP_NAME}</span>
        </div>

        <nav className={styles.actions} aria-label="Diary actions">
          <button type="button" className={styles.pill} onClick={() => setJumpToIndex((entries ?? []).length)} aria-label="New entry">
            <PlusIcon />
            <span className={styles.label}>New entry</span>
          </button>
          <button type="button" className={styles.pill} onClick={() => setSearchOpen(true)} aria-label="Search">
            <SearchIcon />
            <span className={styles.label}>Search</span>
          </button>
          {wide && (
            <button type="button" className={styles.pill} onClick={() => setPanel('contents')} aria-label="Contents">
              <ListIcon />
              <span className={styles.label}>Contents</span>
            </button>
          )}
          {wide && (
            <button type="button" className={styles.pill} onClick={() => setPanel('security')} aria-label="Security">
              <ShieldIcon />
              <span className={styles.label}>Security</span>
            </button>
          )}
          <button type="button" className={styles.pill} onClick={lockNow} aria-label="Lock">
            <LockIcon />
            <span className={styles.label}>Lock</span>
          </button>
          {desktop && <ThemeSwitcher />}
          <OverflowMenu items={menuItems} buttonClassName={styles.pill}>
            {desktop ? null : <ThemeSwitcher variant="menu" />}
          </OverflowMenu>
        </nav>
      </header>

      <main className={styles.stage}>
        <LeatherCover>
          <RingBinder />
          {entries === undefined ? (
            <div className={styles.loading}>Opening your diary…</div>
          ) : (
            <PageFlipBook
              pages={pages}
              fill
              jumpToIndex={jumpToIndex}
              onJumpComplete={() => setJumpToIndex(null)}
              onIndexChange={setPageIndex}
              onOpenContents={() => setPanel('contents')}
            />
          )}
        </LeatherCover>
      </main>

      <Footer onOpenPanel={setPanel} />

      <Suspense fallback={null}>
      {panel === 'help' && <HelpModal onClose={closePanel} />}
      {panel === 'stats' && <StatsPanel onClose={closePanel} />}
      {panel === 'settings' && (
        <SettingsPanel
          onClose={closePanel}
          onLockNow={() => {
            setPanel(null);
            lockNow();
          }}
        />
      )}
      {panel === 'admin' && <AdminDashboard onClose={closePanel} />}
      {panel === 'contents' && (
        <ContentsPanel onClose={closePanel} onOpenEntry={handleSelectSearchResult} currentEntryId={currentEntryId} />
      )}
      {panel === 'security' && (
        <SecurityPanel
          onClose={closePanel}
          unlockedAt={unlockedAt.current}
          onLockNow={() => {
            setPanel(null);
            lockNow();
          }}
          onOpenSettings={() => setPanel('settings')}
        />
      )}
      {panel === 'mesh' && <MeshPanel onClose={closePanel} onOpenEntry={handleSelectSearchResult} />}
      {panel === 'ambient' && <AmbientPanel onClose={closePanel} />}
      {panel === 'sync' && <SyncPanel onClose={closePanel} />}
      {panel === 'legal' && <LegalModal onClose={closePanel} />}
      </Suspense>
      <PrivacyShield />
      {searchOpen && (
        <SearchPanel onSelectEntry={handleSelectSearchResult} onClose={() => setSearchOpen(false)} />
      )}
    </div>
  );
}
