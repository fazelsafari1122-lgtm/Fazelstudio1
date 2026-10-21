import React, { useEffect, useRef, useState } from 'react';
import { Plus, Search, X } from 'lucide-react';
import { studio } from '../../services/studioApi.ts';
import { useDebounced } from '../../hooks.ts';
import { inputCls } from './Common.tsx';
import { FamilyFormModal } from './FamilyFormModal.tsx';

interface Props {
  value: number | null;
  onChange: (id: number | null, family?: any) => void;
  disabled?: boolean;
  placeholder?: string;
}

/** Search families by any family member name or mobile, with inline "new family" creation. */
export const CustomerSelector: React.FC<Props> = ({ value, onChange, disabled, placeholder = 'جستجوی نام یا موبایل...' }) => {
  const [q, setQ] = useState('');
  const dq = useDebounced(q, 200);
  const [results, setResults] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<{ id: number; name: string; phone?: string } | null>(null);
  const [creating, setCreating] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!value) { setSelected(null); return; }
    if (selected?.id === value) return;
    studio.family(value).then((d) => setSelected({ id: value, name: `خانواده ${d.family.family_name}`, phone: d.family.phone })).catch(() => setSelected(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setLoading(true);
    studio.families({ q: dq }).then((r) => { if (alive) setResults(r.slice(0, 8)); }).catch(() => { if (alive) setResults([]); }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [dq, open]);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const choose = (f: any) => {
    setSelected({ id: f.id, name: f.display_name, phone: f.phone });
    onChange(f.id, f);
    setOpen(false);
    setQ('');
  };

  return (
    <div ref={ref} className="relative">
      {selected && value ? (
        <div className="flex items-center justify-between gap-2 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm">
          <span className="text-slate-100">{selected.name}<span className="text-slate-500 mr-2" dir="ltr">{selected.phone}</span></span>
          {!disabled && <button type="button" onClick={() => { setSelected(null); onChange(null); }} className="text-slate-500 hover:text-slate-200" aria-label="تغییر مشتری"><X className="w-4 h-4" /></button>}
        </div>
      ) : (
        <div className="relative">
          <Search className="w-4 h-4 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input disabled={disabled} className={`${inputCls} pr-9`} value={q} placeholder={placeholder} onFocus={() => setOpen(true)} onChange={(e) => { setQ(e.target.value); setOpen(true); }} />
        </div>
      )}
      {open && !selected && (
        <div className="absolute z-[95] mt-1 w-full bg-slate-900 border border-slate-700 rounded-xl shadow-2xl max-h-72 overflow-y-auto">
          {loading && <div className="px-3 py-2 text-xs text-slate-400">در حال جستجو...</div>}
          {!loading && results.length === 0 && <div className="px-3 py-3 text-xs text-slate-400">مشتری‌ای پیدا نشد.</div>}
          {results.map((f) => (
            <button key={f.id} type="button" onClick={() => choose(f)} className="w-full text-right px-3 py-2 hover:bg-slate-800 border-b border-slate-800/60 last:border-0">
              <div className="text-sm text-slate-100">{f.display_name}</div>
              <div className="text-[11px] text-slate-400">{[f.father?.first_name, f.mother?.first_name].filter(Boolean).join(' و ')} <span dir="ltr" className="mr-2">{f.phone}</span></div>
            </button>
          ))}
          <button type="button" onClick={() => { setCreating(true); setOpen(false); }} className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-amber-300 hover:bg-slate-800 sticky bottom-0 bg-slate-900 border-t border-slate-700">
            <Plus className="w-4 h-4" />ثبت مشتری جدید
          </button>
        </div>
      )}
      <FamilyFormModal open={creating} onClose={() => setCreating(false)} onSaved={async (id) => {
        setCreating(false);
        try { const d = await studio.family(id); choose({ id, display_name: `خانواده ${d.family.family_name}`, phone: d.family.phone }); } catch { /* selection will load lazily */ }
      }} />
    </div>
  );
};
