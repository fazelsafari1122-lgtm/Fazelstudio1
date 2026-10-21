import React from 'react';
import { Printer, X, Download } from 'lucide-react';
import { formatCurrency, toPersianDigits, formatJalaliHuman, getTodayJalali } from '../utils/jalali.ts';

interface PrintDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  type: 'contract' | 'invoice' | 'report';
  data: any;
}

export const PrintDocumentModal: React.FC<PrintDocumentModalProps> = ({
  isOpen,
  onClose,
  title,
  type,
  data
}) => {
  if (!isOpen || !data) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950 no-print">
          <div className="flex items-center gap-2.5">
            <Printer className="w-5 h-5 text-amber-400" />
            <h3 className="text-base font-bold text-white">{title}</h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg text-xs font-bold transition-all shadow-xs"
            >
              <Printer className="w-4 h-4" />
              <span>چاپ / ذخیره PDF</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Area (A4 page format) */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-slate-950/50">
          <div id="printable-a4-document" className="print-page bg-white text-slate-900 p-8 rounded-xl shadow-xl max-w-[210mm] mx-auto border border-slate-200">
            {/* New Header Design */}
            <div className="border-b-2 border-slate-900 pb-4 mb-6 text-center">
              {/* Top Row: Right: Case No, Left: Date */}
              <div className="flex justify-between text-xs text-slate-700 mb-4">
                <div><strong>شماره پرونده:</strong> {toPersianDigits(data.contract_number || data.id || '۱۰۱')}</div>
                <div><strong>تاریخ روز:</strong> {formatJalaliHuman(getTodayJalali())}</div>
              </div>

              {/* Middle Large Title */}
              <h1 className="text-2xl font-black text-slate-950 mb-2">استودیو تخصصی عروس و داماد وِد | studio WED</h1>

              {/* Address & Contact */}
              <div className="text-xs text-slate-600">
                <p>آدرس: فارس ، لامرد ، میدان امام ، مجتمع شهر افتاب ، طبقه منفی یک ، استودیو ود</p>
                <p className="mt-1">شماره تماس: {toPersianDigits('09172647787')}</p>
              </div>
            </div>

            {/* Document Title */}
            <div className="text-center my-6">
              <h2 className="text-lg font-bold text-slate-900 border-b border-slate-300 pb-2 inline-block px-8">
                قرارداد و فاکتور خدمات
              </h2>
            </div>

            {/* Parties info */}
            <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-lg border border-slate-200 text-xs mb-6">
              <div>
                <p className="font-bold text-slate-800 mb-1">طرف اول (مجری):</p>
                <p>مدیریت آتلیه و استودیو عروسی STUDIO WED</p>
                <p>نماینده رسمی: مدیریت اجرایی استودیو</p>
              </div>
              <div>
                <p className="font-bold text-slate-800 mb-1">طرف دوم (کارفرما / عروس و داماد):</p>
                <p>مشتری: {data.first_name || data.customer_first || ''} {data.last_name || data.customer_last || ''}</p>
                {data.bride_first && <p>عروس: {data.bride_first} {data.bride_last} | داماد: {data.groom_first} {data.groom_last}</p>}
                <p>شماره تماس: {toPersianDigits(data.phone || data.customer_phone || '-')}</p>
                {data.national_id && <p>کد ملی: {toPersianDigits(data.national_id)}</p>}
              </div>
            </div>

            {/* Ceremony details if available */}
            {data.wedding_date && (
              <div className="bg-amber-50/50 p-3.5 rounded-lg border border-amber-200/60 text-xs mb-6 grid grid-cols-3 gap-2">
                <div><strong>تاریخ مراسم:</strong> {formatJalaliHuman(data.wedding_date)}</div>
                <div><strong>محل مراسم:</strong> {data.venue_name || 'اعلام می‌گردد'}</div>
                <div><strong>ساعت حضور تیم:</strong> {toPersianDigits(data.team_arrival_time || '۱۲:۳۰')}</div>
              </div>
            )}

            {/* Items Table */}
            {data.items && data.items.length > 0 && (
              <div className="mb-6 overflow-hidden rounded-lg border border-slate-200">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-100 text-slate-800 font-bold border-b border-slate-200">
                    <tr>
                      <th className="p-2.5 w-12 text-center">ردیف</th>
                      <th className="p-2.5">شرح خدمات / پکیج</th>
                      <th className="p-2.5 text-center w-20">تعداد</th>
                      <th className="p-2.5 text-left w-32">تعرفه واحد</th>
                      <th className="p-2.5 text-left w-36">مبلغ کل</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.items.map((it: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="p-2.5 text-center text-slate-500">{toPersianDigits(idx + 1)}</td>
                        <td className="p-2.5 font-medium">{it.name}</td>
                        <td className="p-2.5 text-center">{toPersianDigits(it.quantity)}</td>
                        <td className="p-2.5 text-left">{formatCurrency(it.unit_price)}</td>
                        <td className="p-2.5 text-left font-semibold">{formatCurrency(it.total_price)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Totals */}
            <div className="flex justify-end mb-8">
              <div className="w-72 bg-slate-50 p-3.5 rounded-lg border border-slate-200 text-xs space-y-2">
                <div className="flex justify-between text-slate-600">
                  <span>مجموع ناخالص:</span>
                  <span className="font-mono">{formatCurrency(data.total_amount || data.subtotal || data.total, true, true)} تومان</span>
                </div>
                {Number(data.discount_amount || data.discount) > 0 && (
                  <div className="flex justify-between text-rose-600">
                    <span>تخفیف ویژه:</span>
                    <span className="font-mono">- {formatCurrency(data.discount_amount || data.discount, true, true)} تومان</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-slate-900 border-t border-slate-200 pt-2 text-sm">
                  <span>مبلغ نهایی قابل پرداخت:</span>
                  <span className="font-mono">{formatCurrency(data.final_amount || data.total, true, true)} تومان</span>
                </div>
                <div className="flex justify-between text-emerald-700 font-semibold">
                  <span>مجموع دریافتی تاکنون:</span>
                  <span className="font-mono">{formatCurrency(data.paid_amount || 0, true, true)} تومان</span>
                </div>
                <div className="flex justify-between text-amber-700 font-bold border-t border-dashed border-slate-300 pt-1.5">
                  <span>مانده حساب:</span>
                  <span className="font-mono">{formatCurrency(data.remaining_amount || 0, true, true)} تومان</span>
                </div>
              </div>
            </div>

            {/* Financial Summary Section (Syncing with Customer Account) */}
            <div className="mt-8 pt-4 border-t border-slate-300 bg-slate-50 p-4 rounded-lg">
              <h3 className="text-sm font-bold text-slate-800 mb-3 border-b pb-1">گزارش مالی متمرکز (مشتری: {data.first_name || data.customer_first || ''} {data.last_name || data.customer_last || ''})</h3>
              <div className="grid grid-cols-3 gap-4 text-xs">
                <div className="text-center p-2 bg-white rounded border border-slate-200">
                  <p className="text-slate-500 mb-1">مبلغ کل قرارداد</p>
                  <p className="font-mono font-bold text-slate-900">{formatCurrency(data.final_amount || data.total, true, true)}</p>
                </div>
                <div className="text-center p-2 bg-white rounded border border-slate-200">
                  <p className="text-slate-500 mb-1">جمع دریافتی</p>
                  <p className="font-mono font-bold text-emerald-700">{formatCurrency(data.paid_amount || 0, true, true)}</p>
                </div>
                <div className="text-center p-2 bg-white rounded border border-slate-200">
                  <p className="text-slate-500 mb-1">مانده حساب</p>
                  <p className="font-mono font-bold text-amber-700">{formatCurrency(data.remaining_amount || 0, true, true)}</p>
                </div>
              </div>
            </div>

            {/* Terms & Conditions text */}
            {type === 'contract' && (
              <div className="text-[11px] text-slate-600 space-y-2 border-t border-slate-200 pt-4 leading-relaxed">
                <p className="font-bold text-slate-800">شرایط و تعهدات:</p>
                <p>۱. استودیو متعهد است پوشش کامل تصویری را با استاندارد سینمایی و کادر حرفه‌ای انجام دهد.</p>
                <p>۲. کلیه راش‌ها و محتوای خام تا ۳ ماه پس از تحویل نهایی بر روی سرورهای امن استودیو پشتیبان‌گیری خواهد شد.</p>
                <p>۳. تسویه مانده قرارداد پیش از تحویل فایل‌های مستر و آلبوم الزامی می‌باشد.</p>
              </div>
            )}

            {/* Signatures */}
            <div className="grid grid-cols-2 gap-8 mt-12 pt-8 border-t border-slate-300 text-xs text-center">
              <div>
                <p className="font-bold text-slate-800 mb-16">امضاء و اثر انگشت طرف اول (استودیو ود)</p>
                <div className="text-slate-400 text-[11px]">مهر و امضای مجاز</div>
              </div>
              <div>
                <p className="font-bold text-slate-800 mb-16">امضاء و اثر انگشت طرف دوم (عروس و داماد)</p>
                <div className="text-slate-400 text-[11px]">نام و امضاء</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
