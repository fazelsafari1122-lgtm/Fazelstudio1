import React, { useEffect, useMemo, useState } from 'react';
import { FolderGit2, Plus, Edit3, Trash2, ChevronRight, CalendarIcon, Clock } from './icons.tsx';
import { studio } from '../services/studioApi.ts';
import { useAsync, useDebounced, useLocalStorage, useMeta, notifyDataChanged } from '../hooks.ts';
import { Btn, Card, ErrorState, LoadingState, PageHeader, SearchBox, StatusBadge, Tabs, inputCls, moneyT } from './ui/Common.tsx';
import { DataTable } from './ui/DataTable.tsx';
import { useUi } from './ui/UiProvider.tsx';
import { ProjectModal } from './ProjectModal.tsx';
import { InvoiceFormModal } from './InvoiceFormModal.tsx';
import { getTodayJalali, toPersianDigits } from '../utils/jalali.ts';

interface Props {
  selectedId: number | null;
  openAddSignal: number;
  onOpenProject: (id: number) => void;
  onBack: () => void;
  onOpenFamily: (id: number) => void;
}

export const ProjectsView: React.FC<Props> = ({ selectedId, openAddSignal, onOpenProject, onBack, onOpenFamily }) => {
  if (selectedId) return <ProjectDetail id={selectedId} onBack={onBack} onOpenFamily={onOpenFamily} />;
  return <ProjectBoard openAddSignal={openAddSignal} onOpenProject={onOpenProject} />;
};

const isOverdue = (p: any, today: string) => !!p.deadline && p.deadline < today && !['تحویل شده', 'لغو شده'].includes(p.status);

const ProjectCard: React.FC<{ p: any; today: string; onOpen: () => void; onEdit: () => void; draggable?: boolean; onDragStart?: (e: React.DragEvent) => void }> = ({ p, today, onOpen, onEdit, draggable, onDragStart }) => (
  <div draggable={draggable} onDragStart={onDragStart} onClick={onOpen}
    className="bg-slate-900 border border-slate-700/80 hover:border-amber-500/50 rounded-xl p-3 cursor-pointer active:cursor-grabbing space-y-1.5 shadow-sm">
    <div className="flex items-center justify-between gap-2">
      <span className="text-[11px] text-amber-300 font-mono">{p.project_code}</span>
      <button onClick={(e) => { e.stopPropagation(); onEdit(); }} className="text-slate-500 hover:text-slate-200" aria-label="ویرایش"><Edit3 className="w-3.5 h-3.5" /></button>
    </div>
    <div className="text-sm font-semibold text-slate-100 leading-5">{p.customer_last ? `خانواده ${p.customer_last}` : p.customer_first}</div>
    <div className="text-xs text-slate-300 truncate">{p.name}</div>
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-400">
      <span>{p.project_type}</span>
      <span className="inline-flex items-center gap-1"><CalendarIcon className="w-3 h-3" />{toPersianDigits(p.project_date)}</span>
      {p.assignee && <span>مسئول: {p.assignee}</span>}
    </div>
    <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-800">
      <span className="text-slate-300">{moneyT(p.amount)}</span>
      <span className={p.remaining > 0 ? 'text-rose-300' : 'text-emerald-400'}>{p.remaining > 0 ? `بدهی ${moneyT(p.remaining)}` : 'تسویه'}</span>
    </div>
    {p.deadline && <div className={`flex items-center gap-1 text-[11px] ${isOverdue(p, today) ? 'text-rose-300' : 'text-slate-400'}`}><Clock className="w-3 h-3" />Deadline: {toPersianDigits(p.deadline)}{isOverdue(p, today) ? ' (گذشته)' : ''}</div>}
    {p.notes && <div className="text-[11px] text-slate-500 truncate">{p.notes}</div>}
  </div>
);

