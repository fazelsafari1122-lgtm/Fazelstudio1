import React, { useEffect, useState } from 'react';
import { Heart, Plus, Edit3, Trash2, Tag, ChevronRight, Phone, Send, CalendarIcon } from './icons.tsx';
import type { ActiveTab } from '../types.ts';
import { studio } from '../services/studioApi.ts';
import { useAsync, useDebounced, notifyDataChanged } from '../hooks.ts';
import { Btn, Card, ErrorState, LoadingState, PageHeader, SearchBox, StatCard, StatusBadge, Tabs, TagChip, inputCls, money, moneyT } from './ui/Common.tsx';
import { DataTable } from './ui/DataTable.tsx';
import { Modal } from './ui/Modal.tsx';
import { useUi } from './ui/UiProvider.tsx';
import { FamilyFormModal } from './ui/FamilyFormModal.tsx';
import { TagsManager } from './TagsManager.tsx';
import { AppointmentModal } from './AppointmentModal.tsx';
import { ProjectModal } from './ProjectModal.tsx';
import { InvoiceFormModal } from './InvoiceFormModal.tsx';
import { PaymentFormModal } from './PaymentFormModal.tsx';
import { FollowupModal } from './FollowupModal.tsx';
import { SmsComposeModal } from './SmsComposeModal.tsx';
import { toPersianDigits } from '../utils/jalali.ts';

interface Props {
  selectedId: number | null;
  onOpen: (id: number) => void;
  onBack: () => void;
  openAddSignal: number;
  onNavigate: (tab: ActiveTab, id?: number | null) => void;
}

export const FamiliesView: React.FC<Props> = ({ selectedId, onOpen, onBack, openAddSignal, onNavigate }) => {
  if (selectedId) return <FamilyProfile id={selectedId} onBack={onBack} onNavigate={onNavigate} />;
  return <FamilyList onOpen={onOpen} openAddSignal={openAddSignal} />;
};

