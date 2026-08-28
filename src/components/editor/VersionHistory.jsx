import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/schema.js';
import { decryptBinary } from '../../utils/crypto.js';
import { useSessionKey } from '../../session/SessionKeyProvider.jsx';
import { decodeYDoc, yDocToPlainText } from './yjsUtils.js';
import styles from './VersionHistory.module.css';

/**
 * Shows past snapshots of this entry (see EntryEditor's snapshot-on-
 * autosave logic). Deliberately offers a plain-text preview + copy
 * rather than a one-click "restore" that silently rewrites the live
 * document: producing a full-fidelity (formatting-preserving) restore
 * would need a headless editor instance bound to the old snapshot, and
 * if that old content contains a drawing/voice block, constructing one
 * outside a real React render tree is a real, unverified risk without a
 * browser to check it in. Copy-and-paste is less slick but can't
 * corrupt anything.
 */
export default function VersionHistory({ entryId, onClose }) {
  const { cryptoKey } = useSessionKey();
  const [selectedId, setSelectedId] = useState(null);
  const [previewText, setPreviewText] = useState('');
  const [previewError, setPreviewError] = useState(false);
  const [copied, setCopied] = useState(false);

  const versions = useLiveQuery(
    () =>
      entryId == null
        ? []
        : db.entryVersions.where('entryId').equals(entryId).reverse().sortBy('createdAt'),
    [entryId]
  );

  useEffect(() => {
    let cancelled = false;
    setPreviewText('');
    setPreviewError(false);
    setCopied(false);
    if (selectedId == null || !cryptoKey) return undefined;

    db.entryVersions.get(selectedId).then(async (record) => {
      if (cancelled || !record) return;
      try {
        const bytes = await decryptBinary(record.payload, cryptoKey);
        const ydoc = decodeYDoc(new Uint8Array(bytes));
        if (!cancelled) setPreviewText(yDocToPlainText(ydoc));
      } catch {
        if (!cancelled) setPreviewError(true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [selectedId, cryptoKey]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(previewText);
      setCopied(true);
    } catch {
      // Clipboard permission denied or unavailable - the text is still
      // visible on screen for manual copy, so this isn't a dead end.
    }
  }

  return (
    <div className={styles.overlay} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.panel} role="dialog" aria-modal="true" aria-label="Version history">
        <div className={styles.header}>
          <h2 className={styles.title}>Version history</h2>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <p className={styles.hint}>
          Text-only snapshots, saved periodically as you write. Formatting isn&rsquo;t preserved
          here - copy the text you need back into the entry.
        </p>

        {versions === undefined && <p className={styles.empty}>Loading…</p>}
        {versions?.length === 0 && <p className={styles.empty}>No earlier versions yet.</p>}

        <div className={styles.body}>
          <ul className={styles.list}>
            {versions?.map((v) => (
              <li key={v.id}>
                <button
                  type="button"
                  className={styles.listItem}
                  aria-pressed={selectedId === v.id}
                  onClick={() => setSelectedId(v.id)}
                >
                  {new Date(v.createdAt).toLocaleString()}
                </button>
              </li>
            ))}
          </ul>

          {selectedId != null && (
            <div className={styles.preview}>
              {previewError && <p className={styles.empty}>Couldn&rsquo;t decrypt this version.</p>}
              {!previewError && (
                <>
                  <pre className={styles.previewText}>{previewText || '(empty)'}</pre>
                  <button type="button" className={styles.copyButton} onClick={handleCopy}>
                    {copied ? 'Copied' : 'Copy text'}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