const ProjectBoard: React.FC<{ openAddSignal: number; onOpenProject: (id: number) => void }> = ({ openAddSignal, onOpenProject }) => {
  const ui = useUi();
  const meta = useMeta();
  const today = getTodayJalali();
  const [view, setView] = useLocalStorage<'kanban' | 'table'>('studio_projects_view', 'kanban');
  const [q, setQ] = useState('');
  const dq = useDebounced(q, 200);
  const [assignee, setAssignee] = useState('');
  const [edit, setEdit] = useState<{ open: boolean; project: any | null }>({ open: false, project: null });
  const [dragId, setDragId] = useState<number | null>(null);
  const [overStage, setOverStage] = useState('');
  const [showStages, setShowStages] = useState(false);
  const projects = useAsync(() => studio.projects(), []);

  useEffect(() => { if (openAddSignal > 0) setEdit({ open: true, project: null }); }, [openAddSignal]);

  const stages: any[] = meta?.stages || [];
  const all = projects.data || [];
  const filtered = useMemo(() => {
    const n = dq.trim().toLowerCase();
    return all.filter((p) => (!assignee || p.assignee === assignee) && (!n || [p.project_code, p.name, p.customer_first, p.customer_last, p.project_type, p.assignee].join(' ').toLowerCase().includes(n)));
  }, [all, dq, assignee]);

  const move = async (id: number, status: string) => {
    const p = all.find((x) => x.id === id);
    if (!p || p.status === status) return;
    const prev = all;
    projects.setData(all.map((x) => (x.id === id ? { ...x, status } : x))); // optimistic
    try {
      await studio.setProjectStatus(id, status);
      ui.success(`وضعیت پروژه به «${status}» تغییر کرد`);
      notifyDataChanged();
      projects.reload();
    } catch (e) {
      projects.setData(prev);
      ui.error(e);
    }
  };

  const remove = async (p: any) => {
    if (!(await ui.confirm(`آیا از حذف پروژه «${p.name}» مطمئن هستید؟`))) return;
    try { await studio.deleteProject(p.id); ui.success('با موفقیت حذف شد'); notifyDataChanged(); projects.reload(); } catch (e) { ui.error(e); }
  };

  const known = new Set(stages.map((s) => s.name));
  const orphan = filtered.filter((p) => !known.has(p.status));

  return (
    <div>
      <PageHeader title="مدیریت پروژه" subtitle="نمای Kanban و جدول؛ با کشیدن کارت‌ها وضعیت پروژه تغییر می‌کند" icon={<FolderGit2 className="w-5 h-5" />}
        actions={<>
          <Btn onClick={() => setShowStages(true)}>ستون‌ها</Btn>
          <Btn variant="primary" onClick={() => setEdit({ open: true, project: null })}><Plus className="w-4 h-4" />پروژه جدید</Btn>
        </>} />
      <Card className="mb-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-xl overflow-hidden border border-slate-700">
            {(['kanban', 'table'] as const).map((v) => <button key={v} onClick={() => setView(v)} className={`px-4 py-2 text-sm ${view === v ? 'bg-amber-500 text-slate-950 font-semibold' : 'bg-slate-900 text-slate-300 hover:bg-slate-800'}`}>{v === 'kanban' ? 'Kanban' : 'جدول'}</button>)}
          </div>
          <SearchBox className="flex-1 min-w-[200px]" value={q} onChange={setQ} placeholder="جستجوی شماره پروژه، خانواده، عنوان..." />
          <select className={`${inputCls} w-auto`} value={assignee} onChange={(e) => setAssignee(e.target.value)} aria-label="فیلتر مسئول">
            <option value="">همه مسئول‌ها</option>
            {[...new Set(all.map((p) => p.assignee).filter(Boolean))].map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
      </Card>

      {projects.loading && !projects.data ? <LoadingState /> : projects.error ? <ErrorState message={projects.error} onRetry={projects.reload} /> : view === 'kanban' ? (
        <div className="flex gap-3 overflow-x-auto pb-4 items-start">
          {stages.map((s, idx) => {
            const col = filtered.filter((p) => p.status === s.name || (idx === 0 && orphan.includes(p)));
            return (
              <div key={s.id}
                onDragOver={(e) => { e.preventDefault(); setOverStage(s.name); }}
                onDragLeave={() => setOverStage((o) => (o === s.name ? '' : o))}
                onDrop={(e) => { e.preventDefault(); setOverStage(''); if (dragId) move(dragId, s.name); setDragId(null); }}
                className={`w-72 shrink-0 rounded-2xl border bg-slate-900/60 transition-colors ${overStage === s.name ? 'border-amber-400 bg-amber-500/5' : 'border-slate-800'}`}>
                <div className="flex items-center justify-between px-3 py-2.5 border-b border-slate-800" style={{ borderTop: `3px solid ${s.color}`, borderRadius: '1rem 1rem 0 0' }}>
                  <span className="text-sm font-semibold text-slate-100">{s.name}</span>
                  <span className="text-[11px] px-2 py-0.5 rounded-lg bg-slate-800 text-slate-300">{toPersianDigits(col.length)}</span>
                </div>
                <div className="p-2 space-y-2 min-h-[120px] max-h-[68vh] overflow-y-auto">
                  {col.map((p) => (
                    <ProjectCard key={p.id} p={p} today={today} draggable onDragStart={(e) => { setDragId(p.id); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(p.id)); }}
                      onOpen={() => onOpenProject(p.id)} onEdit={() => setEdit({ open: true, project: p })} />
                  ))}
                  {col.length === 0 && <div className="text-center text-[11px] text-slate-600 py-6">کارتی وجود ندارد</div>}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <Card>
          <DataTable rows={filtered} rowKey={(p) => p.id} onAdd={() => setEdit({ open: true, project: null })} exportName="projects" onRowClick={(p) => onOpenProject(p.id)}
            columns={[
              { key: 'code', header: 'شماره پروژه', value: (p) => p.project_code },
              { key: 'family', header: 'خانواده', value: (p) => `${p.customer_first} ${p.customer_last}`, render: (p) => `خانواده ${p.customer_last}` },
              { key: 'type', header: 'نوع پروژه', value: (p) => p.project_type },
              { key: 'date', header: 'تاریخ', value: (p) => p.project_date, render: (p) => toPersianDigits(p.project_date) },
              { key: 'assignee', header: 'مسئول', value: (p) => p.assignee || '' },
              { key: 'status', header: 'وضعیت', value: (p) => p.status, render: (p) => (
                <select className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs" value={p.status} onClick={(e) => e.stopPropagation()} onChange={(e) => move(p.id, e.target.value)}>
                  {stages.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
                </select>
              ) },
              { key: 'amount', header: 'مبلغ', value: (p) => p.amount, render: (p) => moneyT(p.amount) },
              { key: 'paid', header: 'پرداخت‌شده', value: (p) => p.paid, render: (p) => moneyT(p.paid) },
              { key: 'remaining', header: 'مانده', value: (p) => p.remaining, render: (p) => <span className={p.remaining > 0 ? 'text-rose-300' : 'text-emerald-400'}>{moneyT(p.remaining)}</span> },
              { key: 'actions', header: 'عملیات', noExport: true, render: (p) => (
                <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                  <Btn size="sm" variant="ghost" aria-label="ویرایش" onClick={() => setEdit({ open: true, project: p })}><Edit3 className="w-4 h-4" /></Btn>
                  <Btn size="sm" variant="ghost" aria-label="حذف" onClick={() => remove(p)}><Trash2 className="w-4 h-4 text-rose-400" /></Btn>
                </div>
              ) },
            ]} />
        </Card>
      )}

      <ProjectModal open={edit.open} project={edit.project} onClose={() => setEdit({ open: false, project: null })} onSaved={() => { setEdit({ open: false, project: null }); projects.reload(); }} />
      <StagesManager open={showStages} onClose={() => setShowStages(false)} />
    </div>
  );
};

export const StagesManager: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const ui = useUi();
  const { data, loading, reload } = useAsync(() => (open ? studio.stages() : Promise.resolve([])), [open]);
  const [name, setName] = useState('');
  const [color, setColor] = useState('#38bdf8');
  const changed = () => { reload(); window.dispatchEvent(new Event('studio-meta-changed')); };
  const add = async () => { try { await studio.saveStage({ name, color }); ui.success(); setName(''); changed(); } catch (e) { ui.error(e); } };
  const rename = async (s: any, v: string) => { if (!v.trim() || v === s.name) return; try { await studio.saveStage({ id: s.id, name: v, color: s.color }); ui.success(); changed(); } catch (e) { ui.error(e); reload(); } };
  const del = async (s: any) => { if (!(await ui.confirm(`آیا از حذف ستون «${s.name}» مطمئن هستید؟`))) return; try { await studio.deleteStage(s.id); ui.success('با موفقیت حذف شد'); changed(); } catch (e) { ui.error(e); } };
  const shift = async (i: number, d: number) => {
    const list = [...(data || [])]; const j = i + d; if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    try { await studio.reorderStages(list.map((s) => s.id)); changed(); } catch (e) { ui.error(e); }
  };
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[90] bg-black/70 flex items-center justify-center p-4" dir="rtl" onMouseDown={onClose}>
      <div className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl p-4 max-h-[88vh] overflow-y-auto" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3"><h2 className="font-semibold">ستون‌های Kanban (وضعیت پروژه)</h2><Btn size="sm" variant="ghost" onClick={onClose}>بستن</Btn></div>
        <div className="flex gap-2 mb-3">
          <input className={`${inputCls} flex-1`} placeholder="وضعیت جدید" value={name} onChange={(e) => setName(e.target.value)} />
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-10 h-10 rounded-lg bg-slate-950 border border-slate-700" aria-label="رنگ" />
          <Btn variant="primary" disabled={!name.trim()} onClick={add}><Plus className="w-4 h-4" />افزودن</Btn>
        </div>
        {loading ? <LoadingState /> : (
          <ul className="divide-y divide-slate-800 border border-slate-800 rounded-xl">
            {(data || []).map((s: any, i: number) => (
              <li key={s.id} className="flex items-center gap-2 px-3 py-2">
                <span className="w-3 h-3 rounded-full shrink-0" style={{ background: s.color }} />
                {s.is_system ? <span className="flex-1 text-sm text-slate-200">{s.name} <span className="text-[10px] text-slate-500">(سیستمی)</span></span>
                  : <input className="flex-1 bg-transparent text-sm text-slate-100 border-b border-transparent focus:border-amber-500 outline-none" defaultValue={s.name} onBlur={(e) => rename(s, e.target.value)} />}
                <span className="text-[11px] text-slate-500">{toPersianDigits(s.projects_count)} پروژه</span>
                <Btn size="sm" variant="ghost" aria-label="بالا" onClick={() => shift(i, -1)}>▲</Btn>
                <Btn size="sm" variant="ghost" aria-label="پایین" onClick={() => shift(i, 1)}>▼</Btn>
                {!s.is_system && <Btn size="sm" variant="ghost" aria-label="حذف" onClick={() => del(s)}><Trash2 className="w-4 h-4 text-rose-400" /></Btn>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

const ProjectDetail: React.FC<{ id: number; onBack: () => void; onOpenFamily: (id: number) => void }> = ({ id, onBack, onOpenFamily }) => {
  const ui = useUi();
  const meta = useMeta();
  const { data, loading, error, reload } = useAsync(() => studio.project(id), [id]);
  const [edit, setEdit] = useState(false);
  const [invoice, setInvoice] = useState(false);
  const [tab, setTab] = useState('info');
  if (loading && !data) return <LoadingState />;
  if (error || !data) return <ErrorState message={error || 'پروژه یافت نشد'} onRetry={reload} />;
  const p = data;
  const move = async (status: string) => { try { await studio.setProjectStatus(id, status); ui.success(`وضعیت پروژه به «${status}» تغییر کرد`); notifyDataChanged(); reload(); } catch (e) { ui.error(e); } };
  const KIND: Record<string, string> = { photo: 'عکس', video: 'فیلم', album: 'آلبوم' };
  return (
    <div>
      <button onClick={onBack} className="flex items-center gap-1 text-xs text-slate-400 hover:text-white mb-3"><ChevronRight className="w-4 h-4" />بازگشت به پروژه‌ها</button>
      <PageHeader title={`${p.project_code} — ${p.name}`} subtitle={`خانواده ${p.customer_last}`} icon={<FolderGit2 className="w-5 h-5" />}
        actions={<><Btn onClick={() => onOpenFamily(p.customer_id)}>پرونده خانواده</Btn><Btn onClick={() => setInvoice(true)}>فاکتور جدید</Btn><Btn variant="primary" onClick={() => setEdit(true)}><Edit3 className="w-4 h-4" />ویرایش</Btn></>} />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <Card><div className="text-[11px] text-slate-400">مبلغ</div><div className="font-bold">{moneyT(p.amount)}</div></Card>
        <Card><div className="text-[11px] text-slate-400">پرداخت‌شده</div><div className="font-bold text-emerald-400">{moneyT(p.paid)}</div></Card>
        <Card><div className="text-[11px] text-slate-400">مانده</div><div className={`font-bold ${p.remaining > 0 ? 'text-rose-300' : 'text-emerald-400'}`}>{moneyT(p.remaining)}</div></Card>
        <Card><div className="text-[11px] text-slate-400">وضعیت</div>
          <select className={`${inputCls} mt-1`} value={p.status} onChange={(e) => move(e.target.value)}>{(meta?.stages || []).map((s: any) => <option key={s.id} value={s.name}>{s.name}</option>)}</select>
        </Card>
      </div>
      <Tabs value={tab} onChange={setTab} tabs={[{ id: 'info', label: 'مشخصات' }, { id: 'prep', label: 'آماده‌سازی', count: p.prep.length }, { id: 'invoices', label: 'فاکتورها', count: p.invoices.length }, { id: 'appts', label: 'نوبت‌ها', count: p.appointments.length }]} />
      {tab === 'info' && (
        <Card><dl className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          <div><dt className="text-xs text-slate-400">نوع پروژه</dt><dd>{p.project_type}</dd></div>
          <div><dt className="text-xs text-slate-400">تاریخ</dt><dd>{toPersianDigits(p.project_date)}</dd></div>
          <div><dt className="text-xs text-slate-400">Deadline</dt><dd>{p.deadline ? toPersianDigits(p.deadline) : '—'}</dd></div>
          <div><dt className="text-xs text-slate-400">مسئول</dt><dd>{p.assignee || '—'}</dd></div>
          <div><dt className="text-xs text-slate-400">محل</dt><dd>{p.location || '—'}</dd></div>
          <div><dt className="text-xs text-slate-400">قرارداد</dt><dd>{p.contract_number || '—'}</dd></div>
          {p.notes && <div className="col-span-full"><dt className="text-xs text-slate-400">توضیحات</dt><dd>{p.notes}</dd></div>}
        </dl></Card>
      )}
      {tab === 'prep' && (p.prep.length === 0 ? <Card><p className="text-sm text-slate-400">این پروژه هنوز وارد مرحله آماده‌سازی نشده است. با انتقال به ستون «آماده‌سازی عکس/فیلم/آلبوم» به‌صورت خودکار ثبت می‌شود.</p></Card> : (
        <div className="grid md:grid-cols-3 gap-3">{p.prep.map((t: any) => <Card key={t.id} title={`آماده‌سازی ${KIND[t.kind]}`}><StatusBadge status={t.stage} tone="violet" /><div className="text-xs text-slate-400 mt-2">مسئول: {t.assignee || '—'}</div><div className="text-xs text-slate-400">Deadline: {t.deadline ? toPersianDigits(t.deadline) : '—'}</div></Card>)}</div>
      ))}
      {tab === 'invoices' && <DataTable rows={p.invoices} rowKey={(i: any) => i.id} onAdd={() => setInvoice(true)} columns={[
        { key: 'n', header: 'شماره', value: (i: any) => i.invoice_number }, { key: 't', header: 'مبلغ', value: (i: any) => i.total, render: (i: any) => moneyT(i.total) },
        { key: 'r', header: 'مانده', value: (i: any) => i.remaining_amount, render: (i: any) => moneyT(i.remaining_amount) }, { key: 's', header: 'وضعیت', value: (i: any) => i.status, render: (i: any) => <StatusBadge status={i.status} /> },
      ]} />}
      {tab === 'appts' && <DataTable rows={p.appointments} rowKey={(a: any) => a.id} columns={[
        { key: 'd', header: 'تاریخ', value: (a: any) => a.date, render: (a: any) => toPersianDigits(a.date) }, { key: 't', header: 'ساعت', value: (a: any) => a.start_time, render: (a: any) => toPersianDigits(a.start_time) },
        { key: 'h', header: 'سالن', value: (a: any) => a.hall_name }, { key: 's', header: 'وضعیت', value: (a: any) => a.status, render: (a: any) => <StatusBadge status={a.status} /> },
      ]} />}
      <ProjectModal open={edit} project={p} onClose={() => setEdit(false)} onSaved={() => { setEdit(false); reload(); }} />
      <InvoiceFormModal open={invoice} onClose={() => setInvoice(false)} onSaved={() => { setInvoice(false); reload(); }} defaults={{ customer_id: p.customer_id, project_id: p.id }} />
    </div>
  );
};
