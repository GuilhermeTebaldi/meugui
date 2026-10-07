import { PDFDocument, PDFFont, StandardFonts } from 'pdf-lib';
import { format, isValid } from 'date-fns';
import { descriptionBaseline, isValidReportConfig, loadReportConfig, ReportConfig, TEMPLATE_URL } from './reportPdfConfig';

export const TEST_REPORT_DATE = new Date(2026, 8, 24);
export const TEST_REPORT_TEXTS = Array.from({ length: 13 }, (_, i) => `Testo di prova linea ${String(i + 1).padStart(2, '0')}`);

export class ReportPdfError extends Error {
  constructor(public code: 'empty' | 'unsupported' | 'invalid' | 'template', public detail = '') {
    super(code);
  }
}

let templatePromise: Promise<Uint8Array> | undefined;
export function loadReportTemplate(): Promise<Uint8Array> {
  if (!templatePromise) {
    templatePromise = fetch(TEMPLATE_URL).then(async response => {
      if (!response.ok) throw new ReportPdfError('template');
      return new Uint8Array(await response.arrayBuffer());
    }).catch(error => {
      templatePromise = undefined;
      throw error;
    });
  }
  return templatePromise;
}

export interface ReportLine { text: string; fontSize: number }

// drawText emits unkerned standard-font glyphs. Whole-string pdf-lib metrics
// include kerning, so sum glyph advances to match the PDF actually written.
export function measureReportText(text: string, font: PDFFont, size: number): number {
  return Array.from(text).reduce((width, char) => width + font.widthOfTextAtSize(char, size), 0);
}

// Preserve every non-whitespace character, including single words wider than a row.
function wrapParagraph(text: string, font: PDFFont, size: number, width: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.trim().split(/\s+/u)) {
    if (!word) continue;
    const candidate = line ? `${line} ${word}` : word;
    if (measureReportText(candidate, font, size) <= width) {
      line = candidate;
      continue;
    }
    if (line) { lines.push(line); line = ''; }
    for (const char of word) {
      if (measureReportText(char, font, size) > width) throw new ReportPdfError('invalid');
      if (line && measureReportText(line + char, font, size) > width) {
        lines.push(line);
        line = '';
      }
      line += char;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export function layoutReportTexts(texts: readonly string[], font: PDFFont, config: ReportConfig): ReportLine[] {
  const { width, fontSize, minFontSize } = config.description;
  const lines: ReportLine[] = [];
  for (const original of texts) {
    if (!original.trim()) continue;
    const paragraphs = original.normalize('NFC').replace(/\r\n?/g, '\n').split('\n');
    const unsupported = [...new Set(Array.from(paragraphs.join('').replace(/\s/g, '')).filter(char => {
      try { font.encodeText(char); return false; } catch { return true; }
    }))];
    if (unsupported.length) throw new ReportPdfError('unsupported', unsupported.join(' '));
    let size = fontSize;
    const fits = () => paragraphs.every(p => measureReportText(p.replace(/\s+/g, ' ').trim(), font, size) <= width);
    while (size > minFontSize && !fits()) size = Math.max(minFontSize, Math.round((size - 0.25) * 1000) / 1000);
    for (const paragraph of paragraphs) {
      if (!paragraph.trim()) { lines.push({ text: '', fontSize: size }); continue; }
      for (const text of wrapParagraph(paragraph, font, size, width)) lines.push({ text, fontSize: size });
    }
  }
  return lines;
}

export async function generateReportPdf(
  texts: readonly string[], selectedDate: Date, config: ReportConfig = loadReportConfig(),
  templateBytes?: Uint8Array,
): Promise<Uint8Array> {
  if (!texts.some(text => text.trim())) throw new ReportPdfError('empty');
  if (!isValid(selectedDate)) throw new ReportPdfError('invalid');
  const source = await PDFDocument.load((templateBytes || await loadReportTemplate()).slice());
  const templatePage = source.getPage(0);
  if (templatePage.getRotation().angle !== 0 || !isValidReportConfig(config, templatePage.getSize())) {
    throw new ReportPdfError('invalid');
  }
  const output = await PDFDocument.create();
  const font = await output.embedFont(StandardFonts.Helvetica);
  const lines = layoutReportTexts(texts, font, config);
  const dateText = format(selectedDate, 'dd/MM/yyyy');
  if (measureReportText(dateText, font, config.date.fontSize) > config.date.width) throw new ReportPdfError('invalid');
  const pages = await output.copyPages(source, Array.from({ length: Math.ceil(lines.length / config.description.rowsPerPage) }, () => 0));
  for (let start = 0; start < lines.length; start += config.description.rowsPerPage) {
    const page = pages[start / config.description.rowsPerPage];
    output.addPage(page);
    page.drawText(dateText, { x: config.date.x, y: config.date.y, size: config.date.fontSize, font });
    lines.slice(start, start + config.description.rowsPerPage).forEach((line, row) => {
      if (line.text) page.drawText(line.text, { x: config.description.x, y: descriptionBaseline(config, row), size: line.fontSize, font });
    });
  }
  return output.save();
}

export function downloadReportBytes(bytes: Uint8Array, filename: string): void {
  const blob = new Blob([bytes.slice().buffer as ArrayBuffer], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Safari may consume the Blob asynchronously after click.
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export async function downloadDailyReport(texts: readonly string[], date: Date, config?: ReportConfig): Promise<void> {
  downloadReportBytes(await generateReportPdf(texts, date, config), `rapporto-${format(date, 'dd-MM-yyyy')}.pdf`);
}
