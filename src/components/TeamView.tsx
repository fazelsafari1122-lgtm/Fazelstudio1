import React, { useState, useEffect } from 'react';
import {
  Users, Plus, CreditCard, CheckCircle, Clock,
  DollarSign, Phone, Edit3, X, UserCheck
} from 'lucide-react';
import { api } from '../services/api.ts';
import type { TeamMember, TeamPayment } from '../types.ts';
import { formatCurrency, toPersianDigits, formatJalaliHuman, getTodayJalali } from '../utils/jalali.ts';

export const TeamView: React.FC = () => {
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [teamPayments, setTeamPayments] = useState<TeamPayment[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'members' | 'payments'>('members');

  // Add Member Modal
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [memberForm, setMemberForm] = useState({
    full_name: '',
    phone: '',
    role: 'فیلمبردار',
    specialty: 'مدیر تصویربرداری و کرین',
    bank_account_card: '',
    notes: ''
  });

  // Pay Team Modal
  const [showPayModal, setShowPayModal] = useState(false);
  const [payForm, setPayForm] = useState({
    team_member_id: '',
    agreed_amount: 0,
    paid_amount: 0,
    payment_date: getTodayJalali(),
    tracking_code: '',
    notes: ''
  });

  const [saving, setSaving] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [mList, pList] = await Promise.all([
        api.getTeam(),
        api.getTeamPayments()
      ]);
      setTeamMembers(mList);
      setTeamPayments(pList);
      if (mList.length > 0 && !payForm.team_member_id) {
        setPayForm(prev => ({ ...prev, team_member_id: String(mList[0].id) }));
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

  const handleCreateMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberForm.full_name || !memberForm.phone) return;
    try {
      setSaving(true);
      await api.createTeamMember(memberForm);
      setShowMemberModal(false);
      setMemberForm({
        full_name: '',
        phone: '',
        role: 'فیلمبردار',
        specialty: '',
        bank_account_card: '',
        notes: ''
      });
      loadData();
    } catch (err: any) {
      alert(err.message || 'خطا در ثبت عضو تیم');
    } finally {
      setSaving(false);
    }
  };

  const handleCreatePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payForm.team_member_id || !payForm.paid_amount) return;
    try {
      setSaving(true);
      await api.createTeamPayment({
        ...payForm,
        team_member_id: Number(payForm.team_member_id),
        agreed_amount: Number(payForm.agreed_amount || payForm.paid_amount),
        paid_amount: Number(payForm.paid_amount)
      });
      setShowPayModal(false);
      setPayForm(prev => ({ ...prev, paid_amount: 0, tracking_code: '', notes: '' }));
      loadData();
    } catch (err: any) {
      alert(err.message || 'خطا در ثبت دستمزد');
    } finally {
      setSaving(false);
    }
  };

  const totalTeamDebt = teamPayments.reduce((acc, tp) => acc + (tp.remaining_amount || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-amber-400" />
            پرسنل، عوامل سینمایی و حساب تیم
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            تسویه دستمزد فیلمبرداران، عکاسان، تدوینگران، اپراتورهای هلی‌شات و کرین
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowPayModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-medium text-xs border border-slate-700 transition-colors"
          >
            <CreditCard className="w-4 h-4 text-emerald-400" />
            <span>تسویه دستمزد پرسنل</span>
          </button>
          <button
            onClick={() => setShowMemberModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-bold text-xs transition-all shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>عضو جدید تیم</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2 text-xs">
        <button
          onClick={() => setActiveTab('members')}
          className={`px-4 py-2 rounded-xl font-bold transition-all ${
            activeTab === 'members'
              ? 'bg-amber-500 text-slate-950'
              : 'text-slate-400 hover:text-white bg-slate-900 border border-slate-800'
          }`}
        >
          لیست عوامل و اعضای تیم ({toPersianDigits(teamMembers.length)})
        </button>
        <button
          onClick={() => setActiveTab('payments')}
          className={`px-4 py-2 rounded-xl font-bold transition-all ${
            activeTab === 'payments'
              ? 'bg-amber-500 text-slate-950'
              : 'text-slate-400 hover:text-white bg-slate-900 border border-slate-800'
          }`}
        >
          سوابق تسویه حساب و پرداختی‌ها ({toPersianDigits(teamPayments.length)})
        </button>
      </div>

      {/* Tab 1: Members */}
      {activeTab === 'members' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {teamMembers.map((m) => (
            <div
              key={m.id}
              className="p-4 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between space-y-3"
            >
              <div>
                <div className="flex items-start justify-between pb-2 border-b border-slate-800">
                  <div>
                    <h3 className="font-bold text-sm text-white">{m.full_name}</h3>
                    <span className="text-xs text-amber-400 font-medium">{m.role}</span>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/15 text-emerald-400 font-bold">
                    فعال
                  </span>
                </div>

                <div className="space-y-1.5 text-xs text-slate-300 mt-3">
                  <div className="flex items-center gap-1.5 text-slate-400">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    <span>{toPersianDigits(m.phone)}</span>
                  </div>

                  {m.specialty && (
                    <div className="text-slate-400 text-[11px]">
                      تخصص: {m.specialty}
                    </div>
                  )}

                  {m.bank_account_card && (
                    <div className="p-2 bg-slate-950 rounded-lg text-[11px] font-mono text-slate-300 text-left" dir="ltr">
                      {m.bank_account_card}
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-between items-center text-xs">
                <span className="text-slate-400">تعداد پروژه‌ها: {toPersianDigits(m.project_count || 0)}</span>
                <button
                  onClick={() => {
                    setPayForm(prev => ({ ...prev, team_member_id: String(m.id) }));
                    setShowPayModal(true);
                  }}
                  className="text-amber-400 hover:underline font-bold"
                >
                  تسویه حساب &larr;
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab 2: Payments History */}
      {activeTab === 'payments' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="p-3.5">نام همکار</th>
                  <th className="p-3.5">سمت / تخصص</th>
                  <th className="p-3.5 text-left">مبلغ توافق‌شده</th>
                  <th className="p-3.5 text-left">پرداخت‌شده</th>
                  <th className="p-3.5 text-left">مانده طلب</th>
                  <th className="p-3.5 text-center">وضعیت تسویه</th>
                  <th className="p-3.5">تاریخ واریز</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-200">
                {teamPayments.map((tp) => (
                  <tr key={tp.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="p-3.5 font-bold text-white">{tp.member_name}</td>
                    <td className="p-3.5 text-slate-300">{tp.role}</td>
                    <td className="p-3.5 text-left font-bold text-white">{formatCurrency(tp.agreed_amount)}</td>
                    <td className="p-3.5 text-left font-bold text-emerald-400">{formatCurrency(tp.paid_amount)}</td>
                    <td className="p-3.5 text-left font-bold text-amber-400">{formatCurrency(tp.remaining_amount)}</td>
                    <td className="p-3.5 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        tp.status === 'تسویه شده'
                          ? 'bg-emerald-500/15 text-emerald-400'
                          : 'bg-amber-500/15 text-amber-300'
                      }`}>
                        {tp.status}
                      </span>
                    </td>
                    <td className="p-3.5 text-slate-400">{formatJalaliHuman(tp.payment_date || '')}</td>
                  </tr>
                ))}

                {teamPayments.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-500">
                      پرداختی ثبت نشده است.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Team Member Modal */}
      {showMemberModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-amber-400" />
                افزودن عضو جدید به تیم استودیو
              </h3>
              <button onClick={() => setShowMemberModal(false)} className="p-1 text-slate-400 hover:text-white rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateMember} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 mb-1">نام و نام خانوادگی *</label>
                <input
                  type="text"
                  required
                  value={memberForm.full_name}
                  onChange={(e) => setMemberForm({ ...memberForm, full_name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white"
                  placeholder="مهیار رضایی"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1">نقش / ردیف شغلی *</label>
                  <select
                    value={memberForm.role}
                    onChange={(e) => setMemberForm({ ...memberForm, role: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white"
                  >
                    <option value="فیلمبردار">فیلمبردار اصلی</option>
                    <option value="عکاس">عکاس رئال و آتلیه</option>
                    <option value="تدوینگر">تدوینگر کلیپ و تیزر</option>
                    <option value="دستیار">دستیار فنی / نور</option>
                    <option value="خلبان هلی‌شات">خلبان هلی‌شات / FPV</option>
                    <option value="اپراتور کرین">اپراتور کرین</option>
                    <option value="مدیر هماهنگی">مدیر پروژه و تشریفات</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-300 mb-1">شماره تماس *</label>
                  <input
                    type="text"
                    required
                    dir="ltr"
                    value={memberForm.phone}
                    onChange={(e) => setMemberForm({ ...memberForm, phone: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white text-left"
                    placeholder="09121112233"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 mb-1">شماره کارت یا شبای بانکی</label>
                <input
                  type="text"
                  dir="ltr"
                  value={memberForm.bank_account_card}
                  onChange={(e) => setMemberForm({ ...memberForm, bank_account_card: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white font-mono text-left"
                  placeholder="6037-9918-..."
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1">تخصص و سوابق کاری</label>
                <input
                  type="text"
                  value={memberForm.specialty}
                  onChange={(e) => setMemberForm({ ...memberForm, specialty: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white"
                  placeholder="متخصص تصویربرداری اسلوموشن و فرمالیته کویر"
                />
              </div>

              <div className="pt-4 border-t border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowMemberModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold"
                >
                  {saving ? 'در حال ثبت...' : 'ثبت عضو تیم'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Pay Team Modal */}
      {showPayModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-emerald-400" />
                ثبت تسویه دستمزد پرسنل
              </h3>
              <button onClick={() => setShowPayModal(false)} className="p-1 text-slate-400 hover:text-white rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreatePayment} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 mb-1">انتخاب عضو تیم *</label>
                <select
                  value={payForm.team_member_id}
                  onChange={(e) => setPayForm({ ...payForm, team_member_id: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white focus:border-amber-500"
                >
                  {teamMembers.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.full_name} ({m.role})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1">مبلغ توافق‌شده (تومان)</label>
                  <input
                    type="number"
                    value={payForm.agreed_amount}
                    onChange={(e) => setPayForm({ ...payForm, agreed_amount: Number(e.target.value) || 0 })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1">مبلغ واریزی (تومان) *</label>
                  <input
                    type="number"
                    required
                    value={payForm.paid_amount}
                    onChange={(e) => setPayForm({ ...payForm, paid_amount: Number(e.target.value) || 0 })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-emerald-400 font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1">تاریخ پرداخت (شمسی) *</label>
                  <input
                    type="text"
                    required
                    value={payForm.payment_date}
                    onChange={(e) => setPayForm({ ...payForm, payment_date: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1">کد پیگیری بانکی</label>
                  <input
                    type="text"
                    value={payForm.tracking_code}
                    onChange={(e) => setPayForm({ ...payForm, tracking_code: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 mb-1">بابت پروژه / یادداشت</label>
                <input
                  type="text"
                  value={payForm.notes}
                  onChange={(e) => setPayForm({ ...payForm, notes: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white"
                  placeholder="تسویه فیلمبرداری مراسم عروسی افشار"
                />
              </div>

              <div className="pt-4 border-t border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowPayModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold"
                >
                  {saving ? 'در حال ثبت...' : 'ثبت سند پرداخت'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
