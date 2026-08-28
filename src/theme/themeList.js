/**
 * Pure data, deliberately kept out of ThemeProvider.jsx (which has JSX
 * and therefore can't be imported by a plain Node test without a build
 * step) so tests/theme.test.mjs can import this directly and check it
 * against theme/themes.css without drifting out of sync.
 */
export const THEMES = [
  { id: 'light-leather', label: 'Light Leather' },
  { id: 'dark-obsidian', label: 'Dark Obsidian' },
  { id: 'sepia-vintage', label: 'Sepia Vintage' },
];

export const DEFAULT_THEME = 'light-leather';
