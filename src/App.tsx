import React, { useState, useEffect, useCallback } from 'react';
import { api } from './services/api.ts';
import type { User, ActiveTab } from './types.ts';
import { useRoute } from './router.ts';
import { useLocalStorage } from './hooks.ts';
import { UiProvider } from './components/ui/UiProvider.tsx';
import { Sidebar } from './components/Sidebar.tsx';
import { Header, QuickKind } from './components/Header.tsx';
import { LoginView } from './components/LoginView.tsx';
import { DashboardView } from './components/DashboardView.tsx';
import { CRMView } from './components/CRMView.tsx';
import { WeddingsView } from './components/WeddingsView.tsx';
import { ContractsView } from './components/ContractsView.tsx';
import { ProjectsView } from './components/ProjectsView.tsx';
import { CalendarView } from './components/CalendarView.tsx';
import { ReservationsView } from './components/ReservationsView.tsx';
import { EquipmentView } from './components/EquipmentView.tsx';
import { ServicesView } from './components/ServicesView.tsx';
import { InvoicesView } from './components/InvoicesView.tsx';
import { PaymentsView } from './components/PaymentsView.tsx';
import { AccountingView } from './components/AccountingView.tsx';
import { TeamView } from './components/TeamView.tsx';
import { SettingsView } from './components/SettingsView.tsx';
import { FamiliesView } from './components/FamiliesView.tsx';
import { SchedulerView } from './components/SchedulerView.tsx';
import { PrepView } from './components/PrepView.tsx';
import { FollowupsView } from './components/FollowupsView.tsx';
import { ChequesView } from './components/ChequesView.tsx';
import { ProductsView } from './components/ProductsView.tsx';
import { SmsCenterView } from './components/SmsCenterView.tsx';
import { BasicInfoView } from './components/BasicInfoView.tsx';
import { ManagementDashboard } from './components/ManagementDashboard.tsx';
import { ReportsView } from './components/ReportsView.tsx';
import { ExpensesView } from './components/ExpensesView.tsx';
import { UsersView } from './components/UsersView.tsx';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authChecking, setAuthChecking] = useState(true);
  const { route, navigate } = useRoute();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useLocalStorage<boolean>('studio_sidebar_collapsed', false);
  // Quick-action signals: bumping the number opens the matching "new" dialog in the target view
  const [signals, setSignals] = useState<Record<QuickKind, number>>({ family: 0, appointment: 0, project: 0, invoice: 0, contract: 0 });

  const checkAuth = useCallback(async () => {
    try {
      setAuthChecking(true);
      setCurrentUser(await api.getMe());
    } catch {
      setCurrentUser(null);
    } finally {
      setAuthChecking(false);
    }
  }, []);

  useEffect(() => { checkAuth(); }, [checkAuth]);

  useEffect(() => {
    const expired = () => setCurrentUser(null);
    window.addEventListener('studio-session-expired', expired);
    return () => window.removeEventListener('studio-session-expired', expired);
  }, []);

  const handleLogout = async () => {
    try { await api.logout(); } catch (err) { console.error(err); } finally { setCurrentUser(null); }
  };

  const quick = (kind: QuickKind) => {
    const target: Record<QuickKind, ActiveTab> = { family: 'customers', appointment: 'appointments', project: 'projects', invoice: 'invoices', contract: 'contracts' };
    navigate(target[kind]);
    setSignals((s) => ({ ...s, [kind]: s[kind] + 1 }));
  };

  if (authChecking) {
    return (
      <div className="min-h-screen bg-[#0c0e12] flex items-center justify-center text-amber-400" dir="rtl">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-3 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
          <span className="text-xs font-medium text-slate-300">در حال بارگذاری...</span>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <LoginView onLoginSuccess={(u) => { setCurrentUser(u); checkAuth(); }} />;
  }

  const perms = currentUser.permissions || ['view'];
  const tab = route.tab;
  const go = (t: ActiveTab, id?: number | null) => { navigate(t, id); setSidebarOpen(false); };

  return (
    <UiProvider>
      <div className="min-h-screen bg-[#0a0c10] text-slate-100 flex flex-col antialiased selection:bg-amber-500/30 selection:text-amber-200" dir="rtl">
        <div className="flex flex-1 overflow-hidden">
          <Sidebar
            activeTab={tab}
            setActiveTab={(v) => go(v)}
            onLogout={handleLogout}
            onOpenPublicSite={() => window.open('/', '_blank')}
            isOpen={sidebarOpen}
            onCloseMobile={() => setSidebarOpen(false)}
            collapsed={collapsed}
            onToggleCollapse={() => setCollapsed(!collapsed)}
            permissions={perms}
          />

          <div className={`flex-1 flex flex-col min-w-0 h-screen overflow-y-auto transition-[padding] duration-300 ${collapsed ? 'lg:pr-[72px]' : 'lg:pr-64'}`}>
            <Header user={currentUser} onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} onNavigate={go} onQuick={quick} onLogout={handleLogout} />

            <main className="flex-1 p-4 lg:p-6 max-w-[1600px] mx-auto w-full">
              {tab === 'dashboard' && <DashboardView onNavigate={(v: any) => go(v)} />}
              {tab === 'management' && <ManagementDashboard onNavigate={go} />}
              {tab === 'customers' && <FamiliesView selectedId={route.id} onOpen={(id) => go('customers', id)} onBack={() => go('customers')} openAddSignal={signals.family} onNavigate={go} />}
              {tab === 'crm' && <CRMView externalSearch="" openAddSignal={0} />}
              {tab === 'appointments' && <SchedulerView openAddSignal={signals.appointment} onOpenFamily={(id) => go('customers', id)} />}
              {tab === 'followups' && <FollowupsView onOpenFamily={(id) => go('customers', id)} />}
              {tab === 'weddings' && <WeddingsView />}
              {(tab === 'contracts' || tab === 'contract_templates') && <ContractsView openAddSignal={signals.contract} />}
              {tab === 'projects' && <ProjectsView selectedId={route.id} openAddSignal={signals.project} onOpenProject={(id) => go('projects', id)} onBack={() => go('projects')} onOpenFamily={(id) => go('customers', id)} />}
              {tab === 'prep_photo' && <PrepView kind="photo" onOpenProject={(id) => go('projects', id)} />}
              {tab === 'prep_video' && <PrepView kind="video" onOpenProject={(id) => go('projects', id)} />}
              {tab === 'prep_album' && <PrepView kind="album" onOpenProject={(id) => go('projects', id)} />}
              {tab === 'calendar' && <CalendarView />}
              {tab === 'reservations' && <ReservationsView />}
              {(tab === 'equipment' || tab === 'equipment_categories') && <EquipmentView />}
              {(tab === 'services' || tab === 'prices') && <ServicesView />}
              {tab === 'invoices' && <InvoicesView openAddSignal={signals.invoice} />}
              {tab === 'payments' && <PaymentsView />}
              {tab === 'cheques' && <ChequesView />}
              {tab === 'products' && <ProductsView />}
              {tab === 'expenses' && <ExpensesView />}
              {tab === 'cashflow' && <AccountingView />}
              {(tab === 'team' || tab === 'team_finance') && <TeamView />}
              {(tab === 'sms' || tab === 'sms_queue' || tab === 'sms_sent' || tab === 'sms_templates') && <SmsCenterView tab={tab} onNavigate={go} />}
              {tab === 'basic_info' && <BasicInfoView />}
              {tab === 'reports' && <ReportsView />}
              {tab === 'users_roles' && <UsersView />}
              {(tab === 'settings' || tab === 'audit_logs') && <SettingsView />}
            </main>
          </div>
        </div>
      </div>
    </UiProvider>
  );
}
