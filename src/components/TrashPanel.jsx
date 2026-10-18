import { useCallback, useEffect, useState } from 'react';
import Modal from './Modal.jsx';
import { db } from '../db/schema.js';
import { useSessionKey } from '../session/SessionKeyProvider.jsx';
import { decryptData } from '../utils/crypto.js';
import { listDeleted, restoreEntry, restoreDeletedEntries, purgeEntries } from '../features/trash.js';
import { TrashIcon } from './icons.jsx';
import styles from './panels.module.css';

/** Trash: every deleted page, restorable one by one (or all), or erased forever. Titles are decrypted on this device only. */
export default function TrashPanel({ onClose }) {
  const { cryptoKey } = useSessionKey();
  const [items, setItems] = useState(null);
  const [confirmId, setConfirmId] = useState(null); // an id, or 'all'
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    const rows = await listDeleted(db);
    const out = [];
    for (const row of rows) {
      let title = '';
      try {
        const t = row.titlePayload ? await decryptData(row.titlePayload, cryptoKey) : { title: '' };
        title = t.title || '';
      } catch {
        title = '[unreadable entry]';
      }
      out.push({ id: row.id, title, deletedAt: row.updatedAt, createdAt: row.createdAt });
    }
    setItems(out);
  }, [cryptoKey]);

  useEffect(() => {
    load();
  }, [load]);

  async function restoreOne(id) {
    await restoreEntry(db, id);
    setMessage('Page restored to your diary.');
    await load();
  }
  async function restoreAll() {
    const n = await restoreDeletedEntries(db);
    setMessage(`Restored ${n} page${n === 1 ? '' : 's'}.`);
    await load();
  }
  async function eraseConfirmed() {
    const ids = confirmId === 'all' ? (items ?? []).map((i) => i.id) : [confirmId];
    const n = await purgeEntries(db, ids);
    setConfirmId(null);
    setMessage(`Permanently deleted ${n} page${n === 1 ? '' : 's'}.`);
    await load();
  }

  const fmt = (ts) => (ts ? new Date(ts).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '');

  return (
    <Modal title="Trash" onClose={onClose}>
      <p className={styles.note}>Deleted pages stay here, still encrypted, until you restore or erase them.</p>
      {message && (
        <p className={styles.okText} role="status">
          {message}
        </p>
      )}
      {items === null && <p className={styles.note}>Reading the trash…</p>}
      {items && items.length === 0 && <p className={styles.note}>The trash is empty.</p>}
      {items && items.length > 0 && (
        <>
          <ul className={styles.trashList}>
            {items.map((it) => (
              <li key={it.id} className={styles.trashRow}>
                <span className={styles.trashText}>
                  <span className={styles.tocTitle}>{it.title || 'Untitled entry'}</span>
                  <span className={styles.tocDate}>Written {fmt(it.createdAt)}</span>
                </span>
                {confirmId === it.id ? (
                  <span className={styles.trashActions}>
                    <button type="button" className={styles.dangerButton} onClick={eraseConfirmed}>
                      Erase forever
                    </button>
                    <button type="button" className={styles.smallButton} onClick={() => setConfirmId(null)}>
                      Cancel
                    </button>
                  </span>
                ) : (
                  <span className={styles.trashActions}>
                    <button type="button" className={styles.smallButton} onClick={() => restoreOne(it.id)} aria-label={`Restore ${it.title || 'Untitled entry'}`}>
                      Restore
                    </button>
                    <button
                      type="button"
                      className={styles.iconDanger}
                      onClick={() => setConfirmId(it.id)}
                      aria-label={`Delete ${it.title || 'Untitled entry'} forever`}
                      title="Delete forever"
                    >
                      <TrashIcon />
                    </button>
                  </span>
                )}
              </li>
            ))}
          </ul>
          <div className={styles.trashFooter}>
            <button type="button" className={styles.button} onClick={restoreAll}>
              Restore all
            </button>
            {confirmId === 'all' ? (
              <span className={styles.trashActions}>
                <button type="button" className={styles.dangerButton} onClick={eraseConfirmed}>
                  Yes, erase {items.length}
                </button>
                <button type="button" className={styles.smallButton} onClick={() => setConfirmId(null)}>
                  Cancel
                </button>
              </span>
            ) : (
              <button type="button" className={styles.dangerButton} onClick={() => setConfirmId('all')}>
                Empty trash…
              </button>
            )}
          </div>
          <p className={styles.note}>Erasing is permanent on this device, including drawings, voice notes and version history.</p>
        </>
      )}
    </Modal>
  );
}
