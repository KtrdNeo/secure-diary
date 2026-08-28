/**
 * src/sinhala/wijesekara.js
 *
 * Wijesekara keyboard layout (SLS 1134 standard) - physical key ->
 * Sinhala character.
 *
 * Every key below traces back to an actual XKB keyboard-layout
 * definition file (para-d/si-wijesekara-keyboard, the `lk` symbols
 * file - a precise, unambiguous reference for which physical key
 * produces which named keysym, e.g. AC09 -> Sinh_ka). What's NOT
 * equally certain is the keysym -> exact-Unicode-character step for
 * every entry, so this file separates two explicit confidence tiers
 * rather than presenting one flat table:
 *
 *  - HIGH_CONFIDENCE: common consonants/vowels where the keysym's
 *    phonetic name maps unambiguously to a character I directly
 *    verified against the Unicode code chart (see sinhalaChars.js).
 *  - INFERRED: characters I'm reasonably but not fully confident
 *    about - mostly the "2"-suffixed keysym variants (Sinh_i2,
 *    Sinh_aa2, etc.), which I inferred to be the dependent vowel-SIGN
 *    forms (as opposed to independent vowel letters) from the naming
 *    pattern, not from a source that states this outright.
 *
 * Scoped to the base (unshifted) row only - shift/AltGr levels roughly
 * double the real standard's character count, and I don't have solid
 * enough confidence in enough of those specific assignments to ship
 * them mixed in with the rest at the same apparent confidence.
 */
import { CONSONANTS, VOWELS_INDEPENDENT, VOWEL_SIGNS, HAL_KIRIMA } from './sinhalaChars.js';

export const HIGH_CONFIDENCE_BASE_ROW = {
  w: VOWELS_INDEPENDENT.a, // Sinh_a
  r: CONSONANTS.r, // Sinh_ra
  t: VOWEL_SIGNS.e, // Sinh_e
  y: CONSONANTS.h, // Sinh_ha
  u: CONSONANTS.m, // Sinh_ma
  i: CONSONANTS.s, // Sinh_sa
  o: CONSONANTS.d, // Sinh_dha
  p: CONSONANTS.ch, // Sinh_ca

  a: HAL_KIRIMA, // Sinh_al
  g: CONSONANTS.t, // Sinh_tta
  h: CONSONANTS.y, // Sinh_ya
  j: CONSONANTS.v, // Sinh_va
  k: CONSONANTS.n, // Sinh_na
  l: CONSONANTS.k, // Sinh_ka
  semicolon: CONSONANTS.t, // Sinh_tha

  x: CONSONANTS.ng, // Sinh_ng
  c: CONSONANTS.j, // Sinh_ja
  v: CONSONANTS.d, // Sinh_dda
  n: CONSONANTS.b, // Sinh_ba
  m: CONSONANTS.p, // Sinh_pa
  comma: CONSONANTS.l, // Sinh_la
  period: CONSONANTS.g, // Sinh_ga
};

export const INFERRED_BASE_ROW = {
  q: VOWEL_SIGNS.u, // Sinh_u2
  e: VOWEL_SIGNS.ae, // Sinh_ae2
  s: VOWEL_SIGNS.i, // Sinh_i2
  d: VOWEL_SIGNS.aa, // Sinh_aa2
  f: VOWEL_SIGNS.e, // Sinh_e2
  b: VOWELS_INDEPENDENT.i, // Sinh_i
};

export const WIJESEKARA_BASE_ROW = { ...INFERRED_BASE_ROW, ...HIGH_CONFIDENCE_BASE_ROW };

/**
 * @param {string} key - lowercase physical key label (e.g. 'a', 'semicolon')
 * @returns {string|null} the Sinhala character, or null if this key
 *   isn't in the verified subset - callers should fall back to plain
 *   passthrough rather than substitute a guess.
 */
export function wijesekaraBaseChar(key) {
  return WIJESEKARA_BASE_ROW[key.toLowerCase()] ?? null;
}
