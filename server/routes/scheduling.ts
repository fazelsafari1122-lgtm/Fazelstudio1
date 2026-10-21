import { db } from '../db.ts';
import { getTodayJalali } from '../jalali.ts';
import { Ctx, ok, fail, h, tx, str, num, normDate, normTime, toMinutes, fromMinutes, nowTimeHHMM } from './util.ts';
import { appointmentRows } from './queries.ts';
import { enqueueSms, renderTemplate, customerVars } from '../smsService.ts';
import { insertPayment } from '../finance.ts';

export const SLOT_OPTIONS = [5, 15, 30, 60, 90, 120, 150, 180];
export const APPT_STATUSES = ['رزرو شده', 'انجام شد', 'لغو شده'];

export function effectiveHours(branchId: number) {
  const own = db.prepare('SELECT * FROM working_hours WHERE branch_id = ?').get(branchId) as any;
  if (own) return own;
  return db.prepare('SELECT * FROM working_hours WHERE branch_id = 0').get() as any || { branch_id: 0, start_time: '08:00', end_time: '20:00', slot_minutes: 30 };
}

export function findConflict(hallId: number, date: string, start: string, end: string, excludeId = 0) {
  const rows = db.prepare(`
    SELECT a.id, a.start_time, a.end_time, cu.last_name AS customer_last, cu.first_name AS customer_first
    FROM appointments a JOIN customers cu ON cu.id = a.customer_id
    WHERE a.hall_id = ? AND a.date = ? AND a.status != 'لغو شده' AND a.id != ?
  `).all(hallId, date, excludeId) as any[];
  const s = toMinutes(start); const e = toMinutes(end);
  return rows.find((r) => s < toMinutes(r.end_time) && e > toMinutes(r.start_time)) || null;
}

export function findHoliday(date: string, branchId: number) {
  return db.prepare('SELECT * FROM holidays WHERE date = ? AND (branch_id IS NULL OR branch_id = 0 OR branch_id = ?) LIMIT 1').get(date, branchId) as any;
}

function randomToken() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function now() { return { date: getTodayJalali(), time: nowTimeHHMM() }; }

function pastDeadline(date?: string | null, time?: string | null, n = now()) {
  if (!date) return false;
  if (date < n.date) return true;
  if (date > n.date) return false;
  return (time || '23:59') <= n.time;
}

/** Cancel unpaid-deposit appointments past their deadline and send reminders. */
export async function processDeposits(override?: { date: string; time: string }) {
  const n = override || now();
  const rows = db.prepare(`
    SELECT a.*, cu.phone AS customer_phone, cu.first_name AS cf, cu.last_name AS cl
    FROM appointments a JOIN customers cu ON cu.id = a.customer_id
    WHERE a.deposit_required = 1 AND a.deposit_paid = 0 AND a.status = 'رزرو شده'
  `).all() as any[];
  let cancelled = 0; let reminded = 0;
  for (const a of rows) {
    if (a.reminder_date && !a.reminder_sent && pastDeadline(a.reminder_date, a.reminder_time, n)) {
      const { text } = renderTemplate(a.reminder_text || 'یادآوری پرداخت بیعانه: {{لینک}}', { ...customerVars(a.customer_id), 'لینک': a.payment_link, 'تاریخ': a.date, 'ساعت': a.start_time, 'مبلغ': Number(a.deposit_amount).toLocaleString('fa-IR') });
      enqueueSms({ customer_id: a.customer_id, phone: a.customer_phone, body: text });
      db.prepare('UPDATE appointments SET reminder_sent = 1 WHERE id = ?').run(a.id);
      reminded++;
    }
    if (a.auto_cancel && pastDeadline(a.deposit_deadline_date, a.deposit_deadline_time, n)) {
      db.prepare("UPDATE appointments SET status = 'لغو شده', cancel_reason = ? WHERE id = ?").run('عدم پرداخت بیعانه در موعد مقرر', a.id);
      enqueueSms({
        customer_id: a.customer_id, phone: a.customer_phone,
        body: `${a.cf} عزیز، نوبت شما در تاریخ ${a.date} ساعت ${a.start_time} به دلیل عدم پرداخت بیعانه لغو شد.`,
      });
      cancelled++;
    }
  }
  return { cancelled, reminded };
}

