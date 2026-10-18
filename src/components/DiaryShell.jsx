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
const TrashPanel = lazy(() => import('./TrashPanel.jsx'));
import OverflowMenu from './OverflowMenu.jsx';
import { PlusIcon, SearchIcon, LockIcon, ShieldIcon, ListIcon, TrashIcon, InstallIcon } from './icons.jsx';
import Modal from './Modal.jsx';
import { softDeleteEntry, restoreEntry } from '../features/trash.js';
import panelStyles from './panels.module.css';
import PrivacyShield from './PrivacyShield.jsx';
import InstallHelp from './InstallHelp.jsx';
import InstallBanner from './InstallBanner.jsx';
import { useOnline } from '../hooks/useOnline.js';
import { getInstallState, promptInstall, subscribeInstall } from '../pwa/installPrompt.js';
import { parseLaunchParams, shareToContent } from '../pwa/launch.js';
import { requestPersistence } from '../pwa/storage.js';
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
  const [panel, setPanel] = useState(null); // 'help' | 'stats' | 'settings' | 'admin' | 'sync' | 'legal' | 'ambient' | 'mesh' | 'contents' | 'security' | 'install' | 'trash' | null
  const lockNow = useLock();
  const unlockedAt = useRef(Date.now());
  const [pageIndex, setPageIndex] = useState(0);
  const online = useOnline();
  const [install, setInstall] = useState(getInstallState);
  useEffect(() => subscribeInstall(setInstall), []);
  // Manifest shortcuts (?action=) and Web Share Target (?title&text&url): read once at launch.
  const launchRef = useRef(null);
  if (launchRef.current === null) launchRef.current = parseLaunchParams(window.location.search);
  const [prefill, setPrefill] = useState(() => {
    const sh = launchRef.current.share;
    return sh ? shareToContent(sh) : null;
  });
  // Ask the browser to keep the diary safe from automatic cleanup.
  useEffect(() => {
    requestPersistence();
  }, []);
  // Delete flow: confirm -> move to trash -> "Undo" toast (8s).
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [toast, setToast] = useState(null); // { id } of the page just trashed
  const [pendingJumpId, setPendingJumpId] = useState(null);
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
        <EntryEditor entryId={entry.id} onOpenHelp={openHelp} onRequestDelete={setConfirmDeleteId} />
      </ErrorBoundary>
    ));
    const draftPage = (
      <ErrorBoundary key={draftKey} level="entry">
        <EntryEditor
          entryId={null}
          onEntryCreated={() => setDraftKey(`draft-${Date.now()}`)}
          onOpenHelp={openHelp}
          onRequestDelete={setConfirmDeleteId}
          prefill={prefill}
          onPrefillUsed={() => setPrefill(null)}
        />
      </ErrorBoundary>
    );
    return [...entryPages, draftPage];
  }, [entries, draftKey, openHelp, prefill]);

  function handleSelectSearchResult(entryId) {
    const index = (entries ?? []).findIndex((e) => e.id === entryId);
    if (index >= 0) setJumpToIndex(index);
  }

  async function confirmDelete() {
    const id = confirmDeleteId;
    setConfirmDeleteId(null);
    if (id == null) return;
    await softDeleteEntry(db, id);
    setToast({ id });
  }

  async function undoDelete() {
    const t = toast;
    setToast(null);
    if (!t) return;
    await restoreEntry(db, t.id);
    setPendingJumpId(t.id);
  }

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(null), 8000);
    return () => clearTimeout(timer);
  }, [toast]);

  // After an undo, flip to the restored page once the live list contains it again.
  useEffect(() => {
    if (pendingJumpId == null || !entries) return;
    const i = entries.findIndex((e) => e.id === pendingJumpId);
    if (i >= 0) {
      setJumpToIndex(i);
      setPendingJumpId(null);
    }
  }, [pendingJumpId, entries]);

  // Apply a launch shortcut / share once the entries have loaded, then tidy the URL.
  const launchDone = useRef(false);
  useEffect(() => {
    if (launchDone.current || entries === undefined) return;
    launchDone.current = true;
    const { action, share } = launchRef.current;
    if (share || action === 'new') setJumpToIndex(entries.length);
    else if (action === 'search') setSearchOpen(true);
    else if (action === 'contents') setPanel('contents');
    if (action || share) window.history.replaceState(null, '', window.location.pathname);
  }, [entries]);

  // One "Install" action everywhere: the real prompt where the browser offers it, a guided sheet on iOS.
  const canInstall = install.canPrompt || install.iosHint;
  const handleInstall = useCallback(() => {
    if (install.canPrompt) promptInstall();
    else setPanel('install');
  }, [install.canPrompt]);

  const currentEntryId = (entries ?? [])[pageIndex]?.id ?? null;

  const menuItems = [
    ...(wide
      ? []
      : [
          { key: 'contents', label: 'Contents', onSelect: () => setPanel('contents') },
          { key: 'security', label: 'Security', onSelect: () => setPanel('security') },
        ]),
    ...(canInstall ? [{ key: 'install', label: 'Install app', onSelect: handleInstall }] : []),
    ...(!wide && currentEntryId != null
      ? [{ key: 'delete', label: 'Delete this page', danger: true, onSelect: () => setConfirmDeleteId(currentEntryId) }]
      : []),
    { key: 'trash', label: 'Trash', onSelect: () => setPanel('trash') },
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
          {!online && (
            <span className={styles.offline} role="status" title="You are offline - everything is saved on this device">
              <span className={styles.offlineDot} aria-hidden="true" />
              <span className={styles.offlineText}>Offline</span>
            </span>
          )}
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
          {wide && canInstall && (
            <button type="button" className={styles.pill} onClick={handleInstall} aria-label="Install app">
              <InstallIcon />
              <span className={styles.label}>Install</span>
            </button>
          )}
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
          {wide && (
            <button
              type="button"
              className={`${styles.pill} ${styles.pillDanger}`}
              onClick={() => setConfirmDeleteId(currentEntryId)}
              disabled={currentEntryId == null}
              aria-label="Delete this page"
              title="Delete this page"
            >
              <TrashIcon />
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

      {canInstall && <InstallBanner onInstall={handleInstall} />}

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
      {panel === 'trash' && <TrashPanel onClose={closePanel} />}
      {panel === 'install' && <InstallHelp onClose={closePanel} browser={install.iosBrowser ?? 'safari'} ipad={install.ipad} />}
      {panel === 'mesh' && <MeshPanel onClose={closePanel} onOpenEntry={handleSelectSearchResult} />}
      {panel === 'ambient' && <AmbientPanel onClose={closePanel} />}
      {panel === 'sync' && <SyncPanel onClose={closePanel} />}
      {panel === 'legal' && <LegalModal onClose={closePanel} />}
      </Suspense>
      {confirmDeleteId != null && (
        <Modal title="Move this page to trash?" onClose={() => setConfirmDeleteId(null)}>
          <p className={panelStyles.note}>
            The page disappears from your diary but stays encrypted in the Trash, where you can restore it
            or erase it forever.
          </p>
          <div className={panelStyles.trashFooter}>
            <button type="button" className={panelStyles.smallButton} onClick={() => setConfirmDeleteId(null)}>
              Cancel
            </button>
            <button type="button" className={panelStyles.dangerButton} onClick={confirmDelete}>
              Move to trash
            </button>
          </div>
        </Modal>
      )}
      {toast && (
        <div className={styles.toast} role="status">
          <span>Page moved to trash</span>
          <button type="button" className={styles.toastButton} onClick={undoDelete}>
            Undo
          </button>
          <button
            type="button"
            className={styles.toastButton}
            onClick={() => {
              setToast(null);
              setPanel('trash');
            }}
          >
            View trash
          </button>
        </div>
      )}
      <PrivacyShield />
      {searchOpen && (
        <SearchPanel onSelectEntry={handleSelectSearchResult} onClose={() => setSearchOpen(false)} />
      )}
    </div>
  );
}
