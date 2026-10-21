import { db } from '../db.ts';
import { getTodayJalali } from '../jalali.ts';
import { Ctx, ok, fail, h, str, normDate, normTime, addDaysJalali, nowTimeHHMM } from './util.ts';
import { appointmentRows, projectRows } from './queries.ts';
import { listFamilies } from './families.ts';

export const FU_PRIORITIES = ['عادی', 'بالا', 'فوری'];
export const FU_STATUSES = ['باز', 'در انتظار', 'بسته شده'];

function followupRows(where = '1=1', params: any[] = []) {
  const today = getTodayJalali();
  const rows = db.prepare(`
    SELECT f.*, cu.first_name AS customer_first, cu.last_name AS customer_last, cu.phone AS customer_phone
    FROM followups f LEFT JOIN customers cu ON cu.id = f.customer_id
    WHERE ${where}
    ORDER BY CASE f.status WHEN 'بسته شده' THEN 1 ELSE 0 END,
             CASE f.priority WHEN 'فوری' THEN 0 WHEN 'بالا' THEN 1 ELSE 2 END, f.due_date, f.due_time
  `).all(...params) as any[];
  return rows.map((r) => ({ ...r, overdue: r.status !== 'بسته شده' && r.due_date <= today }));
}

export function buildNotifications(user: any) {
  const today = getTodayJalali();
  const soon = addDaysJalali(today, 3);
  const items: any[] = [];

  for (const a of appointmentRows("a.date = ? AND a.status = 'رزرو شده'", [today])) {
    items.push({ key: `appt-${a.id}`, type: 'appointment', title: 'نوبت امروز', message: `${a.customer_first} ${a.customer_last} — ساعت ${a.start_time} (${a.hall_name})`, target: 'appointments' });
  }

  const fu = followupRows("f.status != 'بسته شده' AND f.due_date <= ?", [today]);
  for (const f of fu) {
    items.push({ key: `fu-${f.id}`, type: 'followup', title: 'پیگیری موعددار', message: `${f.title}${f.customer_last ? ` — خانواده ${f.customer_last}` : ''}`, target: 'followups', mine: !!user && (f.assignee_user_id === user.id || f.assignee === user.full_name) });
  }

  const debts = db.prepare(`
    SELECT i.id, i.invoice_number, i.remaining_amount, i.due_date, cu.last_name FROM invoices i JOIN customers cu ON cu.id = i.customer_id
    WHERE i.status IN ('unpaid', 'partially_paid') AND i.remaining_amount > 0 AND i.due_date IS NOT NULL AND i.due_date != '' AND i.due_date < ?
    ORDER BY i.due_date LIMIT 20
  `).all(today) as any[];
  for (const d of debts) {
    items.push({ key: `debt-${d.id}`, type: 'debt', title: 'بدهی سررسیدشده', message: `فاکتور ${d.invoice_number} — خانواده ${d.last_name} — مانده ${Number(d.remaining_amount).toLocaleString('fa-IR')} تومان`, target: 'invoices' });
  }

  const cheques = db.prepare(`
    SELECT c.id, c.cheque_number, c.due_date, c.amount, cu.last_name FROM cheques c JOIN customers cu ON cu.id = c.customer_id
    WHERE c.status IN ('دریافت شده', 'در انتظار وصول') AND c.due_date <= ? ORDER BY c.due_date
  `).all(soon) as any[];
  for (const c of cheques) {
    items.push({ key: `chq-${c.id}`, type: 'cheque', title: c.due_date < today ? 'چک سررسیدشده' : 'چک نزدیک سررسید', message: `چک ${c.cheque_number} — خانواده ${c.last_name} — ${c.due_date}`, target: 'cheques' });
  }

  for (const p of projectRows("p.deadline IS NOT NULL AND p.deadline != '' AND p.deadline <= ? AND p.status NOT IN ('تحویل شده', 'لغو شده')", [soon])) {
    items.push({ key: `prj-${p.id}`, type: 'deadline', title: p.deadline < today ? 'Deadline گذشته' : 'Deadline نزدیک', message: `${p.project_code} — ${p.name} — ${p.deadline}`, target: 'projects' });
  }

  const failed = db.prepare("SELECT id, phone FROM sms_messages WHERE status = 'خطا' ORDER BY id DESC LIMIT 10").all() as any[];
  for (const s of failed) {
    items.push({ key: `sms-${s.id}`, type: 'sms', title: 'پیامک خطادار', message: `ارسال به ${s.phone} ناموفق بود`, target: 'sms_queue' });
  }

  const counts: Record<string, number> = {};
  for (const i of items) counts[i.type] = (counts[i.type] || 0) + 1;
  return { items, counts, total: items.length, mine_followups: items.filter((i) => i.type === 'followup' && i.mine).length };
}

