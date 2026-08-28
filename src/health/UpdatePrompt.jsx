import { useRegisterSW } from 'virtual:pwa-register/react';
import styles from './UpdatePrompt.module.css';

/**
 * Deliberately never reloads on its own. A background autosave could be
 * mid-write when a new version becomes available; silently reloading
 * the page out from under that is a worse failure mode than just
 * asking. offlineReady is shown once, briefly, as reassurance rather
 * than an action the person needs to take.
 */
export default function UpdatePrompt() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisterError: (error) => {
      // eslint-disable-next-line no-console
      console.error('Service worker registration failed:', error);
    },
  });

  if (!offlineReady && !needRefresh) return null;

  function dismiss() {
    setOfflineReady(false);
    setNeedRefresh(false);
  }

  return (
    <div className={styles.toast} role="status">
      {needRefresh ? (
        <>
          <span>An update is ready.</span>
          <button type="button" className={styles.action} onClick={() => updateServiceWorker(true)}>
            Reload
          </button>
        </>
      ) : (
        <span>Ready to work offline.</span>
      )}
      <button type="button" className={styles.dismiss} onClick={dismiss} aria-label="Dismiss">
        ×
      </button>
    </div>
  );
}
