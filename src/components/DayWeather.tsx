import { useEffect, useState } from 'react';
import { Sun, Cloud, CloudRain, RefreshCw } from 'lucide-react';
import { loadWeather, locate, weatherKind, type Weather, type Location } from '../lib/weather';

type Labels = Record<'title'|'sereno'|'nuvoloso'|'pioggia'|'error'|'loading'|'location'|'retry', string>;
export default function DayWeather({ dayKey, labels }: { dayKey: string; labels: Labels }) {
  const [data, setData] = useState<Weather>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(true);
  const [revision, setRevision] = useState(0);
  const [chosen, setChosen] = useState<Location>();
  const refreshLocation = async () => {
    setBusy(true);
    try { setChosen(await locate(true)); }
    catch { setError(labels.location); }
    finally { setBusy(false); }
  };
  useEffect(() => {
    let active = true;
    setBusy(true); setError('');
    loadWeather(dayKey, chosen).then(v => { if (active) setData(v); })
      .catch(e => { if (active) setError(e.message === 'location' ? labels.location : labels.error); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [dayKey, chosen, revision, labels]);
  const kind = data ? weatherKind(data.code) : undefined;
  const Icon = kind === 'sereno' ? Sun : kind === 'pioggia' ? CloudRain : Cloud;
  return (
    <div className="rounded-sm border border-border bg-neutral-50 px-3 py-1" aria-label={labels.title}>
      <div aria-live="polite">
        {busy ? <p className="text-sm text-neutral-500">{labels.loading}</p> : error ? (
          <div className="space-y-2"><p className="text-sm text-neutral-500">{error}</p>
            <button type="button" className="min-h-11 text-sm font-bold flex items-center gap-2" onClick={() => {
              if (error === labels.location) void refreshLocation();
              else setRevision(v => v + 1);
            }}><RefreshCw size={16} />{labels.retry}</button>
          </div>
        ) : data && kind && (
          <div className="flex w-full min-h-11 items-center gap-2.5 text-left">
            <Icon size={23} strokeWidth={1.8} aria-hidden="true" className={`shrink-0 ${kind === 'sereno' ? 'text-amber-500' : kind === 'pioggia' ? 'text-blue-500' : 'text-slate-500'}`} />
            <span className="font-bold text-sm">{labels[kind]}</span>
            <span className="ml-auto text-sm font-medium text-neutral-500 whitespace-nowrap">{Math.round(data.min)}° / {Math.round(data.max)}°C</span>
          </div>
        )}
      </div>
    </div>
  );
}
