import { db } from '../db.ts';
import { toEnglishDigits } from '../jalali.ts';
import { getTodayJalali } from '../jalali.ts';
import { Ctx, ok, fail, h, tx, str, normDate, normPhone, fullName } from './util.ts';
import { membersByCustomer, tagsByCustomer, projectRows, appointmentRows, customerDebt } from './queries.ts';

const MOBILE_RE = /^09\d{9}$/;

function validMobile(p: string) { return MOBILE_RE.test(p); }

function normMember(m: any, role: string) {
  return {
    role,
    first_name: str(m?.first_name),
    last_name: str(m?.last_name),
    phone: normPhone(m?.phone),
    phone2: normPhone(m?.phone2),
    gender: str(m?.gender),
    birth_date: normDate(m?.birth_date) || '',
    job: str(m?.job),
    notes: str(m?.notes),
  };
}

function searchText(v: any) {
  return toEnglishDigits(String(v ?? '')).toLowerCase().replace(/ي/g, 'ی').replace(/ك/g, 'ک');
}

export function listFamilies(q = '', tagId = 0, onlyDebt = false) {
  const customers = db.prepare('SELECT * FROM customers ORDER BY id DESC').all() as any[];
  const members = membersByCustomer();
  const tags = tagsByCustomer();
  const projectCounts = new Map<number, number>();
  for (const r of db.prepare('SELECT customer_id, COUNT(*) AS c FROM projects GROUP BY customer_id').all() as any[]) projectCounts.set(r.customer_id, r.c);
  const needle = searchText(q).trim();

  const out: any[] = [];
  for (const c of customers) {
    const ms = members.get(c.id) || [];
    const father = ms.find((m) => m.role === 'father') || null;
    const mother = ms.find((m) => m.role === 'mother') || null;
    const children = ms.filter((m) => m.role === 'child');
    const ts = tags.get(c.id) || [];
    if (tagId && !ts.some((t) => t.id === tagId)) continue;
    if (needle) {
      const hay = searchText([
        c.first_name, c.last_name, c.phone, c.phone2,
        ...ms.flatMap((m) => [m.first_name, m.last_name, m.phone, m.phone2]),
      ].join(' '));
      if (!hay.includes(needle)) continue;
    }
    const debt = customerDebt(c.id);
    if (onlyDebt && debt <= 0) continue;
    out.push({
      id: c.id,
      family_name: c.last_name,
      display_name: `خانواده ${c.last_name}`,
      first_name: c.first_name,
      phone: c.phone,
      phone2: c.phone2,
      source: c.source,
      notes: c.notes,
      created_at: c.created_at,
      father, mother, children,
      tags: ts,
      debt,
      projects_count: projectCounts.get(c.id) || 0,
    });
  }
  return out;
}

