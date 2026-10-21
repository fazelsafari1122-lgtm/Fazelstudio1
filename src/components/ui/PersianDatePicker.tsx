import React, { useEffect, useRef, useState } from 'react';
import * as jalaali from 'jalaali-js';
import { Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { JALALI_MONTH_NAMES, getTodayJalali, toEnglishDigits, toPersianDigits } from '../../utils/jalali.ts';
import { inputCls } from './Common.tsx';

const WEEK = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];

export function normalizeJalali(v: string): string {
  const s = toEnglishDigits(v).trim().replace(/-/g, '/');
  const m = s.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (!m) return '';
  const y = +m[1], mo = +m[2], d = +m[3];
  if (mo < 1 || mo > 12 || d < 1 || d > jalaali.jalaaliMonthLength(y, mo)) return '';
  return `${y}/${String(mo).padStart(2, '0')}/${String(d).padStart(2, '0')}`;
}

/** index of the first day of a Jalali month, Saturday = 0 */
export function firstWeekday(jy: number, jm: number): number {
  const g = jalaali.toGregorian(jy, jm, 1);
  const dow = new Date(Date.UTC(g.gy, g.gm - 1, g.gd)).getUTCDay();
  return (dow + 1) % 7;
}

interface Props {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
  min?: string;
  allowClear?: boolean;
  className?: string;
}

export const PersianDatePicker: React.FC<Props> = ({ value, onChange, placeholder = 'انتخاب تاریخ', disabled, min, allowClear, className = '' }) => {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(toPersianDigits(value));
  const ref = useRef<HTMLDivElement>(null);
  const base = normalizeJalali(value) || getTodayJalali();
  const [view, setView] = useState(() => { const [y, m] = base.split('/').map(Number); return { y, m }; });

  useEffect(() => { setText(toPersianDigits(value)); }, [value]);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  const openPicker = () => {
    if (disabled) return;
    const b = normalizeJalali(value) || getTodayJalali();
    const [y, m] = b.split('/').map(Number);
    setView({ y, m });
    setOpen(true);
  };

  const shift = (d: number) => {
    let { y, m } = view;
    m += d;
    if (m > 12) { m = 1; y++; }
    if (m < 1) { m = 12; y--; }
    setView({ y, m });
  };

  const commitText = () => {
    const n = normalizeJalali(text);
    if (n) onChange(n);
    else if (!text.trim()) onChange('');
    else setText(toPersianDigits(value));
  };

  const pick = (d: number) => {
    const v = `${view.y}/${String(view.m).padStart(2, '0')}/${String(d).padStart(2, '0')}`;
    if (min && v < min) return;
    onChange(v);
    setOpen(false);
  };

  const days = jalaali.jalaaliMonthLength(view.y, view.m);
  const offset = firstWeekday(view.y, view.m);
  const today = getTodayJalali();
  const cells: (number | null)[] = [...Array(offset).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];

  return (
    <div ref={ref} className={`relative ${className}`}>
      <div className="relative">
        <Calendar className="w-4 h-4 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          value={text}
          disabled={disabled}
          placeholder={placeholder}
          inputMode="numeric"
          dir="ltr"
          onFocus={openPicker}
          onChange={(e) => setText(e.target.value)}
          onBlur={commitText}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commitText(); setOpen(false); } }}
          className={`${inputCls} pr-9 text-right`}
        />
        {allowClear && value && !disabled && (
          <button type="button" onClick={() => onChange('')} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-200"><X className="w-3.5 h-3.5" /></button>
        )}
      </div>
      {open && (
        <div className="absolute z-[95] mt-1.5 right-0 w-72 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-3" dir="rtl">
          <div className="flex items-center justify-between mb-2">
            <button type="button" onClick={() => shift(-1)} className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-300" aria-label="ماه قبل"><ChevronRight className="w-4 h-4" /></button>
            <div className="text-sm font-semibold text-slate-100">{JALALI_MONTH_NAMES[view.m - 1]} {toPersianDigits(view.y)}</div>
            <button type="button" onClick={() => shift(1)} className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-300" aria-label="ماه بعد"><ChevronLeft className="w-4 h-4" /></button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-slate-500 mb-1">{WEEK.map((w) => <div key={w}>{w}</div>)}</div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((d, i) => {
              if (d === null) return <div key={i} />;
              const v = `${view.y}/${String(view.m).padStart(2, '0')}/${String(d).padStart(2, '0')}`;
              const disabledDay = !!min && v < min;
              const selected = v === normalizeJalali(value);
              const isToday = v === today;
              const friday = (offset + d - 1) % 7 === 6;
              return (
                <button key={i} type="button" disabled={disabledDay} onClick={() => pick(d)}
                  className={`h-8 rounded-lg text-xs transition-colors ${selected ? 'bg-amber-500 text-slate-950 font-bold' : isToday ? 'border border-amber-500/60 text-amber-300' : friday ? 'text-rose-400 hover:bg-slate-800' : 'text-slate-200 hover:bg-slate-800'} ${disabledDay ? 'opacity-30 cursor-not-allowed' : ''}`}>
                  {toPersianDigits(d)}
                </button>
              );
            })}
          </div>
          <div className="flex justify-between mt-2 pt-2 border-t border-slate-800">
            <button type="button" className="text-xs text-amber-400 hover:text-amber-300" onClick={() => { onChange(today); setOpen(false); }}>امروز</button>
            <button type="button" className="text-xs text-slate-400 hover:text-slate-200" onClick={() => setOpen(false)}>بستن</button>
          </div>
        </div>
      )}
    </div>
  );
};
