import { db } from './db.ts';

export const DEFAULT_STAGES = [
  { name: 'پروژه جدید', color: '#38bdf8' },
  { name: 'رزرو شده', color: '#818cf8' },
  { name: 'در انتظار عکاسی', color: '#a78bfa' },
  { name: 'عکاسی انجام شد', color: '#f472b6' },
  { name: 'آماده‌سازی عکس', color: '#fb923c' },
  { name: 'آماده‌سازی فیلم', color: '#f59e0b' },
  { name: 'آماده‌سازی آلبوم', color: '#facc15' },
  { name: 'آماده تحویل', color: '#34d399' },
  { name: 'تحویل شده', color: '#10b981' },
  { name: 'لغو شده', color: '#f87171' },
];

export const PREP_STAGES: Record<string, string[]> = {
  photo: ['دریافت فایل', 'انتخاب عکس', 'ادیت', 'روتوش', 'تأیید', 'خروجی', 'آماده تحویل'],
  video: ['دریافت فایل', 'تدوین اولیه', 'تدوین نهایی', 'اصلاحات', 'تأیید مشتری', 'خروجی', 'آماده تحویل'],
  album: ['انتخاب عکس', 'طراحی', 'اصلاحات', 'تأیید', 'چاپ', 'صحافی', 'آماده تحویل'],
};

export const STAGE_FOR_PREP: Record<string, string> = {
  photo: 'آماده‌سازی عکس',
  video: 'آماده‌سازی فیلم',
  album: 'آماده‌سازی آلبوم',
};

function hasColumn(table: string, column: string): boolean {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as any[];
  return cols.some((c) => c.name === column);
}

