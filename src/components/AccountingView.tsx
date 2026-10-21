import React, { useState, useEffect } from 'react';
import {
  Scale, Plus, Wallet, TrendingDown, TrendingUp,
  DollarSign, CheckCircle, Clock, X, Calendar
} from 'lucide-react';
import { api } from '../services/api.ts';
import type { Expense, RecurringExpense } from '../types.ts';
import { formatCurrency, toPersianDigits, formatJalaliHuman, getTodayJalali } from '../utils/jalali.ts';

export const AccountingView: React.FC = () => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [recurring, setRecurring] = useState<RecurringExpense[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'expenses' | 'recurring'>('expenses');

  // Add Expense Modal
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [expenseForm, setExpenseForm] = useState({
    title: '',
    category: 'اجاره و شارژ',
    amount: 0,
    expense_date: getTodayJalali(),
    payment_method: 'انتقال بانکی',
    receiver: '',
    description: ''
  });

  // Add Recurring Modal
  const [showRecurringModal, setShowRecurringModal] = useState(false);
  const [recurringForm, setRecurringForm] = useState({
    title: '',
    category: 'حقوق و دستمزد',
    amount: 0,
    frequency: 'monthly' as const,
    due_day: 1
  });

  const [saving, setSaving] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await api.getExpenses();
      setExpenses(data.expenses);
      setRecurring(data.recurring);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseForm.title || !expenseForm.amount) return;
    try {
      setSaving(true);
      await api.createExpense({
        ...expenseForm,
        amount: Number(expenseForm.amount)
      });
      setShowExpenseModal(false);
      setExpenseForm({
        title: '',
        category: 'اجاره و شارژ',
        amount: 0,
        expense_date: getTodayJalali(),
        payment_method: 'انتقال بانکی',
        receiver: '',
        description: ''
      });
      loadData();
    } catch (err: any) {
      alert(err.message || 'خطا در ثبت هزینه');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateRecurring = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recurringForm.title || !recurringForm.amount) return;
    try {
      setSaving(true);
      await api.createRecurringExpense({
        ...recurringForm,
        amount: Number(recurringForm.amount),
        due_day: Number(recurringForm.due_day)
      });
      setShowRecurringModal(false);
      setRecurringForm({
        title: '',
        category: 'حقوق و دستمزد',
        amount: 0,
        frequency: 'monthly',
        due_day: 1
      });
      loadData();
    } catch (err: any) {
      alert(err.message || 'خطا در ثبت هزینه ثابت');
    } finally {
      setSaving(false);
    }
  };

  const totalExpenses = expenses.reduce((acc, e) => acc + (e.amount || 0), 0);
  const totalMonthlyRecurring = recurring.filter(r => r.is_active === 1).reduce((acc, r) => acc + (r.amount || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Scale className="w-5 h-5 text-amber-400" />
            حسابداری، دخل و خرج و هزینه‌های جاری استودیو
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            ثبت فاکتورهای خرید، اجاره، حقوق، قبوض و پایش خودکار هزینه‌های ثابت ماهیانه
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowRecurringModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-medium text-xs border border-slate-700 transition-colors"
          >
            <Clock className="w-4 h-4 text-blue-400" />
            <span>تعریف هزینه ثابت ماهیانه</span>
          </button>
          <button
            onClick={() => setShowExpenseModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-bold text-xs transition-all shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>ثبت هزینه جدید</span>
          </button>
        </div>
      </div>

      {/* Financial Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/15 text-rose-400 flex items-center justify-center">
              <TrendingDown className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs text-slate-400">کل هزینه‌های متفرقه و ثبت‌شده</span>
              <div className="text-xl font-black text-rose-400">{formatCurrency(totalExpenses)}</div>
            </div>
          </div>
          <div className="text-xs text-slate-400">
            {toPersianDigits(expenses.length)} فقره سند
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/15 text-blue-400 flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs text-slate-400">مجموع تعهدات هزینه‌های ثابت ماهیانه</span>
              <div className="text-xl font-black text-blue-400">{formatCurrency(totalMonthlyRecurring)}</div>
            </div>
          </div>
          <div className="text-xs text-slate-400">
            {toPersianDigits(recurring.length)} ردیف فعال
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2 text-xs">
        <button
          onClick={() => setActiveTab('expenses')}
          className={`px-4 py-2 rounded-xl font-bold transition-all ${
            activeTab === 'expenses'
              ? 'bg-amber-500 text-slate-950'
              : 'text-slate-400 hover:text-white bg-slate-900 border border-slate-800'
          }`}
        >
          اسناد هزینه پرداخت‌شده ({toPersianDigits(expenses.length)})
        </button>
        <button
          onClick={() => setActiveTab('recurring')}
          className={`px-4 py-2 rounded-xl font-bold transition-all ${
            activeTab === 'recurring'
              ? 'bg-amber-500 text-slate-950'
              : 'text-slate-400 hover:text-white bg-slate-900 border border-slate-800'
          }`}
        >
          هزینه‌های ثابت و دوره‌ای ({toPersianDigits(recurring.length)})
        </button>
      </div>

      {/* Tab 1: Expenses Table */}
      {activeTab === 'expenses' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="p-3.5">عنوان هزینه</th>
                  <th className="p-3.5">دسته‌بندی</th>
                  <th className="p-3.5 text-left">مبلغ پرداختی</th>
                  <th className="p-3.5">دریافت‌کننده وجه</th>
                  <th className="p-3.5">روش پرداخت</th>
                  <th className="p-3.5">تاریخ پرداخت</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-200">
                {expenses.map((ex) => (
                  <tr key={ex.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="p-3.5 font-bold text-white">
                      {ex.title}
                      {ex.description && <span className="block text-[11px] font-normal text-slate-400">{ex.description}</span>}
                    </td>
                    <td className="p-3.5 text-slate-300">
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-[11px] text-slate-300">
                        {ex.category}
                      </span>
                    </td>
                    <td className="p-3.5 text-left font-bold text-rose-400">{formatCurrency(ex.amount)}</td>
                    <td className="p-3.5 text-slate-300">{ex.receiver || '-'}</td>
                    <td className="p-3.5 text-slate-400">{ex.payment_method || 'بانکی'}</td>
                    <td className="p-3.5 text-slate-400">{formatJalaliHuman(ex.expense_date)}</td>
                  </tr>
                ))}

                {expenses.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-500">
                      هزینه‌ای ثبت نشده است.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Recurring Expenses Table */}
      {activeTab === 'recurring' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="p-3.5">عنوان هزینه ثابت</th>
                  <th className="p-3.5">دسته‌بندی</th>
                  <th className="p-3.5 text-left">مبلغ دوره‌ای</th>
                  <th className="p-3.5 text-center">دوره تکرار</th>
                  <th className="p-3.5 text-center">روز سررسید در ماه</th>
                  <th className="p-3.5 text-center">وضعیت</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-200">
                {recurring.map((rc) => (
                  <tr key={rc.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="p-3.5 font-bold text-white">{rc.title}</td>
                    <td className="p-3.5 text-slate-300">{rc.category}</td>
                    <td className="p-3.5 text-left font-bold text-amber-400">{formatCurrency(rc.amount)}</td>
                    <td className="p-3.5 text-center text-slate-400">{rc.frequency === 'monthly' ? 'ماهیانه' : 'سالیانه'}</td>
                    <td className="p-3.5 text-center font-bold text-slate-300">{toPersianDigits(rc.due_day)} هر ماه</td>
                    <td className="p-3.5 text-center">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-400">
                        فعال
                      </span>
                    </td>
                  </tr>
                ))}

                {recurring.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-500">
                      هزینه ثابتی تعریف نشده است.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Expense Modal */}
      {showExpenseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Plus className="w-4 h-4 text-amber-400" />
                ثبت سند هزینه استودیو
              </h3>
              <button onClick={() => setShowExpenseModal(false)} className="p-1 text-slate-400 hover:text-white rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateExpense} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 mb-1">عنوان و شرح هزینه *</label>
                <input
                  type="text"
                  required
                  value={expenseForm.title}
                  onChange={(e) => setExpenseForm({ ...expenseForm, title: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white"
                  placeholder="مثال: خرید تجهیزات مصرفی، پذیرایی، بنزین تیم"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1">دسته‌بندی</label>
                  <select
                    value={expenseForm.category}
                    onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white"
                  >
                    <option value="اجاره و شارژ">اجاره و شارژ دفتر</option>
                    <option value="حقوق و دستمزد">حقوق و پرسنل</option>
                    <option value="تجهیزات و تعمیرات">خرید و تعمیر تجهیزات</option>
                    <option value="حمل و نقل">حمل و نقل و ایاب ذهاب</option>
                    <option value="تبلیغات و بازاریابی">تبلیغات و سوشال</option>
                    <option value="سایر">سایر موارد</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-300 mb-1">مبلغ هزینه (تومان) *</label>
                  <input
                    type="number"
                    required
                    value={expenseForm.amount}
                    onChange={(e) => setExpenseForm({ ...expenseForm, amount: Number(e.target.value) || 0 })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-rose-400 font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1">تاریخ پرداخت (شمسی) *</label>
                  <input
                    type="text"
                    required
                    value={expenseForm.expense_date}
                    onChange={(e) => setExpenseForm({ ...expenseForm, expense_date: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1">روش پرداخت</label>
                  <select
                    value={expenseForm.payment_method}
                    onChange={(e) => setExpenseForm({ ...expenseForm, payment_method: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white"
                  >
                    <option value="انتقال بانکی">انتقال بانکی</option>
                    <option value="کارت">کارت‌خوان / پوز</option>
                    <option value="نقدی">وجه نقد</option>
                    <option value="چک">چک</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 mb-1">دریافت‌کننده وجه / فروشگاه</label>
                <input
                  type="text"
                  value={expenseForm.receiver}
                  onChange={(e) => setExpenseForm({ ...expenseForm, receiver: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white"
                />
              </div>

              <div className="pt-4 border-t border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowExpenseModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold"
                >
                  {saving ? 'در حال ثبت...' : 'ثبت سند هزینه'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Recurring Modal */}
      {showRecurringModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-400" />
                تعریف هزینه ثابت دوره‌ای
              </h3>
              <button onClick={() => setShowRecurringModal(false)} className="p-1 text-slate-400 hover:text-white rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateRecurring} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 mb-1">عنوان هزینه ثابت *</label>
                <input
                  type="text"
                  required
                  value={recurringForm.title}
                  onChange={(e) => setRecurringForm({ ...recurringForm, title: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white"
                  placeholder="اجاره دفتر استودیو فرشته"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1">مبلغ دوره (تومان) *</label>
                  <input
                    type="number"
                    required
                    value={recurringForm.amount}
                    onChange={(e) => setRecurringForm({ ...recurringForm, amount: Number(e.target.value) || 0 })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-amber-400 font-bold"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1">روز سررسید هر ماه</label>
                  <input
                    type="number"
                    min={1}
                    max={31}
                    value={recurringForm.due_day}
                    onChange={(e) => setRecurringForm({ ...recurringForm, due_day: Number(e.target.value) || 1 })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white text-center"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowRecurringModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-lg bg-blue-500 hover:bg-blue-400 text-white font-bold"
                >
                  {saving ? 'در حال ثبت...' : 'ثبت هزینه ثابت'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
