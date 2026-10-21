import React, { useState, useEffect } from 'react';
import {
  FileText, Plus, Search, Eye, Printer, CheckCircle,
  Clock, AlertTriangle, X, Trash2, ShieldCheck, ChevronRight
} from 'lucide-react';
import { api } from '../services/api.ts';
import type { Contract, Customer, Wedding, Service, Equipment } from '../types.ts';
import { formatCurrency, toPersianDigits, formatJalaliHuman, getTodayJalali } from '../utils/jalali.ts';
import { PrintDocumentModal } from './PrintDocumentModal.tsx';

interface ContractsViewProps {
  openAddSignal?: number;
}

export const ContractsView: React.FC<ContractsViewProps> = ({ openAddSignal }) => {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [weddings, setWeddings] = useState<Wedding[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [equipmentList, setEquipmentList] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(false);

  // Print modal
  const [printData, setPrintData] = useState<any>(null);

  // New Contract Wizard Modal
  const [showWizard, setShowWizard] = useState(false);

  useEffect(() => {
    if (openAddSignal && openAddSignal > 0) {
      setStep(1);
      setShowWizard(true);
    }
  }, [openAddSignal]);
  const [step, setStep] = useState(1);

  // Form State
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | ''>('');
  const [selectedWeddingId, setSelectedWeddingId] = useState<number | ''>('');
  const [contractTitle, setContractTitle] = useState('پکیج پوشش سینمایی جشن عروسی و فرمالیته');
  const [contractDate, setContractDate] = useState(getTodayJalali());

  // Selected Items (Services + Equipment)
  const [selectedItems, setSelectedItems] = useState<any[]>([]);
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [initialPayment, setInitialPayment] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<'کارت' | 'نقدی' | 'انتقال بانکی' | 'چک'>('کارت');

  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      const [cList, custs, weds, sList, eqData] = await Promise.all([
        api.getContracts(),
        api.getCustomers(),
        api.getWeddings(),
        api.getServices(),
        api.getEquipment()
      ]);
      setContracts(cList);
      setCustomers(custs);
      setWeddings(weds);
      setServices(sList);
      setEquipmentList(eqData.equipment);
      if (custs.length > 0 && !selectedCustomerId) {
        setSelectedCustomerId(custs[0].id);
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

  const totalBeforeDiscount = selectedItems.reduce((acc, it) => acc + (it.unit_price * it.quantity), 0);
  const finalAmount = Math.max(0, totalBeforeDiscount - discountAmount);

  const addItem = (item: Service | Equipment, type: 'service' | 'equipment') => {
    const unitPrice = type === 'service' ? (item as Service).price : (item as Equipment).daily_rental_price;
    const existing = selectedItems.find(i => i.item_id === item.id && i.item_type === type);
    if (existing) {
      setSelectedItems(selectedItems.map(i =>
        i === existing ? { ...i, quantity: i.quantity + 1, total_price: (i.quantity + 1) * unitPrice } : i
      ));
    } else {
      setSelectedItems([
        ...selectedItems,
        {
          item_type: type,
          item_id: item.id,
          name: item.name,
          quantity: 1,
          unit_price: unitPrice,
          total_price: unitPrice
        }
      ]);
    }
  };

  const removeItem = (idx: number) => {
    setSelectedItems(selectedItems.filter((_, i) => i !== idx));
  };

  const handleCreateContract = async (isDraft = false) => {
    if (!selectedCustomerId) {
      setErrorMsg('لطفاً مشتری را انتخاب کنید.');
      return;
    }
    if (selectedItems.length === 0) {
      setErrorMsg('حداقل یک خدمت یا تجهیز باید به قرارداد اضافه شود.');
      return;
    }

    try {
      setSaving(true);
      setErrorMsg('');
      const res = await api.createContract({
        customer_id: Number(selectedCustomerId),
        wedding_id: selectedWeddingId ? Number(selectedWeddingId) : null,
        title: contractTitle,
        contract_date: contractDate,
        total_amount: totalBeforeDiscount,
        discount_amount: discountAmount,
        final_amount: finalAmount,
        items: selectedItems,
        initial_payment: Number(initialPayment) || 0,
        payment_method: paymentMethod,
        terms_text: 'کلیه حقوق مادی و معنوی اثر متعلق به استودیو ود و کارفرما می‌باشد. تحویل راش‌ها پس از تسویه نهایی صورت می‌پذیرد.',
        status: isDraft ? 'پیشنویس' : 'ثبت شده'
      });

      setShowWizard(false);
      resetForm();
      loadData();
      if (!isDraft) {
        // Open print view
        const createdContract = await api.getContract(res.id);
        setPrintData(createdContract);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'خطا در ثبت قرارداد');
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setSelectedItems([]);
    setDiscountAmount(0);
    setInitialPayment(0);
    setStep(1);
  };

  const openPrint = async (contractId: number) => {
    try {
      const full = await api.getContract(contractId);
      setPrintData(full);
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateStatus = async (id: number, status: string) => {
    try {
      await api.updateContractStatus(id, status);
      loadData();
    } catch (err: any) {
      alert(err.message || 'خطا در تغییر وضعیت');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-amber-400" />
            قراردادهای رسمی استودیو WED
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            جریان کامل ثبت قرارداد، فاکتور متناظر، تثبیت تعرفه تاریخی و چاپ استاندارد A4
          </p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowWizard(true);
          }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-bold text-xs transition-all shadow-xs"
        >
          <Plus className="w-4 h-4" />
          <span>انعقاد قرارداد جدید</span>
        </button>
      </div>

      {/* Contracts Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
              <tr>
                <th className="p-3.5">شماره و عنوان قرارداد</th>
                <th className="p-3.5">مشتری / طرف قرارداد</th>
                <th className="p-3.5">تاریخ عقد</th>
                <th className="p-3.5 text-left">مبلغ نهایی</th>
                <th className="p-3.5 text-left">مانده حساب</th>
                <th className="p-3.5 text-center">وضعیت</th>
                <th className="p-3.5 text-center">عملیات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-200">
              {contracts.map((c) => (
                <tr key={c.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="p-3.5">
                    <strong className="text-white block">{c.contract_number}</strong>
                    <span className="text-slate-400 text-[11px]">{c.title}</span>
                  </td>
                  <td className="p-3.5">
                    <span className="font-bold text-white block">
                      {c.first_name} {c.last_name}
                    </span>
                    <span className="text-slate-400 text-[11px]">{toPersianDigits(c.phone)}</span>
                  </td>
                  <td className="p-3.5 text-slate-300">{formatJalaliHuman(c.contract_date)}</td>
                  <td className="p-3.5 text-left font-bold text-white">{formatCurrency(c.final_amount)}</td>
                  <td className="p-3.5 text-left">
                    {c.remaining_amount > 0 ? (
                      <span className="text-amber-400 font-bold">{formatCurrency(c.remaining_amount)}</span>
                    ) : (
                      <span className="text-emerald-400 text-[11px]">تسویه کامل</span>
                    )}
                  </td>
                  <td className="p-3.5 text-center">
                    <select
                      value={c.status}
                      onChange={(e) => handleUpdateStatus(c.id, e.target.value)}
                      className={`text-[11px] font-bold px-2 py-1 rounded-lg border focus:outline-none ${
                        c.status === 'فعال' || c.status === 'ثبت شده'
                          ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                          : c.status === 'تکمیل شده'
                          ? 'bg-blue-500/15 text-blue-400 border-blue-500/30'
                          : c.status === 'لغو شده'
                          ? 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                          : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                      }`}
                    >
                      <option value="پیشنویس">پیشنویس</option>
                      <option value="در انتظار تأیید">در انتظار تأیید</option>
                      <option value="ثبت شده">ثبت شده</option>
                      <option value="فعال">فعال</option>
                      <option value="تکمیل شده">تکمیل شده</option>
                      <option value="لغو شده">لغو شده</option>
                    </select>
                  </td>
                  <td className="p-3.5 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        onClick={() => openPrint(c.id)}
                        className="p-1.5 text-slate-400 hover:text-amber-400 rounded-md hover:bg-slate-800"
                        title="مشاهده و چاپ A4"
                      >
                        <Printer className="w-4 h-4" />
                      </button>
                      {c.status === 'پیشنویس' && (
                        <button
                          onClick={() => {
                            // Logic to open wizard and populate it with contract data
                            console.log('Edit draft', c.id);
                            // This would require a full implementation of populating form state
                          }}
                          className="p-1.5 text-slate-400 hover:text-blue-400 rounded-md hover:bg-slate-800"
                          title="ویرایش پیش‌نویس"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}

              {contracts.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500">
                    قراردادی ثبت نشده است.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Contract Creation Modal (Wizard Workflow) */}
      {showWizard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-4xl max-h-[92vh] shadow-2xl overflow-hidden flex flex-col">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-bold text-white">انعقاد قرارداد جدید (مرحله {toPersianDigits(step)} از ۲)</h3>
              </div>
              <button onClick={() => setShowWizard(false)} className="p-1 text-slate-400 hover:text-white rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Wizard Body */}
            <div className="p-6 overflow-y-auto flex-1 text-xs space-y-5">
              {errorMsg && (
                <div className="p-3 bg-rose-500/15 border border-rose-500/30 rounded-xl text-rose-300">
                  {errorMsg}
                </div>
              )}

              {step === 1 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-slate-300 mb-1">انتخاب کارفرما / مشتری CRM *</label>
                      <select
                        value={selectedCustomerId}
                        onChange={(e) => setSelectedCustomerId(Number(e.target.value))}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white focus:border-amber-500"
                      >
                        {customers.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.first_name} {c.last_name} ({c.phone})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-300 mb-1">انتخاب پرونده مراسم جشن (اختیاری)</label>
                      <select
                        value={selectedWeddingId}
                        onChange={(e) => setSelectedWeddingId(e.target.value ? Number(e.target.value) : '')}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white focus:border-amber-500"
                      >
                        <option value="">بدون انتساب به جشن مشخص</option>
                        {weddings.map((w) => (
                          <option key={w.id} value={w.id}>
                            جشن عروسی ({formatJalaliHuman(w.wedding_date)}) - {w.venue_name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-slate-300 mb-1">عنوان پکیج / قرارداد *</label>
                      <input
                        type="text"
                        value={contractTitle}
                        onChange={(e) => setContractTitle(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-300 mb-1">تاریخ انعقاد قرارداد (شمسی)</label>
                      <input
                        type="text"
                        value={contractDate}
                        onChange={(e) => setContractDate(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white"
                      />
                    </div>
                  </div>

                  {/* Add Services & Equipment to Contract */}
                  <div className="pt-3 border-t border-slate-800">
                    <h4 className="font-bold text-white mb-2 flex items-center justify-between">
                      <span>انتخاب خدمات و آیتم‌های پکیج:</span>
                      <span className="text-amber-400 font-normal">تعرفه‌ها در زمان عقد قرارداد تثبیت می‌شوند</span>
                    </h4>

                    {/* Quick Pick Services */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
                      {services.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => addItem(s, 'service')}
                          className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-amber-500/50 text-right transition-colors"
                        >
                          <div className="font-bold text-slate-200 truncate">{s.name}</div>
                          <div className="text-[11px] text-amber-400 mt-0.5">{formatCurrency(s.price)}</div>
                        </button>
                      ))}
                    </div>

                    {/* Selected items table */}
                    <div className="border border-slate-800 rounded-xl overflow-hidden">
                      <table className="w-full text-right">
                        <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                          <tr>
                            <th className="p-2.5">شرح</th>
                            <th className="p-2.5 text-center w-20">تعداد</th>
                            <th className="p-2.5 text-left">مبلغ واحد</th>
                            <th className="p-2.5 text-left">مجموع</th>
                            <th className="p-2.5 text-center w-12">حذف</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                          {selectedItems.map((it, idx) => (
                            <tr key={idx}>
                              <td className="p-2.5 font-medium text-white">{it.name}</td>
                              <td className="p-2.5 text-center">
                                <input
                                  type="number"
                                  min={1}
                                  value={it.quantity}
                                  onChange={(e) => {
                                    const q = Number(e.target.value) || 1;
                                    setSelectedItems(selectedItems.map((item, i) =>
                                      i === idx ? { ...item, quantity: q, total_price: q * item.unit_price } : item
                                    ));
                                  }}
                                  className="w-12 bg-slate-950 border border-slate-700 text-center rounded p-1 text-white"
                                />
                              </td>
                              <td className="p-2.5 text-left">{formatCurrency(it.unit_price)}</td>
                              <td className="p-2.5 text-left font-bold text-amber-400">{formatCurrency(it.total_price)}</td>
                              <td className="p-2.5 text-center">
                                <button
                                  type="button"
                                  onClick={() => removeItem(idx)}
                                  className="text-slate-400 hover:text-rose-400"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          ))}
                          {selectedItems.length === 0 && (
                            <tr>
                              <td colSpan={5} className="p-4 text-center text-slate-500">
                                هنوز خدمتی انتخاب نشده است.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-4">
                  <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-3">
                    <h4 className="font-bold text-white border-b border-slate-800 pb-2">خلاصه مالی قرارداد</h4>
                    <div className="flex justify-between text-slate-300">
                      <span>جمع ناخالص خدمات:</span>
                      <span className="font-bold text-white">{formatCurrency(totalBeforeDiscount)}</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-300">مبلغ تخفیف توافقی:</span>
                      <div className="w-48">
                        <input
                          type="number"
                          value={discountAmount}
                          onChange={(e) => setDiscountAmount(Number(e.target.value) || 0)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-rose-400 text-left font-bold"
                          placeholder="0"
                        />
                      </div>
                    </div>

                    <div className="flex justify-between text-base font-bold text-amber-400 border-t border-slate-800 pt-2">
                      <span>مبلغ نهایی قرارداد:</span>
                      <span>{formatCurrency(finalAmount)}</span>
                    </div>
                  </div>

                  {/* Advance Payment (پیش‌پرداخت) */}
                  <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-3">
                    <h4 className="font-bold text-white">پیش‌پرداخت اولیه در زمان امضا</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-slate-300 mb-1">مبلغ پرداختی بیعانه (تومان)</label>
                        <input
                          type="number"
                          value={initialPayment}
                          onChange={(e) => setInitialPayment(Number(e.target.value) || 0)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-emerald-400 font-bold"
                          placeholder="مثال: 15000000"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-300 mb-1">روش پرداخت</label>
                        <select
                          value={paymentMethod}
                          onChange={(e) => setPaymentMethod(e.target.value as any)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white"
                        >
                          <option value="کارت">پوز / کارت‌خوان</option>
                          <option value="انتقال بانکی">انتقال بانکی / پایا / ساتنا</option>
                          <option value="نقدی">وجه نقد</option>
                          <option value="چک">چک صیادی</option>
                        </select>
                      </div>
                    </div>
                    <div className="text-[11px] text-slate-400">
                      مانده نهایی پس از بیعانه: <strong className="text-amber-400">{formatCurrency(Math.max(0, finalAmount - initialPayment))}</strong>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-800 bg-slate-950 flex justify-between items-center">
              {step === 1 ? (
                <div></div>
              ) : (
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs"
                >
                  بازگشت به انتخاب آیتم‌ها
                </button>
              )}

              {step === 1 ? (
                <button
                  type="button"
                  onClick={() => {
                    if (selectedItems.length === 0) {
                      setErrorMsg('لطفاً حداقل یک خدمت را انتخاب کنید.');
                      return;
                    }
                    setErrorMsg('');
                    setStep(2);
                  }}
                  className="px-5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs"
                >
                  ادامه به مرحله مالی و بیعانه &larr;
                </button>
              ) : (
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => handleCreateContract(true)}
                    className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-bold text-xs"
                  >
                    {saving ? 'در حال ذخیره...' : 'ذخیره به عنوان پیش‌نویس'}
                  </button>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => handleCreateContract(false)}
                    className="px-6 py-2 rounded-lg bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-bold text-xs"
                  >
                    {saving ? 'در حال صدور...' : 'تأیید و صدور نهایی قرارداد'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Print Document Modal */}
      <PrintDocumentModal
        isOpen={Boolean(printData)}
        onClose={() => setPrintData(null)}
        title={`قرارداد شماره ${printData?.contract_number || ''}`}
        type="contract"
        data={printData}
      />
    </div>
  );
};
