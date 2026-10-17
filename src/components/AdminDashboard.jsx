import { useState, useRef, useCallback, useEffect } from 'react';
import { db } from '../db/schema.js';
import { useSessionKey } from '../session/SessionKeyProvider.jsx';
import { runFullDiagnostics, clearStuckSyncQueueItems } from '../health/diagnostics.js';
import { diagnoseTopic, DIAGNOSTIC_TOPICS } from '../health/diagnosticGuide.js';
import { exportBackup, importBackup } from '../health/backup.js';
import { exportEntriesToPdf } from '../health/pdfExport.js';
import { decryptData, decryptBinary } from '../utils/crypto.js';
import { decodeYDoc, yDocToPlainText } from './editor/yjsUtils.js';
import { downloadBytes } from '../features/download.js';
import { yDocToMarkdown, entriesToMarkdown } from '../features/markdown.js';
import { isSealed } from '../features/capsule.js';
import { printEntries } from '../features/printEntries.js';
import { countDeleted, restoreDeletedEntries, purgeDeletedEntries } from '../features/trash.js';
import styles from './AdminDashboard.module.css';

const downloadBlob = downloadBytes;

export default function AdminDashboard({ onClose }) {
  const { cryptoKey, lock } = useSessionKey();
  const [tab, setTab] = useState('health');
  const [report, setReport] = useState(null);
  const [loadingReport, setLoadingReport] = useState(false);
  const [topic, setTopic] = useState(null);
  const [statusMessage, setStatusMessage] = useState('');
  const fileInputRef = useRef(null);
  const [trashCount, setTrashCount] = useState(null);
  const [confirmPurge, setConfirmPurge] = useState(false);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    if (tab !== 'trash') return undefined;
    let cancelled = false;
    countDeleted(db).then((n) => {
      if (!cancelled) setTrashCount(n);
    });
    return () => {
      cancelled = true;
    };
  }, [tab]);

  async function handleRestoreTrash() {
    const n = await restoreDeletedEntries(db);
    setTrashCount(0);
    setStatusMessage(n ? `Restored ${n} entr${n === 1 ? 'y' : 'ies'}.` : 'Trash is empty.');
  }

  async function handlePurgeTrash() {
    const n = await purgeDeletedEntries(db);
    setTrashCount(0);
    setConfirmPurge(false);
    setStatusMessage(n ? `Permanently deleted ${n} entr${n === 1 ? 'y' : 'ies'}.` : 'Trash is empty.');
  }

  const refreshReport = useCallback(async () => {
    setLoadingReport(true);
    const result = await runFullDiagnostics(db, cryptoKey);
    setReport(result);
    setLoadingReport(false);
  }, [cryptoKey]);

  async function handleClearStuck() {
    const result = await clearStuckSyncQueueItems(db);
    setStatusMessage(`Cleared ${result.cleared} stuck sync item(s).`);
    refreshReport();
  }

  async function handleExportBackup() {
    const backup = await exportBackup(db);
    const bytes = new TextEncoder().encode(JSON.stringify(backup, null, 2));
    downloadBlob(bytes, `secure-diary-backup-${new Date().toISOString().slice(0, 10)}.diary`, 'application/x-securediary');
    setStatusMessage('Backup downloaded.');
  }

  async function handleImportBackup(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const result = await importBackup(db, parsed, { mode: 'skip' });
      setStatusMessage(
        `Restored ${result.entries} entr${result.entries === 1 ? 'y' : 'ies'}, ${result.attachments} attachment(s). ${result.skipped} already existed and were left as-is.` +
          (result.setup === 'replaced' ? ' Locking - unlock with the passphrase the backup was made with.' : '')
      );
      if (result.setup === 'replaced') setTimeout(lock, 1800);
    } catch (err) {
      setStatusMessage(`Import failed: ${err.message}`);
    } finally {
      e.target.value = '';
    }
  }

  async function loadDecryptedEntries() {
    const entries = await db.entries.where('isDeleted').equals(0).toArray();
    const decrypted = [];
    for (const entry of entries) {
      try {
        const titleData = entry.titlePayload ? await decryptData(entry.titlePayload, cryptoKey) : { title: '' };
        let bodyText = '';
        let bodyMarkdown = '';
        if (isSealed(titleData.sealUntil)) {
          bodyText = `[Sealed time capsule - opens ${new Date(titleData.sealUntil).toLocaleDateString()}]`;
          bodyMarkdown = `*${bodyText}*`;
        } else if (entry.contentPayload) {
          const bytes = await decryptBinary(entry.contentPayload, cryptoKey);
          const doc = decodeYDoc(new Uint8Array(bytes));
          bodyText = yDocToPlainText(doc);
          bodyMarkdown = yDocToMarkdown(doc);
        }
        decrypted.push({ title: titleData.title, bodyText, bodyMarkdown, createdAt: entry.createdAt });
      } catch {
        decrypted.push({ title: '[unreadable entry]', bodyText: '', createdAt: entry.createdAt });
      }
    }
    return decrypted;
  }

  async function handleExportAllPdf() {
    if (!cryptoKey) return;
    setStatusMessage('Preparing PDF\u2026');
    const decrypted = await loadDecryptedEntries();
    const pdfBytes = await exportEntriesToPdf(decrypted);
    downloadBlob(pdfBytes, `secure-diary-export-${new Date().toISOString().slice(0, 10)}.pdf`, 'application/pdf');
    setStatusMessage(`Exported ${decrypted.length} entries to PDF.`);
  }

  async function handleExportMarkdown() {
    if (!cryptoKey) return;
    setStatusMessage('Preparing Markdown\u2026');
    const decrypted = (await loadDecryptedEntries()).sort((a, b) => a.createdAt - b.createdAt);
    downloadBlob(
      new TextEncoder().encode(entriesToMarkdown(decrypted)),
      `secure-diary-export-${new Date().toISOString().slice(0, 10)}.md`,
      'text/markdown'
    );
    setStatusMessage(`Exported ${decrypted.length} entries to Markdown (not encrypted - keep the file safe).`);
  }

  async function handlePrintAll() {
    if (!cryptoKey) return;
    setStatusMessage('Preparing print view\u2026');
    const decrypted = await loadDecryptedEntries();
    await printEntries(decrypted);
    setStatusMessage('Print dialog opened - choose "Save as PDF" to keep a copy.');
  }

  const diagnosis = topic && report ? diagnoseTopic(topic, report) : null;

  return (
    <div className={styles.overlay} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.panel} role="dialog" aria-modal="true" aria-label="Admin dashboard">
        <div className={styles.header}>
          <h2 className={styles.title}>Admin</h2>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className={styles.tabs} data-scrollrow role="tablist">
          {[
            ['health', 'Health'],
            ['diagnose', 'Diagnose'],
            ['trash', 'Trash'],
            ['backup', 'Backup'],
            ['export', 'Export'],
          ].map(([id, label]) => (
            <button key={id} type="button" className={styles.tab} aria-pressed={tab === id} onClick={() => setTab(id)}>
              {label}
            </button>
          ))}
        </div>

        {statusMessage && <p className={styles.status}>{statusMessage}</p>}

        {tab === 'health' && (
          <div className={styles.section}>
            <button type="button" className={styles.actionButton} onClick={refreshReport} disabled={loadingReport}>
              {loadingReport ? 'Running\u2026' : 'Run diagnostics'}
            </button>
            {report && (
              <dl className={styles.reportList}>
                <dt>Database</dt>
                <dd>{report.ping.ok ? 'OK' : `Failed: ${report.ping.error}`}</dd>
                <dt>Entries</dt>
                <dd>
                  {report.entryStats.liveEntries} live, {report.entryStats.deletedEntries} deleted,{' '}
                  {report.entryStats.attachmentCount} attachments, {report.entryStats.versionCount} versions
                </dd>
                <dt>Sync queue</dt>
                <dd>
                  {report.syncQueue.pendingCount} pending
                  {report.syncQueue.stuckCount > 0 && `, ${report.syncQueue.stuckCount} stuck`}
                </dd>
                {report.syncQueue.stuckCount > 0 && (
                  <button type="button" className={styles.smallButton} onClick={handleClearStuck}>
                    Clear stuck items
                  </button>
                )}
                <dt>Storage</dt>
                <dd>
                  {report.storage.supported
                    ? `${(report.storage.usageBytes / (1024 * 1024)).toFixed(1)} MB used (${report.storage.usagePct}%)`
                    : 'Not reported by this browser'}
                </dd>
                <dt>Entry integrity</dt>
                <dd>
                  {report.integrity
                    ? `${report.integrity.checked - report.integrity.brokenCount} / ${report.integrity.checked} decrypt correctly`
                    : 'Unavailable (locked)'}
                </dd>
              </dl>
            )}
          </div>
        )}

        {tab === 'diagnose' && (
          <div className={styles.section}>
            <p className={styles.hint}>
              Rule-based checks run on your real local data, entirely on this device.
            </p>
            <div className={styles.topicList}>
              {DIAGNOSTIC_TOPICS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={styles.topicButton}
                  aria-pressed={topic === t.id}
                  onClick={async () => {
                    setTopic(t.id);
                    if (!report) await refreshReport();
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>
            {diagnosis && (
              <div className={styles.diagnosis}>
                <p className={styles.diagnosisHeading}>Findings</p>
                <ul>
                  {diagnosis.findings.map((f, i) => (
                    <li key={i}>{f}</li>
                  ))}
                </ul>
                {diagnosis.suggestions.length > 0 && (
                  <>
                    <p className={styles.diagnosisHeading}>Suggestions</p>
                    <ul>
                      {diagnosis.suggestions.map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {tab === 'trash' && (
          <div className={styles.section}>
            <p className={styles.hint}>
              Deleted entries stay here, still encrypted, until restored. Restored entries return to the diary
              in their original order.
            </p>
            <p className={styles.hint}>
              {trashCount === null ? 'Checking…' : `${trashCount} entr${trashCount === 1 ? 'y' : 'ies'} in the trash.`}
            </p>
            <button
              type="button"
              className={styles.actionButton}
              onClick={handleRestoreTrash}
              disabled={!trashCount}
            >
              Restore all
            </button>
            {!confirmPurge ? (
              <button type="button" className={styles.actionButton} onClick={() => setConfirmPurge(true)} disabled={!trashCount}>
                Delete forever&hellip;
              </button>
            ) : (
              <>
                <p className={styles.hint}>
                  This permanently erases {trashCount} entr{trashCount === 1 ? 'y' : 'ies'} (with drawings,
                  recordings and history) from this device. It can&rsquo;t be undone, and copies already synced
                  to the cloud are not removed.
                </p>
                <button type="button" className={styles.actionButton} onClick={handlePurgeTrash}>
                  Yes, delete forever
                </button>
                <button type="button" className={styles.actionButton} onClick={() => setConfirmPurge(false)}>
                  Cancel
                </button>
              </>
            )}
          </div>
        )}

        {tab === 'backup' && (
          <div className={styles.section}>
            <p className={styles.hint}>
              Backups stay encrypted - the file is exactly as safe (and exactly as useless without your
              passphrase) as this app&rsquo;s own storage.
            </p>
            <button type="button" className={styles.actionButton} onClick={handleExportBackup}>
              Download encrypted backup (.diary)
            </button>
            <button type="button" className={styles.actionButton} onClick={() => fileInputRef.current?.click()}>
              Restore from backup
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".diary,.json,application/json"
              className={styles.hiddenInput}
              onChange={handleImportBackup}
            />
          </div>
        )}

        {tab === 'export' && (
          <div className={styles.section}>
            <p className={styles.hint}>
              Quick PDF is Latin text only. For Sinhala (or any other script) use Print / Save as PDF -
              your browser draws the text correctly. Both add the attribution line on every page. Markdown is plain text (not encrypted) - handle the file with care.
            </p>
            <button type="button" className={styles.actionButton} onClick={handleExportAllPdf}>
              Quick PDF (Latin text)
            </button>
            <button type="button" className={styles.actionButton} onClick={handlePrintAll}>
              Print / Save as PDF (Sinhala-ready)
            </button>
            <button type="button" className={styles.actionButton} onClick={handleExportMarkdown}>
              Markdown (.md) - all entries
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
