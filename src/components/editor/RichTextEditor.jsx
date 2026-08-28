import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Collaboration from '@tiptap/extension-collaboration';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { Table, TableRow, TableCell, TableHeader } from '@tiptap/extension-table';
import Placeholder from '@tiptap/extension-placeholder';
import { useEffect, useMemo } from 'react';
import { Callout } from './extensions/Callout.js';
import { RadioGroup, RadioItem } from './extensions/RadioGroup.jsx';
import { DrawingBlock } from './extensions/DrawingBlock.jsx';
import { VoiceNoteBlock } from './extensions/VoiceNoteBlock.jsx';
import { YJS_CONTENT_FIELD } from './yjsUtils.js';
import Toolbar from './Toolbar.jsx';
import styles from './RichTextEditor.module.css';

/**
 * @param {object} props
 * @param {import('yjs').Doc} props.ydoc - the entry's live CRDT document,
 *   owned by EntryEditor. Collaboration renders directly from its
 *   fragment and syncs local edits back into it automatically - this
 *   component never sees or produces plain JSON content.
 * @param {() => void} props.onChange - fired as a plain signal (no
 *   payload) on every edit; EntryEditor reads current state back off
 *   the ydoc it already owns rather than receiving a copy through here.
 * @param {import('react').MutableRefObject} props.editorRef - exposes
 *   the live editor instance so the parent can call commands
 *   (insertContent for drawing/voice blocks) without this component
 *   needing to know about attachments or encryption at all.
 * @param {() => void} props.onRequestDrawing
 * @param {() => void} props.onRequestVoiceNote
 * @param {() => void} props.onRequestSinhala
 */
export default function RichTextEditor({
  ydoc,
  onChange,
  editorRef,
  onRequestDrawing,
  onRequestVoiceNote,
  onRequestSinhala,
}) {
  // Recomputed only when the ydoc identity changes (i.e. a different
  // entry - DiaryShell remounts EntryEditor per entry anyway, but this
  // keeps the extension list from being rebuilt on every keystroke).
  const extensions = useMemo(
    () => [
      // undoRedo disabled deliberately: Collaboration registers its own
      // Yjs-aware undo/redo (yUndoPlugin, confirmed by reading the
      // installed package's types). Running ProseMirror's plain history
      // *and* Yjs's undo manager at the same time is exactly the kind of
      // thing that looks fine until real concurrent editing corrupts
      // undo state - not a risk worth taking silently.
      StarterKit.configure({ undoRedo: false }),
      Collaboration.configure({ document: ydoc, field: YJS_CONTENT_FIELD }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
      Placeholder.configure({ placeholder: 'Write about your day…' }),
      Callout,
      RadioGroup,
      RadioItem,
      DrawingBlock,
      VoiceNoteBlock,
    ],
    [ydoc]
  );

  const editor = useEditor(
    {
      extensions,
      immediatelyRender: false,
      onUpdate: () => onChange?.(),
      editorProps: {
        attributes: {
          class: styles.prose,
          spellcheck: 'true',
        },
      },
    },
    [ydoc]
  );

  useEffect(() => {
    if (editorRef) editorRef.current = editor;
    return () => {
      if (editorRef) editorRef.current = null;
    };
  }, [editor, editorRef]);

  useEffect(() => () => editor?.destroy(), [editor]);

  return (
    <div className={styles.wrapper}>
      <Toolbar
        editor={editor}
        onRequestDrawing={onRequestDrawing}
        onRequestVoiceNote={onRequestVoiceNote}
        onRequestSinhala={onRequestSinhala}
      />
      <EditorContent editor={editor} className={styles.editorContent} />
    </div>
  );
}
