/**
 * Stealth vault ("duress passphrase").
 *
 * A second passphrase opens a completely separate diary stored in its own
 * IndexedDB database. Nothing in the main database refers to it, and the app
 * shows no sign that it is the stealth one. Use it if someone makes you unlock
 * the app: they see only the harmless diary.
 *
 * Honest limits: this defeats someone looking over your shoulder, not a
 * forensic examination of the browser's storage (a database named
 * SecureDiaryCache existing is discoverable on the device).
 */
import Dexie from 'dexie';
import { STEALTH_DB_NAME, getStealthDb, resetStealthDb } from '../db/schema.js';
import {
  generateSalt,
  deriveKeyFromPassphrase,
  createVerifier,
  verifyPassphrase,
} from '../utils/crypto.js';

export const STEALTH_MIN_LENGTH = 8;

export async function stealthExists() {
  try {
    return await Dexie.exists(STEALTH_DB_NAME);
  } catch {
    return false;
  }
}

/** Returns the derived key if `passphrase` opens the stealth vault, otherwise null. */
export async function tryStealthUnlock(passphrase) {
  if (!passphrase || !(await stealthExists())) return null;
  const sdb = getStealthDb();
  const record = await sdb.settings.get('passphraseSetup');
  if (!record?.value) return null;
  const key = await deriveKeyFromPassphrase(passphrase, record.value.salt);
  return (await verifyPassphrase(key, record.value.verifier)) ? key : null;
}

/**
 * @param {string} passphrase the stealth passphrase
 * @param {{salt: Uint8Array, verifier: object}} realSetup the REAL passphraseSetup value
 * @returns {Promise<{ok: true} | {ok: false, error: string}>}
 */
export async function createStealthVault(passphrase, realSetup) {
  if (!passphrase || passphrase.length < STEALTH_MIN_LENGTH) {
    return { ok: false, error: `Use at least ${STEALTH_MIN_LENGTH} characters.` };
  }
  if (await stealthExists()) return { ok: false, error: 'A stealth vault already exists.' };
  if (realSetup?.salt) {
    const realKey = await deriveKeyFromPassphrase(passphrase, realSetup.salt);
    if (await verifyPassphrase(realKey, realSetup.verifier)) {
      return { ok: false, error: 'That is your real passphrase - choose a different one.' };
    }
  }
  const sdb = getStealthDb();
  const salt = generateSalt();
  const key = await deriveKeyFromPassphrase(passphrase, salt);
  const verifier = await createVerifier(key);
  await sdb.settings.put({ key: 'passphraseSetup', value: { salt, verifier } });
  return { ok: true };
}

export async function removeStealthVault() {
  const sdb = getStealthDb();
  if (sdb.isOpen()) sdb.close();
  await Dexie.delete(STEALTH_DB_NAME);
  resetStealthDb();
}
