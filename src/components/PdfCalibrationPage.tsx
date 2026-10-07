import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import { PDFDocument, StandardFonts, type PDFFont } from 'pdf-lib';
import type { TRANSLATIONS } from '../App';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { DEFAULT_REPORT_CONFIG, descriptionBaseline, isValidReportConfig, loadReportConfig,
  resetReportConfig, saveReportConfig, TEMPLATE_SIZE, type ReportConfig } from '../lib/reportPdfConfig';
import { downloadDailyReport, layoutReportTexts, loadReportTemplate, TEST_REPORT_DATE, TEST_REPORT_TEXTS } from '../lib/reportPdf';

type Labels = { [K in keyof typeof TRANSLATIONS.pt.pdf]: string };
type DragKind = 'description' | 'date' | 'width';
const buttonClass = 'min-h-12 p-3 border-2 border-ink rounded-sm font-bold text-sm bg-white hover:bg-neutral-100 disabled:opacity-40';

export default function PdfCalibrationPage({ labels: t }: { labels: Labels }) {
  const [config, setConfig] = useState<ReportConfig>(loadReportConfig);
  const [zoom, setZoom] = useState(1);
  const [viewportWidth, setViewportWidth] = useState(320);
  const [pageSize, setPageSize] = useState(TEMPLATE_SIZE);
  const [ready, setReady] = useState(false);
  const [font, setFont] = useState<PDFFont | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const viewport = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const jsonField = useRef<HTMLTextAreaElement>(null);
  const drag = useRef<{ pointerId: number; kind: DragKind; clientX: number; clientY: number; scale: number; config: ReportConfig } | null>(null);
  const valid = isValidReportConfig(config, pageSize);
  const scale = viewportWidth / pageSize.width * zoom;
  const previewLines = useMemo(() => {
    if (!font || !valid) return TEST_REPORT_TEXTS.map(text => ({ text, fontSize: config.description.fontSize }));
    return layoutReportTexts(TEST_REPORT_TEXTS, font, config).slice(0, 13);
  }, [font, config, valid]);

  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const observer = new ResizeObserver(() => setViewportWidth(element.clientWidth));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    let destroy: (() => void) | undefined;
    void (async () => {
      try {
        const pdfjs = await import('pdfjs-dist');
        pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
        if (cancelled) return;
        const standardFont = await (await PDFDocument.create()).embedFont(StandardFonts.Helvetica);
        if (cancelled) return;
        setFont(standardFont);
        const task = pdfjs.getDocument({ data: (await loadReportTemplate()).slice() });
        destroy = () => { void task.destroy(); };
        if (cancelled) { destroy(); return; }
        const pdf = await task.promise;
        const page = await pdf.getPage(1);
        if (cancelled || !canvas.current) return;
        const size = page.getViewport({ scale: 1 });
        setPageSize({ width: size.width, height: size.height });
        const renderViewport = page.getViewport({ scale: 2 });
        canvas.current.width = renderViewport.width;
        canvas.current.height = renderViewport.height;
        await page.render({ canvas: canvas.current, viewport: renderViewport }).promise;
        if (!cancelled) setReady(true);
      } catch {
        if (!cancelled) setStatus(t.error);
      }
    })();
    return () => { cancelled = true; destroy?.(); };
  }, [t.error]);

  const changeNumber = (group: 'description' | 'date', key: string, value: number) => {
    if (!Number.isFinite(value)) return;
    setStatus('');
    setConfig(current => ({ ...current, [group]: { ...current[group], [key]: value } }));
  };

  const startDrag = (event: PointerEvent<SVGElement>, kind: DragKind) => {
    if (!event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const rect = event.currentTarget.ownerSVGElement!.getBoundingClientRect();
    drag.current = { pointerId: event.pointerId, kind, clientX: event.clientX, clientY: event.clientY,
      scale: rect.width / pageSize.width, config };
  };

  const moveDrag = (event: PointerEvent<SVGSVGElement>) => {
    const start = drag.current;
    if (!start || start.pointerId !== event.pointerId) return;
    const dx = (event.clientX - start.clientX) / start.scale;
    const dy = -(event.clientY - start.clientY) / start.scale;
    const original = start.config;
    const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
    if (start.kind === 'width') {
      setConfig({ ...original, description: { ...original.description,
        width: clamp(original.description.width + dx, 1, pageSize.width - original.description.x) } });
    } else if (start.kind === 'description') {
      const d = original.description;
      setConfig({ ...original, description: { ...d,
        x: clamp(d.x + dx, 0, pageSize.width - d.width),
        firstLineY: clamp(d.firstLineY + dy, 12 * d.rowHeight, pageSize.height - d.rowHeight) } });
    } else {
      const d = original.date;
      setConfig({ ...original, date: { ...d,
        x: clamp(d.x + dx, 0, pageSize.width - d.width),
        y: clamp(d.y + dy, 0, pageSize.height - d.fontSize) } });
    }
    setStatus('');
  };

  const runTest = async () => {
    setBusy(true);
    setStatus('');
    try { await downloadDailyReport(TEST_REPORT_TEXTS, TEST_REPORT_DATE, config); }
    catch { setStatus(t.error); }
    finally { setBusy(false); }
  };

  const copyConfig = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(config, null, 2));
      setStatus(t.copied);
    } catch {
      jsonField.current?.focus();
      jsonField.current?.select();
    }
  };

  const numericField = (group: 'description' | 'date', key: string, label: string) => (
    <label key={`${group}-${key}`} className="flex flex-col gap-1 text-sm font-semibold">
      {label}
      <input type="number" step="0.1" inputMode="decimal"
        aria-label={`${group === 'date' ? t.date : t.description}: ${label}`}
        value={(config[group] as unknown as Record<string, number>)[key]}
        onChange={event => changeNumber(group, key, event.currentTarget.valueAsNumber)}
        className="w-full min-h-12 border-2 border-border p-2 rounded-sm text-base tabular-nums" />
    </label>
  );

  const d = config.description;
  const date = config.date;
  const descriptionTop = pageSize.height - d.firstLineY - d.rowHeight;
  return (
    <main className="app-shell overflow-y-auto overscroll-contain bg-bg text-ink p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-5">
        <a href="#" className="inline-flex min-h-12 items-center font-bold text-highlight">{t.back}</a>
        <h1 className="text-2xl font-black uppercase">{t.title}</h1>
        <p className="text-sm text-neutral-600">{t.hint}</p>
        <label className="flex flex-wrap items-center gap-3 font-bold text-sm">
          {t.zoom} {Math.round(zoom * 100)}%
          <input aria-label={t.zoom} type="range" min="1" max="4" step="0.1" value={zoom}
            onChange={event => setZoom(Number(event.target.value))} className="min-h-12 flex-1 min-w-40" />
        </label>
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-5 items-start">
          <div ref={viewport} className="overflow-auto max-h-[75vh] bg-neutral-200 border border-border">
            <div className="relative bg-white" style={{ width: pageSize.width * scale, height: pageSize.height * scale }}>
              <canvas ref={canvas} className="absolute inset-0 w-full h-full" />
              {!ready && <p className="absolute top-4 left-4 bg-white p-2">{t.loading}</p>}
              {ready && <svg viewBox={`0 0 ${pageSize.width} ${pageSize.height}`} className="absolute inset-0 w-full h-full"
                onPointerMove={moveDrag}
                onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}>
                <g onPointerDown={event => startDrag(event, 'description')} style={{ touchAction: 'none', cursor: 'move' }}>
                  <rect x={d.x} y={descriptionTop} width={Math.max(0, d.width)} height={Math.max(0, d.rowHeight * 13)}
                    fill="#007bff" fillOpacity="0.06" stroke="#007bff" strokeWidth="0.6" />
                  {previewLines.map((line, row) => <g key={row}>
                    <line x1={d.x} x2={d.x + d.width} y1={descriptionTop + (row + 1) * d.rowHeight}
                      y2={descriptionTop + (row + 1) * d.rowHeight} stroke="#007bff" strokeWidth="0.4" />
                    <text x={d.x} y={pageSize.height - descriptionBaseline(config, row)} fontSize={line.fontSize}
                      fontFamily="Helvetica, Arial, sans-serif" style={{ fontKerning: 'none' }} fill="#000">{line.text}</text>
                  </g>)}
                </g>
                <rect x={d.x + d.width - 12} y={descriptionTop} width="24" height={Math.max(0, d.rowHeight * 13)}
                  fill="#007bff" fillOpacity="0.1" onPointerDown={event => startDrag(event, 'width')}
                  style={{ touchAction: 'none', cursor: 'ew-resize' }} />
                <g onPointerDown={event => startDrag(event, 'date')} style={{ touchAction: 'none', cursor: 'move' }}>
                  <rect x={date.x - 4} y={pageSize.height - date.y - date.fontSize - 5}
                    width={Math.max(0, date.width + 8)} height={Math.max(24, date.fontSize + 10)}
                    fill="#28a745" fillOpacity="0.1" stroke="#28a745" strokeWidth="0.6" />
                  <text x={date.x} y={pageSize.height - date.y} fontSize={date.fontSize}
                    fontFamily="Helvetica, Arial, sans-serif">24/09/2026</text>
                </g>
              </svg>}
            </div>
          </div>
          <div className="space-y-5">
            <fieldset className="border border-border bg-white p-4 rounded-sm">
              <legend className="font-black uppercase px-1">{t.description}</legend>
              <div className="grid grid-cols-2 gap-3">
                {numericField('description', 'x', 'X')}
                {numericField('description', 'firstLineY', t.firstY)}
                {numericField('description', 'width', t.width)}
                {numericField('description', 'rowHeight', t.spacing)}
                {numericField('description', 'fontSize', t.font)}
                {numericField('description', 'minFontSize', t.minFont)}
                {numericField('description', 'baselineOffset', t.baseline)}
              </div>
            </fieldset>
            <fieldset className="border border-border bg-white p-4 rounded-sm">
              <legend className="font-black uppercase px-1">{t.date}</legend>
              <div className="grid grid-cols-2 gap-3">
                {numericField('date', 'x', 'X')}{numericField('date', 'y', 'Y')}
                {numericField('date', 'fontSize', t.font)}{numericField('date', 'width', t.width)}
              </div>
            </fieldset>
            {!valid && <p role="alert" className="text-sm text-red-600">{t.invalid}</p>}
            <div className="grid gap-3">
              <button className={buttonClass} disabled={!valid || !ready || busy} onClick={runTest}>{busy ? t.generating : t.test}</button>
              <button className={buttonClass} disabled={!valid || !ready} onClick={() => {
                try { saveReportConfig(config); setStatus(t.saved); } catch { setStatus(t.storageError); }
              }}>{t.save}</button>
              <button className={buttonClass} disabled={!valid} onClick={copyConfig}>{t.copy}</button>
              <button className={buttonClass} onClick={() => {
                try { resetReportConfig(); setConfig(DEFAULT_REPORT_CONFIG); setStatus(t.resetDone); }
                catch { setStatus(t.storageError); }
              }}>{t.reset}</button>
            </div>
            <p role="status" className="text-sm font-semibold">{status}</p>
            <label className="block text-sm font-bold">{t.json}
              <textarea ref={jsonField} readOnly value={JSON.stringify(config, null, 2)}
                className="mt-2 w-full h-60 p-3 border border-border bg-white font-mono text-sm" />
            </label>
          </div>
        </div>
      </div>
    </main>
  );
}
