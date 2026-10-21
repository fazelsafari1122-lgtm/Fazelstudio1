import React, { useMemo, useState } from 'react';
import { Wallet, Plus, Edit3, Trash2 } from './icons.tsx';
import { studio } from '../services/studioApi.ts';
import { useAsync, useMeta, notifyDataChanged, errMsg } from '../hooks.ts';
import { Btn, Card, Field, PageHeader, StatCard, inputCls, moneyT } from './ui/Common.tsx';
import { DataTable } from './ui/DataTable.tsx';
import { Donut } from './ui/Chart.tsx';
import { Modal } from './ui/Modal.tsx';
import { PersianDatePicker } from './ui/PersianDatePicker.tsx';
import { useUi } from './ui/UiProvider.tsx';
import { getTodayJalali, toPersianDigits } from '../utils/jalali.ts';

const COLORS = ['#f59e0b', '#38bdf8', '#34d399', '#f472b6', '#a78bfa', '#fb923c', '#f87171', '#facc15', '#2dd4bf', '#94a3b8', '#e879f9'];

export const ExpensesView: React.FC = () => {
  const ui = useUi();
  const meta = useMeta();
  const [cat, setCat] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const { data, loading, error, reload } = useAsync(() => studio.expenses(), []);
  const [edit, setEdit] = useState<{ open: boolean; item: any | null }>({ open: false, item: null });

  const all: any[] = data?.expenses || [];
  const rows = all.filter((e) => (!cat || e.category === cat) && (!from || e.expense_date >= from) && (!to || e.expense_date <= to));
  const total = rows.reduce((s, e) => s + Number(e.amount), 0);
  const byCat = useMemo(() => {
    const m = new Map<string, number>();
    rows.forEach((e) => m.set(e.category, (m.get(e.category) || 0) + Number(e.amount)));
    return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([name, value], i) => ({ name, value, color: COLORS[i % COLORS.length] }));
  }, [rows]);

  const remove = async (e: any) => {
    if (!(await ui.confirm(`آیا از حذف هزینه «${e.title}» مطمئن هستید؟`))) return;
    try { await studio.deleteExpense(e.id); ui.success('با موفقیت حذف شد'); notifyDataChanged(); reload(); } catch (er) { ui.error(er); }
  };

  return (
    <div>
      <PageHeader title="هزینه‌ها" subtitle="ثبت و پیگیری هزینه‌های آتلیه؛ اجاره، حقوق، تجهیزات و ..." icon={<Wallet className="w-5 h-5" />} actions={<Btn variant="primary" onClick={() => setEdit({ open: true, item: null })}><Plus className="w-4 h-4" />هزینه جدید</Btn>} />
      <div className="grid lg:grid-cols-3 gap-3 mb-4">
        <div className="grid grid-cols-2 lg:grid-cols-1 gap-3">
          <StatCard label="جمع هزینه‌ها (فیلتر فعلی)" value={moneyT(total)} tone="rose" icon={<Wallet className="w-5 h-5" />} />
          <StatCard label="تعداد اسناد" value={toPersianDigits(rows.length)} tone="sky" />
        </div>
        <Card title="سهم هر دسته‌بندی" className="lg:col-span-2">{byCat.length ? <Donut items={byCat} /> : <p className="text-sm text-slate-500 py-6 text-center">اطلاعاتی برای نمایش وجود ندارد</p>}</Card>
      </div>
      <Card>
        <div className="flex flex-wrap gap-2 mb-4 items-end">
          <select className={`${inputCls} w-auto`} value={cat} onChange={(e) => setCat(e.target.value)} aria-label="دسته‌بندی"><option value="">همه دسته‌ها</option>{(meta?.lookups?.expense_category || []).map((c: string) => <option key={c}>{c}</option>)}</select>
          <div className="w-40"><PersianDatePicker allowClear value={from} onChange={setFrom} placeholder="از تاریخ" /></div>
          <div className="w-40"><PersianDatePicker allowClear value={to} onChange={setTo} placeholder="تا تاریخ" /></div>
        </div>
        <DataTable rows={rows} rowKey={(e) => e.id} loading={loading && !data} error={error} onRetry={reload} onAdd={() => setEdit({ open: true, item: null })} exportName="expenses"
          columns={[
            { key: 'title', header: 'عنوان', value: (e) => e.title }, { key: 'cat', header: 'دسته‌بندی', value: (e) => e.category },
            { key: 'amount', header: 'مبلغ', value: (e) => e.amount, render: (e) => moneyT(e.amount) },
            { key: 'date', header: 'تاریخ', value: (e) => e.expense_date, render: (e) => toPersianDigits(e.expense_date) },
            { key: 'payer', header: 'پرداخت‌کننده', value: (e) => e.payer || '' }, { key: 'method', header: 'روش پرداخت', value: (e) => e.payment_method || '' },
            { key: 'desc', header: 'توضیحات', value: (e) => e.description || '' },
            { key: 'act', header: '', noExport: true, render: (e) => <div className="flex gap-1"><Btn size="sm" variant="ghost" aria-label="ویرایش" onClick={() => setEdit({ open: true, item: e })}><Edit3 className="w-4 h-4" /></Btn><Btn size="sm" variant="ghost" aria-label="حذف" onClick={() => remove(e)}><Trash2 className="w-4 h-4 text-rose-400" /></Btn></div> },
          ]} />
      </Card>
      <ExpenseForm state={edit} meta={meta} onClose={() => setEdit({ open: false, item: null })} onSaved={() => { setEdit({ open: false, item: null }); notifyDataChanged(); reload(); }} />
    </div>
  );
};

