/**
 * Print / "Save as PDF" through the browser's own text engine.
 *
 * pdf-lib can't shape Sinhala (see health/pdfExport.js), but every browser
 * can, so for Sinhala (or any non-Latin) entries we render a clean print
 * page and hand it to window.print(); "Save as PDF" is in the print dialog.
 * Everything stays on this device - nothing is uploaded.
 */
import { APP_CREDIT, APP_NAME } from '../config/legal.js';

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** @param {Array<{title: string, bodyText: string, createdAt: number}>} entries */
export function buildPrintHtml(entries) {
  const sections = entries
    .map((e) => {
      const paragraphs = String(e.bodyText || '')
        .split('\n')
        .map((line) => (line.trim() ? `<p>${escapeHtml(line)}</p>` : '<p class="gap">&nbsp;</p>'))
        .join('');
      const date = e.createdAt ? new Date(e.createdAt).toLocaleString() : '';
      return `<section><h1>${escapeHtml(e.title?.trim() || 'Untitled entry')}</h1><time>${escapeHtml(date)}</time>${paragraphs}</section>`;
    })
    .join('');
  return `<!doctype html><html lang="si"><head><meta charset="utf-8"><title>${escapeHtml(APP_NAME)} export</title><style>
@page{margin:18mm 16mm 22mm}
body{font-family:"Iskoola Pota","Noto Sans Sinhala","Nirmala UI",Georgia,serif;font-size:12pt;line-height:1.6;color:#222;margin:0}
section{break-after:page}section:last-of-type{break-after:auto}
h1{font-size:18pt;margin:0 0 2pt}time{display:block;font-size:9pt;color:#666;margin-bottom:12pt}
p{margin:0 0 6pt;white-space:pre-wrap;overflow-wrap:anywhere}.gap{margin:0}
footer{position:fixed;bottom:0;left:0;right:0;text-align:center;font:8pt sans-serif;color:#777}
</style></head><body>${sections}<footer>${escapeHtml(APP_CREDIT)}</footer></body></html>`;
}

/** Opens the print dialog for the given entries via a hidden iframe. */
export function printEntries(entries) {
  return new Promise((resolve) => {
    const frame = document.createElement('iframe');
    frame.setAttribute('aria-hidden', 'true');
    frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
    frame.srcdoc = buildPrintHtml(entries);
    frame.onload = () => {
      const win = frame.contentWindow;
      win.focus();
      win.print();
      setTimeout(() => {
        frame.remove();
        resolve();
      }, 1000);
    };
    document.body.appendChild(frame);
  });
}
