/**
 * src/sync/payloadCodec.js
 *
 * Pure conversion between the two payload shapes used in this app:
 *  - local/binary: {iv: Uint8Array, ciphertext: ArrayBuffer} - what
 *    encryptBinary() produces, stored directly in Dexie
 *  - wire/base64: {iv: string, ciphertext: string} - what travels over
 *    Supabase's JSON-based REST client and gets stored in a jsonb column
 *
 * No network, no crypto keys, no Supabase client - just bytes in, bytes
 * out, which is what makes this the one part of the sync story besides
 * yjsUtils.js that's fully unit-testable.
 */

export function binaryPayloadToWire(binaryPayload) {
  return {
    iv: bufferToBase64(binaryPayload.iv),
    ciphertext: bufferToBase64(binaryPayload.ciphertext),
  };
}

export function wirePayloadToBinary(wirePayload) {
  return {
    iv: new Uint8Array(base64ToBuffer(wirePayload.iv)),
    ciphertext: base64ToBuffer(wirePayload.ciphertext),
  };
}

// Text-origin payloads (from encryptData) are ALREADY {iv, ciphertext}
// base64 strings - identical shape to the wire format - so no
// conversion is needed for those; they pass straight through.

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
