import 'fake-indexeddb/auto';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import Dexie from 'dexie';
import { db, activateDb, isStealthActive, getStealthDb, MAIN_DB_NAME } from '../src/db/schema.js';
import { generateSalt, deriveKeyFromPassphrase, createVerifier } from '../src/utils/crypto.js';
import { createStealthVault, tryStealthUnlock, stealthExists, removeStealthVault } from '../src/features/stealth.js';

let realSetup;
beforeEach(async () => {
  activateDb('main');
  if (db.isOpen()) db.close();
  await removeStealthVault();
  await Dexie.delete(MAIN_DB_NAME);
  await db.open();
  const salt = generateSalt();
  const key = await deriveKeyFromPassphrase('real passphrase', salt);
  realSetup = { salt, verifier: await createVerifier(key) };
  await db.settings.put({ key: 'passphraseSetup', value: realSetup });
});

test('create, detect and unlock the stealth vault; wrong passphrase gets nothing', async () => {
  assert.equal(await stealthExists(), false);
  assert.equal(await tryStealthUnlock('decoy passphrase'), null);
  assert.deepEqual(await createStealthVault('decoy passphrase', realSetup), { ok: true });
  assert.equal(await stealthExists(), true);
  assert.ok(await tryStealthUnlock('decoy passphrase'));
  assert.equal(await tryStealthUnlock('wrong passphrase'), null);
  assert.equal(await tryStealthUnlock('real passphrase'), null);
});

test('rejects short passphrases, the real passphrase, and duplicates', async () => {
  assert.match((await createStealthVault('short', realSetup)).error, /at least/);
  assert.match((await createStealthVault('real passphrase', realSetup)).error, /real passphrase/);
  await createStealthVault('decoy passphrase', realSetup);
  assert.match((await createStealthVault('another passphrase', realSetup)).error, /already exists/);
});

test('data is isolated between the main and stealth databases', async () => {
  await createStealthVault('decoy passphrase', realSetup);
  activateDb('stealth');
  assert.equal(isStealthActive(), true);
  await db.entries.add({ createdAt: 1, isDeleted: 0 });
  assert.equal(await db.entries.count(), 1);
  assert.equal(await getStealthDb().entries.count(), 1);
  activateDb('main');
  assert.equal(isStealthActive(), false);
  assert.equal(await db.entries.count(), 0);
  assert.ok(await db.settings.get('passphraseSetup'), 'main setup untouched');
});

test('removing the vault leaves the main diary alone', async () => {
  await createStealthVault('decoy passphrase', realSetup);
  await removeStealthVault();
  assert.equal(await stealthExists(), false);
  assert.ok(await db.settings.get('passphraseSetup'));
});
