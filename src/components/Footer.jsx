import { APP_CREDIT } from '../config/legal.js';
import styles from './Footer.module.css';

/**
 * Credit line is always visible (Rule 01). The link buttons only show on wide
 * screens; on small screens the same destinations live in the app bar's
 * "More" menu so the footer stays a single quiet line.
 */
export default function Footer({ onOpenPanel }) {
  return (
    <footer className={styles.footer}>
      <p className={styles.credit}>{APP_CREDIT}</p>
      <div className={styles.links}>
        <button type="button" className={styles.legalButton} onClick={() => onOpenPanel('help')}>
          Help
        </button>
        <button type="button" className={styles.legalButton} onClick={() => onOpenPanel('trash')}>
          Trash
        </button>
        <button type="button" className={styles.legalButton} onClick={() => onOpenPanel('admin')}>
          Admin
        </button>
        <button type="button" className={styles.legalButton} onClick={() => onOpenPanel('sync')}>
          Sync
        </button>
        <button type="button" className={styles.legalButton} onClick={() => onOpenPanel('legal')}>
          Legal &amp; About
        </button>
        <a href="/diagnostics.html" className={styles.legalButton} target="_blank" rel="noopener noreferrer">
          Diagnostics
        </a>
      </div>
    </footer>
  );
}
