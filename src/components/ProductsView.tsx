import React, { useState } from 'react';
import { Tag, Plus, Edit3, Trash2, AlertTriangle } from './icons.tsx';
import { studio } from '../services/studioApi.ts';
import { useAsync, useDebounced, useMeta, notifyDataChanged, errMsg } from '../hooks.ts';
import { Btn, Card, Field, PageHeader, SearchBox, StatCard, StatusBadge, inputCls, moneyT } from './ui/Common.tsx';
import { DataTable } from './ui/DataTable.tsx';
import { Modal } from './ui/Modal.tsx';
import { useUi } from './ui/UiProvider.tsx';
import { toPersianDigits } from '../utils/jalali.ts';

export const ProductsView: React.FC = () => {
  const ui = useUi();
  const meta = useMeta();
  const [q, setQ] = useState('');
  const dq = useDebounced(q, 200);
  const [cat, setCat] = useState('');
  const [onlyLow, setOnlyLow] = useState(false);
  const { data, loading, error, reload } = useAsync(() => studio.products(), []);
  const [edit, setEdit] = useState<{ open: boolean; item: any | null }>({ open: false, item: null });
  const [stock, setStock] = useState<any>(null);

  const all = data || [];
  const rows = all.filter((p) => (!cat || p.category === cat) && (!onlyLow || p.low_stock) && (!dq.trim() || [p.name, p.category, p.notes].join(' ').includes(dq.trim())));
  const value = all.reduce((s, p) => s + p.stock * p.purchase_price, 0);

  const remove = async (p: any) => {
    if (!(await ui.confirm(`آیا از حذف کالای «${p.name}» مطمئن هستید؟`))) return;
    try { await studio.deleteProduct(p.id); ui.success('با موفقیت حذف شد'); reload(); } catch (e) { ui.error(e); }
  };

  return (
    <div>
      <PageHeader title="مدیریت کالاها" subtitle="موجودی، قیمت خرید و فروش و حداقل موجودی" icon={<Tag className="w-5 h-5" />} actions={<Btn variant="primary" onClick={() => setEdit({ open: true, item: null })}><Plus className="w-4 h-4" />کالای جدید</Btn>} />
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
        <StatCard label="تعداد کالا" value={toPersianDigits(all.length)} tone="amber" />
        <StatCard label="ارزش موجودی (قیمت خرید)" value={moneyT(value)} tone="sky" />
        <StatCard label="کمتر از حداقل موجودی" value={toPersianDigits(all.filter((p) => p.low_stock).length)} tone={all.some((p) => p.low_stock) ? 'rose' : 'emerald'} icon={<AlertTriangle className="w-5 h-5" />} />
      </div>
      <Card>
        <div className="flex flex-wrap gap-2 mb-4">
          <SearchBox className="flex-1 min-w-[200px]" value={q} onChange={setQ} placeholder="جستجوی نام یا دسته‌بندی..." />
          <select className={`${inputCls} w-auto`} value={cat} onChange={(e) => setCat(e.target.value)} aria-label="دسته‌بندی"><option value="">همه دسته‌ها</option>{(meta?.lookups?.product_category || []).map((c: string) => <option key={c}>{c}</option>)}</select>
          <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer"><input type="checkbox" className="accent-amber-500 w-4 h-4" checked={onlyLow} onChange={(e) => setOnlyLow(e.target.checked)} />فقط کمبود موجودی</label>
        </div>
        <DataTable rows={rows} rowKey={(p) => p.id} loading={loading && !data} error={error} onRetry={reload} onAdd={() => setEdit({ open: true, item: null })} exportName="products"
          columns={[
            { key: 'name', header: 'نام کالا', value: (p) => p.name }, { key: 'cat', header: 'دسته‌بندی', value: (p) => p.category || '' },
            { key: 'stock', header: 'موجودی', value: (p) => p.stock, render: (p) => (
              <div className="flex items-center gap-2"><span className={p.low_stock ? 'text-rose-300 font-bold' : ''}>{toPersianDigits(p.stock)}</span>{p.low_stock && <StatusBadge status="کمبود" tone="red" />}</div>) },
            { key: 'min', header: 'حداقل', value: (p) => p.min_stock, render: (p) => toPersianDigits(p.min_stock) },
            { key: 'buy', header: 'قیمت خرید', value: (p) => p.purchase_price, render: (p) => moneyT(p.purchase_price) },
            { key: 'sell', header: 'قیمت فروش', value: (p) => p.sale_price, render: (p) => moneyT(p.sale_price) },
            { key: 'act', header: '', noExport: true, render: (p) => (
              <div className="flex gap-1">
                <Btn size="sm" onClick={() => setStock({ p, delta: '', mode: 'in', reason: '' })}>+/− موجودی</Btn>
                <Btn size="sm" variant="ghost" aria-label="ویرایش" onClick={() => setEdit({ open: true, item: p })}><Edit3 className="w-4 h-4" /></Btn>
                <Btn size="sm" variant="ghost" aria-label="حذف" onClick={() => remove(p)}><Trash2 className="w-4 h-4 text-rose-400" /></Btn>
              </div>) },
          ]} />
      </Card>
      <ProductForm state={edit} cats={meta?.lookups?.product_category || []} onClose={() => setEdit({ open: false, item: null })} onSaved={() => { setEdit({ open: false, item: null }); reload(); }} />
      {stock && <StockModal s={stock} setS={setStock} onDone={() => { setStock(null); notifyDataChanged(); reload(); }} />}
    </div>
  );
};

