import React, { useState } from 'react';
import { Phone, Plus, Check, X, Edit3, Trash2, CalendarIcon } from './icons.tsx';
import { studio } from '../services/studioApi.ts';
import { useAsync, useDebounced, notifyDataChanged } from '../hooks.ts';
import { Btn, Card, ErrorState, Field, LoadingState, PageHeader, SearchBox, StatCard, StatusBadge, Tabs, inputCls, EmptyState } from './ui/Common.tsx';
import { Modal } from './ui/Modal.tsx';
import { PersianDatePicker } from './ui/PersianDatePicker.tsx';
import { TimePicker } from './ui/TimePicker.tsx';
import { useUi } from './ui/UiProvider.tsx';
import { FollowupModal } from './FollowupModal.tsx';
import { getTodayJalali, toPersianDigits } from '../utils/jalali.ts';
import { exportCsv } from './ui/csv.ts';

export const FollowupsView: React.FC<{ onOpenFamily: (id: number) => void }> = ({ onOpenFamily }) => {
  const ui = useUi();
  const [tab, setTab] = useState<'mine' | 'all' | 'closed'>('mine');
  const [q, setQ] = useState('');
  const dq = useDebounced(q, 250);
  const [priority, setPriority] = useState('');
  const [edit, setEdit] = useState<{ open: boolean; item: any | null }>({ open: false, item: null });
  const [next, setNext] = useState<any>(null);
  const { data, loading, error, reload } = useAsync(
    () => studio.followups({ mine: tab === 'mine', open: tab !== 'closed', status: tab === 'closed' ? 'بسته شده' : undefined, priority, q: dq }),
    [tab, dq, priority],
  );
  const today = getTodayJalali();
  const rows = data || [];

  const act = async (fn: () => Promise<any>, msg?: string) => {
    try { await fn(); ui.success(msg); notifyDataChanged(); reload(); } catch (e) { ui.error(e); }
  };
  const remove = async (f: any) => {
    if (!(await ui.confirm(`آیا از حذف پیگیری «${f.title}» مطمئن هستید؟`))) return;
    act(() => studio.deleteFollowup(f.id), 'با موفقیت حذف شد');
  };
  const close = async (f: any) => {
    if (!(await ui.confirm('این پیگیری بدون انجام بسته شود؟', { danger: false, confirmLabel: 'بستن' }))) return;
    act(() => studio.closeFollowup(f.id), 'پیگیری بسته شد');
  };

  const overdue = rows.filter((f) => f.overdue).length;
  const doExport = () => exportCsv('followups', [
    { header: 'عنوان', value: (f: any) => f.title }, { header: 'خانواده', value: (f: any) => f.customer_last || '' }, { header: 'مسئول', value: (f: any) => f.assignee || '' },
    { header: 'تاریخ', value: (f: any) => f.due_date }, { header: 'ساعت', value: (f: any) => f.due_time || '' }, { header: 'اولویت', value: (f: any) => f.priority }, { header: 'وضعیت', value: (f: any) => f.status },
  ], rows);

  return (
    <div>
      <PageHeader title="پیگیری مشتریان" subtitle="پیگیری‌های من و تیم؛ انجام شد، پیگیری بعدی، بستن" icon={<Phone className="w-5 h-5" />}
        actions={<><Btn onClick={doExport} disabled={!rows.length}>خروجی اکسل</Btn><Btn variant="primary" onClick={() => setEdit({ open: true, item: null })}><Plus className="w-4 h-4" />پیگیری جدید</Btn></>} />
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
        <StatCard label="در این فهرست" value={toPersianDigits(rows.length)} tone="amber" icon={<Phone className="w-5 h-5" />} />
        <StatCard label="موعدگذشته / امروز" value={toPersianDigits(overdue)} tone={overdue ? 'rose' : 'emerald'} />
        <StatCard label="فوری" value={toPersianDigits(rows.filter((f) => f.priority === 'فوری').length)} tone="violet" />
      </div>
      <Tabs value={tab} onChange={(t) => setTab(t as any)} tabs={[{ id: 'mine', label: 'پیگیری‌های من' }, { id: 'all', label: 'همه پیگیری‌های باز' }, { id: 'closed', label: 'بسته‌شده' }]} />
      <div className="flex flex-wrap gap-2 mb-4">
        <SearchBox className="flex-1 min-w-[200px]" value={q} onChange={setQ} placeholder="جستجوی عنوان، مشتری یا مسئول..." />
        <select className={`${inputCls} w-auto`} value={priority} onChange={(e) => setPriority(e.target.value)} aria-label="اولویت"><option value="">همه اولویت‌ها</option>{['عادی', 'بالا', 'فوری'].map((p) => <option key={p}>{p}</option>)}</select>
      </div>
      {loading && !data ? <LoadingState /> : error ? <ErrorState message={error} onRetry={reload} /> : rows.length === 0 ? <Card><EmptyState onAdd={() => setEdit({ open: true, item: null })} /></Card> : (
        <div className="space-y-2">
          {rows.map((f) => (
            <Card key={f.id} className={f.overdue ? '!border-rose-500/40' : ''}>
              <div className="flex flex-wrap items-start gap-3">
                <div className="flex-1 min-w-[220px]">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="font-semibold text-slate-100">{f.title}</span>
                    <StatusBadge status={f.priority} /><StatusBadge status={f.status} />
                    {f.status === 'بسته شده' && f.outcome && <span className="text-[11px] text-slate-500">({f.outcome})</span>}
                  </div>
                  {f.description && <p className="text-xs text-slate-400 mb-1">{f.description}</p>}
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-400">
                    {f.customer_id && <button className="text-amber-300 hover:underline" onClick={() => onOpenFamily(f.customer_id)}>خانواده {f.customer_last}</button>}
                    {f.customer_phone && <span dir="ltr">{toPersianDigits(f.customer_phone)}</span>}
                    <span>مسئول: {f.assignee || '—'}</span>
                    <span className={f.overdue ? 'text-rose-300' : ''}><CalendarIcon className="w-3 h-3 inline ml-1" />{toPersianDigits(`${f.due_date} ${f.due_time || ''}`)}{f.due_date < today && f.status !== 'بسته شده' ? ' (موعدگذشته)' : ''}</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {f.status !== 'بسته شده' && <>
                    <Btn size="sm" variant="primary" onClick={() => act(() => studio.doneFollowup(f.id), 'پیگیری انجام شد')}><Check className="w-4 h-4" />انجام شد</Btn>
                    <Btn size="sm" onClick={() => setNext({ f, date: '', time: f.due_time || '10:00' })}>پیگیری بعدی</Btn>
                    <Btn size="sm" onClick={() => close(f)}><X className="w-4 h-4" />بستن</Btn>
                  </>}
                  <Btn size="sm" variant="ghost" aria-label="ویرایش" onClick={() => setEdit({ open: true, item: f })}><Edit3 className="w-4 h-4" /></Btn>
                  <Btn size="sm" variant="ghost" aria-label="حذف" onClick={() => remove(f)}><Trash2 className="w-4 h-4 text-rose-400" /></Btn>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
      <FollowupModal open={edit.open} followup={edit.item} onClose={() => setEdit({ open: false, item: null })} onSaved={() => { setEdit({ open: false, item: null }); reload(); }} />
      {next && (
        <Modal open onClose={() => setNext(null)} size="sm" title="پیگیری بعدی"
          footer={<><Btn onClick={() => setNext(null)}>انصراف</Btn><Btn variant="primary" disabled={!next.date} onClick={() => { const n = next; act(() => studio.nextFollowup(n.f.id, n.date, n.time), 'پیگیری به تاریخ جدید منتقل شد').then(() => setNext(null)); }}>ثبت</Btn></>}>
          <p className="text-sm text-slate-300 mb-3">«{next.f.title}» به چه زمانی منتقل شود؟</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="تاریخ"><PersianDatePicker min={today} value={next.date} onChange={(v) => setNext({ ...next, date: v })} /></Field>
            <Field label="ساعت"><TimePicker value={next.time} onChange={(v) => setNext({ ...next, time: v })} step={15} /></Field>
          </div>
        </Modal>
      )}
    </div>
  );
};
