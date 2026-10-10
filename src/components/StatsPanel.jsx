import { useEffect, useState } from 'react';
import Modal from './Modal.jsx';
import { db } from '../db/schema.js';
import { diaryStats } from '../features/stats.js';
import styles from './panels.module.css';

export default function StatsPanel({ onClose }) {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    let cancelled = false;
    db.entries
      .filter((e) => e.isDeleted === 0)
      .toArray()
      .then((rows) => {
        if (!cancelled) setStats(diaryStats(rows.map((r) => r.createdAt)));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const items = stats && [
    [stats.currentStreak, 'Current streak (days)'],
    [stats.longestStreak, 'Longest streak (days)'],
    [stats.total, 'Total entries'],
    [stats.last7Days, 'Entries, last 7 days'],
    [stats.thisMonth, 'Entries this month'],
  ];

  return (
    <Modal title="Your writing" subtitle="Counted from entry dates only - nothing is decrypted." onClose={onClose}>
      {!stats ? (
        <p className={styles.note}>Counting…</p>
      ) : (
        <div className={styles.grid}>
          {items.map(([value, label]) => (
            <div key={label} className={styles.stat}>
              <div className={styles.statValue}>{value}</div>
              <div className={styles.statLabel}>{label}</div>
            </div>
          ))}
        </div>
      )}
      <p className={styles.note}>A streak counts consecutive days with at least one entry.</p>
    </Modal>
  );
}
