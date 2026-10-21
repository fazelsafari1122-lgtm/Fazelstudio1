import { db } from '../db.ts';
import { getTodayJalali } from '../jalali.ts';
import { Ctx, ok, fail, h, str, normDate, normTime, normPhone } from './util.ts';
import { enqueueSms, processQueue, renderTemplate, customerVars, sendOne, SMS_PENDING, SMS_SENT, SMS_FAILED, SMS_SENDING } from '../smsService.ts';
import { isValidMobile } from '../smsGateway.ts';

export const SMS_VARIABLES = ['نام', 'نام_خانوادگی', 'تاریخ', 'ساعت', 'مبلغ', 'مانده', 'لینک'];

function smsRows(where: string, params: any[] = [], limit = 500) {
  return db.prepare(`
    SELECT s.*, cu.first_name AS customer_first, cu.last_name AS customer_last
    FROM sms_messages s LEFT JOIN customers cu ON cu.id = s.customer_id
    WHERE ${where} ORDER BY s.id DESC LIMIT ${limit}
  `).all(...params) as any[];
}

export function registerSmsRoutes(app: any, ctx: Ctx) {
  app.get('/api/sms/variables', h((_req, res) => ok(res, SMS_VARIABLES)));

  // Templates CRUD (GET stays in server.ts for {templates, logs} shape)
  app.get('/api/sms/template-list', h((_req, res) => ok(res, db.prepare('SELECT * FROM sms_templates ORDER BY id').all())));

  app.post('/api/sms/templates', h((req, res) => {
    const name = str(req.body?.name); const content = str(req.body?.content);
    if (!name) return fail(res, 400, 'عنوان قالب الزامی است.');
    if (!content) return fail(res, 400, 'متن قالب الزامی است.');
    const r = db.prepare('INSERT INTO sms_templates (name, content, variables_json) VALUES (?, ?, ?)').run(name, content, JSON.stringify(SMS_VARIABLES));
    return ok(res, { id: Number(r.lastInsertRowid) }, 'با موفقیت ثبت شد');
  }));

  app.put('/api/sms/templates/:id', h((req, res) => {
    const name = str(req.body?.name); const content = str(req.body?.content);
    if (!name || !content) return fail(res, 400, 'عنوان و متن قالب الزامی است.');
    const r = db.prepare('UPDATE sms_templates SET name = ?, content = ? WHERE id = ?').run(name, content, Number(req.params.id));
    if (!r.changes) return fail(res, 404, 'قالب یافت نشد.');
    return ok(res, null, 'با موفقیت ثبت شد');
  }));

  app.delete('/api/sms/templates/:id', h((req, res) => {
    const r = db.prepare('DELETE FROM sms_templates WHERE id = ?').run(Number(req.params.id));
    if (!r.changes) return fail(res, 404, 'قالب یافت نشد.');
    return ok(res, null, 'با موفقیت حذف شد');
  }));

  function compose(b: any, customerId: number | null) {
    let body = str(b.message_body);
    if (b.template_id) {
      const tpl = db.prepare('SELECT content FROM sms_templates WHERE id = ?').get(Number(b.template_id)) as any;
      if (!tpl) return { error: 'قالب انتخاب‌شده یافت نشد.' };
      if (!body) body = tpl.content;
    }
    if (!body) return { error: 'متن پیام الزامی است.' };
    const vars: Record<string, any> = { 'تاریخ': getTodayJalali(), ...customerVars(customerId), ...(b.variables && typeof b.variables === 'object' ? b.variables : {}) };
    const r = renderTemplate(body, vars);
    if (r.missing.length) return { error: `مقدار متغیر ${r.missing.map((m) => `{{${m}}}`).join('، ')} مشخص نیست.` };
    return { text: r.text };
  }

  function schedule(b: any) {
    const d = str(b.scheduled_date) ? normDate(b.scheduled_date) : '';
    const t = str(b.scheduled_time) ? normTime(b.scheduled_time) : '';
    if (str(b.scheduled_date) && !d) return { error: 'تاریخ ارسال معتبر نیست.' };
    if (str(b.scheduled_time) && !t) return { error: 'ساعت ارسال معتبر نیست.' };
    return { d: d || null, t: t || null };
  }

  app.post('/api/sms/send', h(async (req, res) => {
    const b = req.body || {};
    const customerId = Number(b.customer_id) || null;
    let phone = normPhone(b.phone);
    if (!phone && customerId) phone = (db.prepare('SELECT phone FROM customers WHERE id = ?').get(customerId) as any)?.phone || '';
    if (!phone) return fail(res, 400, 'شماره گیرنده الزامی است.');
    if (!isValidMobile(phone)) return fail(res, 400, 'شماره موبایل گیرنده معتبر نیست.');
    const c: any = compose(b, customerId);
    if (c.error) return fail(res, 400, c.error);
    const s: any = schedule(b);
    if (s.error) return fail(res, 400, s.error);
    const id = enqueueSms({ customer_id: customerId, phone, body: c.text, template_id: Number(b.template_id) || null, scheduled_date: s.d, scheduled_time: s.t });
    if (!b.queue_only) await processQueue([id]);
    const row = smsRows('s.id = ?', [id])[0];
    const msg = row.status === SMS_SENT ? 'پیامک با موفقیت ارسال شد.' : row.status === SMS_FAILED ? 'ارسال پیامک ناموفق بود.' : 'پیامک در صف ارسال قرار گرفت.';
    return ok(res, row, msg);
  }));

  // Same message personalised for several families
  app.post('/api/sms/send-bulk', h(async (req, res) => {
    const ids: number[] = (Array.isArray(req.body?.customer_ids) ? req.body.customer_ids : []).map(Number).filter(Boolean);
    if (!ids.length) return fail(res, 400, 'حداقل یک گیرنده را انتخاب کنید.');
    const s: any = schedule(req.body || {});
    if (s.error) return fail(res, 400, s.error);
    const created: number[] = []; const errors: string[] = [];
    for (const cid of ids) {
      const cu = db.prepare('SELECT phone, last_name FROM customers WHERE id = ?').get(cid) as any;
      if (!cu) continue;
      if (!isValidMobile(cu.phone)) { errors.push(`شماره خانواده ${cu.last_name} معتبر نیست`); continue; }
      const c: any = compose(req.body, cid);
      if (c.error) return fail(res, 400, c.error);
      created.push(enqueueSms({ customer_id: cid, phone: cu.phone, body: c.text, template_id: Number(req.body?.template_id) || null, scheduled_date: s.d, scheduled_time: s.t }));
    }
    if (!req.body?.queue_only) await processQueue(created);
    return ok(res, { created: created.length, errors }, `${created.length} پیامک ثبت شد.`);
  }));

  app.get('/api/sms/queue', h((_req, res) =>
    ok(res, smsRows(`s.status IN (?, ?, ?)`, [SMS_PENDING, SMS_SENDING, SMS_FAILED]))));

  app.get('/api/sms/sent', h((req, res) => {
    const where = ['s.status = ?']; const params: any[] = [SMS_SENT];
    const from = normDate(req.query.from); const to = normDate(req.query.to);
    if (from) { where.push('s.sent_date >= ?'); params.push(from); }
    if (to) { where.push('s.sent_date <= ?'); params.push(to); }
    let rows = smsRows(where.join(' AND '), params);
    const q = str(req.query.q).toLowerCase();
    if (q) rows = rows.filter((r) => [r.phone, r.message_body, r.customer_first, r.customer_last].join(' ').toLowerCase().includes(q));
    return ok(res, rows);
  }));

  app.post('/api/sms/queue/process', h(async (_req, res) => {
    const r = await processQueue();
    return ok(res, r, `${r.sent} پیامک ارسال شد${r.failed ? `، ${r.failed} خطا` : ''}${r.waiting ? `، ${r.waiting} در انتظار زمان‌بندی` : ''}.`);
  }));

  app.post('/api/sms/:id/retry', h(async (req, res) => {
    const id = Number(req.params.id);
    const row = db.prepare('SELECT * FROM sms_messages WHERE id = ?').get(id) as any;
    if (!row) return fail(res, 404, 'پیام یافت نشد.');
    if (row.status === SMS_SENT) return fail(res, 400, 'این پیام قبلاً ارسال شده است.');
    const r = await sendOne(id);
    return r?.ok ? ok(res, r, 'پیامک با موفقیت ارسال شد.') : fail(res, 400, `ارسال ناموفق بود: ${r?.response || ''}`);
  }));

  app.delete('/api/sms/:id', h((req, res) => {
    const id = Number(req.params.id);
    const row = db.prepare('SELECT status FROM sms_messages WHERE id = ?').get(id) as any;
    if (!row) return fail(res, 404, 'پیام یافت نشد.');
    if (row.status === SMS_SENT) return fail(res, 400, 'پیام ارسال‌شده از تاریخچه حذف نمی‌شود.');
    db.prepare('DELETE FROM sms_messages WHERE id = ?').run(id);
    return ok(res, null, 'با موفقیت حذف شد');
  }));
}
