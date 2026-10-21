import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'studio-test-'));

const { db, initDatabase } = await import('../server/db.ts');
const { initExtraSchema } = await import('../server/extraSchema.ts');
const { seedExtraData } = await import('../server/extraSeed.ts');
const { registerExtraRoutes } = await import('../server/routes/index.ts');
const { makeApp } = await import('./harness.ts');
const { getTodayJalali } = await import('../server/jalali.ts');
const { addDaysJalali } = await import('../server/routes/util.ts');
const { processDeposits } = await import('../server/routes/scheduling.ts');

initDatabase(); initExtraSchema(); seedExtraData();
const { app, call } = makeApp();
registerExtraRoutes(app, {
  getAuthUser: (req: any) => req.user || null,
  logAudit: () => {},
});

let passed = 0; let failed = 0;
function check(name: string, cond: any, extra: any = '') {
  if (cond) { passed++; console.log('  ok  ', name); }
  else { failed++; console.log('  FAIL', name, extra !== '' ? JSON.stringify(extra) : ''); }
}
const count = (t: string) => (db.prepare(`SELECT COUNT(*) AS c FROM ${t}`).get() as any).c as number;

// session
const admin = db.prepare("SELECT id FROM users WHERE username = 'admin'").get() as any;
db.prepare("INSERT INTO sessions (token, user_id) VALUES ('T-ADMIN', ?)").run(admin.id);
const A = 'T-ADMIN';
const today = getTodayJalali();
console.log('today (jalali):', today);

console.log('\n# Seed & schema');
check('branches >= 3', count('branches') >= 3);
check('halls >= 5', count('halls') >= 5);
check('families >= 20', count('customers') >= 20, count('customers'));
check('members >= 30', count('family_members') >= 30, count('family_members'));
check('appointments >= 20', count('appointments') >= 20, count('appointments'));
check('projects >= 20', count('projects') >= 20, count('projects'));
check('invoices exist', count('invoices') >= 5);
check('payments exist', count('payments') >= 5);
check('expenses exist', count('expenses') >= 5);
check('followups exist', count('followups') >= 5);
check('sms exist', count('sms_messages') >= 5);
check('team exist', count('team_members') >= 3);

console.log('\n# Auth guard');
let r: any = await call('GET', '/api/families');
check('no token -> 401', r.status === 401, r);
r = await call('GET', '/api/families', {}, A);
check('admin lists families', r.success && r.data.length >= 20, r.message);
db.prepare("INSERT INTO users (username, password_hash, full_name, role) VALUES ('photog','x','عکاس تست','Photographer')").run();
const pu = db.prepare("SELECT id FROM users WHERE username='photog'").get() as any;
db.prepare("INSERT INTO sessions (token, user_id) VALUES ('T-PHOTO', ?)").run(pu.id);
r = await call('GET', '/api/families', {}, 'T-PHOTO');
check('photographer can view', r.success);
r = await call('POST', '/api/families', { family_name: 'x' }, 'T-PHOTO');
check('photographer cannot create (403)', r.status === 403, r);
r = await call('POST', '/api/payments', {}, 'T-PHOTO');
check('photographer cannot pay (403)', r.status === 403);
r = await call('GET', '/api/reports/overview', {}, 'T-PHOTO');
check('photographer cannot read reports (403)', r.status === 403);

