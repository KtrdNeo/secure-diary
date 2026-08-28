import { useState, useRef, useCallback, useEffect } from 'react';
import styles from './VoiceRecorder.module.css';

function pickMimeType() {
  const candidates = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/webm'];
  for (const type of candidates) {
    if (window.MediaRecorder?.isTypeSupported?.(type)) return type;
  }
  return ''; // let the browser pick its own default
}

function formatDuration(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * idle -> requesting -> recording -> stopped, with `denied`/`error` as
 * side branches off `requesting`. `stopped` shows a playback preview
 * before committing, since re-recording is much better UX than
 * discovering a bad take only after it's already saved and encrypted.
 */
export default function VoiceRecorder({ onSave, onCancel }) {
  const [state, setState] = useState('idle');
  const [level, setLevel] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const [previewUrl, setPreviewUrl] = useState(null);

  const streamRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const rafRef = useRef(null);
  const startTimeRef = useRef(0);
  const blobRef = useRef(null);

  const cleanupAudioGraph = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    analyserRef.current = null;
  }, []);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(
    () => () => {
      cleanupAudioGraph();
      stopStream();
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    // Only meant to run on unmount - see cleanupAudioGraph/stopStream/previewUrl
    // as captured-at-unmount-time refs/state, not reactive dependencies.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  function meterLoop() {
    const analyser = analyserRef.current;
    if (!analyser) return;
    const data = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteTimeDomainData(data);
    let sumSquares = 0;
    for (let i = 0; i < data.length; i += 1) {
      const v = (data[i] - 128) / 128;
      sumSquares += v * v;
    }
    const rms = Math.sqrt(sumSquares / data.length);
    setLevel(Math.min(1, rms * 4));
    setDurationMs(Date.now() - startTimeRef.current);
    rafRef.current = requestAnimationFrame(meterLoop);
  }

  async function handleStart() {
    setState('requesting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const audioCtx = new AudioCtx();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      audioCtxRef.current = audioCtx;
      analyserRef.current = analyser;

      const mimeType = pickMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || mimeType || 'audio/webm' });
        blobRef.current = blob;
        setPreviewUrl(URL.createObjectURL(blob));
        setState('stopped');
        cleanupAudioGraph();
        stopStream();
      };
      recorderRef.current = recorder;

      startTimeRef.current = Date.now();
      recorder.start();
      setState('recording');
      rafRef.current = requestAnimationFrame(meterLoop);
    } catch (err) {
      setState(err?.name === 'NotAllowedError' ? 'denied' : 'error');
    }
  }

  function handleStop() {
    recorderRef.current?.stop();
  }

  function handleRetake() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    blobRef.current = null;
    setDurationMs(0);
    setState('idle');
  }

  function handleSave() {
    if (blobRef.current) onSave(blobRef.current);
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.panel}>
        {state === 'idle' && (
          <>
            <p className={styles.hint}>Record a voice note for this entry.</p>
            <button type="button" className={styles.recordButton} onClick={handleStart}>
              <span className={styles.recordDot} />
            </button>
          </>
        )}

        {state === 'requesting' && <p className={styles.hint}>Requesting microphone access…</p>}

        {state === 'recording' && (
          <>
            <div className={styles.meter}>
              <div className={styles.meterFill} style={{ transform: `scaleY(${0.15 + level * 0.85})` }} />
            </div>
            <p className={styles.duration}>{formatDuration(durationMs)}</p>
            <button type="button" className={styles.stopButton} onClick={handleStop}>
              <span className={styles.stopSquare} />
            </button>
          </>
        )}

        {state === 'stopped' && (
          <>
            <p className={styles.hint}>{formatDuration(durationMs)} recorded</p>
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <audio src={previewUrl} controls className={styles.preview} />
            <div className={styles.row}>
              <button type="button" className={styles.toolButton} onClick={handleRetake}>
                Retake
              </button>
              <button type="button" className={styles.doneButton} onClick={handleSave}>
                Save to entry
              </button>
            </div>
          </>
        )}

        {state === 'denied' && (
          <p className={styles.hint}>
            Microphone access was denied. Check your browser&rsquo;s site settings to allow
            it, then try again.
          </p>
        )}

        {state === 'error' && (
          <p className={styles.hint}>Something went wrong starting the recording. Please try again.</p>
        )}

        {state !== 'recording' && (
          <button type="button" className={styles.cancelLink} onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
