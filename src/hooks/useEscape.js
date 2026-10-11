import { useEffect } from 'react';

/** Calls `handler` when Escape is pressed while the component is mounted. */
export function useEscape(handler) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') handler();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [handler]);
}
