import React, { useState, useEffect } from 'react';
import {
  Receipt, Search, Eye, Printer, CheckCircle,
  Clock, AlertCircle, DollarSign, Plus, X,
  Check, ArrowDownLeft, FileText, User, RefreshCw
} from 'lucide-react';
import { api } from '../services/api.ts';
import type { Invoice, Payment, Customer } from '../types.ts';
import {
  formatCurrency, toPersianDigits, formatJalaliHuman,
  getTodayJalali, parseFinancialNumber, toEnglishDigits
} from '../utils/jalali.ts';
import { PrintDocumentModal } from './PrintDocumentModal.tsx';
import { InvoiceFormModal } from './InvoiceFormModal.tsx';
import { PaymentFormModal } from './PaymentFormModal.tsx';

export const InvoicesView: React.FC<{ openAddSignal?: number }> = ({ openAddSignal = 0 }) => {
  const [showNewInvoice, setShowNewInvoice] = useState(false);
  const [showNewPayment, setShowNewPayment] = useState(false);
  useEffect(() => { if (openAddSignal > 0) setShowNewInvoice(true); }, [openAddSignal]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'unpaid' | 'partial' | 'paid'>('all');

  // Print Modal
  const [printData, setPrintData] = useState<any>(null);

  // Invoice Detail Modal
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<number | null>(null);
  const [invoiceDetail, setInvoiceDetail] = useState<any | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Add Payment Modal (Unified Payment System)
  const [showPayModal, setShowPayModal] = useState(false);
  const [payTargetInvoice, setPayTargetInvoice] = useState<Invoice | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payDate, setPayDate] = useState(getTodayJalali());
  const [payMethod, setPayMethod] = useState('کارت');
  const [payTrackingCode, setPayTrackingCode] = useState('');
  const [payDescription, setPayDescription] = useState('');
  const [savingPayment, setSavingPayment] = useState(false);
  const [payError, setPayError] = useState('');
  const [successToast, setSuccessToast] = useState('');

  const loadInvoices = async () => {
    try {
      setLoading(true);
      const list = await api.getInvoices();
      setInvoices(list);

      // If detail modal is currently open, refresh it as well
      if (selectedInvoiceId) {
        loadInvoiceDetail(selectedInvoiceId);
      }
    } catch (err) {
      console.error('Error loading invoices:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadInvoiceDetail = async (id: number) => {
    try {
      setLoadingDetail(true);
      const data = await api.getInvoice(id);
      setInvoiceDetail(data);
    } catch (err) {
      console.error('Error loading invoice detail:', err);
    } finally {
      setLoadingDetail(false);
    }
  };

  useEffect(() => {
    loadInvoices();
  }, []);

  const openInvoiceDetail = (id: number) => {
    setSelectedInvoiceId(id);
    loadInvoiceDetail(id);
  };

  const closeInvoiceDetail = () => {
    setSelectedInvoiceId(null);
    setInvoiceDetail(null);
  };

  const openPrint = async (id: number) => {
    try {
      const inv = await api.getInvoice(id);
      setPrintData(inv);
    } catch (err) {
      console.error(err);
    }
  };

  const openAddPaymentModal = (inv: Invoice) => {
    setPayTargetInvoice(inv);
    setPayAmount('');
    setPayDate(getTodayJalali());
    setPayMethod('کارت');
    setPayTrackingCode('');
    setPayDescription(`واریزی بابت فاکتور ${inv.invoice_number}`);
    setPayError('');
    setShowPayModal(true);
  };

  const handleAddPaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPayError('');

    if (!payTargetInvoice) return;

    const cleanAmt = parseFinancialNumber(payAmount);
    if (cleanAmt <= 0) {
      setPayError('مبلغ پرداختی باید بیشتر از صفر باشد.');
      return;
    }

    if (cleanAmt > payTargetInvoice.remaining_amount) {
      setPayError('مبلغ پرداختی نمیتواند بیشتر از مانده فاکتور باشد.');
      return;
    }

    try {
      setSavingPayment(true);
      // Uses the exact same unified payments API
      await api.createPayment({
        customer_id: payTargetInvoice.customer_id,
        contract_id: payTargetInvoice.contract_id || null,
        invoice_id: payTargetInvoice.id,
        amount: cleanAmt,
        payment_date: payDate || getTodayJalali(),
        payment_method: payMethod,
        tracking_code: payTrackingCode ? toEnglishDigits(payTrackingCode) : undefined,
        receiver_name: 'مدیریت استودیو',
        description: payDescription || undefined
      });

      setShowPayModal(false);
      setSuccessToast('پرداخت با موفقیت ثبت شد.');
      setTimeout(() => setSuccessToast(''), 4000);

      // Refresh invoices and active detail modal
      await loadInvoices();
    } catch (err: any) {
      setPayError(err.message || 'خطا در ثبت پرداخت');
    } finally {
      setSavingPayment(false);
    }
  };

  const getStatusBadge = (inv: Invoice) => {
    const rem = Number(inv.remaining_amount ?? (inv.total - (inv.paid_amount || 0)));
    const paid = Number(inv.paid_amount || 0);

    if (rem <= 0 && inv.total > 0) {
      return { label: 'تسویه شده', color: 'text-emerald-400', bg: 'bg-emerald-500/15 border-emerald-500/30' };
    }
    if (paid > 0) {
      return { label: 'پرداخت ناقص', color: 'text-amber-400', bg: 'bg-amber-500/15 border-amber-500/30' };
    }
    return { label: 'پرداخت نشده', color: 'text-rose-400', bg: 'bg-rose-500/15 border-rose-500/30' };
  };

  const filtered = invoices.filter(inv => {
    const s = search.toLowerCase().trim();
    const customerName = `${inv.first_name || ''} ${inv.last_name || ''}`.toLowerCase();
    const brideName = `${inv.bride_first || ''} ${inv.bride_last || ''}`.toLowerCase();
    const groomName = `${inv.groom_first || ''} ${inv.groom_last || ''}`.toLowerCase();
    const phone = (inv.phone || '').toLowerCase();
    const invoiceNum = (inv.invoice_number || '').toLowerCase();
    const contractNum = (inv.contract_number || '').toLowerCase();

    const matchesSearch = !s ||
      customerName.includes(s) ||
      brideName.includes(s) ||
      groomName.includes(s) ||
      phone.includes(s) ||
      invoiceNum.includes(s) ||
      contractNum.includes(s);

    if (!matchesSearch) return false;

    const statusInfo = getStatusBadge(inv);
    if (statusFilter === 'paid' && statusInfo.label !== 'تسویه شده') return false;
    if (statusFilter === 'partial' && statusInfo.label !== 'پرداخت ناقص') return false;
    if (statusFilter === 'unpaid' && statusInfo.label !== 'پرداخت نشده') return false;

    return true;
  });

  const totalInvoicesSum = invoices.reduce((acc, i) => acc + (i.total || 0), 0);
  const totalPaidSum = invoices.reduce((acc, i) => acc + (i.paid_amount || 0), 0);
  const totalRemainingSum = invoices.reduce((acc, i) => acc + (i.remaining_amount || 0), 0);

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {successToast && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-emerald-600 text-white px-5 py-2.5 rounded-xl shadow-xl flex items-center gap-2 text-xs font-bold animate-in fade-in slide-in-from-top-4 duration-300">
          <CheckCircle className="w-4 h-4" />
          <span>{successToast}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Receipt className="w-5 h-5 text-amber-400" />
            فاکتورهای رسمی و صورتحساب‌های مالی استودیو WED
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            ردیابی مبالغ صورتحساب، پیش‌پرداخت، مانده بدهی و چاپ با سربرگ استاندارد
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button onClick={() => setShowNewPayment(true)} className="px-3 py-2 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-200 rounded-xl text-xs font-medium">ثبت پرداخت</button>
          <button onClick={() => setShowNewInvoice(true)} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-bold text-xs"><Plus className="w-4 h-4" />فاکتور جدید</button>
          <button
            onClick={() => loadInvoices()}
            className="p-2 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white rounded-xl text-xs transition-colors"
            title="بروزرسانی داده‌ها"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-amber-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Top Financial Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/15 text-blue-400 flex items-center justify-center">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs text-slate-400">مجموع مبالغ نهایی فاکتورها</span>
              <div className="text-lg font-black text-white">{formatCurrency(totalInvoicesSum)}</div>
            </div>
          </div>
          <div className="text-left text-[11px] text-slate-400">
            {toPersianDigits(invoices.length)} فاکتور
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
              <ArrowDownLeft className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs text-slate-400">مجموع دریافت شده</span>
              <div className="text-lg font-black text-emerald-400">{formatCurrency(totalPaidSum)}</div>
            </div>
          </div>
          <div className="text-left text-[11px] text-emerald-400 font-bold">
            تسویه و علی‌الحساب
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs text-slate-400">کل مانده مطالبات فاکتورها</span>
              <div className="text-lg font-black text-amber-400">{formatCurrency(totalRemainingSum)}</div>
            </div>
          </div>
          <div className="text-left text-[11px] text-slate-400">
            در انتظار وصول
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-900 p-3 rounded-2xl border border-slate-800">
        <div className="flex-1 max-w-md relative">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="جستجو در نام مشتری، عروس، داماد، تلفن، شماره فاکتور یا قرارداد..."
            className="w-full bg-slate-950 border border-slate-800 focus:border-amber-400 rounded-xl pr-9 pl-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-hidden"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1 rounded-lg ${statusFilter === 'all' ? 'bg-slate-800 text-white font-bold' : 'text-slate-400 hover:text-white'}`}
          >
            همه ({toPersianDigits(invoices.length)})
          </button>
          <button
            onClick={() => setStatusFilter('unpaid')}
            className={`px-3 py-1 rounded-lg ${statusFilter === 'unpaid' ? 'bg-rose-500/20 text-rose-300 font-bold' : 'text-slate-400 hover:text-white'}`}
          >
            پرداخت نشده
          </button>
          <button
            onClick={() => setStatusFilter('partial')}
            className={`px-3 py-1 rounded-lg ${statusFilter === 'partial' ? 'bg-amber-500/20 text-amber-300 font-bold' : 'text-slate-400 hover:text-white'}`}
          >
            پرداخت ناقص
          </button>
          <button
            onClick={() => setStatusFilter('paid')}
            className={`px-3 py-1 rounded-lg ${statusFilter === 'paid' ? 'bg-emerald-500/20 text-emerald-300 font-bold' : 'text-slate-400 hover:text-white'}`}
          >
            تسویه شده
          </button>
        </div>
      </div>

      {/* Invoices Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-md">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
              <tr>
                <th className="p-3.5">مشتری</th>
                <th className="p-3.5">عروس</th>
                <th className="p-3.5">داماد</th>
                <th className="p-3.5">شماره فاکتور</th>
                <th className="p-3.5">شماره قرارداد</th>
                <th className="p-3.5 text-left">مبلغ نهایی</th>
                <th className="p-3.5 text-left">پرداخت شده</th>
                <th className="p-3.5 text-left">مانده</th>
                <th className="p-3.5 text-center">وضعیت پرداخت</th>
                <th className="p-3.5 text-center w-44">عملیات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-200">
              {filtered.map((inv) => {
                const statusInfo = getStatusBadge(inv);

                return (
                  <tr key={inv.id} className="hover:bg-slate-800/40 transition-colors">
                    {/* Customer */}
                    <td className="p-3.5">
                      <strong className="text-white block font-medium">
                        {inv.first_name} {inv.last_name}
                      </strong>
                      <span className="text-slate-400 text-[11px] font-mono">
                        {toPersianDigits(inv.phone)}
                      </span>
                    </td>

                    {/* Bride */}
                    <td className="p-3.5 text-pink-300 font-medium text-[11px]">
                      {inv.bride_first || inv.bride_last ? (
                        `${inv.bride_first || ''} ${inv.bride_last || ''}`.trim()
                      ) : (
                        <span className="text-slate-500">-</span>
                      )}
                    </td>

                    {/* Groom */}
                    <td className="p-3.5 text-sky-300 font-medium text-[11px]">
                      {inv.groom_first || inv.groom_last ? (
                        `${inv.groom_first || ''} ${inv.groom_last || ''}`.trim()
                      ) : (
                        <span className="text-slate-500">-</span>
                      )}
                    </td>

                    {/* Invoice Number */}
                    <td className="p-3.5 font-bold font-mono text-amber-400">
                      {inv.invoice_number}
                    </td>

                    {/* Contract Number */}
                    <td className="p-3.5 font-mono text-slate-300">
                      {inv.contract_number ? (
                        <span className="text-amber-400">{inv.contract_number}</span>
                      ) : (
                        <span className="text-slate-500">-</span>
                      )}
                    </td>

                    {/* Final Amount */}
                    <td className="p-3.5 text-left font-bold text-white">
                      {formatCurrency(inv.total)}
                    </td>

                    {/* Paid Amount */}
                    <td className="p-3.5 text-left text-emerald-400 font-bold">
                      {formatCurrency(inv.paid_amount || 0)}
                    </td>

                    {/* Remaining Amount */}
                    <td className="p-3.5 text-left font-bold">
                      {(inv.remaining_amount || 0) > 0 ? (
                        <span className="text-amber-400">{formatCurrency(inv.remaining_amount)}</span>
                      ) : (
                        <span className="text-emerald-400 text-[11px]">۰ (تسویه)</span>
                      )}
                    </td>

                    {/* Status Badge */}
                    <td className="p-3.5 text-center">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border ${statusInfo.bg} ${statusInfo.color}`}>
                        {statusInfo.label === 'تسویه شده' && <CheckCircle className="w-3 h-3" />}
                        {statusInfo.label === 'پرداخت ناقص' && <Clock className="w-3 h-3" />}
                        {statusInfo.label === 'پرداخت نشده' && <AlertCircle className="w-3 h-3" />}
                        <span>{statusInfo.label}</span>
                      </span>
                    </td>

                    {/* Operations */}
                    <td className="p-3.5 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => openInvoiceDetail(inv.id)}
                          className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white transition-colors text-[11px]"
                          title="مشاهده جزئیات و تاریخچه پرداخت‌ها"
                        >
                          <Eye className="w-3.5 h-3.5 text-amber-400" />
                          <span>مشاهده</span>
                        </button>
                        <button
                          onClick={() => openAddPaymentModal(inv)}
                          className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 transition-colors text-[11px] font-bold border border-amber-500/30"
                          title="ثبت پرداخت برای این فاکتور"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>پرداخت</span>
                        </button>
                        <button
                          onClick={() => openPrint(inv.id)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                          title="چاپ رسمی سربرگ A4"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filtered.length === 0 && (
                <tr>
                  <td colSpan={10} className="p-10 text-center text-slate-500">
                    فاکتوری با این مشخصات یافت نشد.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ====================================================
         INVOICE DETAIL MODAL (With Full Payment History)
         ==================================================== */}
      {selectedInvoiceId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-3xl max-h-[90vh] shadow-2xl overflow-hidden flex flex-col">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-amber-400" />
                <div>
                  <h3 className="text-sm font-bold text-white">
                    جزئیات صورتحساب مالی: {invoiceDetail?.invoice?.invoice_number || 'در حال بارگذاری...'}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    مشتری: {invoiceDetail?.invoice?.first_name} {invoiceDetail?.invoice?.last_name}
                  </p>
                </div>
              </div>
              <button
                onClick={closeInvoiceDetail}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs">
              {loadingDetail || !invoiceDetail ? (
                <div className="py-12 text-center text-slate-400 flex flex-col items-center gap-2">
                  <div className="w-6 h-6 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
                  <span>در حال دریافت سوابق فاکتور...</span>
                </div>
              ) : (
                <>
                  {/* Parties & Dates Box */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-950 p-4 rounded-xl border border-slate-800">
                    <div>
                      <span className="text-slate-500 block text-[11px]">مشتری:</span>
                      <strong className="text-white text-xs block">
                        {invoiceDetail.invoice.first_name} {invoiceDetail.invoice.last_name}
                      </strong>
                      <span className="text-slate-400 text-[11px] font-mono">{toPersianDigits(invoiceDetail.invoice.phone)}</span>
                    </div>

                    <div>
                      <span className="text-slate-500 block text-[11px]">عروس و داماد:</span>
                      <div className="space-y-0.5">
                        {(invoiceDetail.invoice.bride_first || invoiceDetail.invoice.bride_last) && (
                          <span className="text-pink-300 block text-[11px]">
                            عروس: {invoiceDetail.invoice.bride_first} {invoiceDetail.invoice.bride_last}
                          </span>
                        )}
                        {(invoiceDetail.invoice.groom_first || invoiceDetail.invoice.groom_last) && (
                          <span className="text-sky-300 block text-[11px]">
                            داماد: {invoiceDetail.invoice.groom_first} {invoiceDetail.invoice.groom_last}
                          </span>
                        )}
                      </div>
                    </div>

                    <div>
                      <span className="text-slate-500 block text-[11px]">قرارداد متناظر:</span>
                      <strong className="text-amber-400 text-xs block font-mono">
                        {invoiceDetail.invoice.contract_number || 'ندارد'}
                      </strong>
                      <span className="text-slate-400 text-[11px]">
                        تاریخ صدور: {formatJalaliHuman(invoiceDetail.invoice.issue_date)}
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-500 block text-[11px]">وضعیت صورتحساب:</span>
                      <span className="font-bold text-amber-300 text-xs block mt-1">
                        {invoiceDetail.invoice.payment_status || 'ثبت شده'}
                      </span>
                    </div>
                  </div>

                  {/* Financial Balance Breakdown */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-center">
                      <span className="text-slate-500 text-[11px] block">مبلغ نهایی فاکتور</span>
                      <strong className="text-white font-bold block mt-1 text-sm">
                        {formatCurrency(invoiceDetail.invoice.total)}
                      </strong>
                    </div>

                    <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-center">
                      <span className="text-slate-500 text-[11px] block">مجموع پرداخت‌ها</span>
                      <strong className="text-emerald-400 font-bold block mt-1 text-sm">
                        {formatCurrency(invoiceDetail.invoice.paid_amount || 0)}
                      </strong>
                    </div>

                    <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-center">
                      <span className="text-slate-500 text-[11px] block">مانده بدهی فاکتور</span>
                      <strong className={`font-bold block mt-1 text-sm ${invoiceDetail.invoice.remaining_amount > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                        {formatCurrency(invoiceDetail.invoice.remaining_amount || 0)}
                      </strong>
                    </div>
                  </div>

                  {/* Complete Payment History */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                      <div className="flex items-center gap-2">
                        <Receipt className="w-4 h-4 text-amber-400" />
                        <h4 className="font-bold text-white text-xs">
                          تاریخچه کامل پرداخت‌ها و واریزی‌ها ({toPersianDigits(invoiceDetail.payments?.length || 0)} سند)
                        </h4>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openPrint(invoiceDetail.invoice.id)}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>چاپ A4</span>
                        </button>
                        <button
                          onClick={() => {
                            openAddPaymentModal(invoiceDetail.invoice);
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs shadow-xs"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>ثبت پرداخت</span>
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {invoiceDetail.payments && invoiceDetail.payments.length > 0 ? (
                        invoiceDetail.payments.map((p: any, idx: number) => (
                          <div
                            key={p.id}
                            className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                          >
                            <div className="flex items-center gap-3">
                              <span className="w-6 h-6 rounded-full bg-slate-800 text-amber-400 font-bold text-[11px] flex items-center justify-center">
                                {toPersianDigits(invoiceDetail.payments.length - idx)}
                              </span>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-emerald-400 text-sm">
                                    {formatCurrency(p.amount)}
                                  </span>
                                  <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px]">
                                    {p.payment_method}
                                  </span>
                                  <span className="font-mono text-slate-400 text-[11px]">
                                    {p.payment_number}
                                  </span>
                                </div>
                                <div className="flex items-center gap-3 text-slate-400 text-[11px] mt-1">
                                  <span>تاریخ پرداخت: <strong className="text-slate-200">{formatJalaliHuman(p.payment_date)}</strong></span>
                                  {p.tracking_code && (
                                    <span>شماره پیگیری: <strong className="text-slate-200 font-mono">{toPersianDigits(p.tracking_code)}</strong></span>
                                  )}
                                  {p.receiver_name && (
                                    <span>دریافت‌کننده: {p.receiver_name}</span>
                                  )}
                                </div>
                                {p.description && (
                                  <p className="text-slate-400 text-[11px] mt-1 italic">
                                    توضیحات: {p.description}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="p-8 text-center bg-slate-950/60 rounded-xl border border-dashed border-slate-800 text-slate-500">
                          تاکنون پرداختی برای این فاکتور ثبت نشده است. با کلیک بر روی دکمه «ثبت پرداخت» اولین واریزی را ثبت کنید.
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-3 border-t border-slate-800 bg-slate-950 flex justify-end">
              <button
                onClick={closeInvoiceDetail}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-medium text-xs"
              >
                بستن
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================
         ADD PAYMENT MODAL (Same Unified Payment System)
         ==================================================== */}
      {showPayModal && payTargetInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Receipt className="w-4 h-4 text-amber-400" />
                ثبت پرداخت فاکتور: {payTargetInvoice.invoice_number}
              </h3>
              <button
                onClick={() => setShowPayModal(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddPaymentSubmit} className="p-6 space-y-4 text-xs">
              {payError && (
                <div className="p-3 bg-rose-500/15 border border-rose-500/30 rounded-xl text-rose-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{payError}</span>
                </div>
              )}

              {/* Target Invoice & Balance Info */}
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1.5">
                <div className="flex justify-between text-slate-400">
                  <span>طرف حساب:</span>
                  <span className="text-white font-bold">{payTargetInvoice.first_name} {payTargetInvoice.last_name}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>مبلغ کل فاکتور:</span>
                  <span className="text-white font-bold">{formatCurrency(payTargetInvoice.total)}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>پرداخت شده تاکنون:</span>
                  <span className="text-emerald-400 font-bold">{formatCurrency(payTargetInvoice.paid_amount || 0)}</span>
                </div>
                <div className="flex justify-between text-slate-400 pt-1 border-t border-slate-800">
                  <span>مانده قابل پرداخت:</span>
                  <span className="text-amber-400 font-black">{formatCurrency(payTargetInvoice.remaining_amount || 0)}</span>
                </div>
              </div>

              {/* Amount */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-slate-300 font-medium">مبلغ پرداختی (تومان) *</label>
                  {(payTargetInvoice.remaining_amount || 0) > 0 && (
                    <button
                      type="button"
                      onClick={() => setPayAmount(String(payTargetInvoice.remaining_amount))}
                      className="text-[11px] text-amber-400 hover:text-amber-300 font-bold underline"
                    >
                      تسویه کل مانده ({formatCurrency(payTargetInvoice.remaining_amount)})
                    </button>
                  )}
                </div>
                <div className="relative">
                  <input
                    type="text"
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    placeholder="مثال: ۱۵,۰۰۰,۰۰۰"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white font-mono focus:border-amber-400 focus:outline-hidden"
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">تومان</span>
                </div>
                {payAmount && (
                  <span className="block mt-1 text-[11px] text-slate-400">
                    معادل: {formatCurrency(parseFinancialNumber(payAmount))}
                  </span>
                )}
              </div>

              {/* Payment Date & Method */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">تاریخ پرداخت *</label>
                  <input
                    type="text"
                    value={payDate}
                    onChange={(e) => setPayDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white font-mono focus:border-amber-400 focus:outline-hidden"
                  />
                  <span className="block mt-0.5 text-[10px] text-emerald-400">پیش‌فرض: تاریخ و زمان جاری</span>
                </div>

                <div>
                  <label className="block text-slate-300 mb-1 font-medium">روش پرداخت *</label>
                  <select
                    value={payMethod}
                    onChange={(e) => setPayMethod(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white focus:border-amber-400 focus:outline-hidden"
                  >
                    <option value="کارت">کارت‌خوان / کارت به کارت</option>
                    <option value="نقدی">نقدی</option>
                    <option value="انتقال بانکی">انتقال بانکی / پایا / ساتنا</option>
                    <option value="چک">چک صیادی</option>
                    <option value="سایر">سایر روش‌ها</option>
                  </select>
                </div>
              </div>

              {/* Tracking Code */}
              <div>
                <label className="block text-slate-300 mb-1 font-medium">شماره پیگیری / کد رهگیری</label>
                <input
                  type="text"
                  value={payTrackingCode}
                  onChange={(e) => setPayTrackingCode(e.target.value)}
                  placeholder="کد پیگیری تراکنش"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white font-mono focus:border-amber-400 focus:outline-hidden"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-slate-300 mb-1 font-medium">توضیحات</label>
                <textarea
                  rows={2}
                  value={payDescription}
                  onChange={(e) => setPayDescription(e.target.value)}
                  placeholder="توضیحات پرداخت..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white focus:border-amber-400 focus:outline-hidden"
                />
              </div>

              {/* Buttons */}
              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowPayModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={savingPayment}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-bold transition-all shadow-md disabled:opacity-50"
                >
                  {savingPayment ? (
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

      {/* Print Document Modal */}
      {printData && (
        <PrintDocumentModal
          isOpen={Boolean(printData)}
          title={`چاپ فاکتور ${printData.invoice_number || ''}`}
          type="invoice"
          data={printData}
          onClose={() => setPrintData(null)}
        />
      )}
      <InvoiceFormModal open={showNewInvoice} onClose={() => setShowNewInvoice(false)} onSaved={() => { setShowNewInvoice(false); loadInvoices(); }} />
      <PaymentFormModal open={showNewPayment} onClose={() => setShowNewPayment(false)} onSaved={() => { setShowNewPayment(false); loadInvoices(); }} />
    </div>
  );
};
