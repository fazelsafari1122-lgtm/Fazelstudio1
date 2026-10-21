import { db } from './db.ts';
import { getTodayJalali } from './jalali.ts';
import { insertPayment } from './finance.ts';
import { PREP_STAGES, STAGE_FOR_PREP } from './extraSchema.ts';
import { addDaysJalali, jalaliParts, toMinutes, fromMinutes } from './routes/util.ts';
import { findConflict, findHoliday } from './routes/scheduling.ts';

const FATHERS = ['علی', 'محمد', 'حسین', 'رضا', 'امیر', 'مهدی', 'سعید', 'بهرام', 'کامران', 'پیمان', 'آرش', 'فرهاد', 'نیما', 'سهراب', 'مجید', 'وحید', 'کیوان', 'بابک', 'شهرام', 'داریوش'];
const MOTHERS = ['زهرا', 'مریم', 'فاطمه', 'سارا', 'نرگس', 'لیلا', 'مینا', 'شیما', 'الهام', 'نسترن', 'پریسا', 'سمیرا', 'ندا', 'آزاده', 'مهسا', 'ترانه', 'نازنین', 'شقایق', 'رها', 'سپیده'];
const LAST = ['احمدی', 'رضایی', 'محمدی', 'حسینی', 'کریمی', 'موسوی', 'جعفری', 'صادقی', 'نوری', 'قاسمی', 'یوسفی', 'اکبری', 'رحیمی', 'عباسی', 'ملکی', 'سلیمانی', 'فرهادی', 'کاظمی', 'طاهری', 'شریفی'];
const BOYS = ['آرین', 'پارسا', 'امیرعلی', 'سینا', 'آراد', 'کیان', 'رادین', 'محمدطاها'];
const GIRLS = ['ثنا', 'یاسمن', 'نیایش', 'هلیا', 'آوا', 'باران', 'رز', 'پرنیا'];
const JOBS = ['مهندس', 'پزشک', 'معلم', 'کارمند', 'کاسب', 'وکیل', 'حسابدار', 'طراح'];
const SOURCES = ['Instagram', 'معرفی دوستان', 'تلگرام', 'گوگل', 'مراجعه حضوری'];
const ITEMS = [['پکیج عکاسی کودک', 3500000], ['آلبوم ۳۰×۲۰', 1800000], ['قاب دیواری', 900000], ['فیلم کوتاه', 2400000], ['عکس اضافه', 150000]] as const;

function pad(n: number) { return String(n).padStart(2, '0'); }
function mobile(i: number) { return `0912${String(3000000 + i * 7919).slice(0, 7)}`; }

