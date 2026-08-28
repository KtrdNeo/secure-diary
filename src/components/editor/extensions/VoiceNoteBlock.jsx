import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';
import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../../db/schema.js';
import { decryptBinary } from '../../../utils/crypto.js';
import { useSessionKey } from '../../../session/SessionKeyProvider.jsx';
import styles from './blocks.module.css';

function VoiceNoteBlockView({ node }) {
  const { attachmentId } = node.attrs;
  const { cryptoKey } = useSessionKey();
  const [audioUrl, setAudioUrl] = useState(null);
  const [error, setError] = useState(false);

  const attachment = useLiveQuery(
    () => (attachmentId ? db.attachments.where('remoteId').equals(attachmentId).first() : undefined),
    [attachmentId]
  );

  useEffect(() => {
    let cancelled = false;
    let createdUrl = null;
    setError(false);

    if (!attachment || !cryptoKey) return undefined;

    decryptBinary(attachment.payload, cryptoKey)
      .then((buffer) => {
        if (cancelled) return;
        const blob = new Blob([buffer], { type: attachment.mimeType || 'audio/webm' });
        createdUrl = URL.createObjectURL(blob);
        setAudioUrl(createdUrl);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });

    // Revokes on every re-run (attachment/key change) as well as on
    // unmount - not just once at the very end - otherwise every URL
    // created by an earlier run of this effect leaks for the rest of
    // the session.
    return () => {
      cancelled = true;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [attachment, cryptoKey]);

  return (
    <NodeViewWrapper className={styles.voiceBlock} contentEditable={false}>
      {error && <p className={styles.error}>Couldn&rsquo;t load this recording.</p>}
      {audioUrl && <audio src={audioUrl} controls preload="metadata" />}
      {!audioUrl && !error && <p className={styles.loading}>Loading recording…</p>}
    </NodeViewWrapper>
  );
}

export const VoiceNoteBlock = Node.create({
  name: 'voiceNoteBlock',
  group: 'block',
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      attachmentId: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-voice-block]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-voice-block': '' })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(VoiceNoteBlockView);
  },
});
