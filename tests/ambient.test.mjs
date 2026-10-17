import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AMBIENT_PRESETS, binauralFrequencies, clampVolume, getAmbientState, startAmbient } from '../src/features/ambient.js';

test('binaural presets give a true beat difference', () => {
  for (const p of AMBIENT_PRESETS.filter((x) => x.kind === 'binaural')) {
    const { left, right } = binauralFrequencies(p);
    assert.equal(right - left, p.beat);
    assert.ok(left >= 100 && right <= 300, 'carrier in a comfortable range');
  }
});
test('volume is clamped and junk falls back', () => {
  assert.equal(clampVolume(2), 1);
  assert.equal(clampVolume(-1), 0);
  assert.equal(clampVolume('abc'), 0.3);
});
test('start without WebAudio is a safe no-op', () => {
  assert.equal(startAmbient('focus'), false);
  assert.equal(getAmbientState().playing, false);
});
