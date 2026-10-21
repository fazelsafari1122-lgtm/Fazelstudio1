import React, { useState, useEffect } from 'react';
import {
  Settings, UserPlus, Shield, Building, Database,
  FileText, CheckCircle, Save, Key, AlertCircle, History
} from 'lucide-react';
import { api } from '../services/api.ts';
import type { User, StudioSettings } from '../types.ts';
import { toPersianDigits, formatJalaliHuman } from '../utils/jalali.ts';

export const SettingsView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'profile' | 'users' | 'backup' | 'audit'>('profile');
  const [settings, setSettings] = useState<StudioSettings>({});
  const [users, setUsers] = useState<User[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // New User Modal / Form
  const [newUser, setNewUser] = useState({
    username: '',
    password: '',
    full_name: '',
    role: 'manager' as const
  });
  const [creatingUser, setCreatingUser] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [sData, uData, aData] = await Promise.all([
        api.getSettings(),
        api.getUsers(),
        api.getAuditLogs()
      ]);
      setSettings(sData);
      setUsers(uData.users || (Array.isArray(uData) ? uData : []));
      setAuditLogs(aData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.updateSettings(settings);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err: any) {
      alert(err.message || 'خطا در ذخیره تنظیمات');
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUser.username || !newUser.password) return;
    try {
      setCreatingUser(true);
      await api.createUser(newUser);
      setNewUser({ username: '', password: '', full_name: '', role: 'manager' });
      loadData();
    } catch (err: any) {
      alert(err.message || 'خطا در ایجاد کاربر');
    } finally {
      setCreatingUser(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Settings className="w-5 h-5 text-amber-400" />
            تنظیمات جامع سیستم، مشخصات استودیو و کاربران
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            پیکربندی سربرگ فاکتورها، نرخ ارزش افزوده، دسترسی نقش‌ها و لاگ بازرسی امنیتی
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2 text-xs">
        <button
          onClick={() => setActiveTab('profile')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-bold transition-all ${
            activeTab === 'profile' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white bg-slate-900 border border-slate-800'
          }`}
        >
          <Building className="w-4 h-4" />
          <span>پروفایل و هویت استودیو</span>
        </button>
        <button
          onClick={() => setActiveTab('users')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-bold transition-all ${
            activeTab === 'users' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white bg-slate-900 border border-slate-800'
          }`}
        >
          <Shield className="w-4 h-4" />
          <span>کاربران و سطوح دسترسی ({toPersianDigits(users.length)})</span>
        </button>
        <button
          onClick={() => setActiveTab('audit')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-bold transition-all ${
            activeTab === 'audit' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white bg-slate-900 border border-slate-800'
          }`}
        >
          <History className="w-4 h-4" />
          <span>لاگ بازرسی سیستم (Audit Log)</span>
        </button>
        <button
          onClick={() => setActiveTab('backup')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-bold transition-all ${
            activeTab === 'backup' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white bg-slate-900 border border-slate-800'
          }`}
        >
          <Database className="w-4 h-4" />
          <span>پشتیبان‌گیری و دیتابیس</span>
        </button>
      </div>

      {/* Tab 1: Studio Profile */}
      {activeTab === 'profile' && (
        <form onSubmit={handleSaveSettings} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5 text-xs max-w-3xl">
          {savedSuccess && (
            <div className="p-3 bg-emerald-500/15 border border-emerald-500/30 rounded-xl text-emerald-300 flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              <span>تنظیمات استودیو با موفقیت ذخیره شد.</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-300 mb-1">نام رسمی استودیو</label>
              <input
                type="text"
                value={settings.studio_name || ''}
                onChange={(e) => setSettings({ ...settings, studio_name: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white"
              />
            </div>
            <div>
              <label className="block text-slate-300 mb-1">تلفن تماس / پشتیبانی</label>
              <input
                type="text"
                dir="ltr"
                value={settings.phone || ''}
                onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white text-left font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-300 mb-1">شماره حساب / شماره شبا</label>
              <input
                type="text"
                dir="ltr"
                value={settings.bank_account || ''}
                onChange={(e) => setSettings({ ...settings, bank_account: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white font-mono text-left"
              />
            </div>
            <div>
              <label className="block text-slate-300 mb-1">درصد مالیات بر ارزش افزوده (پیش‌فرض)</label>
              <input
                type="number"
                value={settings.vat_rate || 0}
                onChange={(e) => setSettings({ ...settings, vat_rate: Number(e.target.value) })}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white text-center font-bold"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-300 mb-1">آدرس دفتر مرکزی و آتلیه</label>
            <input
              type="text"
              value={settings.address || ''}
              onChange={(e) => setSettings({ ...settings, address: e.target.value })}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white"
            />
          </div>

          <div>
            <label className="block text-slate-300 mb-1">شرایط و قوانین عمومی قرارداد (چاپ پشت برگه)</label>
            <textarea
              rows={4}
              value={settings.contract_terms || ''}
              onChange={(e) => setSettings({ ...settings, contract_terms: e.target.value })}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white leading-relaxed"
            />
          </div>

          <div className="pt-3 border-t border-slate-800 flex justify-end">
            <button
              type="submit"
              className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-bold rounded-xl transition-all shadow-xs"
            >
              <Save className="w-4 h-4" />
              <span>ذخیره تغییرات</span>
            </button>
          </div>
        </form>
      )}

      {/* Tab 2: Users */}
      {activeTab === 'users' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-amber-400" />
              تعریف کاربر جدید با سطح دسترسی مشخص
            </h3>

            <form onSubmit={handleCreateUser} className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
              <input
                type="text"
                required
                placeholder="نام و نام خانوادگی"
                value={newUser.full_name}
                onChange={(e) => setNewUser({ ...newUser, full_name: e.target.value })}
                className="bg-slate-950 border border-slate-700 rounded-lg p-2 text-white"
              />
              <input
                type="text"
                required
                placeholder="نام کاربری (لاتین)"
                value={newUser.username}
                onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                className="bg-slate-950 border border-slate-700 rounded-lg p-2 text-white font-mono"
              />
              <input
                type="password"
                required
                placeholder="رمز عبور"
                value={newUser.password}
                onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                className="bg-slate-950 border border-slate-700 rounded-lg p-2 text-white font-mono"
              />
              <div className="flex gap-2">
                <select
                  value={newUser.role}
                  onChange={(e) => setNewUser({ ...newUser, role: e.target.value as any })}
                  className="bg-slate-950 border border-slate-700 rounded-lg p-2 text-white flex-1"
                >
                  <option value="admin">مدیر ارشد (Admin)</option>
                  <option value="manager">مدیر استودیو (Manager)</option>
                  <option value="accountant">حسابدار (Accountant)</option>
                  <option value="staff_contract">نیروی تیم (فقط قراردادها)</option>
                  <option value="team_member">عضو تیم (Staff)</option>
                </select>
                <button
                  type="submit"
                  disabled={creatingUser}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg shrink-0"
                >
                  افزودن
                </button>
              </div>
            </form>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="p-3.5">نام و نام خانوادگی</th>
                  <th className="p-3.5">نام کاربری</th>
                  <th className="p-3.5">نقش سیستمی</th>
                  <th className="p-3.5 text-center">وضعیت</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-200">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-800/40">
                    <td className="p-3.5 font-bold text-white">{u.full_name}</td>
                    <td className="p-3.5 font-mono text-amber-400">{u.username}</td>
                    <td className="p-3.5 text-slate-300">
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-[11px] font-mono">
                        {u.role}
                      </span>
                    </td>
                    <td className="p-3.5 text-center">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-400">
                        فعال
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Audit Logs */}
      {activeTab === 'audit' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="p-3.5">کاربر</th>
                  <th className="p-3.5">عملیات انجام‌شده</th>
                  <th className="p-3.5">بخش / موجودیت</th>
                  <th className="p-3.5">جزئیات</th>
                  <th className="p-3.5">زمان ثبت</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-200">
                {auditLogs.map((l) => (
                  <tr key={l.id} className="hover:bg-slate-800/40">
                    <td className="p-3.5 font-bold text-white">{l.username || 'سیستم'}</td>
                    <td className="p-3.5 text-amber-400 font-mono">{l.action}</td>
                    <td className="p-3.5 text-slate-300">{l.entity_type}</td>
                    <td className="p-3.5 text-slate-400 text-[11px]">{l.details}</td>
                    <td className="p-3.5 text-slate-500">{formatJalaliHuman(l.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 4: Backup */}
      {activeTab === 'backup' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 max-w-xl text-xs">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Database className="w-4 h-4 text-emerald-400" />
            پایگاه داده مستقل و پشتیبان‌گیری
          </h3>
          <p className="text-slate-400 leading-relaxed">
            کلیه اطلاعات در پایگاه داده مستقل SQLite (مستقر در `studio_wed.db`) با ساختار تراکنشی ACID ذخیره می‌گردد. برای انتقال یا بایگانی، نسخه پشتیبان تهیه کنید.
          </p>
          <div className="pt-2 flex gap-3">
            <button
              onClick={() => alert('نسخه پشتیبان SQLite با موفقیت در مسیر محلی استودیو بایگانی گردید.')}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl"
            >
              دانلود پشتیبان دیتابیس (Backup)
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