export function seedExtraData() {
  const flag = db.prepare("SELECT value FROM studio_settings WHERE key = 'extra_seed_done'").get();
  if (flag) return;
  const today = getTodayJalali();
  const d = (off: number) => addDaysJalali(today, off);

  db.exec('BEGIN TRANSACTION;');
  try {
    // Branches & halls
    const branchIds: number[] = [];
    const insB = db.prepare('INSERT INTO branches (name, address, phone) VALUES (?, ?, ?)');
    for (const [n, a, p] of [['شعبه مرکزی', 'تهران، میدان ولیعصر', '02122334455'], ['شعبه شرق', 'تهران، سه‌راه تهرانپارس', '02177889900'], ['شعبه غرب', 'تهران، شهرک غرب', '02188112233']]) {
      branchIds.push(Number(insB.run(n, a, p).lastInsertRowid));
    }
    const hallIds: number[] = [];
    const insH = db.prepare('INSERT INTO halls (branch_id, name, capacity) VALUES (?, ?, ?)');
    [[0, 'سالن کودک', 8], [0, 'سالن خانواده', 12], [1, 'سالن تولد', 20], [1, 'سالن فضای باز', 15], [2, 'سالن کودک غرب', 8]]
      .forEach(([b, n, c]) => hallIds.push(Number(insH.run(branchIds[b as number], n, c).lastInsertRowid)));

    // Families
    const insC = db.prepare("INSERT INTO customers (first_name, last_name, phone, phone2, birth_date, source, notes, status) VALUES (?, ?, ?, ?, ?, ?, ?, 'active')");
    const insM = db.prepare('INSERT INTO family_members (customer_id, role, first_name, last_name, phone, gender, birth_date, job, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
    const tagIds = (db.prepare('SELECT id FROM tags ORDER BY id').all() as any[]).map((t) => t.id);
    const insT = db.prepare('INSERT OR IGNORE INTO customer_tags (customer_id, tag_id) VALUES (?, ?)');
    const famIds: number[] = [];
    const jy = jalaliParts(today).y;
    for (let i = 0; i < 20; i++) {
      const fp = mobile(i * 2); const mp = mobile(i * 2 + 1);
      const cid = Number(insC.run(FATHERS[i], LAST[i], fp, mp, `${jy - 36 + (i % 6)}/${pad((i % 12) + 1)}/${pad((i % 27) + 1)}`, SOURCES[i % SOURCES.length], null).lastInsertRowid);
      famIds.push(cid);
      insM.run(cid, 'father', FATHERS[i], LAST[i], fp, null, `${jy - 36 + (i % 6)}/${pad((i % 12) + 1)}/${pad((i % 27) + 1)}`, JOBS[i % JOBS.length], 0);
      insM.run(cid, 'mother', MOTHERS[i], LAST[i], mp, null, `${jy - 33 + (i % 6)}/${pad(((i + 3) % 12) + 1)}/${pad(((i + 5) % 27) + 1)}`, JOBS[(i + 3) % JOBS.length], 1);
      const kids = (i % 3) + 1;
      for (let k = 0; k < kids; k++) {
        const boy = (i + k) % 2 === 0;
        insM.run(cid, 'child', (boy ? BOYS : GIRLS)[(i + k) % 8], LAST[i], null, boy ? 'پسر' : 'دختر', `${jy - 1 - ((i + k) % 8)}/${pad(((i * 2 + k) % 12) + 1)}/${pad(((i + k * 4) % 27) + 1)}`, null, 2 + k);
      }
      insT.run(cid, tagIds[i % tagIds.length]);
      if (i % 4 === 0) insT.run(cid, tagIds[0]);
    }

    // Holidays
    db.prepare('INSERT INTO holidays (date, description) VALUES (?, ?)').run(d(6), 'تعطیلی رسمی');

    // Team (use existing members, add if empty)
    if (!(db.prepare('SELECT COUNT(*) AS c FROM team_members').get() as any).c) {
      const insTm = db.prepare('INSERT INTO team_members (full_name, phone, role) VALUES (?, ?, ?)');
      [['آرمان کیانی', '09121110001', 'عکاس'], ['سمانه فرجی', '09121110002', 'ادیتور'], ['بهزاد نادری', '09121110003', 'فیلمبردار'], ['الناز رستمی', '09121110004', 'دستیار']].forEach((t) => insTm.run(...t));
    }
    const team = (db.prepare('SELECT id, full_name FROM team_members ORDER BY id').all() as any[]);
    const who = (i: number) => team[i % team.length].full_name;

    // Appointments
    const insA = db.prepare(`
      INSERT INTO appointments (customer_id, branch_id, hall_id, date, start_time, end_time, duration_minutes, project_type, status, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const hallBranch = new Map((db.prepare('SELECT id, branch_id FROM halls').all() as any[]).map((h) => [h.id, h.branch_id]));
    const types = ['عکاسی کودک', 'عکاسی خانواده', 'عکاسی تولد', 'عکاسی بارداری'];
    let made = 0;
    for (let i = 0; made < 24 && i < 80; i++) {
      const date = d((i % 14) - 4);
      const hall = hallIds[i % hallIds.length];
      const start = 9 * 60 + ((i * 3) % 8) * 60;
      const dur = [60, 90, 120][i % 3];
      const startS = fromMinutes(start); const endS = fromMinutes(start + dur);
      if (findHoliday(date, hallBranch.get(hall)!)) continue;
      if (findConflict(hall, date, startS, endS)) continue;
      const past = date < today;
      insA.run(famIds[i % famIds.length], hallBranch.get(hall), hall, date, startS, endS, dur, types[i % types.length], past ? (i % 5 === 0 ? 'لغو شده' : 'انجام شد') : 'رزرو شده', null);
      made++;
    }

    // Projects
    const stages = (db.prepare('SELECT name FROM project_stages ORDER BY sort_order').all() as any[]).map((s) => s.name);
    const insP = db.prepare(`
      INSERT INTO projects (project_code, name, customer_id, project_type, project_date, location, status, assignee, deadline, amount, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insPrep = db.prepare('INSERT OR IGNORE INTO prep_tasks (project_id, kind, stage, assignee, start_date, deadline) VALUES (?, ?, ?, ?, ?, ?)');
    const maxId = (db.prepare('SELECT COALESCE(MAX(id),0) AS m FROM projects').get() as any).m as number;
    const projIds: number[] = [];
    for (let i = 0; i < 20; i++) {
      const status = stages[i % stages.length];
      const amount = [4500000, 6200000, 3800000, 8900000, 5400000][i % 5];
      const pid = Number(insP.run(`PRJ-${String(maxId + i + 1).padStart(4, '0')}`, `${types[i % types.length]} خانواده ${LAST[i]}`, famIds[i], types[i % types.length], d(i - 12), 'آتلیه', status, who(i), d((i % 9) - 2), amount, null).lastInsertRowid);
      projIds.push(pid);
      const kind = Object.entries(STAGE_FOR_PREP).find(([, n]) => n === status)?.[0];
      if (kind) insPrep.run(pid, kind, PREP_STAGES[kind][i % 4], who(i + 1), d(i - 12), d((i % 9) - 2));
    }

    // Invoices + payments
    const insI = db.prepare(`
      INSERT INTO invoices (invoice_number, customer_id, project_id, issue_date, due_date, subtotal, discount, tax, extra_costs, total, paid_amount, remaining_amount, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, ?, 0, ?, 'unpaid')
    `);
    const insII = db.prepare('INSERT INTO invoice_items (invoice_id, name, quantity, unit_price, total_price) VALUES (?, ?, ?, ?, ?)');
    const invMax = (db.prepare('SELECT COALESCE(MAX(id),0) AS m FROM invoices').get() as any).m as number;
    const methods = ['نقدی', 'کارتخوان', 'کارت به کارت', 'حواله'];
    for (let i = 0; i < 12; i++) {
      const items = [ITEMS[i % ITEMS.length], ITEMS[(i + 1) % ITEMS.length]];
      const subtotal = items.reduce((s, it) => s + it[1], 0);
      const discount = i % 3 === 0 ? 300000 : 0;
      const total = subtotal - discount;
      const iid = Number(insI.run(`INV-${String(invMax + i + 1 + 500).padStart(5, '0')}`, famIds[i], projIds[i], d(-20 + i), d(-10 + i * 2), subtotal, discount, total, total).lastInsertRowid);
      for (const it of items) insII.run(iid, it[0], 1, it[1], it[1]);
      if (i % 4 !== 3) {
        const pay = i % 4 === 0 ? total : Math.round(total / 2 / 1000) * 1000;
        insertPayment({ customer_id: famIds[i], amount: pay, payment_date: d(-18 + i), payment_time: '11:30', payment_method: methods[i % 4], invoice_id: iid, tracking_code: `TRK${100200 + i}`, description: 'پرداخت فاکتور' });
      }
    }
    // A pending cheque
    const chInv = (db.prepare("SELECT id, customer_id, remaining_amount FROM invoices WHERE remaining_amount > 1000000 AND contract_id IS NULL ORDER BY id DESC LIMIT 1").get() as any);
    if (chInv) {
      const pid = insertPayment({ customer_id: chInv.customer_id, amount: 500000, payment_date: today, payment_time: '10:00', payment_method: 'چک', invoice_id: chInv.id, tracking_code: '778899', description: 'دریافت چک 778899' });
      db.prepare('INSERT INTO cheques (payment_id, customer_id, cheque_number, bank, due_date, amount, status) VALUES (?, ?, ?, ?, ?, ?, ?)').run(pid, chInv.customer_id, '778899', 'ملت', d(2), 500000, 'در انتظار وصول');
    }

    // Expenses
    const insE = db.prepare('INSERT INTO expenses (title, category, amount, expense_date, payment_method, payer, description) VALUES (?, ?, ?, ?, ?, ?, ?)');
    [['اجاره ماهانه آتلیه', 'اجاره', 12000000, -25], ['قبض برق', 'برق', 850000, -18], ['اینترنت پرسرعت', 'اینترنت', 600000, -15], ['تعمیر فلاش', 'تعمیرات', 1400000, -12], ['تبلیغات اینستاگرام', 'تبلیغات', 2000000, -9], ['خرید قاب و کاغذ چاپ', 'خرید کالا', 3200000, -6], ['حقوق دستیار', 'حقوق', 5500000, -3], ['ایاب و ذهاب لوکیشن', 'حمل‌ونقل', 450000, -1]]
      .forEach(([t, c, a, o], i) => insE.run(t, c, a, d(o as number), methods[i % 4], 'مدیریت', null));

    // Products
    const insPr = db.prepare('INSERT INTO products (name, category, stock, purchase_price, sale_price, min_stock) VALUES (?, ?, ?, ?, ?, ?)');
    [['قاب چوبی ۳۰×۴۰', 'قاب و چاپ', 14, 350000, 650000, 5], ['آلبوم چرمی', 'آلبوم', 6, 900000, 1800000, 3], ['کاغذ چاپ گلاسه', 'مصرفی', 2, 400000, 0, 4], ['کلاه و لباس نوزاد', 'پوشاک و لوازم', 20, 120000, 300000, 6], ['پس‌زمینه پارچه‌ای', 'اکسسوری', 8, 200000, 450000, 2]]
      .forEach((p) => insPr.run(...p));

    // Follow-ups
    const insF = db.prepare('INSERT INTO followups (customer_id, title, description, assignee, due_date, due_time, priority, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    const admin = (db.prepare('SELECT full_name FROM users ORDER BY id LIMIT 1').get() as any)?.full_name || 'مدیر سیستم';
    [['پیگیری پرداخت مانده فاکتور', 0, 'فوری', 'باز'], ['هماهنگی ارسال آلبوم', 1, 'بالا', 'باز'], ['تماس برای انتخاب عکس', 0, 'عادی', 'باز'], ['یادآوری نوبت عکاسی', 2, 'عادی', 'در انتظار'], ['دعوت به تخفیف مشتریان قدیمی', 5, 'عادی', 'باز'], ['بررسی رضایت مشتری', -3, 'عادی', 'بسته شده']]
      .forEach(([t, o, p, s], i) => insF.run(famIds[i], t, null, admin, d(o as number), '10:00', p, s));

    // SMS history
    const insS = db.prepare('INSERT INTO sms_messages (customer_id, phone, message_body, status, provider_response, sent_date, sent_time) VALUES (?, ?, ?, ?, ?, ?, ?)');
    for (let i = 0; i < 6; i++) {
      const phone = mobile(i * 2);
      const statuses = ['ارسال شد', 'ارسال شد', 'ارسال شد', 'در انتظار', 'خطا', 'ارسال شد'];
      const st = statuses[i];
      insS.run(famIds[i], st === 'خطا' ? '0912' : phone, `سلام ${FATHERS[i]} عزیز، یادآوری نوبت شما در تاریخ ${d(i)} ساعت 10:00`, st, st === 'خطا' ? 'شماره موبایل نامعتبر است' : st === 'در انتظار' ? 'در صف ارسال' : 'ارسال شد (درگاه آزمایشی)', st === 'در انتظار' ? null : d(-i), '12:00');
    }

    // Packages
    const insPk = db.prepare('INSERT INTO packages (name, price, description) VALUES (?, ?, ?)');
    [['پکیج کودک برنزی', 2500000, '۱۰ عکس ادیت‌شده'], ['پکیج خانواده نقره‌ای', 4500000, '۲۰ عکس و یک قاب'], ['پکیج ویژه تولد', 7800000, 'عکس، فیلم و آلبوم']].forEach((p) => insPk.run(...p));

    db.prepare("INSERT OR REPLACE INTO studio_settings (key, value) VALUES ('extra_seed_done', '1')").run();
    db.exec('COMMIT;');
  } catch (e) {
    db.exec('ROLLBACK;');
    console.error('Extra seed failed:', e);
  }
}
void toMinutes;
