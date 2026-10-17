import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveSaver } from '../src/features/performance.js';

test('explicit on/off win', () => {
  assert.equal(resolveSaver('on', null, false), true);
  assert.equal(resolveSaver('off', { level: 0.01, charging: false }, true), false);
});
test('auto: low unplugged battery or reduced motion', () => {
  assert.equal(resolveSaver('auto', { level: 0.15, charging: false }, false), true);
  assert.equal(resolveSaver('auto', { level: 0.15, charging: true }, false), false);
  assert.equal(resolveSaver('auto', { level: 0.8, charging: false }, false), false);
  assert.equal(resolveSaver('auto', null, true), true);
  assert.equal(resolveSaver('auto', null, false), false);
});
