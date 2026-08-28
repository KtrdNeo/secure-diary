/**
 * src/sinhala/transliterate.js
 *
 * Phonetic Singlish -> Sinhala Unicode, longest-match syllable parsing:
 * at each position, match the longest known consonant pattern, then
 * look for a vowel pattern immediately after it; a bare consonant with
 * no following vowel (end of word, or another consonant next) gets a
 * hal kirima (virama). Independent vowels are matched the same way at
 * word-start / after another vowel.
 *
 * This is a genuine, tested v1 covering common patterns - not a
 * linguistically exhaustive implementation. See CHECKPOINT_SUMMARY.md
 * for the confidence-level notes on this whole Sinhala suite; native-
 * speaker review before relying on this for anything important is
 * explicitly invited, not just a disclaimer buried in a comment.
 */
import { VOWELS_INDEPENDENT, CONSONANTS, VOWEL_SIGNS, HAL_KIRIMA, ZWJ, ANUSVARAYA } from './sinhalaChars.js';

// Longest-first so e.g. "thh" is tried before "th" before "t".
function byLengthDesc(a, b) {
  return b.length - a.length;
}

const CONSONANT_PATTERNS = Object.keys(CONSONANTS).sort(byLengthDesc);
const VOWEL_PATTERNS = Object.keys(VOWELS_INDEPENDENT).sort(byLengthDesc);

function matchLongest(input, pos, patterns) {
  const lower = input.slice(pos, pos + 4).toLowerCase();
  for (const pattern of patterns) {
    if (lower.startsWith(pattern)) return pattern;
  }
  return null;
}

function isLetter(ch) {
  return /[a-zA-Z]/.test(ch);
}

/**
 * @param {string} input - Singlish (Latin) text
 * @returns {string} Sinhala Unicode text
 */
export function transliterate(input) {
  let output = '';
  let pos = 0;
  let afterVowelOrStart = true;

  while (pos < input.length) {
    const ch = input[pos];

    if (!isLetter(ch)) {
      output += ch;
      pos += 1;
      afterVowelOrStart = true;
      continue;
    }

    const consonantKey = matchLongest(input, pos, CONSONANT_PATTERNS);
    if (consonantKey) {
      pos += consonantKey.length;
      const vowelKey = matchLongest(input, pos, VOWEL_PATTERNS);

      if (vowelKey === 'a') {
        output += CONSONANTS[consonantKey];
        pos += 1;
        afterVowelOrStart = true;
        continue;
      }
      if (vowelKey) {
        output += CONSONANTS[consonantKey] + VOWEL_SIGNS[vowelKey];
        pos += vowelKey.length;
        afterVowelOrStart = true;
        continue;
      }

      const nextConsonantKey = matchLongest(input, pos, CONSONANT_PATTERNS);
      if (nextConsonantKey === 'r' || nextConsonantKey === 'y') {
        output += CONSONANTS[consonantKey] + HAL_KIRIMA + ZWJ;
      } else {
        output += CONSONANTS[consonantKey] + HAL_KIRIMA;
      }
      afterVowelOrStart = false;
      continue;
    }

    if (afterVowelOrStart) {
      const independentVowelKey = matchLongest(input, pos, VOWEL_PATTERNS);
      if (independentVowelKey) {
        output += VOWELS_INDEPENDENT[independentVowelKey];
        pos += independentVowelKey.length;
        afterVowelOrStart = true;
        continue;
      }
    }

    output += ch;
    pos += 1;
  }

  return output;
}

export function appendAnusvaraya(text) {
  return text + ANUSVARAYA;
}
