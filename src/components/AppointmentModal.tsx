import React, { useEffect, useState } from 'react';
import { Modal } from './ui/Modal.tsx';
import { Btn, Field, inputCls } from './ui/Common.tsx';
import { PersianDatePicker } from './ui/PersianDatePicker.tsx';
import { TimePicker } from './ui/TimePicker.tsx';
import { CustomerSelector } from './ui/CustomerSelector.tsx';
import { useUi } from './ui/UiProvider.tsx';
import { studio } from '../services/studioApi.ts';
import { useMeta, errMsg, notifyDataChanged } from '../hooks.ts';
import { getTodayJalali, toPersianDigits } from '../utils/jalali.ts';

export const DURATIONS = [15, 30, 45, 60, 90, 120, 150, 180, 240];

const addMinutes = (t: string, d: number) => {
  if (!/^\d{2}:\d{2}$/.test(t)) return '';
  const [h, m] = t.split(':').map(Number);
  const total = h * 60 + m + d;
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
};

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  appointment?: any | null;
  defaults?: Partial<{ customer_id: number; date: string; hall_id: number; start_time: string; project_id: number }>;
}

export const AppointmentModal: React.FC<Props> = ({ open, onClose, onSaved, appointment, defaults }) => {
  const ui = useUi();
  const meta = useMeta();
  const [f, setF] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [conflict, setConflict] = useState<any>(null);
  const [projects, setProjects] = useState<any[]>([]);

  useEffect(() => {
    if (!open || !meta) return;
    setError(''); setConflict(null);
    const halls = meta.branches.flatMap((b: any) => b.halls.map((h: any) => ({ ...h, branch_id: b.id })));
    const firstHall = halls.find((h: any) => h.id === defaults?.hall_id) || halls[0];
    if (appointment) {
      setF({ ...appointment, deposit_required: !!appointment.deposit_required, accept_terms: true });
    } else {
      setF({
        customer_id: defaults?.customer_id || null, branch_id: firstHall?.branch_id || '', hall_id: firstHall?.id || '',
        date: defaults?.date || getTodayJalali(), start_time: defaults?.start_time || '10:00', duration_minutes: 60,
        project_type: meta.lookups.project_type?.[0] || '', project_id: defaults?.project_id || '', notes: '',
        deposit_required: false, deposit_amount: '', deposit_sms_text: '', deposit_deadline_date: '', deposit_deadline_time: '12:00',
        reminder_date: '', reminder_time: '10:00', reminder_text: '', auto_cancel: true, accept_terms: false,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, meta, appointment]);

  useEffect(() => {
    if (!open || !f?.customer_id) { setProjects([]); return; }
    studio.family(f.customer_id).then((d) => setProjects(d.projects)).catch(() => setProjects([]));
  }, [open, f?.customer_id]);

  if (!open) return null;
  const set = (k: string, v: any) => setF((x: any) => ({ ...x, [k]: v }));
  const halls = meta ? (meta.branches.find((b: any) => b.id === Number(f?.branch_id))?.halls || []) : [];

  const save = async (forceHoliday = false) => {
    setError(''); setConflict(null); setSaving(true);
    try {
      await studio.saveAppointment({ ...f, force_holiday: forceHoliday });
      ui.success();
      notifyDataChanged();
      onSaved();
    } catch (e: any) {
      if (e?.data?.holiday && await ui.confirm(`${e.message} آیا مایل به ثبت نوبت در روز تعطیل هستید؟`, { danger: false, confirmLabel: 'بله، ثبت شود' })) {
        setSaving(false);
        return save(true);
      }
      if (e?.data?.conflict) setConflict(e.data.conflict);
      setError(errMsg(e));
    } finally {
      setSaving(false);
    }
  };

  const onlineOn = meta?.settings?.online_payment_enabled;

  return (
    <Modal open={open} onClose={onClose} size="lg" title={appointment ? 'ویرایش نوبت' : 'نوبت جدید'}
      footer={<><Btn onClick={onClose}>انصراف</Btn><Btn variant="primary" loading={saving} disabled={!f} onClick={() => save(false)}>ثبت نوبت</Btn></>}>
      {!f || !meta ? <div className="py-10 text-center text-slate-400 text-sm">در حال بارگذاری...</div> : (
        <div className="space-y-4">
          {error && (
            <div className="px-3 py-2.5 rounded-xl bg-rose-500/10 border border-rose-500/40 text-rose-200 text-sm">
              <div className="font-semibold">{error}</div>
              {conflict && <div className="text-xs mt-1 text-rose-300/90">نوبت موجود: {conflict.customer} — از {toPersianDigits(conflict.start_time)} تا {toPersianDigits(conflict.end_time)}</div>}
            </div>
          )}
          <Field label="مشتری (نام یا موبایل)" required><CustomerSelector value={f.customer_id} onChange={(id) => set('customer_id', id)} /></Field>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="شعبه" required>
              <select className={inputCls} value={f.branch_id} onChange={(e) => { const b = meta.branches.find((x: any) => x.id === Number(e.target.value)); setF({ ...f, branch_id: Number(e.target.value), hall_id: b?.halls?.[0]?.id || '' }); }}>
                {meta.branches.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </Field>
            <Field label="سالن" required>
              <select className={inputCls} value={f.hall_id} onChange={(e) => set('hall_id', Number(e.target.value))}>
                {halls.length === 0 && <option value="">سالنی تعریف نشده</option>}
                {halls.map((h: any) => <option key={h.id} value={h.id}>{h.name}</option>)}
              </select>
            </Field>
            <Field label="تاریخ" required><PersianDatePicker value={f.date} onChange={(v) => set('date', v)} /></Field>
            <Field label="ساعت شروع" required><TimePicker value={f.start_time} onChange={(v) => set('start_time', v)} step={5} /></Field>
            <Field label="مدت" hint={f.start_time ? `پایان: ${toPersianDigits(addMinutes(f.start_time, Number(f.duration_minutes)))}` : undefined}>
              <select className={inputCls} value={f.duration_minutes} onChange={(e) => set('duration_minutes', Number(e.target.value))}>
                {(DURATIONS.includes(Number(f.duration_minutes)) ? DURATIONS : [...DURATIONS, Number(f.duration_minutes)].sort((a, b) => a - b)).map((d) => <option key={d} value={d}>{d < 60 ? `${toPersianDigits(d)} دقیقه` : `${toPersianDigits(d / 60)} ساعت`}</option>)}
              </select>
            </Field>
            <Field label="نوع پروژه">
              <select className={inputCls} value={f.project_type || ''} onChange={(e) => set('project_type', e.target.value)}>
                <option value="">—</option>
                {meta.lookups.project_type.map((t: string) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="پروژه مرتبط" className="sm:col-span-2">
              <select className={inputCls} value={f.project_id || ''} onChange={(e) => set('project_id', e.target.value ? Number(e.target.value) : '')} disabled={!f.customer_id}>
                <option value="">— بدون پروژه —</option>
                {projects.map((p: any) => <option key={p.id} value={p.id}>{p.project_code} — {p.name}</option>)}
              </select>
            </Field>
          </div>
          <Field label="توضیحات"><textarea className={`${inputCls} min-h-[64px]`} value={f.notes || ''} onChange={(e) => set('notes', e.target.value)} /></Field>

          {!appointment && onlineOn && (
            <div className="border border-slate-800 rounded-2xl p-3 space-y-3">
              <label className="flex items-center gap-2 text-sm text-slate-200 cursor-pointer">
                <input type="checkbox" checked={f.deposit_required} onChange={(e) => set('deposit_required', e.target.checked)} className="accent-amber-500 w-4 h-4" />
                دریافت بیعانه آنلاین برای قطعی شدن نوبت
              </label>
              {f.deposit_required && (
                <div className="grid sm:grid-cols-2 gap-3">
                  <Field label="مبلغ بیعانه (تومان)" required><input className={inputCls} dir="ltr" inputMode="numeric" value={f.deposit_amount} onChange={(e) => set('deposit_amount', e.target.value)} /></Field>
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="مهلت پرداخت (تاریخ)" required><PersianDatePicker value={f.deposit_deadline_date} onChange={(v) => set('deposit_deadline_date', v)} /></Field>
                    <Field label="ساعت" required><TimePicker value={f.deposit_deadline_time} onChange={(v) => set('deposit_deadline_time', v)} step={15} /></Field>
                  </div>
                  <Field label="متن پیامک (متغیرها: {{نام}} {{مبلغ}} {{تاریخ}} {{ساعت}} {{لینک}})" className="sm:col-span-2">
                    <textarea className={`${inputCls} min-h-[64px]`} placeholder="خالی = متن پیش‌فرض با {{لینک}} پرداخت" value={f.deposit_sms_text} onChange={(e) => set('deposit_sms_text', e.target.value)} />
                  </Field>
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="یادآوری (تاریخ)"><PersianDatePicker allowClear value={f.reminder_date} onChange={(v) => set('reminder_date', v)} /></Field>
                    <Field label="ساعت یادآوری"><TimePicker value={f.reminder_time} onChange={(v) => set('reminder_time', v)} step={15} /></Field>
                  </div>
                  <Field label="متن یادآوری (می‌تواند شامل {{لینک}} باشد)"><input className={inputCls} value={f.reminder_text} onChange={(e) => set('reminder_text', e.target.value)} /></Field>
                  <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer sm:col-span-2">
                    <input type="checkbox" checked={f.auto_cancel} onChange={(e) => set('auto_cancel', e.target.checked)} className="accent-amber-500 w-4 h-4" />
                    اگر تا مهلت مقرر پرداخت نشد، نوبت به‌صورت خودکار لغو شود
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer sm:col-span-2">
                    <input type="checkbox" checked={f.accept_terms} onChange={(e) => set('accept_terms', e.target.checked)} className="accent-amber-500 w-4 h-4" />
                    قوانین بیعانه (عدم استرداد در صورت لغو توسط مشتری) را تأیید می‌کنم
                  </label>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
};
