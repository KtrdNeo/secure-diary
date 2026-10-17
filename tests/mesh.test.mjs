import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tokenize, buildMesh, layoutMesh } from '../src/features/mesh.js';

test('tokenize keeps Sinhala words, drops stopwords/short/numbers', () => {
  assert.deepEqual(tokenize('The garden 2026 අම්මා is up'), ['garden', 'අම්මා']);
});

const ENTRIES = [
  { id: 1, title: 'Garden day', body: 'planted tomatoes basil garden soil watering tomatoes' },
  { id: 2, title: 'Tomato notes', body: 'tomatoes garden soil basil harvest watering' },
  { id: 3, title: 'Work', body: 'meeting budget deadline project client invoice meeting' },
  { id: 4, title: 'Project plan', body: 'project deadline budget client meeting roadmap' },
  { id: 5, title: 'Lonely', body: 'xylophone quartz' },
];

test('related entries connect, unrelated ones do not', () => {
  const { nodes, edges } = buildMesh(ENTRIES);
  const has = (a, b) => edges.some((e) => (e.a === a && e.b === b) || (e.a === b && e.b === a));
  assert.ok(has(1, 2), 'garden entries linked');
  assert.ok(has(3, 4), 'work entries linked');
  assert.ok(!has(1, 3) && !has(2, 4), 'topics stay apart');
  assert.equal(nodes.find((n) => n.id === 5).degree, 0);
  assert.ok(edges.find((e) => e.a === 1 && e.b === 2).shared.includes('garden'));
});

test('layout stays inside the box and is deterministic', () => {
  const { nodes, edges } = buildMesh(ENTRIES);
  const a = layoutMesh(nodes, edges, 600, 420);
  const b = layoutMesh(nodes, edges, 600, 420);
  assert.deepEqual([...a], [...b]);
  for (const { x, y } of a.values()) {
    assert.ok(x >= 36 && x <= 564 && y >= 36 && y <= 384);
  }
  assert.equal(buildMesh([]).nodes.length, 0);
});
