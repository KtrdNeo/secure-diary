import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createSearchIndex,
  indexEntry,
  updateEntryInIndex,
  removeEntryFromIndex,
  searchIndex,
} from '../src/search/searchIndex.js';

function seedIndex() {
  const index = createSearchIndex();
  indexEntry(index, { id: 1, title: 'Beach day', content: 'We went to the beach and saw a whale.', createdAt: 100 });
  indexEntry(index, { id: 2, title: 'Rainy Monday', content: 'Stayed in and read a book about whaling history.', createdAt: 200 });
  indexEntry(index, { id: 3, title: 'Grocery run', content: 'Bought coffee, eggs, and bread.', createdAt: 300 });
  return index;
}

test('searchIndex finds an entry by a word in its content', () => {
  const index = seedIndex();
  const results = searchIndex(index, 'whale');
  assert.ok(results.some((r) => r.id === 1));
});

test('searchIndex finds an entry by a word in its title', () => {
  const index = seedIndex();
  const results = searchIndex(index, 'grocery');
  assert.ok(results.some((r) => r.id === 3));
});

test('searchIndex does a substring/forward match, not only whole-word', () => {
  const index = seedIndex();
  // "whal" should still surface both "whale" and "whaling" given the
  // forward tokenizer - exact whole-word matching would miss "whaling".
  const results = searchIndex(index, 'whal');
  const ids = results.map((r) => r.id).sort();
  assert.deepEqual(ids, [1, 2]);
});

test('searchIndex returns stored title/createdAt without needing a separate lookup', () => {
  const index = seedIndex();
  const [result] = searchIndex(index, 'beach');
  assert.equal(result.title, 'Beach day');
  assert.equal(result.createdAt, 100);
});

test('searchIndex returns an empty array for an empty/whitespace query', () => {
  const index = seedIndex();
  assert.deepEqual(searchIndex(index, ''), []);
  assert.deepEqual(searchIndex(index, '   '), []);
});

test('searchIndex finds nothing for a query that matches no entry', () => {
  const index = seedIndex();
  assert.deepEqual(searchIndex(index, 'zzzznonexistent'), []);
});

test('updateEntryInIndex changes what a given id matches', () => {
  const index = seedIndex();
  updateEntryInIndex(index, { id: 3, title: 'Grocery run', content: 'Bought a kayak instead.', createdAt: 300 });

  assert.equal(searchIndex(index, 'coffee').some((r) => r.id === 3), false);
  assert.equal(searchIndex(index, 'kayak').some((r) => r.id === 3), true);
});

test('removeEntryFromIndex makes an id unfindable', () => {
  const index = seedIndex();
  removeEntryFromIndex(index, 1);
  assert.equal(searchIndex(index, 'whale').some((r) => r.id === 1), false);
  // The other whale-related entry should be unaffected.
  assert.equal(searchIndex(index, 'whaling').some((r) => r.id === 2), true);
});

test('indexEntry tolerates missing title/content without throwing', () => {
  const index = createSearchIndex();
  assert.doesNotThrow(() => indexEntry(index, { id: 99, createdAt: 1 }));
});