const ProductForm: React.FC<{ state: { open: boolean; item: any | null }; cats: string[]; onClose: () => void; onSaved: () => void }> = ({ state, cats, onClose, onSaved }) => {
  const ui = useUi();
  const [f, setF] = useState<any>({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  React.useEffect(() => { if (state.open) { setError(''); setF(state.item ? { ...state.item } : { name: '', category: cats[0] || '', stock: '0', purchase_price: '', sale_price: '', min_stock: '0', notes: '' }); } /* eslint-disable-next-line */ }, [state.open, state.item]);
  if (!state.open) return null;
  const save = async () => { setSaving(true); setError(''); try { await studio.saveProduct(f); ui.success(); onSaved(); } catch (e) { setError(errMsg(e)); } finally { setSaving(false); } };
  const set = (k: string, v: any) => setF({ ...f, [k]: v });
  return (
    <Modal open onClose={onClose} title={state.item ? 'ویرایش کالا' : 'کالای جدید'} footer={<><Btn onClick={onClose}>انصراف</Btn><Btn variant="primary" loading={saving} onClick={save}>ذخیره</Btn></>}>
      <div className="space-y-3">
        {error && <div className="px-3 py-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm">{error}</div>}
        <div className="grid grid-cols-2 gap-3">
          <Field label="نام کالا" required className="col-span-2"><input className={inputCls} value={f.name || ''} onChange={(e) => set('name', e.target.value)} autoFocus /></Field>
          <Field label="دسته‌بندی"><select className={inputCls} value={f.category || ''} onChange={(e) => set('category', e.target.value)}><option value="">—</option>{cats.map((c) => <option key={c}>{c}</option>)}</select></Field>
          {!state.item && <Field label="موجودی اولیه"><input className={inputCls} dir="ltr" inputMode="numeric" value={f.stock ?? ''} onChange={(e) => set('stock', e.target.value)} /></Field>}
          <Field label="قیمت خرید"><input className={inputCls} dir="ltr" inputMode="numeric" value={f.purchase_price ?? ''} onChange={(e) => set('purchase_price', e.target.value)} /></Field>
          <Field label="قیمت فروش"><input className={inputCls} dir="ltr" inputMode="numeric" value={f.sale_price ?? ''} onChange={(e) => set('sale_price', e.target.value)} /></Field>
          <Field label="حداقل موجودی"><input className={inputCls} dir="ltr" inputMode="numeric" value={f.min_stock ?? ''} onChange={(e) => set('min_stock', e.target.value)} /></Field>
          <Field label="توضیحات" className="col-span-2"><input className={inputCls} value={f.notes || ''} onChange={(e) => set('notes', e.target.value)} /></Field>
        </div>
      </div>
    </Modal>
  );
};

const StockModal: React.FC<{ s: any; setS: (v: any) => void; onDone: () => void }> = ({ s, setS, onDone }) => {
  const ui = useUi();
  const moves = useAsync(() => studio.stockMoves(s.p.id), [s.p.id]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const qty = Number(String(s.delta).replace(/[^\d]/g, '')) || 0;
  const save = async () => {
    if (!qty) { setError('تعداد را وارد کنید.'); return; }
    setSaving(true); setError('');
    try { await studio.adjustStock(s.p.id, s.mode === 'in' ? qty : -qty, s.reason); ui.success(); onDone(); } catch (e) { setError(errMsg(e)); } finally { setSaving(false); }
  };
  return (
    <Modal open onClose={() => setS(null)} size="sm" title={`موجودی «${s.p.name}»`} footer={<><Btn onClick={() => setS(null)}>انصراف</Btn><Btn variant="primary" loading={saving} onClick={save}>ثبت</Btn></>}>
      <div className="space-y-3">
        <div className="text-sm text-slate-300">موجودی فعلی: <b className="text-amber-300">{toPersianDigits(s.p.stock)}</b></div>
        {error && <div className="px-3 py-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm">{error}</div>}
        <div className="flex rounded-xl overflow-hidden border border-slate-700">
          <button onClick={() => setS({ ...s, mode: 'in' })} className={`flex-1 py-2 text-sm ${s.mode === 'in' ? 'bg-emerald-500 text-slate-950 font-semibold' : 'bg-slate-900 text-slate-300'}`}>افزایش</button>
          <button onClick={() => setS({ ...s, mode: 'out' })} className={`flex-1 py-2 text-sm ${s.mode === 'out' ? 'bg-rose-500 text-white font-semibold' : 'bg-slate-900 text-slate-300'}`}>کاهش</button>
        </div>
        <Field label="تعداد"><input className={inputCls} dir="ltr" inputMode="numeric" value={s.delta} onChange={(e) => setS({ ...s, delta: e.target.value })} autoFocus /></Field>
        <Field label="دلیل"><input className={inputCls} value={s.reason} onChange={(e) => setS({ ...s, reason: e.target.value })} placeholder="مثلاً خرید جدید / فروش" /></Field>
        {(moves.data || []).length > 0 && (
          <div><div className="text-xs text-slate-400 mb-1">آخرین تغییرات</div>
            <ul className="text-xs text-slate-300 space-y-1 max-h-32 overflow-y-auto">{(moves.data || []).slice(0, 8).map((m: any) => <li key={m.id} className="flex justify-between"><span>{toPersianDigits(m.move_date || '')} — {m.reason}</span><span className={m.delta > 0 ? 'text-emerald-400' : 'text-rose-400'} dir="ltr">{m.delta > 0 ? '+' : ''}{toPersianDigits(m.delta)}</span></li>)}</ul></div>
        )}
      </div>
    </Modal>
  );
};
