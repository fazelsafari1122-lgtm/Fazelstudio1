import React, { useState } from 'react';
import { FileText, Plus, Trash2 } from './icons.tsx';
import { studio } from '../services/studioApi.ts';
import { useAsync, useMeta, notifyDataChanged, errMsg } from '../hooks.ts';
import { Btn, Card, Field, PageHeader, StatCard, StatusBadge, inputCls, moneyT } from './ui/Common.tsx';
import { DataTable } from './ui/DataTable.tsx';
import { Modal } from './ui/Modal.tsx';
import { PersianDatePicker } from './ui/PersianDatePicker.tsx';
import { CustomerSelector } from './ui/CustomerSelector.tsx';
import { useUi } from './ui/UiProvider.tsx';
import { toPersianDigits, getTodayJalali } from '../utils/jalali.ts';

const STATUSES = ['دریافت شده', 'در انتظار وصول', 'وصول شده', 'برگشتی'];

export const ChequesView: React.FC = () => {
  const ui = useUi();
  const meta = useMeta();
  const [status, setStatus] = useState('');
  const { data, loading, error, reload } = useAsync(() => studio.cheques({ status }), [status]);
  const [open, setOpen] = useState(false);
  const rows = data || [];
  const sum = (s: string) => rows.filter((c) => c.status === s).reduce((t, c) => t + Number(c.amount), 0);

  const change = async (c: any, st: string) => {
    if (st === 'برگشتی' && !(await ui.confirm('با برگشت خوردن چک، مبلغ آن از پرداخت‌های فاکتور کسر و بدهی مشتری دوباره برقرار می‌شود. ادامه می‌دهید؟', { confirmLabel: 'بله، برگشت خورد' }))) return;
    try { await studio.updateCheque(c.id, { status: st }); ui.success(st === 'برگشتی' ? 'چک برگشت خورد و پیگیری ثبت شد' : undefined); notifyDataChanged(); reload(); } catch (e) { ui.error(e); reload(); }
  };
  const remove = async (c: any) => {
    if (!(await ui.confirm(`آیا از حذف چک ${toPersianDigits(c.cheque_number)} مطمئن هستید؟ پرداخت مربوط به آن نیز حذف می‌شود.`))) return;
    try { await studio.deleteCheque(c.id); ui.success('با موفقیت حذف شد'); notifyDataChanged(); reload(); } catch (e) { ui.error(e); }
  };

  return (
    <div>
      <PageHeader title="چک‌ها" subtitle="دریافت، وصول و برگشت چک‌های مشتریان" icon={<FileText className="w-5 h-5" />} actions={<Btn variant="primary" onClick={() => setOpen(true)}><Plus className="w-4 h-4" />ثبت چک جدید</Btn>} />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <StatCard label="دریافت‌شده" value={moneyT(sum('دریافت شده'))} tone="sky" />
        <StatCard label="در انتظار وصول" value={moneyT(sum('در انتظار وصول'))} tone="amber" />
        <StatCard label="وصول‌شده" value={moneyT(sum('وصول شده'))} tone="emerald" />
        <StatCard label="برگشتی" value={moneyT(sum('برگشتی'))} tone="rose" />
      </div>
      <Card>
        <div className="flex gap-2 mb-4">
          <select className={`${inputCls} w-auto`} value={status} onChange={(e) => setStatus(e.target.value)} aria-label="وضعیت"><option value="">همه وضعیت‌ها</option>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select>
        </div>
        <DataTable rows={rows} rowKey={(c) => c.id} loading={loading && !data} error={error} onRetry={reload} onAdd={() => setOpen(true)} exportName="cheques"
          columns={[
            { key: 'num', header: 'شماره چک', value: (c) => c.cheque_number, render: (c) => <span dir="ltr">{toPersianDigits(c.cheque_number)}</span> },
            { key: 'family', header: 'خانواده', value: (c) => c.customer_last, render: (c) => `خانواده ${c.customer_last}` },
            { key: 'bank', header: 'بانک', value: (c) => c.bank || '' },
            { key: 'due', header: 'سررسید', value: (c) => c.due_date, render: (c) => <span className={c.overdue ? 'text-rose-300' : ''}>{toPersianDigits(c.due_date)}{c.overdue ? ' (گذشته)' : ''}</span> },
            { key: 'amount', header: 'مبلغ', value: (c) => c.amount, render: (c) => moneyT(c.amount) },
            { key: 'status', header: 'وضعیت', value: (c) => c.status, render: (c) => (
              c.status === 'برگشتی' ? <StatusBadge status={c.status} /> : (
                <select className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs" value={c.status} onChange={(e) => change(c, e.target.value)}>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select>
              )) },
            { key: 'act', header: '', noExport: true, render: (c) => <Btn size="sm" variant="ghost" aria-label="حذف" onClick={() => remove(c)}><Trash2 className="w-4 h-4 text-rose-400" /></Btn> },
          ]} />
      </Card>
      <ChequeForm open={open} banks={meta?.lookups?.bank || []} onClose={() => setOpen(false)} onSaved={() => { setOpen(false); reload(); }} />
    </div>
  );
};

