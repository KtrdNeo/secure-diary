/**
 * src/search/searchIndex.js
 *
 * Thin wrapper around FlexSearch's Document index. Deliberately knows
 * nothing about encryption, Dexie, or React - it only ever sees already-
 * decrypted plain text, handed to it by SearchIndexProvider. That
 * separation is what keeps this file testable with plain strings, and
 * it's also the privacy boundary: this module is the ONE place in the
 * app that holds plaintext diary content outside the editor itself, and
 * it holds it only in memory, never persisted (see SearchIndexProvider
 * for why: persisting a search index built from plaintext would leak
 * derived content to disk even though the "real" storage stays
 * encrypted - a genuine zero-knowledge violation, not just a style
 * preference).
 */
import { Document } from 'flexsearch';

export function createSearchIndex() {
  return new Document({
    document: {
      id: 'id',
      index: ['title', 'content'],
      store: ['title', 'createdAt'],
    },
    tokenize: 'forward', // substring matching - better fit than whole-word for short diary entries
  });
}

export function indexEntry(index, entry) {
  index.add({
    id: entry.id,
    title: entry.title || '',
    content: entry.content || '',
    createdAt: entry.createdAt,
  });
}

export function updateEntryInIndex(index, entry) {
  index.update({
    id: entry.id,
    title: entry.title || '',
    content: entry.content || '',
    createdAt: entry.createdAt,
  });
}

export function removeEntryFromIndex(index, id) {
  index.remove(id);
}

/**
 * @returns {Array<{id, title, createdAt, matchedField}>}
 */
export function searchIndex(index, query) {
  const trimmed = (query || '').trim();
  if (!trimmed) return [];

  const results = index.search(trimmed, { enrich: true, merge: true });
  return results.map((r) => ({
    id: r.id,
    title: r.doc?.title ?? '',
    createdAt: r.doc?.createdAt ?? null,
    matchedField: r.field ?? [],
  }));
}
