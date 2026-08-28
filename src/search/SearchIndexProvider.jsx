import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/schema.js';
import { decryptData, decryptBinary } from '../utils/crypto.js';
import { useSessionKey } from '../session/SessionKeyProvider.jsx';
import { decodeYDoc, yDocToPlainText } from '../components/editor/yjsUtils.js';
import { createSearchIndex, indexEntry, updateEntryInIndex, removeEntryFromIndex, searchIndex } from './searchIndex.js';

const SearchContext = createContext(null);

/**
 * Builds and maintains a FlexSearch index in memory only - never written
 * to Dexie or anywhere else persistent. A search index built from
 * plaintext is itself sensitive derived data; keeping it exclusively in
 * a JS variable that vanishes on reload is what keeps "encrypted fast
 * search" from being a contradiction in terms.
 *
 * Indexes incrementally: only entries that are new or whose updatedAt
 * has moved past what's already indexed get decrypted+indexed again, so
 * editing entry #12 doesn't re-decrypt every other entry in the diary.
 */
export function SearchIndexProvider({ children }) {
  const { cryptoKey } = useSessionKey();
  const indexRef = useRef(createSearchIndex());
  const indexedVersionsRef = useRef(new Map()); // entryId -> updatedAt already indexed
  const [ready, setReady] = useState(false);
  const [version, setVersion] = useState(0); // bumped after each (re)index pass, to let consumers re-render

  const entryMeta = useLiveQuery(
    () =>
      db.entries
        .where('isDeleted')
        .equals(0)
        .toArray()
        .then((rows) => rows.map((r) => ({ id: r.id, updatedAt: r.updatedAt, titlePayload: r.titlePayload, contentPayload: r.contentPayload }))),
    []
  );

  useEffect(() => {
    if (!cryptoKey || !entryMeta) return undefined;
    let cancelled = false;

    (async () => {
      const currentIds = new Set(entryMeta.map((e) => e.id));

      // Remove anything indexed that no longer exists / is now deleted.
      for (const indexedId of indexedVersionsRef.current.keys()) {
        if (!currentIds.has(indexedId)) {
          removeEntryFromIndex(indexRef.current, indexedId);
          indexedVersionsRef.current.delete(indexedId);
        }
      }

      // Index anything new or changed since it was last indexed.
      for (const meta of entryMeta) {
        const alreadyAt = indexedVersionsRef.current.get(meta.id);
        if (alreadyAt === meta.updatedAt) continue; // unchanged, skip re-decrypting it
        if (!meta.titlePayload || !meta.contentPayload) continue; // pre-Phase-4 format, nothing to index yet

        try {
          const titleData = await decryptData(meta.titlePayload, cryptoKey);
          const contentBytes = await decryptBinary(meta.contentPayload, cryptoKey);
          if (cancelled) return;
          const plainText = yDocToPlainText(decodeYDoc(new Uint8Array(contentBytes)));

          const entryForIndex = { id: meta.id, title: titleData.title || '', content: plainText, createdAt: meta.updatedAt };
          if (alreadyAt === undefined) {
            indexEntry(indexRef.current, entryForIndex);
          } else {
            updateEntryInIndex(indexRef.current, entryForIndex);
          }
          indexedVersionsRef.current.set(meta.id, meta.updatedAt);
        } catch {
          // Skip anything that fails to decrypt rather than blocking the
          // rest of the index from updating.
        }
      }

      if (!cancelled) {
        setReady(true);
        setVersion((v) => v + 1);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [cryptoKey, entryMeta]);

  const search = useCallback(
    (query) => searchIndex(indexRef.current, query),
    // Re-created whenever the index actually changes, so components
    // holding onto `search` in a dependency array re-run their search
    // after new/edited content becomes findable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [version]
  );

  return <SearchContext.Provider value={{ ready, search }}>{children}</SearchContext.Provider>;
}

export function useSearch() {
  const ctx = useContext(SearchContext);
  if (!ctx) throw new Error('useSearch must be used within a SearchIndexProvider');
  return ctx;
}
