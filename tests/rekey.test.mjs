import 'fake-indexeddb/auto';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import Dexie from 'dexie';
import { db } from '../src/db/schema.js';
import {
  generateSalt, deriveKeyFromPassphrase, createVerifier, verifyPassphrase,
  encryptData, encryptBinary, decryptData, decryptBinary,
} from '../src/utils/crypto.js';
import { changePassphrase } from '../src/features/rekey.js';
import { purgeDeletedEntries, softDeleteEntry } from '../src/features/trash.js';

beforeEach(async () => {
  if (db.isOpen()) db.close();
  await Dexie.delete('SecureDiaryDB');
  await db.open();
});

async function seed(pass) {
  const salt = generateSalt();
  const key = await deriveKeyFromPassphrase(pass, salt);
  await db.settings.put({ key: 'passphraseSetup', value: { salt, verifier: await createVerifier(key) } });
  const now = Date.now();
  const id = await db.entries.add({
    type: 'text', createdAt: now, updatedAt: now, isPinned: 0, isDeleted: 0, syncStatus: 'synced',
    titlePayload: await encryptData({ title: 'T1' }, key),
    contentPayload: await encryptBinary(new TextEncoder().encode('body1'), key),
  });
  const att = await db.attachments.add({
    entryId: id, mimeType: 'audio/webm', sizeBytes: 3, createdAt: now, syncStatus: 'synced',
    payload: await encryptBinary(new TextEncoder().encode('aud'), key),
  });
  await db.entryVersions.add({ entryId: id, createdAt: now, payload: await encryptBinary(new TextEncoder().encode('v1'), key) });
  return { key, id, att };
}

test('changePassphrase re-encrypts everything under the new passphrase', async () => {
  const { id } = await seed('old-passphrase');
  const res = await changePassphrase(db, { currentPassphrase: 'old-passphrase', newPassphrase: 'brand-new-pass' });
  assert.equal(res.entries, 1);
  assert.equal(res.attachments, 1);
  assert.equal(res.versions, 1);

  const rec = await db.settings.get('passphraseSetup');
  const nk = await deriveKeyFromPassphrase('brand-new-pass', rec.value.salt);
  assert.equal(await verifyPassphrase(nk, rec.value.verifier), true);
  const e = await db.entries.get(id);
  assert.equal((await decryptData(e.titlePayload, nk)).title, 'T1');
  assert.equal(new TextDecoder().decode(await decryptBinary(e.contentPayload, nk)), 'body1');
  assert.equal(new TextDecoder().decode(await decryptBinary((await db.attachments.toArray())[0].payload, nk)), 'aud');
  assert.equal(new TextDecoder().decode(await decryptBinary((await db.entryVersions.toArray())[0].payload, nk)), 'v1');
  assert.equal(e.syncStatus, 'pending');
  assert.equal(await db.syncQueue.count(), 2);

  const oldKey = await deriveKeyFromPassphrase('old-passphrase', rec.value.salt);
  await assert.rejects(() => decryptData(e.titlePayload, oldKey));
});

test('changePassphrase with a wrong current passphrase or short new one changes nothing', async () => {
  const { key, id } = await seed('old-passphrase');
  await assert.rejects(() => changePassphrase(db, { currentPassphrase: 'nope-nope-nope', newPassphrase: 'brand-new-pass' }), /incorrect/);
  await assert.rejects(() => changePassphrase(db, { currentPassphrase: 'old-passphrase', newPassphrase: 'short' }), /at least/);
  const e = await db.entries.get(id);
  assert.equal((await decryptData(e.titlePayload, key)).title, 'T1');
});

test('changePassphrase aborts atomically if a row cannot be decrypted', async () => {
  const { key, id } = await seed('old-passphrase');
  const otherKey = await deriveKeyFromPassphrase('other-other', generateSalt());
  await db.entries.add({ type: 'text', createdAt: 1, updatedAt: 1, isPinned: 0, isDeleted: 0, titlePayload: await encryptData({ title: 'bad' }, otherKey) });
  const before = await db.settings.get('passphraseSetup');
  await assert.rejects(() => changePassphrase(db, { currentPassphrase: 'old-passphrase', newPassphrase: 'brand-new-pass' }));
  const after = await db.settings.get('passphraseSetup');
  assert.deepEqual(after.value.salt, before.value.salt);
  assert.equal((await decryptData((await db.entries.get(id)).titlePayload, key)).title, 'T1');
});

test('purgeDeletedEntries removes only trashed entries with their attachments, versions and queue rows', async () => {
  const a = await seed('pass-pass-pass');
  const { key } = a;
  const now = Date.now();
  const keepId = await db.entries.add({ type: 'text', createdAt: now, updatedAt: now, isPinned: 0, isDeleted: 0, titlePayload: await encryptData({ title: 'keep' }, key) });
  await softDeleteEntry(db, a.id);
  assert.equal(await purgeDeletedEntries(db), 1);
  assert.equal(await db.entries.count(), 1);
  assert.equal((await db.entries.toArray())[0].id, keepId);
  assert.equal(await db.attachments.count(), 0);
  assert.equal(await db.entryVersions.count(), 0);
  assert.equal(await db.syncQueue.count(), 0);
  assert.equal(await purgeDeletedEntries(db), 0);
});
