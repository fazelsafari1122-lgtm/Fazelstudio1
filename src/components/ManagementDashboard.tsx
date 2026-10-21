import React, { useEffect, useState } from 'react';
import { BarChart3, DollarSign, Wallet, TrendingUp, FolderGit2, Users, CalendarIcon, Phone, Camera, CreditCard, AlertTriangle } from './icons.tsx';
import type { ActiveTab } from '../types.ts';
import { studio } from '../services/studioApi.ts';
import { useAsync } from '../hooks.ts';
import { Card, ErrorState, LoadingState, PageHeader, StatCard, Tabs, moneyT } from './ui/Common.tsx';
import { Chart, Donut } from './ui/Chart.tsx';
import { toPersianDigits } from '../utils/jalali.ts';

const RANGES = [{ id: 'day', label: 'روز' }, { id: 'week', label: 'هفته' }, { id: 'month', label: 'ماه' }, { id: 'year', label: 'سال' }];
const RANGE_NOTE: Record<string, string> = { day: '۱۴ روز گذشته', week: '۸ هفته گذشته', month: '۱۲ ماه گذشته', year: '۵ سال گذشته' };

export const ManagementDashboard: React.FC<{ onNavigate: (t: ActiveTab, id?: number | null) => void }> = ({ onNavigate }) => {
  const [range, setRange] = useState('month');
  const ov = useAsync(() => studio.overview(), []);
  const se = useAsync(() => studio.series(range), [range]);

  // every create/edit/delete elsewhere in the app triggers this event, so the numbers stay live
  useEffect(() => {
    const on = () => { ov.reload(); se.reload(); };
    window.addEventListener('studio-data-changed', on);
    return () => window.removeEventListener('studio-data-changed', on);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (ov.loading && !ov.data) return <LoadingState />;
  if (ov.error || !ov.data) return <ErrorState message={ov.error} onRetry={ov.reload} />;
  const d = ov.data;
  const s = se.data;
  const n = d.notifications || {};

  return (
    <div>
      <PageHeader title="داشبورد مدیریت" subtitle="تمام اعداد از داده‌های واقعی سیستم محاسبه می‌شوند" icon={<BarChart3 className="w-5 h-5" />} />
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
        <StatCard label="درآمد (جمع فاکتورها)" value={moneyT(d.revenue)} tone="sky" icon={<DollarSign className="w-5 h-5" />} onClick={() => onNavigate('invoices')} />
        <StatCard label="پرداخت‌شده" value={moneyT(d.paid)} tone="emerald" icon={<CreditCard className="w-5 h-5" />} onClick={() => onNavigate('payments')} />
        <StatCard label="بدهی مشتریان" value={moneyT(d.debt)} tone="rose" icon={<AlertTriangle className="w-5 h-5" />} onClick={() => onNavigate('customers')} />
        <StatCard label="هزینه‌ها" value={moneyT(d.expenses)} tone="amber" icon={<Wallet className="w-5 h-5" />} onClick={() => onNavigate('expenses')} />
        <StatCard label="سود / جریان نقدی" value={moneyT(d.cashflow)} tone={d.cashflow >= 0 ? 'emerald' : 'rose'} hint="پرداخت‌شده − هزینه‌ها" icon={<TrendingUp className="w-5 h-5" />} />
        <StatCard label="پروژه‌های فعال" value={toPersianDigits(d.activeProjects)} tone="violet" icon={<FolderGit2 className="w-5 h-5" />} onClick={() => onNavigate('projects')} />
        <StatCard label="در حال آماده‌سازی" value={toPersianDigits(d.preparingProjects)} tone="amber" icon={<Camera className="w-5 h-5" />} onClick={() => onNavigate('prep_photo')} />
        <StatCard label="مشتریان (خانواده)" value={toPersianDigits(d.customers)} tone="sky" icon={<Users className="w-5 h-5" />} onClick={() => onNavigate('customers')} />
        <StatCard label="نوبت‌های امروز" value={toPersianDigits(d.todayAppointments)} tone="emerald" icon={<CalendarIcon className="w-5 h-5" />} onClick={() => onNavigate('appointments')} />
        <StatCard label="پیگیری‌های باز" value={toPersianDigits(d.openFollowups)} tone={d.openFollowups ? 'rose' : 'slate'} icon={<Phone className="w-5 h-5" />} onClick={() => onNavigate('followups')} />
      </div>

      <Tabs value={range} onChange={setRange} tabs={RANGES} />
      {se.error ? <ErrorState message={se.error} onRetry={se.reload} /> : !s ? <LoadingState /> : (
        <div className="grid lg:grid-cols-2 gap-4 mb-4">
          <Card title={`نمودار درآمد و پرداختی‌ها — ${RANGE_NOTE[range]}`}><Chart labels={s.labels} series={[{ name: 'درآمد (فاکتور)', color: '#38bdf8', values: s.income }, { name: 'پرداختی‌ها', color: '#34d399', values: s.payments }]} /></Card>
          <Card title={`نمودار هزینه‌ها — ${RANGE_NOTE[range]}`}><Chart labels={s.labels} series={[{ name: 'هزینه‌ها', color: '#f59e0b', values: s.expenses }]} /></Card>
          <Card title={`پروژه‌های جدید — ${RANGE_NOTE[range]}`}><Chart kind="line" labels={s.labels} series={[{ name: 'تعداد پروژه', color: '#a78bfa', values: s.projects }]} height={200} format={(v) => toPersianDigits(Math.round(v))} /></Card>
          <Card title="وضعیت پروژه‌ها"><Donut items={d.projectsByStatus.filter((p: any) => p.count > 0).map((p: any) => ({ name: p.name, value: p.count, color: p.color }))} /></Card>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-4">
        <Card title="آخرین پرداخت‌ها">
          {d.recentPayments.length === 0 ? <p className="text-sm text-slate-500">اطلاعاتی برای نمایش وجود ندارد</p> : (
            <ul className="divide-y divide-slate-800">{d.recentPayments.map((p: any) => <li key={p.id} className="flex justify-between py-2 text-sm"><span>خانواده {p.last_name} <span className="text-[11px] text-slate-500">({p.payment_method})</span></span><span className="text-emerald-400">{moneyT(p.amount)}</span></li>)}</ul>
          )}
        </Card>
        <Card title="نوبت‌های پیش رو">
          {d.upcomingAppointments.length === 0 ? <p className="text-sm text-slate-500">اطلاعاتی برای نمایش وجود ندارد</p> : (
            <ul className="divide-y divide-slate-800">{d.upcomingAppointments.map((a: any) => <li key={a.id} className="flex justify-between py-2 text-sm"><span>خانواده {a.last_name}</span><span className="text-slate-400">{toPersianDigits(`${a.date} ${a.start_time}`)} — {a.hall_name}</span></li>)}</ul>
          )}
        </Card>
        <Card title="نیازمند توجه">
          <ul className="space-y-2 text-sm">
            {[['followup', 'پیگیری موعددار', 'followups'], ['debt', 'بدهی سررسیدشده', 'invoices'], ['cheque', 'چک نزدیک سررسید', 'cheques'], ['deadline', 'پروژه نزدیک Deadline', 'projects'], ['sms', 'پیامک خطادار', 'sms_queue'], ['appointment', 'نوبت امروز', 'appointments']].map(([k, label, tab]) => (
              <li key={k}><button onClick={() => onNavigate(tab as ActiveTab)} className="w-full flex justify-between hover:text-amber-300"><span>{label}</span><span className={n[k] ? 'text-rose-300 font-bold' : 'text-slate-500'}>{toPersianDigits(n[k] || 0)}</span></button></li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
};
