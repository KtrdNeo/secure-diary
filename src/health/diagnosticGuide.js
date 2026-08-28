/**
 * src/health/diagnosticGuide.js
 *
 * "Diagnostic AI guide" (Feature 7), built as a genuine rule-based
 * decision engine over REAL diagnostics.js data - not an LLM. A real
 * LLM-backed version would need a server-side proxy to call any AI
 * API without embedding a secret key in client-side PWA code (a
 * standalone app like this has no equivalent to the request-proxying
 * an Anthropic-artifact gets automatically) - a legitimate, different,
 * bigger feature than what's built here, not attempted this phase.
 * What's here is honest about being rule-based, and it earns the
 * "diagnostic" part of its name by reasoning over your actual local
 * data (sync queue depth, entry integrity, storage quota) rather than
 * generic troubleshooting copy.
 */
export const DIAGNOSTIC_TOPICS = [
  { id: 'sync', label: "Sync isn't working" },
  { id: 'missing', label: 'An entry looks missing or broken' },
  { id: 'slow', label: 'The app feels slow' },
  { id: 'storage', label: 'Worried about running out of space' },
];

/**
 * @param {string} topicId
 * @param {object} report - from diagnostics.js's runFullDiagnostics()
 * @returns {{findings: string[], suggestions: string[]}}
 */
export function diagnoseTopic(topicId, report) {
  switch (topicId) {
    case 'sync':
      return diagnoseSync(report);
    case 'missing':
      return diagnoseMissing(report);
    case 'slow':
      return diagnoseSlow(report);
    case 'storage':
      return diagnoseStorage(report);
    default:
      return { findings: [], suggestions: [] };
  }
}

function diagnoseSync(report) {
  const findings = [];
  const suggestions = [];
  const { syncQueue } = report;

  if (syncQueue.pendingCount === 0) {
    findings.push('Nothing is currently waiting to sync - your sync queue is empty.');
    suggestions.push('If you expected new content on another device, try "Sync now" from the Sync panel to pull remote changes.');
  } else {
    findings.push(`${syncQueue.pendingCount} item(s) are waiting to sync.`);
    if (syncQueue.stuckCount > 0) {
      findings.push(`${syncQueue.stuckCount} of those have failed repeatedly (5+ attempts) and are likely stuck.`);
      suggestions.push('Use "Clear stuck items" in the Admin panel - this only clears the retry queue, your actual entry is untouched and will be re-queued on its next edit.');
    }
    if (syncQueue.oldestPendingAgeMs && syncQueue.oldestPendingAgeMs > 24 * 60 * 60 * 1000) {
      findings.push('The oldest pending item has been waiting more than a day.');
      suggestions.push('Check that Sync is configured (Footer -> Sync) and that you\u2019re signed in.');
    }
  }
  return { findings, suggestions };
}

function diagnoseMissing(report) {
  const findings = [];
  const suggestions = [];
  const { integrity, entryStats } = report;

  findings.push(`${entryStats.liveEntries} entries are currently visible; ${entryStats.deletedEntries} are marked deleted.`);

  if (integrity) {
    if (integrity.brokenCount === 0) {
      findings.push('Every entry decrypted successfully - nothing appears corrupted.');
    } else {
      findings.push(`${integrity.brokenCount} entr${integrity.brokenCount === 1 ? 'y' : 'ies'} failed to decrypt.`);
      suggestions.push('A broken entry usually means locally-corrupted data (not a wrong passphrase, since your other entries opened fine). Check Admin \u2192 Backups for a recent backup to restore from.');
    }
  } else {
    suggestions.push('Unlock the app first so entry integrity can actually be checked, rather than guessed at.');
  }
  return { findings, suggestions };
}

function diagnoseSlow(report) {
  const findings = [];
  const suggestions = [];
  const { entryStats, storage } = report;

  findings.push(`${entryStats.totalEntries} entries, ${entryStats.attachmentCount} attachments, ${entryStats.versionCount} saved versions in total.`);

  if (entryStats.versionCount > entryStats.liveEntries * 20) {
    findings.push('You have a lot of saved versions relative to your entry count.');
    suggestions.push('Version history isn\u2019t currently prunable from the UI - noted as a good candidate for a future cleanup tool.');
  }
  if (storage.supported && storage.usagePct != null && storage.usagePct > 80) {
    findings.push(`Local storage is at ${storage.usagePct}% of its estimated quota.`);
    suggestions.push('Consider exporting a backup and clearing older attachments you no longer need.');
  } else {
    suggestions.push('Storage and entry count don\u2019t look unusual - if it\u2019s specifically page-flipping that feels slow, that\u2019s more likely a rendering cost proportional to entry count than a storage issue.');
  }
  return { findings, suggestions };
}

function diagnoseStorage(report) {
  const findings = [];
  const suggestions = [];
  const { storage, entryStats } = report;

  if (!storage.supported) {
    findings.push('This browser doesn\u2019t expose a storage-quota estimate, so an exact number isn\u2019t available.');
    suggestions.push(`You have ${entryStats.totalEntries} entries and ${entryStats.attachmentCount} attachments stored - export a backup periodically as good practice regardless.`);
  } else {
    const usageMb = (storage.usageBytes / (1024 * 1024)).toFixed(1);
    const quotaMb = (storage.quotaBytes / (1024 * 1024)).toFixed(0);
    findings.push(`Using approximately ${usageMb} MB of an estimated ${quotaMb} MB available (${storage.usagePct}%).`);
    if (storage.usagePct > 80) {
      suggestions.push('You\u2019re getting close to the estimated limit - export a backup, and consider that voice/drawing attachments are usually the largest contributors.');
    } else {
      suggestions.push('Comfortably within quota - nothing to do here.');
    }
  }
  return { findings, suggestions };
}
