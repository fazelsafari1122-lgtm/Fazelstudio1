import { useCallback, useEffect, useState } from 'react';
import type { ActiveTab } from './types.ts';

/** Hash-based routes (#/customers/12). Works without server rewrites and survives refresh. */
export const TAB_PATHS: Record<string, string> = {
  dashboard: '/dashboard',
  management: '/management',
  customers: '/customers',
  crm: '/crm',
  appointments: '/appointments',
  followups: '/followups',
  weddings: '/weddings',
  contracts: '/contracts',
  contract_templates: '/contract-templates',
  projects: '/projects',
  prep_photo: '/projects/preparation/photo',
  prep_video: '/projects/preparation/video',
  prep_album: '/projects/preparation/album',
  calendar: '/calendar',
  reservations: '/reservations',
  equipment: '/equipment',
  equipment_categories: '/equipment-categories',
  services: '/services',
  prices: '/prices',
  invoices: '/invoices',
  payments: '/payments',
  cheques: '/cheques',
  products: '/products',
  expenses: '/expenses',
  cashflow: '/cashflow',
  team: '/team',
  team_finance: '/team-finance',
  sms: '/sms',
  sms_queue: '/sms/queue',
  sms_sent: '/sms/sent',
  sms_templates: '/sms/templates',
  reports: '/reports',
  basic_info: '/basic-information',
  users_roles: '/users',
  audit_logs: '/audit-logs',
  settings: '/settings',
};

const PATH_TO_TAB: Record<string, ActiveTab> = Object.fromEntries(Object.entries(TAB_PATHS).map(([t, p]) => [p, t as ActiveTab]));

export interface Route { tab: ActiveTab; id: number | null }

export function parseHash(hash: string): Route {
  const raw = (hash || '').replace(/^#/, '').split('?')[0] || '/dashboard';
  const path = raw.length > 1 ? raw.replace(/\/+$/, '') : raw;
  if (PATH_TO_TAB[path]) return { tab: PATH_TO_TAB[path], id: null };
  const m = path.match(/^\/(customers|projects)\/(\d+)$/);
  if (m) return { tab: m[1] as ActiveTab, id: Number(m[2]) };
  return { tab: 'dashboard', id: null };
}

export function hashFor(tab: ActiveTab, id?: number | null): string {
  const base = TAB_PATHS[tab] || '/dashboard';
  return `#${id ? `${base}/${id}` : base}`;
}

export function useRoute() {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash));
  useEffect(() => {
    const on = () => setRoute(parseHash(window.location.hash));
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  const navigate = useCallback((tab: ActiveTab, id?: number | null) => {
    const h = hashFor(tab, id);
    if (window.location.hash === h) setRoute({ tab, id: id ?? null });
    else window.location.hash = h;
  }, []);
  return { route, navigate };
}
