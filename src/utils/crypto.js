/**
 * src/utils/crypto.js
 *
 * Zero-Knowledge Encryption Engine
 * ---------------------------------
 * Everything here runs entirely client-side. The backend (Supabase) only
 * ever receives the {iv, ciphertext} objects produced by encryptData() -
 * it never sees the passphrase, the derived key, or any plaintext.
 *
 * Algorithm choices:
 *   - Key derivation : Argon2id, via hash-wasm (WebCrypto's SubtleCrypto
 *                       has no native Argon2 - PBKDF2 is the only native
 *                       KDF, and Argon2id is the stronger, memory-hard
 *                       choice for a passphrase-based key).
 *   - Encryption      : AES-GCM-256, via the native WebCrypto SubtleCrypto
 *                       API - authenticated encryption, so any tampering
 *                       or wrong-key attempt fails loudly instead of
 *                       silently returning garbage.
 */

import { argon2id } from 'hash-wasm';

// ---- Tunable security parameters ------------------------------------------
// hash-wasm's `memorySize` is in KiB (kibibytes), not bytes - confirmed
// against the installed package's type definitions, not assumed.
// 65536 KiB = 64 MiB. Combined with 3 iterations this lands well above
// OWASP's Argon2id minimum (19 MiB / 2 iterations) while still unlocking
// in well under a second on typical hardware. Benchmark on real target
// devices (this is a PWA, so include low-end mobile) and tune down if
// unlock feels sluggish - see verify.mjs for a quick timing check.
export const ARGON2_PARAMS = Object.freeze({
  memorySize: 65536, // KiB -> 64 MiB
  iterations: 3,
  parallelism: 1,
  hashLength: 32, // bytes -> 256-bit key, matches AES-256
});

const AES_ALGO = 'AES-GCM';
const IV_LENGTH_BYTES = 12; // 96-bit IV: the size WebCrypto/NIST recommend for GCM
const SALT_LENGTH_BYTES = 16;
const VERIFIER_PLAINTEXT = 'secure-diary-verifier-v1';

/**
 * Generate a fresh random salt for Argon2id key derivation.
 * Not secret - store it alongside (or ahead of) the encrypted data so the
 * same key can be re-derived from the passphrase on the next unlock.
 */
export function generateSalt() {
  return crypto.getRandomValues(new Uint8Array(SALT_LENGTH_BYTES));
}

function generateIV() {
  // A fresh, random IV every single call. Never reuse an IV with the same
  // AES-GCM key - doing so breaks the confidentiality guarantee entirely.
  return crypto.getRandomValues(new Uint8Array(IV_LENGTH_BYTES));
}

/**
 * Derive a non-extractable AES-256 CryptoKey from the user's master
 * passphrase. "Non-extractable" means the raw key bytes can never be
 * pulled back out of WebCrypto (via exportKey) once imported - only used
 * for encrypt/decrypt operations - which shrinks the blast radius if an
 * XSS bug ever ran arbitrary JS in the page.
 *
 * @param {string} passphrase
 * @param {Uint8Array} salt - from generateSalt(), persisted per-user
 * @returns {Promise<CryptoKey>}
 */
export async function deriveKeyFromPassphrase(passphrase, salt) {
  const derivedBytes = await argon2id({
    password: passphrase,
    salt,
    ...ARGON2_PARAMS,
    outputType: 'binary',
  });

  return crypto.subtle.importKey(
    'raw',
    derivedBytes,
    { name: AES_ALGO },
    false, // extractable = false
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt any JSON-serializable value with AES-GCM-256.
 * Returns a self-contained, storage-ready object - drop it straight into
 * a Dexie record or a Supabase row.
 *
 * @param {*} plaintextValue
 * @param {CryptoKey} cryptoKey
 * @returns {Promise<{iv: string, ciphertext: string}>}
 */
export async function encryptData(plaintextValue, cryptoKey) {
  const iv = generateIV();
  const encoded = new TextEncoder().encode(JSON.stringify(plaintextValue));

  const ciphertextBuffer = await crypto.subtle.encrypt(
    { name: AES_ALGO, iv },
    cryptoKey,
    encoded
  );

  return {
    iv: bufferToBase64(iv),
    ciphertext: bufferToBase64(ciphertextBuffer),
  };
}

/**
 * Decrypt an {iv, ciphertext} object produced by encryptData() back into
 * the original value. Throws if the key is wrong OR the ciphertext was
 * modified in any way - GCM's authentication tag makes tampering
 * detectable rather than silently producing corrupted output.
 *
 * @param {{iv: string, ciphertext: string}} encryptedObj
 * @param {CryptoKey} cryptoKey
 * @returns {Promise<*>}
 */
export async function decryptData(encryptedObj, cryptoKey) {
  const iv = base64ToBuffer(encryptedObj.iv);
  const ciphertext = base64ToBuffer(encryptedObj.ciphertext);

  const plainBuffer = await crypto.subtle.decrypt(
    { name: AES_ALGO, iv },
    cryptoKey,
    ciphertext
  );

  return JSON.parse(new TextDecoder().decode(plainBuffer));
}

// ---- Binary variants (for attachments: audio, drawings) -------------------
// encryptData/decryptData JSON.stringify + base64-encode everything, which
// is right for entries/settings (small, needs to stay easily portable as
// JSON for the Phase 4 sync engine) but wasteful for potentially large
// binary payloads like a voice recording - base64 alone adds ~33% size for
// no benefit when IndexedDB can store raw bytes natively. These operate on
// ArrayBuffers directly and return the IV/ciphertext as raw bytes, meant to
// be stored as-is in Dexie rather than stringified.

/**
 * @param {ArrayBuffer|Uint8Array} data
 * @param {CryptoKey} cryptoKey
 * @returns {Promise<{iv: Uint8Array, ciphertext: ArrayBuffer}>}
 */
export async function encryptBinary(data, cryptoKey) {
  const iv = generateIV();
  const ciphertext = await crypto.subtle.encrypt({ name: AES_ALGO, iv }, cryptoKey, data);
  return { iv, ciphertext };
}

/**
 * @param {{iv: Uint8Array, ciphertext: ArrayBuffer}} encryptedObj
 * @param {CryptoKey} cryptoKey
 * @returns {Promise<ArrayBuffer>}
 */
export async function decryptBinary(encryptedObj, cryptoKey) {
  return crypto.subtle.decrypt(
    { name: AES_ALGO, iv: encryptedObj.iv },
    cryptoKey,
    encryptedObj.ciphertext
  );
}

// ---- Passphrase verification ----------------------------------------------
// Zero-knowledge means the passphrase itself is never stored anywhere.
// To still give a friendly "that passphrase is wrong" message on unlock
// (rather than surfacing raw decrypt errors on the user's real notes), we
// store one small "verifier" blob encrypted with the derived key. Trying
// to decrypt it either succeeds (correct passphrase) or throws (wrong
// passphrase), which is exactly what we want to check.

/** Call once, at account/passphrase setup time, and persist the result. */
export async function createVerifier(cryptoKey) {
  return encryptData({ check: VERIFIER_PLAINTEXT }, cryptoKey);
}

/** Call on every unlock attempt with the freshly-derived key. */
export async function verifyPassphrase(cryptoKey, verifierBlob) {
  try {
    const result = await decryptData(verifierBlob, cryptoKey);
    return result.check === VERIFIER_PLAINTEXT;
  } catch {
    return false;
  }
}

// ---- base64 helpers ---------------------------------------------------

function bufferToBase64(buffer) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBuffer(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}
