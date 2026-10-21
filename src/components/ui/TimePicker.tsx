import React from 'react';
import { inputCls } from './Common.tsx';
import { toPersianDigits } from '../../utils/jalali.ts';

interface Props {
  value: string;
  onChange: (v: string) => void;
  /** minute granularity of the dropdown */
  step?: number;
  disabled?: boolean;
  className?: string;
}

export const TimePicker: React.FC<Props> = ({ value, onChange, step = 5, disabled, className = '' }) => {
  const [hh, mm] = (/^\d{2}:\d{2}$/.test(value) ? value : '').split(':');
  const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
  const minutes = Array.from({ length: Math.ceil(60 / step) }, (_, i) => String(i * step).padStart(2, '0'));
  const set = (h: string, m: string) => onChange(h ? `${h}:${m || '00'}` : '');
  const minuteOptions = mm && !minutes.includes(mm) ? [...minutes, mm].sort() : minutes;
  return (
    <div className={`flex items-center gap-2 ${className}`} dir="ltr">
      <select disabled={disabled} value={hh || ''} onChange={(e) => set(e.target.value, mm || '00')} className={inputCls} aria-label="ساعت">
        <option value="">--</option>
        {hours.map((h) => <option key={h} value={h}>{toPersianDigits(h)}</option>)}
      </select>
      <span className="text-slate-500">:</span>
      <select disabled={disabled || !hh} value={mm || ''} onChange={(e) => set(hh, e.target.value)} className={inputCls} aria-label="دقیقه">
        <option value="">--</option>
        {minuteOptions.map((m) => <option key={m} value={m}>{toPersianDigits(m)}</option>)}
      </select>
    </div>
  );
};
