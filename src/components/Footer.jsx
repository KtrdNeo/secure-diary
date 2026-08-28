import { useState } from 'react';
import LegalModal from './LegalModal.jsx';
import SyncPanel from './SyncPanel.jsx';
import AdminDashboard from './AdminDashboard.jsx';
import { APP_CREDIT } from '../config/legal.js';
import styles from './Footer.module.css';

export default function Footer() {
  const [legalOpen, setLegalOpen] = useState(false);
  const [syncOpen, setSyncOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);

  return (
    <footer className={styles.footer}>
      <p className={styles.credit}>{APP_CREDIT}</p>
      <button type="button" className={styles.legalButton} onClick={() => setAdminOpen(true)}>
        Admin
      </button>
      <button type="button" className={styles.legalButton} onClick={() => setSyncOpen(true)}>
        Sync
      </button>
      <button type="button" className={styles.legalButton} onClick={() => setLegalOpen(true)}>
        Legal &amp; About
      </button>
      {legalOpen && <LegalModal onClose={() => setLegalOpen(false)} />}
      {syncOpen && <SyncPanel onClose={() => setSyncOpen(false)} />}
      {adminOpen && <AdminDashboard onClose={() => setAdminOpen(false)} />}
    </footer>
  );
}
