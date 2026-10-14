import {
  generateSalt,
  deriveKeyFromPassphrase,
  createVerifier,
  verifyPassphrase,
  encryptData,
  decryptData,
  encryptBinary,
  decryptBinary,
} from '../utils/crypto.js';

export const MIN_PASSPHRASE_LENGTH = 8;

const isBinary = (p) => p?.ciphertext instanceof ArrayBuffer;

async function reencrypt(payload, oldKey, newKey) {
  if (!payload) return payload;
  if (isBinary(payload)) return encryptBinary(await decryptBinary(payload, oldKey), newKey);
  return encryptData(await decryptData(payload, oldKey), newKey);
}

/**
 * Change the passphrase: verify the current one, decrypt EVERYTHING with the
 * old key, re-encrypt with a key from a fresh salt, then commit all rows plus
 * the new salt/verifier in ONE transaction. Any failure before the commit
 * (wrong passphrase, an undecryptable row) leaves the database untouched.
 * Every row is queued for sync so other devices/cloud copies get replaced.
 *
 * @returns {Promise<{key: CryptoKey, entries: number, attachments: number, versions: number}>}
 */
export async function changePassphrase(db, { currentPassphrase, newPassphrase }) {
  if (typeof newPassphrase !== 'string' || newPassphrase.length < MIN_PASSPHRASE_LENGTH) {
    throw new Error(`Use at least ${MIN_PASSPHRASE_LENGTH} characters for the new passphrase.`);
  }
  const setup = await db.settings.get('passphraseSetup');
  if (!setup?.value) throw new Error('No passphrase has been set up yet.');

  const oldKey = await deriveKeyFromPassphrase(currentPassphrase, setup.value.salt);
  if (!(await verifyPassphrase(oldKey, setup.value.verifier))) {
    throw new Error('Current passphrase is incorrect.');
  }

  const newSalt = generateSalt();
  const newKey = await deriveKeyFromPassphrase(newPassphrase, newSalt);
  const newVerifier = await createVerifier(newKey);

  const [entries, attachments, versions] = await Promise.all([
    db.entries.toArray(),
    db.attachments.toArray(),
    db.entryVersions.toArray(),
  ]);

  const nextEntries = [];
  for (const e of entries) {
    nextEntries.push({
      ...e,
      titlePayload: await reencrypt(e.titlePayload, oldKey, newKey),
      contentPayload: await reencrypt(e.contentPayload, oldKey, newKey),
      payload: await reencrypt(e.payload, oldKey, newKey),
      syncStatus: 'pending',
    });
  }
  const nextAttachments = [];
  for (const a of attachments) {
    nextAttachments.push({ ...a, payload: await reencrypt(a.payload, oldKey, newKey), syncStatus: 'pending' });
  }
  const nextVersions = [];
  for (const v of versions) {
    nextVersions.push({ ...v, payload: await reencrypt(v.payload, oldKey, newKey) });
  }

  await db.transaction('rw', [db.entries, db.attachments, db.entryVersions, db.settings, db.syncQueue], async () => {
    await db.entries.bulkPut(nextEntries);
    await db.attachments.bulkPut(nextAttachments);
    await db.entryVersions.bulkPut(nextVersions);
    await db.settings.put({ key: 'passphraseSetup', value: { salt: newSalt, verifier: newVerifier } });
    const queued = new Set((await db.syncQueue.toArray()).map((q) => `${q.entityType}:${q.entityId}`));
    const now = Date.now();
    const adds = [];
    for (const e of nextEntries) {
      if (!queued.has(`entry:${e.id}`)) adds.push({ entityType: 'entry', entityId: e.id, operation: 'upsert', createdAt: now, attempts: 0 });
    }
    for (const a of nextAttachments) {
      if (!queued.has(`attachment:${a.id}`)) adds.push({ entityType: 'attachment', entityId: a.id, operation: 'upsert', createdAt: now, attempts: 0 });
    }
    if (adds.length) await db.syncQueue.bulkAdd(adds);
  });

  return { key: newKey, entries: nextEntries.length, attachments: nextAttachments.length, versions: nextVersions.length };
}
