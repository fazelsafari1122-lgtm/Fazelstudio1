import { request } from './api.ts';

const body = (method: string, data?: any): RequestInit => ({ method, body: data === undefined ? undefined : JSON.stringify(data) });
const qs = (params: Record<string, any>) => {
  const p = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '' && v !== 0 && v !== false);
  return p.length ? '?' + p.map(([k, v]) => `${k}=${encodeURIComponent(String(v === true ? 1 : v))}`).join('&') : '';
};

/** Thin REST client; swap `request` for another transport to point the UI at a different backend. */
export const studio = {
  meta: () => request<any>('/api/meta'),
  overview: () => request<any>('/api/dashboard/overview'),
  series: (range: string) => request<any>(`/api/dashboard/series?range=${range}`),
  report: (from: string, to: string) => request<any>(`/api/reports/overview${qs({ from, to })}`),
  search: (q: string) => request<any>(`/api/search?q=${encodeURIComponent(q)}`),
  notifications: () => request<any>('/api/notifications'),

  // families & tags
  families: (p: { q?: string; tag?: number; debt?: boolean } = {}) => request<any[]>(`/api/families${qs(p)}`),
  family: (id: number) => request<any>(`/api/families/${id}`),
  createFamily: (d: any) => request<any>('/api/families', body('POST', d)),
  updateFamily: (id: number, d: any) => request<any>(`/api/families/${id}`, body('PUT', d)),
  deleteFamily: (id: number) => request<any>(`/api/families/${id}`, body('DELETE')),
  tags: () => request<any[]>('/api/tags'),
  saveTag: (d: any) => request<any>(d.id ? `/api/tags/${d.id}` : '/api/tags', body(d.id ? 'PUT' : 'POST', d)),
  deleteTag: (id: number) => request<any>(`/api/tags/${id}`, body('DELETE')),

  // scheduling
  branches: () => request<any[]>('/api/branches'),
  saveBranch: (d: any) => request<any>(d.id ? `/api/branches/${d.id}` : '/api/branches', body(d.id ? 'PUT' : 'POST', d)),
  deleteBranch: (id: number) => request<any>(`/api/branches/${id}`, body('DELETE')),
  saveHall: (d: any) => request<any>(d.id ? `/api/halls/${d.id}` : '/api/halls', body(d.id ? 'PUT' : 'POST', d)),
  deleteHall: (id: number) => request<any>(`/api/halls/${id}`, body('DELETE')),
  workingHours: (branchId = 0) => request<any>(`/api/working-hours${qs({ branch_id: branchId })}`),
  saveWorkingHours: (d: any) => request<any>('/api/working-hours', body('PUT', d)),
  holidays: () => request<any[]>('/api/holidays'),
  addHoliday: (d: any) => request<any>('/api/holidays', body('POST', d)),
  deleteHoliday: (id: number) => request<any>(`/api/holidays/${id}`, body('DELETE')),
  appointments: (p: Record<string, any> = {}) => request<any[]>(`/api/appointments${qs(p)}`),
  saveAppointment: (d: any) => request<any>(d.id ? `/api/appointments/${d.id}` : '/api/appointments', body(d.id ? 'PUT' : 'POST', d)),
  setAppointmentStatus: (id: number, status: string, reason?: string) => request<any>(`/api/appointments/${id}/status`, body('PUT', { status, reason })),
  deleteAppointment: (id: number) => request<any>(`/api/appointments/${id}`, body('DELETE')),
  payDeposit: (id: number) => request<any>(`/api/appointments/${id}/deposit/pay`, body('POST', {})),
  processDeposits: () => request<any>('/api/appointments/process-deposits', body('POST', {})),

  // projects
  projects: () => request<any[]>('/api/projects'),
  project: (id: number) => request<any>(`/api/projects/${id}`),
  saveProject: (d: any) => request<any>(d.id ? `/api/projects/${d.id}` : '/api/projects', body(d.id ? 'PUT' : 'POST', d)),
  setProjectStatus: (id: number, status: string) => request<any>(`/api/projects/${id}/status`, body('PUT', { status })),
  deleteProject: (id: number) => request<any>(`/api/projects/${id}`, body('DELETE')),
  stages: () => request<any[]>('/api/project-stages'),
  saveStage: (d: any) => request<any>(d.id ? `/api/project-stages/${d.id}` : '/api/project-stages', body(d.id ? 'PUT' : 'POST', d)),
  reorderStages: (ids: number[]) => request<any>('/api/project-stages-order', body('PUT', { ids })),
  deleteStage: (id: number) => request<any>(`/api/project-stages/${id}`, body('DELETE')),
  prepStages: () => request<Record<string, string[]>>('/api/prep/stages'),
  prep: (kind: string) => request<any[]>(`/api/prep?kind=${kind}`),
  addPrep: (d: any) => request<any>('/api/prep', body('POST', d)),
  updatePrep: (id: number, d: any) => request<any>(`/api/prep/${id}`, body('PUT', d)),
  deletePrep: (id: number) => request<any>(`/api/prep/${id}`, body('DELETE')),

  // follow-ups
  followups: (p: Record<string, any> = {}) => request<any[]>(`/api/followups${qs(p)}`),
  saveFollowup: (d: any) => request<any>(d.id ? `/api/followups/${d.id}` : '/api/followups', body(d.id ? 'PUT' : 'POST', d)),
  doneFollowup: (id: number) => request<any>(`/api/followups/${id}/done`, body('POST', {})),
  closeFollowup: (id: number) => request<any>(`/api/followups/${id}/close`, body('POST', {})),
  nextFollowup: (id: number, date: string, time?: string) => request<any>(`/api/followups/${id}/next`, body('POST', { date, time })),
  deleteFollowup: (id: number) => request<any>(`/api/followups/${id}`, body('DELETE')),

  // finance
  invoices: () => request<any[]>('/api/invoices'),
  invoice: (id: number) => request<any>(`/api/invoices/${id}`),
  saveInvoice: (d: any) => request<any>(d.id ? `/api/invoices/${d.id}` : '/api/invoices', body(d.id ? 'PUT' : 'POST', d)),
  cancelInvoice: (id: number) => request<any>(`/api/invoices/${id}/cancel`, body('POST', {})),
  deleteInvoice: (id: number) => request<any>(`/api/invoices/${id}`, body('DELETE')),
  payments: () => request<any>('/api/payments'),
  addPayment: (d: any) => request<any>('/api/payments', body('POST', d)),
  deletePayment: (id: number) => request<any>(`/api/payments/${id}`, body('DELETE')),
  cheques: (p: Record<string, any> = {}) => request<any[]>(`/api/cheques${qs(p)}`),
  addCheque: (d: any) => request<any>('/api/cheques', body('POST', d)),
  updateCheque: (id: number, d: any) => request<any>(`/api/cheques/${id}`, body('PUT', d)),
  deleteCheque: (id: number) => request<any>(`/api/cheques/${id}`, body('DELETE')),
  products: () => request<any[]>('/api/products'),
  saveProduct: (d: any) => request<any>(d.id ? `/api/products/${d.id}` : '/api/products', body(d.id ? 'PUT' : 'POST', d)),
  adjustStock: (id: number, delta: number, reason: string) => request<any>(`/api/products/${id}/stock`, body('POST', { delta, reason })),
  stockMoves: (id: number) => request<any[]>(`/api/products/${id}/moves`),
  deleteProduct: (id: number) => request<any>(`/api/products/${id}`, body('DELETE')),
  expenses: () => request<any>('/api/accounting/expenses'),
  saveExpense: (d: any) => request<any>(d.id ? `/api/accounting/expenses/${d.id}` : '/api/accounting/expenses', body(d.id ? 'PUT' : 'POST', d)),
  deleteExpense: (id: number) => request<any>(`/api/accounting/expenses/${id}`, body('DELETE')),

  // sms
  smsVariables: () => request<string[]>('/api/sms/variables'),
  smsTemplates: () => request<any[]>('/api/sms/template-list'),
  saveSmsTemplate: (d: any) => request<any>(d.id ? `/api/sms/templates/${d.id}` : '/api/sms/templates', body(d.id ? 'PUT' : 'POST', d)),
  deleteSmsTemplate: (id: number) => request<any>(`/api/sms/templates/${id}`, body('DELETE')),
  sendSms: (d: any) => request<any>('/api/sms/send', body('POST', d)),
  sendBulkSms: (d: any) => request<any>('/api/sms/send-bulk', body('POST', d)),
  smsQueue: () => request<any[]>('/api/sms/queue'),
  smsSent: (p: Record<string, any> = {}) => request<any[]>(`/api/sms/sent${qs(p)}`),
  processSmsQueue: () => request<any>('/api/sms/queue/process', body('POST', {})),
  retrySms: (id: number) => request<any>(`/api/sms/${id}/retry`, body('POST', {})),
  deleteSms: (id: number) => request<any>(`/api/sms/${id}`, body('DELETE')),

  // basic info
  lookups: (kind: string) => request<any[]>(`/api/lookups/${kind}`),
  saveLookup: (kind: string, d: any) => request<any>(d.id ? `/api/lookups/${kind}/${d.id}` : `/api/lookups/${kind}`, body(d.id ? 'PUT' : 'POST', d)),
  deleteLookup: (kind: string, id: number) => request<any>(`/api/lookups/${kind}/${id}`, body('DELETE')),
  packages: () => request<any[]>('/api/packages'),
  savePackage: (d: any) => request<any>(d.id ? `/api/packages/${d.id}` : '/api/packages', body(d.id ? 'PUT' : 'POST', d)),
  deletePackage: (id: number) => request<any>(`/api/packages/${id}`, body('DELETE')),
  services: () => request<any[]>('/api/services'),
  saveService: (d: any) => request<any>(d.id ? `/api/services/${d.id}` : '/api/services', body(d.id ? 'PUT' : 'POST', d)),
  deleteService: (id: number) => request<any>(`/api/services/${id}`, body('DELETE')),
  roles: () => request<any[]>('/api/roles'),
  users: () => request<any[]>('/api/users'),
  saveUser: (d: any) => request<any>(d.id ? `/api/users/${d.id}` : '/api/users', body(d.id ? 'PUT' : 'POST', d)),
  deleteUser: (id: number) => request<any>(`/api/users/${id}`, body('DELETE')),
  settings: () => request<any>('/api/settings'),
  saveSettings: (d: any) => request<any>('/api/settings', body('POST', d)),
  team: () => request<any[]>('/api/team'),
};