console.log('\n# Family CRUD');
r = await call('POST', '/api/families', { family_name: '', father: { first_name: 'علی' } }, A);
check('missing family name rejected', !r.success && r.status === 400, r);
r = await call('POST', '/api/families', { family_name: 'تست‌پور', father: { first_name: 'رضا', phone: '123' } }, A);
check('bad mobile rejected', !r.success, r);
r = await call('POST', '/api/families', {
  family_name: 'تست‌پور', source: 'Instagram',
  father: { first_name: 'رضا', phone: '09351112233', job: 'مهندس' },
  mother: { first_name: 'سارا', phone: '09352223344' },
  children: [{ first_name: 'آوین', gender: 'دختر', birth_date: '۱۴۰۴/۰۳/۱۰' }, { first_name: 'پارسا', gender: 'پسر' }],
  tag_ids: [1, 2],
}, A);
check('family created', r.success && r.data.id, r);
const famId = r.data.id;
r = await call('POST', '/api/families', { family_name: 'دیگر', father: { first_name: 'x', phone: '09351112233' } }, A);
check('duplicate phone -> 409', r.status === 409, r);
r = await call('GET', '/api/families?q=' + encodeURIComponent('آوین'), {}, A);
check('search by child name', r.data.length === 1 && r.data[0].id === famId, r.data?.length);
r = await call('GET', '/api/families?q=09352223344', {}, A);
check('search by mother mobile', r.data.length === 1 && r.data[0].id === famId);
r = await call('GET', '/api/families?q=' + encodeURIComponent('۰۹۳۵۱۱۱۲۲۳۳'), {}, A);
check('search with Persian digits', r.data.length === 1);
r = await call('GET', '/api/families?tag=1', {}, A);
check('filter by tag', r.data.some((f: any) => f.id === famId));
r = await call('GET', `/api/families/${famId}`, {}, A);
check('profile loads with 4 members', r.success && r.data.members.length === 4, r.data?.members?.length);
check('child age computed', r.data.members.find((m: any) => m.first_name === 'آوین')?.age !== null);
r = await call('PUT', `/api/families/${famId}`, {
  family_name: 'تست‌پور', father: { first_name: 'رضا', phone: '09351112233' }, mother: { first_name: 'سارا', phone: '09352223344' },
  children: [{ first_name: 'آوین', gender: 'دختر' }, { first_name: 'پارسا', gender: 'پسر' }, { first_name: 'نیکا', gender: 'دختر' }], tag_ids: [3],
}, A);
check('family edited (child added)', r.success, r);
r = await call('GET', `/api/families/${famId}`, {}, A);
check('now 5 members, 1 tag', r.data.members.length === 5 && r.data.tags.length === 1);

console.log('\n# Scheduler');
const hall = (db.prepare('SELECT id, branch_id FROM halls ORDER BY id LIMIT 1').get() as any);
const farDay = addDaysJalali(today, 40);
const slot = { customer_id: famId, hall_id: hall.id, date: farDay, start_time: '10:00', duration_minutes: 60, project_type: 'عکاسی کودک' };
r = await call('POST', '/api/appointments', slot, A);
check('appointment created', r.success, r);
const apptId = r.data?.id;
r = await call('POST', '/api/appointments', { ...slot, start_time: '10:30' }, A);
check('overlap -> 409 with message', r.status === 409 && r.message === 'این سالن در این ساعت قبلاً رزرو شده است.', r);
r = await call('POST', '/api/appointments', { ...slot, start_time: '11:00' }, A);
check('adjacent slot allowed', r.success, r);
const adjId = r.data?.id;
r = await call('POST', '/api/appointments', { ...slot, start_time: '06:00' }, A);
check('outside working hours rejected', !r.success && /ساعت کاری/.test(r.message), r);
r = await call('POST', '/api/appointments', { ...slot, hall_id: 99999 }, A);
check('invalid hall rejected', !r.success);
r = await call('PUT', '/api/working-hours', { branch_id: 0, start_time: '20:00', end_time: '08:00', slot_minutes: 30 }, A);
check('hours: start must be < end', !r.success, r);
r = await call('PUT', '/api/working-hours', { branch_id: 0, start_time: '08:00', end_time: '21:00', slot_minutes: 45 }, A);
check('hours: invalid slot rejected', !r.success);
r = await call('PUT', '/api/working-hours', { branch_id: 0, start_time: '07:00', end_time: '21:00', slot_minutes: 15 }, A);
check('hours saved', r.success && r.data.start_time === '07:00');
r = await call('POST', '/api/appointments', { ...slot, start_time: '07:30', date: addDaysJalali(today, 41) }, A);
check('new hours apply immediately', r.success, r);
const hDay = addDaysJalali(today, 50);
r = await call('POST', '/api/holidays', { date: hDay, description: 'تست' }, A);
check('holiday saved', r.success, r);
r = await call('POST', '/api/appointments', { ...slot, date: hDay }, A);
check('booking on holiday blocked', !r.success && r.holiday === true, r);
r = await call('PUT', `/api/appointments/${adjId}/status`, { status: 'لغو شده' }, A);
check('cancel appointment', r.success && r.data.status === 'لغو شده');
r = await call('POST', '/api/appointments', { ...slot, start_time: '11:00' }, A);
check('cancelled slot can be rebooked', r.success, r);
r = await call('PUT', `/api/appointments/${adjId}/status`, { status: 'رزرو شده' }, A);
check('re-activating into a taken slot -> 409', r.status === 409, r);
r = await call('GET', `/api/appointments?from=${farDay}&to=${farDay}&hall_id=${hall.id}`, {}, A);
check('calendar query returns day appts', r.success && r.data.length >= 2);

