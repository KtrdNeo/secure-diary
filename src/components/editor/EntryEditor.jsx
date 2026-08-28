import { useState, useRef, useEffect, useCallback } from 'react';
import RichTextEditor from './RichTextEditor.jsx';
import DrawingCanvas from '../drawing/DrawingCanvas.jsx';
import VoiceRecorder from '../voice/VoiceRecorder.jsx';
import VersionHistory from './VersionHistory.jsx';
import SinhalaInputPanel from '../SinhalaInputPanel.jsx';
import { encryptData, decryptData, encryptBinary, decryptBinary } from '../../utils/crypto.js';
import { useSessionKey } from '../../session/SessionKeyProvider.jsx';
import { db } from '../../db/schema.js';
import { createEmptyYDoc, decodeYDoc, encodeYDoc, snapshotYDoc, yDocToPlainText } from './yjsUtils.js';
import styles from './EntryEditor.module.css';

const AUTOSAVE_DELAY_MS = 2000; // Feature 13: 2-second real-time draft autosave
const SNAPSHOT_MIN_INTERVAL_MS = 5 * 60 * 1000; // don't version-history-spam on every autosave

/**
 * Adds a sync queue entry for this entity, unless one is already
 * pending for it - otherwise every autosave tick during active editing
 * would pile up a fresh queue row for the same entry, when all the
 * sync engine actually needs is "this entity has unsynced changes,
 * push its current state" once.
 */
async function enqueueSync(entityType, entityId) {
  const existing = await db.syncQueue.where({ entityType, entityId }).first();
  if (existing) return;
  await db.syncQueue.add({ entityType, entityId, operation: 'upsert', createdAt: Date.now(), attempts: 0 });
}

/**
 * Assumes it's remounted (via a `key` prop keyed on entryId) whenever the
 * person navigates to a different entry, rather than receiving a changed
 * `entryId` on a live instance - simpler and safer than handling
 * mid-lifecycle entry switches internally. DiaryShell is responsible for
 * that key.
 */
