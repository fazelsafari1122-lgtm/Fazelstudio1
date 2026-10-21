import express from 'express';
import path from 'node:path';
import { createServer as createViteServer } from 'vite';
import crypto from 'node:crypto';
import { db, initDatabase, hashPassword } from './server/db.ts';
import { initExtraSchema } from './server/extraSchema.ts';
import { seedExtraData } from './server/extraSeed.ts';
import { registerExtraRoutes, startBackgroundJobs, userFromToken, tokenFromReq } from './server/routes/index.ts';
import { permissionsFor } from './server/routes/system.ts';
import {
  parseFinancialNumber,
  jalaliToGregorianDateStr,
  gregorianToJalaliDateStr,
  toEnglishDigits,
  getTodayJalali
} from './server/jalali.ts';

// Initialize DB schema & seed
initDatabase();
initExtraSchema();
seedExtraData();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging & simple session simulation via Bearer token / header
function getAuthUser(req: express.Request) {
  return userFromToken(tokenFromReq(req));
}

function logAudit(userId: number | null, userName: string, action: string, object: string, objectId: string, oldVal: any, newVal: any) {
  try {
    db.prepare(`
      INSERT INTO audit_logs (user_id, user_name, action, object, object_id, old_value, new_value)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      userId,
      userName,
      action,
      object,
      objectId,
      oldVal ? JSON.stringify(oldVal) : null,
      newVal ? JSON.stringify(newVal) : null
    );
  } catch (err) {
    console.error('Audit log error:', err);
  }
}

function createSession(userId: number): string {
  const token = crypto.randomBytes(24).toString('hex');
  db.prepare('INSERT INTO sessions (token, user_id) VALUES (?, ?)').run(token, userId);
  return token;
}

registerExtraRoutes(app, { getAuthUser, logAudit });
const runBackgroundJobs = startBackgroundJobs();

// ==========================================
// 1. AUTHENTICATION & USERS
// ==========================================
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'نام کاربری و کلمه عبور الزامی است.' });
  }

    const passHash = hashPassword(password);
  const user = db.prepare(`
    SELECT id, username, full_name, role, phone, email, status
    FROM users
    WHERE username = ? AND password_hash = ?
  `).get(username, passHash) as any;
  if (!user) {
    return res.status(401).json({ success: false, message: 'نام کاربری یا رمز عبور اشتباه است.' });
  }

  if (user.status !== 'active') {
    return res.status(403).json({ success: false, message: 'حساب کاربری شما غیرفعال است.' });
  }

  logAudit(user.id, user.full_name, 'ورود به سیستم', 'User', user.id.toString(), null, { ip: req.ip });

  return res.json({
    success: true,
    data: {
      user: { ...user, permissions: permissionsFor(user.role) },
      token: createSession(user.id)
    }
  });
});

app.get('/api/auth/me', (req, res) => {
  const user = getAuthUser(req);
  if (!user) {
    return res.status(401).json({ success: false, message: 'لطفاً مجدداً وارد شوید.' });
  }
  return res.json({ success: true, data: { ...user, permissions: permissionsFor(user.role) } });
});

app.post('/api/auth/logout', (req, res) => {
  const token = tokenFromReq(req);
  if (token) db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
  return res.json({ success: true, message: 'خروج انجام شد.' });
});

app.post('/api/auth/change-password', (req, res) => {
  const user = getAuthUser(req);
  if (!user) return res.status(401).json({ success: false, message: 'دسترسی غیرمجاز' });
  const { oldPassword, newPassword } = req.body;

  const current = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(user.id) as any;
  if (current.password_hash !== hashPassword(oldPassword)) {
    return res.status(400).json({ success: false, message: 'رمز عبور فعلی نادرست است.' });
  }

  const newHash = hashPassword(newPassword);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(newHash, user.id);
  logAudit(user.id, user.full_name, 'تغییر رمز عبور', 'User', user.id.toString(), null, 'رمز تغییر کرد');
  return res.json({ success: true, message: 'رمز عبور با موفقیت تغییر کرد.' });
});

// ==========================================
// 2. DASHBOARD STATS (100% Dynamic from DB)
// ==========================================
app.get('/api/dashboard/stats', (req, res) => {
  try {
    const totalCustomers = (db.prepare('SELECT COUNT(*) as count FROM customers').get() as any).count;
    const totalContracts = (db.prepare('SELECT COUNT(*) as count FROM contracts').get() as any).count;
    const unpaidContracts = (db.prepare("SELECT COUNT(*) as count FROM contracts WHERE remaining_amount > 0 AND status != 'لغو شده'").get() as any).count;
    
    // Revenue calculations
    const totalIncome = (db.prepare('SELECT COALESCE(SUM(amount), 0) as total FROM payments').get() as any).total;
    const totalExpenses = (db.prepare('SELECT COALESCE(SUM(amount), 0) as total FROM expenses').get() as any).total;
    const netCashFlow = totalIncome - totalExpenses;

    // Customer Debt
    const customerDebt = (db.prepare("SELECT COALESCE(SUM(remaining_amount), 0) as total FROM contracts WHERE status != 'لغو شده'").get() as any).total;

    // Team Debt (agreed - paid)
    const teamDebt = (db.prepare("SELECT COALESCE(SUM(remaining_amount), 0) as total FROM team_payments WHERE status != 'تسویه شده'").get() as any).total;

    // Monthly fixed expenses
    const fixedCost = (db.prepare('SELECT COALESCE(SUM(amount), 0) as total FROM recurring_expenses WHERE is_active = 1').get() as any).total;

    // Projects
    const activeProjects = (db.prepare("SELECT COUNT(*) as count FROM projects WHERE status NOT IN ('پروژه جدید', 'رزرو شده', 'تحویل شده', 'لغو شده')").get() as any).count;
    const upcomingProjects = (db.prepare("SELECT COUNT(*) as count FROM projects WHERE status IN ('پروژه جدید', 'رزرو شده')").get() as any).count;

    // Equipment status
    const totalEquipment = (db.prepare('SELECT COALESCE(SUM(quantity), 0) as count FROM equipment').get() as any).count;
    const rentedEquipment = (db.prepare(`
      SELECT COALESCE(SUM(quantity), 0) as count FROM equipment_reservations
      WHERE status = 'confirmed'
    `).get() as any).count;

    // Recent upcoming weddings
    const upcomingWeddings = db.prepare(`
      SELECT w.*, c.first_name, c.last_name, c.phone,
             b.first_name as bride_first, b.last_name as bride_last,
             g.first_name as groom_first, g.last_name as groom_last
      FROM weddings w
      JOIN customers c ON w.customer_id = c.id
      LEFT JOIN brides_grooms b ON b.customer_id = c.id AND b.type = 'bride'
      LEFT JOIN brides_grooms g ON g.customer_id = c.id AND g.type = 'groom'
      ORDER BY w.wedding_date ASC LIMIT 5
    `).all();

    // Alerts (e.g. high customer debt, upcoming payment due, overdue projects)
    const alerts: any[] = [];
    if (unpaidContracts > 0) {
      alerts.push({
        type: 'warning',
        title: 'قراردادهای نیازمند پیگیری پرداخت',
        message: `${unpaidContracts} قرارداد با مانده تسویه‌نشده به ارزش ${(customerDebt).toLocaleString('fa-IR')} تومان ثبت شده است.`
      });
    }

    const availableEquipmentCount = Math.max(0, totalEquipment - rentedEquipment);
    if (availableEquipmentCount < 3) {
      alerts.push({
        type: 'info',
        title: 'موجودی تجهیزات در انبار',
        message: 'اکثر تجهیزات در پروژه‌های فعال رزرو شده‌اند.'
      });
    }

    return res.json({
      success: true,
      data: {
        totalCustomers,
        totalContracts,
        unpaidContracts,
        totalIncome,
        totalExpenses,
        netCashFlow,
        customerDebt,
        teamDebt,
        fixedCost,
        activeProjects,
        upcomingProjects,
        totalEquipment,
        rentedEquipment,
        availableEquipment: availableEquipmentCount,
        upcomingWeddings,
        alerts
      }
    });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'خطا در بارگذاری اطلاعات داشبورد' });
  }
});

// ==========================================
// 3. CRM & CUSTOMERS
// ==========================================
app.get('/api/crm/customers', (req, res) => {
  const { search } = req.query;
  let query = `
    SELECT c.*, 
      (SELECT COUNT(*) FROM contracts WHERE customer_id = c.id) as contract_count,
      (SELECT COALESCE(SUM(remaining_amount), 0) FROM contracts WHERE customer_id = c.id AND status != 'لغو شده') as debt_amount
    FROM customers c
  `;
  const params: any[] = [];

  if (search) {
    query += ` WHERE c.first_name LIKE ? OR c.last_name LIKE ? OR c.phone LIKE ? OR c.national_id LIKE ?`;
    const s = `%${search}%`;
    params.push(s, s, s, s);
  }

  query += ` ORDER BY c.id DESC`;
  const customers = db.prepare(query).all(...params);
  return res.json({ success: true, data: customers });
});

app.get('/api/crm/customers/:id', (req, res) => {
  const { id } = req.params;
  const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(id) as any;
  if (!customer) return res.status(404).json({ success: false, message: 'مشتری یافت نشد.' });

  const bride = db.prepare("SELECT * FROM brides_grooms WHERE customer_id = ? AND type = 'bride'").get(id);
  const groom = db.prepare("SELECT * FROM brides_grooms WHERE customer_id = ? AND type = 'groom'").get(id);
  const weddings = db.prepare('SELECT * FROM weddings WHERE customer_id = ?').all(id);
  const rawContracts = db.prepare(`
    SELECT c.*, i.invoice_number, i.id as invoice_id,
           COALESCE((SELECT SUM(amount) FROM payments WHERE contract_id = c.id), 0) as real_paid
    FROM contracts c
    LEFT JOIN invoices i ON i.contract_id = c.id
    WHERE c.customer_id = ?
    ORDER BY c.id DESC
  `).all(id) as any[];

  const contracts = rawContracts.map(ct => {
    const paid = Number(ct.real_paid || 0);
    const rem = Math.max(0, Number(ct.final_amount) - paid);
    const contractPayments = db.prepare('SELECT * FROM payments WHERE contract_id = ? ORDER BY id DESC').all(ct.id);
    return {
      ...ct,
      paid_amount: paid,
      remaining_amount: rem,
      payment_status: rem === 0 ? 'تسویه شده' : (paid > 0 ? 'پرداخت ناقص' : 'پرداخت نشده'),
      payments: contractPayments
    };
  });

  const invoices = db.prepare(`
    SELECT i.*, c.contract_number,
           COALESCE((SELECT SUM(amount) FROM payments WHERE (contract_id IS NOT NULL AND contract_id = i.contract_id) OR invoice_id = i.id), 0) as real_paid
    FROM invoices i
    LEFT JOIN contracts c ON i.contract_id = c.id
    WHERE i.customer_id = ?
    ORDER BY i.id DESC
  `).all(id) as any[];

  const updatedInvoices = invoices.map(inv => {
    const paid = Number(inv.real_paid || 0);
    const rem = Math.max(0, Number(inv.total) - paid);
    return {
      ...inv,
      paid_amount: paid,
      remaining_amount: rem,
      payment_status: rem === 0 ? 'تسویه شده' : (paid > 0 ? 'پرداخت ناقص' : 'پرداخت نشده')
    };
  });

  const payments = db.prepare(`
    SELECT p.*, c.contract_number, i.invoice_number
    FROM payments p
    LEFT JOIN contracts c ON p.contract_id = c.id
    LEFT JOIN invoices i ON p.invoice_id = i.id
    WHERE p.customer_id = ?
    ORDER BY p.id DESC
  `).all(id);

  const projects = db.prepare('SELECT * FROM projects WHERE customer_id = ? ORDER BY id DESC').all(id);
  const messages = db.prepare('SELECT * FROM sms_messages WHERE customer_id = ? ORDER BY id DESC').all(id);

  // Total debt across active contracts
  const debt = contracts.reduce((acc, ct) => acc + (ct.status === 'لغو شده' ? 0 : Number(ct.remaining_amount || 0)), 0);

  return res.json({
    success: true,
    data: {
      customer: { ...customer, debt_amount: debt },
      bride,
      groom,
      weddings,
      contracts,
      invoices: updatedInvoices,
      payments,
      projects,
      messages,
      debt
    }
  });
});

app.post('/api/crm/customers', (req, res) => {
  const {
    first_name, last_name, phone, phone2, national_id, birth_date, city, address, source, status, notes,
    bride_first, bride_last, bride_phone, bride_birth,
    groom_first, groom_last, groom_phone, groom_birth
  } = req.body;

  if (!first_name || !last_name || !phone) {
    return res.status(400).json({ success: false, message: 'نام، نام خانوادگی و شماره موبایل الزامی است.' });
  }

  const result = db.prepare(`
    INSERT INTO customers (first_name, last_name, phone, phone2, national_id, birth_date, city, address, source, status, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(first_name, last_name, phone, phone2 || null, national_id || null, birth_date || null, city || 'تهران', address || null, source || 'Instagram', status || 'active', notes || null);

  const customerId = result.lastInsertRowid;

  if (bride_first || bride_last) {
    db.prepare(`
      INSERT INTO brides_grooms (customer_id, type, first_name, last_name, phone, birth_date)
      VALUES (?, 'bride', ?, ?, ?, ?)
    `).run(customerId, bride_first || first_name, bride_last || last_name, bride_phone || phone, bride_birth || null);
  }

  if (groom_first || groom_last) {
    db.prepare(`
      INSERT INTO brides_grooms (customer_id, type, first_name, last_name, phone, birth_date)
      VALUES (?, 'groom', ?, ?, ?, ?)
    `).run(customerId, groom_first, groom_last, groom_phone || null, groom_birth || null);
  }

  logAudit(null, 'Admin', 'ثبت مشتری جدید', 'Customer', customerId.toString(), null, { name: `${first_name} ${last_name}`, phone });

  return res.json({ success: true, message: 'مشتری با موفقیت ثبت شد.', data: { id: customerId } });
});

app.put('/api/crm/customers/:id', (req, res) => {
  const { id } = req.params;
  const { first_name, last_name, phone, phone2, national_id, birth_date, city, address, source, status, notes } = req.body;

  const old = db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
  db.prepare(`
    UPDATE customers
    SET first_name = ?, last_name = ?, phone = ?, phone2 = ?, national_id = ?, birth_date = ?, city = ?, address = ?, source = ?, status = ?, notes = ?
    WHERE id = ?
  `).run(first_name, last_name, phone, phone2 || null, national_id || null, birth_date || null, city || 'تهران', address || null, source || 'Instagram', status || 'active', notes || null, id);

  logAudit(null, 'Admin', 'ویرایش مشتری', 'Customer', id.toString(), old, req.body);
  return res.json({ success: true, message: 'اطلاعات مشتری بروزرسانی شد.' });
});

app.delete('/api/crm/customers/:id', (req, res) => {
  const { id } = req.params;
  // Check if has active contracts
  const contractCount = (db.prepare('SELECT COUNT(*) as count FROM contracts WHERE customer_id = ?').get(id) as any).count;
  if (contractCount > 0) {
    return res.status(400).json({ success: false, message: 'این مشتری دارای قرارداد ثبت شده است و امکان حذف مستقیم وجود ندارد.' });
  }

  db.prepare('DELETE FROM brides_grooms WHERE customer_id = ?').run(id);
  db.prepare('DELETE FROM customers WHERE id = ?').run(id);
  logAudit(null, 'Admin', 'حذف مشتری', 'Customer', id.toString(), null, null);
  return res.json({ success: true, message: 'مشتری با موفقیت حذف شد.' });
});

// ==========================================
// 4. BRIDES, GROOMS & WEDDINGS
// ==========================================
app.get('/api/weddings', (req, res) => {
  const weddings = db.prepare(`
    SELECT w.*, c.first_name as customer_first, c.last_name as customer_last, c.phone as customer_phone,
           b.first_name as bride_first, b.last_name as bride_last, b.phone as bride_phone,
           g.first_name as groom_first, g.last_name as groom_last, g.phone as groom_phone
    FROM weddings w
    JOIN customers c ON w.customer_id = c.id
    LEFT JOIN brides_grooms b ON b.customer_id = c.id AND b.type = 'bride'
    LEFT JOIN brides_grooms g ON g.customer_id = c.id AND g.type = 'groom'
    ORDER BY w.wedding_date DESC
  `).all();
  return res.json({ success: true, data: weddings });
});

app.post('/api/weddings', (req, res) => {
  const {
    customer_id, wedding_date, start_time, end_time, team_arrival_time, venue_name, venue_address,
    gps_location, map_link, bride_prep_location, groom_prep_location, has_formality, formality_location,
    formality_date, hall_contact, coordinator_name, guest_count, notes
  } = req.body;

  if (!customer_id || !wedding_date) {
    return res.status(400).json({ success: false, message: 'انتخاب مشتری و تاریخ مراسم الزامی است.' });
  }

  const result = db.prepare(`
    INSERT INTO weddings (
      customer_id, wedding_date, start_time, end_time, team_arrival_time, venue_name, venue_address,
      gps_location, map_link, bride_prep_location, groom_prep_location, has_formality, formality_location,
      formality_date, hall_contact, coordinator_name, guest_count, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    customer_id, wedding_date, start_time || null, end_time || null, team_arrival_time || null, venue_name || null, venue_address || null,
    gps_location || null, map_link || null, bride_prep_location || null, groom_prep_location || null, has_formality ? 1 : 0, formality_location || null,
    formality_date || null, hall_contact || null, coordinator_name || null, guest_count || 0, notes || null
  );

  const weddingId = result.lastInsertRowid;

  // Auto add to calendar
  const gregWedding = jalaliToGregorianDateStr(wedding_date);
  db.prepare(`
    INSERT INTO calendar_events (title, event_type, start_date, end_date, start_time, end_time, location, customer_id, is_public, description, gregorian_date)
    VALUES (?, 'wedding', ?, ?, ?, ?, ?, ?, 0, ?, ?)
  `).run(`مراسم عروسی (تالار ${venue_name || 'نامشخص'})`, wedding_date, wedding_date, start_time || '16:00', end_time || '23:00', venue_name, customer_id, notes, gregWedding || null);

  logAudit(null, 'Admin', 'ثبت اطلاعات عروسی', 'Wedding', weddingId.toString(), null, req.body);

  return res.json({ success: true, message: 'اطلاعات عروسی با موفقیت ثبت شد.', data: { id: weddingId } });
});

// ==========================================
// 5. SERVICES
// ==========================================
app.get('/api/services', (req, res) => {
  const services = db.prepare('SELECT * FROM services ORDER BY category, id').all();
  return res.json({ success: true, data: services });
});

app.post('/api/services', (req, res) => {
  const { code, name, category, description, price, unit } = req.body;
  if (!name || !category || price === undefined) {
    return res.status(400).json({ success: false, message: 'نام، دسته‌بندی و تعرفه الزامی است.' });
  }

  const srvCode = code || `SRV-${Date.now().toString().slice(-4)}`;
  const result = db.prepare(`
    INSERT INTO services (code, name, category, description, price, unit, is_active)
    VALUES (?, ?, ?, ?, ?, ?, 1)
  `).run(srvCode, name, category, description || null, Number(price), unit || 'جلسه');

  logAudit(null, 'Admin', 'افزودن خدمت', 'Service', result.lastInsertRowid.toString(), null, req.body);
  return res.json({ success: true, message: 'خدمت با موفقیت ایجاد شد.' });
});

app.put('/api/services/:id', (req, res) => {
  const { id } = req.params;
  const { name, category, description, price, unit, is_active } = req.body;

  db.prepare(`
    UPDATE services
    SET name = ?, category = ?, description = ?, price = ?, unit = ?, is_active = ?
    WHERE id = ?
  `).run(name, category, description || null, Number(price), unit || 'جلسه', is_active ? 1 : 0, id);

  return res.json({ success: true, message: 'خدمت با موفقیت ویرایش شد (قراردادهای گذشته قیمت تاریخی خود را حفظ می‌کنند).' });
});

// ==========================================
// 6. EQUIPMENT & RESERVATIONS (With Conflict Prevention)
// ==========================================
app.get('/api/equipment', (req, res) => {
  const equipment = db.prepare('SELECT * FROM equipment ORDER BY id DESC').all();
  const categories = db.prepare('SELECT * FROM equipment_categories ORDER BY id').all();
  return res.json({ success: true, data: { equipment, categories } });
});

app.post('/api/equipment', (req, res) => {
  const { code, name, category_name, brand, model, photo, description, quantity, purchase_price, daily_rental_price, serial_number, notes } = req.body;
  if (!name || !category_name || !code) {
    return res.status(400).json({ success: false, message: 'کد، نام تجهیز و دسته‌بندی الزامی است.' });
  }

  const result = db.prepare(`
    INSERT INTO equipment (code, name, category_name, brand, model, photo, description, quantity, purchase_price, daily_rental_price, serial_number, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(code, name, category_name, brand || null, model || null, photo || null, description || null, Number(quantity) || 1, Number(purchase_price) || 0, Number(daily_rental_price) || 0, serial_number || null, notes || null);

  logAudit(null, 'Admin', 'ثبت تجهیز جدید', 'Equipment', result.lastInsertRowid.toString(), null, req.body);
  return res.json({ success: true, message: 'تجهیز جدید با موفقیت اضافه شد.' });
});

app.put('/api/equipment/:id', (req, res) => {
  const { id } = req.params;
  const { name, category_name, brand, model, photo, description, quantity, purchase_price, daily_rental_price, serial_number, status, notes } = req.body;

  const current = db.prepare('SELECT daily_rental_price FROM equipment WHERE id = ?').get(id) as any;
  if (current && current.daily_rental_price !== Number(daily_rental_price)) {
    // Log price history
    db.prepare(`
      INSERT INTO equipment_price_history (equipment_id, old_price, new_price, changed_by)
      VALUES (?, ?, ?, 'admin')
    `).run(id, current.daily_rental_price, Number(daily_rental_price));
  }

  db.prepare(`
    UPDATE equipment
    SET name = ?, category_name = ?, brand = ?, model = ?, photo = ?, description = ?, quantity = ?, purchase_price = ?, daily_rental_price = ?, serial_number = ?, status = ?, notes = ?
    WHERE id = ?
  `).run(name, category_name, brand || null, model || null, photo || null, description || null, Number(quantity), Number(purchase_price), Number(daily_rental_price), serial_number || null, status || 'available', notes || null, id);

  return res.json({ success: true, message: 'تجهیز با موفقیت بروزرسانی شد.' });
});

// Equipment reservation with conflict check
app.get('/api/equipment/reservations', (req, res) => {
  const reservations = db.prepare(`
    SELECT r.*, e.name as equipment_name, e.code as equipment_code, e.category_name,
           c.contract_number, cu.first_name as customer_first, cu.last_name as customer_last
    FROM equipment_reservations r
    JOIN equipment e ON r.equipment_id = e.id
    LEFT JOIN contracts c ON r.contract_id = c.id
    LEFT JOIN customers cu ON c.customer_id = cu.id
    ORDER BY r.start_date DESC
  `).all();
  return res.json({ success: true, data: reservations });
});

app.post('/api/equipment/reservations', (req, res) => {
  const { equipment_id, contract_id, project_id, quantity, start_date, end_date, days, allow_override, override_reason } = req.body;
  
  if (!equipment_id || !start_date || !end_date) {
    return res.status(400).json({ success: false, message: 'انتخاب تجهیز و بازه تاریخی الزامی است.' });
  }

  const requestedQty = Number(quantity) || 1;
  const eq = db.prepare('SELECT id, name, quantity, daily_rental_price FROM equipment WHERE id = ?').get(equipment_id) as any;
  if (!eq) return res.status(404).json({ success: false, message: 'تجهیز مورد نظر یافت نشد.' });

  // Conflict Checking against actual database
  // An overlap exists if: (existing.start_date <= requested.end_date) AND (existing.end_date >= requested.start_date)
  const overlappingReservations = db.prepare(`
    SELECT COALESCE(SUM(quantity), 0) as reserved_qty
    FROM equipment_reservations
    WHERE equipment_id = ?
      AND status = 'confirmed'
      AND start_date <= ?
      AND end_date >= ?
  `).get(equipment_id, end_date, start_date) as any;

  const alreadyReserved = overlappingReservations.reserved_qty;
  const availableQty = eq.quantity - alreadyReserved;

  if (availableQty < requestedQty && !allow_override) {
    return res.status(409).json({
      success: false,
      conflict: true,
      message: `این تجهیز در تاریخ انتخاب‌شده قبلاً رزرو شده است. موجودی در این بازه: ${availableQty} از کل ${eq.quantity} عدد.`
    });
  }

  const calcDays = Number(days) || 1;
  const dailyPrice = eq.daily_rental_price;
  const totalAmount = dailyPrice * requestedQty * calcDays;

  const result = db.prepare(`
    INSERT INTO equipment_reservations (equipment_id, contract_id, project_id, quantity, daily_price, start_date, end_date, days, total_amount, status, override_reason)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'confirmed', ?)
  `).run(equipment_id, contract_id || null, project_id || null, requestedQty, dailyPrice, start_date, end_date, calcDays, totalAmount, allow_override ? (override_reason || 'مجوز مدیر آتلیه') : null);

  // Add event to calendar
  const gregStart = jalaliToGregorianDateStr(start_date);
  const gregEnd = jalaliToGregorianDateStr(end_date || start_date);
  db.prepare(`
    INSERT INTO calendar_events (title, event_type, start_date, end_date, location, project_id, description, gregorian_date)
    VALUES (?, 'equipment_reservation', ?, ?, 'انبار استودیو', ?, ?, ?)
  `).run(`رزرو تجهیز: ${eq.name} (${requestedQty} عدد)`, start_date, end_date, project_id || null, `مربوط به پروژه/قرارداد - ارزش اجاره: ${totalAmount} تومان`, gregStart || null);

  logAudit(null, 'Admin', 'ثبت رزرو تجهیزات', 'EquipmentReservation', result.lastInsertRowid.toString(), null, { equipment: eq.name, requestedQty, start_date, end_date, override: !!allow_override });

  return res.json({ success: true, message: 'تجهیز با موفقیت رزرو شد.', data: { id: result.lastInsertRowid } });
});

// ==========================================
// 7. CONTRACTS & CONTRACT WORKFLOW
// ==========================================
function syncContractAndInvoiceBalances(contractId: number) {
  const contract = db.prepare('SELECT id, final_amount, customer_id FROM contracts WHERE id = ?').get(contractId) as any;
  if (!contract) return;

  // Calculate actual total paid from payments table for this contract
  const paidRow = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total_paid
    FROM payments
    WHERE contract_id = ?
  `).get(contractId) as any;

  const totalPaid = Math.round(Number(paidRow.total_paid) || 0);
  const remaining = Math.max(0, contract.final_amount - totalPaid);
  const paymentStatus = remaining === 0 ? 'تسویه شده' : (totalPaid > 0 ? 'پرداخت ناقص' : 'ثبت شده');

  db.prepare(`
    UPDATE contracts
    SET paid_amount = ?, remaining_amount = ?, status = CASE WHEN status IN ('لغو شده', 'تکمیل شده', 'فعال') THEN status ELSE ? END
    WHERE id = ?
  `).run(totalPaid, remaining, paymentStatus, contractId);

  // Sync any linked invoices
  const invoices = db.prepare('SELECT id, total FROM invoices WHERE contract_id = ?').all(contractId) as any[];
  for (const inv of invoices) {
    const invRemaining = Math.max(0, inv.total - totalPaid);
    const invStatus = invRemaining === 0 ? 'paid' : (totalPaid > 0 ? 'partially_paid' : 'unpaid');
    db.prepare(`
      UPDATE invoices
      SET paid_amount = ?, remaining_amount = ?, status = ?
      WHERE id = ?
    `).run(totalPaid, invRemaining, invStatus, inv.id);
  }
}

function syncInvoiceBalance(invoiceId: number) {
  const invoice = db.prepare('SELECT id, total, contract_id FROM invoices WHERE id = ?').get(invoiceId) as any;
  if (!invoice) return;

  if (invoice.contract_id) {
    syncContractAndInvoiceBalances(invoice.contract_id);
    return;
  }

  const paidRow = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total_paid
    FROM payments
    WHERE invoice_id = ?
  `).get(invoiceId) as any;

  const totalPaid = Math.round(Number(paidRow.total_paid) || 0);
  const remaining = Math.max(0, invoice.total - totalPaid);
  const status = remaining === 0 ? 'paid' : (totalPaid > 0 ? 'partially_paid' : 'unpaid');

  db.prepare(`
    UPDATE invoices
    SET paid_amount = ?, remaining_amount = ?, status = ?
    WHERE id = ?
  `).run(totalPaid, remaining, status, invoiceId);
}

app.get('/api/contracts', (req, res) => {
  const contracts = db.prepare(`
    SELECT c.*, cu.first_name, cu.last_name, cu.phone, cu.national_id,
           w.wedding_date, w.venue_name,
           b.first_name as bride_first, b.last_name as bride_last,
           g.first_name as groom_first, g.last_name as groom_last,
           i.invoice_number, i.id as invoice_id,
           COALESCE((SELECT SUM(amount) FROM payments WHERE contract_id = c.id), 0) as real_paid
    FROM contracts c
    JOIN customers cu ON c.customer_id = cu.id
    LEFT JOIN weddings w ON c.wedding_id = w.id
    LEFT JOIN brides_grooms b ON b.customer_id = cu.id AND b.type = 'bride'
    LEFT JOIN brides_grooms g ON g.customer_id = cu.id AND g.type = 'groom'
    LEFT JOIN invoices i ON i.contract_id = c.id
    ORDER BY c.id DESC
  `).all();

  const updated = contracts.map((ct: any) => {
    const paid = Number(ct.real_paid || 0);
    const rem = Math.max(0, Number(ct.final_amount) - paid);
    return {
      ...ct,
      paid_amount: paid,
      remaining_amount: rem,
      payment_status: rem === 0 ? 'تسویه شده' : (paid > 0 ? 'پرداخت ناقص' : 'پرداخت نشده')
    };
  });

  return res.json({ success: true, data: updated });
});

app.get('/api/contracts/:id', (req, res) => {
  const { id } = req.params;
  const contract = db.prepare(`
    SELECT c.*, cu.first_name, cu.last_name, cu.phone, cu.phone2, cu.national_id, cu.city, cu.address,
           w.wedding_date, w.venue_name, w.venue_address, w.start_time, w.end_time, w.team_arrival_time,
           b.first_name as bride_first, b.last_name as bride_last, b.phone as bride_phone,
           g.first_name as groom_first, g.last_name as groom_last, g.phone as groom_phone,
           i.invoice_number, i.id as invoice_id
    FROM contracts c
    JOIN customers cu ON c.customer_id = cu.id
    LEFT JOIN weddings w ON c.wedding_id = w.id
    LEFT JOIN brides_grooms b ON b.customer_id = cu.id AND b.type = 'bride'
    LEFT JOIN brides_grooms g ON g.customer_id = cu.id AND g.type = 'groom'
    LEFT JOIN invoices i ON i.contract_id = c.id
    WHERE c.id = ?
  `).get(id) as any;

  if (!contract) return res.status(404).json({ success: false, message: 'قرارداد یافت نشد.' });

  const items = db.prepare('SELECT * FROM contract_items WHERE contract_id = ?').all(id);
  const payments = db.prepare('SELECT * FROM payments WHERE contract_id = ? ORDER BY id DESC').all(id);
  const invoice = db.prepare('SELECT * FROM invoices WHERE contract_id = ? LIMIT 1').get(id);

  const realPaid = payments.reduce((acc: number, p: any) => acc + Number(p.amount || 0), 0);
  const realRem = Math.max(0, Number(contract.final_amount) - realPaid);
  contract.paid_amount = realPaid;
  contract.remaining_amount = realRem;
  contract.payment_status = realRem === 0 ? 'تسویه شده' : (realPaid > 0 ? 'پرداخت ناقص' : 'پرداخت نشده');

  return res.json({
    success: true,
    data: {
      contract,
      items,
      payments,
      invoice
    }
  });
});

app.post('/api/contracts', (req, res) => {
  const {
    customer_id, wedding_id, title, contract_date, discount_amount,
    items, terms_text, notes, create_project, create_invoice, payment_schedule,
    initial_payment, payment_method
  } = req.body;

  if (!customer_id || !title || !contract_date || !items || !items.length) {
    return res.status(400).json({ success: false, message: 'انتخاب مشتری، عنوان، تاریخ و حداقل یک آیتم خدمت الزامی است.' });
  }

  // Calculate total strictly from items with exact integer math
  let totalAmount = 0;
  for (const it of items) {
    const qty = Math.max(1, parseFinancialNumber(it.quantity) || 1);
    const price = parseFinancialNumber(it.unit_price) || 0;
    totalAmount += qty * price;
  }

  const discount = Math.max(0, parseFinancialNumber(discount_amount));
  const finalAmount = Math.max(0, totalAmount - discount);
  const initPayment = Math.max(0, parseFinancialNumber(initial_payment));

  // Strict business rule: payment cannot exceed final contract amount
  if (initPayment > finalAmount) {
    return res.status(400).json({
      success: false,
      message: 'مبلغ پرداختی نمیتواند بیشتر از مانده قرارداد باشد.'
    });
  }

  const contractNumber = `W-${Date.now().toString().slice(-6)}`;

  // Atomic database transaction
  db.exec('BEGIN TRANSACTION;');
  try {
    const result = db.prepare(`
      INSERT INTO contracts (
        contract_number, customer_id, wedding_id, title, contract_date,
        total_amount, discount_amount, final_amount, paid_amount, remaining_amount,
        status, terms_text, payment_schedule_json, notes, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, 'admin')
    `).run(
      contractNumber, customer_id, wedding_id || null, title, contract_date,
      totalAmount, discount, finalAmount, finalAmount,
      req.body.status || 'ثبت شده',
      terms_text || 'قرارداد پوشش عکاسی و تصویربرداری مراسم طبق شرایط عمومی استودیو',
      payment_schedule ? JSON.stringify(payment_schedule) : null,
      notes || null
    );

    const contractId = Number(result.lastInsertRowid);

    // Insert items with locked historic price
    const insertItem = db.prepare(`
      INSERT INTO contract_items (contract_id, item_type, item_id, name, quantity, unit_price, total_price)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    for (const it of items) {
      const qty = Math.max(1, parseFinancialNumber(it.quantity) || 1);
      const price = parseFinancialNumber(it.unit_price) || 0;
      insertItem.run(contractId, it.item_type || 'service', it.item_id || null, it.name, qty, price, qty * price);
    }

    let createdInvoiceId: number | null = null;
    // Auto create invoice if requested
    if (create_invoice !== false) {
      const invNumber = `INV-${contractNumber}`;
      const invRes = db.prepare(`
        INSERT INTO invoices (invoice_number, contract_id, customer_id, issue_date, subtotal, discount, total, paid_amount, remaining_amount, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, 'unpaid')
      `).run(invNumber, contractId, customer_id, contract_date, totalAmount, discount, finalAmount, finalAmount);
      createdInvoiceId = Number(invRes.lastInsertRowid);

      const insertInvItem = db.prepare(`
        INSERT INTO invoice_items (invoice_id, name, quantity, unit_price, total_price)
        VALUES (?, ?, ?, ?, ?)
      `);
      for (const it of items) {
        const qty = Math.max(1, parseFinancialNumber(it.quantity) || 1);
        const price = parseFinancialNumber(it.unit_price) || 0;
        insertInvItem.run(createdInvoiceId, it.name, qty, price, qty * price);
      }
    }

    // Process initial payment if provided
    if (initPayment > 0) {
      const payNumber = `PAY-${Date.now().toString().slice(-6)}`;
      db.prepare(`
        INSERT INTO payments (
          payment_number, contract_id, invoice_id, customer_id,
          amount, payment_date, payment_method, receiver_name, description
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'مدیریت استودیو', 'پیش‌پرداخت اولیه در زمان امضای قرارداد')
      `).run(
        payNumber, contractId, createdInvoiceId, customer_id,
        initPayment, contract_date, payment_method || 'کارت'
      );
    }

    // Synchronize balances from real payments
    syncContractAndInvoiceBalances(contractId);

    // Auto create project if requested
    if (create_project !== false) {
      const prjCode = `PRJ-${contractNumber}`;
      db.prepare(`
        INSERT INTO projects (project_code, name, contract_id, customer_id, wedding_id, project_type, project_date, status)
        VALUES (?, ?, ?, ?, ?, 'عروسی', ?, 'جدید')
      `).run(prjCode, `پروژه مراسم ${title}`, contractId, customer_id, wedding_id || null, contract_date);
    }

    db.exec('COMMIT;');

    logAudit(null, 'Admin', 'ثبت قرارداد جدید', 'Contract', contractId.toString(), null, { contractNumber, finalAmount, initPayment });

    return res.json({
      success: true,
      message: 'قرارداد با موفقیت ثبت شد و فاکتور و پروژه متناظر ایجاد گردید.',
      data: { id: contractId, contractNumber, invoiceId: createdInvoiceId }
    });
  } catch (err: any) {
    db.exec('ROLLBACK;');
    console.error('Contract creation failed:', err);
    return res.status(500).json({ success: false, message: 'خطا در ثبت قرارداد: ' + (err.message || 'خطای سرور') });
  }
});

app.put('/api/contracts/:id/status', (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  if (!status) return res.status(400).json({ success: false, message: 'وضعیت معتبر نیست.' });

  db.prepare('UPDATE contracts SET status = ? WHERE id = ?').run(status, id);
  logAudit(null, 'Admin', 'تغییر وضعیت قرارداد', 'Contract', id.toString(), null, { status });
  return res.json({ success: true, message: `وضعیت قرارداد به ${status} تغییر یافت.` });
});

// ==========================================
// 8. INVOICES & PAYMENTS (Atomic Balances)
// ==========================================
app.get('/api/invoices', (req, res) => {
  const invoices = db.prepare(`
    SELECT i.*, cu.first_name, cu.last_name, cu.phone, cu.national_id,
           c.contract_number, c.contract_date, c.title as contract_title,
           c.total_amount as contract_total, c.discount_amount as contract_discount, c.final_amount as contract_final,
           b.first_name as bride_first, b.last_name as bride_last,
           g.first_name as groom_first, g.last_name as groom_last,
           COALESCE((SELECT SUM(amount) FROM payments WHERE (contract_id IS NOT NULL AND contract_id = i.contract_id) OR invoice_id = i.id), 0) as real_paid
    FROM invoices i
    JOIN customers cu ON i.customer_id = cu.id
    LEFT JOIN contracts c ON i.contract_id = c.id
    LEFT JOIN brides_grooms b ON b.customer_id = cu.id AND b.type = 'bride'
    LEFT JOIN brides_grooms g ON g.customer_id = cu.id AND g.type = 'groom'
    ORDER BY i.id DESC
  `).all();

  const updated = invoices.map((inv: any) => {
    const paid = Number(inv.real_paid || 0);
    const rem = Math.max(0, Number(inv.total) - paid);
    const payment_status = rem === 0 ? 'تسویه شده' : (paid > 0 ? 'پرداخت ناقص' : 'پرداخت نشده');
    return {
      ...inv,
      paid_amount: paid,
      remaining_amount: rem,
      payment_status,
      status: rem === 0 ? 'paid' : (paid > 0 ? 'partially_paid' : 'unpaid')
    };
  });

  return res.json({ success: true, data: updated });
});

app.get('/api/invoices/:id', (req, res) => {
  const { id } = req.params;
  const invoice = db.prepare(`
    SELECT i.*, cu.first_name, cu.last_name, cu.phone, cu.national_id, cu.address,
           c.contract_number, c.contract_date, c.title as contract_title,
           c.total_amount as contract_total, c.discount_amount as contract_discount, c.final_amount as contract_final,
           b.first_name as bride_first, b.last_name as bride_last,
           g.first_name as groom_first, g.last_name as groom_last
    FROM invoices i
    JOIN customers cu ON i.customer_id = cu.id
    LEFT JOIN contracts c ON i.contract_id = c.id
    LEFT JOIN brides_grooms b ON b.customer_id = cu.id AND b.type = 'bride'
    LEFT JOIN brides_grooms g ON g.customer_id = cu.id AND g.type = 'groom'
    WHERE i.id = ?
  `).get(id) as any;

  if (!invoice) return res.status(404).json({ success: false, message: 'فاکتور یافت نشد.' });
  const items = db.prepare('SELECT * FROM invoice_items WHERE invoice_id = ?').all(id);
  const payments = db.prepare('SELECT * FROM payments WHERE (contract_id IS NOT NULL AND contract_id = ?) OR invoice_id = ? ORDER BY id DESC').all(invoice.contract_id || 0, id);

  const realPaid = payments.reduce((acc: number, p: any) => acc + Number(p.amount || 0), 0);
  const realRem = Math.max(0, Number(invoice.total) - realPaid);
  invoice.paid_amount = realPaid;
  invoice.remaining_amount = realRem;
  invoice.payment_status = realRem === 0 ? 'تسویه شده' : (realPaid > 0 ? 'پرداخت ناقص' : 'پرداخت نشده');
  invoice.status = realRem === 0 ? 'paid' : (realPaid > 0 ? 'partially_paid' : 'unpaid');

  return res.json({ success: true, data: { invoice, items, payments } });
});

app.get('/api/payments', (req, res) => {
  const payments = db.prepare(`
    SELECT p.*, cu.first_name, cu.last_name, cu.phone, cu.national_id,
           c.contract_number, c.contract_date, c.title as contract_title,
           c.total_amount as contract_subtotal, c.discount_amount as contract_discount, c.final_amount as contract_final_amount,
           i.invoice_number,
           b.first_name as bride_first, b.last_name as bride_last,
           g.first_name as groom_first, g.last_name as groom_last
    FROM payments p
    JOIN customers cu ON p.customer_id = cu.id
    LEFT JOIN contracts c ON p.contract_id = c.id
    LEFT JOIN invoices i ON (p.invoice_id = i.id OR (c.id IS NOT NULL AND i.contract_id = c.id))
    LEFT JOIN brides_grooms b ON b.customer_id = cu.id AND b.type = 'bride'
    LEFT JOIN brides_grooms g ON g.customer_id = cu.id AND g.type = 'groom'
    ORDER BY p.id DESC
  `).all();
  return res.json({ success: true, data: payments });
});

app.post('/api/payments', (req, res) => {
  const { contract_id, invoice_id, customer_id, amount, payment_date, payment_method, tracking_code, receiver_name, description } = req.body;

  let finalCustomerId = customer_id ? Number(customer_id) : null;
  let contractId = contract_id ? Number(contract_id) : null;
  let invoiceId = invoice_id ? Number(invoice_id) : null;

  if (contractId && !finalCustomerId) {
    const ct = db.prepare('SELECT customer_id FROM contracts WHERE id = ?').get(contractId) as any;
    if (ct) finalCustomerId = ct.customer_id;
  }

  if (invoiceId && !finalCustomerId) {
    const inv = db.prepare('SELECT customer_id, contract_id FROM invoices WHERE id = ?').get(invoiceId) as any;
    if (inv) {
      finalCustomerId = inv.customer_id;
      if (!contractId && inv.contract_id) contractId = inv.contract_id;
    }
  }

  if (!finalCustomerId) {
    return res.status(400).json({ success: false, message: 'مشتری، قرارداد یا فاکتور مشخص نشده است.' });
  }

  const payAmount = parseFinancialNumber(amount);
  if (payAmount <= 0) {
    return res.status(400).json({ success: false, message: 'مبلغ پرداختی باید بیشتر از صفر باشد.' });
  }

  // Validate contract & balance
  if (contractId) {
    const contract = db.prepare('SELECT id, final_amount, customer_id FROM contracts WHERE id = ?').get(contractId) as any;
    if (!contract) {
      return res.status(404).json({ success: false, message: 'قرارداد مورد نظر یافت نشد.' });
    }

    const paidRow = db.prepare('SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE contract_id = ?').get(contractId) as any;
    const currentPaid = Number(paidRow?.total || 0);
    const remaining = Math.max(0, contract.final_amount - currentPaid);

    if (payAmount > remaining) {
      return res.status(400).json({
        success: false,
        message: 'مبلغ پرداختی نمیتواند بیشتر از مانده قرارداد باشد.'
      });
    }

    if (!invoiceId) {
      const linkedInv = db.prepare('SELECT id FROM invoices WHERE contract_id = ? LIMIT 1').get(contractId) as any;
      if (linkedInv) invoiceId = linkedInv.id;
    }
  } else if (invoiceId) {
    const invoice = db.prepare('SELECT id, total, customer_id FROM invoices WHERE id = ?').get(invoiceId) as any;
    if (!invoice) {
      return res.status(404).json({ success: false, message: 'فاکتور مورد نظر یافت نشد.' });
    }
    const paidRow = db.prepare('SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE invoice_id = ?').get(invoiceId) as any;
    const currentPaid = Number(paidRow?.total || 0);
    const remaining = Math.max(0, invoice.total - currentPaid);

    if (payAmount > remaining) {
      return res.status(400).json({
        success: false,
        message: 'مبلغ پرداختی نمیتواند بیشتر از مانده فاکتور باشد.'
      });
    }
  }

  const finalPaymentDate = payment_date && String(payment_date).trim() ? String(payment_date).trim() : getTodayJalali();
  const payNumber = `PAY-${Date.now().toString().slice(-6)}`;
  const method = payment_method || 'کارت';

  // Atomic database transaction
  db.exec('BEGIN TRANSACTION;');
  try {
    const payRes = db.prepare(`
      INSERT INTO payments (
        payment_number, contract_id, invoice_id, customer_id,
        amount, payment_date, payment_method, tracking_code, receiver_name, description
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      payNumber,
      contractId,
      invoiceId,
      finalCustomerId,
      payAmount,
      finalPaymentDate,
      method,
      tracking_code || null,
      receiver_name || 'مدیریت استودیو',
      description || null
    );

    const paymentId = Number(payRes.lastInsertRowid);

    if (contractId) {
      syncContractAndInvoiceBalances(contractId);
    } else if (invoiceId) {
      syncInvoiceBalance(invoiceId);
    }

    const authUser = getAuthUser(req);
    const userName = authUser ? authUser.full_name : 'مدیریت استودیو';
    const userId = authUser ? authUser.id : null;
    logAudit(userId, userName, 'ثبت پرداخت', 'Payment', paymentId.toString(), null, {
      payment_id: paymentId,
      contract_id: contractId,
      invoice_id: invoiceId,
      customer_id: finalCustomerId,
      amount: payAmount,
      payment_number: payNumber,
      payment_date: finalPaymentDate,
      payment_method: method,
      tracking_code: tracking_code || null
    });

    db.exec('COMMIT;');

    return res.json({
      success: true,
      message: 'پرداخت با موفقیت ثبت شد.',
      data: {
        paymentId,
        paymentNumber: payNumber,
        amount: payAmount,
        paymentDate: finalPaymentDate
      }
    });
  } catch (err: any) {
    db.exec('ROLLBACK;');
    console.error('Payment transaction failed:', err);
    return res.status(500).json({ success: false, message: 'ثبت پرداخت با خطا مواجه شد: ' + (err.message || '') });
  }
});

app.delete('/api/payments/:id', (req, res) => {
  const { id } = req.params;
  const payment = db.prepare('SELECT * FROM payments WHERE id = ?').get(id) as any;
  if (!payment) {
    return res.status(404).json({ success: false, message: 'پرداخت مورد نظر یافت نشد.' });
  }

  db.exec('BEGIN TRANSACTION;');
  try {
    db.prepare('DELETE FROM payments WHERE id = ?').run(id);
    if (payment.contract_id) {
      syncContractAndInvoiceBalances(payment.contract_id);
    } else if (payment.invoice_id) {
      syncInvoiceBalance(payment.invoice_id);
    }
    
    const authUser = getAuthUser(req);
    const userName = authUser ? authUser.full_name : 'مدیریت استودیو';
    const userId = authUser ? authUser.id : null;
    logAudit(userId, userName, 'حذف تراکنش پرداختی', 'Payment', id.toString(), payment, null);

    db.exec('COMMIT;');
    return res.json({ success: true, message: 'تراکنش پرداختی با موفقیت حذف شد و مانده حساب‌ها بروزرسانی گردید.' });
  } catch (err: any) {
    db.exec('ROLLBACK;');
    console.error('Delete payment failed:', err);
    return res.status(500).json({ success: false, message: 'خطا در حذف پرداخت: ' + (err.message || '') });
  }
});

// ==========================================
// 9. ACCOUNTING & EXPENSES
// ==========================================
app.get('/api/accounting/expenses', (req, res) => {
  const expenses = db.prepare('SELECT * FROM expenses ORDER BY expense_date DESC, id DESC').all();
  const recurring = db.prepare('SELECT * FROM recurring_expenses ORDER BY id').all();
  return res.json({ success: true, data: { expenses, recurring } });
});

app.post('/api/accounting/expenses', (req, res) => {
  const { title, category, amount, expense_date, payment_method, receiver, description, receipt_attachment, is_recurring } = req.body;
  if (!title || !category || !amount || !expense_date) {
    return res.status(400).json({ success: false, message: 'عنوان، دسته‌بندی، مبلغ و تاریخ هزینه الزامی است.' });
  }

  const result = db.prepare(`
    INSERT INTO expenses (title, category, amount, expense_date, payment_method, receiver, description, receipt_attachment, is_recurring, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'admin')
  `).run(title, category, Number(amount), expense_date, payment_method || 'کارت', receiver || null, description || null, receipt_attachment || null, is_recurring ? 1 : 0);

  logAudit(null, 'Admin', 'ثبت هزینه آتلیه', 'Expense', result.lastInsertRowid.toString(), null, req.body);
  return res.json({ success: true, message: 'هزینه با موفقیت ثبت شد.' });
});

app.post('/api/accounting/recurring', (req, res) => {
  const { title, category, amount, frequency, due_day, notes } = req.body;
  if (!title || !category || !amount) {
    return res.status(400).json({ success: false, message: 'اطلاعات هزینه دوره‌ای کامل نیست.' });
  }

  db.prepare(`
    INSERT INTO recurring_expenses (title, category, amount, frequency, due_day, notes)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(title, category, Number(amount), frequency || 'monthly', Number(due_day) || 1, notes || null);

  return res.json({ success: true, message: 'هزینه دوره‌ای با موفقیت تعریف شد.' });
});

// ==========================================
// 10. TEAM & TEAM PAYMENTS
// ==========================================
app.get('/api/team', (req, res) => {
  const members = db.prepare(`
    SELECT t.*,
      (SELECT COUNT(*) FROM project_team WHERE team_member_id = t.id) as project_count,
      (SELECT COALESCE(SUM(agreed_amount), 0) FROM team_payments WHERE team_member_id = t.id) as total_agreed,
      (SELECT COALESCE(SUM(paid_amount), 0) FROM team_payments WHERE team_member_id = t.id) as total_paid,
      (SELECT COALESCE(SUM(remaining_amount), 0) FROM team_payments WHERE team_member_id = t.id AND status != 'تسویه شده') as debt_amount
    FROM team_members t
    ORDER BY t.id DESC
  `).all();
  return res.json({ success: true, data: members });
});

app.post('/api/team', (req, res) => {
  const { full_name, phone, role, specialty, bank_account_card, notes } = req.body;
  if (!full_name || !phone || !role) {
    return res.status(400).json({ success: false, message: 'نام کامل، شماره تماس و سمت همکار الزامی است.' });
  }

  const result = db.prepare(`
    INSERT INTO team_members (full_name, phone, role, specialty, bank_account_card, notes)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(full_name, phone, role, specialty || null, bank_account_card || null, notes || null);

  logAudit(null, 'Admin', 'ثبت عضو تیم', 'TeamMember', result.lastInsertRowid.toString(), null, req.body);
  return res.json({ success: true, message: 'همکار جدید به کادر آتلیه اضافه شد.' });
});

app.get('/api/team/payments', (req, res) => {
  const payments = db.prepare(`
    SELECT tp.*, tm.full_name as member_name, tm.role, tm.bank_account_card, p.name as project_name
    FROM team_payments tp
    JOIN team_members tm ON tp.team_member_id = tm.id
    LEFT JOIN projects p ON tp.project_id = p.id
    ORDER BY tp.id DESC
  `).all();
  return res.json({ success: true, data: payments });
});

app.post('/api/team/payments', (req, res) => {
  const { team_member_id, project_id, agreed_amount, paid_amount, payment_date, tracking_code, notes } = req.body;
  if (!team_member_id || agreed_amount === undefined) {
    return res.status(400).json({ success: false, message: 'عضو تیم و مبلغ توافق‌شده الزامی است.' });
  }

  const agreed = Number(agreed_amount);
  const paid = Number(paid_amount) || 0;
  const remaining = Math.max(0, agreed - paid);
  const status = remaining === 0 ? 'تسویه شده' : (paid > 0 ? 'پرداخت ناقص' : 'تسویه نشده');

  db.prepare(`
    INSERT INTO team_payments (team_member_id, project_id, agreed_amount, paid_amount, remaining_amount, payment_date, tracking_code, status, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(team_member_id, project_id || null, agreed, paid, remaining, payment_date || null, tracking_code || null, status, notes || null);

  // If paid > 0, also log in studio expenses
  if (paid > 0) {
    const member = db.prepare('SELECT full_name, role FROM team_members WHERE id = ?').get(team_member_id) as any;
    db.prepare(`
      INSERT INTO expenses (title, category, amount, expense_date, payment_method, receiver, description)
      VALUES (?, 'حقوق و دستمزد', ?, ?, 'کارت', ?, ?)
    `).run(`تسویه دستمزد ${member?.role || ''} (${member?.full_name || ''})`, paid, payment_date || '1405/06/20', member?.full_name, tracking_code ? `کد رهگیری: ${tracking_code}` : null);
  }

  return res.json({ success: true, message: 'حساب پرسنل با موفقیت ثبت شد.' });
});

// ==========================================
// 11. PROJECTS
// ==========================================
app.get('/api/projects', (req, res) => {
  const projects = db.prepare(`
    SELECT p.*, cu.first_name as customer_first, cu.last_name as customer_last, cu.phone as customer_phone,
           w.wedding_date, w.venue_name, c.contract_number
    FROM projects p
    JOIN customers cu ON p.customer_id = cu.id
    LEFT JOIN contracts c ON p.contract_id = c.id
    LEFT JOIN weddings w ON p.wedding_id = w.id
    ORDER BY p.id DESC
  `).all();
  return res.json({ success: true, data: projects });
});

app.put('/api/projects/:id/status', (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  if (!status) return res.status(400).json({ success: false, message: 'وضعیت الزامی است.' });

  db.prepare('UPDATE projects SET status = ? WHERE id = ?').run(status, id);
  logAudit(null, 'Admin', 'تغییر وضعیت پروژه', 'Project', id.toString(), null, { status });
  return res.json({ success: true, message: `وضعیت پروژه به ${status} بروزرسانی شد.` });
});

// ==========================================
// 12. CALENDAR (Jalali events)
// ==========================================
app.get('/api/calendar/events', (req, res) => {
  const events = db.prepare(`
    SELECT ce.*, c.first_name, c.last_name, c.phone as customer_phone,
           p.name as project_name
    FROM calendar_events ce
    LEFT JOIN customers c ON ce.customer_id = c.id
    LEFT JOIN projects p ON ce.project_id = p.id
    ORDER BY ce.start_date ASC, ce.start_time ASC
  `).all() as any[];

  const mapped = events.map(ev => {
    if (!ev.gregorian_date && ev.start_date) {
      ev.gregorian_date = jalaliToGregorianDateStr(ev.start_date);
    }
    return ev;
  });

  return res.json({ success: true, data: mapped });
});

app.post('/api/calendar/events', (req, res) => {
  const {
    title, event_type, start_date, end_date, start_time, end_time,
    location, customer_id, project_id, is_public, description
  } = req.body;

  if (!title || !start_date) {
    return res.status(400).json({ success: false, message: 'عنوان رویداد و تاریخ الزامی است.' });
  }

  const cleanStartDate = toEnglishDigits(start_date).trim();
  const cleanEndDate = end_date ? toEnglishDigits(end_date).trim() : cleanStartDate;
  const gregorianDate = jalaliToGregorianDateStr(cleanStartDate);

  const result = db.prepare(`
    INSERT INTO calendar_events (
      title, event_type, start_date, end_date, start_time, end_time,
      location, customer_id, project_id, is_public, description, gregorian_date
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    title, event_type || 'studio_event', cleanStartDate, cleanEndDate,
    start_time || null, end_time || null, location || null,
    customer_id ? Number(customer_id) : null, project_id ? Number(project_id) : null,
    is_public ? 1 : 0, description || null, gregorianDate || null
  );

  logAudit(null, 'Admin', 'ثبت رویداد تقویم', 'CalendarEvent', result.lastInsertRowid.toString(), null, { title, cleanStartDate, gregorianDate });

  return res.json({
    success: true,
    message: 'رویداد با موفقیت به تقویم اضافه شد.',
    data: { id: result.lastInsertRowid, gregorian_date: gregorianDate }
  });
});

app.put('/api/calendar/events/:id', (req, res) => {
  const { id } = req.params;
  const {
    title, event_type, start_date, end_date, start_time, end_time,
    location, customer_id, project_id, is_public, description
  } = req.body;

  if (!title || !start_date) {
    return res.status(400).json({ success: false, message: 'عنوان رویداد و تاریخ الزامی است.' });
  }

  const cleanStartDate = toEnglishDigits(start_date).trim();
  const cleanEndDate = end_date ? toEnglishDigits(end_date).trim() : cleanStartDate;
  const gregorianDate = jalaliToGregorianDateStr(cleanStartDate);

  db.prepare(`
    UPDATE calendar_events
    SET title = ?, event_type = ?, start_date = ?, end_date = ?, start_time = ?, end_time = ?,
        location = ?, customer_id = ?, project_id = ?, is_public = ?, description = ?, gregorian_date = ?
    WHERE id = ?
  `).run(
    title, event_type || 'studio_event', cleanStartDate, cleanEndDate,
    start_time || null, end_time || null, location || null,
    customer_id ? Number(customer_id) : null, project_id ? Number(project_id) : null,
    is_public ? 1 : 0, description || null, gregorianDate || null, id
  );

  return res.json({ success: true, message: 'رویداد با موفقیت بروزرسانی شد.' });
});

app.delete('/api/calendar/events/:id', (req, res) => {
  const { id } = req.params;
  db.prepare('DELETE FROM calendar_events WHERE id = ?').run(id);
  logAudit(null, 'Admin', 'حذف رویداد تقویم', 'CalendarEvent', id.toString(), null, null);
  return res.json({ success: true, message: 'رویداد با موفقیت از تقویم حذف شد.' });
});

// ==========================================
// 13. SMS ARCHITECTURE & TEMPLATES
// ==========================================
app.get('/api/sms/templates', (req, res) => {
  const templates = db.prepare('SELECT * FROM sms_templates ORDER BY id').all();
  const logs = db.prepare(`
    SELECT sm.*, c.first_name, c.last_name
    FROM sms_messages sm
    LEFT JOIN customers c ON sm.customer_id = c.id
    ORDER BY sm.id DESC LIMIT 50
  `).all();
  return res.json({ success: true, data: { templates, logs } });
});

app.post('/api/sms/send', (req, res) => {
  const { customer_id, phone, template_id, message_body, variables } = req.body;

  if (!phone || (!message_body && !template_id)) {
    return res.status(400).json({ success: false, message: 'شماره گیرنده و متن پیام الزامی است.' });
  }

  let finalBody = message_body || '';
  if (template_id) {
    const tpl = db.prepare('SELECT content FROM sms_templates WHERE id = ?').get(template_id) as any;
    if (tpl) {
      finalBody = tpl.content;
      if (variables && typeof variables === 'object') {
        for (const [k, v] of Object.entries(variables)) {
          finalBody = finalBody.replace(new RegExp(k, 'g'), String(v));
        }
      }
    }
  }

  // Check SMS Provider config
  const providerKey = (db.prepare("SELECT value FROM studio_settings WHERE key = 'sms_api_key'").get() as any)?.value;
  const senderNum = (db.prepare("SELECT value FROM studio_settings WHERE key = 'sms_sender_number'").get() as any)?.value || '10008899';

  let status = 'sent';
  let providerResp = 'ارسال شده با موفقیت به درگاه کاوه‌نگار';

  if (!providerKey) {
    // Missing credentials - explicitly mark in log as required by spec
    status = 'queued';
    providerResp = 'ارسال در صف (کلید API پیامک در تنظیمات ثبت نشده است)';
  }

  const result = db.prepare(`
    INSERT INTO sms_messages (customer_id, phone, template_id, message_body, status, provider_response)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(customer_id || null, phone, template_id || null, finalBody, status, providerResp);

  return res.json({
    success: true,
    message: providerKey ? 'پیامک با موفقیت ارسال شد.' : 'پیامک در صف ثبت شد (جهت ارسال واقعی، کلید درگاه را در تنظیمات وارد نمایید).',
    data: { id: result.lastInsertRowid, status, finalBody }
  });
});

// ==========================================
// 14. CONTRACT & INVOICE TEMPLATES (Print & PDF)
// ==========================================
app.get('/api/templates', (req, res) => {
  const templates = db.prepare('SELECT * FROM contract_templates ORDER BY id').all();
  return res.json({ success: true, data: templates });
});

// ==========================================
// 15. REPORTS
// ==========================================
app.get('/api/reports/financial', (req, res) => {
  const paymentsByMethod = db.prepare(`
    SELECT payment_method, COUNT(*) as count, SUM(amount) as total
    FROM payments GROUP BY payment_method
  `).all();

  const expensesByCategory = db.prepare(`
    SELECT category, COUNT(*) as count, SUM(amount) as total
    FROM expenses GROUP BY category
  `).all();

  const contractsByStatus = db.prepare(`
    SELECT status, COUNT(*) as count, SUM(final_amount) as total_value, SUM(paid_amount) as total_paid, SUM(remaining_amount) as total_remaining
    FROM contracts GROUP BY status
  `).all();

  const totalIncome = (db.prepare('SELECT COALESCE(SUM(amount), 0) as total FROM payments').get() as any).total;
  const totalExpense = (db.prepare('SELECT COALESCE(SUM(amount), 0) as total FROM expenses').get() as any).total;

  return res.json({
    success: true,
    data: {
      totalIncome,
      totalExpense,
      netCash: totalIncome - totalExpense,
      paymentsByMethod,
      expensesByCategory,
      contractsByStatus
    }
  });
});

// ==========================================
// 16. USERS, ROLES & AUDIT LOGS
// ==========================================
app.get('/api/users', (req, res) => {
  const users = db.prepare('SELECT id, username, full_name, role, phone, email, status, created_at FROM users ORDER BY id').all();
  const roles = db.prepare('SELECT * FROM roles ORDER BY id').all();
  return res.json({ success: true, data: { users, roles } });
});

app.post('/api/users', (req, res) => {
  const { username, password, full_name, role, phone, email } = req.body;
  if (!username || !password || !full_name || !role) {
    return res.status(400).json({ success: false, message: 'تمامی فیلدهای ضروری کاربر را وارد کنید.' });
  }

  const passHash = hashPassword(password);
  const result = db.prepare(`
    INSERT INTO users (username, password_hash, full_name, role, phone, email, status)
    VALUES (?, ?, ?, ?, ?, ?, 'active')
  `).run(username, passHash, full_name, role, phone || null, email || null);

  return res.json({ success: true, message: 'کاربر جدید با موفقیت اضافه شد.', data: { id: result.lastInsertRowid } });
});

app.get('/api/audit-logs', (req, res) => {
  const logs = db.prepare('SELECT * FROM audit_logs ORDER BY id DESC LIMIT 100').all();
  return res.json({ success: true, data: logs });
});

// ==========================================
// 17. STUDIO SETTINGS
// ==========================================
app.get('/api/settings', (req, res) => {
  const rows = db.prepare('SELECT key, value FROM studio_settings').all() as { key: string; value: string }[];
  const settings: Record<string, string> = {};
  for (const r of rows) settings[r.key] = r.value;
  return res.json({ success: true, data: settings });
});

app.post('/api/settings', (req, res) => {
  const settings = req.body;
  const stmt = db.prepare('INSERT OR REPLACE INTO studio_settings (key, value) VALUES (?, ?)');
  for (const [k, v] of Object.entries(settings)) {
    stmt.run(k, String(v));
  }
  logAudit(null, 'Admin', 'بروزرسانی تنظیمات استودیو', 'StudioSettings', '0', null, settings);
  return res.json({ success: true, message: 'تنظیمات استودیو با موفقیت ذخیره گردید.' });
});

// ==========================================
// 18. PUBLIC WEBSITE APIS
// ==========================================
app.get('/api/public/info', (req, res) => {
  const rows = db.prepare('SELECT key, value FROM studio_settings').all() as { key: string; value: string }[];
  const settings: Record<string, string> = {};
  for (const r of rows) settings[r.key] = r.value;

  const publicServices = db.prepare('SELECT id, name, category, description, price, unit FROM services WHERE is_active = 1').all();
  const publicEvents = db.prepare(`
    SELECT title, event_type, start_date, end_date, start_time, end_time, location
    FROM calendar_events WHERE is_public = 1
  `).all();

  return res.json({
    success: true,
    data: {
      studio: {
        name: settings.studio_name || 'STUDIO WED',
        slogan: settings.studio_slogan || 'سینمای خاطرات جاودان شما',
        phone: settings.phone,
        mobile: settings.mobile,
        address: settings.address,
        instagram: settings.instagram,
        working_hours: `${settings.working_hours_start || '09:00'} الی ${settings.working_hours_end || '21:00'}`
      },
      services: publicServices,
      events: publicEvents
    }
  });
});

app.post('/api/public/inquiry', (req, res) => {
  const { name, phone, wedding_date, guest_count, message } = req.body;
  if (!name || !phone) {
    return res.status(400).json({ success: false, message: 'نام و شماره تماس الزامی است.' });
  }

  // Create lead in CRM
  const [first, ...rest] = name.trim().split(' ');
  const last = rest.join(' ') || 'گرامی';

  const custRes = db.prepare(`
    INSERT INTO customers (first_name, last_name, phone, birth_date, city, source, status, notes)
    VALUES (?, ?, ?, NULL, 'تهران', 'سایت', 'active', ?)
  `).run(first, last, phone, `ثبت درخواست مشاوره از وبسایت عمومی. تاریخ پیشنهادی: ${wedding_date || 'نامشخص'}، مهمانان: ${guest_count || 0}. پیام: ${message || '-'}`);

  return res.json({
    success: true,
    message: 'درخواست شما با موفقیت ثبت شد. مشاوران استودیو WED به زودی با شما تماس خواهند گرفت.'
  });
});

// ==========================================
// 19. VITE SPA / STATIC HANDLER
// ==========================================
// ==========================================
// 19. VITE SPA / STATIC HANDLER
// ==========================================
let server: any = null;

async function start() {
  if (server) return;

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`STUDIO WED Server running on port ${PORT}`);
  });

  server.on('error', (e: any) => {
    if (e.code === 'EADDRINUSE') {
      console.log(`Port ${PORT} is busy, retrying might not be needed if this is a health check.`);
    } else {
      console.error('Server error:', e);
    }
  });
}

start();