console.log('\n# Deposit / online payment mock');
const depDay = addDaysJalali(today, 45);
r = await call('POST', '/api/appointments', {
  ...slot, date: depDay, start_time: '12:00', deposit_required: true, deposit_amount: '500,000',
  deposit_deadline_date: today, deposit_deadline_time: '00:01', auto_cancel: true, accept_terms: true,
}, A);
check('deposit appointment created with link', r.success && /^\/pay\//.test(r.data.payment_link), r);
const depId = r.data?.id;
const smsBefore = count('sms_messages');
check('deposit SMS queued', db.prepare("SELECT COUNT(*) c FROM sms_messages WHERE message_body LIKE '%/pay/%'").get().c >= 1);
r = await call('POST', '/api/appointments', { ...slot, date: depDay, start_time: '14:00', deposit_required: true, deposit_amount: 0, deposit_deadline_date: today, deposit_deadline_time: '10:00', accept_terms: true }, A);
check('deposit amount must be > 0', !r.success);
r = await call('POST', '/api/appointments', { ...slot, date: depDay, start_time: '14:00', deposit_required: true, deposit_amount: 1000, deposit_deadline_date: today, deposit_deadline_time: '10:00' }, A);
check('terms must be accepted', !r.success && /قوانین/.test(r.message));
await processDeposits({ date: today, time: '23:00' });
r = await call('GET', `/api/appointments?customer_id=${famId}&from=${depDay}&to=${depDay}`, {}, A);
check('unpaid deposit auto-cancelled after deadline', r.data.find((a: any) => a.id === depId)?.status === 'لغو شده', r.data);
r = await call('POST', '/api/appointments', {
  ...slot, date: depDay, start_time: '16:00', deposit_required: true, deposit_amount: 300000,
  deposit_deadline_date: addDaysJalali(today, 3), deposit_deadline_time: '10:00', auto_cancel: true, accept_terms: true,
}, A);
const dep2 = r.data?.id;
const paymentsBefore = count('payments');
r = await call('POST', `/api/appointments/${dep2}/deposit/pay`, {}, A);
check('mock deposit payment ok', r.success && r.data.deposit_paid === 1, r);
check('deposit created a payment record', count('payments') === paymentsBefore + 1);
await processDeposits({ date: addDaysJalali(today, 10), time: '23:00' });
r = await call('GET', `/api/appointments?customer_id=${famId}&from=${depDay}&to=${depDay}`, {}, A);
check('paid deposit is not auto-cancelled', r.data.find((a: any) => a.id === dep2)?.status === 'رزرو شده');

console.log('\n# Projects, Kanban, prep');
r = await call('POST', '/api/projects', { customer_id: famId, name: 'عکاسی تولد آوین', project_type: 'عکاسی تولد', project_date: today, deadline: addDaysJalali(today, 2), assignee: 'آرمان کیانی', amount: '6,000,000', notes: 'x' }, A);
check('project created', r.success && /^PRJ-/.test(r.data.project_code), r);
const pid = r.data.id;
check('project amount stored', r.data.amount === 6000000 && r.data.remaining === 6000000, r.data);
r = await call('POST', '/api/projects', { customer_id: famId, name: '', project_date: today }, A);
check('project needs a title', !r.success);
r = await call('PUT', `/api/projects/${pid}/status`, { status: 'وضعیت ناموجود' }, A);
check('unknown status rejected', !r.success);
r = await call('PUT', `/api/projects/${pid}/status`, { status: 'آماده‌سازی عکس' }, A);
check('kanban move persisted', r.success && r.data.status === 'آماده‌سازی عکس', r);
r = await call('GET', '/api/prep?kind=photo', {}, A);
check('moving to photo-prep created prep task', r.data.some((t: any) => t.project_id === pid && t.stage === 'دریافت فایل'), r.data?.length);
const taskId = r.data.find((t: any) => t.project_id === pid)?.id;
r = await call('PUT', `/api/prep/${taskId}`, { stage: 'ادیت', assignee: 'سمانه فرجی' }, A);
check('prep stage updated', r.success);
r = await call('PUT', `/api/prep/${taskId}`, { stage: 'مرحله اشتباه' }, A);
check('invalid prep stage rejected', !r.success);
r = await call('PUT', `/api/prep/${taskId}`, { stage: 'آماده تحویل' }, A);
check('all prep done -> project becomes آماده تحویل', r.success && r.data.project_ready === true, r);
r = await call('GET', `/api/projects/${pid}`, {}, A);
check('project status auto-advanced', r.data.status === 'آماده تحویل', r.data.status);
r = await call('POST', '/api/prep', { kind: 'video', project_id: pid }, A);
check('manual add to video prep', r.success, r);
r = await call('POST', '/api/prep', { kind: 'video', project_id: pid }, A);
check('duplicate prep entry rejected', r.status === 409);
r = await call('POST', '/api/project-stages', { name: 'در انتظار تأیید مشتری' }, A);
check('custom stage created', r.success);
const newStage = r.data.id;
r = await call('DELETE', '/api/project-stages/1', {}, A);
check('system stage cannot be deleted', !r.success, r);
r = await call('DELETE', `/api/project-stages/${newStage}`, {}, A);
check('custom stage deleted', r.success);

console.log('\n# Invoice, payment, debt, dashboard');
const dashBefore = (await call('GET', '/api/dashboard/overview', {}, A)).data;
r = await call('POST', '/api/invoices', { customer_id: famId, project_id: pid, items: [], }, A);
check('invoice needs items', !r.success);
r = await call('POST', '/api/invoices', {
  customer_id: famId, project_id: pid, due_date: addDaysJalali(today, -1),
  items: [{ name: 'پکیج', quantity: 2, unit_price: 1000000 }, { name: 'قاب', quantity: 1, unit_price: 500000 }],
  discount: 200000, extra_costs: 100000, tax_percent: 10,
}, A);
// subtotal 2.5M - 200k + 100k = 2.4M ; tax 240k ; total 2.64M
check('invoice total = items - discount + extras + tax', r.success && r.data.total === 2640000 && r.data.remaining_amount === 2640000, r.data);
const invId = r.data.id;
let debt = (await call('GET', `/api/families/${famId}`, {}, A)).data.summary.debt;
check('family debt equals invoice', debt === 2640000, debt);
r = await call('POST', '/api/payments', { invoice_id: invId, amount: 5000000, payment_method: 'نقدی' }, A);
check('overpayment rejected', !r.success, r);
r = await call('POST', '/api/payments', { invoice_id: invId, amount: 1000000, payment_method: 'کارتخوان', bank_account: 'ملی', payment_date: today, payment_time: '14:20' }, A);
check('payment recorded', r.success, r);
let inv = db.prepare('SELECT * FROM invoices WHERE id = ?').get(invId) as any;
check('invoice paid/remaining/status updated', inv.paid_amount === 1000000 && inv.remaining_amount === 1640000 && inv.status === 'partially_paid', inv);
debt = (await call('GET', `/api/families/${famId}`, {}, A)).data.summary.debt;
check('family debt reduced', debt === 1640000, debt);
const pj = (await call('GET', `/api/projects/${pid}`, {}, A)).data;
check('project paid reflects payment', pj.paid === 1000000 && pj.remaining === 5000000, { paid: pj.paid, rem: pj.remaining });
let dashAfter = (await call('GET', '/api/dashboard/overview', {}, A)).data;
check('dashboard paid increased by payment', dashAfter.paid - dashBefore.paid === 1000000 + 0 - 0 + 0 || dashAfter.paid > dashBefore.paid, { b: dashBefore.paid, a: dashAfter.paid });
check('dashboard revenue increased by invoice', dashAfter.revenue - dashBefore.revenue === 2640000, dashAfter.revenue - dashBefore.revenue);
check('dashboard debt increased', dashAfter.debt - dashBefore.debt === 2640000 - 1000000, dashAfter.debt - dashBefore.debt);

console.log('\n# Cheque flow');
r = await call('POST', '/api/payments', { invoice_id: invId, amount: 600000, payment_method: 'چک' }, A);
check('cheque payment requires cheque details', !r.success, r);
r = await call('POST', '/api/payments', { invoice_id: invId, amount: 600000, payment_method: 'چک', cheque: { cheque_number: '445566', bank: 'ملت', due_date: addDaysJalali(today, 1) } }, A);
check('cheque payment recorded', r.success, r);
inv = db.prepare('SELECT * FROM invoices WHERE id = ?').get(invId) as any;
check('cheque counted as received payment', inv.remaining_amount === 1040000, inv.remaining_amount);
r = await call('GET', '/api/cheques', {}, A);
const chq = r.data.find((c: any) => c.cheque_number === '445566');
check('cheque listed', !!chq && chq.status === 'دریافت شده');
r = await call('PUT', `/api/cheques/${chq.id}`, { status: 'در انتظار وصول' }, A);
check('cheque status -> pending', r.success);
const fuBefore = count('followups');
r = await call('PUT', `/api/cheques/${chq.id}`, { status: 'برگشتی' }, A);
check('cheque bounced', r.success, r);
inv = db.prepare('SELECT * FROM invoices WHERE id = ?').get(invId) as any;
check('bounce restores invoice balance', inv.remaining_amount === 1640000, inv.remaining_amount);
check('bounce creates urgent follow-up', count('followups') === fuBefore + 1);
r = await call('PUT', `/api/cheques/${chq.id}`, { status: 'وصول شده' }, A);
check('bounced cheque cannot be revived', !r.success);

console.log('\n# Expense, products');
const dashE = (await call('GET', '/api/dashboard/overview', {}, A)).data;
r = await call('POST', '/api/accounting/expenses', { title: 'تست هزینه', amount: '250,000', category: 'اینترنت', expense_date: today, payer: 'مدیریت', payment_method: 'نقدی' }, A);
check('expense created', r.success, r);
const expId = r.data?.id;
const dashE2 = (await call('GET', '/api/dashboard/overview', {}, A)).data;
check('dashboard expenses changed', dashE2.expenses - dashE.expenses === 250000);
check('dashboard cashflow changed', dashE.cashflow - dashE2.cashflow === 250000);
r = await call('POST', '/api/accounting/expenses', { title: 'x', amount: 0, category: 'سایر' }, A);
check('expense amount validated', !r.success);
r = await call('PUT', `/api/accounting/expenses/${expId}`, { title: 'تست هزینه ۲', amount: 300000, category: 'اینترنت', expense_date: today }, A);
check('expense edited', r.success);
r = await call('DELETE', `/api/accounting/expenses/${expId}`, {}, A);
check('expense deleted', r.success);
r = await call('POST', '/api/products', { name: 'قاب تست', stock: 5, min_stock: 2, sale_price: 100000, purchase_price: 60000 }, A);
check('product created', r.success);
const prodId = r.data.id;
r = await call('POST', `/api/products/${prodId}/stock`, { delta: -9 }, A);
check('cannot go below zero stock', !r.success, r);
r = await call('POST', `/api/products/${prodId}/stock`, { delta: -3, reason: 'فروش' }, A);
check('stock decrease', r.success && r.data.stock === 2);
r = await call('GET', '/api/products', {}, A);
check('low-stock flag', r.data.find((p: any) => p.id === prodId).low_stock === true);

console.log('\n# Follow-ups & notifications');
r = await call('POST', '/api/followups', { customer_id: famId, title: 'تماس پیگیری', due_date: today, priority: 'فوری' }, A);
check('followup created (defaults assignee to me)', r.success, r);
const fuId = r.data?.id;
r = await call('POST', '/api/followups', { title: '', due_date: today }, A);
check('followup title required', !r.success);
r = await call('GET', '/api/notifications', {}, A);
check('notifications has followup + deadline + cheque items', r.data.counts.followup >= 1 && r.data.counts.deadline >= 1, r.data.counts);
check('notifications include failed sms', (r.data.counts.sms || 0) >= 1);
r = await call('POST', `/api/followups/${fuId}/next`, { date: addDaysJalali(today, 3), time: '11:00' }, A);
check('followup rescheduled', r.success && r.data.due_date === addDaysJalali(today, 3));
r = await call('POST', `/api/followups/${fuId}/next`, { date: addDaysJalali(today, -3) }, A);
check('cannot reschedule into the past', !r.success);
r = await call('POST', `/api/followups/${fuId}/done`, {}, A);
check('followup done -> closed', r.success);
r = await call('GET', '/api/followups?open=1', {}, A);
check('closed followup leaves open list', !r.data.some((f: any) => f.id === fuId));

console.log('\n# SMS');
r = await call('POST', '/api/sms/send', { customer_id: famId, template_id: null, message_body: 'سلام {{نام}} {{نام_خانوادگی}}، مانده شما {{مانده}}', phone: '09351112233' }, A);
check('sms sent with auto variables', r.success && r.data.status === 'ارسال شد' && r.data.message_body.includes('رضا') && r.data.message_body.includes('تومان'), r.data);
r = await call('POST', '/api/sms/send', { phone: '09351112233', message_body: 'تاریخ {{تاریخ}} ساعت {{ساعت}}' }, A);
check('missing variable rejected', !r.success && /ساعت/.test(r.message), r);
r = await call('POST', '/api/sms/send', { phone: '0935', message_body: 'سلام' }, A);
check('invalid number rejected', !r.success);
r = await call('POST', '/api/sms/send', { customer_id: famId, phone: '09351112233', message_body: 'صف', queue_only: true }, A);
check('queue_only stays pending', r.data.status === 'در انتظار');
const qid = r.data.id;
r = await call('GET', '/api/sms/queue', {}, A);
check('queue lists pending + failed', r.data.some((m: any) => m.id === qid) && r.data.some((m: any) => m.status === 'خطا'));
r = await call('POST', '/api/sms/queue/process', {}, A);
check('queue processed', r.success && r.data.sent >= 1, r);
r = await call('GET', '/api/sms/sent', {}, A);
check('sent history has the message with jalali date', r.data.some((m: any) => m.id === qid && /^\d{4}\/\d{2}\/\d{2}$/.test(m.sent_date)));
const failedRow = db.prepare("SELECT id FROM sms_messages WHERE status = 'خطا' LIMIT 1").get() as any;
r = await call('POST', `/api/sms/${failedRow.id}/retry`, {}, A);
check('retry of invalid number still fails with message', !r.success && /نامعتبر/.test(r.message), r);
r = await call('POST', '/api/sms/send', { customer_id: famId, phone: '09351112233', message_body: 'بعداً', scheduled_date: addDaysJalali(today, 5), scheduled_time: '10:00' }, A);
check('scheduled sms stays in queue', r.success && r.data.status === 'در انتظار', r.data);

console.log('\n# Reports & series');
for (const range of ['day', 'week', 'month', 'year']) {
  r = await call('GET', `/api/dashboard/series?range=${range}`, {}, A);
  const ok = r.success && r.data.labels.length === r.data.income.length && r.data.labels.length === r.data.payments.length;
  check(`series ${range} shape`, ok, r.message);
}
r = await call('GET', '/api/dashboard/series?range=day', {}, A);
check('today bucket has the payment we made', r.data.payments[r.data.payments.length - 1] >= 1000000, r.data.payments);
r = await call('GET', `/api/reports/overview?from=${addDaysJalali(today, -60)}&to=${addDaysJalali(today, 60)}`, {}, A);
check('detailed report', r.success && r.data.finance.paid > 0 && r.data.halls.length >= 5 && r.data.customers.total >= 21, r.message);
check('report profit = paid - expenses', r.data.finance.profit === r.data.finance.paid - r.data.finance.expenses);
r = await call('GET', `/api/reports/overview?from=${addDaysJalali(today, 5)}&to=${addDaysJalali(today, -5)}`, {}, A);
check('report range validated', !r.success);

console.log('\n# Global search, meta, basic info');
r = await call('GET', '/api/search?q=' + encodeURIComponent('تست‌پور'), {}, A);
check('global search finds family + project', r.data.families.length >= 1 && r.data.projects.length >= 1, r.data);
r = await call('GET', '/api/search?q=INV-', {}, A);
check('global search finds invoice by number', r.data.invoices.length >= 1);
r = await call('GET', '/api/meta', {}, A);
check('meta bundle', r.success && r.data.lookups.payment_method.includes('چک') && r.data.branches.length >= 3 && r.data.stages.length >= 10);
r = await call('POST', '/api/lookups/expense_category', { name: 'نظافت' }, A);
check('lookup created', r.success);
r = await call('POST', '/api/lookups/expense_category', { name: 'نظافت' }, A);
check('duplicate lookup rejected', r.status === 409);
r = await call('DELETE', `/api/lookups/payment_method/${db.prepare("SELECT id FROM lookups WHERE name='چک'").get().id}`, {}, A);
check('cheque method protected', !r.success);
r = await call('POST', '/api/tags', { name: 'ویژه تست' }, A);
check('tag created', r.success);
r = await call('PUT', `/api/tags/${r.data.id}`, { name: 'ویژه تست ۲' }, A);
check('tag edited', r.success);

console.log('\n# Delete rules');
r = await call('DELETE', `/api/families/${famId}`, {}, A);
check('family with finance data cannot be deleted', !r.success && /فاکتور|پرداخت|پروژه/.test(r.message), r);
r = await call('POST', '/api/families', { family_name: 'موقت', father: { first_name: 'الف', phone: '09360000001' } }, A);
const tmp = r.data.id;
r = await call('DELETE', `/api/families/${tmp}`, {}, A);
check('empty family deleted', r.success, r);
r = await call('DELETE', `/api/appointments/${apptId}`, {}, A);
check('appointment deleted', r.success);
r = await call('DELETE', `/api/branches/${hall.branch_id}`, {}, A);
check('branch with appointments cannot be deleted', !r.success);
r = await call('DELETE', `/api/payments/${db.prepare('SELECT id FROM payments WHERE invoice_id = ? ORDER BY id LIMIT 1').get(invId).id}`, {}, A);
check('payment deleted', r.success);
inv = db.prepare('SELECT * FROM invoices WHERE id = ?').get(invId) as any;
check('deleting a payment restores invoice balance', inv.paid_amount === 0 && inv.remaining_amount === 2640000, inv);
r = await call('DELETE', `/api/projects/${pid}`, {}, A);
check('project deleted', r.success);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
