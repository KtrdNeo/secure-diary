import { useEffect } from 'react';

const DIALOG = '[role="dialog"][aria-modal="true"]';
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function focusableIn(root) {
  return [...root.querySelectorAll(FOCUSABLE)].filter(
    (el) => !el.hasAttribute('hidden') && el.getClientRects().length > 0
  );
}

export function topDialog(doc = document) {
  const all = doc.querySelectorAll(DIALOG);
  return all.length ? all[all.length - 1] : null;
}

/**
 * One app-wide manager for every modal dialog (they all share
 * role="dialog" aria-modal="true"): moves focus into a dialog when it opens,
 * keeps Tab/Shift+Tab inside the top dialog, and returns focus to whatever
 * opened it when it closes.
 */
export function useDialogFocus() {
  useEffect(() => {
    const openers = new Map(); // dialog element -> element focused before it opened

    const sync = () => {
      const current = new Set(document.querySelectorAll(DIALOG));
      current.forEach((dlg) => {
        if (!openers.has(dlg)) {
          const prev = document.activeElement;
          openers.set(dlg, prev && prev !== document.body && !dlg.contains(prev) ? prev : null);
          if (!dlg.contains(document.activeElement)) {
            const first = focusableIn(dlg)[0];
            (first || dlg).focus?.({ preventScroll: true });
          }
        }
      });
      [...openers.keys()].forEach((dlg) => {
        if (!current.has(dlg)) {
          const opener = openers.get(dlg);
          openers.delete(dlg);
          if (opener && opener.isConnected && current.size === 0) opener.focus?.({ preventScroll: true });
        }
      });
    };

    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true });
    sync();

    const onKeyDown = (e) => {
      if (e.key !== 'Tab') return;
      const dlg = topDialog();
      if (!dlg) return;
      const items = focusableIn(dlg);
      if (!items.length) {
        e.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (!dlg.contains(active)) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown, true);

    return () => {
      observer.disconnect();
      document.removeEventListener('keydown', onKeyDown, true);
    };
  }, []);
}
