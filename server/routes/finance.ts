import { db } from '../db.ts';
import { getTodayJalali } from '../jalali.ts';
import { insertPayment, removePayment, syncInvoiceBalance } from '../finance.ts';
import { Ctx, ok, fail, h, tx, str, num, normDate, normTime, nowTimeHHMM } from './util.ts';

export const CHEQUE_STATUSES = ['دریافت شده', 'در انتظار وصول', 'وصول شده', 'برگشتی'];

function nextInvoiceNumber() {
  let n = (db.prepare('SELECT COALESCE(MAX(id),0) + 1 AS n FROM invoices').get() as any).n as number;
  for (;;) {
    const code = `INV-${String(n).padStart(5, '0')}`;
    if (!db.prepare('SELECT 1 FROM invoices WHERE invoice_number = ?').get(code)) return code;
    n++;
  }
}

/** Validates a payment target and amount against the remaining balance. */
export function resolvePaymentTarget(b: any) {
  let customerId = Number(b.customer_id) || null;
  let contractId = Number(b.contract_id) || null;
  let invoiceId = Number(b.invoice_id) || null;
  if (contractId && !customerId) customerId = (db.prepare('SELECT customer_id FROM contracts WHERE id = ?').get(contractId) as any)?.customer_id ?? null;
  if (invoiceId) {
    const inv = db.prepare('SELECT customer_id, contract_id FROM invoices WHERE id = ?').get(invoiceId) as any;
    if (!inv) return { error: 'فاکتور مورد نظر یافت نشد.', status: 404 };
    if (!customerId) customerId = inv.customer_id;
    if (!contractId && inv.contract_id) contractId = inv.contract_id;
  }
  if (!customerId || !db.prepare('SELECT 1 FROM customers WHERE id = ?').get(customerId)) return { error: 'مشتری، قرارداد یا فاکتور مشخص نشده است.', status: 400 };
  const amount = num(b.amount);
  if (amount <= 0) return { error: 'مبلغ پرداختی باید بیشتر از صفر باشد.', status: 400 };

  if (contractId) {
    const ct = db.prepare('SELECT final_amount FROM contracts WHERE id = ?').get(contractId) as any;
    if (!ct) return { error: 'قرارداد مورد نظر یافت نشد.', status: 404 };
    const paid = Number((db.prepare('SELECT COALESCE(SUM(amount),0) AS t FROM payments WHERE contract_id = ?').get(contractId) as any).t);
    if (amount > Math.max(0, ct.final_amount - paid)) return { error: 'مبلغ پرداختی نمی‌تواند بیشتر از مانده قرارداد باشد.', status: 400 };
    if (!invoiceId) invoiceId = (db.prepare('SELECT id FROM invoices WHERE contract_id = ? LIMIT 1').get(contractId) as any)?.id ?? null;
  } else if (invoiceId) {
    const inv = db.prepare('SELECT total, status FROM invoices WHERE id = ?').get(invoiceId) as any;
    if (inv.status === 'cancelled') return { error: 'این فاکتور لغو شده است.', status: 400 };
    const paid = Number((db.prepare('SELECT COALESCE(SUM(amount),0) AS t FROM payments WHERE invoice_id = ?').get(invoiceId) as any).t);
    if (amount > Math.max(0, inv.total - paid)) return { error: 'مبلغ پرداختی نمی‌تواند بیشتر از مانده فاکتور باشد.', status: 400 };
  }
  return { customerId, contractId, invoiceId, amount };
}

function readCheque(c: any) {
  const number = str(c?.cheque_number);
  if (!number) return { error: 'شماره چک الزامی است.' };
  const due = normDate(c?.due_date);
  if (!due) return { error: 'تاریخ سررسید چک را درست وارد کنید.' };
  const status = str(c?.status) || 'دریافت شده';
  if (!CHEQUE_STATUSES.includes(status)) return { error: 'وضعیت چک معتبر نیست.' };
  return { value: { number, bank: str(c?.bank) || null, due, status, notes: str(c?.notes) || null } };
}

export function chequeRows(where = '1=1', params: any[] = []) {
  return db.prepare(`
    SELECT c.*, cu.first_name AS customer_first, cu.last_name AS customer_last
    FROM cheques c JOIN customers cu ON cu.id = c.customer_id WHERE ${where} ORDER BY c.due_date, c.id
  `).all(...params) as any[];
}