const ChequeForm: React.FC<{ open: boolean; banks: string[]; onClose: () => void; onSaved: () => void }> = ({ open, banks, onClose, onSaved }) => {
  const ui = useUi();
  const [f, setF] = useState<any>({ customer_id: null, invoice_id: '', amount: '', cheque_number: '', bank: '', due_date: '', status: 'دریافت شده', notes: '' });
  const [invoices, setInvoices] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  React.useEffect(() => { if (open) { setError(''); setF({ customer_id: null, invoice_id: '', amount: '', cheque_number: '', bank: '', due_date: '', status: 'دریافت شده', notes: '' }); } }, [open]);
  React.useEffect(() => { if (!f.customer_id) { setInvoices([]); return; } studio.family(f.customer_id).then((d) => setInvoices(d.invoices.filter((i: any) => i.status !== 'cancelled' && Number(i.remaining_amount) > 0))).catch(() => setInvoices([])); }, [f.customer_id]);
  if (!open) return null;
  const save = async () => {
    setSaving(true); setError('');
    try { await studio.addCheque({ ...f, invoice_id: f.invoice_id || undefined, payment_date: getTodayJalali() }); ui.success(); notifyDataChanged(); onSaved(); } catch (e) { setError(errMsg(e)); } finally { setSaving(false); }
  };
  return (
    <Modal open onClose={onClose} title="ثبت چک جدید" footer={<><Btn onClick={onClose}>انصراف</Btn><Btn variant="primary" loading={saving} onClick={save}>ثبت</Btn></>}>
      <div className="space-y-3">
        {error && <div className="px-3 py-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm">{error}</div>}
        <Field label="مشتری" required><CustomerSelector value={f.customer_id} onChange={(id) => setF({ ...f, customer_id: id, invoice_id: '' })} /></Field>
        <Field label="فاکتور (اختیاری)">
          <select className={inputCls} value={f.invoice_id} disabled={!f.customer_id} onChange={(e) => { const id = e.target.value; const i = invoices.find((x) => x.id === Number(id)); setF({ ...f, invoice_id: id ? Number(id) : '', amount: i ? String(i.remaining_amount) : f.amount }); }}>
            <option value="">— بدون فاکتور —</option>{invoices.map((i) => <option key={i.id} value={i.id}>{i.invoice_number} — مانده {moneyT(i.remaining_amount)}</option>)}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="شماره چک" required><input className={inputCls} dir="ltr" value={f.cheque_number} onChange={(e) => setF({ ...f, cheque_number: e.target.value })} /></Field>
          <Field label="مبلغ (تومان)" required><input className={inputCls} dir="ltr" inputMode="numeric" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></Field>
          <Field label="بانک"><input list="cheque-banks" className={inputCls} value={f.bank} onChange={(e) => setF({ ...f, bank: e.target.value })} /><datalist id="cheque-banks">{banks.map((b) => <option key={b} value={b} />)}</datalist></Field>
          <Field label="تاریخ سررسید" required><PersianDatePicker value={f.due_date} onChange={(v) => setF({ ...f, due_date: v })} /></Field>
          <Field label="وضعیت"><select className={inputCls} value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>{['دریافت شده', 'در انتظار وصول', 'وصول شده'].map((s) => <option key={s}>{s}</option>)}</select></Field>
          <Field label="توضیحات"><input className={inputCls} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
        </div>
      </div>
    </Modal>
  );
};
