import React, { useEffect, useState } from 'react';
import { Modal } from './ui/Modal.tsx';
import { Btn, Field, inputCls, moneyT } from './ui/Common.tsx';
import { PersianDatePicker } from './ui/PersianDatePicker.tsx';
import { TimePicker } from './ui/TimePicker.tsx';
import { CustomerSelector } from './ui/CustomerSelector.tsx';
import { useUi } from './ui/UiProvider.tsx';
import { studio } from '../services/studioApi.ts';
import { useMeta, errMsg, notifyDataChanged } from '../hooks.ts';
import { getTodayJalali } from '../utils/jalali.ts';

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  defaults?: { customer_id?: number; invoice_id?: number };
}

const nowHHMM = () => { const d = new Date(); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };

export const PaymentFormModal: React.FC<Props> = ({ open, onClose, onSaved, defaults }) => {
  const ui = useUi();
  const meta = useMeta();
  const [f, setF] = useState<any>(null);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    setF({ customer_id: defaults?.customer_id || null, invoice_id: defaults?.invoice_id || '', amount: '', payment_date: getTodayJalali(), payment_time: nowHHMM(), payment_method: 'نقدی', bank_account: '', tracking_code: '', description: '', cheque: { cheque_number: '', bank: '', due_date: '', status: 'دریافت شده', notes: '' } });
  }, [open, defaults?.customer_id, defaults?.invoice_id]);

  useEffect(() => {
    if (!open || !f?.customer_id) { setInvoices([]); return; }
    studio.family(f.customer_id).then((d) => {
      const open_ = d.invoices.filter((i: any) => i.status !== 'cancelled' && Number(i.remaining_amount) > 0);
      setInvoices(open_);
    }).catch(() => setInvoices([]));
  }, [open, f?.customer_id]);

  const set = (k: string, v: any) => setF((x: any) => ({ ...x, [k]: v }));
  const setCheque = (k: string, v: any) => setF((x: any) => ({ ...x, cheque: { ...x.cheque, [k]: v } }));
  const inv = invoices.find((i) => i.id === Number(f?.invoice_id));

  const save = async () => {
    setError(''); setSaving(true);
    try {
      const payload: any = { ...f, invoice_id: f.invoice_id || undefined };
      if (f.payment_method !== 'چک') delete payload.cheque;
      await studio.addPayment(payload);
      ui.success();
      notifyDataChanged();
      onSaved();
    } catch (e) { setError(errMsg(e)); } finally { setSaving(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title="ثبت پرداخت"
      footer={<><Btn onClick={onClose}>انصراف</Btn><Btn variant="primary" loading={saving} disabled={!f} onClick={save}>ثبت پرداخت</Btn></>}>
      {!f ? null : (
        <div className="space-y-3">
          {error && <div className="px-3 py-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm">{error}</div>}
          <Field label="مشتری" required><CustomerSelector value={f.customer_id} onChange={(id) => setF({ ...f, customer_id: id, invoice_id: '' })} /></Field>
          <Field label="فاکتور" hint={inv ? `مانده فاکتور: ${moneyT(inv.remaining_amount)}` : 'بدون انتخاب فاکتور، پرداخت به‌صورت علی‌الحساب ثبت می‌شود.'}>
            <select className={inputCls} value={f.invoice_id} onChange={(e) => { const id = e.target.value; const i = invoices.find((x) => x.id === Number(id)); setF({ ...f, invoice_id: id ? Number(id) : '', amount: i ? String(i.remaining_amount) : f.amount }); }} disabled={!f.customer_id}>
              <option value="">— بدون فاکتور —</option>
              {invoices.map((i) => <option key={i.id} value={i.id}>{i.invoice_number} — مانده {moneyT(i.remaining_amount)}</option>)}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="مبلغ (تومان)" required><input className={inputCls} dir="ltr" inputMode="numeric" value={f.amount} onChange={(e) => set('amount', e.target.value)} /></Field>
            <Field label="روش پرداخت" required>
              <select className={inputCls} value={f.payment_method} onChange={(e) => set('payment_method', e.target.value)}>
                {(meta?.lookups?.payment_method || ['نقدی', 'چک']).map((m: string) => <option key={m}>{m}</option>)}
              </select>
            </Field>
            <Field label="تاریخ"><PersianDatePicker value={f.payment_date} onChange={(v) => set('payment_date', v)} /></Field>
            <Field label="ساعت"><TimePicker value={f.payment_time} onChange={(v) => set('payment_time', v)} step={5} /></Field>
            <Field label="بانک / صندوق">
              <select className={inputCls} value={f.bank_account} onChange={(e) => set('bank_account', e.target.value)}>
                <option value="">—</option>{(meta?.lookups?.bank || []).map((b: string) => <option key={b}>{b}</option>)}
              </select>
            </Field>
            <Field label="شماره پیگیری"><input className={inputCls} dir="ltr" value={f.tracking_code} onChange={(e) => set('tracking_code', e.target.value)} /></Field>
          </div>
          {f.payment_method === 'چک' && (
            <div className="grid grid-cols-2 gap-3 border border-slate-800 rounded-2xl p-3">
              <Field label="شماره چک" required><input className={inputCls} dir="ltr" value={f.cheque.cheque_number} onChange={(e) => setCheque('cheque_number', e.target.value)} /></Field>
              <Field label="بانک"><input className={inputCls} value={f.cheque.bank} onChange={(e) => setCheque('bank', e.target.value)} /></Field>
              <Field label="تاریخ سررسید" required><PersianDatePicker value={f.cheque.due_date} onChange={(v) => setCheque('due_date', v)} /></Field>
              <Field label="وضعیت چک">
                <select className={inputCls} value={f.cheque.status} onChange={(e) => setCheque('status', e.target.value)}>{['دریافت شده', 'در انتظار وصول', 'وصول شده'].map((s) => <option key={s}>{s}</option>)}</select>
              </Field>
            </div>
          )}
          <Field label="توضیحات"><input className={inputCls} value={f.description} onChange={(e) => set('description', e.target.value)} /></Field>
        </div>
      )}
    </Modal>
  );
};
