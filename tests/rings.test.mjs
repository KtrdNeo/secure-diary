import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ringDiameter, ringCount, RING_MIN, RING_MAX, MIN_RINGS, MAX_RINGS } from '../src/features/rings.js';

test('diameter follows column width within limits', () => {
  assert.equal(ringDiameter(0), RING_MIN);
  assert.equal(ringDiameter(20), 16);
  assert.equal(ringDiameter(400), RING_MAX);
});
test('count scales with height, spaced apart, within limits', () => {
  assert.equal(ringCount(0, 28), MIN_RINGS);
  assert.equal(ringCount(5000, 28), MAX_RINGS);
  for (const h of [200, 300, 400, 560, 700, 900]) {
    const d = 28;
    const n = ringCount(h, d);
    if (n > MIN_RINGS) assert.ok(n * d * 2.3 <= h, `rings never touch at h=${h}`);
  }
  assert.ok(ringCount(700, 28) > ringCount(300, 28));
});
