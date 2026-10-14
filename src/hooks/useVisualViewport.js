import { useEffect } from 'react';

/**
 * Keeps `--app-h` / `--app-top` in sync with the *visual* viewport so the
 * layout shrinks above the on-screen keyboard on iOS Safari too (it ignores
 * `interactive-widget=resizes-content` and `dvh` doesn't react to the
 * keyboard). Falls back silently to 100dvh when the API is missing.
 */
export function applyViewport(root, vv) {
  if (!vv) return;
  root.style.setProperty('--app-h', `${Math.round(vv.height)}px`);
  root.style.setProperty('--app-top', `${Math.round(vv.offsetTop || 0)}px`);
}

export function useVisualViewport() {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return undefined;
    const root = document.documentElement;
    const update = () => applyViewport(root, vv);
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
      root.style.removeProperty('--app-h');
      root.style.removeProperty('--app-top');
    };
  }, []);
}
