import { useState } from 'react';
import Modal from './Modal.jsx';
import { ShareIosIcon, AddSquareIcon } from './icons.jsx';
import styles from './panels.module.css';

/**
 * iOS has no install-prompt API, so the "Install" button opens this guided sheet
 * instead, worded for the browser the person is actually in.
 */
export default function InstallHelp({ onClose, browser = 'safari', ipad = false }) {
  const [copied, setCopied] = useState(false);
  const inApp = browser === 'inapp';
  const browserName = { chrome: 'Chrome', firefox: 'Firefox', edge: 'Edge' }[browser] ?? 'Safari';

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.origin + '/');
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  const shareWhere = browser === 'safari'
    ? ipad
      ? 'at the top of the screen'
      : 'in the toolbar at the bottom of the screen (at the top if your address bar is on top)'
    : 'next to the address bar';

  return (
    <Modal title="Install SecureDiary" subtitle="Add it to your Home Screen" onClose={onClose}>
      {inApp ? (
        <>
          <p className={styles.warnBox} role="note">
            You are inside another app&rsquo;s built-in browser, which cannot install apps. Open this page in{' '}
            <strong>Safari</strong> first.
          </p>
          <ol className={styles.steps}>
            <li>
              Tap the <strong>&hellip;</strong> / <strong>Share</strong> menu of this app and choose{' '}
              <strong>Open in Safari</strong> (or copy the link below and paste it into Safari).
            </li>
            <li>Then follow the install steps shown there.</li>
          </ol>
          <button type="button" className={styles.button} onClick={copyLink}>
            {copied ? 'Link copied ✓' : 'Copy link'}
          </button>
        </>
      ) : (
        <ol className={styles.installSteps}>
          <li>
            <span className={styles.stepIcon}>
              <ShareIosIcon width={26} height={26} />
            </span>
            <span>
              Tap the <strong>Share</strong> button (a square with an arrow pointing up) {shareWhere}
              {browser !== 'safari' ? ` in ${browserName}` : ''}.
            </span>
          </li>
          <li>
            <span className={styles.stepIcon}>
              <AddSquareIcon width={26} height={26} />
            </span>
            <span>
              Scroll the list and choose <strong>Add to Home Screen</strong>
              <span className={styles.subtle}> (tap &ldquo;View More&rdquo; first if you don&rsquo;t see it).</span>
            </span>
          </li>
          <li>
            <span className={styles.stepIcon} aria-hidden="true">
              ✓
            </span>
            <span>
              Tap <strong>Add</strong>. SecureDiary now sits on your Home Screen &mdash; open it from there.
            </span>
          </li>
        </ol>
      )}
      <p className={styles.note}>
        It opens full-screen like a normal app and works offline. Your entries stay on this device, encrypted.
        {!inApp && browser !== 'safari' ? ' Needs iOS 16.4 or newer in this browser; Safari works on every version.' : ''}
      </p>
    </Modal>
  );
}
