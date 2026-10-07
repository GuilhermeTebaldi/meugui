export type Location = { latitude: number; longitude: number; name?: string };
export type Weather = { location: Location; inferred: boolean; code: number; min: number; max: number; fetchedAt: number; day: string };
const KEY = 'agenda_weather_auto_v1';
type Store = { last?: Location; locationAsked?: boolean; days: Record<string, Weather> };
let memory: Store = { days: {} };
const validLocation = (v: Location | undefined): v is Location => !!v && Number.isFinite(v.latitude) && Math.abs(v.latitude) <= 90 && Number.isFinite(v.longitude) && Math.abs(v.longitude) <= 180;
function read(): Store {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || '{}');
    return { last: validLocation(v.last) ? v.last : undefined, locationAsked: v.locationAsked === true, days: Object.fromEntries(Object.entries(v.days || {}).filter((entry): entry is [string, Weather] => {
      const [day, value] = entry;
      const d = value as Weather;
      return /^\d{4}-\d{2}-\d{2}$/.test(day) && d && d.day === day && validLocation(d.location) && [d.code,d.min,d.max,d.fetchedAt].every(Number.isFinite) && typeof d.inferred === 'boolean';
    })) };
  } catch { return memory; }
}
function save(v: Store) { memory = v; try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* Independent weather cache is optional. */ } }
export function localDay() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
let gps: Promise<Location> | undefined;
let gpsDay = '';
export function locate(retry = false): Promise<Location> {
  const stored = read();
  if (!retry && stored.last) return Promise.resolve(stored.last);
  if (!retry && stored.locationAsked && (!gps || gpsDay !== localDay())) return Promise.reject(new Error('location'));
  if (retry || gpsDay !== localDay()) { gps = undefined; gpsDay = localDay(); }
  return gps ||= new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('location'));
    save({ ...read(), locationAsked: true });
    navigator.geolocation.getCurrentPosition(p => {
      const location = { latitude: p.coords.latitude, longitude: p.coords.longitude };
      save({ ...read(), last: location }); resolve(location);
    }, () => reject(new Error('location')), { timeout: 12000, maximumAge: 300000 });
  });
}
async function json(url: string) {
  const r = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw new Error('weather');
  return r.json();
}
export function weatherKind(code: number): 'sereno' | 'nuvoloso' | 'pioggia' {
  if (code === 0 || code === 1) return 'sereno';
  if ([51,53,55,56,57,61,63,65,66,67,80,81,82,95,96,99].includes(code)) return 'pioggia';
  return 'nuvoloso';
}
export async function loadWeather(day: string, chosen?: Location): Promise<Weather> {
  const store = read(), existing = store.days[day];
  let current: Location | undefined;
  let located = false;
  if (chosen) { current = chosen; save({ ...store, last: chosen }); }
  else if (store.last || existing?.location) { current = store.last || existing?.location; }
  else { try { current = await locate(); located = true; } catch { current = read().last; } }
  const location = chosen || existing?.location || current;
  if (!location) throw new Error('location');
  const inferred = chosen ? false : existing?.inferred ?? (day !== localDay() || !located);
  const age = (Date.parse(localDay()) - Date.parse(day)) / 86400000;
  const same = existing && existing.location.latitude === location.latitude && existing.location.longitude === location.longitude;
  if (same && !chosen && Date.now()-existing.fetchedAt < (age > 5 ? 30*86400000 : 3600000)) return existing;
  const base = age > 5 ? 'https://archive-api.open-meteo.com/v1/archive' : 'https://api.open-meteo.com/v1/forecast';
  const params = new URLSearchParams({ latitude: String(location.latitude), longitude: String(location.longitude), start_date: day, end_date: day, daily: 'weather_code,temperature_2m_min,temperature_2m_max', timezone: 'auto' });
  const data = await json(`${base}?${params}`), daily = data.daily;
  const index = daily?.time?.indexOf(day) ?? -1;
  const code = daily?.weather_code?.[index], min = daily?.temperature_2m_min?.[index], max = daily?.temperature_2m_max?.[index];
  if (index < 0 || ![code,min,max].every(v => typeof v === 'number' && Number.isFinite(v)) ||
    ![0,1,2,3,45,48,51,53,55,56,57,61,63,65,66,67,71,73,75,77,80,81,82,85,86,95,96,99].includes(code)) throw new Error('weather');
  const result = { day, location, inferred, code, min, max, fetchedAt: Date.now() };
  const latest = read(); save({ ...latest, days: { ...latest.days, [day]: result } });
  return result;
}
