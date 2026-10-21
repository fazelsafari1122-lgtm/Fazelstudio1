import React, { useEffect, useState } from 'react';
import { Modal } from './ui/Modal.tsx';
import { Btn, Field, inputCls } from './ui/Common.tsx';
import { PersianDatePicker } from './ui/PersianDatePicker.tsx';
import { CustomerSelector } from './ui/CustomerSelector.tsx';
import { useUi } from './ui/UiProvider.tsx';
import { studio } from '../services/studioApi.ts';
import { useMeta, errMsg, notifyDataChanged } from '../hooks.ts';
import { getTodayJalali } from '../utils/jalali.ts';

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: (project: any) => void;
  project?: any | null;
  defaults?: { customer_id?: number };
}

export const ProjectModal: React.FC<Props> = ({ open, onClose, onSaved, project, defaults }) => {
  const ui = useUi();
  const meta = useMeta();
  const [f, setF] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || !meta) return;
    setError('');
    setF(project ? { ...project } : {
      customer_id: defaults?.customer_id || null, name: '', project_type: meta.lookups.project_type?.[0] || '', project_date: getTodayJalali(),
      deadline: '', assignee: '', status: meta.stages?.[0]?.name || 'پروژه جدید', amount: '', location: '', notes: '',
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, meta, project]);

  const set = (k: string, v: any) => setF((x: any) => ({ ...x, [k]: v }));

  const save = async () => {
    setError(''); setSaving(true);
    try {
      const saved = await studio.saveProject(f);
      ui.success();
      notifyDataChanged();
      onSaved(saved);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} size="lg" title={project ? `ویرایش پروژه ${project.project_code || ''}` : 'پروژه جدید'}
      footer={<><Btn onClick={onClose}>انصراف</Btn><Btn variant="primary" loading={saving} disabled={!f} onClick={save}>ذخیره</Btn></>}>
      {!f || !meta ? <div className="py-10 text-center text-slate-400 text-sm">در حال بارگذاری...</div> : (
        <div className="space-y-4">
          {error && <div className="px-3 py-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm">{error}</div>}
          <Field label="خانواده / مشتری" required><CustomerSelector value={f.customer_id} onChange={(id) => set('customer_id', id)} /></Field>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="عنوان پروژه" required><input className={inputCls} value={f.name} onChange={(e) => set('name', e.target.value)} /></Field>
            <Field label="نوع پروژه">
              <select className={inputCls} value={f.project_type || ''} onChange={(e) => set('project_type', e.target.value)}>
                {meta.lookups.project_type.map((t: string) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="تاریخ پروژه" required><PersianDatePicker value={f.project_date} onChange={(v) => set('project_date', v)} /></Field>
            <Field label="Deadline"><PersianDatePicker allowClear value={f.deadline || ''} onChange={(v) => set('deadline', v)} /></Field>
            <Field label="مسئول">
              <input list="project-assignees" className={inputCls} value={f.assignee || ''} onChange={(e) => set('assignee', e.target.value)} />
              <datalist id="project-assignees">{meta.team.map((t: any) => <option key={t.id} value={t.full_name} />)}</datalist>
            </Field>
            <Field label="وضعیت">
              <select className={inputCls} value={f.status} onChange={(e) => set('status', e.target.value)}>
                {meta.stages.map((s: any) => <option key={s.id} value={s.name}>{s.name}</option>)}
              </select>
            </Field>
            <Field label="مبلغ پروژه (تومان)"><input className={inputCls} dir="ltr" inputMode="numeric" value={f.amount ?? ''} onChange={(e) => set('amount', e.target.value)} /></Field>
            <Field label="محل"><input className={inputCls} value={f.location || ''} onChange={(e) => set('location', e.target.value)} /></Field>
          </div>
          <Field label="توضیحات"><textarea className={`${inputCls} min-h-[64px]`} value={f.notes || ''} onChange={(e) => set('notes', e.target.value)} /></Field>
        </div>
      )}
    </Modal>
  );
};
