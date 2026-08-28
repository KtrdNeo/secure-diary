import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  generateSalt,
  deriveKeyFromPassphrase,
  encryptData,
  decryptData,
  createVerifier,
  verifyPassphrase,
} from '../src/utils/crypto.js';

test('encrypt -> decrypt round trip returns the original value', async () => {
  const salt = generateSalt();
  const key = await deriveKeyFromPassphrase('correct horse battery staple', salt);
  const original = { title: 'Diary Entry', body: 'ලංකාව 🇱🇰', tags: ['a', 'b'] };

  const encrypted = await encryptData(original, key);
  const decrypted = await decryptData(encrypted, key);

  assert.deepEqual(decrypted, original);
});

test('ciphertext does not contain the plaintext', async () => {
  const salt = generateSalt();
  const key = await deriveKeyFromPassphrase('correct horse battery staple', salt);
  const encrypted = await encryptData({ secret: 'do-not-leak-me' }, key);

  assert.equal(encrypted.ciphertext.includes('do-not-leak-me'), false);
});

test('decryption fails with the wrong passphrase', async () => {
  const salt = generateSalt();
  const rightKey = await deriveKeyFromPassphrase('correct-passphrase', salt);
  const wrongKey = await deriveKeyFromPassphrase('wrong-passphrase', salt);

  const encrypted = await encryptData({ secret: 'value' }, rightKey);

  await assert.rejects(() => decryptData(encrypted, wrongKey));
});

test('tampering with ciphertext is detected (AES-GCM auth tag)', async () => {
  const salt = generateSalt();
  const key = await deriveKeyFromPassphrase('correct-passphrase', salt);
  const encrypted = await encryptData({ secret: 'value' }, key);

  // Flip a character in the ciphertext to simulate tampering / corruption.
  const tampered = {
    ...encrypted,
    ciphertext: encrypted.ciphertext.slice(0, -1) + (encrypted.ciphertext.slice(-1) === 'A' ? 'B' : 'A'),
  };

  await assert.rejects(() => decryptData(tampered, key));
});

test('verifyPassphrase distinguishes correct from incorrect passphrases', async () => {
  const salt = generateSalt();
  const rightKey = await deriveKeyFromPassphrase('my-real-passphrase', salt);
  const wrongKey = await deriveKeyFromPassphrase('a-guess', salt);

  const verifier = await createVerifier(rightKey);

  assert.equal(await verifyPassphrase(rightKey, verifier), true);
  assert.equal(await verifyPassphrase(wrongKey, verifier), false);
});

test('same passphrase + same salt deterministically re-derives a working key', async () => {
  const salt = generateSalt();
  const keyA = await deriveKeyFromPassphrase('reuse-me', salt);
  const verifier = await createVerifier(keyA);

  // Simulate closing and reopening the app: derive again from scratch.
  const keyB = await deriveKeyFromPassphrase('reuse-me', salt);

  assert.equal(await verifyPassphrase(keyB, verifier), true);
});

test('Argon2id key derivation completes in a UX-reasonable time', async () => {
  const salt = generateSalt();
  const start = performance.now();
  await deriveKeyFromPassphrase('timing-check', salt);
  const elapsedMs = performance.now() - start;

  console.log(`    (key derivation took ${elapsedMs.toFixed(0)}ms on this machine)`);
  // Generous ceiling for CI/sandbox hardware; tune ARGON2_PARAMS if this
  // creeps up on real target devices, especially low-end mobile.
  assert.ok(elapsedMs < 5000, `expected < 5000ms, got ${elapsedMs.toFixed(0)}ms`);
});
