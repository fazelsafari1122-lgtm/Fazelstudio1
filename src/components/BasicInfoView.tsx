import React, { useState } from 'react';
import { Database, Plus, Edit3, Trash2, Check, X } from './icons.tsx';
import { studio } from '../services/studioApi.ts';
import { useAsync, notifyMetaChanged, errMsg } from '../hooks.ts';
import { Btn, Card, ErrorState, Field, LoadingState, PageHeader, Tabs, inputCls, moneyT, StatusBadge } from './ui/Common.tsx';
import { DataTable } from './ui/DataTable.tsx';
import { Modal } from './ui/Modal.tsx';
import { useUi } from './ui/UiProvider.tsx';
import { TagsManager } from './TagsManager.tsx';
import { StagesManager } from './ProjectsView.tsx';
import { TemplatesTab } from './SmsCenterView.tsx';
import { toPersianDigits } from '../utils/jalali.ts';

const LOOKUP_TABS: { id: string; label: string; kind: string }[] = [
  { id: 'project_type', label: 'دسته‌بندی پروژه‌ها', kind: 'project_type' },
  { id: 'product_category', label: 'دسته‌بندی کالاها', kind: 'product_category' },
  { id: 'expense_category', label: 'دسته‌بندی هزینه‌ها', kind: 'expense_category' },
  { id: 'payment_method', label: 'روش‌های پرداخت', kind: 'payment_method' },
  { id: 'bank', label: 'بانک‌ها / صندوق', kind: 'bank' },
];

export const BasicInfoView: React.FC = () => {
  const [tab, setTab] = useState('branches');
  const lookup = LOOKUP_TABS.find((t) => t.id === tab);
  return (
    <div>
      <PageHeader title="اطلاعات پایه" subtitle="شعبه‌ها، سالن‌ها، خدمات، پکیج‌ها، دسته‌بندی‌ها، وضعیت پروژه‌ها و قالب‌ها" icon={<Database className="w-5 h-5" />} />
      <Tabs value={tab} onChange={setTab} tabs={[
        { id: 'branches', label: 'شعبه‌ها و سالن‌ها' }, { id: 'services', label: 'خدمات' }, { id: 'packages', label: 'پکیج‌ها' },
        ...LOOKUP_TABS.map((t) => ({ id: t.id, label: t.label })),
        { id: 'stages', label: 'وضعیت پروژه‌ها' }, { id: 'tags', label: 'تگ‌ها' }, { id: 'templates', label: 'قالب پیامک' }, { id: 'online', label: 'پرداخت آنلاین' },
      ]} />
      {tab === 'branches' && <BranchesTab />}
      {tab === 'services' && <ServicesTab />}
      {tab === 'packages' && <PackagesTab />}
      {lookup && <LookupTab key={lookup.kind} kind={lookup.kind} title={lookup.label} />}
      {tab === 'stages' && <StagesInline />}
      {tab === 'tags' && <Card><TagsManager onChanged={notifyMetaChanged} /></Card>}
      {tab === 'templates' && <TemplatesTab />}
      {tab === 'online' && <OnlineTab />}
    </div>
  );
};

