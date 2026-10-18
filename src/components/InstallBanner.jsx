import { useState } from 'react';
import { InstallIcon } from './icons.jsx';
import styles from './InstallBanner.module.css';

const KEY = 'sd-install-dismissed';
const SNOOZE_MS = 14 * 24 * 3600 * 1000;

function snoozed() {
  try {
    const t = Number(localStorage.getItem(KEY));
    return t > 0 && Date.now() - t < SNOOZE_MS;
  } catch {
    return false;
  }
}

/** A slim, dismissible "Install" strip under the app bar (iOS phones and any browser that can prompt). */
export default function InstallBanner({ onInstall }) {
  const [hidden, setHidden] = useState(snoozed);
  if (hidden) return null;
  return (
    <div className={styles.banner} role="region" aria-label="Install the app">
      <span className={styles.text}>
        Install SecureDiary<span className={styles.more}> &mdash; full-screen &amp; offline</span>
      </span>
      <button type="button" className={styles.install} onClick={onInstall}>
        <InstallIcon width={16} height={16} />
        Install
      </button>
      <button
        type="button"
        className={styles.dismiss}
        aria-label="Dismiss install suggestion"
        onClick={() => {
          try {
            localStorage.setItem(KEY, String(Date.now()));
          } catch {
            /* private mode: just hide for this session */
          }
          setHidden(true);
        }}
      >
        ×
      </button>
    </div>
  );
}
