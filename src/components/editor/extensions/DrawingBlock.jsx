import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';
import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../../db/schema.js';
import { decryptData } from '../../../utils/crypto.js';
import { useSessionKey } from '../../../session/SessionKeyProvider.jsx';
import { renderStrokes, fitCanvasToContainer } from '../../drawing/renderStrokes.js';
import styles from './blocks.module.css';

function DrawingBlockView({ node }) {
  const { attachmentId } = node.attrs;
  const { cryptoKey } = useSessionKey();
  const canvasRef = useRef(null);
  const [strokes, setStrokes] = useState(null);
  const [error, setError] = useState(false);

  const attachment = useLiveQuery(
    () => (attachmentId ? db.attachments.where('remoteId').equals(attachmentId).first() : undefined),
    [attachmentId]
  );

  useEffect(() => {
    let cancelled = false;
    if (!attachment || !cryptoKey) return undefined;
    decryptData(attachment.payload, cryptoKey)
      .then((data) => {
        if (!cancelled) setStrokes(data.strokes);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [attachment, cryptoKey]);

  useEffect(() => {
    if (!strokes || !canvasRef.current) return;
    const { ctx, widthCss, heightCss } = fitCanvasToContainer(canvasRef.current);
    renderStrokes(ctx, strokes, { widthCss, heightCss });
  }, [strokes]);

  return (
    <NodeViewWrapper className={styles.drawingBlock} contentEditable={false}>
      {error && <p className={styles.error}>Couldn&rsquo;t load this drawing.</p>}
      <canvas ref={canvasRef} className={styles.drawingCanvas} />
    </NodeViewWrapper>
  );
}

export const DrawingBlock = Node.create({
  name: 'drawingBlock',
  group: 'block',
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      attachmentId: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-drawing-block]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-drawing-block': '' })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(DrawingBlockView);
  },
});
