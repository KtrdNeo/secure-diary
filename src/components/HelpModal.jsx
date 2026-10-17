import Modal from './Modal.jsx';
import styles from './panels.module.css';

export default function HelpModal({ onClose }) {
  return (
    <Modal title="Getting started" subtitle="Everything here is encrypted on this device." onClose={onClose} wide>
      <div className={styles.help}>
        <h3>Writing</h3>
        <ul>
          <li>The last page of the diary is always blank - just start typing. Entries save by themselves.</li>
          <li>Pick a template (daily journal, gratitude, to-do, meeting, mood, weekly review) or a writing prompt on an empty page.</li>
          <li>Turn pages with the folded corner or by dragging; use <b>New entry</b> to jump to the blank page.</li>
        </ul>

        <h3>Toolbar</h3>
        <ul>
          <li><b>B / I / S</b> bold, italic, strikethrough. <b>H1 / H2</b> headings.</li>
          <li><b>Checklist</b> to-do items with a progress bar. <b>Choices</b> single-choice list. <b>Table</b>. <b>Note</b> highlighted callout.</li>
          <li><b>Draw</b> sketch on a canvas. <b>Voice</b> record an encrypted voice note.</li>
          <li><b>Sinhala</b> type in Singlish or with the Wijesekara layout and insert Unicode Sinhala.</li>
        </ul>

        <h3>Finding and keeping things</h3>
        <ul>
          <li><b>Search</b> looks through all entries (decrypted in memory only, never stored).</li>
          <li><b>History</b> under an entry restores older versions.</li>
          <li><b>Delete</b> moves an entry to the trash; restore it from Admin &rarr; Trash.</li>
          <li><b>Stats</b> shows your writing streak. <b>Export</b> saves one entry as text; Admin has full backup and PDF.</li>
        </ul>

        <h3>Privacy</h3>
        <ul>
          <li>Your passphrase is never stored. <b>If you forget it, nobody can recover your entries.</b></li>
          <li><b>Lock</b> hides the diary immediately. Auto-lock after inactivity is in Settings.</li>
          <li>Download a backup from Admin now and then.</li>
          <li><b>Seal</b> an entry to hide it until a date. <b>Sounds</b> plays gentle focus audio. <b>Connections</b> maps related entries.</li>
        </ul>
      </div>
    </Modal>
  );
}
