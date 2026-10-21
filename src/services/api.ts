import type {
  Customer, Wedding, Contract, Invoice, Payment, Service, Equipment,
  EquipmentReservation, Expense, RecurringExpense, TeamMember, TeamPayment,
  Project, CalendarEvent, SMSTemplate, SMSMessage, ContractTemplate, AuditLog,
  StudioSettings, User
} from '../types.ts';

const TOKEN_KEY = 'studiowed_auth_token';
const USER_KEY = 'studiowed_auth_user';

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser(): User | null {
  const u = localStorage.getItem(USER_KEY);
  if (!u) return null;
  try { return JSON.parse(u); } catch { return null; }
}

export function setStoredSession(token: string, user: User) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearStoredSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

let lastMessage = '';
export function lastApiMessage(): string {
  return lastMessage;
}

export async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(endpoint, { ...options, headers });
  let data: any;
  try {
    data = await res.json();
  } catch {
    throw new Error('پاسخ نامعتبر از سرور دریافت شد.');
  }

  if (res.status === 401 && token && !endpoint.includes('/api/auth/login')) {
    clearStoredSession();
    window.dispatchEvent(new Event('studio-session-expired'));
  }

  if (!res.ok || data.success === false) {
    const error: any = new Error(data.message || 'خطا در ارتباط با سرور');
    error.conflict = data.conflict;
    error.data = data;
    throw error;
  }

  lastMessage = data.message || '';
  return data.data;
}

