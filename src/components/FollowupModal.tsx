import React, { useEffect, useState } from 'react';
import { Modal } from './ui/Modal.tsx';
import { Btn, Field, inputCls } from './ui/Common.tsx';
import { PersianDatePicker } from './ui/PersianDatePicker.tsx';
import { TimePicker } from './ui/TimePicker.tsx';
import { CustomerSelector } from './ui/CustomerSelector.tsx';
import { useUi } from './ui/UiProvider.tsx';
import { studio } from '../services/studioApi.ts';
import { useMeta, errMsg, notifyDataChanged } from '../hooks.ts';
import { getTodayJalali } from '../utils/jalali.ts';

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  followup?: any | null;
  defaults?: { customer_id?: number };
}

export const FollowupModal: React.FC<Props> = ({ open, onClose, onSaved, followup, defaults }) => {
  const ui = useUi();
  const meta = useMeta();
  const [f, setF] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    setF(followup ? { ...followup } : { customer_id: defaults?.customer_id || null, title: '', description: '', assignee: '', due_date: getTodayJalali(), due_time: '10:00', priority: 'عادی', status: 'باز', next_followup_date: '', next_followup_time: '10:00' });
  }, [open, followup, defaults?.customer_id]);

  const set = (k: string, v: any) => setF((x: any) => ({ ...x, [k]: v }));
  const save = async () => {
    setError(''); setSaving(true);
    try {
      await studio.saveFollowup(f);
      ui.success();
      notifyDataChanged();
      onSaved();
    } catch (e) { setError(errMsg(e)); } finally { setSaving(false); }
  };

  return (
    <Modal open={open} onClose={onClose} size="md" title={followup ? 'ویرایش پیگیری' : 'پیگیری جدید'}
      footer={<><Btn onClick={onClose}>انصراف</Btn><Btn variant="primary" loading={saving} disabled={!f} onClick={save}>ذخیره</Btn></>}>
      {!f ? null : (
        <div className="space-y-3">
          {error && <div className="px-3 py-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm">{error}</div>}
          <Field label="مشتری"><CustomerSelector value={f.customer_id} onChange={(id) => set('customer_id', id)} /></Field>
          <Field label="عنوان" required><input className={inputCls} value={f.title} onChange={(e) => set('title', e.target.value)} autoFocus /></Field>
          <Field label="توضیحات"><textarea className={`${inputCls} min-h-[64px]`} value={f.description || ''} onChange={(e) => set('description', e.target.value)} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="مسئول">
              <input list="fu-assignees" className={inputCls} value={f.assignee || ''} onChange={(e) => set('assignee', e.target.value)} placeholder="خالی = خودم" />
              <datalist id="fu-assignees">{(meta?.users || []).map((u: any) => <option key={u.id} value={u.full_name} />)}</datalist>
            </Field>
            <Field label="اولویت">
              <select className={inputCls} value={f.priority} onChange={(e) => set('priority', e.target.value)}>{['عادی', 'بالا', 'فوری'].map((p) => <option key={p}>{p}</option>)}</select>
            </Field>
            <Field label="تاریخ" required><PersianDatePicker value={f.due_date} onChange={(v) => set('due_date', v)} /></Field>
            <Field label="ساعت"><TimePicker value={f.due_time || ''} onChange={(v) => set('due_time', v)} step={15} /></Field>
            <Field label="وضعیت">
              <select className={inputCls} value={f.status} onChange={(e) => set('status', e.target.value)}>{['باز', 'در انتظار', 'بسته شده'].map((p) => <option key={p}>{p}</option>)}</select>
            </Field>
            <Field label="پیگیری بعدی (تاریخ)"><PersianDatePicker allowClear value={f.next_followup_date || ''} onChange={(v) => set('next_followup_date', v)} /></Field>
          </div>
        </div>
      )}
    </Modal>
  );
};
