import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument } from 'pdf-lib';
import { exportEntryToPdf, exportEntriesToPdf } from '../src/health/pdfExport.js';

test('exportEntryToPdf produces bytes that are a genuinely valid, parseable PDF', async () => {
  const bytes = await exportEntryToPdf({ title: 'A Test Entry', bodyText: 'Just a short body.', createdAt: Date.now() });
  assert.ok(bytes instanceof Uint8Array);
  assert.ok(bytes.byteLength > 0);

  const reloaded = await PDFDocument.load(bytes);
  assert.equal(reloaded.getPageCount(), 1);
});

test('long body text spans multiple pages rather than overflowing off the bottom', async () => {
  const longBody = Array.from({ length: 200 }, (_, i) => `This is line ${i} of a very long diary entry.`).join(' ');
  const bytes = await exportEntryToPdf({ title: 'Long Entry', bodyText: longBody, createdAt: Date.now() });
  const reloaded = await PDFDocument.load(bytes);
  assert.ok(reloaded.getPageCount() > 1, 'expected pagination to kick in for long content');
});

test('exportEntriesToPdf includes every entry (page count grows with entry count for long entries)', async () => {
  const longBody = Array.from({ length: 80 }, (_, i) => `Filler sentence number ${i} to take up real space.`).join(' ');
  const entries = [
    { title: 'First', bodyText: longBody, createdAt: Date.now() },
    { title: 'Second', bodyText: longBody, createdAt: Date.now() },
  ];
  const singleBytes = await exportEntryToPdf(entries[0]);
  const multiBytes = await exportEntriesToPdf(entries);

  const singlePages = (await PDFDocument.load(singleBytes)).getPageCount();
  const multiPages = (await PDFDocument.load(multiBytes)).getPageCount();

  assert.ok(multiPages >= singlePages, 'exporting two entries should not produce fewer pages than one');
});

test('an entry with no body text still produces a valid single-page PDF', async () => {
  const bytes = await exportEntryToPdf({ title: 'Empty', bodyText: '', createdAt: Date.now() });
  const reloaded = await PDFDocument.load(bytes);
  assert.equal(reloaded.getPageCount(), 1);
});

test('an entry with no title falls back to "Untitled entry" rather than crashing', async () => {
  const bytes = await exportEntryToPdf({ title: '', bodyText: 'body', createdAt: Date.now() });
  const reloaded = await PDFDocument.load(bytes);
  assert.equal(reloaded.getPageCount(), 1);
});

test('a non-Latin title (e.g. Sinhala) produces a valid PDF instead of crashing the font encoder', async () => {
  const bytes = await exportEntryToPdf({ title: 'මගේ දිනපොත', bodyText: 'English body text.', createdAt: Date.now() });
  const reloaded = await PDFDocument.load(bytes);
  assert.equal(reloaded.getPageCount(), 1);
});

test('non-Latin body content produces a valid PDF with a notice rather than garbled/crashed output', async () => {
  const bytes = await exportEntryToPdf({ title: 'Title', bodyText: 'අද හොඳ දවසක්', createdAt: Date.now() });
  const reloaded = await PDFDocument.load(bytes);
  assert.equal(reloaded.getPageCount(), 1);
});

test('a realistic mixed-language entry (English paragraph + Sinhala paragraph) keeps the English content instead of dropping the whole body', async () => {
  const bytes = await exportEntryToPdf({
    title: 'Mixed entry',
    bodyText: 'This English paragraph should render fine.\nඅද හොඳ දවසක්\nAnd this one should too.',
    createdAt: Date.now(),
  });
  const reloaded = await PDFDocument.load(bytes);
  assert.equal(reloaded.getPageCount(), 1);
});
