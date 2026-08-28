/**
 * src/health/pdfExport.js
 *
 * Plain-text PDF export, watermarked with the Rule 01 attribution on
 * every page footer.
 *
 * SCOPE NOTE: uses pdf-lib's standard fonts (Latin/WinAnsi only).
 * Proper Sinhala rendering needs complex script shaping - reordering
 * certain vowel signs to render before their consonant despite being
 * stored after it in Unicode (see sinhala/sinhalaChars.js) - which is
 * normally a text-shaping-engine's job (what HarfBuzz does for browsers
 * automatically) and isn't something pdf-lib's basic drawText provides.
 * Embedding a Sinhala font wouldn't fix that on its own. Rather than
 * silently produce garbled Sinhala output, exportEntryToPdf detects
 * non-Latin content and includes a visible notice on the page instead
 * of attempting to render it - see containsNonLatinScript below.
 */
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { APP_CREDIT } from '../config/legal.js';

const PAGE_MARGIN = 54; // 0.75in at 72dpi
const BODY_SIZE = 11;
const LINE_HEIGHT = 15;
const TITLE_SIZE = 16;

function containsNonLatinScript(text) {
  // eslint-disable-next-line no-control-regex
  return /[^\x00-\x7F\u2018\u2019\u201C\u201D\u2013\u2014\u2026]/.test(text);
}

/** Falls back to a placeholder rather than let pdf-lib throw a WinAnsi
 * encoding error - checked at the point of use (title, and separately
 * per body paragraph) rather than once for the whole entry, so a
 * realistic mixed-language entry (English with a Sinhala phrase mixed
 * in, which the Sinhala input panel makes easy to end up with) doesn't
 * lose its entire Latin-script content over one non-Latin paragraph. */
function safeText(text, placeholder) {
  return containsNonLatinScript(text) ? placeholder : text;
}

function wrapLine(text, font, size, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let current = '';

  for (const word of words) {
    const attempt = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(attempt, size) > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = attempt;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/**
 * @param {{title: string, bodyText: string, createdAt: number}} entry
 * @returns {Promise<Uint8Array>}
 */
export async function exportEntryToPdf(entry) {
  return exportEntriesToPdf([entry]);
}

/** @param {Array<{title: string, bodyText: string, createdAt: number}>} entries */
export async function exportEntriesToPdf(entries) {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const italicFont = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  let page = pdfDoc.addPage();
  let { width, height } = page.getSize();
  let y = height - PAGE_MARGIN;
  const maxWidth = width - PAGE_MARGIN * 2;

  function newPage() {
    page = pdfDoc.addPage();
    ({ width, height } = page.getSize());
    y = height - PAGE_MARGIN;
  }

  function ensureSpace(neededHeight) {
    if (y - neededHeight < PAGE_MARGIN + 20) newPage();
  }

  for (const entry of entries) {
    ensureSpace(TITLE_SIZE + LINE_HEIGHT * 2);

    const titleText = safeText(entry.title?.trim() || 'Untitled entry', '[Non-Latin title - not shown, see notice below]');
    page.drawText(titleText, { x: PAGE_MARGIN, y, size: TITLE_SIZE, font: boldFont, color: rgb(0.15, 0.1, 0.05) });
    y -= TITLE_SIZE + 6;

    const dateText = new Date(entry.createdAt).toLocaleString();
    page.drawText(dateText, { x: PAGE_MARGIN, y, size: 9, font: italicFont, color: rgb(0.4, 0.4, 0.4) });
    y -= LINE_HEIGHT + 10;

    const bodyText = entry.bodyText || '';
    const paragraphs = bodyText.split('\n');
    let hadNonLatinParagraph = containsNonLatinScript(entry.title || '');

    for (const paragraph of paragraphs) {
      if (paragraph && containsNonLatinScript(paragraph)) {
        hadNonLatinParagraph = true;
        ensureSpace(LINE_HEIGHT);
        page.drawText('[non-Latin text omitted from this paragraph]', {
          x: PAGE_MARGIN,
          y,
          size: BODY_SIZE,
          font: italicFont,
          color: rgb(0.55, 0.4, 0.4),
        });
        y -= LINE_HEIGHT;
        continue;
      }
      const lines = paragraph ? wrapLine(paragraph, font, BODY_SIZE, maxWidth) : [''];
      for (const line of lines) {
        ensureSpace(LINE_HEIGHT);
        page.drawText(line, { x: PAGE_MARGIN, y, size: BODY_SIZE, font, color: rgb(0.15, 0.15, 0.15) });
        y -= LINE_HEIGHT;
      }
    }

    if (hadNonLatinParagraph) {
      ensureSpace(LINE_HEIGHT * 2);
      y -= 4;
      page.drawText('Note: this entry contains non-Latin text (e.g. Sinhala) that PDF', {
        x: PAGE_MARGIN,
        y,
        size: 8,
        font: italicFont,
        color: rgb(0.5, 0.2, 0.2),
      });
      y -= LINE_HEIGHT - 3;
      page.drawText('export cannot render correctly yet - see CHECKPOINT_SUMMARY.md.', {
        x: PAGE_MARGIN,
        y,
        size: 8,
        font: italicFont,
        color: rgb(0.5, 0.2, 0.2),
      });
      y -= LINE_HEIGHT;
    }

    y -= LINE_HEIGHT;
  }

  // Watermark every page with the required attribution (Rule 01) - a
  // visible, honest footer rather than any hidden integrity mechanism;
  // see CHECKPOINT_SUMMARY.md's Phase 1 entry for the reasoning, which
  // applies exactly the same way to a PDF as it did to the app UI.
  const pages = pdfDoc.getPages();
  pages.forEach((p, index) => {
    const { width: w } = p.getSize();
    p.drawText(APP_CREDIT, {
      x: PAGE_MARGIN,
      y: 28,
      size: 7.5,
      font: italicFont,
      color: rgb(0.55, 0.55, 0.55),
    });
    const pageLabel = `${index + 1} / ${pages.length}`;
    const labelWidth = italicFont.widthOfTextAtSize(pageLabel, 7.5);
    p.drawText(pageLabel, {
      x: w - PAGE_MARGIN - labelWidth,
      y: 28,
      size: 7.5,
      font: italicFont,
      color: rgb(0.55, 0.55, 0.55),
    });
  });

  return pdfDoc.save();
}
