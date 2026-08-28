/**
 * src/sinhala/sinhalaChars.js
 *
 * Sinhala Unicode characters (block U+0D80-U+0DFF) as literal characters
 * in source, not \uXXXX escapes. Deliberate choice: transcribing a hand-
 * computed hex offset is exactly where an error creeps in silently. The
 * literal glyphs below were cross-checked directly against the Unicode
 * Consortium's own code chart rather than typed from memory - see
 * CHECKPOINT_SUMMARY.md for the confidence-level breakdown of this
 * whole Sinhala suite (high confidence: these base characters and the
 * ZWJ conjunct-construction rules; lower confidence: a handful of rare/
 * alternate keyboard-layout positions, flagged individually below and
 * in wijesekara.js).
 */

export const VOWELS_INDEPENDENT = {
  a: 'අ',
  aa: 'ආ',
  ae: 'ඇ',
  aae: 'ඈ',
  i: 'ඉ',
  ii: 'ඊ',
  u: 'උ',
  uu: 'ඌ',
  ri: 'ඍ',
  e: 'එ',
  ee: 'ඒ',
  ai: 'ඓ',
  o: 'ඔ',
  oo: 'ඕ',
  au: 'ඖ',
};

// Consonants, BARE form - no vowel baked into the pattern. This matters
// for the transliteration algorithm (transliterate.js): it matches a
// consonant, then separately looks for a following vowel letter to
// decide between the inherent vowel (nothing extra needed), an
// explicit vowel sign, or a hal kirima. If the pattern itself already
// included a vowel (e.g. "ka" instead of bare "k"), that vowel gets
// silently consumed as part of the consonant match, and the following-
// vowel lookup finds nothing where the inherent vowel should have been
// - producing a spurious hal kirima instead of the plain consonant.
// Caught this by hand-tracing "ammaa" (mother, අම්මා) against an
// earlier vowel-baked-in draft before trusting any of it - the traced
// output was wrong in exactly this way.
//
// v1 does not distinguish dental vs. retroflex t/d/n (a real Sinhala
// phonemic distinction - see PRENASALIZED_CONSONANTS above for the
// same category of scoping decision) - both map to the dental form,
// which is the more frequent sound in everyday words. Flagged here
// rather than silently guessing at a case-sensitivity convention I
// don't have solid confidence in.
export const CONSONANTS = {
  kh: 'ඛ', k: 'ක',
  gh: 'ඝ', g: 'ග',
  chh: 'ඡ', ch: 'ච',
  jh: 'ඣ', j: 'ජ',
  ny: 'ඤ',
  ng: 'ඞ',
  th: 'ථ', t: 'ත',
  dh: 'ධ', d: 'ද',
  n: 'න',
  ph: 'ඵ', p: 'ප',
  bh: 'භ', b: 'බ',
  m: 'ම',
  y: 'ය',
  r: 'ර',
  ll: 'ළ', l: 'ල',
  v: 'ව', w: 'ව',
  sh: 'ශ',
  ss: 'ෂ',
  s: 'ස',
  h: 'හ',
  f: 'ෆ',
};

/**
 * Prenasalized consonants (a genuine Sinhala-specific addition beyond
 * the ISCII base allocation most other Brahmic Unicode blocks share -
 * see the block's Wikipedia summary). Deliberately NOT included in
 * CONSONANTS / wired into transliterate.js's pattern matching: while
 * the *characters* below are directly verified against the Unicode
 * chart, I don't have solid enough confidence in which exact Latin
 * spelling convention a Singlish typist would expect to produce each
 * one to guess without getting it wrong - and a caught bug while
 * writing this file (an accidental duplicate key that would have
 * mapped "nja" to ඤ instead of the intended ඦ) is exactly the kind of
 * mistake this category invites. Kept here as a verified reference for
 * whoever adds this properly, rather than silently dropped.
 */
export const PRENASALIZED_CONSONANTS = {
  prenasalizedGa: 'ඟ',
  prenasalizedJa: 'ඦ',
  prenasalizedDda: 'ඬ',
  prenasalizedDha: 'ඳ',
  prenasalizedBa: 'ඹ',
};

// Vowel signs (matras) - combined with a consonant by writing the
// consonant codepoint followed by the vowel-sign codepoint, in that
// LOGICAL order, regardless of how the vowel sign visually renders
// relative to the consonant. Font shaping (any Sinhala-capable system
// font) handles the visual reordering for the left-attaching signs
// (e/ee/ai/o/oo/au) - do not try to manually reorder characters to
// "look right" in source; that would corrupt the text.
export const VOWEL_SIGNS = {
  aa: 'ා',
  ae: 'ැ',
  aae: 'ෑ',
  i: 'ි',
  ii: 'ී',
  u: 'ු',
  uu: 'ූ',
  ru: 'ෘ',
  e: 'ෙ',
  ee: 'ේ',
  ai: 'ෛ',
  o: 'ො',
  oo: 'ෝ',
  au: 'ෞ',
};

export const HAL_KIRIMA = '්'; // virama - strips the consonant's inherent vowel
export const ZWJ = '\u200D'; // zero-width joiner - forms conjuncts (yansaya, rakaransaya, touching letters)
export const ANUSVARAYA = 'ං'; // nasalization mark (e.g. trailing -an/-am sound)
export const VISARGAYA = 'ඃ';
