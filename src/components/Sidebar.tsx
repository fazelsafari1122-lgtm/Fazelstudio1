import React, { useState } from 'react';
import {
  LayoutDashboard, Users, HeartHandshake, FileText, FolderGit2, Calendar as CalendarIcon, Clock, Camera, Boxes, Sparkles,
  DollarSign, Receipt, CreditCard, Scale, Wallet, UserCheck, BarChart3, MessageSquare, MailCheck, FileSignature,
  ShieldCheck, History, Settings, LogOut, ExternalLink, ChevronLeft, ChevronRight, Phone, Image, Heart, Database, Send, Tag, Bell, Cake
} from 'lucide-react';
import type { ActiveTab } from '../types.ts';
import { useLocalStorage } from '../hooks.ts';

export type { ActiveTab };

interface SidebarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  onLogout: () => void;
  onOpenPublicSite: () => void;
  isOpen: boolean;
  onCloseMobile: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  permissions: string[];
}

interface Item { id: ActiveTab; label: string; icon: any; perm?: string }
interface Group { key: string; title: string; items: Item[] }

export const MENU_GROUPS: Group[] = [
  { key: 'dash', title: 'داشبورد', items: [
    { id: 'dashboard', label: 'داشبورد', icon: LayoutDashboard },
    { id: 'management', label: 'داشبورد مدیریت', icon: BarChart3 },
  ] },
  { key: 'hr', title: 'منابع انسانی', items: [
    { id: 'team', label: 'مدیریت پرسنل', icon: Users },
  ] },
  { key: 'customers', title: 'مشتریان', items: [
    { id: 'customers', label: 'مدیریت خانواده‌ها', icon: Heart },
    { id: 'appointments', label: 'نوبت‌دهی', icon: CalendarIcon },
    { id: 'followups', label: 'پیگیری مشتریان', icon: Phone },
  ] },
  { key: 'projects', title: 'پروژه‌ها', items: [
    { id: 'projects', label: 'مدیریت پروژه', icon: FolderGit2 },
    { id: 'prep_photo', label: 'آماده‌سازی عکس', icon: Image },
    { id: 'prep_video', label: 'آماده‌سازی فیلم', icon: Camera },
    { id: 'prep_album', label: 'آماده‌سازی آلبوم', icon: Boxes },
  ] },
  { key: 'finance', title: 'مالی', items: [
    { id: 'invoices', label: 'مدیریت فاکتورها', icon: Receipt },
    { id: 'payments', label: 'مدیریت پرداختی‌ها', icon: CreditCard },
    { id: 'cheques', label: 'چک‌ها', icon: FileSignature, perm: 'finance' },
    { id: 'products', label: 'مدیریت کالاها', icon: Tag },
    { id: 'expenses', label: 'هزینه‌ها', icon: Wallet, perm: 'finance' },
    { id: 'team_finance', label: 'حساب تیم', icon: UserCheck, perm: 'finance' },
    { id: 'cashflow', label: 'دخل و خرج', icon: Scale, perm: 'finance' },
  ] },
  { key: 'sms', title: 'پیامک', items: [
    { id: 'sms', label: 'ارسال پیامک', icon: Send },
    { id: 'sms_queue', label: 'صف پیامک', icon: Clock },
    { id: 'sms_sent', label: 'پیام‌های ارسالی', icon: MailCheck },
  ] },
  { key: 'system', title: 'سیستم', items: [
    { id: 'basic_info', label: 'اطلاعات پایه', icon: Database, perm: 'settings' },
    { id: 'reports', label: 'گزارش‌ها', icon: BarChart3, perm: 'reports' },
    { id: 'users_roles', label: 'کاربران و دسترسی‌ها', icon: ShieldCheck, perm: 'users' },
    { id: 'audit_logs', label: 'گزارش فعالیت‌ها', icon: History, perm: 'users' },
    { id: 'settings', label: 'تنظیمات', icon: Settings, perm: 'settings' },
  ] },
  { key: 'legacy', title: 'عروس و داماد و انبار', items: [
    { id: 'crm', label: 'مشتریان قراردادی', icon: Users },
    { id: 'weddings', label: 'عروس و داماد', icon: HeartHandshake },
    { id: 'contracts', label: 'قراردادها', icon: FileText },
    { id: 'calendar', label: 'تقویم رویدادها', icon: Cake },
    { id: 'reservations', label: 'رزروها', icon: Clock },
    { id: 'equipment', label: 'تجهیزات', icon: Camera },
    { id: 'services', label: 'خدمات و قیمت‌ها', icon: Sparkles },
    { id: 'contract_templates', label: 'قالب قرارداد', icon: DollarSign },
  ] },
];