export default function EntryEditor({ entryId, onEntryCreated }) {
  const { cryptoKey } = useSessionKey();
  const editorRef = useRef(null);
  const saveTimerRef = useRef(null);
  const currentEntryIdRef = useRef(entryId ?? null);
  const remoteIdRef = useRef(null);
  const lastSnapshotAtRef = useRef(0);

  const [title, setTitle] = useState('');
  const [ydoc, setYdoc] = useState(null); // null until loaded/created
  const [changeTick, setChangeTick] = useState(0); // bumped on every edit signal
  const [migrationNotice, setMigrationNotice] = useState(false);
  const [savedAt, setSavedAt] = useState(null);
  const [saving, setSaving] = useState(false);
  const [overlay, setOverlay] = useState(null); // 'drawing' | 'voice' | 'history' | null

  // Load + decrypt an existing entry on mount, or start a fresh Y.Doc.
  useEffect(() => {
    let cancelled = false;

    if (entryId == null || !cryptoKey) {
      setYdoc(createEmptyYDoc());
      return undefined;
    }

    db.entries.get(entryId).then(async (record) => {
      if (cancelled) return;
      if (!record) {
        setYdoc(createEmptyYDoc());
        return;
      }
      try {
        if (record.contentPayload) {
          // Current format: title (text) + content (Yjs binary state).
          const titleData = await decryptData(record.titlePayload, cryptoKey);
          const contentBytes = await decryptBinary(record.contentPayload, cryptoKey);
          if (cancelled) return;
          setTitle(titleData.title || '');
          setYdoc(decodeYDoc(new Uint8Array(contentBytes)));
        } else if (record.payload) {
          // Pre-Phase-4 format: one JSON snapshot, no Yjs history at all.
          // Deliberately NOT auto-converted - doing so would need a
          // headless editor instance bound to a fresh Y.Doc, and if the
          // old content contains a drawing/voice block, that would try
          // to construct a React NodeView outside any real React render
          // tree - not something I can verify is safe without a
          // browser. Title carries over; body text does not. Visibly
          // empty is a much safer failure mode than silently wrong.
          const oldData = await decryptData(record.payload, cryptoKey);
          if (cancelled) return;
          setTitle(oldData.title || '');
          setMigrationNotice(true);
          setYdoc(createEmptyYDoc());
        } else {
          setYdoc(createEmptyYDoc());
        }
        remoteIdRef.current = record.remoteId || null;
      } catch {
        // Leave blank rather than crash the whole app on one bad/foreign record.
        if (!cancelled) setYdoc(createEmptyYDoc());
      }
    });

    return () => {
      cancelled = true;
    };
    // entryId is fixed for this instance's lifetime - see the doc comment above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cryptoKey]);

  const loaded = ydoc !== null;

  /**
   * Creates the entry on first save, updates it thereafter. Returns the
   * entry's id. Used both by the debounced autosave AND, directly
   * (bypassing the debounce), whenever a drawing/voice note needs an
   * entryId to attach to right now.
   */
  const saveEntry = useCallback(
    async (nextTitle) => {
      if (!cryptoKey || !ydoc) return null;
      setSaving(true);
      try {
        const titlePayload = await encryptData({ title: nextTitle }, cryptoKey);
        const contentPayload = await encryptBinary(encodeYDoc(ydoc), cryptoKey);
        const now = Date.now();
        const wasNew = currentEntryIdRef.current == null;

        if (wasNew) {
          remoteIdRef.current = crypto.randomUUID();
          const newId = await db.entries.add({
            notebookId: null,
            type: 'text',
            titlePayload,
            contentPayload,
            createdAt: now,
            updatedAt: now,
            isPinned: 0,
            isDeleted: 0,
            syncStatus: 'pending',
            remoteId: remoteIdRef.current,
          });
          currentEntryIdRef.current = newId;
        } else {
          await db.entries.update(currentEntryIdRef.current, {
            titlePayload,
            contentPayload,
            updatedAt: now,
            syncStatus: 'pending',
          });
        }
        await enqueueSync('entry', currentEntryIdRef.current);

        // Version history: at most one snapshot per SNAPSHOT_MIN_INTERVAL_MS
        // per entry, so actively editing doesn't spam the history list.
        if (now - lastSnapshotAtRef.current > SNAPSHOT_MIN_INTERVAL_MS) {
          lastSnapshotAtRef.current = now;
          const snapshotPayload = await encryptBinary(snapshotYDoc(ydoc), cryptoKey);
          await db.entryVersions.add({
            entryId: currentEntryIdRef.current,
            payload: snapshotPayload,
            createdAt: now,
          });
        }

        setSavedAt(now);
        if (wasNew) onEntryCreated?.(currentEntryIdRef.current);
        return currentEntryIdRef.current;
      } finally {
        setSaving(false);
      }
    },
    [cryptoKey, ydoc, onEntryCreated]
  );

  useEffect(() => {
    if (!loaded) return undefined;
    const isEmpty = yDocToPlainText(ydoc).length === 0;
    if (isEmpty && !title.trim() && currentEntryIdRef.current == null) return undefined;

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveEntry(title);
    }, AUTOSAVE_DELAY_MS);
    return () => clearTimeout(saveTimerRef.current);
    // ydoc's identity is stable for this instance's life (see the loading
    // effect above) - changeTick is what actually signals new edits to save.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, changeTick, loaded, saveEntry]);

  async function handleDrawingSave(strokes) {
    setOverlay(null);
    const savedEntryId = await saveEntry(title); // ensures an entry exists right now
    if (savedEntryId == null) return;
    const attachmentRemoteId = crypto.randomUUID();
    const payload = await encryptData({ strokes }, cryptoKey);
    const newAttachmentId = await db.attachments.add({
      entryId: savedEntryId,
      mimeType: 'application/x-secure-diary-strokes',
      sizeBytes: JSON.stringify(strokes).length,
      payload,
      createdAt: Date.now(),
      syncStatus: 'pending',
      remoteId: attachmentRemoteId,
    });
    await enqueueSync('attachment', newAttachmentId);
    // Referenced by remoteId (UUID), not the local auto-increment id -
    // this reference travels inside the synced Yjs content, so it has
    // to mean the same thing on every device, not just this one.
    editorRef.current
      ?.chain()
      .focus()
      .insertContent({ type: 'drawingBlock', attrs: { attachmentId: attachmentRemoteId } })
      .run();
  }

  async function handleVoiceSave(blob) {
    setOverlay(null);
    const savedEntryId = await saveEntry(title);
    if (savedEntryId == null) return;
    const attachmentRemoteId = crypto.randomUUID();
    const buffer = await blob.arrayBuffer();
    const payload = await encryptBinary(buffer, cryptoKey);
    const newAttachmentId = await db.attachments.add({
      entryId: savedEntryId,
      mimeType: blob.type,
      sizeBytes: buffer.byteLength,
      payload,
      createdAt: Date.now(),
      syncStatus: 'pending',
      remoteId: attachmentRemoteId,
    });
    await enqueueSync('attachment', newAttachmentId);
    editorRef.current
      ?.chain()
      .focus()
      .insertContent({ type: 'voiceNoteBlock', attrs: { attachmentId: attachmentRemoteId } })
      .run();
  }

  function handleSinhalaInsert(text) {
    setOverlay(null);
    editorRef.current?.chain().focus().insertContent(text).run();
  }

  if (!loaded) {
    return <div className={styles.loading}>Decrypting…</div>;
  }

  return (
    <div className={styles.editor}>
      <input
        className={styles.titleInput}
        placeholder="Untitled entry"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />

      {migrationNotice && (
        <p className={styles.migrationNotice}>
          This entry was written before version history existed - its title carried over, but
          please re-check its body text.
        </p>
      )}

      <RichTextEditor
        ydoc={ydoc}
        onChange={() => setChangeTick((t) => t + 1)}
        editorRef={editorRef}
        onRequestDrawing={() => setOverlay('drawing')}
        onRequestVoiceNote={() => setOverlay('voice')}
        onRequestSinhala={() => setOverlay('sinhala')}
      />

      <div className={styles.status}>
        <button
          type="button"
          className={styles.historyLink}
          onClick={() => setOverlay('history')}
          disabled={currentEntryIdRef.current == null}
        >
          History
        </button>
        <span>{saving ? 'Saving…' : savedAt ? `Saved ${new Date(savedAt).toLocaleTimeString()}` : ' '}</span>
      </div>

      {overlay === 'drawing' && <DrawingCanvas onSave={handleDrawingSave} onCancel={() => setOverlay(null)} />}
      {overlay === 'voice' && <VoiceRecorder onSave={handleVoiceSave} onCancel={() => setOverlay(null)} />}
      {overlay === 'sinhala' && (
        <SinhalaInputPanel onInsert={handleSinhalaInsert} onClose={() => setOverlay(null)} />
      )}
      {overlay === 'history' && (
        <VersionHistory entryId={currentEntryIdRef.current} onClose={() => setOverlay(null)} />
      )}
    </div>
  );
}
