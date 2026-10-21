import React, { useState } from 'react';
import { ShieldCheck, Plus, Edit3, Trash2, Check } from './icons.tsx';
import { studio } from '../services/studioApi.ts';
import { useAsync, notifyMetaChanged, errMsg } from '../hooks.ts';
import { Btn, Card, Field, PageHeader, StatusBadge, Tabs, inputCls } from './ui/Common.tsx';
import { DataTable } from './ui/DataTable.tsx';
import { Modal } from './ui/Modal.tsx';
import { useUi } from './ui/UiProvider.tsx';

const PERMS: [string, string][] = [['view', 'مشاهده'], ['create', 'ایجاد'], ['edit', 'ویرایش'], ['delete', 'حذف'], ['finance', 'مالی'], ['reports', 'گزارش'], ['users', 'کاربران'], ['settings', 'تنظیمات']];

export const UsersView: React.FC = () => {
  const ui = useUi();
  const [tab, setTab] = useState('users');
  const { data, loading, error, reload } = useAsync(() => studio.users(), []);
  const [edit, setEdit] = useState<{ open: boolean; item: any | null }>({ open: false, item: null });
  const users: any[] = (data as any)?.users || [];
  const roles: any[] = ((data as any)?.roles || []).map((r: any) => ({ ...r, permissions: safe(r.permissions_json) }));
  const roleTitle = (name: string) => roles.find((r) => r.name === name)?.title || name;

  const remove = async (u: any) => {
    if (!(await ui.confirm(`آیا از حذف کاربر «${u.full_name}» مطمئن هستید؟`))) return;
    try { await studio.deleteUser(u.id); ui.success('با موفقیت حذف شد'); notifyMetaChanged(); reload(); } catch (e) { ui.error(e); }
  };

  return (
    <div>
      <PageHeader title="کاربران و دسترسی‌ها" subtitle="نقش‌ها: مدیر، حسابدار، اپراتور، عکاس، ادیتور" icon={<ShieldCheck className="w-5 h-5" />} actions={<Btn variant="primary" onClick={() => setEdit({ open: true, item: null })}><Plus className="w-4 h-4" />کاربر جدید</Btn>} />
      <Tabs value={tab} onChange={setTab} tabs={[{ id: 'users', label: 'کاربران', count: users.length }, { id: 'roles', label: 'ماتریس دسترسی' }]} />
      {tab === 'users' ? (
        <Card><DataTable rows={users} rowKey={(u) => u.id} loading={loading && !data} error={error} onRetry={reload} onAdd={() => setEdit({ open: true, item: null })} exportName="users"
          columns={[
            { key: 'name', header: 'نام', value: (u) => u.full_name }, { key: 'user', header: 'نام کاربری', value: (u) => u.username, render: (u) => <span dir="ltr">{u.username}</span> },
            { key: 'role', header: 'نقش', value: (u) => roleTitle(u.role) }, { key: 'phone', header: 'موبایل', value: (u) => u.phone || '' },
            { key: 'status', header: 'وضعیت', value: (u) => u.status, render: (u) => <StatusBadge status={u.status === 'active' ? 'فعال' : 'غیرفعال'} tone={u.status === 'active' ? 'green' : 'slate'} /> },
            { key: 'act', header: '', noExport: true, render: (u) => <div className="flex gap-1"><Btn size="sm" variant="ghost" aria-label="ویرایش" onClick={() => setEdit({ open: true, item: u })}><Edit3 className="w-4 h-4" /></Btn><Btn size="sm" variant="ghost" aria-label="حذف" onClick={() => remove(u)}><Trash2 className="w-4 h-4 text-rose-400" /></Btn></div> },
          ]} /></Card>
      ) : (
        <Card><div className="overflow-x-auto"><table className="w-full text-sm text-center">
          <thead className="text-xs text-slate-400"><tr><th className="text-right p-2">نقش</th>{PERMS.map(([, l]) => <th key={l} className="p-2">{l}</th>)}</tr></thead>
          <tbody className="divide-y divide-slate-800">{roles.map((r) => (
            <tr key={r.id}><td className="text-right p-2 font-medium">{r.title || r.name}</td>
              {PERMS.map(([k]) => <td key={k} className="p-2">{r.permissions.includes('all') || r.permissions.includes(k) ? <Check className="w-4 h-4 text-emerald-400 inline" /> : <span className="text-slate-600">—</span>}</td>)}</tr>
          ))}</tbody></table></div></Card>
      )}
      <UserForm state={edit} roles={roles} onClose={() => setEdit({ open: false, item: null })} onSaved={() => { setEdit({ open: false, item: null }); notifyMetaChanged(); reload(); }} />
    </div>
  );
};

function safe(s: string): string[] { try { return JSON.parse(s || '[]'); } catch { return []; } }

const UserForm: React.FC<{ state: { open: boolean; item: any | null }; roles: any[]; onClose: () => void; onSaved: () => void }> = ({ state, roles, onClose, onSaved }) => {
  const ui = useUi();
  const [f, setF] = useState<any>({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  React.useEffect(() => { if (state.open) { setError(''); setF(state.item ? { ...state.item, password: '' } : { username: '', password: '', full_name: '', role: 'Operator', phone: '', status: 'active' }); } }, [state.open, state.item]);
  if (!state.open) return null;
  const set = (k: string, v: any) => setF({ ...f, [k]: v });
  const save = async () => { setSaving(true); setError(''); try { const payload = { ...f }; if (state.item && !payload.password) delete payload.password; await studio.saveUser(payload); ui.success(); onSaved(); } catch (e) { setError(errMsg(e)); } finally { setSaving(false); } };
  return (
    <Modal open onClose={onClose} title={state.item ? 'ویرایش کاربر' : 'کاربر جدید'} footer={<><Btn onClick={onClose}>انصراف</Btn><Btn variant="primary" loading={saving} onClick={save}>ذخیره</Btn></>}>
      <div className="space-y-3">
        {error && <div className="px-3 py-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm">{error}</div>}
        <div className="grid grid-cols-2 gap-3">
          <Field label="نام کامل" required><input className={inputCls} value={f.full_name || ''} onChange={(e) => set('full_name', e.target.value)} /></Field>
          <Field label="نام کاربری" required><input className={inputCls} dir="ltr" disabled={!!state.item} value={f.username || ''} onChange={(e) => set('username', e.target.value)} /></Field>
          <Field label={state.item ? 'رمز جدید (اختیاری)' : 'رمز عبور'} required={!state.item}><input type="password" className={inputCls} dir="ltr" value={f.password || ''} onChange={(e) => set('password', e.target.value)} autoComplete="new-password" /></Field>
          <Field label="نقش" required><select className={inputCls} value={f.role || ''} onChange={(e) => set('role', e.target.value)}>{roles.map((r) => <option key={r.name} value={r.name}>{r.title || r.name}</option>)}</select></Field>
          <Field label="موبایل"><input className={inputCls} dir="ltr" value={f.phone || ''} onChange={(e) => set('phone', e.target.value)} /></Field>
          {state.item && <Field label="وضعیت"><select className={inputCls} value={f.status} onChange={(e) => set('status', e.target.value)}><option value="active">فعال</option><option value="inactive">غیرفعال</option></select></Field>}
        </div>
      </div>
    </Modal>
  );
};
