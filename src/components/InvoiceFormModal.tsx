import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Modal } from './ui/Modal.tsx';
import { Btn, Field, inputCls, moneyT } from './ui/Common.tsx';
import { PersianDatePicker } from './ui/PersianDatePicker.tsx';
import { CustomerSelector } from './ui/CustomerSelector.tsx';
import { useUi } from './ui/UiProvider.tsx';
import { studio } from '../services/studioApi.ts';
import { useMeta, errMsg, notifyDataChanged } from '../hooks.ts';
import { getTodayJalali, toEnglishDigits } from '../utils/jalali.ts';

const n = (v: any) => Number(toEnglishDigits(String(v ?? '')).replace(/[,\s]/g, '')) || 0;

/** Pure calculation so the screen and the server always agree: subtotal - discount + extras + tax. */
export function calcInvoice(items: { quantity: any; unit_price: any }[], discount: any, extra: any, taxPercent: any) {
  const subtotal = items.reduce((s, i) => s + n(i.quantity) * n(i.unit_price), 0);
  const base = Math.max(0, subtotal - n(discount) + n(extra));
  const tax = Math.round((base * (Number(taxPercent) || 0)) / 100);
  return { subtotal, tax, total: subtotal - n(discount) + n(extra) + tax };
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  invoiceId?: number | null;
  defaults?: { customer_id?: number; project_id?: number };
}

const blankItem = () => ({ name: '', quantity: '1', unit_price: '' });

