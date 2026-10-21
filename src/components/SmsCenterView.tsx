import React, { useMemo, useState } from 'react';
import { MessageSquare, Send, Plus, Edit3, Trash2, RefreshCw, Clock, Check } from './icons.tsx';
import type { ActiveTab } from '../types.ts';
import { studio } from '../services/studioApi.ts';
import { useAsync, useDebounced, notifyDataChanged, errMsg } from '../hooks.ts';
import { Btn, Card, Field, PageHeader, SearchBox, StatCard, StatusBadge, Tabs, inputCls } from './ui/Common.tsx';
import { DataTable } from './ui/DataTable.tsx';
import { Modal } from './ui/Modal.tsx';
import { PersianDatePicker } from './ui/PersianDatePicker.tsx';
import { useUi } from './ui/UiProvider.tsx';
import { SmsComposeModal, SMS_VARS } from './SmsComposeModal.tsx';
import { toPersianDigits } from '../utils/jalali.ts';

interface Props { tab: ActiveTab; onNavigate: (t: ActiveTab) => void }

export const SmsCenterView: React.FC<Props> = ({ tab, onNavigate }) => {
  const [compose, setCompose] = useState(false);
  const [bulk, setBulk] = useState(false);
  const [version, setVersion] = useState(0);
  const bump = () => setVersion((v) => v + 1);
  const titles: Record<string, string> = { sms: 'ارسال پیامک', sms_queue: 'صف پیامک', sms_sent: 'پیام‌های ارسالی', sms_templates: 'قالب‌های پیامک' };

  return (
    <div>
      <PageHeader title={titles[tab] || 'پیامک'} subtitle="ارسال، صف و تاریخچه پیامک‌ها به همراه قالب‌ها" icon={<MessageSquare className="w-5 h-5" />}
        actions={<><Btn onClick={() => setBulk(true)}>ارسال گروهی</Btn><Btn variant="primary" onClick={() => setCompose(true)}><Send className="w-4 h-4" />پیامک جدید</Btn></>} />
      <Tabs value={tab} onChange={(t) => onNavigate(t as ActiveTab)} tabs={[{ id: 'sms', label: 'ارسال پیامک' }, { id: 'sms_queue', label: 'صف پیامک' }, { id: 'sms_sent', label: 'پیام‌های ارسالی' }, { id: 'sms_templates', label: 'قالب‌ها' }]} />
      {tab === 'sms' && <SendTab version={version} onCompose={() => setCompose(true)} onBulk={() => setBulk(true)} />}
      {tab === 'sms_queue' && <QueueTab key={version} />}
      {tab === 'sms_sent' && <SentTab key={version} />}
      {tab === 'sms_templates' && <TemplatesTab />}
      <SmsComposeModal open={compose} onClose={() => setCompose(false)} onSent={() => { setCompose(false); bump(); }} />
      <BulkModal open={bulk} onClose={() => setBulk(false)} onSent={() => { setBulk(false); bump(); }} />
    </div>
  );
};

const SendTab: React.FC<{ version: number; onCompose: () => void; onBulk: () => void }> = ({ version, onCompose, onBulk }) => {
  const queue = useAsync(() => studio.smsQueue(), [version]);
  const sent = useAsync(() => studio.smsSent(), [version]);
  const failed = (queue.data || []).filter((m) => m.status === 'خطا').length;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <StatCard label="ارسال‌شده" value={toPersianDigits((sent.data || []).length)} tone="emerald" icon={<Check className="w-5 h-5" />} />
        <StatCard label="در صف" value={toPersianDigits((queue.data || []).filter((m) => m.status !== 'خطا').length)} tone="sky" icon={<Clock className="w-5 h-5" />} />
        <StatCard label="خطادار" value={toPersianDigits(failed)} tone={failed ? 'rose' : 'slate'} />
      </div>
      <Card title="شروع ارسال">
        <p className="text-sm text-slate-300 mb-3">پیامک را برای یک مشتری یا چند خانواده بنویسید. از قالب‌ها و متغیرهایی مثل <span dir="ltr" className="text-amber-300">{'{{نام}}'}</span> و <span dir="ltr" className="text-amber-300">{'{{مانده}}'}</span> استفاده کنید.</p>
        <div className="flex gap-2"><Btn variant="primary" onClick={onCompose}><Send className="w-4 h-4" />پیامک جدید</Btn><Btn onClick={onBulk}>ارسال گروهی</Btn></div>
      </Card>
      <Card title="آخرین پیام‌ها">
        <DataTable rows={[...(queue.data || []), ...(sent.data || [])].sort((a, b) => b.id - a.id).slice(0, 8)} rowKey={(m) => m.id} loading={sent.loading && !sent.data} pageSize={8}
          columns={[
            { key: 'to', header: 'گیرنده', value: (m) => m.phone, render: (m) => <div><div>{m.customer_last ? `خانواده ${m.customer_last}` : '—'}</div><div className="text-[11px] text-slate-400" dir="ltr">{toPersianDigits(m.phone)}</div></div> },
            { key: 'body', header: 'پیام', render: (m) => <span className="text-xs">{toPersianDigits(m.message_body)}</span> },
            { key: 'status', header: 'وضعیت', render: (m) => <StatusBadge status={m.status} /> },
          ]} />
      </Card>
    </div>
  );
};