export function registerSchedulingRoutes(app: any, ctx: Ctx) {
  // ---------- Branches & halls ----------
  app.get('/api/branches', h((_req, res) => {
    const branches = db.prepare('SELECT * FROM branches ORDER BY id').all() as any[];
    const halls = db.prepare('SELECT * FROM halls ORDER BY id').all() as any[];
    return ok(res, branches.map((b) => ({ ...b, halls: halls.filter((x) => x.branch_id === b.id) })));
  }));

  app.post('/api/branches', h((req, res) => {
    const name = str(req.body?.name);
    if (!name) return fail(res, 400, 'نام شعبه الزامی است.');
    const r = db.prepare('INSERT INTO branches (name, address, phone, is_active) VALUES (?, ?, ?, ?)')
      .run(name, str(req.body?.address) || null, str(req.body?.phone) || null, req.body?.is_active === 0 ? 0 : 1);
    return ok(res, { id: Number(r.lastInsertRowid) }, 'با موفقیت ثبت شد');
  }));

  app.put('/api/branches/:id', h((req, res) => {
    const name = str(req.body?.name);
    if (!name) return fail(res, 400, 'نام شعبه الزامی است.');
    const r = db.prepare('UPDATE branches SET name = ?, address = ?, phone = ?, is_active = ? WHERE id = ?')
      .run(name, str(req.body?.address) || null, str(req.body?.phone) || null, req.body?.is_active === 0 || req.body?.is_active === false ? 0 : 1, Number(req.params.id));
    if (!r.changes) return fail(res, 404, 'شعبه یافت نشد.');
    return ok(res, null, 'با موفقیت ثبت شد');
  }));

  app.delete('/api/branches/:id', h((req, res) => {
    const id = Number(req.params.id);
    if ((db.prepare('SELECT COUNT(*) AS c FROM appointments WHERE branch_id = ?').get(id) as any).c) {
      return fail(res, 400, 'این شعبه دارای نوبت ثبت‌شده است و قابل حذف نیست. می‌توانید آن را غیرفعال کنید.');
    }
    tx(() => {
      db.prepare('DELETE FROM working_hours WHERE branch_id = ?').run(id);
      db.prepare('DELETE FROM branches WHERE id = ?').run(id);
    });
    return ok(res, null, 'با موفقیت حذف شد');
  }));

  app.post('/api/halls', h((req, res) => {
    const name = str(req.body?.name);
    const branchId = Number(req.body?.branch_id);
    if (!name) return fail(res, 400, 'نام سالن الزامی است.');
    if (!db.prepare('SELECT 1 FROM branches WHERE id = ?').get(branchId)) return fail(res, 400, 'شعبه انتخاب‌شده معتبر نیست.');
    const r = db.prepare('INSERT INTO halls (branch_id, name, capacity, is_active) VALUES (?, ?, ?, 1)').run(branchId, name, num(req.body?.capacity));
    return ok(res, { id: Number(r.lastInsertRowid) }, 'با موفقیت ثبت شد');
  }));

  app.put('/api/halls/:id', h((req, res) => {
    const name = str(req.body?.name);
    if (!name) return fail(res, 400, 'نام سالن الزامی است.');
    const branchId = Number(req.body?.branch_id);
    if (!db.prepare('SELECT 1 FROM branches WHERE id = ?').get(branchId)) return fail(res, 400, 'شعبه انتخاب‌شده معتبر نیست.');
    const r = db.prepare('UPDATE halls SET branch_id = ?, name = ?, capacity = ?, is_active = ? WHERE id = ?')
      .run(branchId, name, num(req.body?.capacity), req.body?.is_active === 0 || req.body?.is_active === false ? 0 : 1, Number(req.params.id));
    if (!r.changes) return fail(res, 404, 'سالن یافت نشد.');
    return ok(res, null, 'با موفقیت ثبت شد');
  }));

  app.delete('/api/halls/:id', h((req, res) => {
    const id = Number(req.params.id);
    if ((db.prepare('SELECT COUNT(*) AS c FROM appointments WHERE hall_id = ?').get(id) as any).c) {
      return fail(res, 400, 'این سالن دارای نوبت ثبت‌شده است و قابل حذف نیست. می‌توانید آن را غیرفعال کنید.');
    }
    db.prepare('DELETE FROM halls WHERE id = ?').run(id);
    return ok(res, null, 'با موفقیت حذف شد');
  }));

  // ---------- Working hours ----------
  app.get('/api/working-hours', h((req, res) => {
    const branchId = Number(req.query.branch_id) || 0;
    return ok(res, { effective: effectiveHours(branchId), all: db.prepare('SELECT * FROM working_hours').all(), slot_options: SLOT_OPTIONS });
  }));

  app.put('/api/working-hours', h((req, res) => {
    const branchId = Number(req.body?.branch_id) || 0;
    const start = normTime(req.body?.start_time);
    const end = normTime(req.body?.end_time);
    const slot = num(req.body?.slot_minutes);
    if (!start || !end) return fail(res, 400, 'ساعت شروع و پایان را درست وارد کنید.');
    if (toMinutes(start) >= toMinutes(end)) return fail(res, 400, 'ساعت شروع باید قبل از ساعت پایان باشد.');
    if (!SLOT_OPTIONS.includes(slot)) return fail(res, 400, 'مدت هر Slot معتبر نیست.');
    if (branchId && !db.prepare('SELECT 1 FROM branches WHERE id = ?').get(branchId)) return fail(res, 400, 'شعبه معتبر نیست.');
    db.prepare(`
      INSERT INTO working_hours (branch_id, start_time, end_time, slot_minutes) VALUES (?, ?, ?, ?)
      ON CONFLICT(branch_id) DO UPDATE SET start_time = excluded.start_time, end_time = excluded.end_time, slot_minutes = excluded.slot_minutes
    `).run(branchId, start, end, slot);
    return ok(res, effectiveHours(branchId), 'با موفقیت ثبت شد');
  }));

  // ---------- Holidays ----------
  app.get('/api/holidays', h((_req, res) => ok(res, db.prepare('SELECT * FROM holidays ORDER BY date').all())));

  app.post('/api/holidays', h((req, res) => {
    const date = normDate(req.body?.date);
    if (!date) return fail(res, 400, 'تاریخ تعطیلی معتبر نیست.');
    const branchId = Number(req.body?.branch_id) || null;
    if (db.prepare('SELECT 1 FROM holidays WHERE date = ? AND COALESCE(branch_id,0) = ?').get(date, branchId || 0)) {
      return fail(res, 409, 'این روز قبلاً به عنوان تعطیل ثبت شده است.');
    }
    const r = db.prepare('INSERT INTO holidays (date, description, branch_id) VALUES (?, ?, ?)').run(date, str(req.body?.description) || null, branchId);
    const affected = (db.prepare("SELECT COUNT(*) AS c FROM appointments WHERE date = ? AND status = 'رزرو شده'").get(date) as any).c;
    return ok(res, { id: Number(r.lastInsertRowid), affected_appointments: affected },
      affected ? `ثبت شد. توجه: ${affected} نوبت فعال در این روز وجود دارد.` : 'با موفقیت ثبت شد');
  }));

  app.delete('/api/holidays/:id', h((req, res) => {
    const r = db.prepare('DELETE FROM holidays WHERE id = ?').run(Number(req.params.id));
    if (!r.changes) return fail(res, 404, 'مورد یافت نشد.');
    return ok(res, null, 'با موفقیت حذف شد');
  }));

  // ---------- Appointments ----------
  app.get('/api/appointments', h((req, res) => {
    const where: string[] = ['1=1']; const params: any[] = [];
    const from = normDate(req.query.from); const to = normDate(req.query.to);
    if (from) { where.push('a.date >= ?'); params.push(from); }
    if (to) { where.push('a.date <= ?'); params.push(to); }
    if (Number(req.query.hall_id)) { where.push('a.hall_id = ?'); params.push(Number(req.query.hall_id)); }
    if (Number(req.query.branch_id)) { where.push('a.branch_id = ?'); params.push(Number(req.query.branch_id)); }
    if (Number(req.query.customer_id)) { where.push('a.customer_id = ?'); params.push(Number(req.query.customer_id)); }
    if (str(req.query.status)) { where.push('a.status = ?'); params.push(str(req.query.status)); }
    return ok(res, appointmentRows(where.join(' AND '), params));
  }));

  function parseAppointment(body: any, excludeId = 0) {
    const customerId = Number(body.customer_id);
    const hallId = Number(body.hall_id);
    const date = normDate(body.date);
    const start = normTime(body.start_time);
    let duration = num(body.duration_minutes);
    if (!customerId || !db.prepare('SELECT 1 FROM customers WHERE id = ?').get(customerId)) return { error: 'مشتری را انتخاب کنید.' };
    const hall = db.prepare('SELECT * FROM halls WHERE id = ?').get(hallId) as any;
    if (!hall) return { error: 'سالن را انتخاب کنید.' };
    if (!hall.is_active) return { error: 'این سالن غیرفعال است.' };
    if (!date) return { error: 'تاریخ نوبت را درست وارد کنید.' };
    if (!start) return { error: 'ساعت شروع را درست وارد کنید.' };
    if (!duration || duration < 5 || duration > 720) return { error: 'مدت نوبت معتبر نیست.' };
    const end = fromMinutes(toMinutes(start) + duration);
    if (toMinutes(start) + duration > 24 * 60) return { error: 'نوبت نمی‌تواند از نیمه‌شب عبور کند.' };
    const hours = effectiveHours(hall.branch_id);
    if (toMinutes(start) < toMinutes(hours.start_time) || toMinutes(end) > toMinutes(hours.end_time)) {
      return { error: `این نوبت خارج از ساعت کاری (${hours.start_time} تا ${hours.end_time}) است.` };
    }
    const holiday = findHoliday(date, hall.branch_id);
    if (holiday && !body.force_holiday) {
      return { error: `این روز تعطیل است${holiday.description ? ` (${holiday.description})` : ''}.`, holiday: true };
    }
    const conflict = findConflict(hallId, date, start, end, excludeId);
    if (conflict) {
      return { error: 'این سالن در این ساعت قبلاً رزرو شده است.', conflict: { ...conflict, customer: `${conflict.customer_first} ${conflict.customer_last}` }, status: 409 };
    }
    const projectId = Number(body.project_id) || null;
    if (projectId && !db.prepare('SELECT 1 FROM projects WHERE id = ?').get(projectId)) return { error: 'پروژه انتخاب‌شده معتبر نیست.' };

    const depositRequired = body.deposit_required ? 1 : 0;
    let depositAmount = 0; let dDate = ''; let dTime = ''; let rDate = ''; let rTime = '';
    if (depositRequired) {
      depositAmount = num(body.deposit_amount);
      if (depositAmount <= 0) return { error: 'مبلغ بیعانه باید بیشتر از صفر باشد.' };
      dDate = normDate(body.deposit_deadline_date); dTime = normTime(body.deposit_deadline_time);
      if (!dDate || !dTime) return { error: 'مهلت پرداخت بیعانه (تاریخ و ساعت) را وارد کنید.' };
      if (!body.accept_terms) return { error: 'تأیید قوانین پرداخت بیعانه الزامی است.' };
      if (str(body.reminder_date)) {
        rDate = normDate(body.reminder_date); rTime = normTime(body.reminder_time);
        if (!rDate || !rTime) return { error: 'زمان یادآوری را درست وارد کنید.' };
      }
    }
    return {
      value: {
        customerId, hallId, branchId: hall.branch_id, date, start, end, duration,
        projectType: str(body.project_type) || null, projectId, notes: str(body.notes) || null,
        depositRequired, depositAmount, dDate, dTime, rDate, rTime,
        depositText: str(body.deposit_sms_text), reminderText: str(body.reminder_text),
        autoCancel: body.auto_cancel ? 1 : 0,
      },
    };
  }

  function onlineEnabled() {
    const v = (db.prepare("SELECT value FROM studio_settings WHERE key = 'online_payment_enabled'").get() as any)?.value;
    return v !== '0';
  }

  app.post('/api/appointments', h((req, res) => {
    const p: any = parseAppointment(req.body || {});
    if (p.error) return fail(res, p.status || 400, p.error, { conflict: p.conflict, holiday: p.holiday });
    const v = p.value;
    if (v.depositRequired && !onlineEnabled()) return fail(res, 400, 'پرداخت آنلاین در تنظیمات غیرفعال است.');
    const id = tx(() => {
      const r = db.prepare(`
        INSERT INTO appointments (customer_id, branch_id, hall_id, date, start_time, end_time, duration_minutes, project_type, project_id, notes,
          deposit_required, deposit_amount, deposit_sms_text, deposit_deadline_date, deposit_deadline_time, auto_cancel,
          reminder_date, reminder_time, reminder_text)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(v.customerId, v.branchId, v.hallId, v.date, v.start, v.end, v.duration, v.projectType, v.projectId, v.notes,
        v.depositRequired, v.depositAmount, v.depositText || null, v.dDate || null, v.dTime || null, v.autoCancel,
        v.rDate || null, v.rTime || null, v.reminderText || null);
      const aid = Number(r.lastInsertRowid);
      if (v.depositRequired) {
        const link = `/pay/${aid}-${randomToken()}`;
        db.prepare('UPDATE appointments SET payment_link = ? WHERE id = ?').run(link, aid);
        const cu = db.prepare('SELECT phone FROM customers WHERE id = ?').get(v.customerId) as any;
        const tpl = v.depositText || 'سلام {{نام}} عزیز، برای قطعی شدن نوبت {{تاریخ}} ساعت {{ساعت}} مبلغ {{مبلغ}} بیعانه را از این لینک پرداخت کنید: {{لینک}}';
        const { text } = renderTemplate(tpl, { ...customerVars(v.customerId), 'تاریخ': v.date, 'ساعت': v.start, 'مبلغ': `${v.depositAmount.toLocaleString('fa-IR')} تومان`, 'لینک': link });
        enqueueSms({ customer_id: v.customerId, phone: cu.phone, body: text });
      }
      return aid;
    });
    const user = ctx.getAuthUser(req);
    ctx.logAudit(user?.id ?? null, user?.full_name ?? 'سیستم', 'ثبت نوبت', 'Appointment', String(id), null, { date: v.date, start: v.start, hall: v.hallId });
    return ok(res, appointmentRows('a.id = ?', [id])[0], 'با موفقیت ثبت شد');
  }));

  app.put('/api/appointments/:id', h((req, res) => {
    const id = Number(req.params.id);
    const old = db.prepare('SELECT * FROM appointments WHERE id = ?').get(id) as any;
    if (!old) return fail(res, 404, 'نوبت یافت نشد.');
    const p: any = parseAppointment(req.body || {}, id);
    if (p.error) return fail(res, p.status || 400, p.error, { conflict: p.conflict, holiday: p.holiday });
    const v = p.value;
    db.prepare(`
      UPDATE appointments SET customer_id = ?, branch_id = ?, hall_id = ?, date = ?, start_time = ?, end_time = ?, duration_minutes = ?,
        project_type = ?, project_id = ?, notes = ? WHERE id = ?
    `).run(v.customerId, v.branchId, v.hallId, v.date, v.start, v.end, v.duration, v.projectType, v.projectId, v.notes, id);
    return ok(res, appointmentRows('a.id = ?', [id])[0], 'با موفقیت ثبت شد');
  }));

  app.put('/api/appointments/:id/status', h((req, res) => {
    const id = Number(req.params.id);
    const status = str(req.body?.status);
    if (!APPT_STATUSES.includes(status)) return fail(res, 400, 'وضعیت معتبر نیست.');
    const a = db.prepare('SELECT * FROM appointments WHERE id = ?').get(id) as any;
    if (!a) return fail(res, 404, 'نوبت یافت نشد.');
    if (a.status === 'لغو شده' && status !== 'لغو شده') {
      const c = findConflict(a.hall_id, a.date, a.start_time, a.end_time, id);
      if (c) return fail(res, 409, 'این سالن در این ساعت قبلاً رزرو شده است.', { conflict: c });
    }
    db.prepare('UPDATE appointments SET status = ?, cancel_reason = ? WHERE id = ?')
      .run(status, status === 'لغو شده' ? (str(req.body?.reason) || 'لغو توسط کاربر') : null, id);
    return ok(res, appointmentRows('a.id = ?', [id])[0], 'با موفقیت ثبت شد');
  }));

  app.delete('/api/appointments/:id', h((req, res) => {
    const r = db.prepare('DELETE FROM appointments WHERE id = ?').run(Number(req.params.id));
    if (!r.changes) return fail(res, 404, 'نوبت یافت نشد.');
    return ok(res, null, 'با موفقیت حذف شد');
  }));

  // Mock online-deposit gateway: marks deposit as paid and records a payment
  app.post('/api/appointments/:id/deposit/pay', h((req, res) => {
    const id = Number(req.params.id);
    const a = db.prepare('SELECT * FROM appointments WHERE id = ?').get(id) as any;
    if (!a || !a.deposit_required) return fail(res, 404, 'بیعانه‌ای برای این نوبت تعریف نشده است.');
    if (a.deposit_paid) return fail(res, 400, 'بیعانه این نوبت قبلاً پرداخت شده است.');
    if (a.status === 'لغو شده') return fail(res, 400, 'این نوبت لغو شده است.');
    tx(() => {
      insertPayment({
        customer_id: a.customer_id, amount: a.deposit_amount, payment_date: getTodayJalali(), payment_time: nowTimeHHMM(),
        payment_method: 'سایر', bank_account: 'درگاه آنلاین', tracking_code: `ONL-${id}-${Date.now().toString().slice(-5)}`,
        description: `بیعانه نوبت ${a.date} ساعت ${a.start_time} (پرداخت آنلاین)`,
      });
      db.prepare('UPDATE appointments SET deposit_paid = 1 WHERE id = ?').run(id);
    });
    return ok(res, appointmentRows('a.id = ?', [id])[0], 'بیعانه با موفقیت ثبت شد');
  }));

  app.post('/api/appointments/process-deposits', h(async (req, res) => {
    const r = await processDeposits(req.body?.date && req.body?.time ? { date: normDate(req.body.date), time: normTime(req.body.time) } : undefined);
    return ok(res, r, 'بررسی بیعانه‌ها انجام شد');
  }));
}
