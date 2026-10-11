import { useTheme } from '../theme/ThemeProvider.jsx';
import styles from './ThemeSwitcher.module.css';

export default function ThemeSwitcher({ variant = 'bar' }) {
  const { theme, setTheme, themes } = useTheme();

  return (
    <fieldset className={`${styles.switcher} ${variant === 'menu' ? styles.inMenu : ''}`}>
      <legend className={styles.legend}>Theme</legend>
      <div className={styles.options}>
        {themes.map((t) => (
          <label key={t.id} className={styles.option} data-theme-preview={t.id}>
            <input
              type="radio"
              name="theme"
              value={t.id}
              checked={theme === t.id}
              onChange={() => setTheme(t.id)}
              className={styles.input}
            />
            <span className={styles.swatch} aria-hidden="true" />
            <span className={styles.label}>{t.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
