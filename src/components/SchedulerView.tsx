import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarIcon, Plus, Clock, ChevronRight, ChevronLeft, Trash2, Settings } from './icons.tsx';
import { studio } from '../services/studioApi.ts';
import { useAsync, useMeta, notifyDataChanged, errMsg } from '../hooks.ts';
import { Btn, Card, ErrorState, Field, LoadingState, PageHeader, StatusBadge, inputCls, moneyT } from './ui/Common.tsx';
import { Modal } from './ui/Modal.tsx';
import { PersianDatePicker } from './ui/PersianDatePicker.tsx';
import { TimePicker } from './ui/TimePicker.tsx';
import { useUi } from './ui/UiProvider.tsx';
import { AppointmentModal } from './AppointmentModal.tsx';
import { addDays, addMonths, fromMin, monthEnd, monthLength, monthStart, monthTitle, parseJ, toMin, weekStart, weekdayIndex, WEEKDAYS, fmtJ } from '../utils/jdate.ts';
import { getTodayJalali, toPersianDigits } from '../utils/jalali.ts';

type Mode = 'day' | 'week' | 'month';
const ROW_H = 36;
const SLOT_LABEL: Record<number, string> = { 5: '۵ دقیقه', 15: '۱۵ دقیقه', 30: '۳۰ دقیقه', 60: '۱ ساعت', 90: '۱.۵ ساعت', 120: '۲ ساعت', 150: '۲.۵ ساعت', 180: '۳ ساعت' };

const STATUS_CLS: Record<string, string> = {
  'رزرو شده': 'bg-sky-500/20 border-sky-400/60 text-sky-100',
  'انجام شد': 'bg-emerald-500/20 border-emerald-400/60 text-emerald-100',
  'لغو شده': 'bg-slate-700/40 border-slate-500/50 text-slate-400 line-through',
};

interface Props { openAddSignal: number; onOpenFamily: (id: number) => void }