export function registerFinanceRoutes(app: any, ctx: Ctx) {
  // ---------- Invoices (standalone) ----------
  function readInvoice(b: any) {
    const customerId = Number(b.customer_id);
    if (!customerId || !db.prepare('SELECT 1 FROM customers WHERE id = ?').get(customerId)) return { error: 'مشتری را انتخاب کنید.' };
    const items = (Array.isArray(b.items) ? b.items : []).map((i: any) => ({ name: str(i.name), quantity: num(i.quantity) || 0, unit_price: num(i.unit_price) })).filter((i: any) => i.name);
    if (!items.length) return { error: 'حداقل یک آیتم برای فاکتور لازم است.' };
    for (const i of items) {
      if (i.quantity <= 0) return { error: 'تعداد هر آیتم باید بیشتر از صفر باشد.' };
      if (i.unit_price < 0) return { error: 'قیمت آیتم نمی‌تواند منفی باشد.' };
    }
    const issue = normDate(b.issue_date) || getTodayJalali();
    const due = str(b.due_date) ? normDate(b.due_date) : '';
    if (str(b.due_date) && !due) return { error: 'تاریخ سررسید معتبر نیست.' };
    const subtotal = items.reduce((s: number, i: any) => s + i.quantity * i.unit_price, 0);
    const discount = num(b.discount);
    const extra = num(b.extra_costs);
    if (discount < 0 || extra < 0) return { error: 'تخفیف و هزینه اضافه نمی‌توانند منفی باشند.' };
    const taxBase = Math.max(0, subtotal - discount + extra);
    const taxPercent = Number(b.tax_percent) || 0;
    if (taxPercent < 0 || taxPercent > 100) return { error: 'درصد مالیات معتبر نیست.' };
    const tax = taxPercent ? Math.round((taxBase * taxPercent) / 100) : num(b.tax);
    const total = subtotal - discount + extra + tax;
    if (total < 0) return { error: 'تخفیف نمی‌تواند از مجموع فاکتور بیشتر باشد.' };
    const projectId = Number(b.project_id) || null;
    if (projectId && !db.prepare('SELECT 1 FROM projects WHERE id = ?').get(projectId)) return { error: 'پروژه انتخاب‌شده معتبر نیست.' };
    return { value: { customerId, items, issue, due: due || null, subtotal, discount, extra, tax, total, projectId, notes: str(b.notes) || null } };
  }

  app.post('/api/invoices', h((req, res) => {
    const p: any = readInvoice(req.body || {});
    if (p.error) return fail(res, 400, p.error);
    const v = p.value;
    const id = tx(() => {
      const r = db.prepare(`
        INSERT INTO invoices (invoice_number, customer_id, project_id, issue_date, due_date, subtotal, discount, tax, extra_costs, total, paid_amount, remaining_amount, status, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 'unpaid', ?)
      `).run(nextInvoiceNumber(), v.customerId, v.projectId, v.issue, v.due, v.subtotal, v.discount, v.tax, v.extra, v.total, v.total, v.notes);
      const iid = Number(r.lastInsertRowid);
      const ins = db.prepare('INSERT INTO invoice_items (invoice_id, name, quantity, unit_price, total_price) VALUES (?, ?, ?, ?, ?)');
      for (const i of v.items) ins.run(iid, i.name, i.quantity, i.unit_price, i.quantity * i.unit_price);
      if (v.total === 0) db.prepare("UPDATE invoices SET status = 'paid' WHERE id = ?").run(iid);
      return iid;
    });
    const user = ctx.getAuthUser(req);
    ctx.logAudit(user?.id ?? null, user?.full_name ?? 'سیستم', 'صدور فاکتور', 'Invoice', String(id), null, { total: v.total });
    return ok(res, db.prepare('SELECT * FROM invoices WHERE id = ?').get(id), 'با موفقیت ثبت شد');
  }));

  app.put('/api/invoices/:id', h((req, res) => {
    const id = Number(req.params.id);
    const inv = db.prepare('SELECT * FROM invoices WHERE id = ?').get(id) as any;
    if (!inv) return fail(res, 404, 'فاکتور یافت نشد.');
    if (inv.contract_id) return fail(res, 400, 'فاکتور مربوط به قرارداد است و از بخش قرارداد قابل ویرایش می‌باشد.');
    const p: any = readInvoice(req.body || {});
    if (p.error) return fail(res, 400, p.error);
    const v = p.value;
    const paid = Number((db.prepare('SELECT COALESCE(SUM(amount),0) AS t FROM payments WHERE invoice_id = ?').get(id) as any).t);
    if (v.total < paid) return fail(res, 400, 'مبلغ نهایی نمی‌تواند کمتر از مجموع پرداخت‌های ثبت‌شده باشد.');
    tx(() => {
      db.prepare(`
        UPDATE invoices SET customer_id = ?, project_id = ?, issue_date = ?, due_date = ?, subtotal = ?, discount = ?, tax = ?, extra_costs = ?, total = ?, notes = ? WHERE id = ?
      `).run(v.customerId, v.projectId, v.issue, v.due, v.subtotal, v.discount, v.tax, v.extra, v.total, v.notes, id);
      db.prepare('DELETE FROM invoice_items WHERE invoice_id = ?').run(id);
      const ins = db.prepare('INSERT INTO invoice_items (invoice_id, name, quantity, unit_price, total_price) VALUES (?, ?, ?, ?, ?)');
      for (const i of v.items) ins.run(id, i.name, i.quantity, i.unit_price, i.quantity * i.unit_price);
      syncInvoiceBalance(id);
    });
    return ok(res, db.prepare('SELECT * FROM invoices WHERE id = ?').get(id), 'با موفقیت ثبت شد');
  }));

  app.post('/api/invoices/:id/cancel', h((req, res) => {
    const id = Number(req.params.id);
    const inv = db.prepare('SELECT * FROM invoices WHERE id = ?').get(id) as any;
    if (!inv) return fail(res, 404, 'فاکتور یافت نشد.');
    if (inv.contract_id) return fail(res, 400, 'فاکتور مربوط به قرارداد است.');
    db.prepare("UPDATE invoices SET status = 'cancelled' WHERE id = ?").run(id);
    return ok(res, null, 'فاکتور لغو شد');
  }));

  app.delete('/api/invoices/:id', h((req, res) => {
    const id = Number(req.params.id);
    const inv = db.prepare('SELECT * FROM invoices WHERE id = ?').get(id) as any;
    if (!inv) return fail(res, 404, 'فاکتور یافت نشد.');
    if (inv.contract_id) return fail(res, 400, 'فاکتور مربوط به قرارداد است و قابل حذف نیست.');
    if ((db.prepare('SELECT COUNT(*) AS c FROM payments WHERE invoice_id = ?').get(id) as any).c) {
      return fail(res, 400, 'برای این فاکتور پرداخت ثبت شده است. ابتدا پرداخت‌ها را حذف کنید یا فاکتور را لغو نمایید.');
    }
    tx(() => {
      db.prepare('DELETE FROM invoice_items WHERE invoice_id = ?').run(id);
      db.prepare('DELETE FROM invoices WHERE id = ?').run(id);
    });
    return ok(res, null, 'با موفقیت حذف شد');
  }));

  // ---------- Payments (override: bank/time/cheque) ----------
  app.post('/api/payments', h((req, res) => {
    const b = req.body || {};
    const t: any = resolvePaymentTarget(b);
    if (t.error) return fail(res, t.status, t.error);
    const method = str(b.payment_method) || 'نقدی';
    const date = str(b.payment_date) ? normDate(b.payment_date) : getTodayJalali();
    if (!date) return fail(res, 400, 'تاریخ پرداخت را درست وارد کنید.');
    const time = str(b.payment_time) ? normTime(b.payment_time) : nowTimeHHMM();
    if (!time) return fail(res, 400, 'ساعت پرداخت معتبر نیست.');
    let cheque: any = null;
    if (method === 'چک') {
      cheque = readCheque(b.cheque);
      if (cheque.error) return fail(res, 400, cheque.error);
    }
    const user = ctx.getAuthUser(req);
    const result = tx(() => {
      const pid = insertPayment({
        customer_id: t.customerId, amount: t.amount, payment_date: date, payment_time: time, payment_method: method,
        bank_account: str(b.bank_account) || null, tracking_code: str(b.tracking_code) || null,
        receiver_name: str(b.receiver_name) || user?.full_name || 'مدیریت استودیو', description: str(b.description) || null,
        invoice_id: t.invoiceId, contract_id: t.contractId,
      });
      if (cheque) {
        const c = cheque.value;
        db.prepare('INSERT INTO cheques (payment_id, customer_id, cheque_number, bank, due_date, amount, status, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
          .run(pid, t.customerId, c.number, c.bank || str(b.bank_account) || null, c.due, t.amount, c.status === 'برگشتی' ? 'دریافت شده' : c.status, c.notes);
      }
      return pid;
    });
    ctx.logAudit(user?.id ?? null, user?.full_name ?? 'سیستم', 'ثبت پرداخت', 'Payment', String(result), null, { amount: t.amount, method });
    return ok(res, { paymentId: result, amount: t.amount, paymentDate: date }, 'پرداخت با موفقیت ثبت شد.');
  }));

  app.delete('/api/payments/:id', h((req, res) => {
    const id = Number(req.params.id);
    const pay = db.prepare('SELECT * FROM payments WHERE id = ?').get(id) as any;
    if (!pay) return fail(res, 404, 'پرداخت مورد نظر یافت نشد.');
    tx(() => {
      db.prepare('DELETE FROM cheques WHERE payment_id = ?').run(id);
      removePayment(id);
    });
    const user = ctx.getAuthUser(req);
    ctx.logAudit(user?.id ?? null, user?.full_name ?? 'سیستم', 'حذف تراکنش پرداختی', 'Payment', String(id), pay, null);
    return ok(res, null, 'تراکنش پرداختی حذف شد و مانده حساب‌ها بروزرسانی گردید.');
  }));

  // ---------- Cheques ----------
  app.get('/api/cheques', h((req, res) => {
    const where: string[] = ['1=1']; const params: any[] = [];
    if (str(req.query.status)) { where.push('c.status = ?'); params.push(str(req.query.status)); }
    if (Number(req.query.customer_id)) { where.push('c.customer_id = ?'); params.push(Number(req.query.customer_id)); }
    const today = getTodayJalali();
    return ok(res, chequeRows(where.join(' AND '), params).map((c) => ({ ...c, overdue: ['دریافت شده', 'در انتظار وصول'].includes(c.status) && c.due_date < today })));
  }));

  app.post('/api/cheques', h((req, res) => {
    const b = req.body || {};
    const t: any = resolvePaymentTarget(b);
    if (t.error) return fail(res, t.status, t.error);
    const c: any = readCheque(b);
    if (c.error) return fail(res, 400, c.error);
    if (c.value.status === 'برگشتی') return fail(res, 400, 'چک جدید نمی‌تواند با وضعیت برگشتی ثبت شود.');
    const user = ctx.getAuthUser(req);
    const id = tx(() => {
      const pid = insertPayment({
        customer_id: t.customerId, amount: t.amount, payment_date: normDate(b.payment_date) || getTodayJalali(), payment_time: nowTimeHHMM(),
        payment_method: 'چک', bank_account: c.value.bank, tracking_code: c.value.number, receiver_name: user?.full_name,
        description: `دریافت چک ${c.value.number}`, invoice_id: t.invoiceId, contract_id: t.contractId,
      });
      const r = db.prepare('INSERT INTO cheques (payment_id, customer_id, cheque_number, bank, due_date, amount, status, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        .run(pid, t.customerId, c.value.number, c.value.bank, c.value.due, t.amount, c.value.status, c.value.notes);
      return Number(r.lastInsertRowid);
    });
    return ok(res, chequeRows('c.id = ?', [id])[0], 'با موفقیت ثبت شد');
  }));

  app.put('/api/cheques/:id', h((req, res) => {
    const id = Number(req.params.id);
    const cur = db.prepare('SELECT * FROM cheques WHERE id = ?').get(id) as any;
    if (!cur) return fail(res, 404, 'چک یافت نشد.');
    const status = str(req.body?.status) || cur.status;
    if (!CHEQUE_STATUSES.includes(status)) return fail(res, 400, 'وضعیت چک معتبر نیست.');
    if (cur.status === 'برگشتی' && status !== 'برگشتی') return fail(res, 400, 'چک برگشتی قابل بازگشت به وضعیت قبل نیست. پرداخت جدید ثبت کنید.');
    const due = str(req.body?.due_date) ? normDate(req.body.due_date) : cur.due_date;
    if (!due) return fail(res, 400, 'تاریخ سررسید معتبر نیست.');
    tx(() => {
      db.prepare('UPDATE cheques SET status = ?, due_date = ?, bank = ?, notes = ? WHERE id = ?')
        .run(status, due, req.body?.bank !== undefined ? (str(req.body.bank) || null) : cur.bank, req.body?.notes !== undefined ? (str(req.body.notes) || null) : cur.notes, id);
      if (status === 'برگشتی' && cur.status !== 'برگشتی') {
        // Bounced cheque: reverse the payment so invoice balance and customer debt come back
        if (cur.payment_id) removePayment(cur.payment_id);
        db.prepare('UPDATE cheques SET payment_id = NULL WHERE id = ?').run(id);
        db.prepare(`
          INSERT INTO followups (customer_id, title, description, due_date, priority, status)
          VALUES (?, ?, ?, ?, 'فوری', 'باز')
        `).run(cur.customer_id, `پیگیری چک برگشتی ${cur.cheque_number}`, `مبلغ ${Number(cur.amount).toLocaleString('fa-IR')} تومان به حساب برگشت داده شد.`, getTodayJalali());
      }
    });
    return ok(res, chequeRows('c.id = ?', [id])[0], status === 'برگشتی' ? 'چک برگشت خورد؛ مبلغ از پرداخت‌ها کسر و پیگیری ثبت شد.' : 'با موفقیت ثبت شد');
  }));

  app.delete('/api/cheques/:id', h((req, res) => {
    const id = Number(req.params.id);
    const cur = db.prepare('SELECT * FROM cheques WHERE id = ?').get(id) as any;
    if (!cur) return fail(res, 404, 'چک یافت نشد.');
    tx(() => {
      db.prepare('DELETE FROM cheques WHERE id = ?').run(id);
      if (cur.payment_id) removePayment(cur.payment_id);
    });
    return ok(res, null, 'با موفقیت حذف شد');
  }));

  // ---------- Products ----------
  app.get('/api/products', h((_req, res) => {
    const rows = db.prepare('SELECT * FROM products ORDER BY id DESC').all() as any[];
    return ok(res, rows.map((p) => ({ ...p, low_stock: p.stock <= p.min_stock })));
  }));

  function readProduct(b: any) {
    const name = str(b.name);
    if (!name) return { error: 'نام کالا الزامی است.' };
    const stock = num(b.stock); const buy = num(b.purchase_price); const sell = num(b.sale_price); const min = num(b.min_stock);
    if ([stock, buy, sell, min].some((n) => n < 0)) return { error: 'مقادیر عددی نمی‌توانند منفی باشند.' };
    return { value: { name, category: str(b.category) || null, stock, buy, sell, min, notes: str(b.notes) || null } };
  }

  app.post('/api/products', h((req, res) => {
    const p: any = readProduct(req.body || {});
    if (p.error) return fail(res, 400, p.error);
    const v = p.value;
    const id = tx(() => {
      const r = db.prepare('INSERT INTO products (name, category, stock, purchase_price, sale_price, min_stock, notes) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(v.name, v.category, v.stock, v.buy, v.sell, v.min, v.notes);
      const pid = Number(r.lastInsertRowid);
      if (v.stock > 0) db.prepare('INSERT INTO stock_moves (product_id, delta, reason, move_date) VALUES (?, ?, ?, ?)').run(pid, v.stock, 'موجودی اولیه', getTodayJalali());
      return pid;
    });
    return ok(res, { id }, 'با موفقیت ثبت شد');
  }));

  app.put('/api/products/:id', h((req, res) => {
    const id = Number(req.params.id);
    const cur = db.prepare('SELECT * FROM products WHERE id = ?').get(id) as any;
    if (!cur) return fail(res, 404, 'کالا یافت نشد.');
    const p: any = readProduct({ ...req.body, stock: cur.stock });
    if (p.error) return fail(res, 400, p.error);
    const v = p.value;
    db.prepare('UPDATE products SET name = ?, category = ?, purchase_price = ?, sale_price = ?, min_stock = ?, notes = ? WHERE id = ?')
      .run(v.name, v.category, v.buy, v.sell, v.min, v.notes, id);
    return ok(res, null, 'با موفقیت ثبت شد');
  }));

  app.post('/api/products/:id/stock', h((req, res) => {
    const id = Number(req.params.id);
    const cur = db.prepare('SELECT * FROM products WHERE id = ?').get(id) as any;
    if (!cur) return fail(res, 404, 'کالا یافت نشد.');
    const delta = num(req.body?.delta);
    if (!delta) return fail(res, 400, 'مقدار تغییر موجودی را وارد کنید.');
    if (cur.stock + delta < 0) return fail(res, 400, `موجودی کافی نیست. موجودی فعلی: ${cur.stock}`);
    tx(() => {
      db.prepare('UPDATE products SET stock = stock + ? WHERE id = ?').run(delta, id);
      db.prepare('INSERT INTO stock_moves (product_id, delta, reason, move_date) VALUES (?, ?, ?, ?)').run(id, delta, str(req.body?.reason) || (delta > 0 ? 'افزایش موجودی' : 'کاهش موجودی'), getTodayJalali());
    });
    return ok(res, { stock: cur.stock + delta }, 'با موفقیت ثبت شد');
  }));

  app.get('/api/products/:id/moves', h((req, res) =>
    ok(res, db.prepare('SELECT * FROM stock_moves WHERE product_id = ? ORDER BY id DESC LIMIT 100').all(Number(req.params.id)))));

  app.delete('/api/products/:id', h((req, res) => {
    const r = db.prepare('DELETE FROM products WHERE id = ?').run(Number(req.params.id));
    if (!r.changes) return fail(res, 404, 'کالا یافت نشد.');
    return ok(res, null, 'با موفقیت حذف شد');
  }));

  // ---------- Expenses (override POST, add PUT/DELETE) ----------
  function readExpense(b: any) {
    const title = str(b.title);
    if (!title) return { error: 'عنوان هزینه الزامی است.' };
    const amount = num(b.amount);
    if (amount <= 0) return { error: 'مبلغ هزینه باید بیشتر از صفر باشد.' };
    const date = str(b.expense_date) ? normDate(b.expense_date) : getTodayJalali();
    if (!date) return { error: 'تاریخ هزینه را درست وارد کنید.' };
    const category = str(b.category);
    if (!category) return { error: 'دسته‌بندی هزینه را انتخاب کنید.' };
    return { value: { title, amount, date, category, method: str(b.payment_method) || 'نقدی', payer: str(b.payer) || null, receiver: str(b.receiver) || null, description: str(b.description) || null } };
  }

  app.post('/api/accounting/expenses', h((req, res) => {
    const p: any = readExpense(req.body || {});
    if (p.error) return fail(res, 400, p.error);
    const v = p.value;
    const user = ctx.getAuthUser(req);
    const r = db.prepare('INSERT INTO expenses (title, category, amount, expense_date, payment_method, receiver, description, payer, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(v.title, v.category, v.amount, v.date, v.method, v.receiver, v.description, v.payer, user?.full_name ?? null);
    return ok(res, { id: Number(r.lastInsertRowid) }, 'با موفقیت ثبت شد');
  }));

  app.put('/api/accounting/expenses/:id', h((req, res) => {
    const id = Number(req.params.id);
    if (!db.prepare('SELECT 1 FROM expenses WHERE id = ?').get(id)) return fail(res, 404, 'هزینه یافت نشد.');
    const p: any = readExpense(req.body || {});
    if (p.error) return fail(res, 400, p.error);
    const v = p.value;
    db.prepare('UPDATE expenses SET title = ?, category = ?, amount = ?, expense_date = ?, payment_method = ?, receiver = ?, description = ?, payer = ? WHERE id = ?')
      .run(v.title, v.category, v.amount, v.date, v.method, v.receiver, v.description, v.payer, id);
    return ok(res, null, 'با موفقیت ثبت شد');
  }));

  app.delete('/api/accounting/expenses/:id', h((req, res) => {
    const r = db.prepare('DELETE FROM expenses WHERE id = ?').run(Number(req.params.id));
    if (!r.changes) return fail(res, 404, 'هزینه یافت نشد.');
    return ok(res, null, 'با موفقیت حذف شد');
  }));
}