const FamilyList: React.FC<{ onOpen: (id: number) => void; openAddSignal: number }> = ({ onOpen, openAddSignal }) => {
  const ui = useUi();
  const [q, setQ] = useState('');
  const dq = useDebounced(q, 250);
  const [tag, setTag] = useState(0);
  const [onlyDebt, setOnlyDebt] = useState(false);
  const [form, setForm] = useState<{ open: boolean; id: number | null }>({ open: false, id: null });
  const [showTags, setShowTags] = useState(false);
  const { data, loading, error, reload } = useAsync(() => studio.families({ q: dq, tag, debt: onlyDebt }), [dq, tag, onlyDebt]);
  const tags = useAsync(() => studio.tags(), []);

  useEffect(() => { if (openAddSignal > 0) setForm({ open: true, id: null }); }, [openAddSignal]);

  const remove = async (f: any) => {
    if (!(await ui.confirm(`آیا از حذف «${f.display_name}» مطمئن هستید؟`))) return;
    try { await studio.deleteFamily(f.id); ui.success('با موفقیت حذف شد'); notifyDataChanged(); reload(); } catch (e) { ui.error(e); }
  };

  const rows = data || [];
  const totalDebt = rows.reduce((s, f) => s + Number(f.debt || 0), 0);

  return (
    <div>
      <PageHeader title="مدیریت خانواده‌ها" subtitle="پرونده مشتریان به‌صورت خانواده؛ پدر، مادر و فرزندان" icon={<Heart className="w-5 h-5" />}
        actions={<><Btn onClick={() => setShowTags(true)}><Tag className="w-4 h-4" />مدیریت تگ‌ها</Btn><Btn variant="primary" onClick={() => setForm({ open: true, id: null })}><Plus className="w-4 h-4" />خانواده جدید</Btn></>} />
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
        <StatCard label="تعداد خانواده‌ها" value={toPersianDigits(rows.length)} tone="amber" icon={<Heart className="w-5 h-5" />} />
        <StatCard label="مجموع بدهی (در این فهرست)" value={moneyT(totalDebt)} tone="rose" />
        <StatCard label="بدهکاران" value={toPersianDigits(rows.filter((f) => f.debt > 0).length)} tone="sky" />
      </div>
      <Card>
        <div className="flex flex-wrap gap-2 mb-4">
          <SearchBox className="flex-1 min-w-[220px]" value={q} onChange={setQ} placeholder="جستجوی نام پدر، مادر، فرزند، نام خانوادگی یا موبایل..." />
          <select className={`${inputCls} w-auto`} value={tag} onChange={(e) => setTag(Number(e.target.value))} aria-label="فیلتر تگ">
            <option value={0}>همه تگ‌ها</option>
            {(tags.data || []).map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer"><input type="checkbox" className="accent-amber-500 w-4 h-4" checked={onlyDebt} onChange={(e) => setOnlyDebt(e.target.checked)} />فقط بدهکاران</label>
        </div>
        <DataTable
          rows={rows} rowKey={(f) => f.id} loading={loading} error={error} onRetry={reload} onAdd={() => setForm({ open: true, id: null })}
          exportName="families" onRowClick={(f) => onOpen(f.id)}
          emptyText={q || tag || onlyDebt ? 'خانواده‌ای با این مشخصات پیدا نشد' : 'اطلاعاتی برای نمایش وجود ندارد'}
          columns={[
            { key: 'name', header: 'خانواده', value: (f) => f.display_name, render: (f) => <div><div className="font-medium text-slate-100">{f.display_name}</div><div className="text-[11px] text-slate-400">{[f.father?.first_name, f.mother?.first_name].filter(Boolean).join(' و ')}</div></div> },
            { key: 'phone', header: 'موبایل', value: (f) => f.phone, render: (f) => <span dir="ltr">{toPersianDigits(f.phone || '')}</span> },
            { key: 'children', header: 'فرزندان', value: (f) => f.children.map((c: any) => c.first_name).join('، '), render: (f) => <span className="text-xs text-slate-300">{f.children.map((c: any) => c.first_name).join('، ') || '—'}</span> },
            { key: 'tags', header: 'تگ‌ها', noExport: true, render: (f) => <div className="flex flex-wrap gap-1">{f.tags.map((t: any) => <TagChip key={t.id} name={t.name} color={t.color} />)}</div> },
            { key: 'projects', header: 'پروژه‌ها', value: (f) => f.projects_count, render: (f) => toPersianDigits(f.projects_count) },
            { key: 'debt', header: 'بدهی', value: (f) => f.debt, render: (f) => (f.debt > 0 ? <span className="text-rose-300">{moneyT(f.debt)}</span> : <span className="text-emerald-400">تسویه</span>) },
            { key: 'actions', header: '', noExport: true, render: (f) => (
              <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                <Btn size="sm" variant="ghost" aria-label="ویرایش" onClick={() => setForm({ open: true, id: f.id })}><Edit3 className="w-4 h-4" /></Btn>
                <Btn size="sm" variant="ghost" aria-label="حذف" onClick={() => remove(f)}><Trash2 className="w-4 h-4 text-rose-400" /></Btn>
              </div>
            ) },
          ]}
        />
      </Card>
      <FamilyFormModal open={form.open} familyId={form.id} onClose={() => setForm({ open: false, id: null })} onSaved={(id) => { setForm({ open: false, id: null }); notifyDataChanged(); reload(); if (!form.id) onOpen(id); }} />
      <Modal open={showTags} onClose={() => setShowTags(false)} title="مدیریت تگ‌ها"><TagsManager onChanged={() => { tags.reload(); reload(); }} /></Modal>
    </div>
  );
};

const FamilyProfile: React.FC<{ id: number; onBack: () => void; onNavigate: (tab: ActiveTab, id?: number | null) => void }> = ({ id, onBack, onNavigate }) => {
  const ui = useUi();
  const { data, loading, error, reload } = useAsync(() => studio.family(id), [id]);
  const [tab, setTab] = useState('info');
  const [modal, setModal] = useState<string>('');

  if (loading && !data) return <LoadingState />;
  if (error || !data) return <ErrorState message={error || 'خانواده یافت نشد'} onRetry={reload} />;

  const { family, members, tags, projects, appointments, invoices, payments, followups, sms, summary } = data;
  const father = members.find((m: any) => m.role === 'father');
  const mother = members.find((m: any) => m.role === 'mother');
  const children = members.filter((m: any) => m.role === 'child');
  const done = () => { setModal(''); notifyDataChanged(); reload(); };

  const remove = async () => {
    if (!(await ui.confirm(`آیا از حذف «خانواده ${family.family_name}» مطمئن هستید؟`))) return;
    try { await studio.deleteFamily(id); ui.success('با موفقیت حذف شد'); onBack(); } catch (e) { ui.error(e); }
  };

  const person = (title: string, m: any) => (
    <div className="bg-slate-950/50 border border-slate-800 rounded-2xl p-3">
      <div className="text-[11px] text-amber-300 mb-1">{title}</div>
      {m ? (
        <>
          <div className="font-medium text-slate-100">{m.first_name} {m.last_name}</div>
          <div className="text-xs text-slate-400 mt-1 space-y-0.5">
            {m.phone && <div dir="ltr" className="text-right">{toPersianDigits(m.phone)}</div>}
            {m.birth_date && <div>تولد: {toPersianDigits(m.birth_date)}{m.age !== null && m.age !== undefined ? ` (${toPersianDigits(m.age)} ساله)` : ''}</div>}
            {m.job && <div>شغل: {m.job}</div>}
            {m.notes && <div>{m.notes}</div>}
          </div>
        </>
      ) : <div className="text-xs text-slate-500">ثبت نشده</div>}
    </div>
  );

  return (
    <div>
      <button onClick={onBack} className="flex items-center gap-1 text-xs text-slate-400 hover:text-white mb-3"><ChevronRight className="w-4 h-4" />بازگشت به فهرست خانواده‌ها</button>
      <PageHeader title={`خانواده ${family.family_name}`} subtitle={`ثبت: ${toPersianDigits(String(family.created_at || '').slice(0, 10))} • منبع: ${family.source || '—'}`} icon={<Heart className="w-5 h-5" />}
        actions={<><Btn onClick={() => setModal('edit')}><Edit3 className="w-4 h-4" />ویرایش</Btn><Btn variant="danger" onClick={remove}><Trash2 className="w-4 h-4" />حذف</Btn></>} />
      <div className="flex flex-wrap gap-1.5 mb-3">{tags.map((t: any) => <TagChip key={t.id} name={t.name} color={t.color} />)}</div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <StatCard label="جمع فاکتورها" value={moneyT(summary.invoiced)} tone="sky" />
        <StatCard label="پرداخت‌شده" value={moneyT(summary.paid)} tone="emerald" />
        <StatCard label="بدهی" value={moneyT(summary.debt)} tone={summary.debt > 0 ? 'rose' : 'emerald'} />
        <StatCard label="شماره تماس" value={<span dir="ltr">{toPersianDigits(family.phone || '—')}</span>} tone="amber" icon={<Phone className="w-5 h-5" />} />
      </div>
      <div className="flex flex-wrap gap-2 mb-4">
        <Btn size="sm" onClick={() => setModal('appointment')}><CalendarIcon className="w-4 h-4" />نوبت جدید</Btn>
        <Btn size="sm" onClick={() => setModal('project')}>پروژه جدید</Btn>
        <Btn size="sm" onClick={() => setModal('invoice')}>فاکتور جدید</Btn>
        <Btn size="sm" onClick={() => setModal('payment')}>ثبت پرداخت</Btn>
        <Btn size="sm" onClick={() => setModal('followup')}><Phone className="w-4 h-4" />پیگیری جدید</Btn>
        <Btn size="sm" onClick={() => setModal('sms')}><Send className="w-4 h-4" />ارسال پیامک</Btn>
      </div>

      <Tabs value={tab} onChange={setTab} tabs={[
        { id: 'info', label: 'اطلاعات خانواده' }, { id: 'projects', label: 'پروژه‌ها', count: projects.length }, { id: 'appointments', label: 'نوبت‌ها', count: appointments.length },
        { id: 'invoices', label: 'فاکتورها', count: invoices.length }, { id: 'payments', label: 'پرداخت‌ها', count: payments.length },
        { id: 'followups', label: 'پیگیری‌ها', count: followups.length }, { id: 'sms', label: 'پیامک‌ها', count: sms.length },
      ]} />

      {tab === 'info' && (
        <div className="space-y-4">
          <div className="grid md:grid-cols-2 gap-3">{person('پدر / آقا', father)}{person('مادر / خانم', mother)}</div>
          <Card title={`فرزندان (${toPersianDigits(children.length)})`}>
            {children.length === 0 ? <p className="text-sm text-slate-500">فرزندی ثبت نشده است.</p> : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {children.map((c: any) => (
                  <div key={c.id} className="bg-slate-950/50 border border-slate-800 rounded-xl p-3 text-sm">
                    <div className="font-medium text-slate-100">{c.first_name} {c.last_name} <span className="text-xs text-slate-400">({c.gender || '—'})</span></div>
                    <div className="text-xs text-slate-400 mt-1">{c.birth_date ? `تولد ${toPersianDigits(c.birth_date)}` : 'تاریخ تولد ثبت نشده'}{c.age !== null && c.age !== undefined ? ` • ${toPersianDigits(c.age)} ساله` : ''}</div>
                    {c.notes && <div className="text-xs text-slate-500 mt-1">{c.notes}</div>}
                  </div>
                ))}
              </div>
            )}
          </Card>
          {family.notes && <Card title="توضیحات"><p className="text-sm text-slate-300 leading-7">{family.notes}</p></Card>}
        </div>
      )}

      {tab === 'projects' && <DataTable rows={projects} rowKey={(p: any) => p.id} onAdd={() => setModal('project')} onRowClick={(p: any) => onNavigate('projects', p.id)} columns={[
        { key: 'code', header: 'شماره', value: (p: any) => p.project_code }, { key: 'name', header: 'عنوان', value: (p: any) => p.name }, { key: 'type', header: 'نوع', value: (p: any) => p.project_type },
        { key: 'date', header: 'تاریخ', value: (p: any) => p.project_date, render: (p: any) => toPersianDigits(p.project_date) },
        { key: 'status', header: 'وضعیت', value: (p: any) => p.status, render: (p: any) => <StatusBadge status={p.status} tone="violet" /> },
        { key: 'amount', header: 'مبلغ', value: (p: any) => p.amount, render: (p: any) => moneyT(p.amount) }, { key: 'remaining', header: 'مانده', value: (p: any) => p.remaining, render: (p: any) => moneyT(p.remaining) },
      ]} />}

      {tab === 'appointments' && <DataTable rows={appointments} rowKey={(a: any) => a.id} onAdd={() => setModal('appointment')} columns={[
        { key: 'date', header: 'تاریخ', value: (a: any) => a.date, render: (a: any) => toPersianDigits(a.date) }, { key: 'time', header: 'ساعت', value: (a: any) => a.start_time, render: (a: any) => toPersianDigits(`${a.start_time} - ${a.end_time}`) },
        { key: 'hall', header: 'سالن', value: (a: any) => `${a.branch_name} / ${a.hall_name}` }, { key: 'type', header: 'نوع', value: (a: any) => a.project_type },
        { key: 'status', header: 'وضعیت', value: (a: any) => a.status, render: (a: any) => <StatusBadge status={a.status} /> },
      ]} />}

      {tab === 'invoices' && <DataTable rows={invoices} rowKey={(i: any) => i.id} onAdd={() => setModal('invoice')} columns={[
        { key: 'num', header: 'شماره', value: (i: any) => i.invoice_number }, { key: 'date', header: 'تاریخ', value: (i: any) => i.issue_date, render: (i: any) => toPersianDigits(i.issue_date) },
        { key: 'total', header: 'مبلغ نهایی', value: (i: any) => i.total, render: (i: any) => moneyT(i.total) }, { key: 'paid', header: 'پرداخت‌شده', value: (i: any) => i.paid_amount, render: (i: any) => moneyT(i.paid_amount) },
        { key: 'rem', header: 'مانده', value: (i: any) => i.remaining_amount, render: (i: any) => moneyT(i.remaining_amount) }, { key: 'status', header: 'وضعیت', value: (i: any) => i.status, render: (i: any) => <StatusBadge status={i.status} /> },
      ]} />}

      {tab === 'payments' && <DataTable rows={payments} rowKey={(p: any) => p.id} onAdd={() => setModal('payment')} columns={[
        { key: 'date', header: 'تاریخ', value: (p: any) => p.payment_date, render: (p: any) => toPersianDigits(`${p.payment_date} ${p.payment_time || ''}`) }, { key: 'amount', header: 'مبلغ', value: (p: any) => p.amount, render: (p: any) => moneyT(p.amount) },
        { key: 'method', header: 'روش', value: (p: any) => p.payment_method }, { key: 'bank', header: 'بانک/صندوق', value: (p: any) => p.bank_account }, { key: 'track', header: 'پیگیری', value: (p: any) => p.tracking_code },
      ]} />}

      {tab === 'followups' && <DataTable rows={followups} rowKey={(f: any) => f.id} onAdd={() => setModal('followup')} columns={[
        { key: 'title', header: 'عنوان', value: (f: any) => f.title }, { key: 'due', header: 'موعد', value: (f: any) => f.due_date, render: (f: any) => toPersianDigits(`${f.due_date} ${f.due_time || ''}`) },
        { key: 'prio', header: 'اولویت', value: (f: any) => f.priority, render: (f: any) => <StatusBadge status={f.priority} /> }, { key: 'status', header: 'وضعیت', value: (f: any) => f.status, render: (f: any) => <StatusBadge status={f.status} /> },
      ]} />}

      {tab === 'sms' && <DataTable rows={sms} rowKey={(s: any) => s.id} onAdd={() => setModal('sms')} columns={[
        { key: 'date', header: 'تاریخ', value: (s: any) => s.sent_date || '', render: (s: any) => toPersianDigits(`${s.sent_date || '—'} ${s.sent_time || ''}`) }, { key: 'body', header: 'متن', value: (s: any) => s.message_body, render: (s: any) => <span className="text-xs">{toPersianDigits(s.message_body)}</span> },
        { key: 'status', header: 'وضعیت', value: (s: any) => s.status, render: (s: any) => <StatusBadge status={s.status} /> },
      ]} />}

      <FamilyFormModal open={modal === 'edit'} familyId={id} onClose={() => setModal('')} onSaved={done} />
      <AppointmentModal open={modal === 'appointment'} onClose={() => setModal('')} onSaved={done} defaults={{ customer_id: id }} />
      <ProjectModal open={modal === 'project'} onClose={() => setModal('')} onSaved={done} defaults={{ customer_id: id }} />
      <InvoiceFormModal open={modal === 'invoice'} onClose={() => setModal('')} onSaved={done} defaults={{ customer_id: id }} />
      <PaymentFormModal open={modal === 'payment'} onClose={() => setModal('')} onSaved={done} defaults={{ customer_id: id }} />
      <FollowupModal open={modal === 'followup'} onClose={() => setModal('')} onSaved={done} defaults={{ customer_id: id }} />
      <SmsComposeModal open={modal === 'sms'} onClose={() => setModal('')} onSent={done} defaults={{ customer_id: id, phone: family.phone }} />
    </div>
  );
};
