import React, { useState, useEffect } from 'react';
import {
  MessageSquare, Send, MailCheck, CheckCircle, Clock,
  AlertTriangle, Plus, Users, Sparkles, X
} from 'lucide-react';
import { api } from '../services/api.ts';
import type { SMSTemplate, SMSMessage, Customer } from '../types.ts';
import { formatCurrency, toPersianDigits, formatJalaliHuman } from '../utils/jalali.ts';

export const SMSView: React.FC = () => {
  const [templates, setTemplates] = useState<SMSTemplate[]>([]);
  const [logs, setLogs] = useState<SMSMessage[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);

  // Send State
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [phoneInput, setPhoneInput] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | ''>('');
  const [messageBody, setMessageBody] = useState('');
  const [sending, setSending] = useState(false);
  const [sendSuccess, setSendSuccess] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [smsData, cList] = await Promise.all([
        api.getSMSTemplates(),
        api.getCustomers()
      ]);
      setTemplates(smsData.templates);
      setLogs(smsData.logs);
      setCustomers(cList);
      if (smsData.templates.length > 0 && !selectedTemplateId) {
        setSelectedTemplateId(smsData.templates[0].id);
        setMessageBody(smsData.templates[0].content);
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

  const handleTemplateChange = (tId: number) => {
    setSelectedTemplateId(tId);
    const tmpl = templates.find(t => t.id === tId);
    if (tmpl) {
      setMessageBody(tmpl.content);
    }
  };

  const handleCustomerSelect = (cId: string) => {
    setSelectedCustomerId(cId);
    const cust = customers.find(c => c.id === Number(cId));
    if (cust) {
      setPhoneInput(cust.phone);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneInput || !messageBody) return;
    try {
      setSending(true);
      setSendSuccess(null);
      await api.sendSMS({
        customer_id: selectedCustomerId ? Number(selectedCustomerId) : undefined,
        phone: phoneInput,
        template_id: selectedTemplateId ? Number(selectedTemplateId) : undefined,
        message_body: messageBody
      });
      setSendSuccess('پیامک با موفقیت در صف ارسال مخابراتی قرار گرفت.');
      loadData();
    } catch (err: any) {
      alert(err.message || 'خطا در ارسال پیامک');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-amber-400" />
            سامانه پیامکی هوشمند و اطلاع‌رسانی استودیو WED
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            ارسال خودکار پیامک‌های تأیید قرارداد، یادآوری اقساط، تبریک مراسم و آماده بودن فیلم‌ها
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Send Box (5 cols) */}
        <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
          <h2 className="text-sm font-bold text-white flex items-center gap-2 pb-3 border-b border-slate-800">
            <Send className="w-4 h-4 text-amber-400" />
            ارسال پیامک جدید با متغیرهای هوشمند
          </h2>

          {sendSuccess && (
            <div className="p-3 bg-emerald-500/15 border border-emerald-500/30 rounded-xl text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              <span>{sendSuccess}</span>
            </div>
          )}

          <form onSubmit={handleSend} className="space-y-3.5 text-xs">
            <div>
              <label className="block text-slate-300 mb-1">انتخاب مخاطب از پرونده‌های CRM</label>
              <select
                value={selectedCustomerId}
                onChange={(e) => handleCustomerSelect(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white focus:border-amber-500"
              >
                <option value="">انتخاب مستقیم از CRM...</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.first_name} {c.last_name} ({toPersianDigits(c.phone)})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-300 mb-1">شماره گیرنده *</label>
              <input
                type="text"
                required
                dir="ltr"
                value={phoneInput}
                onChange={(e) => setPhoneInput(e.target.value)}
                placeholder="09121234567"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white font-mono text-left"
              />
            </div>

            <div>
              <label className="block text-slate-300 mb-1">قالب آماده پیامک (الگوهای پیش‌فرض)</label>
              <select
                value={selectedTemplateId}
                onChange={(e) => handleTemplateChange(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white"
              >
                {templates.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-slate-300">متن پیامک *</label>
                <span className="text-[10px] text-slate-500">
                  {toPersianDigits(messageBody.length)} کاراکتر
                </span>
              </div>
              <textarea
                rows={5}
                required
                value={messageBody}
                onChange={(e) => setMessageBody(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white leading-relaxed focus:border-amber-500 focus:outline-none"
              />
            </div>

            {/* Variable Tags */}
            <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800 text-[11px] text-slate-400 space-y-1.5">
              <span className="font-semibold text-slate-300 block">متغیرهای در دسترس:</span>
              <div className="flex flex-wrap gap-1.5">
                {['{نام_عروس}', '{نام_داماد}', '{مبلغ_قرارداد}', '{مانده}', '{تاریخ_مراسم}'].map((v) => (
                  <button
                    type="button"
                    key={v}
                    onClick={() => setMessageBody(prev => `${prev} ${v}`)}
                    className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700"
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={sending}
              className="w-full py-2.5 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-xs"
            >
              <Send className="w-4 h-4" />
              <span>{sending ? 'در حال مخابره...' : 'ارسال پیامک فوری'}</span>
            </button>
          </form>
        </div>

        {/* History / Logs (7 cols) */}
        <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <MailCheck className="w-4 h-4 text-emerald-400" />
              تاریخچه و گزارش تحویل پیامک‌های استودیو
            </h2>
            <span className="text-xs text-slate-400">{toPersianDigits(logs.length)} پیامک ارسالی</span>
          </div>

          <div className="space-y-3 max-h-[550px] overflow-y-auto">
            {logs.map((lg) => (
              <div
                key={lg.id}
                className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 space-y-2 text-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white">
                    {lg.first_name ? `${lg.first_name} ${lg.last_name}` : 'مخاطب آزاد'} ({toPersianDigits(lg.phone)})
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                    تحویل شده
                  </span>
                </div>

                <p className="text-slate-300 text-[11px] leading-relaxed bg-slate-900/60 p-2 rounded-lg border border-slate-800/80">
                  {lg.message_body}
                </p>

                <div className="text-right text-[10px] text-slate-500">
                  ارسال در: {formatJalaliHuman(lg.sent_at)}
                </div>
              </div>
            ))}

            {logs.length === 0 && (
              <div className="text-center py-16 text-slate-500 text-xs">
                هنوز پیامکی ارسال نشده است.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
