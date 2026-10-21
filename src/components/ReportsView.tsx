import React, { useState } from 'react';
import { BarChart3 } from './icons.tsx';
import { studio } from '../services/studioApi.ts';
import { useAsync } from '../hooks.ts';
import { Btn, Card, ErrorState, LoadingState, PageHeader, StatCard, Tabs, moneyT } from './ui/Common.tsx';
import { Chart, Donut } from './ui/Chart.tsx';
import { PersianDatePicker } from './ui/PersianDatePicker.tsx';
import { exportCsv } from './ui/csv.ts';
import { addDays, monthStart, weekStart, parseJ, fmtJ } from '../utils/jdate.ts';
import { getTodayJalali, toPersianDigits } from '../utils/jalali.ts';

const COLORS = ['#f59e0b', '#38bdf8', '#34d399', '#f472b6', '#a78bfa', '#fb923c', '#f87171', '#facc15'];

export const ReportsView: React.FC = () => {
  const today = getTodayJalali();
  const [from, setFrom] = useState(monthStart(today));
  const [to, setTo] = useState(today);
  const [tab, setTab] = useState('finance');
  const { data, loading, error, reload } = useAsync(() => studio.report(from, to), [from, to]);

  const preset = (k: string) => {
    const { y } = parseJ(today);
    if (k === 'today') { setFrom(today); setTo(today); }
    if (k === 'week') { setFrom(weekStart(today)); setTo(today); }
    if (k === 'month') { setFrom(monthStart(today)); setTo(today); }
    if (k === 'last30') { setFrom(addDays(today, -29)); setTo(today); }
    if (k === 'year') { setFrom(fmtJ(y, 1, 1)); setTo(today); }
  };

  return (
    <div>
      <PageHeader title="گزارش‌ها" subtitle="مالی، مشتری، پروژه، نوبت و سالن؛ بر اساس داده‌های واقعی در بازه انتخابی" icon={<BarChart3 className="w-5 h-5" />} />
      <Card className="mb-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-44"><div className="text-xs text-slate-400 mb-1.5">از تاریخ</div><PersianDatePicker value={from} onChange={(v) => v && setFrom(v)} /></div>
          <div className="w-44"><div className="text-xs text-slate-400 mb-1.5">تا تاریخ</div><PersianDatePicker value={to} onChange={(v) => v && setTo(v)} /></div>
          <div className="flex flex-wrap gap-1.5">
            {[['today', 'امروز'], ['week', 'این هفته'], ['month', 'این ماه'], ['last30', '۳۰ روز اخیر'], ['year', 'امسال']].map(([k, l]) => <Btn key={k} size="sm" onClick={() => preset(k)}>{l}</Btn>)}
          </div>
        </div>
      </Card>
      <Tabs value={tab} onChange={setTab} tabs={[{ id: 'finance', label: 'مالی' }, { id: 'customers', label: 'مشتریان' }, { id: 'projects', label: 'پروژه‌ها' }, { id: 'appointments', label: 'نوبت‌ها' }, { id: 'halls', label: 'سالن‌ها' }]} />
      {loading && !data ? <LoadingState text="در حال تهیه گزارش..." /> : error || !data ? <ErrorState message={error || 'خطایی رخ داد'} onRetry={reload} /> : (
        <>
          {tab === 'finance' && (() => {
            const f = data.finance;
            return (
              <div className="space-y-4">
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                  <StatCard label="درآمد (فاکتورها)" value={moneyT(f.income)} tone="sky" /><StatCard label="پرداخت" value={moneyT(f.paid)} tone="emerald" />
                  <StatCard label="هزینه" value={moneyT(f.expenses)} tone="amber" /><StatCard label="سود (پرداخت − هزینه)" value={moneyT(f.profit)} tone={f.profit >= 0 ? 'emerald' : 'rose'} />
                  <StatCard label="بدهی فعلی مشتریان" value={moneyT(f.debt)} tone="rose" />
                </div>
                <div className="grid lg:grid-cols-2 gap-4">
                  <Card title="پرداخت‌ها بر اساس روش" action={<Btn size="sm" onClick={() => exportCsv('payments-by-method', [{ header: 'روش', value: (r: any) => r.name }, { header: 'تعداد', value: (r: any) => r.count }, { header: 'مبلغ', value: (r: any) => r.total }], f.byMethod)}>خروجی اکسل</Btn>}>
                    <Donut items={f.byMethod.map((m: any, i: number) => ({ name: `${m.name} — ${moneyT(m.total)}`, value: m.count, color: COLORS[i % COLORS.length] }))} />
                  </Card>
                  <Card title="هزینه‌ها بر اساس دسته‌بندی" action={<Btn size="sm" onClick={() => exportCsv('expenses-by-category', [{ header: 'دسته', value: (r: any) => r.name }, { header: 'تعداد', value: (r: any) => r.count }, { header: 'مبلغ', value: (r: any) => r.total }], f.byCategory)}>خروجی اکسل</Btn>}>
                    {f.byCategory.length ? <Chart labels={f.byCategory.map((c: any) => c.name)} series={[{ name: 'هزینه', color: '#f59e0b', values: f.byCategory.map((c: any) => c.total) }]} /> : <p className="text-sm text-slate-500 text-center py-6">اطلاعاتی برای نمایش وجود ندارد</p>}
                  </Card>
                </div>
              </div>
            );
          })()}
          {tab === 'customers' && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatCard label="کل خانواده‌ها" value={toPersianDigits(data.customers.total)} tone="slate" /><StatCard label="مشتری جدید" value={toPersianDigits(data.customers.new)} tone="emerald" />
              <StatCard label="مشتری فعال" value={toPersianDigits(data.customers.active)} tone="sky" hint="نوبت، پروژه یا پرداخت در بازه" /><StatCard label="مشتری قدیمی (غیرفعال در بازه)" value={toPersianDigits(data.customers.inactive)} tone="amber" />
            </div>
          )}
          {tab === 'projects' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <StatCard label="پروژه جدید" value={toPersianDigits(data.projects.new)} tone="sky" /><StatCard label="در حال انجام" value={toPersianDigits(data.projects.inProgress)} tone="amber" />
                <StatCard label="تحویل‌شده" value={toPersianDigits(data.projects.delivered)} tone="emerald" /><StatCard label="لغوشده" value={toPersianDigits(data.projects.cancelled)} tone="rose" />
              </div>
              <Card title="پروژه‌ها بر اساس وضعیت"><Donut items={data.projects.byStatus.map((p: any, i: number) => ({ name: p.name, value: p.count, color: COLORS[i % COLORS.length] }))} /></Card>
            </div>
          )}
          {tab === 'appointments' && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatCard label="کل نوبت‌ها" value={toPersianDigits(data.appointments.total)} tone="slate" /><StatCard label="رزرو شده" value={toPersianDigits(data.appointments.reserved)} tone="sky" />
              <StatCard label="انجام‌شده" value={toPersianDigits(data.appointments.done)} tone="emerald" /><StatCard label="لغو" value={toPersianDigits(data.appointments.cancelled)} tone="rose" />
            </div>
          )}
          {tab === 'halls' && (
            <Card title="استفاده از سالن‌ها" action={<Btn size="sm" onClick={() => exportCsv('halls', [{ header: 'سالن', value: (r: any) => r.name }, { header: 'تعداد رزرو', value: (r: any) => r.bookings }, { header: 'ساعت استفاده', value: (r: any) => r.hours }], data.halls)}>خروجی اکسل</Btn>}>
              <div className="grid lg:grid-cols-2 gap-4">
                <Chart labels={data.halls.map((h: any) => h.name)} series={[{ name: 'تعداد رزرو', color: '#38bdf8', values: data.halls.map((h: any) => h.bookings) }, { name: 'ساعت استفاده', color: '#34d399', values: data.halls.map((h: any) => h.hours) }]} format={(v) => toPersianDigits(Math.round(v * 10) / 10)} />
                <table className="w-full text-sm text-right"><thead className="text-xs text-slate-400"><tr><th className="p-2">سالن</th><th className="p-2">رزرو</th><th className="p-2">ساعت</th></tr></thead>
                  <tbody className="divide-y divide-slate-800">{data.halls.map((h: any) => <tr key={h.id}><td className="p-2">{h.name}</td><td className="p-2">{toPersianDigits(h.bookings)}</td><td className="p-2">{toPersianDigits(h.hours)}</td></tr>)}</tbody></table>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
};
