import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { jalaliToGregorianDateStr } from './jalali.ts';

// Data lives in ./data by default (override with DATA_DIR)
const dataDir = process.env.DATA_DIR || path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'studiowed.sqlite');
export const db = new DatabaseSync(dbPath);

// Enable WAL mode for performance
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

export function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password + '_studiowed_salt_2026').digest('hex');
}

export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'Admin',
      phone TEXT,
      email TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS roles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      permissions_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      phone TEXT NOT NULL,
      phone2 TEXT,
      national_id TEXT,
      birth_date TEXT,
      city TEXT DEFAULT 'تهران',
      address TEXT,
      source TEXT DEFAULT 'Instagram',
      status TEXT DEFAULT 'active',
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS brides_grooms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL,
      type TEXT NOT NULL, -- 'bride' | 'groom'
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      phone TEXT,
      phone2 TEXT,
      birth_date TEXT,
      address TEXT,
      notes TEXT,
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS weddings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL,
      wedding_date TEXT NOT NULL,
      start_time TEXT,
      end_time TEXT,
      team_arrival_time TEXT,
      venue_name TEXT,
      venue_address TEXT,
      gps_location TEXT,
      map_link TEXT,
      bride_prep_location TEXT,
      groom_prep_location TEXT,
      has_formality INTEGER DEFAULT 0,
      formality_location TEXT,
      formality_date TEXT,
      hall_contact TEXT,
      coordinator_name TEXT,
      guest_count INTEGER DEFAULT 0,
      notes TEXT,
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS services (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      description TEXT,
      price INTEGER NOT NULL DEFAULT 0,
      unit TEXT DEFAULT 'جلسه',
      is_active INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS equipment_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      icon TEXT
    );

    CREATE TABLE IF NOT EXISTS equipment (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      category_name TEXT NOT NULL,
      brand TEXT,
      model TEXT,
      photo TEXT,
      description TEXT,
      quantity INTEGER NOT NULL DEFAULT 1,
      purchase_price INTEGER DEFAULT 0,
      daily_rental_price INTEGER NOT NULL DEFAULT 0,
      serial_number TEXT,
      status TEXT DEFAULT 'available', -- 'available', 'rented', 'maintenance', 'retired'
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS equipment_price_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      equipment_id INTEGER NOT NULL,
      old_price INTEGER NOT NULL,
      new_price INTEGER NOT NULL,
      changed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      changed_by TEXT,
      FOREIGN KEY (equipment_id) REFERENCES equipment(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS contracts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      contract_number TEXT UNIQUE NOT NULL,
      customer_id INTEGER NOT NULL,
      wedding_id INTEGER,
      title TEXT NOT NULL,
      contract_date TEXT NOT NULL,
      total_amount INTEGER NOT NULL DEFAULT 0,
      discount_amount INTEGER NOT NULL DEFAULT 0,
      final_amount INTEGER NOT NULL DEFAULT 0,
      paid_amount INTEGER NOT NULL DEFAULT 0,
      remaining_amount INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'ثبت شده', -- 'پیشنویس', 'در انتظار تأیید', 'ثبت شده', 'فعال', 'تکمیل شده', 'لغو شده'
      payment_schedule_json TEXT,
      terms_text TEXT,
      notes TEXT,
      created_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT
    );

    CREATE TABLE IF NOT EXISTS contract_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      contract_id INTEGER NOT NULL,
      item_type TEXT NOT NULL, -- 'service' | 'equipment'
      item_id INTEGER,
      name TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      unit_price INTEGER NOT NULL DEFAULT 0,
      total_price INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (contract_id) REFERENCES contracts(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS equipment_reservations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      equipment_id INTEGER NOT NULL,
      contract_id INTEGER,
      project_id INTEGER,
      quantity INTEGER NOT NULL DEFAULT 1,
      daily_price INTEGER NOT NULL DEFAULT 0,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      days INTEGER NOT NULL DEFAULT 1,
      total_amount INTEGER NOT NULL DEFAULT 0,
      status TEXT DEFAULT 'confirmed', -- 'pending', 'confirmed', 'cancelled'
      override_reason TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (equipment_id) REFERENCES equipment(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_number TEXT UNIQUE NOT NULL,
      contract_id INTEGER,
      customer_id INTEGER NOT NULL,
      issue_date TEXT NOT NULL,
      due_date TEXT,
      subtotal INTEGER NOT NULL DEFAULT 0,
      discount INTEGER NOT NULL DEFAULT 0,
      tax INTEGER NOT NULL DEFAULT 0,
      total INTEGER NOT NULL DEFAULT 0,
      paid_amount INTEGER NOT NULL DEFAULT 0,
      remaining_amount INTEGER NOT NULL DEFAULT 0,
      status TEXT DEFAULT 'unpaid', -- 'unpaid', 'partially_paid', 'paid', 'cancelled'
      notes TEXT,
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT
    );

    CREATE TABLE IF NOT EXISTS invoice_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      unit_price INTEGER NOT NULL DEFAULT 0,
      total_price INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      payment_number TEXT UNIQUE NOT NULL,
      contract_id INTEGER,
      invoice_id INTEGER,
      customer_id INTEGER NOT NULL,
      amount INTEGER NOT NULL,
      payment_date TEXT NOT NULL,
      payment_method TEXT NOT NULL, -- 'نقدی', 'کارت', 'انتقال بانکی', 'چک', 'سایر'
      tracking_code TEXT,
      receiver_name TEXT,
      description TEXT,
      status TEXT DEFAULT 'verified',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      category TEXT NOT NULL, -- 'اجاره', 'اینترنت', 'برق و آب', 'تعمیر تجهیزات', 'خرید تجهیزات', 'تبلیغات', 'حقوق و دستمزد', 'نرم افزار', 'ایاب و ذهاب', 'سایر'
      amount INTEGER NOT NULL,
      expense_date TEXT NOT NULL,
      payment_method TEXT DEFAULT 'کارت',
      receiver TEXT,
      description TEXT,
      receipt_attachment TEXT,
      is_recurring INTEGER DEFAULT 0,
      created_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS recurring_expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      amount INTEGER NOT NULL,
      frequency TEXT DEFAULT 'monthly', -- 'monthly', 'yearly'
      due_day INTEGER DEFAULT 1,
      is_active INTEGER DEFAULT 1,
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS team_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT NOT NULL,
      phone TEXT NOT NULL,
      role TEXT NOT NULL, -- 'فیلمبردار', 'عکاس', 'تدوینگر', 'دستیار', 'راننده', 'مدیر پروژه', 'ادمین', 'سایر'
      specialty TEXT,
      bank_account_card TEXT,
      status TEXT DEFAULT 'active',
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS team_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      team_member_id INTEGER NOT NULL,
      project_id INTEGER,
      agreed_amount INTEGER NOT NULL DEFAULT 0,
      paid_amount INTEGER NOT NULL DEFAULT 0,
      remaining_amount INTEGER NOT NULL DEFAULT 0,
      payment_date TEXT,
      tracking_code TEXT,
      status TEXT DEFAULT 'تسویه نشده', -- 'تسویه نشده', 'پرداخت ناقص', 'تسویه شده'
      notes TEXT,
      FOREIGN KEY (team_member_id) REFERENCES team_members(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      contract_id INTEGER,
      customer_id INTEGER NOT NULL,
      wedding_id INTEGER,
      project_type TEXT NOT NULL DEFAULT 'عروسی',
      project_date TEXT NOT NULL,
      location TEXT,
      status TEXT NOT NULL DEFAULT 'جدید', -- 'جدید', 'رزرو شده', 'در حال انجام', 'فیلمبرداری شده', 'در حال تدوین', 'آماده تحویل', 'تحویل شده', 'لغو شده'
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT
    );

    CREATE TABLE IF NOT EXISTS project_team (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      team_member_id INTEGER NOT NULL,
      role TEXT NOT NULL,
      agreed_fee INTEGER DEFAULT 0,
      status TEXT DEFAULT 'assigned',
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (team_member_id) REFERENCES team_members(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS calendar_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      event_type TEXT NOT NULL, -- 'wedding', 'formality', 'project', 'equipment_reservation', 'team_schedule', 'customer_appointment', 'meeting', 'filming', 'photography', 'editing', 'delivery', 'pickup_return', 'studio_event', 'holiday'
      start_date TEXT NOT NULL, -- Jalali string '1405/06/15'
      end_date TEXT,
      start_time TEXT,
      end_time TEXT,
      location TEXT,
      customer_id INTEGER,
      project_id INTEGER,
      is_public INTEGER DEFAULT 0,
      description TEXT,
      gregorian_date TEXT
    );

    CREATE TABLE IF NOT EXISTS sms_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      pattern_code TEXT,
      content TEXT NOT NULL,
      variables_json TEXT
    );

    CREATE TABLE IF NOT EXISTS sms_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER,
      phone TEXT NOT NULL,
      template_id INTEGER,
      message_body TEXT NOT NULL,
      status TEXT DEFAULT 'sent', -- 'queued', 'sent', 'delivered', 'failed'
      provider_response TEXT,
      sent_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS contract_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      template_type TEXT NOT NULL, -- 'wedding', 'formality', 'advertising', 'content_production', 'equipment_rental'
      content_html TEXT NOT NULL,
      is_default INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS studio_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      user_name TEXT,
      action TEXT NOT NULL,
      object TEXT NOT NULL,
      object_id TEXT,
      old_value TEXT,
      new_value TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Migration: ensure gregorian_date exists on calendar_events and populate
  try {
    const cols = db.prepare("PRAGMA table_info(calendar_events)").all() as any[];
    if (!cols.some(c => c.name === 'gregorian_date')) {
      db.exec('ALTER TABLE calendar_events ADD COLUMN gregorian_date TEXT;');
    }
    const missing = db.prepare("SELECT id, start_date FROM calendar_events WHERE gregorian_date IS NULL OR gregorian_date = ''").all() as any[];
    const updateStmt = db.prepare('UPDATE calendar_events SET gregorian_date = ? WHERE id = ?');
    for (const row of missing) {
      const gDate = jalaliToGregorianDateStr(row.start_date);
      if (gDate) updateStmt.run(gDate, row.id);
    }
  } catch (migErr) {
    console.error('Migration error:', migErr);
  }

  // Seed default data if empty
  seedInitialData();
}

function seedInitialData() {
  const userCheck = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
  if (userCheck.count > 0) return;

  db.exec('PRAGMA foreign_keys = OFF;');

  try {
    const adminPass = hashPassword('1');
    db.prepare(`
      INSERT INTO users (username, password_hash, full_name, role, phone, email)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run('admin', adminPass, 'مدیر سیستم استودیو', 'Super Admin', '09123456789', 'admin@studiowed.ir');

  // Roles
  const roles = [
    { name: 'Super Admin', title: 'مدیر ارشد', desc: 'دسترسی کامل به تمامی بخش ها و تنظیمات', perms: ['all'] },
    { name: 'Admin', title: 'مدیر آتلیه', desc: 'مدیریت قراردادها، مشتریان، تجهیزات و مالی', perms: ['crm', 'contracts', 'weddings', 'equipment', 'finance', 'team', 'calendar', 'reports'] },
    { name: 'Manager', title: 'مدیر پروژه', desc: 'مدیریت هماهنگی مراسمات، پروژه‌ها و تجهیزات', perms: ['crm', 'projects', 'equipment', 'calendar'] },
    { name: 'Accountant', title: 'حسابدار', desc: 'مدیریت فاکتورها، پرداخت‌ها و دخل‌وخرج', perms: ['finance', 'invoices', 'payments', 'reports'] },
    { name: 'Staff', title: 'پرسنل / عکاس / تدوینگر', desc: 'مشاهده تقویم و پروژه‌های محول‌شده', perms: ['calendar_view', 'my_projects'] }
  ];

  const insertRole = db.prepare('INSERT INTO roles (name, title, description, permissions_json) VALUES (?, ?, ?, ?)');
  for (const r of roles) {
    insertRole.run(r.name, r.title, r.desc, JSON.stringify(r.perms));
  }

  // Settings
  const defaultSettings: Record<string, string> = {
    studio_name: 'STUDIO WED | استودیو تخصصی عروس',
    studio_slogan: 'سینمای خاطرات جاودان شما',
    phone: '021-88997766',
    mobile: '09121112233',
    address: 'تهران، خیابان فرشته، پلاک ۴۲، برج سفید، طبقه ۵',
    email: 'info@studiowed.ir',
    instagram: '@studiowed.official',
    bank_card: '۶۰۳۷-۹۹۷۵-۱۲۳۴-۵۶۷۸',
    bank_iban: 'IR120170000000123456789012',
    bank_owner: 'استودیو عروس و فیلمبرداری ود',
    currency: 'تومان',
    calendar_type: 'jalali',
    working_hours_start: '09:00',
    working_hours_end: '21:00',
    sms_provider: 'kavenegar',
    sms_api_key: '',
    sms_sender_number: '10008899',
    public_calendar_enabled: '1'
  };

  const insertSetting = db.prepare('INSERT OR REPLACE INTO studio_settings (key, value) VALUES (?, ?)');
  for (const [k, v] of Object.entries(defaultSettings)) {
    insertSetting.run(k, v);
  }

  // Equipment Categories
  const categories = [
    'دوربین فیلمبرداری',
    'دوربین عکاسی',
    'لنز',
    'گیمبال',
    'پهپاد',
    'میکروفون',
    'رکوردر',
    'نور',
    'سه پایه',
    'مانیتور',
    'لوازم جانبی',
    'تجهیزات آتلیه',
    'سایر'
  ];
  const insertCat = db.prepare('INSERT INTO equipment_categories (name, icon) VALUES (?, ?)');
  for (const c of categories) {
    insertCat.run(c, 'camera');
  }

  // Services
  const services = [
    { code: 'SRV-01', name: 'فیلمبرداری سینمایی با دو دوربین 4K', category: 'فیلمبرداری', price: 25000000, unit: 'پروژه' },
    { code: 'SRV-02', name: 'فیلمبرداری با هلی‌شات (Drone) حرفه‌ای', category: 'فیلمبرداری', price: 9000000, unit: 'پروژه' },
    { code: 'SRV-03', name: 'عکاسی نامحدود روز مراسم (رئال و مستند)', category: 'عکاسی', price: 15000000, unit: 'روز' },
    { code: 'SRV-04', name: 'تصویربرداری و عکاسی فرمالیته (شمال/کویر)', category: 'فرمالیته', price: 32000000, unit: 'پروژه' },
    { code: 'SRV-05', name: 'تدوین کلیپ باغ و آماده‌سازی عروس و داماد', category: 'ادیت', price: 12000000, unit: 'کلیپ' },
    { code: 'SRV-06', name: 'تدوین تیزر اینستاگرامی و هایلایت سینمایی', category: 'ادیت', price: 8000000, unit: 'کلیپ' },
    { code: 'SRV-07', name: 'آلبوم دیجیتال ایتالیایی 40x80 ده برگ', category: 'آلبوم', price: 18000000, unit: 'جلد' },
    { code: 'SRV-08', name: 'آلبوم مینیاتوری هدیه والدین 15x30', category: 'آلبوم', price: 6000000, unit: 'جلد' },
    { code: 'SRV-09', name: 'پخش زنده و کلیپ سر شب (Same Day Edit)', category: 'ساخت کلیپ', price: 14000000, unit: 'مراسم' },
    { code: 'SRV-10', name: 'شاسی کریستال 70x100 قاب شده', category: 'چاپ عکس', price: 4500000, unit: 'عدد' }
  ];

  const insertSrv = db.prepare('INSERT INTO services (code, name, category, price, unit, is_active) VALUES (?, ?, ?, ?, ?, 1)');
  for (const s of services) {
    insertSrv.run(s.code, s.name, s.category, s.price, s.unit);
  }

  // Equipment
  const equipmentList = [
    { code: 'EQ-01', name: 'Sony FX3 Cinema Line', cat: 'دوربین فیلمبرداری', brand: 'Sony', model: 'ILME-FX3', qty: 3, price: 210000000, rental: 2500000, serial: 'SN-FX3-8821' },
    { code: 'EQ-02', name: 'Sony A7 IV', cat: 'دوربین عکاسی', brand: 'Sony', model: 'ILCE-7M4', qty: 2, price: 135000000, rental: 1800000, serial: 'SN-A74-3319' },
    { code: 'EQ-03', name: 'Sony FE 24-70mm f/2.8 GM II', cat: 'لنز', brand: 'Sony', model: 'SEL2470GM2', qty: 2, price: 120000000, rental: 1200000, serial: 'SN-LN-2470-01' },
    { code: 'EQ-04', name: 'Sony FE 70-200mm f/2.8 GM OSS II', cat: 'لنز', brand: 'Sony', model: 'SEL70200GM2', qty: 1, price: 145000000, rental: 1500000, serial: 'SN-LN-70200-01' },
    { code: 'EQ-05', name: 'DJI RS3 Pro Combo', cat: 'گیمبال', brand: 'DJI', model: 'RS3 Pro', qty: 2, price: 48000000, rental: 900000, serial: 'SN-RS3P-552' },
    { code: 'EQ-06', name: 'DJI Mavic 3 Pro Cine', cat: 'پهپاد', brand: 'DJI', model: 'Mavic 3 Pro', qty: 1, price: 185000000, rental: 3000000, serial: 'SN-DRN-9011' },
    { code: 'EQ-07', name: 'Rode Wireless PRO', cat: 'میکروفون', brand: 'Rode', model: 'Wireless Pro 2ch', qty: 3, price: 22000000, rental: 600000, serial: 'SN-MIC-881' },
    { code: 'EQ-08', name: 'Nanlite Forza 300B II Bi-Color', cat: 'نور', brand: 'Nanlite', model: 'Forza 300B II', qty: 2, price: 55000000, rental: 1100000, serial: 'SN-LGT-300B' },
    { code: 'EQ-09', name: 'Atomos Ninja Ultra 5.2" HDR', cat: 'مانیتور', brand: 'Atomos', model: 'Ninja Ultra', qty: 2, price: 38000000, rental: 750000, serial: 'SN-MON-552' }
  ];

  const insertEq = db.prepare(`
    INSERT INTO equipment (code, name, category_name, brand, model, quantity, purchase_price, daily_rental_price, serial_number, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'available')
  `);
  for (const eq of equipmentList) {
    insertEq.run(eq.code, eq.name, eq.cat, eq.brand, eq.model, eq.qty, eq.price, eq.rental, eq.serial);
  }

  // Team Members
  const team = [
    { name: 'امیرحسین رضایی', phone: '09121110011', role: 'فیلمبردار', specialty: 'تصویربرداری سینمایی و کار با گیمبال', card: '۶۰۳۷-۹۹۱۹-۱۱۱۱-۲۲۲۲' },
    { name: 'نیلوفر کمالی', phone: '09122220022', role: 'عکاس', specialty: 'عکاسی پرتره عروس و رئال مستند', card: '۵۰۲۲-۲۹۱۰-۳۳۳۳-۴۴۴۴' },
    { name: 'سامان فراهانی', phone: '09123330033', role: 'تدوینگر', specialty: 'تدوین کلیپ، تصحیح رنگ داوینچی و ساخت تیزر', card: '۶۲۱۹-۸۶۱۰-۵۵۵۵-۶۶۶۶' },
    { name: 'سینا احمدی', phone: '09124440044', role: 'دستیار', specialty: 'نورپردازی، صدابرداری و مدیریت بکاپ راش‌ها', card: '۶۱۰۴-۳۳۷۸-۷۷۷۷-۸۸۸۸' },
    { name: 'مهرنوش صادقی', phone: '09125550055', role: 'مدیر پروژه', specialty: 'هماهنگی روز عروسی، سالن و تایم‌لاین مراسم', card: '۵۸۹۲-۱۰۱۱-۹۹۹۹-۰۰۰۰' }
  ];

  const insertTeam = db.prepare('INSERT INTO team_members (full_name, phone, role, specialty, bank_account_card) VALUES (?, ?, ?, ?, ?)');
  for (const t of team) {
    insertTeam.run(t.name, t.phone, t.role, t.specialty, t.card);
  }

  // Customers & Brides/Grooms & Weddings
  const cust1 = db.prepare(`
    INSERT INTO customers (first_name, last_name, phone, phone2, national_id, birth_date, city, address, source, status, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)
  `).run('سارا', 'افشار', '09128889900', '02122334455', '0019876543', '1372/04/18', 'تهران', 'نیاوران، خیابان بوکان، پلاک ۱۲', 'Instagram', 'مشتری VIP، پکیج کامل عروسی و فرمالیته قشم');

  const custId1 = cust1.lastInsertRowid;

  db.prepare(`
    INSERT INTO brides_grooms (customer_id, type, first_name, last_name, phone, birth_date)
    VALUES (?, 'bride', ?, ?, ?, ?)
  `).run(custId1, 'سارا', 'افشار', '09128889900', '1372/04/18');

  db.prepare(`
    INSERT INTO brides_grooms (customer_id, type, first_name, last_name, phone, birth_date)
    VALUES (?, 'groom', ?, ?, ?, ?)
  `).run(custId1, 'پوریا', 'کاظمی', '09127776655', '1369/08/25');

  const wedding1 = db.prepare(`
    INSERT INTO weddings (customer_id, wedding_date, start_time, end_time, team_arrival_time, venue_name, venue_address, bride_prep_location, groom_prep_location, has_formality, formality_location, formality_date, coordinator_name, guest_count, notes)
    VALUES (?, '1405/07/15', '14:00', '23:30', '12:30', 'باغ تالار دانیال', 'گرمدژ، بعد از پل کلاک، کوچه باغستان', 'سالن زیبایی شایگان، زعفرانیه', 'هتل اسپیناس پالاس', 1, 'جزیره قشم و جزایر ناز', '1405/06/20', 'خانم صادقی', 320, 'هماهنگی ورودی هلیکوپتر و نورپردازی ورودی باغ')
  `).run(custId1);

  const weddingId1 = wedding1.lastInsertRowid;

  // Contract 1
  const contract1 = db.prepare(`
    INSERT INTO contracts (contract_number, customer_id, wedding_id, title, contract_date, total_amount, discount_amount, final_amount, paid_amount, remaining_amount, status, terms_text, created_by)
    VALUES (?, ?, ?, ?, '1405/05/10', 85000000, 5000000, 80000000, 45000000, 35000000, 'ثبت شده', 'قرارداد رسمی پوشش تصویربرداری، عکاسی و تدوین روز عروسی و فرمالیته', 'admin')
  `).run('W-1405-101', custId1, weddingId1, 'قرارداد پکیج الماس عروسی و فرمالیته سارا افشار و پوریا کاظمی');

  const contractId1 = contract1.lastInsertRowid;

  // Items for Contract 1
  db.prepare('INSERT INTO contract_items (contract_id, item_type, item_id, name, quantity, unit_price, total_price) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(contractId1, 'service', 1, 'فیلمبرداری سینمایی با دو دوربین 4K', 1, 25000000, 25000000);
  db.prepare('INSERT INTO contract_items (contract_id, item_type, item_id, name, quantity, unit_price, total_price) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(contractId1, 'service', 2, 'فیلمبرداری با هلی‌شات (Drone) حرفه‌ای', 1, 9000000, 9000000);
  db.prepare('INSERT INTO contract_items (contract_id, item_type, item_id, name, quantity, unit_price, total_price) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(contractId1, 'service', 3, 'عکاسی نامحدود روز مراسم (رئال و مستند)', 1, 15000000, 15000000);
  db.prepare('INSERT INTO contract_items (contract_id, item_type, item_id, name, quantity, unit_price, total_price) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(contractId1, 'service', 4, 'تصویربرداری و عکاسی فرمالیته (قشم)', 1, 32000000, 32000000);
  db.prepare('INSERT INTO contract_items (contract_id, item_type, item_id, name, quantity, unit_price, total_price) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(contractId1, 'service', 7, 'آلبوم دیجیتال ایتالیایی 40x80 ده برگ', 1, 18000000, 18000000);

  // Invoice 1
  const inv1 = db.prepare(`
    INSERT INTO invoices (invoice_number, contract_id, customer_id, issue_date, due_date, subtotal, discount, total, paid_amount, remaining_amount, status)
    VALUES ('INV-1405-101', ?, ?, '1405/05/10', '1405/07/15', 85000000, 5000000, 80000000, 45000000, 35000000, 'partially_paid')
  `).run(contractId1, custId1);

  const invId1 = inv1.lastInsertRowid;

  // Payments for Contract 1
  db.prepare(`
    INSERT INTO payments (payment_number, contract_id, invoice_id, customer_id, amount, payment_date, payment_method, tracking_code, receiver_name, description)
    VALUES ('PAY-1001', ?, ?, ?, 25000000, '1405/05/10', 'کارت', '98451203', 'حسابداری استودیو', 'پیش‌پرداخت اولیه عقد قرارداد')
  `).run(contractId1, invId1, custId1);

  db.prepare(`
    INSERT INTO payments (payment_number, contract_id, invoice_id, customer_id, amount, payment_date, payment_method, tracking_code, receiver_name, description)
    VALUES ('PAY-1002', ?, ?, ?, 20000000, '1405/06/18', 'انتقال بانکی', 'SATNA-881273', 'مدیریت استودیو', 'قسط دوم قبل از اعزام به فرمالیته قشم')
  `).run(contractId1, invId1, custId1);

  // Project 1
  const proj1 = db.prepare(`
    INSERT INTO projects (project_code, name, contract_id, customer_id, wedding_id, project_type, project_date, location, status, notes)
    VALUES ('PRJ-1405-01', 'پروژه مراسم عروسی سارا و پوریا', ?, ?, ?, 'عروسی', '1405/07/15', 'باغ تالار دانیال', 'رزرو شده', 'آماده‌سازی تجهیزات FX3 و نور Nanlite')
  `).run(contractId1, custId1, weddingId1);

  const projId1 = proj1.lastInsertRowid;

  // Assign Team to Project 1
  db.prepare("INSERT INTO project_team (project_id, team_member_id, role, agreed_fee, status) VALUES (?, 1, 'فیلمبردار', 4500000, 'assigned')").run(projId1);
  db.prepare("INSERT INTO project_team (project_id, team_member_id, role, agreed_fee, status) VALUES (?, 2, 'عکاس', 3500000, 'assigned')").run(projId1);
  db.prepare("INSERT INTO project_team (project_id, team_member_id, role, agreed_fee, status) VALUES (?, 4, 'دستیار', 1500000, 'assigned')").run(projId1);

  // Reserve Equipment for Project 1 on 1405/07/15
  db.prepare(`
    INSERT INTO equipment_reservations (equipment_id, contract_id, project_id, quantity, daily_price, start_date, end_date, days, total_amount, status)
    VALUES (1, ?, ?, 2, 2500000, '1405/07/15', '1405/07/15', 1, 5000000, 'confirmed')
  `).run(contractId1, projId1);

  db.prepare(`
    INSERT INTO equipment_reservations (equipment_id, contract_id, project_id, quantity, daily_price, start_date, end_date, days, total_amount, status)
    VALUES (5, ?, ?, 1, 900000, '1405/07/15', '1405/07/15', 1, 900000, 'confirmed')
  `).run(contractId1, projId1);

  // Calendar events
  db.prepare(`
    INSERT INTO calendar_events (title, event_type, start_date, end_date, start_time, end_time, location, customer_id, project_id, is_public, description)
    VALUES ('مراسم عروسی سارا افشار و پوریا کاظمی', 'wedding', '1405/07/15', '1405/07/15', '14:00', '23:30', 'باغ تالار دانیال', ?, ?, 0, 'حضور تیم ساعت ۱۲:۳۰ در باغ تالار')
  `).run(custId1, projId1);

  db.prepare(`
    INSERT INTO calendar_events (title, event_type, start_date, end_date, start_time, end_time, location, customer_id, project_id, is_public, description)
    VALUES ('عکاسی و تصویربرداری فرمالیته قشم', 'formality', '1405/06/20', '1405/06/22', '06:00', '19:00', 'قشم، دره ستارگان و ناز', ?, ?, 0, 'سفر سه روزه تیم جهت فرمالیته ساحلی')
  `).run(custId1, projId1);

  // Studio Expenses
  const expList = [
    { title: 'اجاره دفتر آتلیه و استودیو (شهریور)', cat: 'اجاره', amount: 35000000, date: '1405/06/01', method: 'انتقال بانکی', rec: 'مالک برج سفید' },
    { title: 'خرید فیبر نوری و اشتراک اینترنت پرسرعت', cat: 'اینترنت', amount: 3200000, date: '1405/06/05', method: 'کارت', rec: 'شاتل' },
    { title: 'سرویس دوره‌ای و کالیبراسیون لنزهای سونی', cat: 'تعمیر تجهیزات', amount: 4800000, date: '1405/06/12', method: 'کارت', rec: 'ایران لنز' },
    { title: 'کمپین تبلیغاتی اینستاگرام و معرفی پکیج پاییز', cat: 'تبلیغات', amount: 12000000, date: '1405/06/15', method: 'کارت', rec: 'آژانس مارکتینگ' },
    { title: 'هزینه پذیرایی، قهوه و جلسات مشاوره با عروس و داماد', cat: 'سایر', amount: 2400000, date: '1405/06/18', method: 'کارت', rec: 'کافه آتلیه' }
  ];

  const insertExp = db.prepare('INSERT INTO expenses (title, category, amount, expense_date, payment_method, receiver) VALUES (?, ?, ?, ?, ?, ?)');
  for (const e of expList) {
    insertExp.run(e.title, e.cat, e.amount, e.date, e.method, e.rec);
  }

  // Recurring Expenses
  const recExp = [
    { title: 'اجاره ماهیانه استودیو', cat: 'اجاره', amount: 35000000, due_day: 1 },
    { title: 'اینترنت پرسرعت و سرور ذخیره سازی ابری راش‌ها', cat: 'اینترنت', amount: 3500000, due_day: 5 },
    { title: 'حقوق ثابت دستیار و ادمین سالن', cat: 'حقوق و دستمزد', amount: 22000000, due_day: 30 },
    { title: 'هزینه اشتراک نرم‌افزارهای تدوین و لایسنس', cat: 'نرم افزار', amount: 2000000, due_day: 10 }
  ];
  const insertRec = db.prepare('INSERT INTO recurring_expenses (title, category, amount, due_day) VALUES (?, ?, ?, ?)');
  for (const re of recExp) {
    insertRec.run(re.title, re.cat, re.amount, re.due_day);
  }

  // SMS Templates
  const smsTemplates = [
    {
      name: 'خوش‌آمدگویی و ثبت قرارداد',
      code: 'CONTRACT_SUBMIT',
      content: '{نام_عروس} و {نام_داماد} عزیز، از انتخاب استودیو STUDIO WED سپاسگزاریم. قرارداد شماره {شماره_قرارداد} به مبلغ {مبلغ_قرارداد} تومان ثبت گردید. با آرزوی خوشبختی جاودان.',
      vars: JSON.stringify(['{نام_عروس}', '{نام_داماد}', '{شماره_قرارداد}', '{مبلغ_قرارداد}'])
    },
    {
      name: 'تأیید واریز وجه',
      code: 'PAYMENT_RECEIVED',
      content: 'عروس و داماد گرامی، واریز مبلغ {پرداخت_شده} تومان بابت قرارداد {شماره_قرارداد} ثبت شد. مانده حساب: {مانده} تومان. استودیو STUDIO WED',
      vars: JSON.stringify(['{پرداخت_شده}', '{شماره_قرارداد}', '{مانده}'])
    },
    {
      name: 'یادآوری تاریخ مراسم و حضور تیم',
      code: 'WEDDING_REMINDER',
      content: 'سلام {نام_مشتری} گرامی، یادآوری مراسم باشکوه شما در تاریخ {تاریخ_مراسم} در {محل_مراسم}. تیم تصویربرداری ساعت {ساعت_مراسم} در محل حاضر خواهد بود. STUDIO WED',
      vars: JSON.stringify(['{نام_مشتری}', '{تاریخ_مراسم}', '{محل_مراسم}', '{ساعت_مراسم}'])
    }
  ];

  const insertSmsTpl = db.prepare('INSERT INTO sms_templates (name, pattern_code, content, variables_json) VALUES (?, ?, ?, ?)');
  for (const st of smsTemplates) {
    insertSmsTpl.run(st.name, st.code, st.content, st.vars);
  }

  // Contract Templates
  const contractTemplates = [
    {
      title: 'قرارداد استاندارد پکیج طلایی عروسی',
      type: 'wedding',
      is_default: 1,
      content_html: `
        <div style="font-family: 'Vazirmatn', Tahoma; direction: rtl; text-align: justify; line-height: 2;">
          <h2 style="text-align: center; color: #1a1a1a;">قرارداد ارائه خدمات تصویربرداری و عکاسی استودیو ود</h2>
          <p><strong>طرف اول (استودیو):</strong> مدیریت آتلیه تخصصی عروس STUDIO WED به نشانی تهران، خیابان فرشته، برج سفید</p>
          <p><strong>طرف دوم (مشتری/عروس و داماد):</strong> سرکار خانم {نام_عروس} و جناب آقای {نام_داماد} به شماره تماس {موبایل_مشتری}</p>
          <p><strong>موضوع قرارداد:</strong> پوشش کامل عکاسی و تصویربرداری روز مراسم در تاریخ {تاریخ_مراسم} در محل {محل_مراسم} و خدمات فرمالیته مندرج در فاکتور شماره {شماره_قرارداد}</p>
          <p><strong>مبلغ کل قرارداد:</strong> مبلغ {مبلغ_قرارداد} تومان که مبلغ {پرداخت_شده} تومان به عنوان پیش پرداخت تسویه و مانده آن معادل {مانده} تومان طبق جدول زمانبندی پرداخت خواهد شد.</p>
          <p><strong>تعهدات استودیو:</strong> حفظ امنیت و حریم خصوصی راش‌های تصویربرداری، به‌کارگیری تجهیزات با کیفیت 4K Cinema و تیم مجرب و تحویل فایل‌ها طبق موعد مقرر.</p>
        </div>
      `
    },
    {
      title: 'قرارداد تصویربرداری فرمالیته و کلیپ اسپرت',
      type: 'formality',
      is_default: 0,
      content_html: `
        <div style="font-family: 'Vazirmatn', Tahoma; direction: rtl; text-align: justify; line-height: 2;">
          <h2 style="text-align: center;">قرارداد عکاسی و تصویربرداری فرمالیته</h2>
          <p>موضوع: ضبط کلیپ و عکاسی حرفه‌ای فرمالیته برای {نام_عروس} و {نام_داماد} در تاریخ {تاریخ_مراسم} به مبلغ {مبلغ_قرارداد} تومان.</p>
        </div>
      `
    }
  ];

  const insertContractTpl = db.prepare('INSERT INTO contract_templates (title, template_type, content_html, is_default) VALUES (?, ?, ?, ?)');
  for (const ct of contractTemplates) {
    insertContractTpl.run(ct.title, ct.type, ct.content_html, ct.is_default);
  }

  // Audit log
  db.prepare(`
    INSERT INTO audit_logs (user_id, user_name, action, object, object_id, old_value, new_value)
    VALUES (1, 'مدیر سیستم', 'راه اندازی اولیه', 'System', '0', NULL, 'سامانه STUDIO WED با موفقیت راه اندازی شد')
  `).run();
  } finally {
    db.exec('PRAGMA foreign_keys = ON;');
  }
}
