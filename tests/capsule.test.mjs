import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isSealed, parseSealDate, toDateInputValue, minSealDate, isValidSealTarget, describeRemaining } from '../src/features/capsule.js';

test('isSealed only for a future number', () => {
  const now = 1_000_000;
  assert.equal(isSealed(now + 1, now), true);
  assert.equal(isSealed(now, now), false);
  assert.equal(isSealed(undefined, now), false);
  assert.equal(isSealed('x', now), false);
  assert.equal(isSealed(null, now), false);
});
test('date parsing round-trips and rejects junk', () => {
  const ms = parseSealDate('2027-03-05');
  assert.equal(toDateInputValue(ms), '2027-03-05');
  assert.equal(parseSealDate('05/03/2027'), null);
  assert.equal(parseSealDate(''), null);
});
test('min date is tomorrow and targets must be in the future', () => {
  const now = new Date(2026, 9, 15, 11, 0).getTime();
  assert.equal(minSealDate(now), '2026-10-16');
  assert.equal(isValidSealTarget(parseSealDate('2026-10-16'), now), true);
  assert.equal(isValidSealTarget(parseSealDate('2026-10-14'), now), false);
});
test('remaining wording', () => {
  const now = 0;
  assert.equal(describeRemaining(86400000, now), 'opens tomorrow');
  assert.equal(describeRemaining(10 * 86400000, now), 'opens in 10 days');
  assert.match(describeRemaining(200 * 86400000, now), /months/);
  assert.match(describeRemaining(1200 * 86400000, now), /years/);
});