export const SchedulerView: React.FC<Props> = ({ openAddSignal, onOpenFamily }) => {
  const ui = useUi();
  const meta = useMeta();
  const today = getTodayJalali();
  const [mode, setMode] = useState<Mode>('day');
  const [date, setDate] = useState(today);
  const [branchId, setBranchId] = useState<number>(0);
  const [hallId, setHallId] = useState<number>(0);
  const [modal, setModal] = useState<{ type: '' | 'appt' | 'hours' | 'holidays' | 'detail'; appt?: any; defaults?: any }>({ type: '' });

  useEffect(() => { if (meta && !branchId && meta.branches[0]) setBranchId(meta.branches[0].id); }, [meta, branchId]);
  useEffect(() => { if (openAddSignal > 0) setModal({ type: 'appt', defaults: { date } }); /* eslint-disable-next-line */ }, [openAddSignal]);

  const branch = meta?.branches.find((b: any) => b.id === branchId);
  const halls: any[] = useMemo(() => branch?.halls || [], [branch]);
  // week view needs exactly one hall
  useEffect(() => { if (halls.length && (!hallId || !halls.some((h) => h.id === hallId))) setHallId(halls[0].id); }, [halls, hallId]);

  const range = useMemo(() => {
    if (mode === 'day') return { from: date, to: date };
    if (mode === 'week') { const s = weekStart(date); return { from: s, to: addDays(s, 6) }; }
    return { from: monthStart(date), to: monthEnd(date) };
  }, [mode, date]);

  const hours = useAsync(() => (branchId ? studio.workingHours(branchId) : Promise.resolve(null)), [branchId]);
  const holidays = useAsync(() => studio.holidays(), []);
  const appts = useAsync(() => (branchId ? studio.appointments({ branch_id: branchId, from: range.from, to: range.to }) : Promise.resolve([])), [branchId, range.from, range.to]);

  const refresh = useCallback(() => { appts.reload(); holidays.reload(); hours.reload(); }, [appts, holidays, hours]);

  const eff = hours.data?.effective || { start_time: '08:00', end_time: '20:00', slot_minutes: 30 };
  const slot: number = eff.slot_minutes;
  const startMin = toMin(eff.start_time); const endMin = toMin(eff.end_time);
  const rowCount = Math.max(1, Math.ceil((endMin - startMin) / slot));
  const holidayMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const h of holidays.data || []) if (!h.branch_id || h.branch_id === branchId) m.set(h.date, h.description || 'تعطیل');
    return m;
  }, [holidays.data, branchId]);
  const list: any[] = appts.data || [];

  const step = (dir: 1 | -1) => {
    if (mode === 'day') setDate(addDays(date, dir));
    else if (mode === 'week') setDate(addDays(date, 7 * dir));
    else setDate(addMonths(date, dir));
  };

  const title = mode === 'month' ? monthTitle(date) : mode === 'week' ? `${toPersianDigits(range.from)} تا ${toPersianDigits(range.to)}` : `${WEEKDAYS[weekdayIndex(date)]} ${toPersianDigits(date)}`;

  const openNew = (d: string, hall: number, startTime: string) => setModal({ type: 'appt', defaults: { date: d, hall_id: hall, start_time: startTime } });

  // ---- shared block renderer ----
  const block = (a: any) => {
    const top = ((toMin(a.start_time) - startMin) / slot) * ROW_H;
    const height = Math.max(ROW_H * 0.7, ((toMin(a.end_time) - toMin(a.start_time)) / slot) * ROW_H - 2);
    return (
      <button key={a.id} onClick={(e) => { e.stopPropagation(); setModal({ type: 'detail', appt: a }); }}
        className={`absolute right-1 left-1 rounded-lg border px-2 py-1 text-right overflow-hidden text-[11px] leading-4 hover:brightness-125 transition ${STATUS_CLS[a.status] || STATUS_CLS['رزرو شده']}`}
        style={{ top, height }} title={`${a.customer_last} — ${a.start_time} تا ${a.end_time}`}>
        <div className="font-semibold truncate">خانواده {a.customer_last}</div>
        <div className="opacity-80 truncate">{toPersianDigits(a.start_time)} - {toPersianDigits(a.end_time)}{a.project_type ? ` • ${a.project_type}` : ''}</div>
        {a.deposit_required === 1 && a.deposit_paid === 0 && a.status === 'رزرو شده' && <div className="text-amber-300 truncate">بیعانه پرداخت نشده</div>}
      </button>
    );
  };

  const column = (d: string, hall: any) => {
    const holiday = holidayMap.get(d);
    const col = list.filter((a) => a.date === d && a.hall_id === hall.id);
    return (
      <div key={`${d}-${hall.id}`} className="relative border-r border-slate-800 min-w-[150px] flex-1" style={{ height: rowCount * ROW_H }}>
        {Array.from({ length: rowCount }, (_, i) => {
          const t = fromMin(startMin + i * slot);
          return <button key={i} onClick={() => openNew(d, hall.id, t)} aria-label={`رزرو ${t}`} className="block w-full border-b border-slate-800/70 hover:bg-amber-500/10 transition-colors" style={{ height: ROW_H }} />;
        })}
        {holiday && <div className="absolute inset-0 bg-rose-500/10 pointer-events-none flex items-start justify-center pt-2 text-[11px] text-rose-300">{holiday}</div>}
        {col.map(block)}
      </div>
    );
  };

  const timeLabels = (
    <div className="w-14 shrink-0 sticky right-0 bg-slate-900 z-10" style={{ marginTop: 40 }}>
      {Array.from({ length: rowCount }, (_, i) => (
        <div key={i} className="text-[10px] text-slate-500 text-center border-b border-slate-800/70" style={{ height: ROW_H }}>{toPersianDigits(fromMin(startMin + i * slot))}</div>
      ))}
    </div>
  );

  const stats = {
    total: list.filter((a) => a.status !== 'لغو شده').length,
    done: list.filter((a) => a.status === 'انجام شد').length,
    cancelled: list.filter((a) => a.status === 'لغو شده').length,
  };

  return (
    <div>
      <PageHeader title="نوبت‌دهی" subtitle="تقویم شمسی، سالن‌ها و رزرو با جلوگیری از تداخل" icon={<CalendarIcon className="w-5 h-5" />}
        actions={<>
          <Btn onClick={() => setModal({ type: 'holidays' })}><CalendarIcon className="w-4 h-4" />تعطیلات</Btn>
          <Btn onClick={() => setModal({ type: 'hours' })}><Clock className="w-4 h-4" />تنظیم ساعات کاری</Btn>
          <Btn variant="primary" onClick={() => setModal({ type: 'appt', defaults: { date, hall_id: hallId } })}><Plus className="w-4 h-4" />نوبت جدید</Btn>
        </>} />

      <Card className="mb-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-xl overflow-hidden border border-slate-700">
            {(['day', 'week', 'month'] as Mode[]).map((m) => (
              <button key={m} onClick={() => setMode(m)} className={`px-4 py-2 text-sm ${mode === m ? 'bg-amber-500 text-slate-950 font-semibold' : 'bg-slate-900 text-slate-300 hover:bg-slate-800'}`}>{m === 'day' ? 'روزانه' : m === 'week' ? 'هفتگی' : 'ماهانه'}</button>
            ))}
          </div>
          <Btn size="sm" onClick={() => setDate(today)}>امروز</Btn>
          <Btn size="sm" variant="ghost" onClick={() => step(-1)} aria-label="قبل"><ChevronRight className="w-4 h-4" />{mode === 'week' ? 'هفته قبل' : mode === 'month' ? 'ماه قبل' : 'روز قبل'}</Btn>
          <Btn size="sm" variant="ghost" onClick={() => step(1)} aria-label="بعد">{mode === 'week' ? 'هفته بعد' : mode === 'month' ? 'ماه بعد' : 'روز بعد'}<ChevronLeft className="w-4 h-4" /></Btn>
          <div className="w-44"><PersianDatePicker value={date} onChange={(v) => v && setDate(v)} /></div>
          <select className={`${inputCls} w-auto`} value={branchId} onChange={(e) => { setBranchId(Number(e.target.value)); setHallId(0); }} aria-label="شعبه">
            {(meta?.branches || []).map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          {mode === 'week' && (
            <select className={`${inputCls} w-auto`} value={hallId} onChange={(e) => setHallId(Number(e.target.value))} aria-label="سالن">
              {halls.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
            </select>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-4 mt-3 text-xs text-slate-400">
          <span className="font-semibold text-slate-200">{title}</span>
          <span>ساعت کاری: {toPersianDigits(eff.start_time)} تا {toPersianDigits(eff.end_time)}</span>
          <span>هر Slot: {SLOT_LABEL[slot] || `${toPersianDigits(slot)} دقیقه`}</span>
          <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded bg-sky-500/40 border border-sky-400/60" />رزرو شده</span>
          <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-500/40 border border-emerald-400/60" />انجام شد</span>
          <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded bg-rose-500/30" />تعطیل</span>
          <span className="mr-auto">فعال: {toPersianDigits(stats.total)} • انجام‌شده: {toPersianDigits(stats.done)} • لغو: {toPersianDigits(stats.cancelled)}</span>
        </div>
      </Card>

      {(appts.loading && !appts.data) || (hours.loading && !hours.data) ? <LoadingState /> : appts.error ? <ErrorState message={appts.error} onRetry={appts.reload} /> : (
        <>
          {mode === 'day' && (
            halls.length === 0 ? <Card><p className="text-sm text-slate-400 text-center py-6">برای این شعبه سالنی تعریف نشده است. از «اطلاعات پایه» سالن اضافه کنید.</p></Card> : (
              <Card className="!p-0 overflow-hidden">
                {holidayMap.has(date) && <div className="px-4 py-2 bg-rose-500/10 text-rose-300 text-sm border-b border-rose-500/20">این روز تعطیل است: {holidayMap.get(date)}</div>}
                <div className="overflow-x-auto"><div className="flex min-w-max">
                  {timeLabels}
                  {halls.map((h) => (
                    <div key={h.id} className="flex-1 min-w-[170px] flex flex-col">
                      <div className="h-10 flex items-center justify-center text-xs font-semibold text-amber-300 bg-slate-900 border-b border-r border-slate-800 sticky top-0">{h.name}</div>
                      {column(date, h)}
                    </div>
                  ))}
                </div></div>
              </Card>
            )
          )}

          {mode === 'week' && (
            <Card className="!p-0 overflow-hidden">
              <div className="overflow-x-auto"><div className="flex min-w-max">
                {timeLabels}
                {Array.from({ length: 7 }, (_, i) => {
                  const d = addDays(range.from, i);
                  return (
                    <div key={d} className="flex-1 min-w-[150px] flex flex-col">
                      <button onClick={() => { setDate(d); setMode('day'); }} className={`h-10 text-xs font-semibold border-b border-r border-slate-800 sticky top-0 hover:bg-slate-800 ${d === today ? 'bg-amber-500/15 text-amber-300' : i === 6 ? 'bg-slate-900 text-rose-300' : 'bg-slate-900 text-slate-200'}`}>
                        {WEEKDAYS[i]}<span className="block text-[10px] font-normal opacity-70">{toPersianDigits(d.slice(5))}</span>
                      </button>
                      {halls.find((h) => h.id === hallId) && column(d, halls.find((h) => h.id === hallId))}
                    </div>
                  );
                })}
              </div></div>
            </Card>
          )}

          {mode === 'month' && <MonthGrid date={date} list={list} holidayMap={holidayMap} today={today} onPick={(d) => { setDate(d); setMode('day'); }} />}
        </>
      )}

      <AppointmentModal open={modal.type === 'appt'} onClose={() => setModal({ type: '' })} onSaved={() => { setModal({ type: '' }); refresh(); }} appointment={modal.appt || null} defaults={modal.defaults} />
      <AppointmentDetail appt={modal.type === 'detail' ? modal.appt : null} onClose={() => setModal({ type: '' })} onChanged={() => { setModal({ type: '' }); notifyDataChanged(); refresh(); }}
        onEdit={(a) => setModal({ type: 'appt', appt: a })} onOpenFamily={onOpenFamily} />
      <WorkingHoursModal open={modal.type === 'hours'} branchId={branchId} branches={meta?.branches || []} onClose={() => setModal({ type: '' })} onSaved={() => { setModal({ type: '' }); refresh(); }} />
      <HolidaysModal open={modal.type === 'holidays'} onClose={() => setModal({ type: '' })} onChanged={() => { holidays.reload(); appts.reload(); }} />
    </div>
  );
};

const MonthGrid: React.FC<{ date: string; list: any[]; holidayMap: Map<string, string>; today: string; onPick: (d: string) => void }> = ({ date, list, holidayMap, today, onPick }) => {
  const { y, m } = parseJ(date);
  const first = fmtJ(y, m, 1);
  const offset = weekdayIndex(first);
  const days = monthLength(y, m);
  const cells: (string | null)[] = [...Array(offset).fill(null), ...Array.from({ length: days }, (_, i) => fmtJ(y, m, i + 1))];
  return (
    <Card className="!p-2">
      <div className="grid grid-cols-7 gap-1 text-center text-xs text-slate-400 mb-1">{WEEKDAYS.map((w) => <div key={w} className="py-1">{w}</div>)}</div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((d, i) => {
          if (!d) return <div key={i} />;
          const day = list.filter((a) => a.date === d && a.status !== 'لغو شده');
          const hol = holidayMap.get(d);
          return (
            <button key={d} onClick={() => onPick(d)} className={`min-h-[84px] rounded-xl border p-1.5 text-right transition-colors hover:border-amber-500/60 ${d === today ? 'border-amber-500/70 bg-amber-500/5' : 'border-slate-800 bg-slate-950/40'} ${hol ? 'bg-rose-500/10' : ''}`}>
              <div className="flex items-center justify-between"><span className={`text-xs ${i % 7 === 6 ? 'text-rose-400' : 'text-slate-200'}`}>{toPersianDigits(Number(d.slice(8)))}</span>{day.length > 0 && <span className="text-[10px] px-1.5 rounded-md bg-sky-500/20 text-sky-200">{toPersianDigits(day.length)}</span>}</div>
              {hol && <div className="text-[10px] text-rose-300 truncate">{hol}</div>}
              {day.slice(0, 2).map((a) => <div key={a.id} className="text-[10px] text-slate-300 truncate">{toPersianDigits(a.start_time)} {a.customer_last}</div>)}
              {day.length > 2 && <div className="text-[10px] text-slate-500">+{toPersianDigits(day.length - 2)} مورد دیگر</div>}
            </button>
          );
        })}
      </div>
    </Card>
  );
};

const AppointmentDetail: React.FC<{ appt: any | null; onClose: () => void; onChanged: () => void; onEdit: (a: any) => void; onOpenFamily: (id: number) => void }> = ({ appt, onClose, onChanged, onEdit, onOpenFamily }) => {
  const ui = useUi();
  const [busy, setBusy] = useState(false);
  if (!appt) return null;
  const run = async (fn: () => Promise<any>, ok?: string) => {
    setBusy(true);
    try { await fn(); ui.success(ok); onChanged(); } catch (e: any) { ui.error(e); } finally { setBusy(false); }
  };
  const del = async () => {
    if (!(await ui.confirm('آیا از حذف این نوبت مطمئن هستید؟'))) return;
    run(() => studio.deleteAppointment(appt.id), 'با موفقیت حذف شد');
  };
  const cancel = async () => {
    if (!(await ui.confirm('آیا از لغو این نوبت مطمئن هستید؟', { confirmLabel: 'بله، لغو شود' }))) return;
    run(() => studio.setAppointmentStatus(appt.id, 'لغو شده'));
  };
  return (
    <Modal open onClose={onClose} title={`نوبت خانواده ${appt.customer_last}`}
      footer={<>
        <Btn variant="ghost" onClick={() => onOpenFamily(appt.customer_id)}>پرونده خانواده</Btn>
        <Btn variant="danger" disabled={busy} onClick={del}><Trash2 className="w-4 h-4" />حذف</Btn>
        {appt.status === 'رزرو شده' && <Btn disabled={busy} onClick={cancel}>لغو نوبت</Btn>}
        {appt.status === 'رزرو شده' && <Btn variant="primary" disabled={busy} onClick={() => run(() => studio.setAppointmentStatus(appt.id, 'انجام شد'))}>انجام شد</Btn>}
        {appt.status === 'لغو شده' && <Btn disabled={busy} onClick={() => run(() => studio.setAppointmentStatus(appt.id, 'رزرو شده'))}>بازگردانی</Btn>}
        <Btn disabled={busy} onClick={() => onEdit(appt)}>ویرایش</Btn>
      </>}>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
        <div><dt className="text-xs text-slate-400">وضعیت</dt><dd><StatusBadge status={appt.status} /></dd></div>
        <div><dt className="text-xs text-slate-400">تاریخ</dt><dd>{WEEKDAYS[weekdayIndex(appt.date)]} {toPersianDigits(appt.date)}</dd></div>
        <div><dt className="text-xs text-slate-400">ساعت</dt><dd>{toPersianDigits(`${appt.start_time} تا ${appt.end_time}`)}</dd></div>
        <div><dt className="text-xs text-slate-400">سالن / شعبه</dt><dd>{appt.hall_name} / {appt.branch_name}</dd></div>
        <div><dt className="text-xs text-slate-400">نوع پروژه</dt><dd>{appt.project_type || '—'}</dd></div>
        <div><dt className="text-xs text-slate-400">تماس</dt><dd dir="ltr" className="text-right">{toPersianDigits(appt.customer_phone)}</dd></div>
        {appt.notes && <div className="col-span-2"><dt className="text-xs text-slate-400">توضیحات</dt><dd>{appt.notes}</dd></div>}
        {appt.cancel_reason && <div className="col-span-2"><dt className="text-xs text-slate-400">دلیل لغو</dt><dd className="text-rose-300">{appt.cancel_reason}</dd></div>}
      </dl>
      {appt.deposit_required === 1 && (
        <div className="mt-4 rounded-2xl border border-slate-800 p-3 text-sm space-y-2">
          <div className="flex items-center justify-between"><span className="font-semibold text-slate-200">بیعانه آنلاین</span><StatusBadge status={appt.deposit_paid ? 'ارسال شد' : 'در انتظار'} tone={appt.deposit_paid ? 'green' : 'amber'} /></div>
          <div className="text-slate-300">مبلغ: {moneyT(appt.deposit_amount)} • مهلت: {toPersianDigits(`${appt.deposit_deadline_date} ${appt.deposit_deadline_time}`)}</div>
          {appt.payment_link && <div className="text-xs text-slate-400" dir="ltr">{appt.payment_link}</div>}
          {!appt.deposit_paid && appt.status === 'رزرو شده' && <Btn size="sm" variant="primary" disabled={busy} onClick={() => run(() => studio.payDeposit(appt.id), 'بیعانه با موفقیت ثبت شد')}>ثبت پرداخت بیعانه (شبیه‌سازی درگاه)</Btn>}
          {!!appt.auto_cancel && !appt.deposit_paid && <p className="text-[11px] text-amber-300">در صورت عدم پرداخت تا مهلت، نوبت به‌صورت خودکار لغو می‌شود.</p>}
        </div>
      )}
    </Modal>
  );
};

const WorkingHoursModal: React.FC<{ open: boolean; branchId: number; branches: any[]; onClose: () => void; onSaved: () => void }> = ({ open, branchId, branches, onClose, onSaved }) => {
  const ui = useUi();
  const [f, setF] = useState<any>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [options, setOptions] = useState<number[]>([5, 15, 30, 60, 90, 120, 150, 180]);

  useEffect(() => {
    if (!open) return;
    setError('');
    studio.workingHours(branchId).then((d) => { setOptions(d.slice_options || d.slot_options || options); setF({ branch_id: branchId, ...d.effective }); }).catch((e) => ui.error(e));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, branchId]);

  const save = async () => {
    setError('');
    if (!f.start_time || !f.end_time) { setError('ساعت شروع و پایان را وارد کنید.'); return; }
    if (toMin(f.start_time) >= toMin(f.end_time)) { setError('ساعت شروع باید قبل از ساعت پایان باشد.'); return; }
    setSaving(true);
    try { await studio.saveWorkingHours({ branch_id: f.branch_id, start_time: f.start_time, end_time: f.end_time, slot_minutes: Number(f.slot_minutes) }); ui.success(); notifyDataChanged(); onSaved(); } catch (e) { setError(errMsg(e)); } finally { setSaving(false); }
  };

  return (
    <Modal open={open} onClose={onClose} size="sm" title="تنظیم ساعات کاری" footer={<><Btn onClick={onClose}>انصراف</Btn><Btn variant="primary" loading={saving} disabled={!f} onClick={save}>ذخیره</Btn></>}>
      {!f ? null : (
        <div className="space-y-3">
          {error && <div className="px-3 py-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm">{error}</div>}
          <Field label="شعبه">
            <select className={inputCls} value={f.branch_id} onChange={(e) => { const id = Number(e.target.value); setF({ ...f, branch_id: id }); studio.workingHours(id).then((d) => setF((x: any) => ({ ...x, ...d.effective, branch_id: id }))).catch(() => undefined); }}>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="ساعت شروع"><TimePicker value={f.start_time} onChange={(v) => setF({ ...f, start_time: v })} step={30} /></Field>
            <Field label="ساعت پایان"><TimePicker value={f.end_time} onChange={(v) => setF({ ...f, end_time: v })} step={30} /></Field>
          </div>
          <Field label="مدت هر Slot">
            <select className={inputCls} value={f.slot_minutes} onChange={(e) => setF({ ...f, slot_minutes: Number(e.target.value) })}>
              {[5, 15, 30, 60, 90, 120, 150, 180].map((s) => <option key={s} value={s}>{SLOT_LABEL[s]}</option>)}
            </select>
          </Field>
        </div>
      )}
    </Modal>
  );
};

const HolidaysModal: React.FC<{ open: boolean; onClose: () => void; onChanged: () => void }> = ({ open, onClose, onChanged }) => {
  const ui = useUi();
  const { data, loading, reload } = useAsync(() => (open ? studio.holidays() : Promise.resolve([])), [open]);
  const [date, setDate] = useState(getTodayJalali());
  const [desc, setDesc] = useState('');

  const add = async () => {
    try {
      const r = await studio.addHoliday({ date, description: desc });
      ui.success(r?.affected_appointments ? `ثبت شد؛ ${toPersianDigits(r.affected_appointments)} نوبت فعال در این روز وجود دارد` : undefined);
      setDesc(''); reload(); onChanged();
    } catch (e) { ui.error(e); }
  };
  const del = async (h: any) => {
    if (!(await ui.confirm(`آیا از حذف تعطیلی ${toPersianDigits(h.date)} مطمئن هستید؟`))) return;
    try { await studio.deleteHoliday(h.id); ui.success('با موفقیت حذف شد'); reload(); onChanged(); } catch (e) { ui.error(e); }
  };
  const today = getTodayJalali();
  const rows = [...(data || [])].sort((a: any, b: any) => (a.date < b.date ? 1 : -1));
  return (
    <Modal open={open} onClose={onClose} title="تعطیلات" size="md">
      <div className="grid grid-cols-[1fr_1.4fr_auto] gap-2 items-end mb-4">
        <Field label="تاریخ"><PersianDatePicker value={date} onChange={(v) => v && setDate(v)} /></Field>
        <Field label="توضیحات"><input className={inputCls} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="مثلاً تعطیلی رسمی" /></Field>
        <Btn variant="primary" onClick={add}><Plus className="w-4 h-4" />ثبت</Btn>
      </div>
      {loading ? <LoadingState /> : rows.length === 0 ? <p className="text-sm text-slate-400 text-center py-6">اطلاعاتی برای نمایش وجود ندارد</p> : (
        <ul className="divide-y divide-slate-800 border border-slate-800 rounded-xl">
          {rows.map((h: any) => (
            <li key={h.id} className="flex items-center gap-3 px-3 py-2 text-sm">
              <span className={h.date >= today ? 'text-rose-300' : 'text-slate-500'}>{toPersianDigits(h.date)}</span>
              <span className="flex-1 text-slate-300">{h.description || '—'}</span>
              <Btn size="sm" variant="ghost" aria-label="حذف" onClick={() => del(h)}><Trash2 className="w-4 h-4 text-rose-400" /></Btn>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
};
export { Settings };
