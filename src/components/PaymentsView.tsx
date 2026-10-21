import React, { useState, useEffect } from 'react';
import {
  CreditCard, Plus, Search, CheckCircle, Clock,
  ArrowDownLeft, X, DollarSign, Trash2, AlertCircle,
  Eye, FileText, Calendar, Filter, UserCheck, Check,
  ArrowUpDown, RefreshCw, ChevronRight, User, Heart
} from 'lucide-react';
import { api } from '../services/api.ts';
import type { Payment, Customer, Contract, Invoice } from '../types.ts';
import {
  formatCurrency, toPersianDigits, formatJalaliHuman,
  getTodayJalali, parseFinancialNumber, toEnglishDigits
} from '../utils/jalali.ts';

import { PaymentFormModal } from './PaymentFormModal.tsx';

export const PaymentsView: React.FC = () => {
  const [showFlexPay, setShowFlexPay] = useState(false);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);

  // View tabs: 'contracts' (primary customer/contract list) or 'transactions' (all raw payment records)
  const [activeTab, setActiveTab] = useState<'contracts' | 'transactions'>('contracts');

  // Search & Filtering
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'unpaid' | 'partial' | 'paid'>('all');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');

  // Transaction sorting
  const [sortField, setSortField] = useState<'date' | 'amount' | 'method'>('date');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

  // Detail Modal State (Customer/Contract payment history)
  const [detailContractId, setDetailContractId] = useState<number | null>(null);
  const [detailContract, setDetailContract] = useState<any | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Add Payment Modal State
  const [showPayModal, setShowPayModal] = useState(false);
  const [targetContract, setTargetContract] = useState<Contract | null>(null);
  const [payFormData, setPayFormData] = useState({
    customer_id: '',
    contract_id: '',
    amount: '',
    payment_date: getTodayJalali(),
    payment_method: 'کارت',
    tracking_code: '',
    receiver_name: 'مدیریت استودیو',
    description: ''
  });
  const [savingPayment, setSavingPayment] = useState(false);
  const [payError, setPayError] = useState('');
  const [successToast, setSuccessToast] = useState('');

  const loadAllData = async () => {
    try {
      setLoading(true);
      const [cts, pymts, custs] = await Promise.all([
        api.getContracts(),
        api.getPayments(),
        api.getCustomers()
      ]);
      setContracts(cts);
      setPayments(pymts);
      setCustomers(custs);

      // If detail modal is open, reload detail contract data
      if (detailContractId) {
        loadDetailContract(detailContractId);
      }
    } catch (err) {
      console.error('Error loading payments data:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadDetailContract = async (id: number) => {
    try {
      setLoadingDetail(true);
      const res = await api.getContract(id);
      setDetailContract(res);
    } catch (err) {
      console.error('Error loading contract detail:', err);
    } finally {
      setLoadingDetail(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  const openDetailModal = (contract: Contract) => {
    setDetailContractId(contract.id);
    loadDetailContract(contract.id);
  };

  const closeDetailModal = () => {
    setDetailContractId(null);
    setDetailContract(null);
  };

  const openAddPaymentModal = (contract?: Contract) => {
    setPayError('');
    if (contract) {
      setTargetContract(contract);
      setPayFormData({
        customer_id: String(contract.customer_id),
        contract_id: String(contract.id),
        amount: '',
        payment_date: getTodayJalali(), // Automatically current date
        payment_method: 'کارت',
        tracking_code: '',
        receiver_name: 'مدیریت استودیو',
        description: ''
      });
    } else {
      setTargetContract(null);
      setPayFormData({
        customer_id: customers.length > 0 ? String(customers[0].id) : '',
        contract_id: '',
        amount: '',
        payment_date: getTodayJalali(),
        payment_method: 'کارت',
        tracking_code: '',
        receiver_name: 'مدیریت استودیو',
        description: ''
      });
    }
    setShowPayModal(true);
  };

  const handlePayCustomerChange = (cid: string) => {
    setPayFormData(prev => ({
      ...prev,
      customer_id: cid,
      contract_id: ''
    }));
    setTargetContract(null);
  };

  const handlePayContractChange = (ctId: string) => {
    const found = contracts.find(c => c.id === Number(ctId));
    setTargetContract(found || null);
    setPayFormData(prev => ({
      ...prev,
      contract_id: ctId
    }));
  };

  const handleAddPaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPayError('');

    const cleanAmount = parseFinancialNumber(payFormData.amount);
    if (cleanAmount <= 0) {
      setPayError('مبلغ پرداختی باید بیشتر از صفر باشد.');
      return;
    }

    if (!payFormData.customer_id) {
      setPayError('انتخاب مشتری الزامی است.');
      return;
    }

    const linkedContract = targetContract || contracts.find(c => c.id === Number(payFormData.contract_id));
    if (linkedContract && cleanAmount > linkedContract.remaining_amount) {
      setPayError('مبلغ پرداختی نمیتواند بیشتر از مانده قرارداد باشد.');
      return;
    }

    try {
      setSavingPayment(true);
      await api.createPayment({
        customer_id: Number(payFormData.customer_id),
        contract_id: payFormData.contract_id ? Number(payFormData.contract_id) : null,
        amount: cleanAmount,
        payment_date: payFormData.payment_date || getTodayJalali(),
        payment_method: payFormData.payment_method,
        tracking_code: payFormData.tracking_code ? toEnglishDigits(payFormData.tracking_code) : undefined,
        receiver_name: payFormData.receiver_name || 'مدیریت استودیو',
        description: payFormData.description || undefined
      });

      setShowPayModal(false);
      setSuccessToast('پرداخت با موفقیت ثبت شد.');
      setTimeout(() => setSuccessToast(''), 4000);

      // Refresh all views immediately
      await loadAllData();
    } catch (err: any) {
      setPayError(err.message || 'خطا در ثبت پرداخت');
    } finally {
      setSavingPayment(false);
    }
  };

  const handleDeletePayment = async (paymentId: number, payNumber: string) => {
    if (!window.confirm(`آیا از حذف تراکنش دریافتی ${payNumber} اطمینان دارید؟ با حذف این سند، مبالغ پرداختی و مانده حساب به طور خودکار بازگشت داده می‌شوند.`)) {
      return;
    }
    try {
      await api.deletePayment(paymentId);
      setSuccessToast('تراکنش با موفقیت حذف شد و مانده حساب‌ها بروزرسانی گردید.');
      setTimeout(() => setSuccessToast(''), 4000);
      await loadAllData();
    } catch (err: any) {
      alert(err.message || 'خطا در حذف تراکنش');
    }
  };

  // Helper for contract payment status
  const getContractPaymentStatus = (ct: Contract): { label: string; color: string; bg: string } => {
    const paid = Number(ct.paid_amount || 0);
    const rem = Number(ct.remaining_amount ?? (ct.final_amount - paid));

    if (rem <= 0 && ct.final_amount > 0) {
      return { label: 'تسویه شده', color: 'text-emerald-400', bg: 'bg-emerald-500/15 border-emerald-500/30' };
    }
    if (paid > 0) {
      return { label: 'پرداخت ناقص', color: 'text-amber-400', bg: 'bg-amber-500/15 border-amber-500/30' };
    }
    return { label: 'پرداخت نشده', color: 'text-rose-400', bg: 'bg-rose-500/15 border-rose-500/30' };
  };

  // Financial aggregates
  const totalContractFinal = contracts.reduce((acc, c) => acc + (c.final_amount || 0), 0);
  const totalPaidSum = contracts.reduce((acc, c) => acc + (c.paid_amount || 0), 0);
  const totalRemainingDebt = contracts.reduce((acc, c) => acc + (c.remaining_amount || 0), 0);

  const fullyPaidCount = contracts.filter(c => (c.remaining_amount || 0) === 0 && (c.final_amount || 0) > 0).length;
  const partialPaidCount = contracts.filter(c => (c.paid_amount || 0) > 0 && (c.remaining_amount || 0) > 0).length;
  const unpaidCount = contracts.filter(c => (c.paid_amount || 0) === 0).length;

  // Filtered contracts list
  const filteredContracts = contracts.filter(ct => {
    const search = searchTerm.toLowerCase().trim();
    const customerName = `${ct.first_name || ''} ${ct.last_name || ''}`.toLowerCase();
    const brideName = `${ct.bride_first || ''} ${ct.bride_last || ''}`.toLowerCase();
    const groomName = `${ct.groom_first || ''} ${ct.groom_last || ''}`.toLowerCase();
    const phone = (ct.phone || '').toLowerCase();
    const contractNum = (ct.contract_number || '').toLowerCase();
    const invoiceNum = (ct.invoice_number || '').toLowerCase();

    const matchesSearch = !search ||
      customerName.includes(search) ||
      brideName.includes(search) ||
      groomName.includes(search) ||
      phone.includes(search) ||
      contractNum.includes(search) ||
      invoiceNum.includes(search);

    if (!matchesSearch) return false;

    // Status filter
    const status = getContractPaymentStatus(ct).label;
    if (statusFilter === 'paid' && status !== 'تسویه شده') return false;
    if (statusFilter === 'partial' && status !== 'پرداخت ناقص') return false;
    if (statusFilter === 'unpaid' && status !== 'پرداخت نشده') return false;

    // Date filter on contract_date
    if (dateFilter !== 'all') {
      const today = getTodayJalali();
      if (dateFilter === 'today' && ct.contract_date !== today) return false;
      if (dateFilter === 'month') {
        const ctMonth = ct.contract_date?.slice(0, 7);
        const curMonth = today.slice(0, 7);
        if (ctMonth !== curMonth) return false;
      }
    }

    return true;
  });

  // Filtered & sorted raw payments list
  const filteredPayments = payments.filter(p => {
    const search = searchTerm.toLowerCase().trim();
    const customerName = `${p.first_name || ''} ${p.last_name || ''}`.toLowerCase();
    const brideName = `${p.bride_first || ''} ${p.bride_last || ''}`.toLowerCase();
    const groomName = `${p.groom_first || ''} ${p.groom_last || ''}`.toLowerCase();
    const phone = (p.phone || '').toLowerCase();
    const contractNum = (p.contract_number || '').toLowerCase();
    const invoiceNum = (p.invoice_number || '').toLowerCase();
    const payNum = (p.payment_number || '').toLowerCase();
    const tracking = (p.tracking_code || '').toLowerCase();

    const matchesSearch = !search ||
      customerName.includes(search) ||
      brideName.includes(search) ||
      groomName.includes(search) ||
      phone.includes(search) ||
      contractNum.includes(search) ||
      invoiceNum.includes(search) ||
      payNum.includes(search) ||
      tracking.includes(search);

    if (!matchesSearch) return false;

    if (dateFilter !== 'all') {
      const today = getTodayJalali();
      if (dateFilter === 'today' && p.payment_date !== today) return false;
      if (dateFilter === 'month') {
        const pMonth = p.payment_date?.slice(0, 7);
        const curMonth = today.slice(0, 7);
        if (pMonth !== curMonth) return false;
      }
    }

    return true;
  }).sort((a, b) => {
    if (sortField === 'date') {
      const cmp = (a.payment_date || '').localeCompare(b.payment_date || '');
      return sortOrder === 'desc' ? -cmp : cmp;
    }
    if (sortField === 'amount') {
      return sortOrder === 'desc' ? (b.amount - a.amount) : (a.amount - b.amount);
    }
    if (sortField === 'method') {
      const cmp = (a.payment_method || '').localeCompare(b.payment_method || '');
      return sortOrder === 'desc' ? -cmp : cmp;
    }
    return 0;
  });

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
            <CreditCard className="w-5 h-5 text-amber-400" />
            مدیریت دریافت‌ها و تسویه حساب قراردادها
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            ردیابی دقیق واریزی‌ها، مبالغ نهایی، مانده بدهی مشتریان و تاریخچه تراکنش‌ها
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => loadAllData()}
            className="p-2 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white rounded-xl text-xs transition-colors"
            title="بروزرسانی داده‌ها"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-amber-400' : ''}`} />
          </button>
          <button
            onClick={() => setShowFlexPay(true)}
            className="px-3 py-2 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-200 rounded-xl text-xs font-medium"
            title="پرداخت فاکتور، چک یا علی‌الحساب"
          >
            پرداخت فاکتور / چک
          </button>
          <button
            onClick={() => openAddPaymentModal()}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-bold text-xs transition-all shadow-md"
          >
            <Plus className="w-4 h-4" />
            <span>ثبت پرداخت جدید</span>
          </button>
        </div>
      </div>

      {/* Top Financial Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/15 text-blue-400 flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs text-slate-400">مجموع ارزش نهایی قراردادها</span>
              <div className="text-lg font-black text-white">{formatCurrency(totalContractFinal)}</div>
            </div>
          </div>
          <div className="text-left text-[11px] text-slate-400">
            {toPersianDigits(contracts.length)} قرارداد
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
              <ArrowDownLeft className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs text-slate-400">کل دریافتی‌های تایید شده</span>
              <div className="text-lg font-black text-emerald-400">{formatCurrency(totalPaidSum)}</div>
            </div>
          </div>
          <div className="text-left text-[11px] text-emerald-400 font-bold">
            {toPersianDigits(payments.length)} تراکنش
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs text-slate-400">کل مانده مطالبات (تسویه‌نشده)</span>
              <div className="text-lg font-black text-amber-400">{formatCurrency(totalRemainingDebt)}</div>
            </div>
          </div>
          <div className="text-left text-[11px] text-slate-400">
            {toPersianDigits(unpaidCount + partialPaidCount)} قرارداد با مانده
          </div>
        </div>
      </div>

      {/* Tabs & Controls */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-slate-900 p-3 rounded-2xl border border-slate-800">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setActiveTab('contracts')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
              activeTab === 'contracts'
                ? 'bg-amber-400 text-slate-950 shadow-xs'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>لیست مشتریان و قراردادها ({toPersianDigits(contracts.length)})</span>
          </button>
          <button
            onClick={() => setActiveTab('transactions')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
              activeTab === 'transactions'
                ? 'bg-amber-400 text-slate-950 shadow-xs'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <CreditCard className="w-3.5 h-3.5" />
            <span>دفتر ریز واریزی‌ها ({toPersianDigits(payments.length)})</span>
          </button>
        </div>

        {/* Search Input */}
        <div className="flex-1 max-w-md relative">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="جستجو در نام مشتری، عروس، داماد، تلفن، قرارداد، فاکتور..."
            className="w-full bg-slate-950 border border-slate-800 focus:border-amber-400 rounded-xl pr-9 pl-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-hidden"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filter Badges */}
        <div className="flex items-center gap-2 flex-wrap text-xs">
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-2.5 py-1 rounded-lg ${statusFilter === 'all' ? 'bg-slate-800 text-white font-bold' : 'text-slate-400 hover:text-white'}`}
            >
              همه
            </button>
            <button
              onClick={() => setStatusFilter('unpaid')}
              className={`px-2.5 py-1 rounded-lg ${statusFilter === 'unpaid' ? 'bg-rose-500/20 text-rose-300 font-bold' : 'text-slate-400 hover:text-white'}`}
            >
              پرداخت نشده
            </button>
            <button
              onClick={() => setStatusFilter('partial')}
              className={`px-2.5 py-1 rounded-lg ${statusFilter === 'partial' ? 'bg-amber-500/20 text-amber-300 font-bold' : 'text-slate-400 hover:text-white'}`}
            >
              پرداخت ناقص
            </button>
            <button
              onClick={() => setStatusFilter('paid')}
              className={`px-2.5 py-1 rounded-lg ${statusFilter === 'paid' ? 'bg-emerald-500/20 text-emerald-300 font-bold' : 'text-slate-400 hover:text-white'}`}
            >
              تسویه شده
            </button>
          </div>

          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setDateFilter('all')}
              className={`px-2 py-1 rounded-lg ${dateFilter === 'all' ? 'bg-slate-800 text-white font-bold' : 'text-slate-400 hover:text-white'}`}
            >
              همه تاریخ‌ها
            </button>
            <button
              onClick={() => setDateFilter('today')}
              className={`px-2 py-1 rounded-lg ${dateFilter === 'today' ? 'bg-slate-800 text-amber-300 font-bold' : 'text-slate-400 hover:text-white'}`}
            >
              امروز
            </button>
            <button
              onClick={() => setDateFilter('month')}
              className={`px-2 py-1 rounded-lg ${dateFilter === 'month' ? 'bg-slate-800 text-amber-300 font-bold' : 'text-slate-400 hover:text-white'}`}
            >
              این ماه
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {activeTab === 'contracts' ? (
        /* ====================================================
           1. CONTRACT / CUSTOMER PAYMENT LIST (Primary View)
           ==================================================== */
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-md">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="p-3.5">مشتری</th>
                  <th className="p-3.5">عروس و داماد</th>
                  <th className="p-3.5">قرارداد</th>
                  <th className="p-3.5">شماره فاکتور</th>
                  <th className="p-3.5">تاریخ قرارداد</th>
                  <th className="p-3.5 text-left">مبلغ کل</th>
                  <th className="p-3.5 text-left">تخفیف</th>
                  <th className="p-3.5 text-left">مبلغ نهایی</th>
                  <th className="p-3.5 text-left">پرداخت شده</th>
                  <th className="p-3.5 text-left">مانده</th>
                  <th className="p-3.5 text-center">وضعیت</th>
                  <th className="p-3.5 text-center w-36">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-200">
                {filteredContracts.map((ct) => {
                  const statusInfo = getContractPaymentStatus(ct);
                  const hasBrideGroom = (ct.bride_first || ct.bride_last) || (ct.groom_first || ct.groom_last);

                  return (
                    <tr
                      key={ct.id}
                      className="hover:bg-slate-800/40 transition-colors"
                    >
                      {/* Customer */}
                      <td className="p-3.5">
                        <strong className="text-white block font-medium">
                          {ct.first_name} {ct.last_name}
                        </strong>
                        <span className="text-slate-400 text-[11px] font-mono">
                          {toPersianDigits(ct.phone)}
                        </span>
                      </td>

                      {/* Bride and Groom */}
                      <td className="p-3.5 text-slate-300">
                        {hasBrideGroom ? (
                          <div className="space-y-0.5 text-[11px]">
                            {(ct.bride_first || ct.bride_last) && (
                              <div className="flex items-center gap-1 text-pink-300">
                                <span className="text-slate-500">عروس:</span>
                                <span>{ct.bride_first} {ct.bride_last}</span>
                              </div>
                            )}
                            {(ct.groom_first || ct.groom_last) && (
                              <div className="flex items-center gap-1 text-sky-300">
                                <span className="text-slate-500">داماد:</span>
                                <span>{ct.groom_first} {ct.groom_last}</span>
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-500">-</span>
                        )}
                      </td>

                      {/* Contract Number & Title */}
                      <td className="p-3.5">
                        <span className="text-amber-400 font-bold font-mono block">
                          {ct.contract_number}
                        </span>
                        <span className="text-slate-400 text-[11px] truncate max-w-[140px] block">
                          {ct.title || 'قرارداد خدمات استودیو'}
                        </span>
                      </td>

                      {/* Invoice Number */}
                      <td className="p-3.5 font-mono text-slate-300">
                        {ct.invoice_number ? (
                          <span className="px-2 py-0.5 rounded bg-slate-800/80 text-amber-300 text-[11px]">
                            {ct.invoice_number}
                          </span>
                        ) : (
                          <span className="text-slate-500 text-[11px]">صادر نشده</span>
                        )}
                      </td>

                      {/* Contract Date */}
                      <td className="p-3.5 text-slate-300 whitespace-nowrap">
                        {formatJalaliHuman(ct.contract_date)}
                      </td>

                      {/* Total Amount (Subtotal) */}
                      <td className="p-3.5 text-left text-slate-300 font-medium">
                        {formatCurrency(ct.total_amount || ct.final_amount)}
                      </td>

                      {/* Discount */}
                      <td className="p-3.5 text-left text-slate-400">
                        {(ct.discount_amount || 0) > 0 ? (
                          <span className="text-rose-400">-{formatCurrency(ct.discount_amount)}</span>
                        ) : (
                          '۰'
                        )}
                      </td>

                      {/* Final Amount */}
                      <td className="p-3.5 text-left font-bold text-white">
                        {formatCurrency(ct.final_amount)}
                      </td>

                      {/* Paid Amount */}
                      <td className="p-3.5 text-left font-bold text-emerald-400">
                        {formatCurrency(ct.paid_amount || 0)}
                      </td>

                      {/* Remaining Amount */}
                      <td className="p-3.5 text-left font-bold">
                        {(ct.remaining_amount || 0) > 0 ? (
                          <span className="text-amber-400">{formatCurrency(ct.remaining_amount)}</span>
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
                            onClick={() => openDetailModal(ct)}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white transition-colors text-[11px] font-medium"
                            title="مشاهده جزئیات و تاریخچه پرداخت‌ها"
                          >
                            <Eye className="w-3.5 h-3.5 text-amber-400" />
                            <span>مشاهده</span>
                          </button>
                          <button
                            onClick={() => openAddPaymentModal(ct)}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 transition-colors text-[11px] font-bold border border-amber-500/30"
                            title="ثبت واریزی جدید بابت این قرارداد"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>ثبت پرداخت</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {filteredContracts.length === 0 && (
                  <tr>
                    <td colSpan={12} className="p-10 text-center text-slate-500">
                      قراردادی با این مشخصات یافت نشد.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* ====================================================
           2. RAW TRANSACTIONS LOG VIEW (All separate payments)
           ==================================================== */
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-md">
          <div className="p-3 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <span>مرتب‌سازی بر اساس:</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  if (sortField === 'date') setSortOrder(o => o === 'desc' ? 'asc' : 'desc');
                  else { setSortField('date'); setSortOrder('desc'); }
                }}
                className={`px-2.5 py-1 rounded-lg border ${sortField === 'date' ? 'border-amber-500 text-amber-300 bg-amber-500/10 font-bold' : 'border-slate-800 text-slate-400'}`}
              >
                تاریخ {sortField === 'date' && (sortOrder === 'desc' ? '↓' : '↑')}
              </button>
              <button
                onClick={() => {
                  if (sortField === 'amount') setSortOrder(o => o === 'desc' ? 'asc' : 'desc');
                  else { setSortField('amount'); setSortOrder('desc'); }
                }}
                className={`px-2.5 py-1 rounded-lg border ${sortField === 'amount' ? 'border-amber-500 text-amber-300 bg-amber-500/10 font-bold' : 'border-slate-800 text-slate-400'}`}
              >
                مبلغ {sortField === 'amount' && (sortOrder === 'desc' ? '↓' : '↑')}
              </button>
              <button
                onClick={() => {
                  if (sortField === 'method') setSortOrder(o => o === 'desc' ? 'asc' : 'desc');
                  else { setSortField('method'); setSortOrder('desc'); }
                }}
                className={`px-2.5 py-1 rounded-lg border ${sortField === 'method' ? 'border-amber-500 text-amber-300 bg-amber-500/10 font-bold' : 'border-slate-800 text-slate-400'}`}
              >
                روش {sortField === 'method' && (sortOrder === 'desc' ? '↓' : '↑')}
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="p-3.5">رسید / شناسه</th>
                  <th className="p-3.5">مشتری</th>
                  <th className="p-3.5">عروس و داماد</th>
                  <th className="p-3.5">شماره قرارداد</th>
                  <th className="p-3.5">شماره فاکتور</th>
                  <th className="p-3.5 text-left">مبلغ پرداختی</th>
                  <th className="p-3.5">روش پرداخت</th>
                  <th className="p-3.5">شماره پیگیری</th>
                  <th className="p-3.5">تاریخ ثبت</th>
                  <th className="p-3.5">توضیحات</th>
                  <th className="p-3.5 text-center w-16">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-200">
                {filteredPayments.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="p-3.5 font-mono text-amber-400 font-bold">{p.payment_number}</td>
                    <td className="p-3.5">
                      <strong className="text-white block">{p.first_name} {p.last_name}</strong>
                      <span className="text-slate-400 text-[11px] font-mono">{toPersianDigits(p.phone)}</span>
                    </td>
                    <td className="p-3.5 text-[11px] text-slate-300">
                      {p.bride_first || p.groom_first ? (
                        <span>{p.bride_first} / {p.groom_first}</span>
                      ) : '-'}
                    </td>
                    <td className="p-3.5 text-amber-400 font-mono font-medium">
                      {p.contract_number || '-'}
                    </td>
                    <td className="p-3.5 text-slate-300 font-mono">
                      {p.invoice_number || '-'}
                    </td>
                    <td className="p-3.5 text-left font-bold text-emerald-400 text-sm">
                      {formatCurrency(p.amount)}
                    </td>
                    <td className="p-3.5 text-slate-300">
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[11px]">
                        {p.payment_method}
                      </span>
                    </td>
                    <td className="p-3.5 font-mono text-slate-300">
                      {p.tracking_code ? toPersianDigits(p.tracking_code) : '-'}
                    </td>
                    <td className="p-3.5 text-slate-300 whitespace-nowrap">
                      {formatJalaliHuman(p.payment_date)}
                    </td>
                    <td className="p-3.5 text-slate-400 text-[11px] max-w-xs truncate">
                      {p.description || '-'}
                    </td>
                    <td className="p-3.5 text-center">
                      <button
                        onClick={() => handleDeletePayment(p.id, p.payment_number)}
                        className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors"
                        title="حذف تراکنش"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}

                {filteredPayments.length === 0 && (
                  <tr>
                    <td colSpan={11} className="p-10 text-center text-slate-500">
                      تراکنشی یافت نشد.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ====================================================
         3. DETAIL MODAL: Customer/Contract Payment History
         ==================================================== */}
      {detailContractId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-3xl max-h-[90vh] shadow-2xl overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-amber-400" />
                <div>
                  <h3 className="text-sm font-bold text-white">
                    جزئیات قرارداد و پرونده مالی: {detailContract?.contract?.contract_number || 'در حال بارگذاری...'}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    مشتری: {detailContract?.contract?.first_name} {detailContract?.contract?.last_name}
                  </p>
                </div>
              </div>
              <button
                onClick={closeDetailModal}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs">
              {loadingDetail || !detailContract ? (
                <div className="py-12 text-center text-slate-400 flex flex-col items-center gap-2">
                  <div className="w-6 h-6 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
                  <span>در حال دریافت سوابق مالی...</span>
                </div>
              ) : (
                <>
                  {/* Basic & Couple Info Box */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-950 p-4 rounded-xl border border-slate-800">
                    <div>
                      <span className="text-slate-500 block text-[11px]">مشتری طرف قرارداد:</span>
                      <strong className="text-white text-xs block">
                        {detailContract.contract.first_name} {detailContract.contract.last_name}
                      </strong>
                      <span className="text-slate-400 text-[11px] font-mono">{toPersianDigits(detailContract.contract.phone)}</span>
                    </div>

                    <div>
                      <span className="text-slate-500 block text-[11px]">عروس:</span>
                      <strong className="text-pink-300 text-xs block">
                        {detailContract.contract.bride_first || '-'} {detailContract.contract.bride_last || ''}
                      </strong>
                      {detailContract.contract.bride_phone && (
                        <span className="text-slate-400 text-[11px] font-mono">{toPersianDigits(detailContract.contract.bride_phone)}</span>
                      )}
                    </div>

                    <div>
                      <span className="text-slate-500 block text-[11px]">داماد:</span>
                      <strong className="text-sky-300 text-xs block">
                        {detailContract.contract.groom_first || '-'} {detailContract.contract.groom_last || ''}
                      </strong>
                      {detailContract.contract.groom_phone && (
                        <span className="text-slate-400 text-[11px] font-mono">{toPersianDigits(detailContract.contract.groom_phone)}</span>
                      )}
                    </div>

                    <div>
                      <span className="text-slate-500 block text-[11px]">تاریخ قرارداد:</span>
                      <strong className="text-slate-200 text-xs block">
                        {formatJalaliHuman(detailContract.contract.contract_date)}
                      </strong>
                      <span className="text-slate-400 text-[11px]">
                        فاکتور: {detailContract.contract.invoice_number || 'ندارد'}
                      </span>
                    </div>
                  </div>

                  {/* Financial Overview Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                    <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-center">
                      <span className="text-slate-500 text-[11px] block">مبلغ کل قرارداد</span>
                      <strong className="text-slate-200 font-bold block mt-1">
                        {formatCurrency(detailContract.contract.total_amount || detailContract.contract.final_amount)}
                      </strong>
                    </div>

                    <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-center">
                      <span className="text-slate-500 text-[11px] block">مبلغ تخفیف</span>
                      <strong className="text-rose-400 font-bold block mt-1">
                        {formatCurrency(detailContract.contract.discount_amount || 0)}
                      </strong>
                    </div>

                    <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-center">
                      <span className="text-slate-500 text-[11px] block">مبلغ نهایی</span>
                      <strong className="text-white font-bold block mt-1">
                        {formatCurrency(detailContract.contract.final_amount)}
                      </strong>
                    </div>

                    <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-center">
                      <span className="text-slate-500 text-[11px] block">مجموع پرداخت‌ها</span>
                      <strong className="text-emerald-400 font-bold block mt-1">
                        {formatCurrency(detailContract.contract.paid_amount || 0)}
                      </strong>
                    </div>

                    <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-center col-span-2 sm:col-span-1">
                      <span className="text-slate-500 text-[11px] block">مانده بدهی</span>
                      <strong className={`font-bold block mt-1 ${detailContract.contract.remaining_amount > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                        {formatCurrency(detailContract.contract.remaining_amount || 0)}
                      </strong>
                    </div>
                  </div>

                  {/* Payment History List Header */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                    <div className="flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-amber-400" />
                      <h4 className="font-bold text-white text-xs">
                        ریز تراکنش‌های پرداختی این قرارداد ({toPersianDigits(detailContract.payments?.length || 0)} سند)
                      </h4>
                    </div>

                    <button
                      onClick={() => {
                        openAddPaymentModal(detailContract.contract);
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs shadow-xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>ثبت پرداخت جدید</span>
                    </button>
                  </div>

                  {/* Payment History Table / Cards */}
                  <div className="space-y-2">
                    {detailContract.payments && detailContract.payments.length > 0 ? (
                      detailContract.payments.map((p: any, idx: number) => (
                        <div
                          key={p.id}
                          className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-slate-700 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <span className="w-6 h-6 rounded-full bg-slate-800 text-amber-400 font-bold text-[11px] flex items-center justify-center">
                              {toPersianDigits(detailContract.payments.length - idx)}
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
                                  <span>کد رهگیری: <strong className="text-slate-200 font-mono">{toPersianDigits(p.tracking_code)}</strong></span>
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

                          <button
                            onClick={() => handleDeletePayment(p.id, p.payment_number)}
                            className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors self-end sm:self-center"
                            title="حذف این پرداخت و بازگشت مانده"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))
                    ) : (
                      <div className="p-8 text-center bg-slate-950/60 rounded-xl border border-dashed border-slate-800 text-slate-500">
                        تاکنون پرداختی برای این قرارداد ثبت نشده است. با کلیک بر روی دکمه «ثبت پرداخت جدید» اولین دریافتی را ثبت کنید.
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 border-t border-slate-800 bg-slate-950 flex justify-end">
              <button
                onClick={closeDetailModal}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-medium text-xs"
              >
                بستن
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================
         4. ADD PAYMENT MODAL (Fast & Validated)
         ==================================================== */}
      {showPayModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-amber-400" />
                ثبت دریافت وجه و تسویه حساب قرارداد
              </h3>
              <button
                onClick={() => setShowPayModal(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleAddPaymentSubmit} className="p-6 space-y-4 text-xs">
              {payError && (
                <div className="p-3 bg-rose-500/15 border border-rose-500/30 rounded-xl text-rose-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{payError}</span>
                </div>
              )}

              {/* Customer Selection */}
              <div>
                <label className="block text-slate-300 mb-1 font-medium">مشتری طرف حساب *</label>
                <select
                  value={payFormData.customer_id}
                  onChange={(e) => handlePayCustomerChange(e.target.value)}
                  disabled={!!targetContract}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white focus:border-amber-400 focus:outline-hidden disabled:opacity-60"
                >
                  <option value="">انتخاب مشتری...</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.first_name} {c.last_name} ({toPersianDigits(c.phone)})
                    </option>
                  ))}
                </select>
              </div>

              {/* Contract Selection */}
              <div>
                <label className="block text-slate-300 mb-1 font-medium">قرارداد مربوطه *</label>
                <select
                  value={payFormData.contract_id}
                  onChange={(e) => handlePayContractChange(e.target.value)}
                  disabled={!!targetContract}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white focus:border-amber-400 focus:outline-hidden disabled:opacity-60"
                >
                  <option value="">انتخاب قرارداد...</option>
                  {contracts
                    .filter(c => !payFormData.customer_id || c.customer_id === Number(payFormData.customer_id))
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.contract_number} — {c.title} (مانده: {formatCurrency(c.remaining_amount)})
                      </option>
                    ))}
                </select>
              </div>

              {/* Contract Balance Info Banner */}
              {targetContract && (
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1.5">
                  <div className="flex justify-between text-slate-400">
                    <span>مبلغ نهایی قرارداد:</span>
                    <span className="text-white font-bold">{formatCurrency(targetContract.final_amount)}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>مجموع پرداخت شده تاکنون:</span>
                    <span className="text-emerald-400 font-bold">{formatCurrency(targetContract.paid_amount || 0)}</span>
                  </div>
                  <div className="flex justify-between text-slate-400 pt-1 border-t border-slate-800">
                    <span>مانده تسویه‌نشده:</span>
                    <span className="text-amber-400 font-black">{formatCurrency(targetContract.remaining_amount || 0)}</span>
                  </div>
                </div>
              )}

              {/* Amount */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-slate-300 font-medium">مبلغ پرداختی (تومان) *</label>
                  {targetContract && (targetContract.remaining_amount || 0) > 0 && (
                    <button
                      type="button"
                      onClick={() => setPayFormData(prev => ({ ...prev, amount: String(targetContract.remaining_amount) }))}
                      className="text-[11px] text-amber-400 hover:text-amber-300 font-bold underline"
                    >
                      تسویه کل مانده ({formatCurrency(targetContract.remaining_amount)})
                    </button>
                  )}
                </div>
                <div className="relative">
                  <input
                    type="text"
                    value={payFormData.amount}
                    onChange={(e) => setPayFormData(prev => ({ ...prev, amount: e.target.value }))}
                    placeholder="مثال: ۱۰,۰۰۰,۰۰۰"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white font-mono focus:border-amber-400 focus:outline-hidden"
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">تومان</span>
                </div>
                {payFormData.amount && (
                  <span className="block mt-1 text-[11px] text-slate-400">
                    معادل: {formatCurrency(parseFinancialNumber(payFormData.amount))}
                  </span>
                )}
              </div>

              {/* Payment Date & Method */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">تاریخ پرداخت (شمسی) *</label>
                  <input
                    type="text"
                    value={payFormData.payment_date}
                    onChange={(e) => setPayFormData(prev => ({ ...prev, payment_date: e.target.value }))}
                    placeholder="۱۴۰۳/۰۶/۳۰"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white font-mono focus:border-amber-400 focus:outline-hidden"
                  />
                  <span className="block mt-0.5 text-[10px] text-emerald-400">پیش‌فرض: تاریخ و زمان جاری</span>
                </div>

                <div>
                  <label className="block text-slate-300 mb-1 font-medium">روش پرداخت *</label>
                  <select
                    value={payFormData.payment_method}
                    onChange={(e) => setPayFormData(prev => ({ ...prev, payment_method: e.target.value as any }))}
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

              {/* Tracking Code & Receiver */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">شماره پیگیری / ارجاع</label>
                  <input
                    type="text"
                    value={payFormData.tracking_code}
                    onChange={(e) => setPayFormData(prev => ({ ...prev, tracking_code: e.target.value }))}
                    placeholder="کد پیگیری تراکنش"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white font-mono focus:border-amber-400 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 mb-1 font-medium">دریافت‌کننده</label>
                  <input
                    type="text"
                    value={payFormData.receiver_name}
                    onChange={(e) => setPayFormData(prev => ({ ...prev, receiver_name: e.target.value }))}
                    placeholder="مدیریت استودیو"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white focus:border-amber-400 focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-slate-300 mb-1 font-medium">بابت / توضیحات سند</label>
                <textarea
                  rows={2}
                  value={payFormData.description}
                  onChange={(e) => setPayFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="مثال: بیعانه عقد قرارداد عکاسی فرمالیته و عروسی..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white focus:border-amber-400 focus:outline-hidden"
                />
              </div>

              {/* Form Buttons */}
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
                      <span>ثبت نهایی پرداخت</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      <PaymentFormModal open={showFlexPay} onClose={() => setShowFlexPay(false)} onSaved={() => { setShowFlexPay(false); loadAllData(); }} />
    </div>
  );
};