const QueueTab: React.FC = () => {
  const ui = useUi();
  const { data, loading, error, reload } = useAsync(() => studio.smsQueue(), []);
  const [busy, setBusy] = useState(false);
  const rows = data || [];
  const run = async (fn: () => Promise<any>, msg?: string) => { setBusy(true); try { await fn(); ui.success(msg); notifyDataChanged(); } catch (e) { ui.error(e); } finally { setBusy(false); reload(); } };
  const processAll = async () => { setBusy(true); try { const r = await studio.processSmsQueue(); ui.success(`${toPersianDigits(r.sent)} پیامک ارسال شد${r.failed ? `، ${toPersianDigits(r.failed)} خطا` : ''}${r.waiting ? `، ${toPersianDigits(r.waiting)} در انتظار زمان‌بندی` : ''}`); notifyDataChanged(); } catch (e) { ui.error(e); } finally { setBusy(false); reload(); } };
  const del = async (m: any) => { if (!(await ui.confirm('آیا از حذف این پیام از صف مطمئن هستید؟'))) return; run(() => studio.deleteSms(m.id), 'با موفقیت حذف شد'); };
  return (
    <Card>
      <div className="flex flex-wrap gap-2 mb-4">
        <Btn variant="primary" loading={busy} disabled={!rows.some((m) => m.status === 'در انتظار')} onClick={processAll}><Send className="w-4 h-4" />ارسال همه پیام‌های در انتظار</Btn>
        <Btn onClick={reload}><RefreshCw className="w-4 h-4" />بروزرسانی</Btn>
        <span className="text-xs text-slate-500 self-center">پیام‌های زمان‌بندی‌شده به‌صورت خودکار در موعد مقرر ارسال می‌شوند.</span>
      </div>
      <DataTable rows={rows} rowKey={(m) => m.id} loading={loading && !data} error={error} onRetry={reload} exportName="sms-queue" emptyText="صف ارسال خالی است"
        columns={[
          { key: 'msg', header: 'پیام', value: (m) => m.message_body, render: (m) => <span className="text-xs leading-6 block max-w-md">{toPersianDigits(m.message_body)}</span> },
          { key: 'to', header: 'گیرنده', value: (m) => m.phone, render: (m) => <div><div>{m.customer_last ? `خانواده ${m.customer_last}` : '—'}</div><div className="text-[11px] text-slate-400" dir="ltr">{toPersianDigits(m.phone)}</div></div> },
          { key: 'time', header: 'زمان ارسال', value: (m) => (m.scheduled_date ? `${m.scheduled_date} ${m.scheduled_time || ''}` : 'بلافاصله'), render: (m) => (m.scheduled_date ? toPersianDigits(`${m.scheduled_date} ${m.scheduled_time || ''}`) : 'بلافاصله') },
          { key: 'status', header: 'وضعیت', value: (m) => m.status, render: (m) => <div><StatusBadge status={m.status} />{m.status === 'خطا' && <div className="text-[11px] text-rose-300 mt-1">{m.provider_response}</div>}</div> },
          { key: 'act', header: '', noExport: true, render: (m) => (
            <div className="flex gap-1">
              {m.status !== 'در حال ارسال' && <Btn size="sm" disabled={busy} onClick={() => run(() => studio.retrySms(m.id), 'پیامک ارسال شد')}>{m.status === 'خطا' ? 'ارسال مجدد' : 'ارسال'}</Btn>}
              <Btn size="sm" variant="ghost" aria-label="حذف" onClick={() => del(m)}><Trash2 className="w-4 h-4 text-rose-400" /></Btn>
            </div>) },
        ]} />
    </Card>
  );
};

