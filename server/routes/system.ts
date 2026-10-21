import { db, hashPassword } from '../db.ts';
import { Ctx, ok, fail, h, str, num } from './util.ts';
import { SLOT_OPTIONS } from './scheduling.ts';

export const LOOKUP_KINDS = ['project_type', 'expense_category', 'payment_method', 'product_category', 'bank'];

export function permissionsFor(role: string): string[] {
  const r = db.prepare('SELECT permissions_json FROM roles WHERE name = ?').get(role) as any;
  if (!r) return ['view'];
  try { return JSON.parse(r.permissions_json); } catch { return ['view']; }
}

export function registerSystemRoutes(app: any, ctx: Ctx) {
  // One call that feeds every dropdown in the UI
  app.get('/api/meta', h((_req, res) => {
    const lookups: Record<string, string[]> = {};
    for (const k of LOOKUP_KINDS) lookups[k] = (db.prepare('SELECT name FROM lookups WHERE kind = ? ORDER BY sort_order, id').all(k) as any[]).map((r) => r.name);
    const branches = db.prepare('SELECT * FROM branches WHERE is_active = 1 ORDER BY id').all() as any[];
    const halls = db.prepare('SELECT * FROM halls WHERE is_active = 1 ORDER BY id').all() as any[];
    return ok(res, {
      lookups,
      stages: db.prepare('SELECT * FROM project_stages ORDER BY sort_order, id').all(),
      branches: branches.map((b) => ({ ...b, halls: halls.filter((x) => x.branch_id === b.id) })),
      tags: db.prepare('SELECT * FROM tags ORDER BY name').all(),
      services: db.prepare('SELECT id, name, category, price FROM services WHERE is_active = 1 ORDER BY name').all(),
      packages: db.prepare('SELECT * FROM packages WHERE is_active = 1 ORDER BY name').all(),
      team: db.prepare("SELECT id, full_name, role FROM team_members WHERE status = 'active' ORDER BY full_name").all(),
      users: db.prepare("SELECT id, full_name, role FROM users WHERE status = 'active' ORDER BY full_name").all(),
      slot_options: SLOT_OPTIONS,
      settings: {
        online_payment_enabled: (db.prepare("SELECT value FROM studio_settings WHERE key = 'online_payment_enabled'").get() as any)?.value !== '0',
      },
    });
  }));

  // ---------- Lookups ----------
  app.get('/api/lookups/:kind', h((req, res) => {
    const kind = req.params.kind;
    if (!LOOKUP_KINDS.includes(kind)) return fail(res, 400, 'نوع فهرست معتبر نیست.');
    return ok(res, db.prepare('SELECT * FROM lookups WHERE kind = ? ORDER BY sort_order, id').all(kind));
  }));

  app.post('/api/lookups/:kind', h((req, res) => {
    const kind = req.params.kind;
    if (!LOOKUP_KINDS.includes(kind)) return fail(res, 400, 'نوع فهرست معتبر نیست.');
    const name = str(req.body?.name);
    if (!name) return fail(res, 400, 'عنوان الزامی است.');
    if (db.prepare('SELECT 1 FROM lookups WHERE kind = ? AND name = ?').get(kind, name)) return fail(res, 409, 'این مورد قبلاً ثبت شده است.');
    const max = (db.prepare('SELECT COALESCE(MAX(sort_order),0) AS m FROM lookups WHERE kind = ?').get(kind) as any).m;
    const r = db.prepare('INSERT INTO lookups (kind, name, sort_order) VALUES (?, ?, ?)').run(kind, name, max + 1);
    return ok(res, { id: Number(r.lastInsertRowid) }, 'با موفقیت ثبت شد');
  }));

  app.put('/api/lookups/:kind/:id', h((req, res) => {
    const kind = req.params.kind; const id = Number(req.params.id);
    const cur = db.prepare('SELECT * FROM lookups WHERE id = ? AND kind = ?').get(id, kind) as any;
    if (!cur) return fail(res, 404, 'مورد یافت نشد.');
    const name = str(req.body?.name);
    if (!name) return fail(res, 400, 'عنوان الزامی است.');
    if (db.prepare('SELECT 1 FROM lookups WHERE kind = ? AND name = ? AND id != ?').get(kind, name, id)) return fail(res, 409, 'این مورد قبلاً ثبت شده است.');
    db.prepare('UPDATE lookups SET name = ? WHERE id = ?').run(name, id);
    // keep historical records consistent
    if (kind === 'expense_category') db.prepare('UPDATE expenses SET category = ? WHERE category = ?').run(name, cur.name);
    if (kind === 'payment_method') db.prepare('UPDATE payments SET payment_method = ? WHERE payment_method = ?').run(name, cur.name);
    if (kind === 'project_type') db.prepare('UPDATE projects SET project_type = ? WHERE project_type = ?').run(name, cur.name);
    if (kind === 'product_category') db.prepare('UPDATE products SET category = ? WHERE category = ?').run(name, cur.name);
    return ok(res, null, 'با موفقیت ثبت شد');
  }));

  app.delete('/api/lookups/:kind/:id', h((req, res) => {
    const kind = req.params.kind; const id = Number(req.params.id);
    const cur = db.prepare('SELECT * FROM lookups WHERE id = ? AND kind = ?').get(id, kind) as any;
    if (!cur) return fail(res, 404, 'مورد یافت نشد.');
    if (kind === 'payment_method' && cur.name === 'چک') return fail(res, 400, 'روش پرداخت «چک» سیستمی است و قابل حذف نیست.');
    const used: Record<string, string> = {
      expense_category: 'SELECT COUNT(*) AS c FROM expenses WHERE category = ?',
      payment_method: 'SELECT COUNT(*) AS c FROM payments WHERE payment_method = ?',
      project_type: 'SELECT COUNT(*) AS c FROM projects WHERE project_type = ?',
      product_category: 'SELECT COUNT(*) AS c FROM products WHERE category = ?',
    };
    if (used[kind] && (db.prepare(used[kind]).get(cur.name) as any).c) return fail(res, 400, 'این مورد در اطلاعات ثبت‌شده استفاده شده و قابل حذف نیست.');
    db.prepare('DELETE FROM lookups WHERE id = ?').run(id);
    return ok(res, null, 'با موفقیت حذف شد');
  }));

  // ---------- Packages ----------
  app.get('/api/packages', h((_req, res) => ok(res, db.prepare('SELECT * FROM packages ORDER BY id').all())));

  app.post('/api/packages', h((req, res) => {
    const name = str(req.body?.name);
    if (!name) return fail(res, 400, 'نام پکیج الزامی است.');
    const price = num(req.body?.price);
    if (price < 0) return fail(res, 400, 'قیمت نمی‌تواند منفی باشد.');
    const r = db.prepare('INSERT INTO packages (name, price, description, is_active) VALUES (?, ?, ?, 1)').run(name, price, str(req.body?.description) || null);
    return ok(res, { id: Number(r.lastInsertRowid) }, 'با موفقیت ثبت شد');
  }));

  app.put('/api/packages/:id', h((req, res) => {
    const name = str(req.body?.name);
    if (!name) return fail(res, 400, 'نام پکیج الزامی است.');
    const price = num(req.body?.price);
    if (price < 0) return fail(res, 400, 'قیمت نمی‌تواند منفی باشد.');
    const r = db.prepare('UPDATE packages SET name = ?, price = ?, description = ?, is_active = ? WHERE id = ?')
      .run(name, price, str(req.body?.description) || null, req.body?.is_active === 0 || req.body?.is_active === false ? 0 : 1, Number(req.params.id));
    if (!r.changes) return fail(res, 404, 'پکیج یافت نشد.');
    return ok(res, null, 'با موفقیت ثبت شد');
  }));

  app.delete('/api/packages/:id', h((req, res) => {
    const r = db.prepare('DELETE FROM packages WHERE id = ?').run(Number(req.params.id));
    if (!r.changes) return fail(res, 404, 'پکیج یافت نشد.');
    return ok(res, null, 'با موفقیت حذف شد');
  }));

  // ---------- Services (delete/edit helpers; GET/POST/PUT exist in server.ts) ----------
  app.delete('/api/services/:id', h((req, res) => {
    let r: any;
    try { r = db.prepare('DELETE FROM services WHERE id = ?').run(Number(req.params.id)); } catch { return fail(res, 400, 'این خدمت در قراردادها استفاده شده و قابل حذف نیست. می‌توانید آن را غیرفعال کنید.'); }
    if (!r.changes) return fail(res, 404, 'خدمت یافت نشد.');
    return ok(res, null, 'با موفقیت حذف شد');
  }));

  // ---------- Users & roles ----------
  app.get('/api/roles', h((_req, res) => ok(res, (db.prepare('SELECT * FROM roles ORDER BY id').all() as any[]).map((r) => ({ ...r, permissions: JSON.parse(r.permissions_json || '[]') })))));

  app.post('/api/users', h((req, res) => {
    const username = str(req.body?.username); const fullName = str(req.body?.full_name);
    const role = str(req.body?.role); const password = str(req.body?.password);
    if (!username || !fullName || !role || !password) return fail(res, 400, 'تمامی فیلدهای ضروری کاربر را وارد کنید.');
    if (password.length < 4) return fail(res, 400, 'رمز عبور باید حداقل ۴ کاراکتر باشد.');
    if (!db.prepare('SELECT 1 FROM roles WHERE name = ?').get(role)) return fail(res, 400, 'نقش معتبر نیست.');
    if (db.prepare('SELECT 1 FROM users WHERE username = ?').get(username)) return fail(res, 409, 'این نام کاربری قبلاً ثبت شده است.');
    const r = db.prepare("INSERT INTO users (username, password_hash, full_name, role, phone, email, status) VALUES (?, ?, ?, ?, ?, ?, 'active')")
      .run(username, hashPassword(password), fullName, role, str(req.body?.phone) || null, str(req.body?.email) || null);
    return ok(res, { id: Number(r.lastInsertRowid) }, 'کاربر جدید با موفقیت اضافه شد.');
  }));

  app.put('/api/users/:id', h((req, res) => {
    const id = Number(req.params.id);
    const cur = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as any;
    if (!cur) return fail(res, 404, 'کاربر یافت نشد.');
    const fullName = str(req.body?.full_name) || cur.full_name;
    const role = str(req.body?.role) || cur.role;
    if (!db.prepare('SELECT 1 FROM roles WHERE name = ?').get(role)) return fail(res, 400, 'نقش معتبر نیست.');
    const status = str(req.body?.status) || cur.status;
    if (!['active', 'inactive'].includes(status)) return fail(res, 400, 'وضعیت معتبر نیست.');
    const me = ctx.getAuthUser(req);
    if (me && me.id === id && status !== 'active') return fail(res, 400, 'نمی‌توانید حساب خودتان را غیرفعال کنید.');
    if (cur.role === 'Super Admin' && (role !== 'Super Admin' || status !== 'active')) {
      const other = (db.prepare("SELECT COUNT(*) AS c FROM users WHERE role = 'Super Admin' AND status = 'active' AND id != ?").get(id) as any).c;
      if (!other) return fail(res, 400, 'حداقل یک مدیر ارشد فعال باید وجود داشته باشد.');
    }
    db.prepare('UPDATE users SET full_name = ?, role = ?, status = ?, phone = ?, email = ? WHERE id = ?')
      .run(fullName, role, status, str(req.body?.phone) || cur.phone, str(req.body?.email) || cur.email, id);
    const pw = str(req.body?.password);
    if (pw) {
      if (pw.length < 4) return fail(res, 400, 'رمز عبور باید حداقل ۴ کاراکتر باشد.');
      db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(pw), id);
      db.prepare('DELETE FROM sessions WHERE user_id = ?').run(id);
    }
    return ok(res, null, 'با موفقیت ثبت شد');
  }));

  app.delete('/api/users/:id', h((req, res) => {
    const id = Number(req.params.id);
    const cur = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as any;
    if (!cur) return fail(res, 404, 'کاربر یافت نشد.');
    const me = ctx.getAuthUser(req);
    if (me && me.id === id) return fail(res, 400, 'نمی‌توانید حساب خودتان را حذف کنید.');
    if (cur.role === 'Super Admin') {
      const other = (db.prepare("SELECT COUNT(*) AS c FROM users WHERE role = 'Super Admin' AND status = 'active' AND id != ?").get(id) as any).c;
      if (!other) return fail(res, 400, 'حداقل یک مدیر ارشد فعال باید وجود داشته باشد.');
    }
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(id);
    db.prepare('DELETE FROM users WHERE id = ?').run(id);
    return ok(res, null, 'با موفقیت حذف شد');
  }));
}
