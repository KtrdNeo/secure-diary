import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as Y from 'yjs';
import {
  createEmptyYDoc,
  encodeYDoc,
  decodeYDoc,
  mergeUpdate,
  mergeStates,
  yDocToPlainText,
  snapshotYDoc,
  restoreSnapshot,
  YJS_CONTENT_FIELD,
} from '../src/components/editor/yjsUtils.js';

function docWithText(text) {
  const ydoc = createEmptyYDoc();
  const fragment = ydoc.get(YJS_CONTENT_FIELD, Y.XmlFragment);
  fragment.insert(0, [new Y.XmlText(text)]);
  return ydoc;
}

function firstTextNode(ydoc) {
  return ydoc.get(YJS_CONTENT_FIELD, Y.XmlFragment).get(0);
}

test('encodeYDoc -> decodeYDoc round trip preserves content', () => {
  const original = docWithText('Dear diary, today was good.');
  const restored = decodeYDoc(encodeYDoc(original));
  assert.equal(yDocToPlainText(restored), yDocToPlainText(original));
});

test('decodeYDoc handles an empty/missing update gracefully', () => {
  const restored = decodeYDoc(new Uint8Array(0));
  assert.equal(yDocToPlainText(restored), '');
});

test('mergeUpdate applies a remote change into a local doc', () => {
  const shared = docWithText('Hello');
  const sharedState = encodeYDoc(shared);

  const deviceA = decodeYDoc(sharedState);
  const deviceB = decodeYDoc(sharedState);

  // Device B edits offline, then "syncs" its update to device A.
  firstTextNode(deviceB).insert(5, ' world');
  const bUpdate = encodeYDoc(deviceB);

  mergeUpdate(deviceA, bUpdate);
  assert.equal(yDocToPlainText(deviceA), 'Hello world');
});

test('two devices editing offline concurrently both survive the merge (no data loss)', () => {
  const shared = docWithText('Dear diary, ');
  const sharedState = encodeYDoc(shared);

  const deviceA = decodeYDoc(sharedState);
  const deviceB = decodeYDoc(sharedState);

  // Both devices go offline and independently append *different* text
  // to the *same* starting point - the classic concurrent-edit case
  // that breaks naive last-write-wins sync.
  firstTextNode(deviceA).insert(12, 'today was sunny.');
  firstTextNode(deviceB).insert(12, 'I saw a whale!');

  const stateA = encodeYDoc(deviceA);
  const stateB = encodeYDoc(deviceB);

  const merged = mergeStates(stateA, stateB);
  const mergedText = yDocToPlainText(merged);

  assert.ok(mergedText.includes('today was sunny.'), 'lost device A\'s edit');
  assert.ok(mergedText.includes('I saw a whale!'), 'lost device B\'s edit');
  assert.ok(mergedText.startsWith('Dear diary, '), 'lost the shared starting text');
});

test('merge order does not change the result (commutativity)', () => {
  const shared = docWithText('Base: ');
  const sharedState = encodeYDoc(shared);

  const deviceA = decodeYDoc(sharedState);
  const deviceB = decodeYDoc(sharedState);
  firstTextNode(deviceA).insert(6, 'from A');
  firstTextNode(deviceB).insert(6, 'from B');

  const stateA = encodeYDoc(deviceA);
  const stateB = encodeYDoc(deviceB);

  const mergedAB = yDocToPlainText(mergeStates(stateA, stateB));
  const mergedBA = yDocToPlainText(mergeStates(stateB, stateA));

  assert.equal(mergedAB, mergedBA, 'merge result depends on argument order - CRDT guarantee violated');
});

test('merging is idempotent - applying the same update twice changes nothing further', () => {
  const doc = docWithText('idempotent check');
  const state = encodeYDoc(doc);

  const target = decodeYDoc(state);
  const before = yDocToPlainText(target);
  mergeUpdate(target, state);
  mergeUpdate(target, state);
  assert.equal(yDocToPlainText(target), before);
});

test('a three-way merge (device syncing after two others already merged) still contains everyone\'s edits', () => {
  const shared = docWithText('Log: ');
  const sharedState = encodeYDoc(shared);

  const a = decodeYDoc(sharedState);
  const b = decodeYDoc(sharedState);
  const c = decodeYDoc(sharedState);
  firstTextNode(a).insert(5, '[A] ');
  firstTextNode(b).insert(5, '[B] ');
  firstTextNode(c).insert(5, '[C] ');

  const abMerged = mergeStates(encodeYDoc(a), encodeYDoc(b));
  const allMerged = mergeStates(encodeYDoc(abMerged), encodeYDoc(c));
  const text = yDocToPlainText(allMerged);

  assert.ok(text.includes('[A]'));
  assert.ok(text.includes('[B]'));
  assert.ok(text.includes('[C]'));
});

test('snapshotYDoc -> restoreSnapshot round trip recovers a past version', () => {
  const doc = docWithText('draft one');
  const snapshot = snapshotYDoc(doc);

  // Keep editing after taking the snapshot.
  firstTextNode(doc).insert(9, ' - now with more text');

  const restored = restoreSnapshot(snapshot);
  assert.equal(yDocToPlainText(restored), 'draft one');
  assert.equal(yDocToPlainText(doc), 'draft one - now with more text');
});
