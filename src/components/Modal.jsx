import { useEffect, useRef } from 'react';
import styles from './LegalModal.module.css';

/** Generic dialog reusing the Legal modal's look (overlay, Esc, click-outside). */
export default function Modal({ title, subtitle, onClose, children, wide = false }) {
  const closeRef = useRef(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className={styles.overlay} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        className={styles.dialog}
        style={wide ? { width: 'min(640px, 100%)' } : undefined}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <button type="button" ref={closeRef} className={styles.close} onClick={onClose} aria-label="Close">
          ×
        </button>
        <h2 className={styles.title}>{title}</h2>
        {subtitle && <p className={styles.creditLine}>{subtitle}</p>}
        <div className={styles.body}>{children}</div>
      </div>
    </div>
  );
}
