import { useCallback, useEffect, useRef, useState } from 'react';

/** Maps any thrown value to a message that is safe to show to end users. */
export function errMsg(e: any, fallback = 'خطایی رخ داد'): string {
  const m = e?.message;
  if (typeof m === 'string' && /[\u0600-\u06FF]/.test(m)) return m;
  if (typeof m === 'string' && /fetch|network/i.test(m)) return 'ارتباط با سرور برقرار نشد';
  return fallback;
}

export function useAsync<T>(fn: () => Promise<T>, deps: any[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const seq = useRef(0);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const reload = useCallback(async () => {
    const my = ++seq.current;
    setLoading(true);
    setError('');
    try {
      const r = await fnRef.current();
      if (my === seq.current) setData(r);
    } catch (e) {
      if (my === seq.current) setError(errMsg(e));
    } finally {
      if (my === seq.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, setData, loading, error, reload };
}

export function useDebounced<T>(value: T, ms = 250): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export function useLocalStorage<T>(key: string, initial: T): [T, (v: T) => void] {
  const [state, setState] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? initial : (JSON.parse(raw) as T);
    } catch {
      return initial;
    }
  });
  const set = useCallback((v: T) => {
    setState(v);
    try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* storage may be unavailable */ }
  }, [key]);
  return [state, set];
}

// ---- shared lookup data (branches, halls, stages, lookups, team ...) ----
import { studio } from './services/studioApi.ts';

let metaCache: any = null;
let metaPromise: Promise<any> | null = null;

export function loadMeta(force = false): Promise<any> {
  if (!force && metaCache) return Promise.resolve(metaCache);
  if (!force && metaPromise) return metaPromise;
  metaPromise = studio.meta().then((m) => { metaCache = m; metaPromise = null; return m; }).catch((e) => { metaPromise = null; throw e; });
  return metaPromise;
}

export function notifyMetaChanged() {
  window.dispatchEvent(new Event('studio-meta-changed'));
}

export function notifyDataChanged() {
  window.dispatchEvent(new Event('studio-data-changed'));
}

export function useMeta(): any {
  const [meta, setMeta] = useState<any>(metaCache);
  useEffect(() => {
    let alive = true;
    loadMeta().then((m) => { if (alive) setMeta(m); }).catch(() => undefined);
    const on = () => loadMeta(true).then((m) => { if (alive) setMeta(m); }).catch(() => undefined);
    window.addEventListener('studio-meta-changed', on);
    return () => { alive = false; window.removeEventListener('studio-meta-changed', on); };
  }, []);
  return meta;
}
