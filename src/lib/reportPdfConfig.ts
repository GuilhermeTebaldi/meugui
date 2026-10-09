export interface ReportConfig {
  version: 1;
  description: {
    x: number;
    firstLineY: number;
    width: number;
    rowHeight: number;
    rowsPerPage: 13;
    fontSize: number;
    minFontSize: number;
    baselineOffset: number;
  };
  date: { x: number; y: number; fontSize: number; width: number };
}

export const REPORT_CONFIG_KEY = 'rapport_pdf_calibration_idrica_v2';
export const TEMPLATE_URL = `${import.meta.env?.BASE_URL || '/'}templates/rapporto-ore-manutenzione.pdf`;
export const TEMPLATE_SIZE = { width: 595.303937, height: 841.889764 };

// IDRICA original: weather row spans top-origin y=643.349..663.279pt.
export const REPORT_WEATHER_FIELD = Object.freeze({ x: 200, y: TEMPLATE_SIZE.height - 658, fontSize: 9 });

// First page of the original XLS: description rules at x=63.323/374.363,
// top-origin y=189.567..402.242, first row bottom=203.745; 6pt inset.
// Preserve the existing 13-row pagination, leaving the last two printed rows free.
// firstLineY is the bottom of row 1; baselineOffset moves text upward in PDF points.
export const DEFAULT_REPORT_CONFIG: ReportConfig = Object.freeze({
  version: 1,
  description: Object.freeze({
    x: 69.323,
    firstLineY: TEMPLATE_SIZE.height - 203.745,
    width: 299.04,
    rowHeight: 14.1783,
    rowsPerPage: 13,
    fontSize: 9,
    minFontSize: 6.5,
    baselineOffset: 4,
  }),
  date: Object.freeze({ x: 440, y: TEMPLATE_SIZE.height - 104.5, fontSize: 9, width: 64 }),
});

export function descriptionBaseline(config: ReportConfig, row: number): number {
  return config.description.firstLineY - row * config.description.rowHeight + config.description.baselineOffset;
}

export function isValidReportConfig(value: unknown, page = TEMPLATE_SIZE): value is ReportConfig {
  if (!value || typeof value !== 'object') return false;
  const c = value as ReportConfig;
  const d = c.description;
  const date = c.date;
  if (c.version !== 1 || !d || !date || d.rowsPerPage !== 13) return false;
  const numbers = [d.x, d.firstLineY, d.width, d.rowHeight, d.fontSize, d.minFontSize,
    d.baselineOffset, date.x, date.y, date.fontSize, date.width];
  if (!numbers.every(n => typeof n === 'number' && Number.isFinite(n))) return false;
  return d.x >= 0 && d.width > 0 && d.x + d.width <= page.width &&
    d.rowHeight > 0 && d.fontSize > 0 && d.minFontSize > 0 && d.minFontSize <= d.fontSize &&
    d.width >= d.minFontSize * 1.015 &&
    d.fontSize <= d.rowHeight && d.baselineOffset >= 0 &&
    d.baselineOffset + d.fontSize <= d.rowHeight &&
    d.firstLineY - 12 * d.rowHeight >= 0 && d.firstLineY + d.rowHeight <= page.height &&
    // Helvetica: eight digits (556 units each) and two slashes (278 units each).
    date.x >= 0 && date.width >= date.fontSize * 5.004 && date.x + date.width <= page.width &&
    date.y >= 0 && date.fontSize > 0 && date.fontSize <= 36 && date.y + date.fontSize <= page.height;
}

export function loadReportConfig(): ReportConfig {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(REPORT_CONFIG_KEY) || 'null');
    return isValidReportConfig(value) ? value : DEFAULT_REPORT_CONFIG;
  } catch {
    return DEFAULT_REPORT_CONFIG;
  }
}

export function saveReportConfig(config: ReportConfig): void {
  if (!isValidReportConfig(config)) throw new Error('Invalid PDF configuration');
  localStorage.setItem(REPORT_CONFIG_KEY, JSON.stringify(config));
}

export function resetReportConfig(): void {
  localStorage.removeItem(REPORT_CONFIG_KEY);
}