export function registerFollowupRoutes(app: any, ctx: Ctx) {
  app.get('/api/followups', h((req, res) => {
    const where: string[] = ['1=1']; const params: any[] = [];
    const user = ctx.getAuthUser(req);
    if (str(req.query.status)) { where.push('f.status = ?'); params.push(str(req.query.status)); }
    if (str(req.query.open) === '1') where.push("f.status != 'بسته شده'");
    if (str(req.query.priority)) { where.push('f.priority = ?'); params.push(str(req.query.priority)); }
    if (Number(req.query.customer_id)) { where.push('f.customer_id = ?'); params.push(Number(req.query.customer_id)); }
    if (str(req.query.mine) === '1' && user) { where.push('(f.assignee_user_id = ? OR f.assignee = ?)'); params.push(user.id, user.full_name); }
    if (str(req.query.due) === '1') { where.push('f.due_date <= ?'); params.push(getTodayJalali()); }
    let rows = followupRows(where.join(' AND '), params);
    const q = str(req.query.q).toLowerCase();
    if (q) rows = rows.filter((r) => [r.title, r.description, r.assignee, r.customer_first, r.customer_last].join(' ').toLowerCase().includes(q));
    return ok(res, rows);
  }));

  function readFollowup(b: any, user: any) {
    const title = str(b.title);
    if (!title) return { error: 'عنوان پیگیری الزامی است.' };
    const due = normDate(b.due_date);
    if (!due) return { error: 'تاریخ پیگیری را درست وارد کنید.' };
    const time = str(b.due_time) ? normTime(b.due_time) : '';
    if (str(b.due_time) && !time) return { error: 'ساعت پیگیری معتبر نیست.' };
    const priority = str(b.priority) || 'عادی';
    if (!FU_PRIORITIES.includes(priority)) return { error: 'اولویت معتبر نیست.' };
    const status = str(b.status) || 'باز';
    if (!FU_STATUSES.includes(status)) return { error: 'وضعیت معتبر نیست.' };
    const customerId = Number(b.customer_id) || null;
    if (customerId && !db.prepare('SELECT 1 FROM customers WHERE id = ?').get(customerId)) return { error: 'مشتری معتبر نیست.' };
    const nextDate = str(b.next_followup_date) ? normDate(b.next_followup_date) : '';
    if (str(b.next_followup_date) && !nextDate) return { error: 'تاریخ پیگیری بعدی معتبر نیست.' };
    const nextTime = str(b.next_followup_time) ? normTime(b.next_followup_time) : '';
    const assignee = str(b.assignee) || user?.full_name || null;
    return { value: { title, due, time: time || null, priority, status, customerId, nextDate: nextDate || null, nextTime: nextTime || null, assignee, description: str(b.description) || null, assigneeUserId: Number(b.assignee_user_id) || (assignee === user?.full_name ? user?.id : null) || null } };
  }

  app.post('/api/followups', h((req, res) => {
    const user = ctx.getAuthUser(req);
    const p: any = readFollowup(req.body || {}, user);
    if (p.error) return fail(res, 400, p.error);
    const v = p.value;
    const r = db.prepare(`
      INSERT INTO followups (customer_id, title, description, assignee, assignee_user_id, due_date, due_time, priority, status, next_followup_date, next_followup_time)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(v.customerId, v.title, v.description, v.assignee, v.assigneeUserId, v.due, v.time, v.priority, v.status, v.nextDate, v.nextTime);
    return ok(res, followupRows('f.id = ?', [Number(r.lastInsertRowid)])[0], 'با موفقیت ثبت شد');
  }));

  app.put('/api/followups/:id', h((req, res) => {
    const id = Number(req.params.id);
    if (!db.prepare('SELECT 1 FROM followups WHERE id = ?').get(id)) return fail(res, 404, 'پیگیری یافت نشد.');
    const user = ctx.getAuthUser(req);
    const p: any = readFollowup(req.body || {}, user);
    if (p.error) return fail(res, 400, p.error);
    const v = p.value;
    db.prepare(`
      UPDATE followups SET customer_id = ?, title = ?, description = ?, assignee = ?, assignee_user_id = ?, due_date = ?, due_time = ?, priority = ?, status = ?,
        next_followup_date = ?, next_followup_time = ?, closed_at = CASE WHEN ? = 'بسته شده' THEN COALESCE(closed_at, CURRENT_TIMESTAMP) ELSE NULL END WHERE id = ?
    `).run(v.customerId, v.title, v.description, v.assignee, v.assigneeUserId, v.due, v.time, v.priority, v.status, v.nextDate, v.nextTime, v.status, id);
    return ok(res, followupRows('f.id = ?', [id])[0], 'با موفقیت ثبت شد');
  }));

  // انجام شد
  app.post('/api/followups/:id/done', h((req, res) => {
    const id = Number(req.params.id);
    const r = db.prepare("UPDATE followups SET status = 'بسته شده', outcome = 'انجام شد', closed_at = CURRENT_TIMESTAMP WHERE id = ?").run(id);
    if (!r.changes) return fail(res, 404, 'پیگیری یافت نشد.');
    return ok(res, null, 'پیگیری انجام شد');
  }));

  // بستن (without doing it)
  app.post('/api/followups/:id/close', h((req, res) => {
    const id = Number(req.params.id);
    const r = db.prepare("UPDATE followups SET status = 'بسته شده', outcome = 'بسته شد', closed_at = CURRENT_TIMESTAMP WHERE id = ?").run(id);
    if (!r.changes) return fail(res, 404, 'پیگیری یافت نشد.');
    return ok(res, null, 'پیگیری بسته شد');
  }));

  // پیگیری بعدی: reschedule the same follow-up
  app.post('/api/followups/:id/next', h((req, res) => {
    const id = Number(req.params.id);
    const f = db.prepare('SELECT * FROM followups WHERE id = ?').get(id) as any;
    if (!f) return fail(res, 404, 'پیگیری یافت نشد.');
    const date = normDate(req.body?.date);
    if (!date) return fail(res, 400, 'تاریخ پیگیری بعدی را درست وارد کنید.');
    if (date < getTodayJalali()) return fail(res, 400, 'تاریخ پیگیری بعدی نمی‌تواند در گذشته باشد.');
    const time = str(req.body?.time) ? normTime(req.body.time) : '';
    if (str(req.body?.time) && !time) return fail(res, 400, 'ساعت معتبر نیست.');
    db.prepare("UPDATE followups SET due_date = ?, due_time = ?, status = 'باز', next_followup_date = NULL, next_followup_time = NULL, closed_at = NULL, outcome = NULL WHERE id = ?")
      .run(date, time || null, id);
    return ok(res, followupRows('f.id = ?', [id])[0], 'پیگیری به تاریخ جدید منتقل شد');
  }));

  app.delete('/api/followups/:id', h((req, res) => {
    const r = db.prepare('DELETE FROM followups WHERE id = ?').run(Number(req.params.id));
    if (!r.changes) return fail(res, 404, 'پیگیری یافت نشد.');
    return ok(res, null, 'با موفقیت حذف شد');
  }));

  // ---------- Notifications ----------
  app.get('/api/notifications', h((req, res) => ok(res, buildNotifications(ctx.getAuthUser(req)))));

  // ---------- Global search ----------
  app.get('/api/search', h((req, res) => {
    const q = str(req.query.q);
    if (q.length < 1) return ok(res, { families: [], projects: [], invoices: [], appointments: [] });
    const like = `%${q}%`;
    const families = listFamilies(q).slice(0, 8).map((f) => ({ id: f.id, title: f.display_name, subtitle: [f.father?.first_name, f.mother?.first_name].filter(Boolean).join(' و ') + ` — ${f.phone}` }));
    const projects = db.prepare(`
      SELECT p.id, p.project_code, p.name, cu.last_name FROM projects p JOIN customers cu ON cu.id = p.customer_id
      WHERE p.project_code LIKE ? OR p.name LIKE ? OR cu.last_name LIKE ? OR cu.first_name LIKE ? LIMIT 8
    `).all(like, like, like, like) as any[];
    const invoices = db.prepare(`
      SELECT i.id, i.invoice_number, i.total, i.status, cu.last_name FROM invoices i JOIN customers cu ON cu.id = i.customer_id
      WHERE i.invoice_number LIKE ? OR cu.last_name LIKE ? OR cu.first_name LIKE ? ORDER BY i.id DESC LIMIT 8
    `).all(like, like, like) as any[];
    return ok(res, {
      families,
      projects: projects.map((p) => ({ id: p.id, title: `${p.project_code} — ${p.name}`, subtitle: `خانواده ${p.last_name}` })),
      invoices: invoices.map((i) => ({ id: i.id, title: i.invoice_number, subtitle: `خانواده ${i.last_name} — ${Number(i.total).toLocaleString('fa-IR')} تومان` })),
    });
  }));
}
export { nowTimeHHMM };
