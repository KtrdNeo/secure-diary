import { useEffect, useState } from 'react';
import Modal from './Modal.jsx';
import {
  AMBIENT_PRESETS,
  getAmbientState,
  setAmbientVolume,
  startAmbient,
  stopAmbient,
  subscribeAmbient,
} from '../features/ambient.js';
import styles from './panels.module.css';

export default function AmbientPanel({ onClose }) {
  const [state, setState] = useState(getAmbientState);
  const [error, setError] = useState('');
  useEffect(() => subscribeAmbient(setState), []);

  function play(id) {
    setError('');
    if (!startAmbient(id)) setError('Sound is not available in this browser.');
  }

  return (
    <Modal title="Ambient sounds" onClose={onClose}>
      <p className={styles.note}>
        Gentle sounds for writing. Beats work best with headphones. Sound keeps playing when you close this
        window and stops when you lock the diary.
      </p>
      <div className={styles.presetGrid} role="group" aria-label="Sound presets">
        {AMBIENT_PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            className={styles.presetButton}
            aria-pressed={state.playing && state.presetId === p.id}
            onClick={() => (state.playing && state.presetId === p.id ? stopAmbient() : play(p.id))}
          >
            <span>{p.label}</span>
            <small>{p.hint}</small>
          </button>
        ))}
      </div>
      <div className={styles.row}>
        <label htmlFor="ambient-volume">Volume</label>
        <input
          id="ambient-volume"
          className={styles.range}
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={state.volume}
          onChange={(e) => setAmbientVolume(e.target.value)}
        />
      </div>
      {error && <p className={styles.note} role="alert">{error}</p>}
      <div className={styles.row}>
        <button type="button" className={styles.button} onClick={stopAmbient} disabled={!state.playing}>
          Stop sound
        </button>
      </div>
    </Modal>
  );
}