export function registerFamilyRoutes(app: any, ctx: Ctx) {
  // ---------- Families ----------
  app.get('/api/families', h((req, res) => {
    const q = str(req.query.q);
    const tag = Number(req.query.tag) || 0;
    const onlyDebt = req.query.debt === '1';
    return ok(res, listFamilies(q, tag, onlyDebt));
  }));

  app.get('/api/families/:id', h((req, res) => {
    const id = Number(req.params.id);
    const c = db.prepare('SELECT * FROM customers WHERE id = ?').get(id) as any;
    if (!c) return fail(res, 404, 'خانواده مورد نظر یافت نشد.');
    const members = membersByCustomer([id]).get(id) || [];
    const tags = tagsByCustomer().get(id) || [];
    const projects = projectRows('p.customer_id = ?', [id]);
    const appointments = appointmentRows('a.customer_id = ?', [id]).reverse();
    const invoices = db.prepare(`
      SELECT * FROM invoices WHERE customer_id = ? ORDER BY id DESC
    `).all(id) as any[];
    const payments = db.prepare('SELECT * FROM payments WHERE customer_id = ? ORDER BY id DESC').all(id) as any[];
    const followups = db.prepare('SELECT * FROM followups WHERE customer_id = ? ORDER BY id DESC').all(id) as any[];
    const sms = db.prepare('SELECT * FROM sms_messages WHERE customer_id = ? ORDER BY id DESC').all(id) as any[];
    const cheques = db.prepare('SELECT * FROM cheques WHERE customer_id = ? ORDER BY id DESC').all(id) as any[];
    const invoiced = invoices.filter((i) => i.status !== 'cancelled').reduce((s, i) => s + Number(i.total || 0), 0);
    const paid = payments.reduce((s, p) => s + Number(p.amount || 0), 0);
    return ok(res, {
      family: {
        id: c.id, family_name: c.last_name, first_name: c.first_name, phone: c.phone, phone2: c.phone2,
        source: c.source, notes: c.notes, created_at: c.created_at, city: c.city, address: c.address,
      },
      members, tags, projects, appointments, invoices, payments, followups, sms, cheques,
      summary: { invoiced, paid, debt: customerDebt(id) },
    });
  }));

  function readBody(b: any) {
    const familyName = str(b.family_name);
    const father = normMember(b.father, 'father');
    const mother = normMember(b.mother, 'mother');
    const children = (Array.isArray(b.children) ? b.children : [])
      .map((c: any) => normMember(c, 'child'))
      .filter((c: any) => c.first_name || c.last_name);
    return { familyName, father, mother, children, source: str(b.source), notes: str(b.notes), tagIds: (Array.isArray(b.tag_ids) ? b.tag_ids : []).map(Number).filter(Boolean), contactPhone: normPhone(b.phone) };
  }

  function validate(b: ReturnType<typeof readBody>) {
    if (!b.familyName) return 'نام خانوادگی (نام خانواده) الزامی است.';
    const hasPerson = b.father.first_name || b.mother.first_name;
    if (!hasPerson) return 'حداقل نام پدر یا مادر را وارد کنید.';
    for (const [label, p] of [['پدر', b.father], ['مادر', b.mother]] as const) {
      if (p.phone && !validMobile(p.phone)) return `شماره موبایل ${label} معتبر نیست (مثال: 09121234567).`;
    }
    if (!(b.father.phone || b.mother.phone || b.contactPhone)) return 'حداقل یک شماره موبایل وارد کنید.';
    if (b.contactPhone && !validMobile(b.contactPhone)) return 'شماره تماس معتبر نیست.';
    for (const c of b.children) {
      if (!c.first_name) return 'نام فرزند الزامی است.';
      if (c.gender && !['پسر', 'دختر'].includes(c.gender)) return 'جنسیت فرزند باید پسر یا دختر باشد.';
    }
    return '';
  }

  function saveMembers(customerId: number, b: ReturnType<typeof readBody>) {
    db.prepare('DELETE FROM family_members WHERE customer_id = ?').run(customerId);
    const ins = db.prepare(`
      INSERT INTO family_members (customer_id, role, first_name, last_name, phone, phone2, gender, birth_date, job, notes, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const all = [b.father, b.mother, ...b.children];
    all.forEach((m, i) => {
      if (m.role !== 'child' && !m.first_name && !m.last_name && !m.phone) return;
      ins.run(customerId, m.role, m.first_name, m.last_name || b.familyName, m.phone || null, m.phone2 || null, m.gender || null, m.birth_date || null, m.job || null, m.notes || null, i);
    });
    db.prepare('DELETE FROM customer_tags WHERE customer_id = ?').run(customerId);
    const insTag = db.prepare('INSERT OR IGNORE INTO customer_tags (customer_id, tag_id) VALUES (?, ?)');
    for (const t of b.tagIds) {
      if (db.prepare('SELECT 1 FROM tags WHERE id = ?').get(t)) insTag.run(customerId, t);
    }
  }

  function customerColumns(b: ReturnType<typeof readBody>) {
    const primary = b.father.first_name ? b.father : b.mother;
    const phone = b.father.phone || b.mother.phone || b.contactPhone;
    const phone2 = b.father.phone && b.mother.phone ? b.mother.phone : (b.contactPhone && b.contactPhone !== phone ? b.contactPhone : '');
    return {
      first_name: primary.first_name || b.familyName,
      last_name: b.familyName,
      phone,
      phone2: phone2 || null,
      birth_date: primary.birth_date || null,
    };
  }

  function findPhoneDuplicate(phones: string[], excludeId = 0) {
    for (const p of phones.filter(Boolean)) {
      const row = db.prepare(`
        SELECT DISTINCT c.id, c.last_name FROM customers c
        LEFT JOIN family_members m ON m.customer_id = c.id
        WHERE (c.phone = ? OR c.phone2 = ? OR m.phone = ?) AND c.id != ? LIMIT 1
      `).get(p, p, p, excludeId) as any;
      if (row) return row;
    }
    return null;
  }

  app.post('/api/families', h((req, res) => {
    const b = readBody(req.body || {});
    const err = validate(b);
    if (err) return fail(res, 400, err);
    const dup = findPhoneDuplicate([b.father.phone, b.mother.phone, b.contactPhone]);
    if (dup && !req.body.force) {
      return fail(res, 409, `این شماره قبلاً برای «خانواده ${dup.last_name}» ثبت شده است.`, { duplicate: { id: dup.id } });
    }
    const cols = customerColumns(b);
    const id = tx(() => {
      const r = db.prepare(`
        INSERT INTO customers (first_name, last_name, phone, phone2, birth_date, source, notes, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'active')
      `).run(cols.first_name, cols.last_name, cols.phone, cols.phone2, cols.birth_date, b.source || 'Instagram', b.notes || null);
      const cid = Number(r.lastInsertRowid);
      saveMembers(cid, b);
      return cid;
    });
    const user = ctx.getAuthUser(req);
    ctx.logAudit(user?.id ?? null, user?.full_name ?? 'سیستم', 'ثبت خانواده', 'Family', String(id), null, { family_name: b.familyName });
    return ok(res, { id }, 'با موفقیت ثبت شد');
  }));

  app.put('/api/families/:id', h((req, res) => {
    const id = Number(req.params.id);
    const exists = db.prepare('SELECT id FROM customers WHERE id = ?').get(id);
    if (!exists) return fail(res, 404, 'خانواده مورد نظر یافت نشد.');
    const b = readBody(req.body || {});
    const err = validate(b);
    if (err) return fail(res, 400, err);
    const dup = findPhoneDuplicate([b.father.phone, b.mother.phone, b.contactPhone], id);
    if (dup && !req.body.force) {
      return fail(res, 409, `این شماره قبلاً برای «خانواده ${dup.last_name}» ثبت شده است.`, { duplicate: { id: dup.id } });
    }
    const cols = customerColumns(b);
    tx(() => {
      db.prepare(`
        UPDATE customers SET first_name = ?, last_name = ?, phone = ?, phone2 = ?, birth_date = ?, source = ?, notes = ? WHERE id = ?
      `).run(cols.first_name, cols.last_name, cols.phone, cols.phone2, cols.birth_date, b.source || 'Instagram', b.notes || null, id);
      saveMembers(id, b);
    });
    const user = ctx.getAuthUser(req);
    ctx.logAudit(user?.id ?? null, user?.full_name ?? 'سیستم', 'ویرایش خانواده', 'Family', String(id), null, { family_name: b.familyName });
    return ok(res, { id }, 'با موفقیت ثبت شد');
  }));

  app.delete('/api/families/:id', h((req, res) => {
    const id = Number(req.params.id);
    const c = db.prepare('SELECT id, last_name FROM customers WHERE id = ?').get(id) as any;
    if (!c) return fail(res, 404, 'خانواده مورد نظر یافت نشد.');
    const count = (sql: string) => (db.prepare(sql).get(id) as any).c as number;
    const blockers: string[] = [];
    if (count('SELECT COUNT(*) AS c FROM contracts WHERE customer_id = ?')) blockers.push('قرارداد');
    if (count('SELECT COUNT(*) AS c FROM invoices WHERE customer_id = ?')) blockers.push('فاکتور');
    if (count('SELECT COUNT(*) AS c FROM payments WHERE customer_id = ?')) blockers.push('پرداخت');
    if (count('SELECT COUNT(*) AS c FROM projects WHERE customer_id = ?')) blockers.push('پروژه');
    if (blockers.length) {
      return fail(res, 400, `این خانواده دارای ${blockers.join('، ')} است و امکان حذف آن وجود ندارد. ابتدا موارد مرتبط را حذف کنید.`);
    }
    tx(() => {
      db.prepare('DELETE FROM followups WHERE customer_id = ?').run(id);
      db.prepare('DELETE FROM cheques WHERE customer_id = ?').run(id);
      db.prepare('UPDATE sms_messages SET customer_id = NULL WHERE customer_id = ?').run(id);
      db.prepare('DELETE FROM brides_grooms WHERE customer_id = ?').run(id);
      db.prepare('DELETE FROM weddings WHERE customer_id = ?').run(id);
      db.prepare('DELETE FROM customers WHERE id = ?').run(id);
    });
    const user = ctx.getAuthUser(req);
    ctx.logAudit(user?.id ?? null, user?.full_name ?? 'سیستم', 'حذف خانواده', 'Family', String(id), c, null);
    return ok(res, null, 'با موفقیت حذف شد');
  }));

  // ---------- Tags ----------
  app.get('/api/tags', h((_req, res) => {
    const rows = db.prepare(`
      SELECT t.*, (SELECT COUNT(*) FROM customer_tags ct WHERE ct.tag_id = t.id) AS usage_count FROM tags t ORDER BY t.name
    `).all();
    return ok(res, rows);
  }));

  app.post('/api/tags', h((req, res) => {
    const name = str(req.body?.name);
    if (!name) return fail(res, 400, 'نام تگ الزامی است.');
    if (db.prepare('SELECT 1 FROM tags WHERE name = ?').get(name)) return fail(res, 409, 'تگی با این نام وجود دارد.');
    const r = db.prepare('INSERT INTO tags (name, color) VALUES (?, ?)').run(name, str(req.body?.color) || '#f59e0b');
    return ok(res, { id: Number(r.lastInsertRowid) }, 'با موفقیت ثبت شد');
  }));

  app.put('/api/tags/:id', h((req, res) => {
    const id = Number(req.params.id);
    const name = str(req.body?.name);
    if (!name) return fail(res, 400, 'نام تگ الزامی است.');
    if (db.prepare('SELECT 1 FROM tags WHERE name = ? AND id != ?').get(name, id)) return fail(res, 409, 'تگی با این نام وجود دارد.');
    const r = db.prepare('UPDATE tags SET name = ?, color = ? WHERE id = ?').run(name, str(req.body?.color) || '#f59e0b', id);
    if (!r.changes) return fail(res, 404, 'تگ یافت نشد.');
    return ok(res, null, 'با موفقیت ثبت شد');
  }));

  app.delete('/api/tags/:id', h((req, res) => {
    const r = db.prepare('DELETE FROM tags WHERE id = ?').run(Number(req.params.id));
    if (!r.changes) return fail(res, 404, 'تگ یافت نشد.');
    return ok(res, null, 'با موفقیت حذف شد');
  }));
}

export { fullName, getTodayJalali };
