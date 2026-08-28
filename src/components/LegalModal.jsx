import { useEffect, useRef } from 'react';
import { APP_NAME, APP_VERSION, APP_CREDIT } from '../config/legal.js';
import styles from './LegalModal.module.css';

export default function LegalModal({ onClose }) {
  const closeButtonRef = useRef(null);

  useEffect(() => {
    closeButtonRef.current?.focus();
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      className={styles.overlay}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="legal-modal-title"
      >
        <button
          type="button"
          ref={closeButtonRef}
          className={styles.close}
          onClick={onClose}
          aria-label="Close"
        >
          ×
        </button>

        <h2 id="legal-modal-title" className={styles.title}>
          {APP_NAME} <span className={styles.version}>v{APP_VERSION}</span>
        </h2>
        <p className={styles.creditLine}>{APP_CREDIT}</p>

        <div className={styles.body}>
          <h3>Zero-knowledge encryption</h3>
          <p>
            Every entry is encrypted on this device, with a key derived from your
            passphrase, before it is ever written to storage. The passphrase itself is
            never stored anywhere, on this device or otherwise - if it's lost, entries
            encrypted with it cannot be recovered by anyone, including the developer.
            When multi-device sync is added, only that same ciphertext will ever leave
            this device.
          </p>
        </div>
      </div>
    </div>
  );
}
