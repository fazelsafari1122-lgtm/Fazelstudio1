import React, { useState, useEffect } from 'react';
import {
  Clock, Plus, Search, AlertTriangle, ShieldCheck,
  Camera, CheckCircle, X, Calendar, DollarSign
} from 'lucide-react';
import { api } from '../services/api.ts';
import type { EquipmentReservation, Equipment } from '../types.ts';
import { formatCurrency, toPersianDigits, formatJalaliHuman, getTodayJalali } from '../utils/jalali.ts';

export const ReservationsView: React.FC = () => {
  const [reservations, setReservations] = useState<EquipmentReservation[]>([]);
  const [equipmentList, setEquipmentList] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(false);

  // New Reservation Modal
  const [showModal, setShowModal] = useState(false);
  const [selectedEqId, setSelectedEqId] = useState<number | ''>('');
  const [startDate, setStartDate] = useState(getTodayJalali());
  const [endDate, setEndDate] = useState(getTodayJalali());
  const [quantity, setQuantity] = useState(1);
  const [dailyPrice, setDailyPrice] = useState(0);

  // Conflict state
  const [conflictError, setConflictError] = useState<string | null>(null);
  const [showOverride, setShowOverride] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');
  const [saving, setSaving] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [resList, eqData] = await Promise.all([
        api.getEquipmentReservations(),
        api.getEquipment()
      ]);
      setReservations(resList);
      setEquipmentList(eqData.equipment);
      if (eqData.equipment.length > 0 && !selectedEqId) {
        setSelectedEqId(eqData.equipment[0].id);
        setDailyPrice(eqData.equipment[0].daily_rental_price);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleEquipmentChange = (eqId: number) => {
    setSelectedEqId(eqId);
    const found = equipmentList.find(e => e.id === eqId);
    if (found) {
      setDailyPrice(found.daily_rental_price);
    }
  };

  const handleCreateReservation = async (allowOverride = false) => {
    if (!selectedEqId) return;
    setConflictError(null);

    try {
      setSaving(true);
      await api.createEquipmentReservation({
        equipment_id: Number(selectedEqId),
        start_date: startDate,
        end_date: endDate,
        quantity: Number(quantity),
        daily_price: Number(dailyPrice),
        allow_override: allowOverride,
        override_reason: overrideReason
      });

      setShowModal(false);
      setShowOverride(false);
      setOverrideReason('');
      loadData();
    } catch (err: any) {
      if (err.conflict) {
        setConflictError(err.message || 'این تجهیز در تاریخ انتخاب‌شده قبلاً رزرو شده است.');
        setShowOverride(true);
      } else {
        alert(err.message || 'خطا در ثبت رزرو');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-400" />
            رزرو هوشمند تجهیزات و پیشگیری از تداخل (Conflict Check)
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            بررسی همزمانی رزرو دوربین‌ها، لنزها و تجهیزات سینمایی با قابلیت صدور مجوز مدیر سیستم
          </p>
        </div>
        <button
          onClick={() => {
            setConflictError(null);
            setShowOverride(false);
            setShowModal(true);
          }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-bold text-xs transition-all shadow-xs"
        >
          <Plus className="w-4 h-4" />
          <span>ثبت رزرو جدید تجهیزات</span>
        </button>
      </div>

      {/* Reservations Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
              <tr>
                <th className="p-3.5">نام تجهیز و کد</th>
                <th className="p-3.5 text-center">تعداد</th>
                <th className="p-3.5">بازه تاریخ رزرو</th>
                <th className="p-3.5 text-center">مدت</th>
                <th className="p-3.5 text-left">مبلغ کل اجاره</th>
                <th className="p-3.5">طرف قرارداد / پروژه</th>
                <th className="p-3.5 text-center">وضعیت</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-200">
              {reservations.map((r) => (
                <tr key={r.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="p-3.5">
                    <strong className="text-white block">{r.equipment_name}</strong>
                    <span className="text-slate-400 text-[11px] font-mono">{r.equipment_code}</span>
                  </td>
                  <td className="p-3.5 text-center font-bold text-amber-400">{toPersianDigits(r.quantity)} عدد</td>
                  <td className="p-3.5 text-slate-300">
                    از {formatJalaliHuman(r.start_date)} تا {formatJalaliHuman(r.end_date)}
                  </td>
                  <td className="p-3.5 text-center">{toPersianDigits(r.days)} روز</td>
                  <td className="p-3.5 text-left font-bold text-white">{formatCurrency(r.total_amount)}</td>
                  <td className="p-3.5 text-slate-300">
                    {r.contract_number ? (
                      <div>
                        <span className="text-amber-400 font-bold">{r.contract_number}</span>
                        <span className="block text-[11px] text-slate-400">{r.customer_first} {r.customer_last}</span>
                      </div>
                    ) : (
                      <span className="text-slate-500">رزرو مستقیم آتلیه</span>
                    )}
                  </td>
                  <td className="p-3.5 text-center">
                    <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                      تأیید شده
                    </span>
                    {r.override_reason && (
                      <span className="block text-[9px] text-amber-400 mt-1 font-normal">
                        تأیید دستی مدیر
                      </span>
                    )}
                  </td>
                </tr>
              ))}

              {reservations.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500">
                    رزروی در سامانه ثبت نشده است.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Reservation Modal with Conflict Check */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-400" />
                ثبت رزرو جدید و اعتبارسنجی تداخل
              </h3>
              <button onClick={() => setShowModal(false)} className="p-1 text-slate-400 hover:text-white rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              {/* Conflict Alert Box if overlap */}
              {conflictError && (
                <div className="p-4 bg-rose-500/15 border border-rose-500/40 rounded-xl space-y-3">
                  <div className="flex items-start gap-2.5 text-rose-300 font-bold">
                    <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                    <span>{conflictError}</span>
                  </div>

                  {showOverride && (
                    <div className="p-3 bg-slate-950 rounded-lg border border-rose-500/20 space-y-2">
                      <div className="flex items-center gap-2 text-amber-300 font-semibold text-[11px]">
                        <ShieldCheck className="w-4 h-4" />
                        <span>صدور مجوز استثنایی مدیر (Override Conflict)</span>
                      </div>
                      <input
                        type="text"
                        value={overrideReason}
                        onChange={(e) => setOverrideReason(e.target.value)}
                        placeholder="دلیل تأیید استثنایی (مثال: تأمین دوربین یدک از شرکت همکار)"
                        className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white"
                      />
                      <button
                        type="button"
                        onClick={() => handleCreateReservation(true)}
                        className="w-full py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg transition-colors"
                      >
                        ثبت با وجود تداخل (ثبت در لاگ بازرسی)
                      </button>
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-slate-300 mb-1">انتخاب تجهیز مورد نظر *</label>
                <select
                  value={selectedEqId}
                  onChange={(e) => handleEquipmentChange(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white focus:border-amber-500"
                >
                  {equipmentList.map((eq) => (
                    <option key={eq.id} value={eq.id}>
                      {eq.name} ({eq.code}) - موجودی کل: {toPersianDigits(eq.quantity)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1">تاریخ شروع (شمسی) *</label>
                  <input
                    type="text"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1">تاریخ پایان (شمسی) *</label>
                  <input
                    type="text"
                    required
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1">تعداد درخواستی</label>
                  <input
                    type="number"
                    min={1}
                    value={quantity}
                    onChange={(e) => setQuantity(Number(e.target.value) || 1)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white font-bold"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1">تعرفه روزانه (تومان)</label>
                  <input
                    type="number"
                    value={dailyPrice}
                    onChange={(e) => setDailyPrice(Number(e.target.value) || 0)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-amber-400 font-bold"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700"
                >
                  انصراف
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => handleCreateReservation(false)}
                  className="px-5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold"
                >
                  {saving ? 'در حال بررسی...' : 'بررسی و ثبت رزرو'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
