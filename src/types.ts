export type UserRole = string;

export interface User {
  permissions?: string[];
  id: number;
  username: string;
  full_name: string;
  role: UserRole;
  phone?: string;
  email?: string;
  status: 'active' | 'inactive';
  created_at?: string;
}

export interface Customer {
  id: number;
  first_name: string;
  last_name: string;
  phone: string;
  phone2?: string;
  national_id?: string;
  birth_date?: string;
  city?: string;
  address?: string;
  source?: 'Instagram' | 'معرفی دوستان' | 'سایت' | 'تماس' | 'مراجعه حضوری' | 'سایر';
  status?: 'active' | 'inactive';
  notes?: string;
  created_at?: string;
  contract_count?: number;
  debt_amount?: number;
}

export interface BrideGroom {
  id: number;
  customer_id: number;
  type: 'bride' | 'groom';
  first_name: string;
  last_name: string;
  phone?: string;
  phone2?: string;
  birth_date?: string;
  address?: string;
  notes?: string;
}

export interface Wedding {
  id: number;
  customer_id: number;
  wedding_date: string;
  start_time?: string;
  end_time?: string;
  team_arrival_time?: string;
  venue_name?: string;
  venue_address?: string;
  gps_location?: string;
  map_link?: string;
  bride_prep_location?: string;
  groom_prep_location?: string;
  has_formality?: number;
  formality_location?: string;
  formality_date?: string;
  hall_contact?: string;
  coordinator_name?: string;
  guest_count?: number;
  notes?: string;
  customer_first?: string;
  customer_last?: string;
  customer_phone?: string;
  bride_first?: string;
  bride_last?: string;
  bride_phone?: string;
  groom_first?: string;
  groom_last?: string;
  groom_phone?: string;
}

export interface Service {
  id: number;
  code: string;
  name: string;
  category: string;
  description?: string;
  price: number;
  unit: string;
  is_active: number;
}

export interface Equipment {
  id: number;
  code: string;
  name: string;
  category_name: string;
  brand?: string;
  model?: string;
  photo?: string;
  description?: string;
  quantity: number;
  purchase_price: number;
  daily_rental_price: number;
  serial_number?: string;
  status: 'available' | 'rented' | 'maintenance' | 'retired';
  notes?: string;
}

export interface EquipmentReservation {
  id: number;
  equipment_id: number;
  contract_id?: number;
  project_id?: number;
  quantity: number;
  daily_price: number;
  start_date: string;
  end_date: string;
  days: number;
  total_amount: number;
  status: 'confirmed' | 'pending' | 'cancelled';
  override_reason?: string;
  equipment_name?: string;
  equipment_code?: string;
  category_name?: string;
  contract_number?: string;
  customer_first?: string;
  customer_last?: string;
  created_at?: string;
}

