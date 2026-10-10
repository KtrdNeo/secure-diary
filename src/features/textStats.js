export function countWords(text) {
  const t = (text || '').trim();
  return t ? t.split(/\s+/).length : 0;
}
export function readingMinutes(words) {
  return words > 0 ? Math.max(1, Math.ceil(words / 200)) : 0;
}