const ExpenseForm: React.FC<{ state: { open: boolean; item: any | null }; meta: any; onClose: () => void; onSaved: () => void }> = ({ state, meta, onClose, onSaved }) => {
  const ui = useUi();
  const [f, setF] = useState<any>({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  React.useEffect(() => {
    if (!state.open) return;
    setError('');
    setF(state.item ? { ...state.item } : { title: '', amount: '', expense_date: getTodayJalali(), category: meta?.lookups?.expense_category?.[0] || '', payer: '', payment_method: 'نقدی', description: '' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.open, state.item]);
  if (!state.open) return null;
  const set = (k: string, v: any) => setF({ ...f, [k]: v });
  const save = async () => { setSaving(true); setError(''); try { await studio.saveExpense(f); ui.success(); onSaved(); } catch (e) { setError(errMsg(e)); } finally { setSaving(false); } };
  return (
    <Modal open onClose={onClose} title={state.item ? 'ویرایش هزینه' : 'هزینه جدید'} footer={<><Btn onClick={onClose}>انصراف</Btn><Btn variant="primary" loading={saving} onClick={save}>ذخیره</Btn></>}>
      <div className="space-y-3">
        {error && <div className="px-3 py-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm">{error}</div>}
        <Field label="عنوان" required><input className={inputCls} value={f.title || ''} onChange={(e) => set('title', e.target.value)} autoFocus /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="مبلغ (تومان)" required><input className={inputCls} dir="ltr" inputMode="numeric" value={f.amount ?? ''} onChange={(e) => set('amount', e.target.value)} /></Field>
          <Field label="تاریخ" required><PersianDatePicker value={f.expense_date || ''} onChange={(v) => set('expense_date', v)} /></Field>
          <Field label="دسته‌بندی" required><select className={inputCls} value={f.category || ''} onChange={(e) => set('category', e.target.value)}><option value="">— انتخاب —</option>{(meta?.lookups?.expense_category || []).map((c: string) => <option key={c}>{c}</option>)}</select></Field>
          <Field label="روش پرداخت"><select className={inputCls} value={f.payment_method || ''} onChange={(e) => set('payment_method', e.target.value)}>{(meta?.lookups?.payment_method || ['نقدی']).map((c: string) => <option key={c}>{c}</option>)}</select></Field>
          <Field label="پرداخت‌کننده" className="col-span-2"><input list="expense-payers" className={inputCls} value={f.payer || ''} onChange={(e) => set('payer', e.target.value)} /><datalist id="expense-payers">{(meta?.users || []).map((u: any) => <option key={u.id} value={u.full_name} />)}</datalist></Field>
        </div>
        <Field label="توضیحات"><input className={inputCls} value={f.description || ''} onChange={(e) => set('description', e.target.value)} /></Field>
      </div>
    </Modal>
  );
};
