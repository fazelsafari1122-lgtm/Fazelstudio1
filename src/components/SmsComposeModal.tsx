import React, { useEffect, useMemo, useState } from 'react';
import { Modal } from './ui/Modal.tsx';
import { Btn, Field, inputCls } from './ui/Common.tsx';
import { PersianDatePicker } from './ui/PersianDatePicker.tsx';
import { TimePicker } from './ui/TimePicker.tsx';
import { CustomerSelector } from './ui/CustomerSelector.tsx';
import { useUi } from './ui/UiProvider.tsx';
import { studio } from '../services/studioApi.ts';
import { errMsg, notifyDataChanged } from '../hooks.ts';
import { toPersianDigits } from '../utils/jalali.ts';

export const SMS_VARS = ['نام', 'نام_خانوادگی', 'تاریخ', 'ساعت', 'مبلغ', 'مانده', 'لینک'];

/** Replaces {{var}} for the live preview. Unknown values stay visible so the user notices them. */
export function previewSms(text: string, vars: Record<string, string>) {
  return text.replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (m, k) => (vars[k] ? vars[k] : m));
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSent: () => void;
  defaults?: { customer_id?: number; phone?: string };
}

export const SmsComposeModal: React.FC<Props> = ({ open, onClose, onSent, defaults }) => {
  const ui = useUi();
  const [templates, setTemplates] = useState<any[]>([]);
  const [f, setF] = useState<any>(null);
  const [family, setFamily] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    studio.smsTemplates().then(setTemplates).catch(() => setTemplates([]));
    setF({ customer_id: defaults?.customer_id || null, phone: defaults?.phone || '', template_id: '', message_body: '', variables: { 'ساعت': '', 'مبلغ': '', 'لینک': '' }, schedule: false, scheduled_date: '', scheduled_time: '10:00' });
  }, [open, defaults?.customer_id, defaults?.phone]);

  useEffect(() => {
    if (!f?.customer_id) { setFamily(null); return; }
    studio.family(f.customer_id).then((d) => { setFamily(d); setF((x: any) => (x && !x.phone ? { ...x, phone: d.family.phone } : x)); }).catch(() => setFamily(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f?.customer_id]);

  const set = (k: string, v: any) => setF((x: any) => ({ ...x, [k]: v }));
  const preview = useMemo(() => {
    if (!f) return '';
    const vars: Record<string, string> = { ...f.variables };
    if (family) { vars['نام'] = family.family.first_name; vars['نام_خانوادگی'] = family.family.family_name; vars['مانده'] = `${toPersianDigits(Number(family.summary.debt).toLocaleString('en-US'))} تومان`; }
    return previewSms(f.message_body, vars);
  }, [f, family]);

  const pickTemplate = (id: string) => {
    const t = templates.find((x) => x.id === Number(id));
    setF((x: any) => ({ ...x, template_id: id, message_body: t ? t.content : x.message_body }));
  };

  const send = async (queueOnly: boolean) => {
    setError(''); setSaving(true);
    try {
      const payload: any = { customer_id: f.customer_id, phone: f.phone, template_id: f.template_id || undefined, message_body: f.message_body, variables: Object.fromEntries(Object.entries(f.variables).filter(([, v]) => v)), queue_only: queueOnly || f.schedule };
      if (f.schedule) { payload.scheduled_date = f.scheduled_date; payload.scheduled_time = f.scheduled_time; }
      await studio.sendSms(payload);
      ui.success(queueOnly || f.schedule ? 'پیامک در صف ارسال قرار گرفت' : 'پیامک با موفقیت ارسال شد');
      notifyDataChanged();
      onSent();
    } catch (e) { setError(errMsg(e)); } finally { setSaving(false); }
  };

  return (
    <Modal open={open} onClose={onClose} size="lg" title="ارسال پیامک"
      footer={<><Btn onClick={onClose}>انصراف</Btn><Btn loading={saving} disabled={!f} onClick={() => send(true)}>افزودن به صف</Btn><Btn variant="primary" loading={saving} disabled={!f || f.schedule} onClick={() => send(false)}>ارسال</Btn></>}>
      {!f ? null : (
        <div className="space-y-3">
          {error && <div className="px-3 py-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm">{error}</div>}
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="مشتری"><CustomerSelector value={f.customer_id} onChange={(id, fam) => setF({ ...f, customer_id: id, phone: fam?.phone || f.phone })} /></Field>
            <Field label="شماره گیرنده" required><input className={inputCls} dir="ltr" inputMode="tel" placeholder="09121234567" value={f.phone} onChange={(e) => set('phone', e.target.value)} /></Field>
          </div>
          <Field label="قالب پیامک">
            <select className={inputCls} value={f.template_id} onChange={(e) => pickTemplate(e.target.value)}>
              <option value="">— بدون قالب —</option>
              {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </Field>
          <Field label="متن پیام" required>
            <textarea className={`${inputCls} min-h-[100px]`} value={f.message_body} onChange={(e) => set('message_body', e.target.value)} />
            <div className="flex flex-wrap gap-1.5 mt-2">
              {SMS_VARS.map((v) => <button key={v} type="button" onClick={() => set('message_body', `${f.message_body}{{${v}}}`)} className="px-2 py-0.5 rounded-lg text-[11px] bg-slate-800 text-amber-300 hover:bg-slate-700" dir="ltr">{`{{${v}}}`}</button>)}
            </div>
          </Field>
          {/\{\{\s*(ساعت|مبلغ|لینک)\s*\}\}/.test(f.message_body) && (
            <div className="grid grid-cols-3 gap-2">
              {['ساعت', 'مبلغ', 'لینک'].filter((k) => new RegExp(`\\{\\{\\s*${k}\\s*\\}\\}`).test(f.message_body)).map((k) => (
                <Field key={k} label={`مقدار ${k}`}><input className={inputCls} value={f.variables[k]} onChange={(e) => set('variables', { ...f.variables, [k]: e.target.value })} /></Field>
              ))}
            </div>
          )}
          {f.message_body && <div className="rounded-xl bg-slate-950/70 border border-slate-800 p-3 text-sm text-slate-200 leading-7"><div className="text-[11px] text-slate-500 mb-1">پیش‌نمایش</div>{toPersianDigits(preview)}</div>}
          <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer"><input type="checkbox" className="accent-amber-500 w-4 h-4" checked={f.schedule} onChange={(e) => set('schedule', e.target.checked)} />زمان‌بندی ارسال</label>
          {f.schedule && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="تاریخ ارسال"><PersianDatePicker value={f.scheduled_date} onChange={(v) => set('scheduled_date', v)} /></Field>
              <Field label="ساعت ارسال"><TimePicker value={f.scheduled_time} onChange={(v) => set('scheduled_time', v)} step={5} /></Field>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
};
