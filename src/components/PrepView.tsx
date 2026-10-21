import React, { useMemo, useState } from 'react';
import { Image, Camera, Boxes, Plus, Trash2, Edit3 } from './icons.tsx';
import { studio } from '../services/studioApi.ts';
import { useAsync, useMeta, notifyDataChanged, errMsg } from '../hooks.ts';
import { Btn, Card, ErrorState, Field, LoadingState, PageHeader, SearchBox, StatusBadge, inputCls } from './ui/Common.tsx';
import { Modal } from './ui/Modal.tsx';
import { PersianDatePicker } from './ui/PersianDatePicker.tsx';
import { useUi } from './ui/UiProvider.tsx';
import { toPersianDigits, getTodayJalali } from '../utils/jalali.ts';

const META: Record<string, { title: string; icon: any; subtitle: string }> = {
  photo: { title: 'آماده‌سازی عکس', icon: Image, subtitle: 'دریافت فایل تا تحویل عکس‌های ادیت‌شده' },
  video: { title: 'آماده‌سازی فیلم', icon: Camera, subtitle: 'تدوین، اصلاحات و تأیید مشتری' },
  album: { title: 'آماده‌سازی آلبوم', icon: Boxes, subtitle: 'طراحی، چاپ و صحافی آلبوم' },
};

