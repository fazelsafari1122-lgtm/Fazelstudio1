import React from 'react';
import { Plus, RefreshCw, AlertTriangle, Search } from 'lucide-react';
import { toPersianDigits } from '../../utils/jalali.ts';

export const inputCls = 'w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-500/80 disabled:opacity-50';

export const money = (n: number | null | undefined) => `${toPersianDigits(Math.round(Number(n || 0)).toLocaleString('en-US'))}`;
export const moneyT = (n: number | null | undefined) => `${money(n)} تومان`;

export const Btn: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' | 'ghost'; size?: 'sm' | 'md'; loading?: boolean }> = ({ variant = 'secondary', size = 'md', loading, className = '', children, disabled, ...rest }) => {
  const base = 'inline-flex items-center justify-center gap-1.5 rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap';
  const sz = size === 'sm' ? 'px-3 py-1.5 text-xs min-h-8' : 'px-4 py-2 text-sm min-h-10';
  const v = {
    primary: 'bg-gradient-to-l from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950',
    secondary: 'bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700',
    danger: 'bg-rose-600/90 hover:bg-rose-500 text-white',
    ghost: 'text-slate-300 hover:text-white hover:bg-slate-800',
  }[variant];
  return (
    <button type="button" disabled={disabled || loading} className={`${base} ${sz} ${v} ${className}`} {...rest}>
      {loading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
      {children}
    </button>
  );
};

export const Field: React.FC<{ label: string; error?: string; hint?: string; required?: boolean; className?: string; children: React.ReactNode }> = ({ label, error, hint, required, className = '', children }) => (
  <label className={`block ${className}`}>
    <span className="block text-xs text-slate-400 mb-1.5">{label}{required && <span className="text-rose-400 mr-0.5">*</span>}</span>
    {children}
    {hint && !error && <span className="block text-[11px] text-slate-500 mt-1">{hint}</span>}
    {error && <span className="block text-[11px] text-rose-400 mt-1">{error}</span>}
  </label>
);

export const Card: React.FC<{ className?: string; children: React.ReactNode; title?: React.ReactNode; action?: React.ReactNode }> = ({ className = '', children, title, action }) => (
  <section className={`bg-slate-900/70 border border-slate-800 rounded-2xl ${className}`}>
    {(title || action) && (
      <header className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-800">
        <h3 className="text-sm font-semibold text-slate-100">{title}</h3>
        {action}
      </header>
    )}
    <div className="p-4">{children}</div>
  </section>
);

