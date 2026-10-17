import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getRecognitionCtor, joinTranscript, SPEECH_LANGUAGES } from '../src/features/speech.js';
import { validateImageFile, OCR_MAX_BYTES } from '../src/features/ocr.js';

test('speech: constructor detection and transcript joining', () => {
  assert.equal(getRecognitionCtor({}), null);
  const C = function () {};
  assert.equal(getRecognitionCtor({ webkitSpeechRecognition: C }), C);
  assert.equal(joinTranscript('hello', ' wor '), 'hello wor');
  assert.equal(joinTranscript('', ''), '');
  assert.ok(SPEECH_LANGUAGES.some((l) => l.code === 'si-LK'));
});
test('ocr: file validation', () => {
  assert.match(validateImageFile(null), /Choose/);
  assert.match(validateImageFile({ type: 'text/plain', size: 1 }), /not an image/);
  assert.match(validateImageFile({ type: 'image/png', size: OCR_MAX_BYTES + 1 }), /too large/);
  assert.equal(validateImageFile({ type: 'image/jpeg', size: 1000 }), null);
});
