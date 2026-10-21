import React, { useState, useEffect } from 'react';
import {
  Users, UserPlus, Search, Filter, Phone, Mail, MapPin,
  Calendar, FileText, Receipt, CreditCard, HeartHandshake,
  MessageSquare, Trash2, Edit3, Eye, X, Check, Clock, AlertCircle, Plus
} from 'lucide-react';
import { api } from '../services/api.ts';
import type { Customer } from '../types.ts';
import { formatCurrency, toPersianDigits, formatJalaliHuman, getTodayJalali } from '../utils/jalali.ts';

interface CRMViewProps {
  initialSearch?: string;
  externalSearch?: string;
  openAddSignal?: number;
  onOpenContract?: (id: number) => void;
  onOpenInvoice?: (id: number) => void;
}

export const CRMView: React.FC<CRMViewProps> = ({
  initialSearch,
  externalSearch,
  openAddSignal,
  onOpenContract,
  onOpenInvoice
}) => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState(externalSearch || initialSearch || '');
  const [loading, setLoading] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [customerDetail, setCustomerDetail] = useState<any>(null);
  const [detailTab, setDetailTab] = useState<'info' | 'weddings' | 'contracts' | 'invoices' | 'payments' | 'sms'>('info');

  // Add / Edit Customer Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    phone: '',
    phone2: '',
    national_id: '',
    birth_date: '',
    city: 'تهران',
    address: '',
    source: 'Instagram',
    notes: '',
  });
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const list = await api.getCustomers(search);
      setCustomers(list);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, [search]);

  useEffect(() => {
    if (externalSearch !== undefined) {
      setSearch(externalSearch);
    }
  }, [externalSearch]);

  useEffect(() => {
    if (openAddSignal && openAddSignal > 0) {
      handleOpenAdd();
    }
  }, [openAddSignal]);

  // Quick Payment for a Contract from Customer Profile
  const [payContractModal, setPayContractModal] = useState<any | null>(null);
  const [payAmt, setPayAmt] = useState('');
  const [payDate, setPayDate] = useState(getTodayJalali());
  const [payMethod, setPayMethod] = useState('کارت');
  const [payTracking, setPayTracking] = useState('');
  const [payDesc, setPayDesc] = useState('');
  const [savingPay, setSavingPay] = useState(false);
  const [payError, setPayError] = useState('');

  // Load customer detail when selected
  const openCustomerDetail = async (id: number) => {
    setSelectedCustomerId(id);
    try {
      const data = await api.getCustomer(id);
      setCustomerDetail(data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleOpenQuickPay = (ct: any) => {
    setPayContractModal(ct);
    setPayAmt('');
    setPayDate(getTodayJalali());
    setPayMethod('کارت');
    setPayTracking('');
    setPayDesc(`واریزی بابت قرارداد ${ct.contract_number}`);
    setPayError('');
  };

  const handleQuickPaySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPayError('');
    if (!payContractModal) return;

    const clean = Number(String(payAmt).replace(/[^\d]/g, ''));
    if (clean <= 0) {
      setPayError('مبلغ پرداختی باید بیشتر از صفر باشد.');
      return;
    }
    if (clean > payContractModal.remaining_amount) {
      setPayError('مبلغ پرداختی نمیتواند بیشتر از مانده قرارداد باشد.');
      return;
    }

    try {
      setSavingPay(true);
      await api.createPayment({
        customer_id: payContractModal.customer_id,
        contract_id: payContractModal.id,
        amount: clean,
        payment_date: payDate || getTodayJalali(),
        payment_method: payMethod,
        tracking_code: payTracking || undefined,
        receiver_name: 'مدیریت استودیو',
        description: payDesc || undefined
      });
      setPayContractModal(null);
      // Refresh customer details and customer list
      if (selectedCustomerId) {
        await openCustomerDetail(selectedCustomerId);
      }
      fetchCustomers();
    } catch (err: any) {
      setPayError(err.message || 'خطا در ثبت پرداخت');
    } finally {
      setSavingPay(false);
    }
  };

  const handleOpenAdd = (cust?: Customer) => {
    if (cust) {
      setEditingCustomer(cust);
      setFormData({
        first_name: cust.first_name || '',
        last_name: cust.last_name || '',
        phone: cust.phone || '',
        phone2: cust.phone2 || '',
        national_id: cust.national_id || '',
        birth_date: cust.birth_date || '',
        city: cust.city || 'تهران',
        address: cust.address || '',
        source: (cust.source as any) || 'Instagram',
        notes: cust.notes || '',
      });
    } else {
      setEditingCustomer(null);
      setFormData({
        first_name: '',
        last_name: '',
        phone: '',
        phone2: '',
        national_id: '',
        birth_date: '',
        city: 'تهران',
        address: '',
        source: 'Instagram',
        notes: '',
      });
    }
    setFormError('');
    setShowAddModal(true);
  };

  const handleSubmitCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!formData.first_name || !formData.last_name || !formData.phone) {
      setFormError('نام، نام خانوادگی و شماره تماس الزامی هستند.');
      return;
    }

    try {
      setSaving(true);
      if (editingCustomer) {
        await api.updateCustomer(editingCustomer.id, formData);
      } else {
        await api.createCustomer(formData);
      }
      setShowAddModal(false);
      fetchCustomers();
      if (selectedCustomerId && editingCustomer && selectedCustomerId === editingCustomer.id) {
        openCustomerDetail(selectedCustomerId);
      }
    } catch (err: any) {
      setFormError(err.message || 'خطا در ثبت مشتری');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm('آیا از حذف این مشتری اطمینان دارید؟ تمامی سوابق وابسته ممکن است تحت تأثیر قرار گیرند.')) {
      try {
        await api.deleteCustomer(id);
        fetchCustomers();
        if (selectedCustomerId === id) setSelectedCustomerId(null);
      } catch (err: any) {
        alert(err.message || 'خطا در حذف مشتری');
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-amber-400" />
            مدیریت مشتریان و پرونده‌های CRM
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            سوابق کامل عروس و داماد، قراردادها، پرداخت‌ها و وضعیت مراسم
          </p>
        </div>
        <button
          id="btn-add-customer"
          onClick={() => handleOpenAdd()}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-bold text-xs transition-all shadow-xs"
        >
          <UserPlus className="w-4 h-4" />
          <span>افزودن مشتری جدید</span>
        </button>
      </div>

      {/* Search and Filters */}
      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-96">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="جستجوی نام، موبایل، کد ملی، شهر..."
            className="w-full bg-slate-950 text-xs text-slate-100 placeholder:text-slate-500 border border-slate-700/80 rounded-lg pr-9 pl-4 py-2.5 focus:outline-none focus:border-amber-500"
          />
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
        </div>
        <div className="text-xs text-slate-400">
          تعداد کل: <strong className="text-amber-400">{toPersianDigits(customers.length)}</strong> پرونده
        </div>
      </div>

      {/* Main Content: Table + Side Profile Sheet */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Table Column */}
        <div className={`${selectedCustomerId ? 'lg:col-span-7' : 'lg:col-span-12'} transition-all`}>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="p-3.5">نام و نام خانوادگی</th>
                    <th className="p-3.5">شماره تماس</th>
                    <th className="p-3.5">شهر / معرف</th>
                    <th className="p-3.5 text-center">قراردادها</th>
                    <th className="p-3.5 text-left">مانده بدهی</th>
                    <th className="p-3.5 text-center">عملیات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-200">
                  {customers.map((c) => {
                    const isSelected = selectedCustomerId === c.id;
                    const hasDebt = (c.debt_amount || 0) > 0;
                    return (
                      <tr
                        key={c.id}
                        className={`hover:bg-slate-800/40 transition-colors ${
                          isSelected ? 'bg-amber-500/10 border-r-2 border-amber-400' : ''
                        }`}
                      >
                        <td className="p-3.5 font-bold text-white">
                          <button
                            onClick={() => openCustomerDetail(c.id)}
                            className="text-right hover:text-amber-400 transition-colors"
                          >
                            {c.first_name} {c.last_name}
                          </button>
                        </td>
                        <td className="p-3.5 text-slate-300">{toPersianDigits(c.phone)}</td>
                        <td className="p-3.5 text-slate-400">
                          {c.city || 'تهران'} {c.source ? `• ${c.source}` : ''}
                        </td>
                        <td className="p-3.5 text-center">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-300">
                            {toPersianDigits(c.contract_count || 0)}
                          </span>
                        </td>
                        <td className="p-3.5 text-left">
                          {hasDebt ? (
                            <span className="text-amber-400 font-bold">{formatCurrency(c.debt_amount)}</span>
                          ) : (
                            <span className="text-emerald-400 text-[11px]">تسویه</span>
                          )}
                        </td>
                        <td className="p-3.5 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => openCustomerDetail(c.id)}
                              title="مشاهده پرونده کامل"
                              className="p-1.5 text-slate-400 hover:text-amber-400 rounded-md hover:bg-slate-800"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleOpenAdd(c)}
                              title="ویرایش اطلاعات"
                              className="p-1.5 text-slate-400 hover:text-blue-400 rounded-md hover:bg-slate-800"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDelete(c.id)}
                              title="حذف"
                              className="p-1.5 text-slate-400 hover:text-rose-400 rounded-md hover:bg-slate-800"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {customers.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-500">
                        مشتری با این مشخصات یافت نشد.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Customer Detail Profile Sheet */}
        {selectedCustomerId && customerDetail && (
          <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col space-y-4">
            {/* Sheet Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-base font-bold text-white">
                  {customerDetail.customer?.first_name || customerDetail.first_name} {customerDetail.customer?.last_name || customerDetail.last_name}
                </h3>
                <span className="text-xs text-slate-400 font-mono">{toPersianDigits(customerDetail.customer?.phone || customerDetail.phone)}</span>
              </div>
              <div className="flex items-center gap-2.5">
                <div className="text-left bg-slate-950 px-2.5 py-1 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">بدهی کل مشتری:</span>
                  <span className={`text-xs font-black ${(customerDetail.debt || 0) > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                    {(customerDetail.debt || 0) > 0 ? formatCurrency(customerDetail.debt) : 'تسویه کامل'}
                  </span>
                </div>
                <button
                  onClick={() => setSelectedCustomerId(null)}
                  className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Profile Tabs */}
            <div className="flex items-center gap-1 overflow-x-auto pb-1 text-xs border-b border-slate-800">
              <button
                onClick={() => setDetailTab('info')}
                className={`px-3 py-1.5 rounded-lg whitespace-nowrap ${
                  detailTab === 'info' ? 'bg-amber-500/20 text-amber-300 font-bold' : 'text-slate-400 hover:text-white'
                }`}
              >
                مشخصات پایه
              </button>
              <button
                onClick={() => setDetailTab('weddings')}
                className={`px-3 py-1.5 rounded-lg whitespace-nowrap ${
                  detailTab === 'weddings' ? 'bg-amber-500/20 text-amber-300 font-bold' : 'text-slate-400 hover:text-white'
                }`}
              >
                عروس و داماد ({toPersianDigits(customerDetail.weddings?.length || 0)})
              </button>
              <button
                onClick={() => setDetailTab('contracts')}
                className={`px-3 py-1.5 rounded-lg whitespace-nowrap ${
                  detailTab === 'contracts' ? 'bg-amber-500/20 text-amber-300 font-bold' : 'text-slate-400 hover:text-white'
                }`}
              >
                قراردادها ({toPersianDigits(customerDetail.contracts?.length || 0)})
              </button>
              <button
                onClick={() => setDetailTab('invoices')}
                className={`px-3 py-1.5 rounded-lg whitespace-nowrap ${
                  detailTab === 'invoices' ? 'bg-amber-500/20 text-amber-300 font-bold' : 'text-slate-400 hover:text-white'
                }`}
              >
                فاکتورها ({toPersianDigits(customerDetail.invoices?.length || 0)})
              </button>
              <button
                onClick={() => setDetailTab('payments')}
                className={`px-3 py-1.5 rounded-lg whitespace-nowrap ${
                  detailTab === 'payments' ? 'bg-amber-500/20 text-amber-300 font-bold' : 'text-slate-400 hover:text-white'
                }`}
              >
                پرداخت‌ها ({toPersianDigits(customerDetail.payments?.length || 0)})
              </button>
            </div>

            {/* Tab Contents */}
            <div className="flex-1 overflow-y-auto space-y-3 text-xs">
              {detailTab === 'info' && (
                <div className="space-y-3">
                  <div className="p-3 bg-slate-950 rounded-xl border border-slate-800/80 space-y-2">
                    <div className="flex justify-between">
                      <span className="text-slate-400">کد ملی:</span>
                      <span className="text-slate-200">{toPersianDigits(customerDetail.national_id || '-')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">تلفن ثانویه:</span>
                      <span className="text-slate-200">{toPersianDigits(customerDetail.phone2 || '-')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">شهر و نشانی:</span>
                      <span className="text-slate-200">{customerDetail.city || 'تهران'} - {customerDetail.address || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">نحوه آشنایی:</span>
                      <span className="text-amber-400">{customerDetail.source || 'Instagram'}</span>
                    </div>
                  </div>

                  {customerDetail.notes && (
                    <div className="p-3 bg-slate-950 rounded-xl border border-slate-800/80">
                      <span className="text-slate-400 block mb-1">یادداشت‌های اختصاصی:</span>
                      <p className="text-slate-300 leading-relaxed">{customerDetail.notes}</p>
                    </div>
                  )}
                </div>
              )}

              {detailTab === 'weddings' && (
                <div className="space-y-2.5">
                  {customerDetail.weddings && customerDetail.weddings.length > 0 ? (
                    customerDetail.weddings.map((w: any) => (
                      <div key={w.id} className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1.5">
                        <div className="flex justify-between items-center font-bold text-amber-400">
                          <span>جشن عروسی</span>
                          <span>{formatJalaliHuman(w.wedding_date)}</span>
                        </div>
                        <div className="text-slate-300">
                          <strong>تالار / باغ:</strong> {w.venue_name || 'نامشخص'}
                        </div>
                        <div className="text-slate-400 text-[11px]">
                          نشانی: {w.venue_address || 'ثبت نشده'}
                        </div>
                        {w.has_formality === 1 && (
                          <div className="text-purple-300 text-[11px]">
                            فرمالیته: {w.formality_location || 'دارد'} ({formatJalaliHuman(w.formality_date)})
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-6 text-slate-500">اطلاعات عروسی ثبت نشده است.</div>
                  )}
                </div>
              )}

              {detailTab === 'contracts' && (
                <div className="space-y-3">
                  {customerDetail.contracts && customerDetail.contracts.length > 0 ? (
                    customerDetail.contracts.map((ct: any) => (
                      <div key={ct.id} className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 space-y-2.5">
                        {/* Contract Header */}
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="text-amber-400 font-bold block font-mono text-xs">
                              قرارداد #{ct.contract_number}
                            </span>
                            <span className="text-white text-xs font-medium block mt-0.5">
                              {ct.title || 'قرارداد خدمات استودیو'}
                            </span>
                            <span className="text-slate-500 text-[10px]">
                              تاریخ: {formatJalaliHuman(ct.contract_date)}
                            </span>
                          </div>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            ct.remaining_amount <= 0 && ct.final_amount > 0
                              ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                              : (ct.paid_amount > 0
                                ? 'bg-amber-500/15 border-amber-500/30 text-amber-400'
                                : 'bg-rose-500/15 border-rose-500/30 text-rose-400')
                          }`}>
                            {ct.remaining_amount <= 0 && ct.final_amount > 0 ? 'تسویه شده' : (ct.paid_amount > 0 ? 'پرداخت ناقص' : 'پرداخت نشده')}
                          </span>
                        </div>

                        {/* Financial Figures */}
                        <div className="grid grid-cols-3 gap-2 bg-slate-900/80 p-2.5 rounded-lg border border-slate-800/80 text-[11px]">
                          <div>
                            <span className="text-slate-500 block text-[10px]">مبلغ نهایی:</span>
                            <strong className="text-white font-bold block mt-0.5">{formatCurrency(ct.final_amount)}</strong>
                          </div>
                          <div>
                            <span className="text-slate-500 block text-[10px]">پرداخت شده:</span>
                            <strong className="text-emerald-400 font-bold block mt-0.5">{formatCurrency(ct.paid_amount || 0)}</strong>
                          </div>
                          <div>
                            <span className="text-slate-500 block text-[10px]">مانده بدهی:</span>
                            <strong className={`font-bold block mt-0.5 ${ct.remaining_amount > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                              {formatCurrency(ct.remaining_amount || 0)}
                            </strong>
                          </div>
                        </div>

                        {/* Contract Payments List */}
                        <div className="space-y-1.5 pt-1">
                          <span className="text-slate-400 font-bold block text-[11px]">پرداخت‌ها:</span>
                          {ct.payments && ct.payments.length > 0 ? (
                            <div className="space-y-1">
                              {ct.payments.map((p: any) => (
                                <div key={p.id} className="flex items-center justify-between text-[11px] bg-slate-900 px-2.5 py-1.5 rounded border border-slate-800/50">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-slate-300">{formatJalaliHuman(p.payment_date)}</span>
                                    <span className="text-slate-600">—</span>
                                    <span className="text-emerald-400 font-bold">{formatCurrency(p.amount)}</span>
                                  </div>
                                  <span className="text-slate-500 text-[10px]">{p.payment_method}</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-slate-500 text-[11px] italic">هنوز پرداختی برای این قرارداد ثبت نشده است.</div>
                          )}
                        </div>

                        {/* Quick Pay Action Button */}
                        {ct.remaining_amount > 0 && (
                          <div className="pt-1 flex justify-end">
                            <button
                              onClick={() => handleOpenQuickPay(ct)}
                              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-[11px] transition-colors shadow-xs"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>ثبت پرداخت برای این قرارداد</span>
                            </button>
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-6 text-slate-500">قراردادی ثبت نشده است.</div>
                  )}
                </div>
              )}

              {detailTab === 'invoices' && (
                <div className="space-y-2.5">
                  {customerDetail.invoices && customerDetail.invoices.length > 0 ? (
                    customerDetail.invoices.map((inv: any) => (
                      <div key={inv.id} className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1.5">
                        <div className="flex justify-between items-center font-bold text-white">
                          <span>فاکتور {inv.invoice_number}</span>
                          <span className="text-emerald-400">{formatCurrency(inv.total)}</span>
                        </div>
                        <div className="flex justify-between text-slate-400 text-[11px]">
                          <span>تاریخ صدور: {formatJalaliHuman(inv.issue_date)}</span>
                          <span>مانده: {formatCurrency(inv.remaining_amount)}</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-6 text-slate-500">فاکتوری ثبت نشده است.</div>
                  )}
                </div>
              )}

              {detailTab === 'payments' && (
                <div className="space-y-2.5">
                  {customerDetail.payments && customerDetail.payments.length > 0 ? (
                    customerDetail.payments.map((p: any) => (
                      <div key={p.id} className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1.5">
                        <div className="flex justify-between items-center font-bold text-emerald-400">
                          <span>{formatCurrency(p.amount)}</span>
                          <span className="text-slate-400 font-normal">{p.payment_method}</span>
                        </div>
                        <div className="flex justify-between text-slate-400 text-[11px]">
                          <span>تاریخ: {formatJalaliHuman(p.payment_date)}</span>
                          <span>کد پیگیری: {toPersianDigits(p.tracking_code || '-')}</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-6 text-slate-500">پرداختی ثبت نشده است.</div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Add / Edit Customer Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-amber-400" />
                {editingCustomer ? 'ویرایش پرونده مشتری' : 'افزودن مشتری جدید'}
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitCustomer} className="p-6 space-y-4 text-xs">
              {formError && (
                <div className="p-3 bg-rose-500/15 border border-rose-500/30 rounded-xl text-rose-300">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1">نام *</label>
                  <input
                    type="text"
                    required
                    value={formData.first_name}
                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white focus:border-amber-500 focus:outline-none"
                    placeholder="مثال: سارا"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1">نام خانوادگی *</label>
                  <input
                    type="text"
                    required
                    value={formData.last_name}
                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white focus:border-amber-500 focus:outline-none"
                    placeholder="مثال: رادمنش"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1">شماره همراه (اصلی) *</label>
                  <input
                    type="text"
                    required
                    dir="ltr"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white focus:border-amber-500 focus:outline-none text-left"
                    placeholder="09121234567"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1">شماره همراه ثانویه</label>
                  <input
                    type="text"
                    dir="ltr"
                    value={formData.phone2}
                    onChange={(e) => setFormData({ ...formData, phone2: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white focus:border-amber-500 focus:outline-none text-left"
                    placeholder="09129876543"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1">کد ملی</label>
                  <input
                    type="text"
                    dir="ltr"
                    value={formData.national_id}
                    onChange={(e) => setFormData({ ...formData, national_id: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white focus:border-amber-500 focus:outline-none text-left"
                    placeholder="0012345678"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1">نحوه آشنایی با استودیو</label>
                  <select
                    value={formData.source}
                    onChange={(e) => setFormData({ ...formData, source: e.target.value as any })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white focus:border-amber-500 focus:outline-none"
                  >
                    <option value="Instagram">اینستاگرام</option>
                    <option value="معرفی دوستان">معرفی دوستان / آشنایان</option>
                    <option value="سایت">وبسایت</option>
                    <option value="تماس">تماس تلفنی مستقیم</option>
                    <option value="مراجعه حضوری">مراجعه حضوری</option>
                    <option value="سایر">سایر موارد</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1">شهر</label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1">تاریخ تولد</label>
                  <input
                    type="text"
                    value={formData.birth_date}
                    onChange={(e) => setFormData({ ...formData, birth_date: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white focus:border-amber-500 focus:outline-none"
                    placeholder="1375/04/12"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 mb-1">نشانی پستی</label>
                <textarea
                  rows={2}
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1">یادداشت‌ها</label>
                <textarea
                  rows={2}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white focus:border-amber-500 focus:outline-none"
                  placeholder="سلیقه مشتری، تم مراسم، توافقات..."
                />
              </div>

              <div className="pt-4 border-t border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-colors"
                >
                  {saving ? 'در حال ذخیره...' : (editingCustomer ? 'ذخیره تغییرات' : 'ثبت مشتری')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Quick Contract Payment Modal */}
      {payContractModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-amber-400" />
                ثبت پرداخت: قرارداد #{payContractModal.contract_number}
              </h3>
              <button
                onClick={() => setPayContractModal(null)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleQuickPaySubmit} className="p-6 space-y-4 text-xs">
              {payError && (
                <div className="p-3 bg-rose-500/15 border border-rose-500/30 rounded-xl text-rose-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{payError}</span>
                </div>
              )}

              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1.5">
                <div className="flex justify-between text-slate-400">
                  <span>مبلغ نهایی قرارداد:</span>
                  <span className="text-white font-bold">{formatCurrency(payContractModal.final_amount)}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>پرداخت شده:</span>
                  <span className="text-emerald-400 font-bold">{formatCurrency(payContractModal.paid_amount || 0)}</span>
                </div>
                <div className="flex justify-between text-slate-400 pt-1 border-t border-slate-800">
                  <span>مانده قابل پرداخت:</span>
                  <span className="text-amber-400 font-black">{formatCurrency(payContractModal.remaining_amount || 0)}</span>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-slate-300 font-medium">مبلغ پرداختی (تومان) *</label>
                  {(payContractModal.remaining_amount || 0) > 0 && (
                    <button
                      type="button"
                      onClick={() => setPayAmt(String(payContractModal.remaining_amount))}
                      className="text-[11px] text-amber-400 hover:text-amber-300 font-bold underline"
                    >
                      تسویه کل مانده ({formatCurrency(payContractModal.remaining_amount)})
                    </button>
                  )}
                </div>
                <div className="relative">
                  <input
                    type="text"
                    value={payAmt}
                    onChange={(e) => setPayAmt(e.target.value)}
                    placeholder="مثال: ۱۰,۰۰۰,۰۰۰"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white font-mono focus:border-amber-400 focus:outline-none"
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">تومان</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">تاریخ پرداخت *</label>
                  <input
                    type="text"
                    value={payDate}
                    onChange={(e) => setPayDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white font-mono focus:border-amber-400 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 mb-1 font-medium">روش پرداخت *</label>
                  <select
                    value={payMethod}
                    onChange={(e) => setPayMethod(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white focus:border-amber-400 focus:outline-none"
                  >
                    <option value="کارت">کارت‌خوان / کارت به کارت</option>
                    <option value="نقدی">نقدی</option>
                    <option value="انتقال بانکی">انتقال بانکی / پایا</option>
                    <option value="چک">چک صیادی</option>
                    <option value="سایر">سایر روش‌ها</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-medium">شماره پیگیری / کد ارجاع</label>
                <input
                  type="text"
                  value={payTracking}
                  onChange={(e) => setPayTracking(e.target.value)}
                  placeholder="کد پیگیری تراکنش"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white font-mono focus:border-amber-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-medium">توضیحات</label>
                <textarea
                  rows={2}
                  value={payDesc}
                  onChange={(e) => setPayDesc(e.target.value)}
                  placeholder="توضیحات..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white focus:border-amber-400 focus:outline-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setPayContractModal(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={savingPay}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-bold transition-all shadow-md disabled:opacity-50"
                >
                  {savingPay ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                      <span>در حال ثبت...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>ثبت پرداخت</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
