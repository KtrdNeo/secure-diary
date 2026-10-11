import { useState, useMemo, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import LeatherCover from './layout/LeatherCover.jsx';
import RingBinder from './layout/RingBinder.jsx';
import PageFlipBook from './pageflip/PageFlipBook.jsx';
import EntryEditor from './editor/EntryEditor.jsx';
import ErrorBoundary from '../health/ErrorBoundary.jsx';
import ThemeSwitcher from './ThemeSwitcher.jsx';
import SearchPanel from './SearchPanel.jsx';
import Footer from './Footer.jsx';
import HelpModal from './HelpModal.jsx';
import StatsPanel from './StatsPanel.jsx';
import SettingsPanel from './SettingsPanel.jsx';
import AdminDashboard from './AdminDashboard.jsx';
import SyncPanel from './SyncPanel.jsx';
import LegalModal from './LegalModal.jsx';
import OverflowMenu from './OverflowMenu.jsx';
import { PlusIcon, SearchIcon, LockIcon } from './icons.jsx';
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
  const [panel, setPanel] = useState(null); // 'help' | 'stats' | 'settings' | 'admin' | 'sync' | 'legal' | null
  const lockNow = useLock();
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

  const menuItems = [
    { key: 'stats', label: 'Stats & streak', onSelect: () => setPanel('stats') },
    { key: 'help', label: 'Help / Getting started', onSelect: () => setPanel('help') },
    { key: 'settings', label: 'Settings', onSelect: () => setPanel('settings') },
    { key: 'admin', label: 'Admin (backup, trash, health)', onSelect: () => setPanel('admin') },
    { key: 'sync', label: 'Sync', onSelect: () => setPanel('sync') },
    { key: 'legal', label: 'Legal & About', onSelect: () => setPanel('legal') },
    { key: 'diag', label: 'Diagnostics', href: '/diagnostics.html' },
  ];

  return (
    <div className={styles.app}>
      <header className={styles.appBar}>
        <div className={styles.brand}>
          <span className={styles.brandMark} aria-hidden="true" />
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
          <button type="button" className={`${styles.pill} ${styles.desktopOnly}`} onClick={() => setPanel('stats')}>
            Stats
          </button>
          <button type="button" className={`${styles.pill} ${styles.desktopOnly}`} onClick={() => setPanel('help')}>
            Help
          </button>
          <button type="button" className={`${styles.pill} ${styles.desktopOnly}`} onClick={() => setPanel('settings')}>
            Settings
          </button>
          <button type="button" className={styles.pill} onClick={lockNow} aria-label="Lock">
            <LockIcon />
            <span className={styles.label}>Lock</span>
          </button>
          <div className={styles.desktopOnly}>
            <ThemeSwitcher />
          </div>
          <div className={styles.mobileOnly}>
            <OverflowMenu items={menuItems} buttonClassName={styles.pill}>
              <ThemeSwitcher variant="menu" />
            </OverflowMenu>
          </div>
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
            />
          )}
        </LeatherCover>
      </main>

      <Footer onOpenPanel={setPanel} />

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
      {panel === 'sync' && <SyncPanel onClose={closePanel} />}
      {panel === 'legal' && <LegalModal onClose={closePanel} />}
      {searchOpen && (
        <SearchPanel onSelectEntry={handleSelectSearchResult} onClose={() => setSearchOpen(false)} />
      )}
    </div>
  );
}