const LookupTab: React.FC<{ kind: string; title: string }> = ({ kind, title }) => {
  const ui = useUi();
  const { data, loading, error, reload } = useAsync(() => studio.lookups(kind), [kind]);
  const [adding, setAdding] = useState('');
  const [edit, setEdit] = useState<{ id: number; name: string } | null>(null);
  const done = () => { notifyMetaChanged(); reload(); };
  const add = async () => { if (!adding.trim()) return; try { await studio.saveLookup(kind, { name: adding }); ui.success(); setAdding(''); done(); } catch (e) { ui.error(e); } };
  const rename = async () => { if (!edit) return; try { await studio.saveLookup(kind, edit); ui.success(); setEdit(null); done(); } catch (e) { ui.error(e); } };
  const del = async (r: any) => { if (!(await ui.confirm(`آیا از حذف «${r.name}» مطمئن هستید؟`))) return; try { await studio.deleteLookup(kind, r.id); ui.success('با موفقیت حذف شد'); done(); } catch (e) { ui.error(e); } };
  if (loading && !data) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  return (
    <Card title={title}>
      <div className="flex gap-2 mb-3"><input className={`${inputCls} flex-1`} placeholder="مورد جدید..." value={adding} onChange={(e) => setAdding(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') add(); }} /><Btn variant="primary" disabled={!adding.trim()} onClick={add}><Plus className="w-4 h-4" />افزودن</Btn></div>
      <ul className="divide-y divide-slate-800 border border-slate-800 rounded-xl">
        {(data || []).map((r: any) => (
          <li key={r.id} className="flex items-center gap-2 px-3 py-2">
            {edit?.id === r.id ? (<><input className={`${inputCls} flex-1`} value={edit.name} autoFocus onChange={(e) => setEdit({ ...edit, name: e.target.value })} onKeyDown={(e) => { if (e.key === 'Enter') rename(); }} /><Btn size="sm" variant="primary" onClick={rename}><Check className="w-4 h-4" /></Btn><Btn size="sm" variant="ghost" onClick={() => setEdit(null)}><X className="w-4 h-4" /></Btn></>) : (
              <><span className="flex-1 text-sm">{r.name}</span><Btn size="sm" variant="ghost" aria-label="ویرایش" onClick={() => setEdit({ id: r.id, name: r.name })}><Edit3 className="w-4 h-4" /></Btn><Btn size="sm" variant="ghost" aria-label="حذف" onClick={() => del(r)}><Trash2 className="w-4 h-4 text-rose-400" /></Btn></>)}
          </li>
        ))}
      </ul>
    </Card>
  );
};

const StagesInline: React.FC = () => {
  const [open, setOpen] = useState(true);
  return (
    <Card title="وضعیت پروژه‌ها (ستون‌های Kanban)">
      <p className="text-sm text-slate-400 mb-3">ترتیب و نام وضعیت‌ها در صفحه «مدیریت پروژه» استفاده می‌شود. وضعیت‌های سیستمی قابل حذف نیستند.</p>
      <Btn variant="primary" onClick={() => setOpen(true)}>مدیریت وضعیت‌ها</Btn>
      <StagesManager open={open} onClose={() => setOpen(false)} />
    </Card>
  );
};

const BranchesTab: React.FC = () => {
  const ui = useUi();
  const { data, loading, error, reload } = useAsync(() => studio.branches(), []);
  const [branch, setBranch] = useState<any>(null);
  const [hall, setHall] = useState<any>(null);
  const [err, setErr] = useState('');
  const done = () => { setBranch(null); setHall(null); notifyMetaChanged(); reload(); };
  const saveBranch = async () => { setErr(''); try { await studio.saveBranch(branch); ui.success(); done(); } catch (e) { setErr(errMsg(e)); } };
  const saveHall = async () => { setErr(''); try { await studio.saveHall(hall); ui.success(); done(); } catch (e) { setErr(errMsg(e)); } };
  const delBranch = async (b: any) => { if (!(await ui.confirm(`آیا از حذف شعبه «${b.name}» و سالن‌های آن مطمئن هستید؟`))) return; try { await studio.deleteBranch(b.id); ui.success('با موفقیت حذف شد'); done(); } catch (e) { ui.error(e); } };
  const delHall = async (h: any) => { if (!(await ui.confirm(`آیا از حذف سالن «${h.name}» مطمئن هستید؟`))) return; try { await studio.deleteHall(h.id); ui.success('با موفقیت حذف شد'); done(); } catch (e) { ui.error(e); } };
  if (loading && !data) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  return (
    <div className="space-y-3">
      <Btn variant="primary" onClick={() => { setErr(''); setBranch({ name: '', address: '', phone: '', is_active: 1 }); }}><Plus className="w-4 h-4" />شعبه جدید</Btn>
      {(data || []).map((b: any) => (
        <Card key={b.id} title={<span>{b.name} {!b.is_active && <StatusBadge status="غیرفعال" tone="slate" />}</span>}
          action={<div className="flex gap-1"><Btn size="sm" onClick={() => { setErr(''); setHall({ branch_id: b.id, name: '', capacity: '' }); }}><Plus className="w-4 h-4" />سالن</Btn><Btn size="sm" variant="ghost" aria-label="ویرایش شعبه" onClick={() => { setErr(''); setBranch({ ...b }); }}><Edit3 className="w-4 h-4" /></Btn><Btn size="sm" variant="ghost" aria-label="حذف شعبه" onClick={() => delBranch(b)}><Trash2 className="w-4 h-4 text-rose-400" /></Btn></div>}>
          <div className="text-xs text-slate-400 mb-2">{b.address || 'آدرس ثبت نشده'} {b.phone && <span dir="ltr" className="mr-3">{toPersianDigits(b.phone)}</span>}</div>
          {b.halls.length === 0 ? <p className="text-xs text-slate-500">سالنی ثبت نشده است.</p> : (
            <ul className="divide-y divide-slate-800 border border-slate-800 rounded-xl">{b.halls.map((h: any) => (
              <li key={h.id} className="flex items-center gap-3 px-3 py-2 text-sm"><span className="flex-1">{h.name}</span><span className="text-xs text-slate-400">ظرفیت {toPersianDigits(h.capacity || 0)} نفر</span>{!h.is_active && <StatusBadge status="غیرفعال" tone="slate" />}
                <Btn size="sm" variant="ghost" aria-label="ویرایش سالن" onClick={() => { setErr(''); setHall({ ...h }); }}><Edit3 className="w-4 h-4" /></Btn><Btn size="sm" variant="ghost" aria-label="حذف سالن" onClick={() => delHall(h)}><Trash2 className="w-4 h-4 text-rose-400" /></Btn></li>))}</ul>
          )}
        </Card>
      ))}
      {branch && (
        <Modal open onClose={() => setBranch(null)} size="sm" title={branch.id ? 'ویرایش شعبه' : 'شعبه جدید'} footer={<><Btn onClick={() => setBranch(null)}>انصراف</Btn><Btn variant="primary" onClick={saveBranch}>ذخیره</Btn></>}>
          <div className="space-y-3">{err && <div className="px-3 py-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm">{err}</div>}
            <Field label="نام شعبه" required><input className={inputCls} value={branch.name} onChange={(e) => setBranch({ ...branch, name: e.target.value })} autoFocus /></Field>
            <Field label="آدرس"><input className={inputCls} value={branch.address || ''} onChange={(e) => setBranch({ ...branch, address: e.target.value })} /></Field>
            <Field label="تلفن"><input className={inputCls} dir="ltr" value={branch.phone || ''} onChange={(e) => setBranch({ ...branch, phone: e.target.value })} /></Field>
            <label className="flex items-center gap-2 text-sm text-slate-300"><input type="checkbox" className="accent-amber-500 w-4 h-4" checked={!!branch.is_active} onChange={(e) => setBranch({ ...branch, is_active: e.target.checked ? 1 : 0 })} />فعال</label></div>
        </Modal>
      )}
      {hall && (
        <Modal open onClose={() => setHall(null)} size="sm" title={hall.id ? 'ویرایش سالن' : 'سالن جدید'} footer={<><Btn onClick={() => setHall(null)}>انصراف</Btn><Btn variant="primary" onClick={saveHall}>ذخیره</Btn></>}>
          <div className="space-y-3">{err && <div className="px-3 py-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm">{err}</div>}
            <Field label="شعبه"><select className={inputCls} value={hall.branch_id} onChange={(e) => setHall({ ...hall, branch_id: Number(e.target.value) })}>{(data || []).map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></Field>
            <Field label="نام سالن" required><input className={inputCls} value={hall.name} onChange={(e) => setHall({ ...hall, name: e.target.value })} autoFocus /></Field>
            <Field label="ظرفیت (نفر)"><input className={inputCls} dir="ltr" inputMode="numeric" value={hall.capacity ?? ''} onChange={(e) => setHall({ ...hall, capacity: e.target.value })} /></Field>
            {hall.id && <label className="flex items-center gap-2 text-sm text-slate-300"><input type="checkbox" className="accent-amber-500 w-4 h-4" checked={!!hall.is_active} onChange={(e) => setHall({ ...hall, is_active: e.target.checked ? 1 : 0 })} />فعال</label>}</div>
        </Modal>
      )}
    </div>
  );
};

const ServicesTab: React.FC = () => {
  const ui = useUi();
  const { data, loading, error, reload } = useAsync(async () => { const r: any = await studio.services(); return Array.isArray(r) ? r : r?.services || []; }, []);
  const [edit, setEdit] = useState<any>(null);
  const [err, setErr] = useState('');
  const save = async () => { setErr(''); try { await studio.saveService({ ...edit, price: Number(String(edit.price).replace(/[^\d]/g, '')) || 0 }); ui.success(); setEdit(null); notifyMetaChanged(); reload(); } catch (e) { setErr(errMsg(e)); } };
  const del = async (s: any) => { if (!(await ui.confirm(`آیا از حذف خدمت «${s.name}» مطمئن هستید؟`))) return; try { await studio.deleteService(s.id); ui.success('با موفقیت حذف شد'); notifyMetaChanged(); reload(); } catch (e) { ui.error(e); } };
  return (
    <Card title="خدمات" action={<Btn size="sm" variant="primary" onClick={() => { setErr(''); setEdit({ name: '', category: 'عکاسی', price: '', unit: 'جلسه', description: '', is_active: 1 }); }}><Plus className="w-4 h-4" />خدمت جدید</Btn>}>
      <DataTable rows={data || []} rowKey={(s: any) => s.id} loading={loading && !data} error={error} onRetry={reload} onAdd={() => setEdit({ name: '', category: 'عکاسی', price: '', unit: 'جلسه', description: '', is_active: 1 })} exportName="services"
        columns={[
          { key: 'name', header: 'خدمت', value: (s: any) => s.name }, { key: 'cat', header: 'دسته', value: (s: any) => s.category }, { key: 'price', header: 'تعرفه', value: (s: any) => s.price, render: (s: any) => moneyT(s.price) },
          { key: 'unit', header: 'واحد', value: (s: any) => s.unit }, { key: 'st', header: 'وضعیت', render: (s: any) => <StatusBadge status={s.is_active ? 'فعال' : 'غیرفعال'} tone={s.is_active ? 'green' : 'slate'} /> },
          { key: 'act', header: '', noExport: true, render: (s: any) => <div className="flex gap-1"><Btn size="sm" variant="ghost" aria-label="ویرایش" onClick={() => { setErr(''); setEdit({ ...s }); }}><Edit3 className="w-4 h-4" /></Btn><Btn size="sm" variant="ghost" aria-label="حذف" onClick={() => del(s)}><Trash2 className="w-4 h-4 text-rose-400" /></Btn></div> },
        ]} />
      {edit && (
        <Modal open onClose={() => setEdit(null)} title={edit.id ? 'ویرایش خدمت' : 'خدمت جدید'} footer={<><Btn onClick={() => setEdit(null)}>انصراف</Btn><Btn variant="primary" onClick={save}>ذخیره</Btn></>}>
          <div className="grid grid-cols-2 gap-3">{err && <div className="col-span-2 px-3 py-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm">{err}</div>}
            <Field label="نام خدمت" required className="col-span-2"><input className={inputCls} value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} autoFocus /></Field>
            <Field label="دسته‌بندی" required><input className={inputCls} value={edit.category} onChange={(e) => setEdit({ ...edit, category: e.target.value })} /></Field>
            <Field label="تعرفه (تومان)" required><input className={inputCls} dir="ltr" inputMode="numeric" value={edit.price} onChange={(e) => setEdit({ ...edit, price: e.target.value })} /></Field>
            <Field label="واحد"><input className={inputCls} value={edit.unit || ''} onChange={(e) => setEdit({ ...edit, unit: e.target.value })} /></Field>
            <label className="flex items-center gap-2 text-sm text-slate-300 self-end pb-2"><input type="checkbox" className="accent-amber-500 w-4 h-4" checked={!!edit.is_active} onChange={(e) => setEdit({ ...edit, is_active: e.target.checked ? 1 : 0 })} />فعال</label>
            <Field label="توضیحات" className="col-span-2"><input className={inputCls} value={edit.description || ''} onChange={(e) => setEdit({ ...edit, description: e.target.value })} /></Field></div>
        </Modal>
      )}
    </Card>
  );
};

const PackagesTab: React.FC = () => {
  const ui = useUi();
  const { data, loading, error, reload } = useAsync(() => studio.packages(), []);
  const [edit, setEdit] = useState<any>(null);
  const [err, setErr] = useState('');
  const blank = { name: '', price: '', description: '', is_active: 1 };
  const save = async () => { setErr(''); try { await studio.savePackage(edit); ui.success(); setEdit(null); notifyMetaChanged(); reload(); } catch (e) { setErr(errMsg(e)); } };
  const del = async (p: any) => { if (!(await ui.confirm(`آیا از حذف پکیج «${p.name}» مطمئن هستید؟`))) return; try { await studio.deletePackage(p.id); ui.success('با موفقیت حذف شد'); notifyMetaChanged(); reload(); } catch (e) { ui.error(e); } };
  return (
    <Card title="پکیج‌ها" action={<Btn size="sm" variant="primary" onClick={() => { setErr(''); setEdit({ ...blank }); }}><Plus className="w-4 h-4" />پکیج جدید</Btn>}>
      <DataTable rows={data || []} rowKey={(p: any) => p.id} loading={loading && !data} error={error} onRetry={reload} onAdd={() => setEdit({ ...blank })} exportName="packages"
        columns={[
          { key: 'name', header: 'پکیج', value: (p: any) => p.name }, { key: 'price', header: 'قیمت', value: (p: any) => p.price, render: (p: any) => moneyT(p.price) }, { key: 'desc', header: 'توضیحات', value: (p: any) => p.description || '' },
          { key: 'st', header: 'وضعیت', render: (p: any) => <StatusBadge status={p.is_active ? 'فعال' : 'غیرفعال'} tone={p.is_active ? 'green' : 'slate'} /> },
          { key: 'act', header: '', noExport: true, render: (p: any) => <div className="flex gap-1"><Btn size="sm" variant="ghost" aria-label="ویرایش" onClick={() => { setErr(''); setEdit({ ...p }); }}><Edit3 className="w-4 h-4" /></Btn><Btn size="sm" variant="ghost" aria-label="حذف" onClick={() => del(p)}><Trash2 className="w-4 h-4 text-rose-400" /></Btn></div> },
        ]} />
      {edit && (
        <Modal open onClose={() => setEdit(null)} size="sm" title={edit.id ? 'ویرایش پکیج' : 'پکیج جدید'} footer={<><Btn onClick={() => setEdit(null)}>انصراف</Btn><Btn variant="primary" onClick={save}>ذخیره</Btn></>}>
          <div className="space-y-3">{err && <div className="px-3 py-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm">{err}</div>}
            <Field label="نام پکیج" required><input className={inputCls} value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} autoFocus /></Field>
            <Field label="قیمت (تومان)"><input className={inputCls} dir="ltr" inputMode="numeric" value={edit.price} onChange={(e) => setEdit({ ...edit, price: e.target.value })} /></Field>
            <Field label="توضیحات"><input className={inputCls} value={edit.description || ''} onChange={(e) => setEdit({ ...edit, description: e.target.value })} /></Field>
            <label className="flex items-center gap-2 text-sm text-slate-300"><input type="checkbox" className="accent-amber-500 w-4 h-4" checked={!!edit.is_active} onChange={(e) => setEdit({ ...edit, is_active: e.target.checked ? 1 : 0 })} />فعال</label></div>
        </Modal>
      )}
    </Card>
  );
};

const OnlineTab: React.FC = () => {
  const ui = useUi();
  const { data, loading, reload } = useAsync(() => studio.settings(), []);
  if (loading && !data) return <LoadingState />;
  const on = (data as any)?.online_payment_enabled !== '0';
  const toggle = async () => { try { await studio.saveSettings({ online_payment_enabled: on ? '0' : '1' }); ui.success(); notifyMetaChanged(); reload(); } catch (e) { ui.error(e); } };
  return (
    <Card title="پرداخت آنلاین / بیعانه">
      <p className="text-sm text-slate-300 leading-7 mb-4">در صورت فعال بودن، هنگام ثبت نوبت می‌توان مبلغ بیعانه، متن پیامک، لینک پرداخت، یادآوری و لغو خودکار نوبت (در صورت عدم پرداخت تا مهلت) را تعریف کرد. درگاه فعلی آزمایشی است و ساختار آن برای اتصال به درگاه واقعی آماده است.</p>
      <label className="flex items-center gap-3 cursor-pointer"><input type="checkbox" className="accent-amber-500 w-5 h-5" checked={on} onChange={toggle} /><span className="text-sm">{on ? 'پرداخت آنلاین فعال است' : 'پرداخت آنلاین غیرفعال است'}</span></label>
    </Card>
  );
};
