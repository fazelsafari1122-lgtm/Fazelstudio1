import React, { useState, useEffect } from 'react';
import {
  HeartHandshake, Plus, Calendar, Clock, MapPin, Users,
  Sparkles, Phone, Compass, UserCheck, X, Search
} from 'lucide-react';
import { api } from '../services/api.ts';
import type { Wedding, Customer } from '../types.ts';
import { formatJalaliHuman, toPersianDigits, getTodayJalali } from '../utils/jalali.ts';

export const WeddingsView: React.FC = () => {
  const [weddings, setWeddings] = useState<Wedding[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    customer_id: '',
    bride_first: '',
    bride_last: '',
    bride_phone: '',
    groom_first: '',
    groom_last: '',
    groom_phone: '',
    wedding_date: getTodayJalali(),
    start_time: '14:00',
    end_time: '23:30',
    team_arrival_time: '12:30',
    venue_name: '',
    venue_address: '',
    gps_location: '',
    bride_prep_location: '',
    groom_prep_location: '',
    has_formality: false,
    formality_location: '',
    formality_date: '',
    coordinator_name: '',
    guest_count: 300,
    notes: ''
  });

  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      const [wList, cList] = await Promise.all([api.getWeddings(), api.getCustomers()]);
      setWeddings(wList);
      setCustomers(cList);
      if (cList.length > 0 && !formData.customer_id) {
        setFormData((prev) => ({ ...prev, customer_id: String(cList[0].id) }));
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

  const handleCreateWedding = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!formData.customer_id || !formData.wedding_date || !formData.venue_name) {
      setFormError('انتخاب مشتری، تاریخ مراسم و نام باغ/تالار الزامی است.');
      return;
    }

    try {
      setSaving(true);
      await api.createWedding({
        ...formData,
        customer_id: Number(formData.customer_id),
        has_formality: formData.has_formality ? 1 : 0,
        guest_count: Number(formData.guest_count || 0)
      });
      setShowAddModal(false);
      loadData();
    } catch (err: any) {
      setFormError(err.message || 'خطا در ثبت اطلاعات مراسم');
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
            <HeartHandshake className="w-5 h-5 text-amber-400" />
            اطلاعات مراسمات، عروس و داماد
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            برنامه‌ریزی زمانی روز جشن، لوکیشن تالار، آماده‌سازی و تاریخ‌های فرمالیته
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-bold text-xs transition-all shadow-xs"
        >
          <Plus className="w-4 h-4" />
          <span>ثبت مراسم عروسی جدید</span>
        </button>
      </div>

      {/* Grid of Wedding Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {weddings.map((w) => (
          <div
            key={w.id}
            className="p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-amber-500/40 transition-all flex flex-col justify-between space-y-4 shadow-xs"
          >
            <div>
              {/* Couple Name & Date Badge */}
              <div className="flex items-start justify-between gap-2 pb-3 border-b border-slate-800">
                <div>
                  <h3 className="font-bold text-base text-white">
                    عروسی {w.bride_first || w.customer_first || 'عروس'} و {w.groom_first || 'داماد'}
                  </h3>
                  <span className="text-xs text-slate-400">
                    مشتری: {w.customer_first} {w.customer_last} ({toPersianDigits(w.customer_phone)})
                  </span>
                </div>
                <span className="px-2.5 py-1 rounded-lg bg-amber-500/15 text-amber-300 text-xs font-bold shrink-0">
                  {formatJalaliHuman(w.wedding_date)}
                </span>
              </div>

              {/* Timing & Venue */}
              <div className="space-y-2 text-xs text-slate-300 mt-3">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>
                    حضور تیم: <strong>{toPersianDigits(w.team_arrival_time || '۱۲:۳۰')}</strong> (شروع {toPersianDigits(w.start_time || '۱۴:۰۰')} تا {toPersianDigits(w.end_time || '۲۳:۳۰')})
                  </span>
                </div>

                <div className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-slate-100">{w.venue_name || 'نامشخص'}</strong>
                    <p className="text-slate-400 text-[11px] mt-0.5 leading-relaxed">{w.venue_address || 'نشانی ثبت نشده'}</p>
                  </div>
                </div>

                {w.bride_prep_location && (
                  <div className="flex items-center gap-2 text-slate-400 text-[11px]">
                    <Sparkles className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                    <span>آرایشگاه عروس: {w.bride_prep_location}</span>
                  </div>
                )}

                {w.groom_prep_location && (
                  <div className="flex items-center gap-2 text-slate-400 text-[11px]">
                    <Sparkles className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                    <span>گریم داماد: {w.groom_prep_location}</span>
                  </div>
                )}
              </div>

              {/* Formality Section */}
              {w.has_formality === 1 && (
                <div className="mt-3 p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-[11px] text-purple-200">
                  <strong>پروژه فرمالیته:</strong> {w.formality_location || 'لوکیشن تعیین نشده'} - تاریخ: {formatJalaliHuman(w.formality_date || '')}
                </div>
              )}
            </div>

            {/* Bottom Meta */}
            <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
              <span>تعداد مهمان: {toPersianDigits(w.guest_count || 0)} نفر</span>
              {w.coordinator_name && <span>هماهنگ‌کننده: {w.coordinator_name}</span>}
            </div>
          </div>
        ))}

        {weddings.length === 0 && (
          <div className="col-span-full p-12 bg-slate-900 border border-slate-800 rounded-2xl text-center text-slate-400 text-xs">
            هنوز مراسمی در سامانه ثبت نشده است. از دکمه بالا برای ثبت استفاده فرمایید.
          </div>
        )}
      </div>

      {/* Add Wedding Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[90vh] shadow-2xl overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <HeartHandshake className="w-4 h-4 text-amber-400" />
                ثبت مراسم و عروس و داماد جدید
              </h3>
              <button onClick={() => setShowAddModal(false)} className="p-1 text-slate-400 hover:text-white rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateWedding} className="p-6 space-y-4 text-xs overflow-y-auto flex-1">
              {formError && (
                <div className="p-3 bg-rose-500/15 border border-rose-500/30 rounded-xl text-rose-300">
                  {formError}
                </div>
              )}

              {/* Select Customer */}
              <div>
                <label className="block text-slate-300 mb-1">انتخاب پرونده مشتری در CRM *</label>
                <select
                  value={formData.customer_id}
                  onChange={(e) => setFormData({ ...formData, customer_id: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white focus:border-amber-500 focus:outline-none"
                >
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.first_name} {c.last_name} ({c.phone})
                    </option>
                  ))}
                </select>
              </div>

              {/* Bride & Groom names */}
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-950 rounded-xl border border-slate-800">
                <div>
                  <label className="block text-slate-300 mb-1">نام عروس</label>
                  <input
                    type="text"
                    value={formData.bride_first}
                    onChange={(e) => setFormData({ ...formData, bride_first: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white"
                    placeholder="مثال: سارا"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1">نام خانوادگی عروس</label>
                  <input
                    type="text"
                    value={formData.bride_last}
                    onChange={(e) => setFormData({ ...formData, bride_last: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1">نام داماد</label>
                  <input
                    type="text"
                    value={formData.groom_first}
                    onChange={(e) => setFormData({ ...formData, groom_first: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white"
                    placeholder="مثال: پوریا"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1">نام خانوادگی داماد</label>
                  <input
                    type="text"
                    value={formData.groom_last}
                    onChange={(e) => setFormData({ ...formData, groom_last: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white"
                  />
                </div>
              </div>

              {/* Dates and Timing */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1">تاریخ جشن (شمسی) *</label>
                  <input
                    type="text"
                    required
                    value={formData.wedding_date}
                    onChange={(e) => setFormData({ ...formData, wedding_date: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white"
                    placeholder="1405/07/15"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1">ورود تیم استودیو</label>
                  <input
                    type="text"
                    value={formData.team_arrival_time}
                    onChange={(e) => setFormData({ ...formData, team_arrival_time: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white"
                    placeholder="12:30"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1">ساعت شروع</label>
                  <input
                    type="text"
                    value={formData.start_time}
                    onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white"
                    placeholder="14:00"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1">ساعت اتمام</label>
                  <input
                    type="text"
                    value={formData.end_time}
                    onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white"
                    placeholder="23:30"
                  />
                </div>
              </div>

              {/* Venue */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1">نام باغ / تالار *</label>
                  <input
                    type="text"
                    required
                    value={formData.venue_name}
                    onChange={(e) => setFormData({ ...formData, venue_name: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white"
                    placeholder="باغ تالار دانیال"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1">تعداد تقریبی مهمان</label>
                  <input
                    type="number"
                    value={formData.guest_count}
                    onChange={(e) => setFormData({ ...formData, guest_count: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 mb-1">نشانی تالار / باغ</label>
                <input
                  type="text"
                  value={formData.venue_address}
                  onChange={(e) => setFormData({ ...formData, venue_address: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white"
                />
              </div>

              {/* Prep Locations */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1">آرایشگاه عروس</label>
                  <input
                    type="text"
                    value={formData.bride_prep_location}
                    onChange={(e) => setFormData({ ...formData, bride_prep_location: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white"
                    placeholder="سالن شایگان، زعفرانیه"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1">گریم داماد</label>
                  <input
                    type="text"
                    value={formData.groom_prep_location}
                    onChange={(e) => setFormData({ ...formData, groom_prep_location: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white"
                    placeholder="هتل اسپیناس"
                  />
                </div>
              </div>

              {/* Formality checkbox */}
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                <label className="flex items-center gap-2 text-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.has_formality}
                    onChange={(e) => setFormData({ ...formData, has_formality: e.target.checked })}
                    className="rounded text-amber-500 focus:ring-0"
                  />
                  <span>این قرارداد شامل عکاسی و تصویربرداری فرمالیته می‌باشد</span>
                </label>

                {formData.has_formality && (
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div>
                      <label className="block text-slate-400 mb-1">لوکیشن فرمالیته</label>
                      <input
                        type="text"
                        value={formData.formality_location}
                        onChange={(e) => setFormData({ ...formData, formality_location: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white"
                        placeholder="جزیره قشم، چابهار، شمال..."
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1">تاریخ فرمالیته (شمسی)</label>
                      <input
                        type="text"
                        value={formData.formality_date}
                        onChange={(e) => setFormData({ ...formData, formality_date: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white"
                        placeholder="1405/06/20"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold"
                >
                  {saving ? 'در حال ثبت...' : 'ثبت اطلاعات مراسم'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