export const InvoiceFormModal: React.FC<Props> = ({ open, onClose, onSaved, invoiceId, defaults }) => {
  const ui = useUi();
  const meta = useMeta();
  const [f, setF] = useState<any>(null);
  const [projects, setProjects] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    if (!invoiceId) {
      setF({ customer_id: defaults?.customer_id || null, project_id: defaults?.project_id || '', issue_date: getTodayJalali(), due_date: '', items: [blankItem()], discount: '', extra_costs: '', tax_percent: '', notes: '' });
      return;
    }
    setF(null);
    studio.invoice(invoiceId).then((res: any) => {
      const d = { ...res.invoice, items: res.items };
      const subtotal = Number(d.subtotal) || 0;
      const base = Math.max(0, subtotal - Number(d.discount || 0) + Number(d.extra_costs || 0));
      setF({
        id: d.id, customer_id: d.customer_id, project_id: d.project_id || '', issue_date: d.issue_date, due_date: d.due_date || '',
        items: (d.items || []).map((i: any) => ({ name: i.name, quantity: String(i.quantity), unit_price: String(i.unit_price) })),
        discount: String(d.discount || ''), extra_costs: String(d.extra_costs || ''),
        tax_percent: d.tax && base ? String(Math.round((d.tax / base) * 10000) / 100) : '', notes: d.notes || '',
      });
    }).catch((e) => { ui.error(e); onClose(); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, invoiceId]);

  useEffect(() => {
    if (!open || !f?.customer_id) { setProjects([]); return; }
    studio.family(f.customer_id).then((d) => setProjects(d.projects)).catch(() => setProjects([]));
  }, [open, f?.customer_id]);

  const calc = useMemo(() => (f ? calcInvoice(f.items, f.discount, f.extra_costs, f.tax_percent) : { subtotal: 0, tax: 0, total: 0 }), [f]);
  const set = (k: string, v: any) => setF((x: any) => ({ ...x, [k]: v }));
  const setItem = (i: number, k: string, v: string) => setF((x: any) => ({ ...x, items: x.items.map((it: any, j: number) => (j === i ? { ...it, [k]: v } : it)) }));

  const save = async () => {
    setError(''); setSaving(true);
    try {
      await studio.saveInvoice({ ...f, project_id: f.project_id || undefined, tax_percent: Number(f.tax_percent) || 0 });
      ui.success();
      notifyDataChanged();
      onSaved();
    } catch (e) { setError(errMsg(e)); } finally { setSaving(false); }
  };

  return (
    <Modal open={open} onClose={onClose} size="lg" title={invoiceId ? 'ویرایش فاکتور' : 'فاکتور جدید'}
      footer={<><Btn onClick={onClose}>انصراف</Btn><Btn variant="primary" loading={saving} disabled={!f} onClick={save}>{invoiceId ? 'ذخیره تغییرات' : 'صدور فاکتور'}</Btn></>}>
      {!f ? <div className="py-10 text-center text-slate-400 text-sm">در حال بارگذاری...</div> : (
        <div className="space-y-4">
          {error && <div className="px-3 py-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm">{error}</div>}
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="مشتری" required><CustomerSelector value={f.customer_id} onChange={(id) => setF({ ...f, customer_id: id, project_id: '' })} /></Field>
            <Field label="پروژه">
              <select className={inputCls} value={f.project_id} onChange={(e) => set('project_id', e.target.value ? Number(e.target.value) : '')} disabled={!f.customer_id}>
                <option value="">— بدون پروژه —</option>
                {projects.map((p: any) => <option key={p.id} value={p.id}>{p.project_code} — {p.name}</option>)}
              </select>
            </Field>
            <Field label="تاریخ صدور"><PersianDatePicker value={f.issue_date} onChange={(v) => set('issue_date', v)} /></Field>
            <Field label="تاریخ سررسید"><PersianDatePicker allowClear value={f.due_date} onChange={(v) => set('due_date', v)} /></Field>
          </div>

          <div>
            <div className="text-xs text-slate-400 mb-2">آیتم‌ها</div>
            <div className="space-y-2">
              {f.items.map((it: any, i: number) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-center">
                  <input list="invoice-services" className={`${inputCls} col-span-12 sm:col-span-5`} placeholder="شرح (خدمت یا کالا)" value={it.name}
                    onChange={(e) => {
                      const v = e.target.value; setItem(i, 'name', v);
                      const s = meta?.services?.find((x: any) => x.name === v);
                      if (s && !it.unit_price) setItem(i, 'unit_price', String(s.price));
                    }} />
                  <input className={`${inputCls} col-span-3 sm:col-span-2`} dir="ltr" inputMode="numeric" placeholder="تعداد" value={it.quantity} onChange={(e) => setItem(i, 'quantity', e.target.value)} />
                  <input className={`${inputCls} col-span-6 sm:col-span-3`} dir="ltr" inputMode="numeric" placeholder="قیمت واحد" value={it.unit_price} onChange={(e) => setItem(i, 'unit_price', e.target.value)} />
                  <div className="col-span-3 sm:col-span-2 flex items-center justify-between gap-1">
                    <span className="text-xs text-slate-300 hidden sm:block">{moneyT(n(it.quantity) * n(it.unit_price)).replace(' تومان', '')}</span>
                    <Btn variant="ghost" size="sm" disabled={f.items.length === 1} aria-label="حذف آیتم" onClick={() => set('items', f.items.filter((_: any, j: number) => j !== i))}><Trash2 className="w-4 h-4 text-rose-400" /></Btn>
                  </div>
                </div>
              ))}
              <datalist id="invoice-services">{(meta?.services || []).map((s: any) => <option key={s.id} value={s.name} />)}</datalist>
              <Btn size="sm" onClick={() => set('items', [...f.items, blankItem()])}><Plus className="w-4 h-4" />افزودن آیتم</Btn>
            </div>
          </div>

          <div className="grid sm:grid-cols-3 gap-3">
            <Field label="تخفیف (تومان)"><input className={inputCls} dir="ltr" inputMode="numeric" value={f.discount} onChange={(e) => set('discount', e.target.value)} /></Field>
            <Field label="هزینه‌های اضافه (تومان)"><input className={inputCls} dir="ltr" inputMode="numeric" value={f.extra_costs} onChange={(e) => set('extra_costs', e.target.value)} /></Field>
            <Field label="مالیات (درصد)"><input className={inputCls} dir="ltr" inputMode="decimal" placeholder="در صورت نیاز" value={f.tax_percent} onChange={(e) => set('tax_percent', e.target.value)} /></Field>
          </div>
          <div className="rounded-2xl bg-slate-950/60 border border-slate-800 p-3 text-sm space-y-1.5">
            <div className="flex justify-between text-slate-300"><span>جمع آیتم‌ها</span><span>{moneyT(calc.subtotal)}</span></div>
            <div className="flex justify-between text-slate-400"><span>− تخفیف</span><span>{moneyT(n(f.discount))}</span></div>
            <div className="flex justify-between text-slate-400"><span>+ هزینه‌های اضافه</span><span>{moneyT(n(f.extra_costs))}</span></div>
            {calc.tax > 0 && <div className="flex justify-between text-slate-400"><span>+ مالیات</span><span>{moneyT(calc.tax)}</span></div>}
            <div className="flex justify-between font-bold text-amber-300 pt-1.5 border-t border-slate-800"><span>مبلغ نهایی</span><span>{moneyT(calc.total)}</span></div>
          </div>
          <Field label="توضیحات"><input className={inputCls} value={f.notes} onChange={(e) => set('notes', e.target.value)} /></Field>
        </div>
      )}
    </Modal>
  );
};
