import { useState, useRef, useCallback } from 'react';
import { db } from '../db/schema.js';
import { useSessionKey } from '../session/SessionKeyProvider.jsx';
import { runFullDiagnostics, clearStuckSyncQueueItems } from '../health/diagnostics.js';
import { diagnoseTopic, DIAGNOSTIC_TOPICS } from '../health/diagnosticGuide.js';
import { exportBackup, importBackup } from '../health/backup.js';
import { exportEntriesToPdf } from '../health/pdfExport.js';
import { decryptData, decryptBinary } from '../utils/crypto.js';
import { decodeYDoc, yDocToPlainText } from './editor/yjsUtils.js';
import styles from './AdminDashboard.module.css';

function downloadBlob(bytes, filename, mimeType) {
  const blob = new Blob([bytes], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AdminDashboard({ onClose }) {
  const { cryptoKey } = useSessionKey();
  const [tab, setTab] = useState('health');
  const [report, setReport] = useState(null);
  const [loadingReport, setLoadingReport] = useState(false);
  const [topic, setTopic] = useState(null);
  const [statusMessage, setStatusMessage] = useState('');
  const fileInputRef = useRef(null);

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
    downloadBlob(bytes, `secure-diary-backup-${new Date().toISOString().slice(0, 10)}.json`, 'application/json');
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
        `Restored ${result.entries} entr${result.entries === 1 ? 'y' : 'ies'}, ${result.attachments} attachment(s). ${result.skipped} already existed and were left as-is.`
      );
    } catch (err) {
      setStatusMessage(`Import failed: ${err.message}`);
    } finally {
      e.target.value = '';
    }
  }

  async function handleExportAllPdf() {
    if (!cryptoKey) return;
    setStatusMessage('Preparing PDF\u2026');
    const entries = await db.entries.where('isDeleted').equals(0).toArray();
    const decrypted = [];
    for (const entry of entries) {
      try {
        const titleData = entry.titlePayload ? await decryptData(entry.titlePayload, cryptoKey) : { title: '' };
        let bodyText = '';
        if (entry.contentPayload) {
          const bytes = await decryptBinary(entry.contentPayload, cryptoKey);
          bodyText = yDocToPlainText(decodeYDoc(new Uint8Array(bytes)));
        }
        decrypted.push({ title: titleData.title, bodyText, createdAt: entry.createdAt });
      } catch {
        decrypted.push({ title: '[unreadable entry]', bodyText: '', createdAt: entry.createdAt });
      }
    }
    const pdfBytes = await exportEntriesToPdf(decrypted);
    downloadBlob(pdfBytes, `secure-diary-export-${new Date().toISOString().slice(0, 10)}.pdf`, 'application/pdf');
    setStatusMessage(`Exported ${decrypted.length} entries to PDF.`);
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

        <div className={styles.tabs}>
          {[
            ['health', 'Health'],
            ['diagnose', 'Diagnose'],
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
              Rule-based checks against your real local data - not an AI model. See CHECKPOINT_SUMMARY.md
              for why.
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

        {tab === 'backup' && (
          <div className={styles.section}>
            <p className={styles.hint}>
              Backups stay encrypted - the file is exactly as safe (and exactly as useless without your
              passphrase) as this app&rsquo;s own storage.
            </p>
            <button type="button" className={styles.actionButton} onClick={handleExportBackup}>
              Download backup (.json)
            </button>
            <button type="button" className={styles.actionButton} onClick={() => fileInputRef.current?.click()}>
              Restore from backup
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json"
              className={styles.hiddenInput}
              onChange={handleImportBackup}
            />
          </div>
        )}

        {tab === 'export' && (
          <div className={styles.section}>
            <p className={styles.hint}>
              Exports plain text with a visible attribution watermark on every page. Non-Latin text (e.g.
              Sinhala) isn&rsquo;t rendered correctly yet - see CHECKPOINT_SUMMARY.md.
            </p>
            <button type="button" className={styles.actionButton} onClick={handleExportAllPdf}>
              Export all entries to PDF
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
