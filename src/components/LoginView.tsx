import React, { useState } from 'react';
import { Camera, Lock, User, Sparkles, ArrowRight, ShieldCheck } from 'lucide-react';
import { api } from '../services/api.ts';
import type { User as UserType } from '../types.ts';

interface LoginViewProps {
  onLoginSuccess: (user: UserType) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('Mhmdfazel115');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError(null);
      const res = await api.login(username, password);
      onLoginSuccess(res.user);
    } catch (err: any) {
      setError(err.message || 'نام کاربری یا رمز عبور نامعتبر است.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-4 relative overflow-hidden" dir="rtl">
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 -right-20 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -left-20 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        {/* Brand Banner */}
        <div className="text-center mb-8 space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-300 text-slate-950 shadow-xl shadow-amber-500/20 mb-2">
            <Camera className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white">
            STUDIO <span className="text-amber-400">WED</span>
          </h1>
          <p className="text-xs text-slate-400">
            سامانه یکپارچه و پیشرفته مدیریت تخصصی آتلیه و استودیو عروس
          </p>
        </div>

        {/* Form Card */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-8 backdrop-blur-xl shadow-2xl space-y-6">
          <div className="border-b border-slate-800 pb-4">
            <h2 className="text-base font-bold text-white">ورود به پنل مدیریت</h2>
            <p className="text-xs text-slate-400 mt-1">
              جهت ورود، نام کاربری و رمز عبور سازمانی خود را وارد نمایید.
            </p>
          </div>

          {error && (
            <div className="p-3 bg-rose-500/15 border border-rose-500/30 rounded-xl text-rose-300 text-xs">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div>
              <label className="block text-slate-300 mb-1.5 font-medium">نام کاربری</label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700/80 rounded-xl py-3 pr-10 pl-3 text-white text-sm focus:border-amber-400 focus:outline-none transition-colors"
                  placeholder="admin"
                />
                <User className="w-4 h-4 text-slate-400 absolute right-3.5 top-3.5" />
              </div>
            </div>

            <div>
              <label className="block text-slate-300 mb-1.5 font-medium">رمز عبور</label>
              <div className="relative">
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700/80 rounded-xl py-3 pr-10 pl-3 text-white text-sm focus:border-amber-400 focus:outline-none transition-colors font-mono"
                  placeholder="••••"
                />
                <Lock className="w-4 h-4 text-slate-400 absolute right-3.5 top-3.5" />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-bold rounded-xl text-sm transition-all shadow-lg shadow-amber-500/10 flex items-center justify-center gap-2 mt-2"
            >
              <span>{loading ? 'در حال احراز هویت...' : 'ورود به سامانه'}</span>
              <ArrowRight className="w-4 h-4 rotate-180" />
            </button>
          </form>
        </div>

        <div className="text-center mt-6 text-[11px] text-slate-500">
          STUDIO WED &bull; سامانه امن رزرواسیون، مالی و قراردادهای عروسی
        </div>
      </div>
    </div>
  );
};
