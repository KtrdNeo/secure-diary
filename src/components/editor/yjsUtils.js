/**
 * src/components/editor/yjsUtils.js
 *
 * Pure Yjs helpers - no DOM, no React, no network. This is the one part
 * of the sync story that's genuinely testable end-to-end without a
 * browser or a live backend: two Y.Doc instances can simulate two
 * devices editing offline and merging later, entirely in Node.
 *
 * Storage model: an entry's rich text content lives in a Y.Doc's
 * "content" XmlFragment (the shape Tiptap's Collaboration extension
 * expects). What gets encrypted and stored/synced is the *encoded
 * state* of that Y.Doc (Y.encodeStateAsUpdate) - an opaque binary blob,
 * fed through the binary crypto path (encryptBinary/decryptBinary) same
 * as audio attachments.
 */
import * as Y from 'yjs';

export const YJS_CONTENT_FIELD = 'content';

/** A fresh, empty Y.Doc shaped the way Tiptap's Collaboration extension expects. */
export function createEmptyYDoc() {
  const ydoc = new Y.Doc();
  ydoc.get(YJS_CONTENT_FIELD, Y.XmlFragment);
  return ydoc;
}

/** Encodes a Y.Doc's full current state as a binary update. */
export function encodeYDoc(ydoc) {
  return Y.encodeStateAsUpdate(ydoc);
}

/** Rebuilds a Y.Doc from a previously-encoded state (from encodeYDoc). */
export function decodeYDoc(update) {
  const ydoc = createEmptyYDoc();
  if (update && update.byteLength > 0) {
    Y.applyUpdate(ydoc, update);
  }
  return ydoc;
}

/**
 * Merges a remote update into a local Y.Doc in place. This is the whole
 * of "conflict resolution" - Yjs's CRDT guarantees the result is the
 * same regardless of which side applies which update first, and no
 * edit from either side is silently dropped.
 */
export function mergeUpdate(ydoc, remoteUpdate) {
  Y.applyUpdate(ydoc, remoteUpdate);
}

/**
 * Merges two independently-encoded states (e.g. this device's current
 * state and a state pulled from Supabase) into a brand new Y.Doc,
 * without mutating either source. Used at sync time: decode what's
 * stored remotely, merge with local, re-encode, that's the new state
 * for both sides.
 */
export function mergeStates(stateA, stateB) {
  const merged = createEmptyYDoc();
  if (stateA?.byteLength > 0) Y.applyUpdate(merged, stateA);
  if (stateB?.byteLength > 0) Y.applyUpdate(merged, stateB);
  return merged;
}

/** Plain-text extraction, for building the FlexSearch index without needing a live editor instance. */
export function yDocToPlainText(ydoc) {
  const fragment = ydoc.get(YJS_CONTENT_FIELD, Y.XmlFragment);
  return fragment.toString().replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * A point-in-time snapshot for version history / rollback. Yjs snapshots
 * capture enough state-vector information to later diff "what changed
 * between this snapshot and now" - stored here as an encoded update
 * relative to an empty doc, which is simpler to store/restore than a
 * true Y.Snapshot (whose format ties it to the exact same in-memory
 * Y.Doc instance it was taken from). This trades a little precision
 * (restoring inserts the sibling into "current" state rather than
 * diffing) for something that survives being encrypted, stored, and
 * reloaded on a different device days later.
 */
export function snapshotYDoc(ydoc) {
  return encodeYDoc(ydoc);
}

/** Restores a Y.Doc from a snapshot into a fresh, independent Y.Doc. */
export function restoreSnapshot(snapshotUpdate) {
  return decodeYDoc(snapshotUpdate);
}
