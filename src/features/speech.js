/** Web Speech API wrapper. NOTE: most browsers send the audio to their own speech service. */
export const SPEECH_LANGUAGES = [
  { code: 'si-LK', label: 'Sinhala' },
  { code: 'en-US', label: 'English' },
  { code: 'ta-LK', label: 'Tamil' },
];

export function getRecognitionCtor(win = typeof window !== 'undefined' ? window : undefined) {
  return win?.SpeechRecognition || win?.webkitSpeechRecognition || null;
}

/** Joins a finished transcript and the live interim text with sensible spacing. */
export function joinTranscript(finalText, interimText) {
  return [finalText, interimText].map((s) => (s || '').trim()).filter(Boolean).join(' ');
}