const SentTab: React.FC = () => {
  const [q, setQ] = useState('');
  const dq = useDebounced(q, 250);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const { data, loading, error, reload } = useAsync(() => studio.smsSent({ q: dq, from, to }), [dq, from, to]);
  return (
    <Card>
      <div className="flex flex-wrap gap-2 mb-4 items-end">
        <SearchBox className="flex-1 min-w-[200px]" value={q} onChange={setQ} placeholder="جستجوی گیرنده، شماره یا متن..." />
        <div className="w-40"><PersianDatePicker allowClear value={from} onChange={setFrom} placeholder="از تاریخ" /></div>
        <div className="w-40"><PersianDatePicker allowClear value={to} onChange={setTo} placeholder="تا تاریخ" /></div>
      </div>
      <DataTable rows={data || []} rowKey={(m) => m.id} loading={loading && !data} error={error} onRetry={reload} exportName="sms-sent"
        columns={[
          { key: 'to', header: 'گیرنده', value: (m) => `${m.customer_last || ''} ${m.phone}`, render: (m) => <div><div>{m.customer_last ? `خانواده ${m.customer_last}` : '—'}</div><div className="text-[11px] text-slate-400" dir="ltr">{toPersianDigits(m.phone)}</div></div> },
          { key: 'body', header: 'متن', value: (m) => m.message_body, render: (m) => <span className="text-xs leading-6 block max-w-md">{toPersianDigits(m.message_body)}</span> },
          { key: 'date', header: 'تاریخ', value: (m) => m.sent_date || '', render: (m) => toPersianDigits(m.sent_date || '—') },
          { key: 'time', header: 'ساعت', value: (m) => m.sent_time || '', render: (m) => toPersianDigits(m.sent_time || '—') },
          { key: 'status', header: 'وضعیت', value: (m) => m.status, render: (m) => <StatusBadge status={m.status} /> },
        ]} />
    </Card>
  );
};

export const TemplatesTab: React.FC = () => {
  const ui = useUi();
  const { data, loading, error, reload } = useAsync(() => studio.smsTemplates(), []);
  const [edit, setEdit] = useState<any>(null);
  const [err, setErr] = useState('');
  const save = async () => { setErr(''); try { await studio.saveSmsTemplate(edit); ui.success(); setEdit(null); reload(); } catch (e) { setErr(errMsg(e)); } };
  const del = async (t: any) => { if (!(await ui.confirm(`آیا از حذف قالب «${t.name}» مطمئن هستید؟`))) return; try { await studio.deleteSmsTemplate(t.id); ui.success('با موفقیت حذف شد'); reload(); } catch (e) { ui.error(e); } };
  return (
    <Card title="قالب‌های پیامک" action={<Btn size="sm" variant="primary" onClick={() => { setErr(''); setEdit({ name: '', content: '' }); }}><Plus className="w-4 h-4" />قالب جدید</Btn>}>
      <DataTable rows={data || []} rowKey={(t) => t.id} loading={loading && !data} error={error} onRetry={reload} onAdd={() => setEdit({ name: '', content: '' })}
        columns={[
          { key: 'name', header: 'عنوان', value: (t) => t.name }, { key: 'content', header: 'متن', render: (t) => <span className="text-xs leading-6 block max-w-xl">{t.content}</span> },
          { key: 'act', header: '', render: (t) => <div className="flex gap-1"><Btn size="sm" variant="ghost" aria-label="ویرایش" onClick={() => { setErr(''); setEdit({ ...t }); }}><Edit3 className="w-4 h-4" /></Btn><Btn size="sm" variant="ghost" aria-label="حذف" onClick={() => del(t)}><Trash2 className="w-4 h-4 text-rose-400" /></Btn></div> },
        ]} />
      {edit && (
        <Modal open onClose={() => setEdit(null)} title={edit.id ? 'ویرایش قالب' : 'قالب جدید'} footer={<><Btn onClick={() => setEdit(null)}>انصراف</Btn><Btn variant="primary" onClick={save}>ذخیره</Btn></>}>
          <div className="space-y-3">
            {err && <div className="px-3 py-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm">{err}</div>}
            <Field label="عنوان" required><input className={inputCls} value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
            <Field label="متن قالب" required>
              <textarea className={`${inputCls} min-h-[110px]`} value={edit.content} onChange={(e) => setEdit({ ...edit, content: e.target.value })} placeholder="سلام {{نام}} عزیز، یادآوری نوبت شما در تاریخ {{تاریخ}} ساعت {{ساعت}}" />
              <div className="flex flex-wrap gap-1.5 mt-2">{SMS_VARS.map((v) => <button key={v} type="button" onClick={() => setEdit({ ...edit, content: `${edit.content}{{${v}}}` })} className="px-2 py-0.5 rounded-lg text-[11px] bg-slate-800 text-amber-300 hover:bg-slate-700" dir="ltr">{`{{${v}}}`}</button>)}</div>
            </Field>
          </div>
        </Modal>
      )}
    </Card>
  );
};

