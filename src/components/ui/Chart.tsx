import React from 'react';
import { toPersianDigits } from '../../utils/jalali.ts';

export interface ChartSeries { name: string; color: string; values: number[] }

const compact = (n: number) => {
  const a = Math.abs(n);
  if (a >= 1_000_000_000) return `${toPersianDigits((n / 1_000_000_000).toFixed(1).replace(/\.0$/, ''))} میلیارد`;
  if (a >= 1_000_000) return `${toPersianDigits((n / 1_000_000).toFixed(1).replace(/\.0$/, ''))} م`;
  if (a >= 1_000) return `${toPersianDigits(Math.round(n / 1_000))} هزار`;
  return toPersianDigits(Math.round(n));
};

interface Props { labels: string[]; series: ChartSeries[]; height?: number; kind?: 'bar' | 'line'; format?: (n: number) => string }

/** Dependency-free SVG chart: grouped bars or lines. */
export const Chart: React.FC<Props> = ({ labels, series, height = 220, kind = 'bar', format = compact }) => {
  const W = 640; const H = height; const padL = 46; const padR = 10; const padT = 12; const padB = 28;
  const max = Math.max(1, ...series.flatMap((s) => s.values));
  const innerW = W - padL - padR; const innerH = H - padT - padB;
  const n = Math.max(1, labels.length);
  const slot = innerW / n;
  const y = (v: number) => padT + innerH - (v / max) * innerH;
  const ticks = [0, 0.25, 0.5, 0.75, 1];
  const hasData = series.some((s) => s.values.some((v) => v > 0));

  return (
    <div>
      <div className="flex flex-wrap gap-3 mb-2 text-[11px] text-slate-300">
        {series.map((s) => <span key={s.name} className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: s.color }} />{s.name}</span>)}
      </div>
      <div dir="ltr" className="w-full overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[420px]" style={{ height }} role="img" aria-label="نمودار">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={padL} x2={W - padR} y1={y(max * t)} y2={y(max * t)} stroke="#1e293b" strokeWidth="1" />
              <text x={padL - 6} y={y(max * t) + 3} textAnchor="end" fontSize="9" fill="#64748b">{format(max * t)}</text>
            </g>
          ))}
          {kind === 'bar' && series.map((s, si) => {
            const bw = Math.max(3, (slot * 0.7) / series.length);
            return s.values.map((v, i) => (
              <rect key={`${si}-${i}`} x={padL + i * slot + slot * 0.15 + si * bw} y={y(v)} width={bw - 1} height={Math.max(0, padT + innerH - y(v))} rx="2" fill={s.color} opacity="0.9">
                <title>{`${s.name}: ${format(v)}`}</title>
              </rect>
            ));
          })}
          {kind === 'line' && series.map((s) => (
            <g key={s.name}>
              <polyline fill="none" stroke={s.color} strokeWidth="2" points={s.values.map((v, i) => `${padL + i * slot + slot / 2},${y(v)}`).join(' ')} />
              {s.values.map((v, i) => <circle key={i} cx={padL + i * slot + slot / 2} cy={y(v)} r="3" fill={s.color}><title>{`${s.name}: ${format(v)}`}</title></circle>)}
            </g>
          ))}
          {labels.map((l, i) => (
            <text key={i} x={padL + i * slot + slot / 2} y={H - 8} textAnchor="middle" fontSize="9" fill="#94a3b8">{toPersianDigits(l)}</text>
          ))}
        </svg>
      </div>
      {!hasData && <p className="text-center text-xs text-slate-500 -mt-2">داده‌ای در این بازه ثبت نشده است</p>}
    </div>
  );
};

export const Donut: React.FC<{ items: { name: string; value: number; color: string }[]; size?: number }> = ({ items, size = 160 }) => {
  const total = items.reduce((s, i) => s + i.value, 0);
  const r = 56; const c = 2 * Math.PI * r;
  let acc = 0;
  return (
    <div className="flex flex-wrap items-center gap-4">
      <svg width={size} height={size} viewBox="0 0 160 160" role="img" aria-label="نمودار دایره‌ای">
        <circle cx="80" cy="80" r={r} fill="none" stroke="#1e293b" strokeWidth="20" />
        {total > 0 && items.filter((i) => i.value > 0).map((i) => {
          const len = (i.value / total) * c;
          const el = <circle key={i.name} cx="80" cy="80" r={r} fill="none" stroke={i.color} strokeWidth="20" strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-acc} transform="rotate(-90 80 80)"><title>{`${i.name}: ${i.value}`}</title></circle>;
          acc += len;
          return el;
        })}
        <text x="80" y="86" textAnchor="middle" fontSize="22" fontWeight="700" fill="#f1f5f9">{toPersianDigits(total)}</text>
      </svg>
      <ul className="space-y-1.5 text-xs text-slate-300">
        {items.map((i) => <li key={i.name} className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: i.color }} />{i.name}<span className="text-slate-500">({toPersianDigits(i.value)})</span></li>)}
      </ul>
    </div>
  );
};