export const api = {
  // Auth
  login: async (credentials: { username: string; password: string } | string, passwordParam?: string) => {
    const payload = typeof credentials === 'string'
      ? { username: credentials, password: passwordParam || '' }
      : credentials;
    const res = await request<{ user: User; token: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    setStoredSession(res.token, res.user);
    return res;
  },
  logout: async () => {
    try {
      await request<any>('/api/auth/logout', { method: 'POST' });
    } catch {
      /* session may already be gone */
    }
    clearStoredSession();
    return { success: true };
  },
  getMe: () => request<User>('/api/auth/me'),
  changePassword: (payload: { oldPassword: string; newPassword: string }) =>
    request<{ message: string }>('/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // Dashboard
  getDashboardStats: () => request<any>('/api/dashboard/stats'),

  // CRM
  getCustomers: (search?: string) =>
    request<Customer[]>(`/api/crm/customers${search ? `?search=${encodeURIComponent(search)}` : ''}`),
  getCustomer: (id: number) => request<any>(`/api/crm/customers/${id}`),
  createCustomer: (customer: any) =>
    request<{ id: number }>('/api/crm/customers', {
      method: 'POST',
      body: JSON.stringify(customer),
    }),
  updateCustomer: (id: number, customer: any) =>
    request<any>(`/api/crm/customers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(customer),
    }),
  deleteCustomer: (id: number) =>
    request<any>(`/api/crm/customers/${id}`, { method: 'DELETE' }),

  // Weddings
  getWeddings: () => request<Wedding[]>('/api/weddings'),
  createWedding: (wedding: any) =>
    request<{ id: number }>('/api/weddings', {
      method: 'POST',
      body: JSON.stringify(wedding),
    }),

  // Services
  getServices: () => request<Service[]>('/api/services'),
  createService: (service: any) =>
    request<any>('/api/services', {
      method: 'POST',
      body: JSON.stringify(service),
    }),
  updateService: (id: number, service: any) =>
    request<any>(`/api/services/${id}`, {
      method: 'PUT',
      body: JSON.stringify(service),
    }),

  // Equipment
  getEquipment: () => request<{ equipment: Equipment[]; categories: any[] }>('/api/equipment'),
  createEquipment: (item: any) =>
    request<any>('/api/equipment', {
      method: 'POST',
      body: JSON.stringify(item),
    }),
  updateEquipment: (id: number, item: any) =>
    request<any>(`/api/equipment/${id}`, {
      method: 'PUT',
      body: JSON.stringify(item),
    }),

  // Equipment Reservations (Availability & Conflict Prevention)
  getEquipmentReservations: () => request<EquipmentReservation[]>('/api/equipment/reservations'),
  createEquipmentReservation: (reservation: any) =>
    request<{ id: number }>('/api/equipment/reservations', {
      method: 'POST',
      body: JSON.stringify(reservation),
    }),

  // Contracts
  getContracts: () => request<Contract[]>('/api/contracts'),
  getContract: (id: number) => request<any>(`/api/contracts/${id}`),
  createContract: (contract: any) =>
    request<{ id: number; contractNumber: string; invoiceId?: number }>('/api/contracts', {
      method: 'POST',
      body: JSON.stringify(contract),
    }),
  updateContractStatus: (id: number, status: string) =>
    request<any>(`/api/contracts/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    }),

  // Invoices & Payments
  getInvoices: () => request<Invoice[]>('/api/invoices'),
  getInvoice: (id: number) => request<any>(`/api/invoices/${id}`),
  getPayments: () => request<Payment[]>('/api/payments'),
  createPayment: (payment: any) =>
    request<any>('/api/payments', {
      method: 'POST',
      body: JSON.stringify(payment),
    }),
  deletePayment: (id: number) =>
    request<any>(`/api/payments/${id}`, {
      method: 'DELETE',
    }),

  // Accounting & Expenses
  getExpenses: () => request<{ expenses: Expense[]; recurring: RecurringExpense[] }>('/api/accounting/expenses'),
  createExpense: (expense: any) =>
    request<any>('/api/accounting/expenses', {
      method: 'POST',
      body: JSON.stringify(expense),
    }),
  createRecurringExpense: (item: any) =>
    request<any>('/api/accounting/recurring', {
      method: 'POST',
      body: JSON.stringify(item),
    }),

  // Team
  getTeam: () => request<TeamMember[]>('/api/team'),
  createTeamMember: (member: any) =>
    request<any>('/api/team', {
      method: 'POST',
      body: JSON.stringify(member),
    }),
  getTeamPayments: () => request<TeamPayment[]>('/api/team/payments'),
  createTeamPayment: (payment: any) =>
    request<any>('/api/team/payments', {
      method: 'POST',
      body: JSON.stringify(payment),
    }),

  // Projects
  getProjects: () => request<Project[]>('/api/projects'),
  updateProjectStatus: (id: number, status: string) =>
    request<any>(`/api/projects/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    }),

  // Calendar
  getCalendarEvents: () => request<CalendarEvent[]>('/api/calendar/events'),
  createCalendarEvent: (event: any) =>
    request<{ id: number; gregorian_date?: string }>('/api/calendar/events', {
      method: 'POST',
      body: JSON.stringify(event),
    }),
  updateCalendarEvent: (id: number, event: any) =>
    request<any>(`/api/calendar/events/${id}`, {
      method: 'PUT',
      body: JSON.stringify(event),
    }),
  deleteCalendarEvent: (id: number) =>
    request<any>(`/api/calendar/events/${id}`, {
      method: 'DELETE',
    }),

  // SMS
  getSMSTemplates: () => request<{ templates: SMSTemplate[]; logs: SMSMessage[] }>('/api/sms/templates'),
  sendSMS: (payload: { customer_id?: number; phone: string; template_id?: number; message_body?: string; variables?: any }) =>
    request<any>('/api/sms/send', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // Templates
  getContractTemplates: () => request<ContractTemplate[]>('/api/templates'),

  // Reports
  getFinancialReport: () => request<any>('/api/reports/financial'),

  // Users & Roles
  getUsers: () => request<{ users: User[]; roles: any[] }>('/api/users'),
  createUser: (user: any) =>
    request<{ id: number }>('/api/users', {
      method: 'POST',
      body: JSON.stringify(user),
    }),
  getAuditLogs: () => request<AuditLog[]>('/api/audit-logs'),

  // Settings
  getSettings: () => request<StudioSettings>('/api/settings'),
  saveSettings: (settings: StudioSettings) =>
    request<any>('/api/settings', {
      method: 'POST',
      body: JSON.stringify(settings),
    }),
  updateSettings: (settings: StudioSettings) =>
    request<any>('/api/settings', {
      method: 'POST',
      body: JSON.stringify(settings),
    }),

  // Public
  getPublicInfo: () => request<any>('/api/public/info'),
  submitPublicInquiry: (inquiry: any) =>
    request<any>('/api/public/inquiry', {
      method: 'POST',
      body: JSON.stringify(inquiry),
    }),
};
