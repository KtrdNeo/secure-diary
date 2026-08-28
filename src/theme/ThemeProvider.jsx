import { createContext, useContext, useCallback, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/schema.js';
import { THEMES, DEFAULT_THEME } from './themeList.js';

export { THEMES };

const ThemeContext = createContext(null);

/**
 * Reads/writes the active theme from Dexie's `settings` table (key:
 * 'theme') via useLiveQuery, so the choice survives a reload and will
 * naturally pick up remote changes once the Phase 4 sync engine exists.
 */
export function ThemeProvider({ children }) {
  const themeSetting = useLiveQuery(() => db.settings.get('theme'), []);
  const theme = themeSetting?.value ?? DEFAULT_THEME;

  const setTheme = useCallback(async (nextTheme) => {
    await db.settings.put({ key: 'theme', value: nextTheme });
  }, []);

  // Plain CSS (not React) drives the actual colors, via
  // :root[data-theme="..."] blocks in theme/themes.css - so a theme
  // switch never needs to re-render the component tree.
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, themes: THEMES }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
  return ctx;
}
