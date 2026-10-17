/**
 * Scan text from a photo with Tesseract (Sinhala + English). The image is
 * processed on this device; only the language model files are fetched (once)
 * from the Tesseract CDN, so the first scan needs a connection.
 */
export const OCR_LANGS = 'sin+eng';
export const OCR_MAX_BYTES = 12 * 1024 * 1024;

export function validateImageFile(file) {
  if (!file) return 'Choose a photo first.';
  if (!/^image\//.test(file.type || '')) return 'That file is not an image.';
  if (file.size > OCR_MAX_BYTES) return 'That photo is too large (max 12 MB).';
  return null;
}

export async function recognizeImage(file, onProgress) {
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker(OCR_LANGS, 1, {
    logger: (m) => {
      if (m.status === 'recognizing text' && onProgress) onProgress(Math.round((m.progress || 0) * 100));
    },
  });
  try {
    const { data } = await worker.recognize(file);
    return (data.text || '').trim();
  } finally {
    await worker.terminate();
  }
}
