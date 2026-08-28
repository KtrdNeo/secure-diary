import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  generateSalt,
  deriveKeyFromPassphrase,
  encryptBinary,
  decryptBinary,
} from '../src/utils/crypto.js';

test('binary encrypt -> decrypt round trip preserves exact bytes', async () => {
  const salt = generateSalt();
  const key = await deriveKeyFromPassphrase('binary-test', salt);

  const original = crypto.getRandomValues(new Uint8Array(5000)); // simulate audio/drawing bytes
  const encrypted = await encryptBinary(original.buffer, key);
  const decrypted = new Uint8Array(await decryptBinary(encrypted, key));

  assert.equal(decrypted.length, original.length);
  assert.deepEqual(decrypted, original);
});

test('binary ciphertext is not the plaintext bytes', async () => {
  const salt = generateSalt();
  const key = await deriveKeyFromPassphrase('binary-test', salt);
  const original = new TextEncoder().encode('recognizable-marker-bytes');

  const encrypted = await encryptBinary(original.buffer, key);
  const cipherBytes = new Uint8Array(encrypted.ciphertext);

  // The marker string should not appear verbatim in the ciphertext bytes.
  const asText = new TextDecoder('utf-8', { fatal: false }).decode(cipherBytes);
  assert.equal(asText.includes('recognizable-marker-bytes'), false);
});

test('binary decryption fails with the wrong key', async () => {
  const salt = generateSalt();
  const rightKey = await deriveKeyFromPassphrase('right', salt);
  const wrongKey = await deriveKeyFromPassphrase('wrong', salt);

  const data = new Uint8Array([1, 2, 3, 4, 5]).buffer;
  const encrypted = await encryptBinary(data, rightKey);

  await assert.rejects(() => decryptBinary(encrypted, wrongKey));
});

test('encryptBinary produces a fresh IV every call (never reused)', async () => {
  const salt = generateSalt();
  const key = await deriveKeyFromPassphrase('iv-test', salt);
  const data = new Uint8Array([9, 9, 9]).buffer;

  const a = await encryptBinary(data, key);
  const b = await encryptBinary(data, key);

  assert.notDeepEqual(Array.from(a.iv), Array.from(b.iv));
});
