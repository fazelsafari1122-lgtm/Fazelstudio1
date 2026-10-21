import React, { useEffect, useRef, useState } from 'react';
import { Menu, Search, Bell, Plus, User, LogOut, Phone, X } from 'lucide-react';
import type { User as UserType, ActiveTab } from '../types.ts';
import { studio } from '../services/studioApi.ts';
import { useDebounced } from '../hooks.ts';
import { toPersianDigits } from '../utils/jalali.ts';

export type QuickKind = 'family' | 'appointment' | 'project' | 'invoice' | 'contract';

interface HeaderProps {
  user: UserType;
  onToggleSidebar: () => void;
  onNavigate: (tab: ActiveTab, id?: number | null) => void;
  onQuick: (kind: QuickKind) => void;
  onLogout: () => void;
}

const TYPE_ICON_COLOR: Record<string, string> = {
  appointment: 'text-sky-400', followup: 'text-amber-400', debt: 'text-rose-400', cheque: 'text-violet-400', deadline: 'text-orange-400', sms: 'text-rose-400',
};

export const Header: React.FC<HeaderProps> = ({ user, onToggleSidebar, onNavigate, onQuick, onLogout }) => {
  const [term, setTerm] = useState('');
  const dterm = useDebounced(term, 250);
  const [results, setResults] = useState<any>(null);
  const [searching, setSearching] = useState(false);
  const [notif, setNotif] = useState<any>({ items: [], total: 0, mine_followups: 0 });
  const [showNotif, setShowNotif] = useState(false);
  const [showQuick, setShowQuick] = useState(false);
  const [showUser, setShowUser] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    const load = () => studio.notifications().then((n) => { if (alive) setNotif(n); }).catch(() => undefined);
    load();
    const t = setInterval(load, 60000);
    window.addEventListener('studio-data-changed', load);
    return () => { alive = false; clearInterval(t); window.removeEventListener('studio-data-changed', load); };
  }, []);

  useEffect(() => {
    if (!dterm.trim()) { setResults(null); return; }
    let alive = true;
    setSearching(true);
    studio.search(dterm.trim()).then((r) => { if (alive) setResults(r); }).catch(() => { if (alive) setResults(null); }).finally(() => { if (alive) setSearching(false); });
    return () => { alive = false; };
  }, [dterm]);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) { setShowNotif(false); setShowQuick(false); setShowUser(false); setResults(null); }
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const go = (tab: ActiveTab, id?: number) => { setTerm(''); setResults(null); setShowNotif(false); onNavigate(tab, id); };
  const groups: { key: string; title: string; tab: ActiveTab }[] = [
    { key: 'families', title: 'خانواده‌ها', tab: 'customers' }, { key: 'projects', title: 'پروژه‌ها', tab: 'projects' }, { key: 'invoices', title: 'فاکتورها', tab: 'invoices' },
  ];
  const resultCount = results ? groups.reduce((s, g) => s + (results[g.key]?.length || 0), 0) : 0;

  return (
    <header ref={box} className="h-16 shrink-0 bg-[#0a0d12]/90 backdrop-blur border-b border-slate-800/80 px-3 lg:px-6 flex items-center gap-3 sticky top-0 z-30">
      <button onClick={onToggleSidebar} className="lg:hidden p-2 rounded-xl text-slate-300 hover:bg-slate-800" aria-label="منو"><Menu className="w-5 h-5" /></button>

      <div className="relative flex-1 max-w-xl">
        <Search className="w-4 h-4 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="جستجو در مشتری، خانواده، پروژه، فاکتور، شماره تماس..."
          className="w-full bg-slate-900 border border-slate-800 rounded-xl pr-9 pl-8 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-500/70"
        />
        {term && <button onClick={() => { setTerm(''); setResults(null); }} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-200"><X className="w-3.5 h-3.5" /></button>}
        {term.trim() && (
          <div className="absolute mt-1.5 w-full bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl max-h-[70vh] overflow-y-auto z-50">
            {searching && <div className="px-4 py-3 text-xs text-slate-400">در حال جستجو...</div>}
            {!searching && results && resultCount === 0 && <div className="px-4 py-4 text-sm text-slate-400">نتیجه‌ای پیدا نشد.</div>}
            {results && groups.map((g) => (results[g.key]?.length ? (
              <div key={g.key}>
                <div className="px-4 py-1.5 text-[11px] font-semibold text-amber-300 bg-slate-950/60">{g.title}</div>
                {results[g.key].map((r: any) => (
                  <button key={`${g.key}-${r.id}`} onClick={() => go(g.tab, g.key === 'invoices' ? undefined : r.id)} className="w-full text-right px-4 py-2 hover:bg-slate-800 border-b border-slate-800/60 last:border-0">
                    <div className="text-sm text-slate-100">{r.title}</div>
                    <div className="text-[11px] text-slate-400">{r.subtitle}</div>
                  </button>
                ))}
              </div>
            ) : null))}
          </div>
        )}
      </div>

      <div className="relative">
        <button onClick={() => { setShowQuick(!showQuick); setShowNotif(false); setShowUser(false); }} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-l from-amber-400 to-amber-500 text-slate-950 text-sm font-medium hover:from-amber-300">
          <Plus className="w-4 h-4" /><span className="hidden sm:inline">جدید</span>
        </button>
        {showQuick && (
          <div className="absolute left-0 mt-1.5 w-48 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-1.5 z-50">
            {([['family', 'خانواده جدید'], ['appointment', 'نوبت جدید'], ['project', 'پروژه جدید'], ['invoice', 'فاکتور جدید'], ['contract', 'ثبت قرارداد']] as [QuickKind, string][]).map(([k, l]) => (
              <button key={k} onClick={() => { setShowQuick(false); onQuick(k); }} className="w-full text-right px-3 py-2 rounded-xl text-sm text-slate-200 hover:bg-slate-800">{l}</button>
            ))}
          </div>
        )}
      </div>

      <button onClick={() => onNavigate('followups')} title="پیگیری‌های من" className="relative p-2 rounded-xl text-slate-300 hover:bg-slate-800" aria-label="پیگیری‌های من">
        <Phone className="w-5 h-5" />
        {notif.mine_followups > 0 && <span className="absolute -top-0.5 -left-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-amber-500 text-slate-950 text-[10px] font-bold flex items-center justify-center">{toPersianDigits(notif.mine_followups)}</span>}
      </button>

      <div className="relative">
        <button onClick={() => { setShowNotif(!showNotif); setShowQuick(false); setShowUser(false); }} className="relative p-2 rounded-xl text-slate-300 hover:bg-slate-800" aria-label="اعلان‌ها">
          <Bell className="w-5 h-5" />
          {notif.total > 0 && <span className="absolute -top-0.5 -left-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center">{toPersianDigits(notif.total > 99 ? '99+' : notif.total)}</span>}
        </button>
        {showNotif && (
          <div className="absolute left-0 mt-1.5 w-[22rem] max-w-[92vw] bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl z-50 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-800 text-sm font-semibold text-slate-100">اعلان‌ها</div>
            <div className="max-h-96 overflow-y-auto">
              {notif.items.length === 0 && <div className="px-4 py-8 text-center text-sm text-slate-400">اعلان جدیدی وجود ندارد.</div>}
              {notif.items.map((n: any) => (
                <button key={n.key} onClick={() => go(n.target as ActiveTab)} className="w-full text-right px-4 py-2.5 hover:bg-slate-800 border-b border-slate-800/60 last:border-0 flex gap-3">
                  <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 bg-current ${TYPE_ICON_COLOR[n.type] || 'text-slate-400'}`} />
                  <span>
                    <span className="block text-xs font-semibold text-slate-200">{n.title}</span>
                    <span className="block text-xs text-slate-400 leading-5">{toPersianDigits(n.message)}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="relative">
        <button onClick={() => { setShowUser(!showUser); setShowNotif(false); setShowQuick(false); }} className="flex items-center gap-2 pr-1 pl-2 py-1 rounded-xl hover:bg-slate-800">
          <span className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-amber-400"><User className="w-4 h-4" /></span>
          <span className="hidden md:block text-right leading-tight">
            <span className="block text-xs font-medium text-slate-100">{user.full_name}</span>
            <span className="block text-[10px] text-slate-400">{user.role}</span>
          </span>
        </button>
        {showUser && (
          <div className="absolute left-0 mt-1.5 w-44 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-1.5 z-50">
            <button onClick={onLogout} className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-rose-400 hover:bg-rose-950/30"><LogOut className="w-4 h-4" />خروج</button>
          </div>
        )}
      </div>
    </header>
  );
};
