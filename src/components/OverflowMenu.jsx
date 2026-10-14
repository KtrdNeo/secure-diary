import { useEffect, useRef, useState } from 'react';
import { MoreIcon } from './icons.jsx';
import styles from './OverflowMenu.module.css';

/**
 * "More" popover for small screens. `items` = [{ key, label, onSelect, href?, danger? }];
 * `children` (e.g. the theme switcher) is rendered above the list.
 */
export default function OverflowMenu({ items, children, buttonClassName }) {
  const [open, setOpen] = useState(false);
  const firstRef = useRef(null);
  const buttonRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    firstRef.current?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <div className={styles.wrap}>
      <button
        ref={buttonRef}
        type="button"
        className={buttonClassName}
        aria-label="More"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <MoreIcon />
      </button>

      {open && (
        <>
          <div className={styles.backdrop} onPointerDown={() => setOpen(false)} aria-hidden="true" />
          <div className={styles.menu}>
            {children && <div className={styles.slot}>{children}</div>}
            <div className={styles.list} role="menu" aria-label="More actions">
            {items.map((item, i) => {
              const common = {
                key: item.key,
                role: 'menuitem',
                className: `${styles.item} ${item.danger ? styles.danger : ''}`,
                ref: i === 0 ? firstRef : undefined,
              };
              if (item.href) {
                return (
                  <a {...common} href={item.href} target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)}>
                    {item.label}
                  </a>
                );
              }
              return (
                <button
                  {...common}
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    item.onSelect();
                  }}
                >
                  {item.label}
                </button>
              );
            })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