const BulkModal: React.FC<{ open: boolean; onClose: () => void; onSent: () => void }> = ({ open, onClose, onSent }) => {
  const ui = useUi();
  const families = useAsync(() => (open ? studio.families({}) : Promise.resolve([])), [open]);
  const templates = useAsync(() => (open ? studio.smsTemplates() : Promise.resolve([])), [open]);
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState<number[]>([]);
  const [tpl, setTpl] = useState('');
  const [body, setBody] = useState('');
  const [onlyDebt, setOnlyDebt] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const list = useMemo(() => (families.data || []).filter((f) => (!onlyDebt || f.debt > 0) && (!q.trim() || [f.display_name, f.phone, f.father?.first_name, f.mother?.first_name].join(' ').includes(q.trim()))), [families.data, q, onlyDebt]);
  if (!open) return null;
  const toggle = (id: number) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const send = async () => {
    setSaving(true); setError('');
    try { const r = await studio.sendBulkSms({ customer_ids: picked, template_id: tpl || undefined, message_body: body }); ui.success(`${toPersianDigits(r.created)} پیامک ثبت شد${r.errors?.length ? ` (${toPersianDigits(r.errors.length)} مورد ناموفق)` : ''}`); notifyDataChanged(); setPicked([]); onSent(); } catch (e) { setError(errMsg(e)); } finally { setSaving(false); }
  };
  return (
    <Modal open onClose={onClose} size="lg" title="ارسال گروهی پیامک" footer={<><Btn onClick={onClose}>انصراف</Btn><Btn variant="primary" loading={saving} disabled={!picked.length || (!body && !tpl)} onClick={send}>ارسال به {toPersianDigits(picked.length)} خانواده</Btn></>}>
      <div className="space-y-3">
        {error && <div className="px-3 py-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm">{error}</div>}
        <Field label="قالب"><select className={inputCls} value={tpl} onChange={(e) => { setTpl(e.target.value); const t = (templates.data || []).find((x: any) => x.id === Number(e.target.value)); if (t) setBody(t.content); }}><option value="">— بدون قالب —</option>{(templates.data || []).map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></Field>
        <Field label="متن پیام (متغیرهای نام و مانده برای هر خانواده جایگزین می‌شوند)"><textarea className={`${inputCls} min-h-[80px]`} value={body} onChange={(e) => setBody(e.target.value)} /></Field>
        <div className="flex flex-wrap gap-2 items-center">
          <SearchBox className="flex-1 min-w-[180px]" value={q} onChange={setQ} placeholder="جستجوی خانواده..." />
          <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer"><input type="checkbox" className="accent-amber-500 w-4 h-4" checked={onlyDebt} onChange={(e) => setOnlyDebt(e.target.checked)} />فقط بدهکاران</label>
          <Btn size="sm" onClick={() => setPicked(list.map((f) => f.id))}>انتخاب همه</Btn><Btn size="sm" variant="ghost" onClick={() => setPicked([])}>پاک کردن</Btn>
        </div>
        <ul className="max-h-60 overflow-y-auto border border-slate-800 rounded-xl divide-y divide-slate-800">
          {list.map((f) => (
            <li key={f.id}><label className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-slate-800/50"><input type="checkbox" className="accent-amber-500 w-4 h-4" checked={picked.includes(f.id)} onChange={() => toggle(f.id)} />
              <span className="flex-1 text-sm">{f.display_name}</span><span className="text-[11px] text-slate-400" dir="ltr">{toPersianDigits(f.phone)}</span>{f.debt > 0 && <span className="text-[11px] text-rose-300">بدهکار</span>}</label></li>
          ))}
          {list.length === 0 && <li className="px-3 py-6 text-center text-sm text-slate-500">موردی پیدا نشد</li>}
        </ul>
      </div>
    </Modal>
  );
};