function addColumn(table: string, column: string, ddl: string) {
  if (!hasColumn(table, column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl};`);
  }
}

export function initExtraSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS family_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL,
      role TEXT NOT NULL, -- 'father' | 'mother' | 'child'
      first_name TEXT NOT NULL DEFAULT '',
      last_name TEXT NOT NULL DEFAULT '',
      phone TEXT,
      phone2 TEXT,
      gender TEXT,
      birth_date TEXT,
      job TEXT,
      notes TEXT,
      sort_order INTEGER DEFAULT 0,
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      color TEXT DEFAULT '#f59e0b'
    );

    CREATE TABLE IF NOT EXISTS customer_tags (
      customer_id INTEGER NOT NULL,
      tag_id INTEGER NOT NULL,
      PRIMARY KEY (customer_id, tag_id),
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
      FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS branches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      address TEXT,
      phone TEXT,
      is_active INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS halls (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      branch_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      capacity INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS working_hours (
      branch_id INTEGER PRIMARY KEY, -- 0 = global default
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      slot_minutes INTEGER NOT NULL DEFAULT 30
    );

    CREATE TABLE IF NOT EXISTS holidays (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      description TEXT,
      branch_id INTEGER
    );

    CREATE TABLE IF NOT EXISTS appointments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL,
      branch_id INTEGER NOT NULL,
      hall_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      duration_minutes INTEGER NOT NULL DEFAULT 60,
      project_type TEXT,
      project_id INTEGER,
      status TEXT NOT NULL DEFAULT 'رزرو شده', -- 'رزرو شده','انجام شد','لغو شده'
      notes TEXT,
      deposit_required INTEGER DEFAULT 0,
      deposit_amount INTEGER DEFAULT 0,
      deposit_sms_text TEXT,
      deposit_deadline_date TEXT,
      deposit_deadline_time TEXT,
      deposit_paid INTEGER DEFAULT 0,
      auto_cancel INTEGER DEFAULT 0,
      payment_link TEXT,
      reminder_date TEXT,
      reminder_time TEXT,
      reminder_text TEXT,
      reminder_sent INTEGER DEFAULT 0,
      cancel_reason TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS followups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER,
      title TEXT NOT NULL,
      description TEXT,
      assignee TEXT,
      assignee_user_id INTEGER,
      due_date TEXT NOT NULL,
      due_time TEXT,
      priority TEXT NOT NULL DEFAULT 'عادی', -- عادی | بالا | فوری
      status TEXT NOT NULL DEFAULT 'باز', -- باز | در انتظار | بسته شده
      next_followup_date TEXT,
      next_followup_time TEXT,
      outcome TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      closed_at DATETIME
    );

    CREATE TABLE IF NOT EXISTS cheques (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      payment_id INTEGER,
      customer_id INTEGER NOT NULL,
      cheque_number TEXT NOT NULL,
      bank TEXT,
      due_date TEXT NOT NULL,
      amount INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'دریافت شده', -- دریافت شده | در انتظار وصول | وصول شده | برگشتی
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT,
      stock INTEGER NOT NULL DEFAULT 0,
      purchase_price INTEGER DEFAULT 0,
      sale_price INTEGER DEFAULT 0,
      min_stock INTEGER DEFAULT 0,
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS stock_moves (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      delta INTEGER NOT NULL,
      reason TEXT,
      move_date TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS project_stages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      color TEXT DEFAULT '#94a3b8'
    );

    CREATE TABLE IF NOT EXISTS prep_tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      kind TEXT NOT NULL, -- photo | video | album
      stage TEXT NOT NULL,
      assignee TEXT,
      start_date TEXT,
      deadline TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (project_id, kind),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS lookups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kind TEXT NOT NULL, -- project_type | expense_category | payment_method | product_category | bank
      name TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0,
      UNIQUE (kind, name)
    );

    CREATE TABLE IF NOT EXISTS packages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      price INTEGER NOT NULL DEFAULT 0,
      description TEXT,
      is_active INTEGER DEFAULT 1
    );
  `);

  // Column migrations on existing tables
  addColumn('projects', 'assignee', 'TEXT');
  addColumn('projects', 'deadline', 'TEXT');
  addColumn('projects', 'amount', 'INTEGER DEFAULT 0');
  addColumn('projects', 'sort_order', 'INTEGER DEFAULT 0');
  addColumn('invoices', 'extra_costs', 'INTEGER DEFAULT 0');
  addColumn('invoices', 'project_id', 'INTEGER');
  addColumn('payments', 'payment_time', 'TEXT');
  addColumn('payments', 'bank_account', 'TEXT');
  addColumn('expenses', 'payer', 'TEXT');
  addColumn('sms_messages', 'sent_date', 'TEXT');
  addColumn('sms_messages', 'sent_time', 'TEXT');
  addColumn('sms_messages', 'scheduled_date', 'TEXT');
  addColumn('sms_messages', 'scheduled_time', 'TEXT');

  // SMS statuses -> Persian labels
  db.exec(`
    UPDATE sms_messages SET status = 'در انتظار' WHERE status = 'queued';
    UPDATE sms_messages SET status = 'ارسال شد' WHERE status IN ('sent', 'delivered');
    UPDATE sms_messages SET status = 'خطا' WHERE status = 'failed';
  `);

  // Project statuses -> new Kanban stages
  db.exec(`
    UPDATE projects SET status = 'پروژه جدید' WHERE status = 'جدید';
    UPDATE projects SET status = 'در انتظار عکاسی' WHERE status = 'در حال انجام';
    UPDATE projects SET status = 'عکاسی انجام شد' WHERE status = 'فیلمبرداری شده';
    UPDATE projects SET status = 'آماده‌سازی فیلم' WHERE status = 'در حال تدوین';
  `);

  // Default stages
  const stageCount = (db.prepare('SELECT COUNT(*) AS c FROM project_stages').get() as any).c;
  if (stageCount === 0) {
    const ins = db.prepare('INSERT INTO project_stages (name, sort_order, color) VALUES (?, ?, ?)');
    DEFAULT_STAGES.forEach((s, i) => ins.run(s.name, i + 1, s.color));
  }

  // Default working hours
  const wh = db.prepare('SELECT COUNT(*) AS c FROM working_hours').get() as any;
  if (wh.c === 0) {
    db.prepare('INSERT INTO working_hours (branch_id, start_time, end_time, slot_minutes) VALUES (0, ?, ?, ?)').run('08:00', '20:00', 30);
  }

  // Lookups
  const lookupSeed: Record<string, string[]> = {
    project_type: ['عکاسی کودک', 'عکاسی خانواده', 'عکاسی تولد', 'عکاسی بارداری', 'عکاسی سالگرد', 'فیلم‌برداری', 'عروسی', 'آلبوم'],
    expense_category: ['اجاره', 'برق', 'آب', 'اینترنت', 'حقوق', 'تجهیزات', 'تعمیرات', 'تبلیغات', 'حمل‌ونقل', 'خرید کالا', 'سایر'],
    payment_method: ['نقدی', 'کارتخوان', 'کارت به کارت', 'حواله', 'چک', 'سایر'],
    product_category: ['قاب و چاپ', 'آلبوم', 'پوشاک و لوازم', 'اکسسوری', 'مصرفی', 'سایر'],
    bank: ['صندوق', 'ملی', 'ملت', 'صادرات', 'پاسارگاد', 'سامان', 'سایر'],
  };
  const insLookup = db.prepare('INSERT OR IGNORE INTO lookups (kind, name, sort_order) VALUES (?, ?, ?)');
  for (const [kind, names] of Object.entries(lookupSeed)) {
    const cnt = (db.prepare('SELECT COUNT(*) AS c FROM lookups WHERE kind = ?').get(kind) as any).c;
    if (cnt === 0) names.forEach((n, i) => insLookup.run(kind, n, i + 1));
  }

  // Default tags
  const tagCount = (db.prepare('SELECT COUNT(*) AS c FROM tags').get() as any).c;
  if (tagCount === 0) {
    const insTag = db.prepare('INSERT INTO tags (name, color) VALUES (?, ?)');
    [
      ['VIP', '#f59e0b'], ['مشتری قدیمی', '#38bdf8'], ['مشتری جدید', '#34d399'], ['کودک', '#f472b6'],
      ['خانواده', '#a78bfa'], ['تولد', '#fb923c'], ['سالگرد', '#f87171'], ['پکیج ویژه', '#facc15'],
    ].forEach(([n, c]) => insTag.run(n, c));
  }

  // Roles aligned with spec
  const roleDefs = [
    { name: 'Super Admin', title: 'مدیر ارشد', desc: 'دسترسی کامل', perms: ['all'] },
    { name: 'Admin', title: 'مدیر', desc: 'مدیریت کامل آتلیه', perms: ['view', 'create', 'edit', 'delete', 'finance', 'reports', 'users', 'settings'] },
    { name: 'Accountant', title: 'حسابدار', desc: 'امور مالی و گزارش‌ها', perms: ['view', 'create', 'edit', 'finance', 'reports'] },
    { name: 'Operator', title: 'اپراتور', desc: 'ثبت مشتری، نوبت و پیگیری', perms: ['view', 'create', 'edit'] },
    { name: 'Photographer', title: 'عکاس', desc: 'مشاهده و به‌روزرسانی کارها', perms: ['view', 'edit'] },
    { name: 'Editor', title: 'ادیتور', desc: 'مدیریت آماده‌سازی عکس، فیلم و آلبوم', perms: ['view', 'edit'] },
  ];
  const upsertRole = db.prepare(`
    INSERT INTO roles (name, title, description, permissions_json) VALUES (?, ?, ?, ?)
    ON CONFLICT(name) DO UPDATE SET title = excluded.title, description = excluded.description, permissions_json = excluded.permissions_json
  `);
  for (const r of roleDefs) upsertRole.run(r.name, r.title, r.desc, JSON.stringify(r.perms));

  // Default settings
  const defaults: Record<string, string> = {
    online_payment_enabled: '1',
    sms_gateway_mode: 'mock',
  };
  const insSetting = db.prepare('INSERT OR IGNORE INTO studio_settings (key, value) VALUES (?, ?)');
  for (const [k, v] of Object.entries(defaults)) insSetting.run(k, v);
}