export const PrepView: React.FC<{ kind: 'photo' | 'video' | 'album'; onOpenProject: (id: number) => void }> = ({ kind, onOpenProject }) => {
  const ui = useUi();
  const meta = useMeta();
  const m = META[kind];
  const Icon = m.icon;
  const stages = useAsync(() => studio.prepStages(), []);
  const tasks = useAsync(() => studio.prep(kind), [kind]);
  const [q, setQ] = useState('');
  const [edit, setEdit] = useState<any>(null);
  const [adding, setAdding] = useState(false);

  const list: string[] = stages.data?.[kind] || [];
  const rows = useMemo(() => (tasks.data || []).filter((t) => !q.trim() || [t.project_code, t.project_name, t.customer_last, t.assignee].join(' ').toLowerCase().includes(q.trim().toLowerCase())), [tasks.data, q]);

  const setStage = async (t: any, stage: string) => {
    try {
      const r = await studio.updatePrep(t.id, { stage });
      ui.success(r?.project_ready ? 'همه مراحل تمام شد؛ پروژه «آماده تحویل» شد' : 'مرحله به‌روزرسانی شد');
      notifyDataChanged();
      tasks.reload();
    } catch (e) { ui.error(e); }
  };
  const remove = async (t: any) => {
    if (!(await ui.confirm(`آیا از حذف «${t.project_name}» از لیست ${m.title} مطمئن هستید؟`))) return;
    try { await studio.deletePrep(t.id); ui.success('با موفقیت حذف شد'); tasks.reload(); } catch (e) { ui.error(e); }
  };

  return (
    <div>
      <PageHeader title={m.title} subtitle={m.subtitle} icon={<Icon className="w-5 h-5" />} actions={<Btn variant="primary" onClick={() => setAdding(true)}><Plus className="w-4 h-4" />افزودن پروژه</Btn>} />
      {stages.loading || tasks.loading ? <LoadingState /> : tasks.error ? <ErrorState message={tasks.error} onRetry={tasks.reload} /> : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 mb-4">
            {list.map((s) => (
              <div key={s} className="bg-slate-900/70 border border-slate-800 rounded-xl px-3 py-2 text-center">
                <div className="text-[11px] text-slate-400 truncate">{s}</div>
                <div className="text-lg font-bold text-amber-300">{toPersianDigits((tasks.data || []).filter((t) => t.stage === s).length)}</div>
              </div>
            ))}
          </div>
          <SearchBox className="mb-3 max-w-md" value={q} onChange={setQ} placeholder="جستجوی پروژه، خانواده یا مسئول..." />
          {rows.length === 0 ? (
            <Card><div className="text-center py-10 text-sm text-slate-400">اطلاعاتی برای نمایش وجود ندارد<div className="mt-3"><Btn variant="primary" onClick={() => setAdding(true)}><Plus className="w-4 h-4" />افزودن مورد جدید</Btn></div></div></Card>
          ) : (
            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
              {rows.map((t) => {
                const idx = list.indexOf(t.stage);
                return (
                  <Card key={t.id} className={t.overdue ? '!border-rose-500/50' : ''}>
                    <div className="flex items-start justify-between gap-2">
                      <button onClick={() => onOpenProject(t.project_id)} className="text-right">
                        <div className="text-[11px] text-amber-300 font-mono">{t.project_code}</div>
                        <div className="text-sm font-semibold text-slate-100">خانواده {t.customer_last}</div>
                        <div className="text-xs text-slate-400">{t.project_name}</div>
                      </button>
                      <div className="flex">
                        <Btn size="sm" variant="ghost" aria-label="ویرایش" onClick={() => setEdit(t)}><Edit3 className="w-4 h-4" /></Btn>
                        <Btn size="sm" variant="ghost" aria-label="حذف" onClick={() => remove(t)}><Trash2 className="w-4 h-4 text-rose-400" /></Btn>
                      </div>
                    </div>
                    <div className="flex gap-1 my-3" aria-label="پیشرفت">
                      {list.map((s, i) => <div key={s} title={s} className={`h-1.5 flex-1 rounded-full ${i <= idx ? 'bg-amber-400' : 'bg-slate-700'}`} />)}
                    </div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <select className={`${inputCls} !py-1.5`} value={t.stage} onChange={(e) => setStage(t, e.target.value)} aria-label="مرحله">{list.map((s) => <option key={s}>{s}</option>)}</select>
                      <Btn size="sm" variant="primary" disabled={idx >= list.length - 1} onClick={() => setStage(t, list[idx + 1])}>مرحله بعد</Btn>
                    </div>
                    <div className="text-[11px] text-slate-400 space-y-0.5">
                      <div>مسئول: {t.assignee || '—'}</div>
                      <div>شروع: {t.start_date ? toPersianDigits(t.start_date) : '—'} • Deadline: <span className={t.overdue ? 'text-rose-300' : ''}>{t.deadline ? toPersianDigits(t.deadline) : '—'}</span>{t.overdue && ' (گذشته)'}</div>
                      {t.notes && <div className="text-slate-500">{t.notes}</div>}
                    </div>
                    {t.stage === 'آماده تحویل' && <div className="mt-2"><StatusBadge status="آماده تحویل" /></div>}
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}
      <PrepEditModal task={edit} stages={list} team={meta?.team || []} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); tasks.reload(); }} />
      <AddPrepModal open={adding} kind={kind} stages={list} team={meta?.team || []} existing={(tasks.data || []).map((t) => t.project_id)} onClose={() => setAdding(false)} onSaved={() => { setAdding(false); tasks.reload(); }} />
    </div>
  );
};

const PrepEditModal: React.FC<{ task: any | null; stages: string[]; team: any[]; onClose: () => void; onSaved: () => void }> = ({ task, stages, team, onClose, onSaved }) => {
  const ui = useUi();
  const [f, setF] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  React.useEffect(() => { setF(task ? { ...task } : null); setError(''); }, [task]);
  if (!task || !f) return null;
  const save = async () => {
    setSaving(true); setError('');
    try { const r = await studio.updatePrep(task.id, { stage: f.stage, assignee: f.assignee, start_date: f.start_date, deadline: f.deadline, notes: f.notes }); ui.success(r?.project_ready ? 'پروژه «آماده تحویل» شد' : undefined); notifyDataChanged(); onSaved(); } catch (e) { setError(errMsg(e)); } finally { setSaving(false); }
  };
  return (
    <Modal open onClose={onClose} title={`ویرایش ${task.project_code}`} size="md" footer={<><Btn onClick={onClose}>انصراف</Btn><Btn variant="primary" loading={saving} onClick={save}>ذخیره</Btn></>}>
      <div className="space-y-3">
        {error && <div className="px-3 py-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm">{error}</div>}
        <div className="grid grid-cols-2 gap-3">
          <Field label="مرحله"><select className={inputCls} value={f.stage} onChange={(e) => setF({ ...f, stage: e.target.value })}>{stages.map((s) => <option key={s}>{s}</option>)}</select></Field>
          <Field label="مسئول"><input list="prep-team" className={inputCls} value={f.assignee || ''} onChange={(e) => setF({ ...f, assignee: e.target.value })} /><datalist id="prep-team">{team.map((t) => <option key={t.id} value={t.full_name} />)}</datalist></Field>
          <Field label="تاریخ شروع"><PersianDatePicker value={f.start_date || ''} onChange={(v) => setF({ ...f, start_date: v })} /></Field>
          <Field label="Deadline"><PersianDatePicker allowClear value={f.deadline || ''} onChange={(v) => setF({ ...f, deadline: v })} /></Field>
        </div>
        <Field label="توضیحات"><textarea className={`${inputCls} min-h-[64px]`} value={f.notes || ''} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
      </div>
    </Modal>
  );
};

const AddPrepModal: React.FC<{ open: boolean; kind: string; stages: string[]; team: any[]; existing: number[]; onClose: () => void; onSaved: () => void }> = ({ open, kind, stages, team, existing, onClose, onSaved }) => {
  const ui = useUi();
  const projects = useAsync(() => (open ? studio.projects() : Promise.resolve([])), [open]);
  const [f, setF] = useState<any>({ project_id: '', assignee: '', start_date: getTodayJalali(), deadline: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  if (!open) return null;
  const options = (projects.data || []).filter((p) => !existing.includes(p.id) && !['تحویل شده', 'لغو شده'].includes(p.status));
  const save = async () => {
    setSaving(true); setError('');
    try { await studio.addPrep({ kind, ...f, project_id: Number(f.project_id), stage: stages[0] }); ui.success(); notifyDataChanged(); onSaved(); } catch (e) { setError(errMsg(e)); } finally { setSaving(false); }
  };
  return (
    <Modal open onClose={onClose} title="افزودن پروژه به آماده‌سازی" size="md" footer={<><Btn onClick={onClose}>انصراف</Btn><Btn variant="primary" loading={saving} disabled={!f.project_id} onClick={save}>افزودن</Btn></>}>
      <div className="space-y-3">
        {error && <div className="px-3 py-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm">{error}</div>}
        <Field label="پروژه" required>
          <select className={inputCls} value={f.project_id} onChange={(e) => setF({ ...f, project_id: e.target.value })}>
            <option value="">— انتخاب پروژه —</option>
            {options.map((p) => <option key={p.id} value={p.id}>{p.project_code} — خانواده {p.customer_last} — {p.name}</option>)}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="مسئول"><input list="prep-team2" className={inputCls} value={f.assignee} onChange={(e) => setF({ ...f, assignee: e.target.value })} /><datalist id="prep-team2">{team.map((t) => <option key={t.id} value={t.full_name} />)}</datalist></Field>
          <Field label="تاریخ شروع"><PersianDatePicker value={f.start_date} onChange={(v) => setF({ ...f, start_date: v })} /></Field>
          <Field label="Deadline"><PersianDatePicker allowClear value={f.deadline} onChange={(v) => setF({ ...f, deadline: v })} /></Field>
        </div>
        <Field label="توضیحات"><input className={inputCls} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
      </div>
    </Modal>
  );
};