export const PageHeader: React.FC<{ title: string; subtitle?: string; actions?: React.ReactNode; icon?: React.ReactNode }> = ({ title, subtitle, actions, icon }) => (
  <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
    <div className="flex items-center gap-3">
      {icon && <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center">{icon}</div>}
      <div>
        <h1 className="text-xl font-bold text-white">{title}</h1>
        {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
      </div>
    </div>
    {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
  </div>
);

export const StatCard: React.FC<{ label: string; value: React.ReactNode; hint?: string; icon?: React.ReactNode; tone?: 'amber' | 'emerald' | 'rose' | 'sky' | 'violet' | 'slate'; onClick?: () => void }> = ({ label, value, hint, icon, tone = 'slate', onClick }) => {
  const tones: Record<string, string> = {
    amber: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    rose: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
    sky: 'text-sky-400 bg-sky-500/10 border-sky-500/20',
    violet: 'text-violet-400 bg-violet-500/10 border-violet-500/20',
    slate: 'text-slate-300 bg-slate-800/60 border-slate-700',
  };
  return (
    <div onClick={onClick} className={`bg-slate-900/70 border border-slate-800 rounded-2xl p-4 flex items-center gap-3 ${onClick ? 'cursor-pointer hover:border-slate-600' : ''}`}>
      {icon && <div className={`w-11 h-11 rounded-xl border flex items-center justify-center shrink-0 ${tones[tone]}`}>{icon}</div>}
      <div className="min-w-0">
        <div className="text-[11px] text-slate-400 truncate">{label}</div>
        <div className="text-lg font-bold text-white truncate">{value}</div>
        {hint && <div className="text-[10px] text-slate-500 truncate">{hint}</div>}
      </div>
    </div>
  );
};

const BADGE: Record<string, string> = {
  green: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  red: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
  amber: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  sky: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
  violet: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
  slate: 'bg-slate-700/40 text-slate-300 border-slate-600/50',
};

const STATUS_TONE: Record<string, string> = {
  'رزرو شده': 'sky', 'انجام شد': 'green', 'لغو شده': 'red',
  'باز': 'amber', 'در انتظار': 'sky', 'بسته شده': 'slate',
  'عادی': 'slate', 'بالا': 'amber', 'فوری': 'red',
  'ارسال شد': 'green', 'در حال ارسال': 'sky', 'خطا': 'red',
  'دریافت شده': 'sky', 'در انتظار وصول': 'amber', 'وصول شده': 'green', 'برگشتی': 'red',
  paid: 'green', partially_paid: 'amber', unpaid: 'red', cancelled: 'slate',
  'تحویل شده': 'green', 'آماده تحویل': 'green', 'پروژه جدید': 'sky',
};
const STATUS_LABEL: Record<string, string> = { paid: 'پرداخت شده', partially_paid: 'پرداخت ناقص', unpaid: 'پرداخت نشده', cancelled: 'لغو شده' };

export const StatusBadge: React.FC<{ status: string; tone?: string }> = ({ status, tone }) => (
  <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[11px] font-medium border whitespace-nowrap ${BADGE[tone || STATUS_TONE[status] || 'slate']}`}>
    {STATUS_LABEL[status] || status}
  </span>
);

export const TagChip: React.FC<{ name: string; color?: string; onRemove?: () => void }> = ({ name, color = '#f59e0b' }) => (
  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] border" style={{ color, borderColor: color + '55', background: color + '18' }}>{name}</span>
);

export const EmptyState: React.FC<{ onAdd?: () => void; text?: string; addLabel?: string }> = ({ onAdd, text = 'اطلاعاتی برای نمایش وجود ندارد', addLabel = '+ افزودن مورد جدید' }) => (
  <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
    <div className="w-14 h-14 rounded-2xl bg-slate-800/70 flex items-center justify-center text-slate-500"><Search className="w-6 h-6" /></div>
    <p className="text-sm text-slate-400">{text}</p>
    {onAdd && <Btn variant="primary" onClick={onAdd}><Plus className="w-4 h-4" />{addLabel.replace(/^\+\s*/, '')}</Btn>}
  </div>
);

export const LoadingState: React.FC<{ text?: string }> = ({ text = 'در حال بارگذاری...' }) => (
  <div className="flex items-center justify-center gap-3 py-12 text-slate-400 text-sm" role="status">
    <div className="w-5 h-5 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />{text}
  </div>
);

export const ErrorState: React.FC<{ message?: string; onRetry?: () => void }> = ({ message = 'خطایی رخ داد', onRetry }) => (
  <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
    <div className="w-14 h-14 rounded-2xl bg-rose-500/10 flex items-center justify-center text-rose-400"><AlertTriangle className="w-6 h-6" /></div>
    <p className="text-sm text-slate-300">{message}</p>
    {onRetry && <Btn onClick={onRetry}><RefreshCw className="w-4 h-4" />تلاش مجدد</Btn>}
  </div>
);

export const Tabs: React.FC<{ tabs: { id: string; label: string; count?: number }[]; value: string; onChange: (id: string) => void }> = ({ tabs, value, onChange }) => (
  <div className="flex gap-1 overflow-x-auto border-b border-slate-800 mb-4 -mx-1 px-1">
    {tabs.map((t) => (
      <button key={t.id} onClick={() => onChange(t.id)} className={`px-4 py-2.5 text-sm whitespace-nowrap border-b-2 transition-colors ${value === t.id ? 'border-amber-400 text-amber-300 font-medium' : 'border-transparent text-slate-400 hover:text-slate-200'}`}>
        {t.label}{t.count !== undefined && <span className="mr-1.5 text-[11px] px-1.5 py-0.5 rounded-md bg-slate-800 text-slate-300">{toPersianDigits(t.count)}</span>}
      </button>
    ))}
  </div>
);

export const SearchBox: React.FC<{ value: string; onChange: (v: string) => void; placeholder?: string; className?: string }> = ({ value, onChange, placeholder = 'جستجو...', className = '' }) => (
  <div className={`relative ${className}`}>
    <Search className="w-4 h-4 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
    <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={`${inputCls} pr-9`} />
  </div>
);
