import { test } from 'node:test';
import assert from 'node:assert/strict';
import { transliterate } from '../src/sinhala/transliterate.js';

test('"ammaa" (mother) produces the expected doubled-consonant + long-vowel pattern', () => {
  assert.equal(transliterate('ammaa'), 'අම්මා');
});

test('"kohaa" (crow) produces the expected o-vowel-sign + long-aa pattern', () => {
  assert.equal(transliterate('kohaa'), 'කොහා');
});

test('"mal" (flower) ends in a bare consonant with hal kirima, not an extra vowel', () => {
  assert.equal(transliterate('mal'), 'මල්');
});

test('a bare consonant + "a" uses the inherent vowel (no extra vowel sign)', () => {
  assert.equal(transliterate('ka'), 'ක');
  assert.equal(transliterate('ma'), 'ම');
});

test('a bare consonant with no following vowel gets a hal kirima', () => {
  assert.equal(transliterate('k'), 'ක්');
});

test('an independent vowel at word start is the standalone vowel letter, not a vowel sign', () => {
  assert.equal(transliterate('a'), 'අ');
  assert.equal(transliterate('i'), 'ඉ');
});

test('longest-match prevents "th" from being read as "t" + "h"', () => {
  const result = transliterate('tha');
  assert.equal(result, 'ථ');
});

test('rakaransaya (consonant + r) inserts a ZWJ for the correct joined glyph', () => {
  const result = transliterate('kra');
  assert.equal(result, 'ක්\u200Dර');
});

test('yansaya (consonant + y) inserts a ZWJ for the correct joined glyph', () => {
  const result = transliterate('vya');
  assert.equal(result, 'ව්\u200Dය');
});

test('a plain consonant cluster (not r/y) gets a hal kirima with no ZWJ', () => {
  const result = transliterate('akka');
  assert.equal(result, 'අක්ක');
});

test('every character of mixed input is accounted for (no silent truncation)', () => {
  const input = 'ammaa, mama 42!';
  const result = transliterate(input);
  assert.ok(result.includes(','));
  assert.ok(result.includes('42'));
  assert.ok(result.includes('!'));
  assert.ok(result.includes(' '));
});

test('an empty string returns an empty string', () => {
  assert.equal(transliterate(''), '');
});

test('unrecognized characters pass through rather than vanishing', () => {
  const result = transliterate('xq');
  assert.equal(result.length > 0, true);
});

test('is case-insensitive for the base consonant/vowel set', () => {
  assert.equal(transliterate('AMMAA'), transliterate('ammaa'));
});
