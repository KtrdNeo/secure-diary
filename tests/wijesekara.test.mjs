import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WIJESEKARA_BASE_ROW, HIGH_CONFIDENCE_BASE_ROW, wijesekaraBaseChar } from '../src/sinhala/wijesekara.js';

test('every mapped key resolves to a real, non-empty Sinhala character (no typo produced undefined)', () => {
  for (const [key, value] of Object.entries(WIJESEKARA_BASE_ROW)) {
    assert.equal(
      typeof value,
      'string',
      `key "${key}" did not resolve to a string (likely a typo in the source CONSONANTS/VOWEL_SIGNS property name)`
    );
    assert.ok(value.length > 0, `key "${key}" resolved to an empty string`);
  }
});

test('wijesekaraBaseChar returns null for keys outside the verified subset, not a guess', () => {
  assert.equal(wijesekaraBaseChar('z'), null);
  assert.equal(wijesekaraBaseChar('1'), null);
});

test('wijesekaraBaseChar is case-insensitive', () => {
  assert.equal(wijesekaraBaseChar('L'), wijesekaraBaseChar('l'));
});

test('HIGH_CONFIDENCE_BASE_ROW entries are all a single character (sanity bound - catches an accidental multi-char/object value)', () => {
  for (const [key, value] of Object.entries(HIGH_CONFIDENCE_BASE_ROW)) {
    assert.ok(value.length === 1, `"${key}" -> "${value}" is not a single character`);
  }
});
