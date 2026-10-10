import { useState } from 'react';
import { TEMPLATES } from '../../features/templates.js';
import { promptForDate, randomPrompt } from '../../features/prompts.js';
import styles from './WelcomeCard.module.css';

/** Shown on an empty page: pick a starting point instead of staring at a blank sheet. */
export default function WelcomeCard({ onPickTemplate, onUsePrompt, onOpenHelp, onDismiss }) {
  const [prompt, setPrompt] = useState(() => promptForDate(new Date()));

  return (
    <div className={styles.card}>
      <div className={styles.head}>
        <p className={styles.lead}>A blank page. Start typing, or begin with one of these:</p>
        {onDismiss && (
          <button type="button" className={styles.dismiss} onClick={onDismiss} aria-label="Hide suggestions">
            ×
          </button>
        )}
      </div>

      <div className={styles.templates}>
        {TEMPLATES.map((t) => (
          <button key={t.id} type="button" className={styles.template} onClick={() => onPickTemplate(t.id)} title={t.description}>
            <span className={styles.icon} aria-hidden="true">{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      <div className={styles.prompt}>
        <span className={styles.promptLabel}>Prompt</span>
        <p className={styles.promptText}>{prompt}</p>
        <div className={styles.promptActions}>
          <button type="button" className={styles.link} onClick={() => onUsePrompt(prompt)}>
            Write about this
          </button>
          <button type="button" className={styles.link} onClick={() => setPrompt((p) => randomPrompt(p))}>
            Another prompt
          </button>
          <button type="button" className={styles.link} onClick={onOpenHelp}>
            How this works
          </button>
        </div>
      </div>
    </div>
  );
}
