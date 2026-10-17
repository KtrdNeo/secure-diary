import { useEffect, useMemo, useState } from 'react';
import Modal from './Modal.jsx';
import { db } from '../db/schema.js';
import { useSessionKey } from '../session/SessionKeyProvider.jsx';
import { decryptData } from '../utils/crypto.js';
import { isSealed } from '../features/capsule.js';
import { filterItems, groupByMonth, monthLabel } from '../features/contents.js';
import styles from './panels.module.css';

/** Table of contents: every entry by month, tap to jump. Titles are decrypted on this device only. */
export default function ContentsPanel({ onClose, onOpenEntry, currentEntryId }) {
  const { cryptoKey } = useSessionKey();
  const [items, setItems] = useState(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const rows = await db.entries.orderBy('createdAt').filter((e) => e.isDeleted === 0).toArray();
      const out = [];
      for (const row of rows) {
        let title = '';
        let sealed = false;
        try {
          const t = row.titlePayload ? await decryptData(row.titlePayload, cryptoKey) : { title: '' };
          title = t.title || '';
          sealed = isSealed(t.sealUntil);
        } catch {
          title = '[unreadable entry]';
        }
        out.push({ id: row.id, title, createdAt: row.createdAt, sealed });
      }
      if (!cancelled) setItems(out);
    })();
    return () => {
      cancelled = true;
    };
  }, [cryptoKey]);

  const groups = useMemo(() => (items ? groupByMonth(filterItems(items, query)) : []), [items, query]);

  return (
    <Modal title="Contents" onClose={onClose}>
      {items === null && <p className={styles.note}>Reading your entries…</p>}
      {items && items.length === 0 && <p className={styles.note}>No entries yet - your first page is waiting.</p>}
      {items && items.length > 0 && (
        <>
          <p className={styles.note}>
            {items.length} entr{items.length === 1 ? 'y' : 'ies'}. Tap one to open it.
          </p>
          <input
            type="search"
            className={styles.filter}
            placeholder="Filter by title…"
            aria-label="Filter entries by title"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {groups.length === 0 && <p className={styles.note}>No titles match “{query}”.</p>}
          {groups.map((g) => (
            <section key={g.key} aria-label={monthLabel(g.key)}>
              <h3 className={styles.monthHeading}>{monthLabel(g.key)}</h3>
              <ul className={styles.tocList}>
                {g.entries.map((it) => (
                  <li key={it.id}>
                    <button
                      type="button"
                      className={styles.tocItem}
                      aria-current={it.id === currentEntryId ? 'true' : undefined}
                      onClick={() => {
                        onOpenEntry(it.id);
                        onClose();
                      }}
                    >
                      <span className={styles.tocTitle}>
                        {it.sealed ? '🔒 ' : ''}
                        {it.title || 'Untitled entry'}
                      </span>
                      <span className={styles.tocDate}>
                        {new Date(it.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </>
      )}
    </Modal>
  );
}