export interface ContractItem {
  id?: number;
  contract_id?: number;
  item_type: 'service' | 'equipment';
  item_id?: number;
  name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

export interface Contract {
  id: number;
  contract_number: string;
  customer_id: number;
  wedding_id?: number;
  title: string;
  contract_date: string;
  total_amount: number;
  discount_amount: number;
  final_amount: number;
  paid_amount: number;
  remaining_amount: number;
  status: 'پیشنویس' | 'در انتظار تأیید' | 'ثبت شده' | 'فعال' | 'تکمیل شده' | 'لغو شده' | string;
  payment_status?: 'پرداخت نشده' | 'پرداخت ناقص' | 'تسویه شده' | string;
  payment_schedule_json?: string;
  terms_text?: string;
  notes?: string;
  created_by?: string;
  created_at?: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  wedding_date?: string;
  venue_name?: string;
  bride_first?: string;
  bride_last?: string;
  groom_first?: string;
  groom_last?: string;
  invoice_number?: string;
  invoice_id?: number;
  payments?: Payment[];
}

export interface Invoice {
  id: number;
  invoice_number: string;
  contract_id?: number;
  customer_id: number;
  issue_date: string;
  due_date?: string;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paid_amount: number;
  remaining_amount: number;
  status: 'unpaid' | 'partially_paid' | 'paid' | 'cancelled';
  payment_status?: 'پرداخت نشده' | 'پرداخت ناقص' | 'تسویه شده' | string;
  notes?: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  contract_number?: string;
  contract_date?: string;
  contract_title?: string;
  contract_total?: number;
  contract_discount?: number;
  contract_final?: number;
  bride_first?: string;
  bride_last?: string;
  groom_first?: string;
  groom_last?: string;
  payments?: Payment[];
}

export interface InvoiceItem {
  id?: number;
  invoice_id: number;
  name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

export interface Payment {
  id: number;
  payment_number: string;
  contract_id?: number;
  invoice_id?: number;
  customer_id: number;
  amount: number;
  payment_date: string;
  payment_method: 'نقدی' | 'کارت' | 'انتقال بانکی' | 'چک' | 'سایر' | string;
  tracking_code?: string;
  receiver_name?: string;
  description?: string;
  status?: string;
  created_at?: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  contract_number?: string;
  invoice_number?: string;
  bride_first?: string;
  bride_last?: string;
  groom_first?: string;
  groom_last?: string;
  contract_date?: string;
  contract_final_amount?: number;
  contract_subtotal?: number;
  contract_discount?: number;
}

export interface Expense {
  id: number;
  title: string;
  category: string;
  amount: number;
  expense_date: string;
  payment_method?: string;
  receiver?: string;
  description?: string;
  receipt_attachment?: string;
  is_recurring?: number;
  created_by?: string;
}

export interface RecurringExpense {
  id: number;
  title: string;
  category: string;
  amount: number;
  frequency: 'monthly' | 'yearly';
  due_day: number;
  is_active: number;
  notes?: string;
}

export interface TeamMember {
  id: number;
  full_name: string;
  phone: string;
  role: string;
  specialty?: string;
  bank_account_card?: string;
  status: 'active' | 'inactive';
  notes?: string;
  project_count?: number;
  total_agreed?: number;
  total_paid?: number;
  debt_amount?: number;
}

export interface TeamPayment {
  id: number;
  team_member_id: number;
  project_id?: number;
  agreed_amount: number;
  paid_amount: number;
  remaining_amount: number;
  payment_date?: string;
  tracking_code?: string;
  status: 'تسویه نشده' | 'پرداخت ناقص' | 'تسویه شده';
  notes?: string;
  member_name?: string;
  role?: string;
  bank_account_card?: string;
  project_name?: string;
}

export interface Project {
  id: number;
  project_code: string;
  name: string;
  contract_id?: number;
  customer_id: number;
  wedding_id?: number;
  project_type: string;
  project_date: string;
  location?: string;
  status: 'جدید' | 'رزرو شده' | 'در حال انجام' | 'فیلمبرداری شده' | 'در حال تدوین' | 'آماده تحویل' | 'تحویل شده' | 'لغو شده';
  notes?: string;
  created_at?: string;
  customer_first?: string;
  customer_last?: string;
  customer_phone?: string;
  wedding_date?: string;
  venue_name?: string;
  contract_number?: string;
}

export interface CalendarEvent {
  id: number;
  title: string;
  event_type: 'wedding' | 'formality' | 'project' | 'equipment_reservation' | 'team_schedule' | 'customer_appointment' | 'meeting' | 'filming' | 'photography' | 'editing' | 'delivery' | 'pickup_return' | 'studio_event' | 'holiday';
  start_date: string;
  end_date?: string;
  start_time?: string;
  end_time?: string;
  location?: string;
  customer_id?: number;
  project_id?: number;
  is_public: number;
  description?: string;
  first_name?: string;
  last_name?: string;
}

export interface SMSTemplate {
  id: number;
  name: string;
  pattern_code?: string;
  content: string;
  variables_json?: string;
}

export interface SMSMessage {
  id: number;
  customer_id?: number;
  phone: string;
  template_id?: number;
  message_body: string;
  status: 'queued' | 'sent' | 'delivered' | 'failed';
  provider_response?: string;
  sent_at: string;
  first_name?: string;
  last_name?: string;
}

export interface ContractTemplate {
  id: number;
  title: string;
  template_type: 'wedding' | 'formality' | 'advertising' | 'content_production' | 'equipment_rental';
  content_html: string;
  is_default: number;
}

export interface AuditLog {
  id: number;
  user_id?: number;
  user_name: string;
  action: string;
  object: string;
  object_id?: string;
  old_value?: string;
  new_value?: string;
  created_at: string;
}

export type ActiveTab =
  | 'dashboard'
  | 'management'
  | 'crm'
  | 'appointments'
  | 'followups'
  | 'prep_photo'
  | 'prep_video'
  | 'prep_album'
  | 'cheques'
  | 'products'
  | 'sms_queue'
  | 'sms_sent'
  | 'basic_info'
  | 'customers'
  | 'weddings'
  | 'contracts'
  | 'projects'
  | 'calendar'
  | 'reservations'
  | 'equipment'
  | 'equipment_categories'
  | 'services'
  | 'prices'
  | 'invoices'
  | 'payments'
  | 'cashflow'
  | 'expenses'
  | 'team_finance'
  | 'reports'
  | 'sms'
  | 'sms_templates'
  | 'contract_templates'
  | 'team'
  | 'users_roles'
  | 'audit_logs'
  | 'settings';

export type ViewType = ActiveTab;

export interface StudioSettings {
  [key: string]: any;
  studio_name?: string;
  studio_slogan?: string;
  phone?: string;
  mobile?: string;
  address?: string;
  email?: string;
  instagram?: string;
  bank_card?: string;
  bank_iban?: string;
  bank_owner?: string;
  bank_account?: string;
  vat_rate?: number;
  contract_terms?: string;
  currency?: string;
  working_hours_start?: string;
  working_hours_end?: string;
  sms_provider?: string;
  sms_api_key?: string;
  sms_sender_number?: string;
  public_calendar_enabled?: string;
}
