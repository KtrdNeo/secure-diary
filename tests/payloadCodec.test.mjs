import { test } from 'node:test';
import assert from 'node:assert/strict';
import { binaryPayloadToWire, wirePayloadToBinary } from '../src/sync/payloadCodec.js';
import { generateSalt, deriveKeyFromPassphrase, encryptBinary, decryptBinary } from '../src/utils/crypto.js';

test('binaryPayloadToWire -> wirePayloadToBinary round trip preserves bytes exactly', () => {
  const original = {
    iv: crypto.getRandomValues(new Uint8Array(12)),
    ciphertext: crypto.getRandomValues(new Uint8Array(500)).buffer,
  };

  const wire = binaryPayloadToWire(original);
  assert.equal(typeof wire.iv, 'string');
  assert.equal(typeof wire.ciphertext, 'string');

  const restored = wirePayloadToBinary(wire);
  assert.deepEqual(new Uint8Array(restored.iv), new Uint8Array(original.iv));
  assert.deepEqual(new Uint8Array(restored.ciphertext), new Uint8Array(original.ciphertext));
});

test('wirePayloadToBinary output is JSON-serializable (safe for a jsonb column)', () => {
  const original = {
    iv: crypto.getRandomValues(new Uint8Array(12)),
    ciphertext: crypto.getRandomValues(new Uint8Array(50)).buffer,
  };
  const wire = binaryPayloadToWire(original);
  const roundTripped = JSON.parse(JSON.stringify(wire));
  assert.deepEqual(roundTripped, wire);
});

test('a real encryptBinary payload survives the full local -> wire -> local -> decrypt round trip', async () => {
  const salt = generateSalt();
  const key = await deriveKeyFromPassphrase('sync-test', salt);
  const original = { secret: 'this simulates a decoded Yjs update' };
  const originalBytes = new TextEncoder().encode(JSON.stringify(original));

  const localPayload = await encryptBinary(originalBytes, key);
  const wirePayload = binaryPayloadToWire(localPayload);

  // Simulate a round trip through Postgres: serialize to JSON text and
  // back, exactly as a jsonb column would.
  const asStoredInPostgres = JSON.parse(JSON.stringify(wirePayload));

  const localAgain = wirePayloadToBinary(asStoredInPostgres);
  const decryptedBytes = await decryptBinary(localAgain, key);
  const decrypted = JSON.parse(new TextDecoder().decode(decryptedBytes));

  assert.deepEqual(decrypted, original);
});
