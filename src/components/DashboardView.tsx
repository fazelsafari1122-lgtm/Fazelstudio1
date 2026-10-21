import React, { useEffect, useState } from 'react';
import {
  Users, FileText, AlertTriangle, TrendingUp, TrendingDown,
  DollarSign, Clock, Calendar, CheckCircle2, AlertCircle,
  Camera, Cake, ArrowUpRight, ArrowDownRight, Sparkles, RefreshCw
} from 'lucide-react';
import { api } from '../services/api.ts';
import { formatCurrency, toPersianDigits, formatJalaliHuman } from '../utils/jalali.ts';

interface DashboardViewProps {
  onNavigate: (tab: any) => void;
  onSelectCustomer?: (id: number) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ onNavigate }) => {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const loadStats = async () => {
    try {
      setLoading(true);
      const data = await api.getDashboardStats();
      setStats(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 text-amber-400 animate-spin" />
          <span className="text-sm text-slate-400">در حال بارگذاری داده‌های زنده دیتابیس...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Banner / Welcome & Quick Refresh */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-l from-slate-900 via-[#131722] to-slate-900 border border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-black tracking-tight text-white">داشبورد جامع استودیو WED</h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              دیتابیس متصل
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            وضعیت زنده درآمد، قراردادها، مراسمات، بدهی‌ها و تجهیزات استودیو
          </p>
        </div>
        <button
          onClick={loadStats}
          className="self-start sm:self-auto flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 border border-slate-700 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
          <span>بروزرسانی آمار</span>
        </button>
      </div>

      {/* System Alerts */}
      {stats?.alerts && stats.alerts.length > 0 && (
        <div className="space-y-2">
          {stats.alerts.map((al: any, idx: number) => (
            <div
              key={idx}
              className="flex items-start gap-3 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs"
            >
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <strong className="font-bold text-amber-300 block mb-0.5">{al.title}</strong>
                <span>{al.message}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Metric Cards Row 1: Core Figures */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Customers */}
        <div
          onClick={() => onNavigate('customers')}
          className="cursor-pointer p-4 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-amber-500/40 transition-all group"
        >
          <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
            <span>تعداد کل مشتریان</span>
            <div className="w-8 h-8 rounded-lg bg-blue-500/15 text-blue-400 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-white">{toPersianDigits(stats?.totalCustomers || 0)}</div>
          <div className="flex items-center justify-between mt-2 text-[11px] text-slate-400 border-t border-slate-800/80 pt-2">
            <span>ثبت شده در سامانه CRM</span>
            <span className="text-blue-400 group-hover:underline">مشاهده همه &larr;</span>
          </div>
        </div>

        {/* Total Contracts */}
        <div
          onClick={() => onNavigate('contracts')}
          className="cursor-pointer p-4 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-amber-500/40 transition-all group"
        >
          <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
            <span>قراردادهای رسمی</span>
            <div className="w-8 h-8 rounded-lg bg-amber-500/15 text-amber-400 flex items-center justify-center group-hover:scale-105 transition-transform">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-white">{toPersianDigits(stats?.totalContracts || 0)}</div>
          <div className="flex items-center justify-between mt-2 text-[11px] text-slate-400 border-t border-slate-800/80 pt-2">
            <span className="text-rose-400 font-medium">{toPersianDigits(stats?.unpaidContracts || 0)} تسویه‌نشده</span>
            <span className="text-amber-400 group-hover:underline">مدیریت &larr;</span>
          </div>
        </div>

        {/* Income / Revenue */}
        <div
          onClick={() => onNavigate('payments')}
          className="cursor-pointer p-4 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-emerald-500/40 transition-all group"
        >
          <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
            <span>کل دریافتی استودیو</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/15 text-emerald-400 flex items-center justify-center group-hover:scale-105 transition-transform">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-black text-emerald-400">{formatCurrency(stats?.totalIncome || 0)}</div>
          <div className="flex items-center justify-between mt-2 text-[11px] text-slate-400 border-t border-slate-800/80 pt-2">
            <span>جریان نقدینگی ورودی</span>
            <span className="text-emerald-400 group-hover:underline">پرداخت‌ها &larr;</span>
          </div>
        </div>

        {/* Total Expenses */}
        <div
          onClick={() => onNavigate('expenses')}
          className="cursor-pointer p-4 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-rose-500/40 transition-all group"
        >
          <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
            <span>کل هزینه‌های استودیو</span>
            <div className="w-8 h-8 rounded-lg bg-rose-500/15 text-rose-400 flex items-center justify-center group-hover:scale-105 transition-transform">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-black text-rose-400">{formatCurrency(stats?.totalExpenses || 0)}</div>
          <div className="flex items-center justify-between mt-2 text-[11px] text-slate-400 border-t border-slate-800/80 pt-2">
            <span>ثابت ماهیانه: {formatCurrency(stats?.fixedCost || 0)}</span>
            <span className="text-rose-400 group-hover:underline">هزینه‌ها &larr;</span>
          </div>
        </div>
      </div>

      {/* Financial Health Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Net Cashflow */}
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 block mb-1">جریان نقدی خالص (سود ناخالص)</span>
            <span className={`text-lg font-black ${stats?.netCashFlow >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {formatCurrency(stats?.netCashFlow || 0)}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>

        {/* Customer Debt */}
        <div
          onClick={() => onNavigate('invoices')}
          className="cursor-pointer p-4 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-amber-500/30 flex items-center justify-between"
        >
          <div>
            <span className="text-xs text-slate-400 block mb-1">مجموع مانده بدهی مشتریان</span>
            <span className="text-lg font-black text-amber-400">
              {formatCurrency(stats?.customerDebt || 0)}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400">
            <AlertCircle className="w-5 h-5" />
          </div>
        </div>

        {/* Team Debt */}
        <div
          onClick={() => onNavigate('team_finance')}
          className="cursor-pointer p-4 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-blue-500/30 flex items-center justify-between"
        >
          <div>
            <span className="text-xs text-slate-400 block mb-1">مانده بدهی به تیم و پرسنل</span>
            <span className="text-lg font-black text-blue-400">
              {formatCurrency(stats?.teamDebt || 0)}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400">
            <Clock className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Two Column Layout: Upcoming Weddings & Equipment / Projects Status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Upcoming Weddings Timeline */}
        <div className="lg:col-span-2 p-5 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-amber-400" />
                <h2 className="text-sm font-bold text-white">مراسمات و جشن‌های عروسی پیش‌رو</h2>
              </div>
              <button
                onClick={() => onNavigate('weddings')}
                className="text-xs text-amber-400 hover:underline"
              >
                مشاهده همه مراسمات &larr;
              </button>
            </div>

            {stats?.upcomingWeddings && stats.upcomingWeddings.length > 0 ? (
              <div className="space-y-3">
                {stats.upcomingWeddings.map((w: any) => (
                  <div
                    key={w.id}
                    className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 hover:border-slate-700 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-100 text-sm">
                          عروسی {w.bride_first || w.first_name} {w.bride_last || ''} و {w.groom_first || ''} {w.groom_last || ''}
                        </span>
                        {w.has_formality === 1 && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-purple-500/20 text-purple-300 border border-purple-500/30">
                            فرمالیته دار
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-400 mt-1 flex flex-wrap gap-x-4 gap-y-1">
                        <span>تالار: {w.venue_name || 'نامشخص'}</span>
                        <span>ساعت ورود تیم: {toPersianDigits(w.team_arrival_time || '۱۲:۳۰')}</span>
                        <span>مهمانان: {toPersianDigits(w.guest_count || 0)} نفر</span>
                      </div>
                    </div>

                    <div className="text-right sm:text-left shrink-0">
                      <span className="inline-block px-3 py-1 rounded-lg bg-amber-500/15 text-amber-300 border border-amber-500/30 text-xs font-bold">
                        {formatJalaliHuman(w.wedding_date)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-10 text-xs text-slate-500">
                مراسم ثبت‌شده‌ای یافت نشد.
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800 flex justify-end">
            <button
              onClick={() => onNavigate('weddings')}
              className="text-xs font-medium text-amber-400 hover:text-amber-300"
            >
              + ثبت اطلاعات مراسم عروسی جدید
            </button>
          </div>
        </div>

        {/* Right 1 Col: Operational Status */}
        <div className="space-y-4">
          {/* Projects Status */}
          <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-400" />
                وضعیت پروژه‌ها
              </span>
              <button onClick={() => onNavigate('projects')} className="text-xs text-slate-400 hover:text-white">
                مدیریت &larr;
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                <span className="text-xs text-slate-400 block mb-1">پروژه‌های فعال</span>
                <span className="text-xl font-bold text-amber-400">{toPersianDigits(stats?.activeProjects || 0)}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                <span className="text-xs text-slate-400 block mb-1">رزروهای آینده</span>
                <span className="text-xl font-bold text-blue-400">{toPersianDigits(stats?.upcomingProjects || 0)}</span>
              </div>
            </div>
          </div>

          {/* Equipment Status */}
          <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <Camera className="w-4 h-4 text-amber-400" />
                وضعیت انبار تجهیزات
              </span>
              <button onClick={() => onNavigate('equipment')} className="text-xs text-slate-400 hover:text-white">
                تجهیزات &larr;
              </button>
            </div>
            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between items-center text-slate-300">
                <span>کل آیتم‌های موجود در استودیو:</span>
                <span className="font-bold text-white">{toPersianDigits(stats?.totalEquipment || 0)} عدد</span>
              </div>
              <div className="flex justify-between items-center text-slate-300">
                <span>تجهیزات در پروژه‌ها / رزرو:</span>
                <span className="font-bold text-amber-400">{toPersianDigits(stats?.rentedEquipment || 0)} عدد</span>
              </div>
              <div className="flex justify-between items-center text-slate-300">
                <span>آماده به‌کار در انبار:</span>
                <span className="font-bold text-emerald-400">{toPersianDigits(stats?.availableEquipment || 0)} عدد</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