const GROUP_OF: Record<string, string> = {};
MENU_GROUPS.forEach((g) => g.items.forEach((i) => { GROUP_OF[i.id] = g.key; }));

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, onLogout, onOpenPublicSite, isOpen, onCloseMobile, collapsed, onToggleCollapse, permissions }) => {
  const [closedGroups, setClosedGroups] = useLocalStorage<string[]>('studio_closed_groups', ['legacy']);
  const [, force] = useState(0);
  const can = (p?: string) => !p || permissions.includes('all') || permissions.includes(p);
  const activeGroup = GROUP_OF[activeTab];

  const toggleGroup = (key: string) => {
    setClosedGroups(closedGroups.includes(key) ? closedGroups.filter((k) => k !== key) : [...closedGroups, key]);
    force((n) => n + 1);
  };

  return (
    <>
      {isOpen && <div id="sidebar-backdrop" onClick={onCloseMobile} className="fixed inset-0 bg-black/70 backdrop-blur-xs z-40 lg:hidden" />}
      <aside
        id="admin-sidebar"
        className={`fixed top-0 bottom-0 right-0 ${collapsed ? 'lg:w-[72px]' : 'lg:w-64'} w-64 bg-[#0e1117] border-l border-slate-800/80 flex flex-col z-50 transition-all duration-300 ease-in-out ${isOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}`}
      >
        <div className="h-16 px-4 flex items-center justify-between border-b border-slate-800/80 bg-[#0a0d12] shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 shrink-0 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center font-cinzel font-bold text-slate-950 text-base shadow-sm shadow-amber-500/20">W</div>
            <div className={`${collapsed ? 'lg:hidden' : ''} min-w-0`}>
              <span className="font-cinzel text-base tracking-wider font-bold text-white block truncate">STUDIO WED</span>
              <span className="text-[10px] text-amber-400/90 block truncate">سامانه مدیریت آتلیه</span>
            </div>
          </div>
          <button id="close-sidebar-mobile" onClick={onCloseMobile} className="p-1 rounded-md text-slate-400 hover:text-white lg:hidden" aria-label="بستن منو"><ChevronLeft className="w-5 h-5" /></button>
          <button onClick={onToggleCollapse} className="hidden lg:flex p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800" aria-label={collapsed ? 'باز کردن منو' : 'جمع کردن منو'} title={collapsed ? 'باز کردن منو' : 'جمع کردن منو'}>
            {collapsed ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
          {MENU_GROUPS.map((group) => {
            const items = group.items.filter((i) => can(i.perm));
            if (!items.length) return null;
            const isClosed = closedGroups.includes(group.key) && activeGroup !== group.key;
            return (
              <div key={group.key} className="space-y-1">
                <button onClick={() => toggleGroup(group.key)} className={`w-full flex items-center justify-between px-2 text-[11px] font-semibold text-slate-400 hover:text-slate-200 ${collapsed ? 'lg:hidden' : ''}`}>
                  <span>{group.title}</span>
                  <ChevronLeft className={`w-3 h-3 transition-transform ${isClosed ? '' : '-rotate-90'}`} />
                </button>
                {collapsed && <div className="hidden lg:block border-t border-slate-800/80 my-1" />}
                {(!isClosed || collapsed) && items.map((item) => {
                  const Icon = item.icon;
                  const active = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      id={`menu-item-${item.id}`}
                      title={item.label}
                      onClick={() => { setActiveTab(item.id); onCloseMobile(); }}
                      className={`w-full flex items-center gap-3 ${collapsed ? 'lg:justify-center lg:px-0' : ''} px-3 py-2 rounded-xl text-sm transition-all text-right ${active ? 'bg-amber-500/15 text-amber-300 font-medium border border-amber-500/30' : 'text-slate-300 hover:text-white hover:bg-slate-800/50 border border-transparent'}`}
                    >
                      <Icon className={`w-[18px] h-[18px] shrink-0 ${active ? 'text-amber-400' : 'text-slate-400'}`} />
                      <span className={`truncate ${collapsed ? 'lg:hidden' : ''}`}>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </nav>

        <div className="p-3 border-t border-slate-800/80 bg-[#0a0d12] space-y-1.5 shrink-0">
          <button id="btn-public-website" onClick={onOpenPublicSite} title="مشاهده وبسایت عمومی" className={`w-full flex items-center ${collapsed ? 'lg:justify-center' : 'justify-between'} px-3 py-2 rounded-xl text-xs font-medium text-slate-300 hover:text-white bg-slate-800/60 hover:bg-slate-800 border border-slate-700/50`}>
            <span className="flex items-center gap-2"><ExternalLink className="w-3.5 h-3.5 text-amber-400" /><span className={collapsed ? 'lg:hidden' : ''}>مشاهده وبسایت عمومی</span></span>
          </button>
          <button id="btn-logout" onClick={onLogout} title="خروج" className={`w-full flex items-center gap-2.5 ${collapsed ? 'lg:justify-center' : ''} px-3 py-2 rounded-xl text-xs font-medium text-rose-400 hover:text-rose-300 hover:bg-rose-950/30`}>
            <LogOut className="w-4 h-4 shrink-0" /><span className={collapsed ? 'lg:hidden' : ''}>خروج از حساب</span>
          </button>
        </div>
      </aside>
    </>
  );
};
export { Bell };
