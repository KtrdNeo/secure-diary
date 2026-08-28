import { useEditorState } from '@tiptap/react';
import { countTaskProgress } from './docUtils.js';
import styles from './Toolbar.module.css';

function ToolButton({ active, disabled, onClick, label, children }) {
  return (
    <button
      type="button"
      className={styles.button}
      aria-pressed={active}
      aria-label={label}
      title={label}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()} // keep editor selection focused
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export default function Toolbar({ editor, onRequestDrawing, onRequestVoiceNote, onRequestSinhala }) {
  const state = useEditorState({
    editor,
    selector: (snapshot) => {
      const ed = snapshot.editor;
      if (!ed) return null;
      return {
        bold: ed.isActive('bold'),
        italic: ed.isActive('italic'),
        strike: ed.isActive('strike'),
        h1: ed.isActive('heading', { level: 1 }),
        h2: ed.isActive('heading', { level: 2 }),
        bulletList: ed.isActive('bulletList'),
        orderedList: ed.isActive('orderedList'),
        taskList: ed.isActive('taskList'),
        blockquote: ed.isActive('blockquote'),
        callout: ed.isActive('callout'),
        canUndo: ed.can().undo(),
        canRedo: ed.can().redo(),
        // Walking getJSON() on every state snapshot is a bit more work
        // than the other (cheap) isActive() checks above, but doc size
        // for a diary entry is small and this keeps the progress bar
        // live without RichTextEditor needing to hold or forward
        // content state at all now that Yjs/Collaboration owns it.
        taskProgress: countTaskProgress(ed.getJSON()),
      };
    },
  });

  if (!editor || !state) return null;

  const { taskProgress } = state;
  const showProgress = taskProgress.total > 0;
  const progressPct = showProgress ? Math.round((taskProgress.checked / taskProgress.total) * 100) : 0;

  return (
    <div className={styles.toolbar}>
      <div className={styles.group}>
        <ToolButton label="Bold" active={state.bold} onClick={() => editor.chain().focus().toggleBold().run()}>
          B
        </ToolButton>
        <ToolButton label="Italic" active={state.italic} onClick={() => editor.chain().focus().toggleItalic().run()}>
          I
        </ToolButton>
        <ToolButton label="Strikethrough" active={state.strike} onClick={() => editor.chain().focus().toggleStrike().run()}>
          S
        </ToolButton>
      </div>

      <div className={styles.group}>
        <ToolButton label="Heading" active={state.h1} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>
          H1
        </ToolButton>
        <ToolButton label="Subheading" active={state.h2} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
          H2
        </ToolButton>
        <ToolButton label="Quote" active={state.blockquote} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
          &ldquo;&rdquo;
        </ToolButton>
      </div>

      <div className={styles.group}>
        <ToolButton label="Bulleted list" active={state.bulletList} onClick={() => editor.chain().focus().toggleBulletList().run()}>
          •—
        </ToolButton>
        <ToolButton label="Numbered list" active={state.orderedList} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
          1.
        </ToolButton>
        <ToolButton label="Checklist" active={state.taskList} onClick={() => editor.chain().focus().toggleTaskList().run()}>
          ☑
        </ToolButton>
        <ToolButton label="Choice list" onClick={() => editor.chain().focus().insertRadioGroup().run()}>
          ◎
        </ToolButton>
        <ToolButton
          label="Table"
          onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
        >
          ▦
        </ToolButton>
        <ToolButton label="Callout" active={state.callout} onClick={() => editor.chain().focus().setCallout('info').run()}>
          ⓘ
        </ToolButton>
      </div>

      <div className={styles.group}>
        <ToolButton label="Insert drawing" onClick={onRequestDrawing}>
          ✎
        </ToolButton>
        <ToolButton label="Insert voice note" onClick={onRequestVoiceNote}>
          ●
        </ToolButton>
        <ToolButton label="Sinhala input" onClick={onRequestSinhala}>
          අ
        </ToolButton>
      </div>

      <div className={styles.group}>
        <ToolButton label="Undo" disabled={!state.canUndo} onClick={() => editor.chain().focus().undo().run()}>
          ↶
        </ToolButton>
        <ToolButton label="Redo" disabled={!state.canRedo} onClick={() => editor.chain().focus().redo().run()}>
          ↷
        </ToolButton>
      </div>

      {showProgress && (
        <div className={styles.progressWrap} aria-label={`${taskProgress.checked} of ${taskProgress.total} checked`}>
          <div className={styles.progressTrack}>
            <div className={styles.progressFill} style={{ width: `${progressPct}%` }} />
          </div>
          <span className={styles.progressLabel}>
            {taskProgress.checked}/{taskProgress.total}
          </span>
        </div>
      )}
    </div>
  );
}
