import { useEffect, useState } from 'react';
import { Sun, Cloud, CloudRain, MapPin, RefreshCw } from 'lucide-react';
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
    <div className="rounded-sm border-2 border-border bg-neutral-50 p-4 space-y-3" aria-label={labels.title}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] font-black uppercase tracking-widest text-neutral-500">{labels.title}</span>
        <button type="button" onClick={() => setEditing(!editing)} className="min-h-11 text-xs font-bold text-blue-600 flex items-center gap-1"><MapPin size={14} />{labels.city}</button>
      </div>
      <div aria-live="polite">
        {busy ? <p className="text-sm text-neutral-500">{labels.loading}</p> : error ? (
          <div className="space-y-2"><p className="text-sm text-neutral-500">{error}</p>
            <button type="button" className="min-h-11 text-sm font-bold flex items-center gap-2" onClick={() => { void locate(true).catch(() => {}); setRevision(v => v + 1); }}><RefreshCw size={16} />{labels.retry}</button>
          </div>
        ) : data && kind && (
          <div className="flex items-center gap-4">
            <div className={`rounded-full p-3 shrink-0 ${kind === 'sereno' ? 'bg-amber-100 text-amber-500' : kind === 'pioggia' ? 'bg-blue-100 text-blue-500' : 'bg-slate-200 text-slate-500'}`}><Icon size={32} strokeWidth={1.8} aria-hidden="true" /></div>
            <div className="min-w-0"><p className="font-bold text-lg">{labels[kind]} <span className="ml-2 text-sm font-medium text-neutral-500">{Math.round(data.min)}° / {Math.round(data.max)}°C</span></p>
              <p className="text-xs text-neutral-500">{dayKey >= localDay() ? labels.forecast : labels.history}</p>
              {[71,73,75,77,85,86].includes(data.code) && <p className="text-xs text-neutral-500">{labels.snow}</p>}
            </div>
          </div>
        )}
      </div>
      {!busy && !error && data && <p className="text-xs text-neutral-500 break-words">{data.inferred && `${labels.reference} · `}{data.location.name || `${data.location.latitude.toFixed(3)}, ${data.location.longitude.toFixed(3)}`}</p>}
      {(editing || (!busy && error === labels.location)) && (
        <form className="space-y-2" onSubmit={async e => {
          e.preventDefault(); setEditing(true); setSearchBusy(true); setCities([]);
          try { const results = await searchCities(city, language); setCities(results); setError(results.length ? '' : labels.empty); }
          catch { setError(labels.error); } finally { setSearchBusy(false); }
        }}>
          <div className="flex gap-2"><input aria-label={labels.city} placeholder={labels.city} value={city} onChange={e => setCity(e.target.value)} className="min-w-0 flex-1 min-h-11 border-2 border-border rounded-sm px-3 bg-white text-sm" />
            <button disabled={searchBusy || city.trim().length < 2} className="min-h-11 px-3 bg-ink text-white rounded-sm text-xs font-bold disabled:opacity-50">{labels.search}</button></div>
          {cities.map((v, i) => <button type="button" key={i} className="block w-full min-h-11 text-left px-3 py-2 border border-border rounded-sm bg-white text-sm" onClick={() => { setChosen(v); setEditing(false); setCities([]); }}>{v.name}</button>)}
        </form>
      )}
      <a href="https://open-meteo.com/" target="_blank" rel="noreferrer" className="block text-[10px] text-neutral-400 underline">Open-Meteo · GeoNames</a>
    </div>
  );
}
