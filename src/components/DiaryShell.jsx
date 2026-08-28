import { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import LeatherCover from './layout/LeatherCover.jsx';
import RingBinder from './layout/RingBinder.jsx';
import PageFlipBook from './pageflip/PageFlipBook.jsx';
import EntryEditor from './editor/EntryEditor.jsx';
import ErrorBoundary from '../health/ErrorBoundary.jsx';
import ThemeSwitcher from './ThemeSwitcher.jsx';
import SearchPanel from './SearchPanel.jsx';
import Footer from './Footer.jsx';
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
 */
export default function DiaryShell() {
  const [draftKey, setDraftKey] = useState(() => `draft-${Date.now()}`);
  const [searchOpen, setSearchOpen] = useState(false);
  const [jumpToIndex, setJumpToIndex] = useState(null);

  const entries = useLiveQuery(
    () => db.entries.orderBy('createdAt').filter((e) => e.isDeleted === 0).toArray(),
    []
  );

  const pages = useMemo(() => {
    const entryPages = (entries ?? []).map((entry) => (
      <ErrorBoundary key={entry.id} level="entry">
        <EntryEditor entryId={entry.id} />
      </ErrorBoundary>
    ));
    const draftPage = (
      <ErrorBoundary key={draftKey} level="entry">
        <EntryEditor entryId={null} onEntryCreated={() => setDraftKey(`draft-${Date.now()}`)} />
      </ErrorBoundary>
    );
    return [...entryPages, draftPage];
  }, [entries, draftKey]);

  function handleSelectSearchResult(entryId) {
    const index = (entries ?? []).findIndex((e) => e.id === entryId);
    if (index >= 0) setJumpToIndex(index);
  }

  return (
    <div className={styles.backdrop}>
      <div className={styles.stage}>
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

        <button type="button" className={styles.searchButton} onClick={() => setSearchOpen(true)}>
          Search
        </button>

        <div className={styles.switcherSlot}>
          <ThemeSwitcher />
        </div>
      </div>

      <Footer />

      {searchOpen && (
        <SearchPanel onSelectEntry={handleSelectSearchResult} onClose={() => setSearchOpen(false)} />
      )}
    </div>
  );
}
