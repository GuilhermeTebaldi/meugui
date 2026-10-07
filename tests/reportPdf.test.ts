import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { getItemsForDay, checkItemVisibility } from '../src/lib/agendaDay';
import { generateReportPdf, layoutReportTexts, measureReportText, ReportPdfError } from '../src/lib/reportPdf';
import { DEFAULT_REPORT_CONFIG, isValidReportConfig, loadReportConfig, REPORT_CONFIG_KEY,
  resetReportConfig, saveReportConfig } from '../src/lib/reportPdfConfig';
import type { AgendaItem } from '../src/types';

const template = new Uint8Array(readFileSync(new URL('../public/templates/rapporto-ore-manutenzione.pdf', import.meta.url)));
const date = new Date(2026, 8, 24);
const config = DEFAULT_REPORT_CONFIG;
const short = (count: number) => Array.from({ length: count }, (_, i) => `Controllo pompa ${i + 1}`);

test('1 short entry occupies 1 page', async () => {
  assert.equal((await PDFDocument.load(await generateReportPdf(short(1), date, config, template))).getPageCount(), 1);
});
test('13 short entries occupy 1 page', async () => {
  assert.equal((await PDFDocument.load(await generateReportPdf(short(13), date, config, template))).getPageCount(), 1);
});
test('shrinks a description until it fits and only wraps after reaching the minimum', async () => {
  const font = await (await PDFDocument.create()).embedFont(StandardFonts.Helvetica);
  const text = 'Controllo elettrovalvola linea fanghi apertura e chiusura completa';
  const narrow = { ...config, description: { ...config.description, width: 240 } };
  const lines = layoutReportTexts([text], font, narrow);
  assert.equal(lines.length, 1);
  assert.ok(lines[0].fontSize < narrow.description.fontSize);
  assert.ok(lines[0].fontSize >= narrow.description.minFontSize);
  const wrapping = { ...config, description: { ...config.description, width: 80 } };
  const wrapped = layoutReportTexts([text], font, wrapping);
  assert.ok(wrapped.length > 1);
  assert.ok(wrapped.every(line => line.fontSize === wrapping.description.minFontSize));
});
test('14 short entries occupy 2 pages', async () => {
  assert.equal((await PDFDocument.load(await generateReportPdf(short(14), date, config, template))).getPageCount(), 2);
});
test('long descriptions and oversized words retain all content within row widths', async () => {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const text = 'Controllo elettrovalvola linea fanghi apertura e chiusura '.repeat(25) + 'Z'.repeat(350);
  const lines = layoutReportTexts([text], font, config);
  assert.ok(lines.length > 13);
  assert.equal(lines.map(line => line.text).join('').replace(/\s/g, ''), text.replace(/\s/g, ''));
  assert.ok(lines.every(line => measureReportText(line.text, font, line.fontSize) <= config.description.width));
  assert.ok(lines.every(line => line.fontSize >= config.description.minFontSize));
  assert.equal((await PDFDocument.load(await generateReportPdf([text, text], date, config, template))).getPageCount(),
    Math.ceil(lines.length * 2 / 13));
});
test('Italian/Portuguese accents are encoded without loss', async () => {
  const font = await (await PDFDocument.create()).embedFont(StandardFonts.Helvetica);
  const text = 'à è é ò ù ì ç ã õ';
  assert.equal(layoutReportTexts([text], font, config)[0].text, text);
  await generateReportPdf([text], date, config, template);
});
test('unsupported characters and empty reports fail explicitly', async () => {
  await assert.rejects(generateReportPdf(['🙂'], date, config, template), (error: ReportPdfError) => error.code === 'unsupported');
  await assert.rejects(generateReportPdf(['  '], date, config, template), (error: ReportPdfError) => error.code === 'empty');
});
test('day selection uses recurrence/exceptions and ascending order without changing items', () => {
  const item = (id: string, recurrence: AgendaItem['recurrence'], timestamp: number, overrides = {}): AgendaItem => ({
    id, text: id, category: 'Lavoro', timestamp, scheduledDate: '2026-09-01', recurrence, completedDates: [], ...overrides,
  });
  const items = [item('daily', 'daily', 3), item('single', 'none', 4, { scheduledDate: '2026-09-24' }),
    item('otherCategory', 'workdays', 5, { category: 'Altro' }),
    item('excepted', 'daily', 10, { exceptionDates: ['2026-09-24'] }), item('future', 'daily', 11, { scheduledDate: '2026-09-25' }),
    item('weekly', 'weekly', 2, { scheduledDate: '2026-09-17' }), item('monthly', 'monthly', 1, { scheduledDate: '2026-08-24' })];
  const original = JSON.stringify(items);
  assert.deepEqual(getItemsForDay(items, date).map(item => item.id), ['monthly', 'weekly', 'daily', 'single', 'otherCategory']);
  assert.equal(JSON.stringify(items), original);
  assert.equal(checkItemVisibility(item('saturday', 'mon-sat', 1), new Date(2026, 8, 26)), true);
  assert.equal(checkItemVisibility(item('sunday', 'mon-sat', 1), new Date(2026, 8, 27)), false);
});
test('saved calibration survives reload, corrupt values fall back and reset only deletes its own key', () => {
  const data = new Map<string, string>([['agenda_mental_items', 'unchanged']]);
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => data.set(key, value),
    removeItem: (key: string) => data.delete(key),
  } });
  const saved = { ...config, date: { ...config.date, x: 451 } };
  saveReportConfig(saved);
  assert.deepEqual(loadReportConfig(), saved);
  for (const corrupt of ['{', 'null', '{}', JSON.stringify({ ...saved, description: { ...saved.description, rowsPerPage: 14 } })]) {
    data.set(REPORT_CONFIG_KEY, corrupt);
    assert.deepEqual(loadReportConfig(), config);
  }
  resetReportConfig();
  assert.equal(data.get('agenda_mental_items'), 'unchanged');
  assert.ok(isValidReportConfig(config));
  for (const value of [0, -1, Infinity, NaN]) {
    assert.equal(isValidReportConfig({ ...config, description: { ...config.description, width: value } }), false);
  }
  assert.equal(isValidReportConfig({ ...config, description: { ...config.description, firstLineY: 100 } }), false);
});
test('template bytes remain unchanged after generating multiple pages', async () => {
  const original = template.slice();
  await generateReportPdf(short(30), date, config, template);
  assert.deepEqual(template, original);
});
