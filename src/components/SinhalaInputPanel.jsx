import { useState, useRef, useEffect, useCallback } from 'react';
import { transliterate } from '../sinhala/transliterate.js';
import { wijesekaraBaseChar } from '../sinhala/wijesekara.js';
import { SPEECH_LANGUAGES, getRecognitionCtor, joinTranscript } from '../features/speech.js';
import { recognizeImage, validateImageFile } from '../features/ocr.js';
import styles from './SinhalaInputPanel.module.css';
import { useEscape } from '../hooks/useEscape.js';

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
  useEscape(onClose);
  const [mode, setMode] = useState('transliterate');
  const [latinDraft, setLatinDraft] = useState('');
  const [wijesekaraDraft, setWijesekaraDraft] = useState('');
  const textareaRef = useRef(null);
  const [spoken, setSpoken] = useState('');
  const [interim, setInterim] = useState('');
  const [listening, setListening] = useState(false);
  const [speechLang, setSpeechLang] = useState('si-LK');
  const [speechError, setSpeechError] = useState('');
  const recognitionRef = useRef(null);
  const [scanText, setScanText] = useState('');
  const [scanBusy, setScanBusy] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanError, setScanError] = useState('');
  const speechSupported = !!getRecognitionCtor();

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setListening(false);
    setInterim('');
  }, []);

  useEffect(() => () => recognitionRef.current?.abort?.(), []);

  function startListening() {
    const Ctor = getRecognitionCtor();
    if (!Ctor) return;
    setSpeechError('');
    const rec = new Ctor();
    rec.lang = speechLang;
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (e) => {
      let finalChunk = '';
      let interimChunk = '';
      for (let i = e.resultIndex; i < e.results.length; i += 1) {
        const r = e.results[i];
        if (r.isFinal) finalChunk += r[0].transcript;
        else interimChunk += r[0].transcript;
      }
      if (finalChunk) setSpoken((prev) => joinTranscript(prev, finalChunk));
      setInterim(interimChunk);
    };
    rec.onerror = (e) => {
      setSpeechError(
        e.error === 'not-allowed'
          ? 'Microphone permission was denied.'
          : e.error === 'language-not-supported'
            ? 'This browser cannot recognise that language - try Chrome or Edge.'
            : `Speech recognition stopped (${e.error}).`
      );
      setListening(false);
    };
    rec.onend = () => {
      setListening(false);
      setInterim('');
    };
    recognitionRef.current = rec;
    rec.start();
    setListening(true);
  }

  async function handleScanFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    const problem = validateImageFile(file);
    if (problem) {
      setScanError(problem);
      return;
    }
    setScanError('');
    setScanBusy(true);
    setScanProgress(0);
    try {
      const text = await recognizeImage(file, setScanProgress);
      setScanText(text);
      if (!text) setScanError('No text found - try a sharper, well-lit photo.');
    } catch {
      setScanError('Could not read the photo. The first scan needs an internet connection to fetch the language files.');
    } finally {
      setScanBusy(false);
    }
  }

  useEffect(() => {
    textareaRef.current?.focus();
    if (mode !== 'speak') stopListening();
  }, [mode, stopListening]);

  const preview =
    mode === 'transliterate'
      ? transliterate(latinDraft)
      : mode === 'wijesekara'
        ? wijesekaraDraft
        : mode === 'speak'
          ? joinTranscript(spoken, interim)
          : scanText;

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
          <button type="button" className={styles.modeButton} aria-pressed={mode === 'speak'} onClick={() => setMode('speak')}>
            Speak
          </button>
          <button type="button" className={styles.modeButton} aria-pressed={mode === 'scan'} onClick={() => setMode('scan')}>
            Scan photo
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
        ) : mode === 'speak' ? (
          <>
            <p className={styles.hint}>
              Speak and your words appear below. Note: your browser sends the audio to its own speech service
              (for example Google in Chrome) - it is not covered by your diary&rsquo;s encryption.
            </p>
            {speechSupported ? (
              <div className={styles.row}>
                <select
                  className={styles.toolButton}
                  value={speechLang}
                  onChange={(e) => setSpeechLang(e.target.value)}
                  disabled={listening}
                  aria-label="Speech language"
                >
                  {SPEECH_LANGUAGES.map((l) => (
                    <option key={l.code} value={l.code}>
                      {l.label}
                    </option>
                  ))}
                </select>
                <button type="button" className={styles.doneButton} onClick={listening ? stopListening : startListening}>
                  {listening ? 'Stop listening' : 'Start listening'}
                </button>
              </div>
            ) : (
              <p className={styles.hint} role="status">
                Voice typing isn&rsquo;t available in this browser. Chrome or Edge support it.
              </p>
            )}
            {speechError && <p className={styles.hint} role="alert">{speechError}</p>}
          </>
        ) : mode === 'scan' ? (
          <>
            <p className={styles.hint}>
              Take or choose a photo of printed or handwritten-neat text (Sinhala or English). It is read on
              this device; the first scan downloads the language files.
            </p>
            <label className={styles.doneButton} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              {scanBusy ? `Reading… ${scanProgress}%` : 'Choose photo'}
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleScanFile}
                disabled={scanBusy}
                style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
              />
            </label>
            {scanError && <p className={styles.hint} role="alert">{scanError}</p>}
          </>
        ) : (
          <>
            <p className={styles.hint}>
              Type using the Wijesekara key positions. This covers the base (unshifted) keys;
              use phonetic typing for anything not covered.
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
