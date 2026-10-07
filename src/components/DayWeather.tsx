import { useEffect, useState } from 'react';
import { Sun, Cloud, CloudRain, RefreshCw } from 'lucide-react';
import { loadWeather, localDay, locate, searchCities, weatherKind, type Weather, type Location } from '../lib/weather';

type Labels = Record<'title'|'sereno'|'nuvoloso'|'pioggia'|'error'|'loading'|'location'|'retry'|'city'|'search'|'reference'|'forecast'|'history'|'snow'|'empty', string>;
export default function DayWeather({ dayKey, labels, language }: { dayKey: string; labels: Labels; language: string }) {
  const [data, setData] = useState<Weather>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(true);
  const [revision, setRevision] = useState(0);
  const [chosen, setChosen] = useState<Location>();
  const [editing, setEditing] = useState(false);
  const [city, setCity] = useState('');
  const [cities, setCities] = useState<Location[]>([]);
  const [searchBusy, setSearchBusy] = useState(false);
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
          <button type="button" onClick={() => setEditing(!editing)} aria-label={`${labels[kind]} · ${labels.city}`} aria-expanded={editing} className="flex w-full min-h-11 items-center gap-2.5 text-left">
            <Icon size={23} strokeWidth={1.8} aria-hidden="true" className={`shrink-0 ${kind === 'sereno' ? 'text-amber-500' : kind === 'pioggia' ? 'text-blue-500' : 'text-slate-500'}`} />
            <span className="font-bold text-sm">{labels[kind]}</span>
            <span className="ml-auto text-sm font-medium text-neutral-500 whitespace-nowrap">{Math.round(data.min)}° / {Math.round(data.max)}°C</span>
          </button>
        )}
      </div>
      {editing && !busy && !error && data && <div className="pb-2 space-y-1 text-xs text-neutral-500">
        <p>{dayKey >= localDay() ? labels.forecast : labels.history}</p>
        <p className="break-words">{data.inferred && `${labels.reference} · `}{data.location.name || `${data.location.latitude.toFixed(3)}, ${data.location.longitude.toFixed(3)}`}</p>
        {[71,73,75,77,85,86].includes(data.code) && <p>{labels.snow}</p>}
      </div>}
      {(editing || (!busy && error === labels.location)) && (
        <form className="space-y-2 py-2" onSubmit={async e => {
          e.preventDefault(); setEditing(true); setSearchBusy(true); setCities([]);
          try { const results = await searchCities(city, language); setCities(results); setError(results.length ? '' : labels.empty); }
          catch { setError(labels.error); } finally { setSearchBusy(false); }
        }}>
          <button type="button" disabled={busy} onClick={() => void refreshLocation()} className="min-h-11 text-xs font-bold text-blue-600 flex items-center gap-2 disabled:opacity-50"><RefreshCw size={14} />{labels.retry}</button>
          <div className="flex gap-2"><input aria-label={labels.city} placeholder={labels.city} value={city} onChange={e => setCity(e.target.value)} className="min-w-0 flex-1 min-h-11 border-2 border-border rounded-sm px-3 bg-white text-sm" />
            <button disabled={searchBusy || city.trim().length < 2} className="min-h-11 px-3 bg-ink text-white rounded-sm text-xs font-bold disabled:opacity-50">{labels.search}</button></div>
          {cities.map((v, i) => <button type="button" key={i} className="block w-full min-h-11 text-left px-3 py-2 border border-border rounded-sm bg-white text-sm" onClick={() => { setChosen(v); setEditing(false); setCities([]); }}>{v.name}</button>)}
        </form>
      )}
    </div>
  );
}
