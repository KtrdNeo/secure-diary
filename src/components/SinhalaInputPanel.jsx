import { useState, useRef, useEffect } from 'react';
import { transliterate } from '../sinhala/transliterate.js';
import { wijesekaraBaseChar } from '../sinhala/wijesekara.js';
import styles from './SinhalaInputPanel.module.css';

/**
 * A focused composer, not an inline live-transliteration editor
 * extension - deliberately. A Tiptap InputRule that rewrites text as
 * you type directly in the entry would be a neater end-to-end
 * experience, but it's also meaningfully more integration risk
 * (cursor/selection edge cases) that I have no browser to verify here.
 * This reuses the same "compose in a panel, insert the result" pattern
 * DrawingCanvas and VoiceRecorder already use successfully.
 */
export default function SinhalaInputPanel({ onInsert, onClose }) {
  const [mode, setMode] = useState('transliterate');
  const [latinDraft, setLatinDraft] = useState('');
  const [wijesekaraDraft, setWijesekaraDraft] = useState('');
  const textareaRef = useRef(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, [mode]);

  const preview = mode === 'transliterate' ? transliterate(latinDraft) : wijesekaraDraft;

  function handleWijesekaraKeyDown(e) {
    if (e.key.length !== 1 || e.ctrlKey || e.metaKey || e.altKey) return;
    const mapped = wijesekaraBaseChar(e.key);
    if (mapped) {
      e.preventDefault();
      const el = textareaRef.current;
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const next = wijesekaraDraft.slice(0, start) + mapped + wijesekaraDraft.slice(end);
      setWijesekaraDraft(next);
      requestAnimationFrame(() => el.setSelectionRange(start + 1, start + 1));
    }
  }

  function handleInsert() {
    if (preview.trim()) onInsert(preview);
  }

  return (
    <div className={styles.overlay} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.panel} role="dialog" aria-modal="true" aria-label="Sinhala input">
        <div className={styles.header}>
          <h2 className={styles.title}>Sinhala input</h2>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className={styles.modeToggle} role="radiogroup" aria-label="Input mode">
          <button
            type="button"
            className={styles.modeButton}
            aria-pressed={mode === 'transliterate'}
            onClick={() => setMode('transliterate')}
          >
            Type phonetically
          </button>
          <button
            type="button"
            className={styles.modeButton}
            aria-pressed={mode === 'wijesekara'}
            onClick={() => setMode('wijesekara')}
          >
            Wijesekara keyboard
          </button>
        </div>

        {mode === 'transliterate' ? (
          <>
            <p className={styles.hint}>
              Type in English letters, phonetically (e.g. &ldquo;kohomada&rdquo;) - see it converted
              below as you go.
            </p>
            <textarea
              ref={textareaRef}
              className={styles.textarea}
              value={latinDraft}
              onChange={(e) => setLatinDraft(e.target.value)}
              placeholder="ammaa kohomada..."
            />
          </>
        ) : (
          <>
            <p className={styles.hint}>
              Type using the base Wijesekara key positions (a partial, unshifted-row-only
              layout - see CHECKPOINT_SUMMARY.md for exactly what&rsquo;s covered).
            </p>
            <textarea
              ref={textareaRef}
              className={styles.textarea}
              value={wijesekaraDraft}
              onChange={() => {}}
              onKeyDown={handleWijesekaraKeyDown}
              placeholder=""
            />
          </>
        )}

        <p className={styles.previewLabel}>Preview</p>
        <div className={styles.preview}>{preview || <span className={styles.previewEmpty}>—</span>}</div>

        <div className={styles.row}>
          <button type="button" className={styles.toolButton} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={styles.doneButton} onClick={handleInsert} disabled={!preview.trim()}>
            Insert into entry
          </button>
        </div>
      </div>
    </div>
  );
}
