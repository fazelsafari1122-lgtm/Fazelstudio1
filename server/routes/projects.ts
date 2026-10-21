import { db } from '../db.ts';
import { getTodayJalali } from '../jalali.ts';
import { PREP_STAGES, STAGE_FOR_PREP } from '../extraSchema.ts';
import { Ctx, ok, fail, h, tx, str, num, normDate } from './util.ts';
import { projectRows } from './queries.ts';

const PROTECTED_STAGES = new Set([...Object.values(STAGE_FOR_PREP), 'پروژه جدید', 'آماده تحویل', 'تحویل شده', 'لغو شده']);

function ensurePrepTask(projectId: number, kind: string, assignee?: string) {
  const exists = db.prepare('SELECT id FROM prep_tasks WHERE project_id = ? AND kind = ?').get(projectId, kind);
  if (exists) return;
  db.prepare('INSERT INTO prep_tasks (project_id, kind, stage, assignee, start_date) VALUES (?, ?, ?, ?, ?)')
    .run(projectId, kind, PREP_STAGES[kind][0], assignee || null, getTodayJalali());
}

function applyStageSideEffects(projectId: number, status: string) {
  const kind = Object.entries(STAGE_FOR_PREP).find(([, name]) => name === status)?.[0];
  if (kind) {
    const p = db.prepare('SELECT assignee FROM projects WHERE id = ?').get(projectId) as any;
    ensurePrepTask(projectId, kind, p?.assignee);
  }
}

function nextProjectCode() {
  let n = (db.prepare('SELECT COALESCE(MAX(id),0) + 1 AS n FROM projects').get() as any).n as number;
  for (;;) {
    const code = `PRJ-${String(n).padStart(4, '0')}`;
    if (!db.prepare('SELECT 1 FROM projects WHERE project_code = ?').get(code)) return code;
    n++;
  }
}

function stageNames(): string[] {
  return (db.prepare('SELECT name FROM project_stages ORDER BY sort_order, id').all() as any[]).map((r) => r.name);
}

function withPrep(rows: any[]) {
  const tasks = db.prepare('SELECT project_id, kind, stage FROM prep_tasks').all() as any[];
  return rows.map((r) => ({ ...r, prep: tasks.filter((t) => t.project_id === r.id).map((t) => ({ kind: t.kind, stage: t.stage })) }));
}

export function registerProjectRoutes(app: any, ctx: Ctx) {
  // ---------- Projects ----------
  app.get('/api/projects', h((_req, res) => ok(res, withPrep(projectRows()))));

  app.get('/api/projects/:id', h((req, res) => {
    const id = Number(req.params.id);
    const p = projectRows('p.id = ?', [id])[0];
    if (!p) return fail(res, 404, 'پروژه یافت نشد.');
    const invoices = db.prepare('SELECT * FROM invoices WHERE project_id = ? OR (contract_id IS NOT NULL AND contract_id = ?) ORDER BY id DESC').all(id, p.contract_id || 0);
    const appointments = db.prepare('SELECT a.*, h.name AS hall_name FROM appointments a JOIN halls h ON h.id = a.hall_id WHERE a.project_id = ? ORDER BY a.date').all(id);
    const prep = db.prepare('SELECT * FROM prep_tasks WHERE project_id = ?').all(id);
    return ok(res, { ...p, invoices, appointments, prep });
  }));

  function readProject(b: any) {
    const customerId = Number(b.customer_id);
    if (!customerId || !db.prepare('SELECT 1 FROM customers WHERE id = ?').get(customerId)) return { error: 'خانواده/مشتری را انتخاب کنید.' };
    const name = str(b.name);
    if (!name) return { error: 'عنوان پروژه الزامی است.' };
    const date = normDate(b.project_date);
    if (!date) return { error: 'تاریخ پروژه را درست وارد کنید.' };
    let deadline = '';
    if (str(b.deadline)) {
      deadline = normDate(b.deadline);
      if (!deadline) return { error: 'تاریخ Deadline معتبر نیست.' };
    }
    const status = str(b.status) || 'پروژه جدید';
    if (!stageNames().includes(status)) return { error: 'وضعیت پروژه معتبر نیست.' };
    const amount = num(b.amount);
    if (amount < 0) return { error: 'مبلغ نمی‌تواند منفی باشد.' };
    return {
      value: {
        customerId, name, date, deadline: deadline || null, status, amount,
        type: str(b.project_type) || 'عکاسی خانواده', assignee: str(b.assignee) || null,
        notes: str(b.notes) || null, location: str(b.location) || null,
        contractId: Number(b.contract_id) || null,
      },
    };
  }

  app.post('/api/projects', h((req, res) => {
    const p: any = readProject(req.body || {});
    if (p.error) return fail(res, 400, p.error);
    const v = p.value;
    const id = tx(() => {
      const r = db.prepare(`
        INSERT INTO projects (project_code, name, contract_id, customer_id, project_type, project_date, location, status, notes, assignee, deadline, amount)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(nextProjectCode(), v.name, v.contractId, v.customerId, v.type, v.date, v.location, v.status, v.notes, v.assignee, v.deadline, v.amount);
      const pid = Number(r.lastInsertRowid);
      applyStageSideEffects(pid, v.status);
      return pid;
    });
    const user = ctx.getAuthUser(req);
    ctx.logAudit(user?.id ?? null, user?.full_name ?? 'سیستم', 'ایجاد پروژه', 'Project', String(id), null, { name: v.name });
    return ok(res, projectRows('p.id = ?', [id])[0], 'با موفقیت ثبت شد');
  }));

  app.put('/api/projects/:id', h((req, res) => {
    const id = Number(req.params.id);
    if (!db.prepare('SELECT 1 FROM projects WHERE id = ?').get(id)) return fail(res, 404, 'پروژه یافت نشد.');
    const p: any = readProject(req.body || {});
    if (p.error) return fail(res, 400, p.error);
    const v = p.value;
    tx(() => {
      db.prepare(`
        UPDATE projects SET name = ?, customer_id = ?, project_type = ?, project_date = ?, location = ?, status = ?, notes = ?,
          assignee = ?, deadline = ?, amount = ? WHERE id = ?
      `).run(v.name, v.customerId, v.type, v.date, v.location, v.status, v.notes, v.assignee, v.deadline, v.amount, id);
      applyStageSideEffects(id, v.status);
    });
    return ok(res, projectRows('p.id = ?', [id])[0], 'با موفقیت ثبت شد');
  }));

  app.put('/api/projects/:id/status', h((req, res) => {
    const id = Number(req.params.id);
    const status = str(req.body?.status);
    if (!status) return fail(res, 400, 'وضعیت الزامی است.');
    if (!stageNames().includes(status)) return fail(res, 400, 'وضعیت پروژه معتبر نیست.');
    if (!db.prepare('SELECT 1 FROM projects WHERE id = ?').get(id)) return fail(res, 404, 'پروژه یافت نشد.');
    tx(() => {
      db.prepare('UPDATE projects SET status = ? WHERE id = ?').run(status, id);
      applyStageSideEffects(id, status);
    });
    const user = ctx.getAuthUser(req);
    ctx.logAudit(user?.id ?? null, user?.full_name ?? 'سیستم', 'تغییر وضعیت پروژه', 'Project', String(id), null, { status });
    return ok(res, projectRows('p.id = ?', [id])[0], `وضعیت پروژه به «${status}» تغییر کرد.`);
  }));

  app.delete('/api/projects/:id', h((req, res) => {
    const id = Number(req.params.id);
    const p = db.prepare('SELECT id FROM projects WHERE id = ?').get(id);
    if (!p) return fail(res, 404, 'پروژه یافت نشد.');
    tx(() => {
      db.prepare('UPDATE invoices SET project_id = NULL WHERE project_id = ?').run(id);
      db.prepare('UPDATE appointments SET project_id = NULL WHERE project_id = ?').run(id);
      db.prepare('UPDATE team_payments SET project_id = NULL WHERE project_id = ?').run(id);
      db.prepare('UPDATE equipment_reservations SET project_id = NULL WHERE project_id = ?').run(id);
      db.prepare('DELETE FROM calendar_events WHERE project_id = ?').run(id);
      db.prepare('DELETE FROM projects WHERE id = ?').run(id);
    });
    return ok(res, null, 'با موفقیت حذف شد');
  }));

  // ---------- Kanban stages ----------
  app.get('/api/project-stages', h((_req, res) => {
    const rows = db.prepare(`
      SELECT s.*, (SELECT COUNT(*) FROM projects p WHERE p.status = s.name) AS projects_count,
             CASE WHEN s.name IN (${[...PROTECTED_STAGES].map(() => '?').join(',')}) THEN 1 ELSE 0 END AS is_system
      FROM project_stages s ORDER BY s.sort_order, s.id
    `).all(...PROTECTED_STAGES);
    return ok(res, rows);
  }));

  app.post('/api/project-stages', h((req, res) => {
    const name = str(req.body?.name);
    if (!name) return fail(res, 400, 'نام وضعیت الزامی است.');
    if (db.prepare('SELECT 1 FROM project_stages WHERE name = ?').get(name)) return fail(res, 409, 'وضعیتی با این نام وجود دارد.');
    const max = (db.prepare('SELECT COALESCE(MAX(sort_order),0) AS m FROM project_stages').get() as any).m;
    const r = db.prepare('INSERT INTO project_stages (name, sort_order, color) VALUES (?, ?, ?)').run(name, max + 1, str(req.body?.color) || '#94a3b8');
    return ok(res, { id: Number(r.lastInsertRowid) }, 'با موفقیت ثبت شد');
  }));

  app.put('/api/project-stages/:id', h((req, res) => {
    const id = Number(req.params.id);
    const cur = db.prepare('SELECT * FROM project_stages WHERE id = ?').get(id) as any;
    if (!cur) return fail(res, 404, 'وضعیت یافت نشد.');
    const name = str(req.body?.name) || cur.name;
    if (name !== cur.name && PROTECTED_STAGES.has(cur.name)) return fail(res, 400, 'نام این وضعیت سیستمی است و قابل تغییر نیست.');
    if (name !== cur.name && db.prepare('SELECT 1 FROM project_stages WHERE name = ? AND id != ?').get(name, id)) return fail(res, 409, 'وضعیتی با این نام وجود دارد.');
    const sort = req.body?.sort_order !== undefined ? num(req.body.sort_order) : cur.sort_order;
    tx(() => {
      db.prepare('UPDATE project_stages SET name = ?, color = ?, sort_order = ? WHERE id = ?').run(name, str(req.body?.color) || cur.color, sort, id);
      if (name !== cur.name) db.prepare('UPDATE projects SET status = ? WHERE status = ?').run(name, cur.name);
    });
    return ok(res, null, 'با موفقیت ثبت شد');
  }));

  app.put('/api/project-stages-order', h((req, res) => {
    const ids: number[] = (Array.isArray(req.body?.ids) ? req.body.ids : []).map(Number);
    tx(() => {
      const upd = db.prepare('UPDATE project_stages SET sort_order = ? WHERE id = ?');
      ids.forEach((id, i) => upd.run(i + 1, id));
    });
    return ok(res, null, 'با موفقیت ثبت شد');
  }));

  app.delete('/api/project-stages/:id', h((req, res) => {
    const id = Number(req.params.id);
    const cur = db.prepare('SELECT * FROM project_stages WHERE id = ?').get(id) as any;
    if (!cur) return fail(res, 404, 'وضعیت یافت نشد.');
    if (PROTECTED_STAGES.has(cur.name)) return fail(res, 400, 'این وضعیت سیستمی است و قابل حذف نیست.');
    if ((db.prepare('SELECT COUNT(*) AS c FROM projects WHERE status = ?').get(cur.name) as any).c) {
      return fail(res, 400, 'پروژه‌هایی در این وضعیت وجود دارد. ابتدا آن‌ها را به وضعیت دیگری منتقل کنید.');
    }
    db.prepare('DELETE FROM project_stages WHERE id = ?').run(id);
    return ok(res, null, 'با موفقیت حذف شد');
  }));

  // ---------- Prep (photo / video / album) ----------
  app.get('/api/prep/stages', h((_req, res) => ok(res, PREP_STAGES)));

  app.get('/api/prep', h((req, res) => {
    const kind = str(req.query.kind);
    if (!PREP_STAGES[kind]) return fail(res, 400, 'نوع آماده‌سازی معتبر نیست.');
    const rows = db.prepare(`
      SELECT t.*, p.project_code, p.name AS project_name, p.status AS project_status, p.project_type, p.customer_id,
             cu.first_name AS customer_first, cu.last_name AS customer_last
      FROM prep_tasks t JOIN projects p ON p.id = t.project_id JOIN customers cu ON cu.id = p.customer_id
      WHERE t.kind = ? ORDER BY t.deadline IS NULL, t.deadline, t.id
    `).all(kind) as any[];
    const today = getTodayJalali();
    return ok(res, rows.map((r) => ({ ...r, overdue: !!r.deadline && r.deadline < today && r.stage !== 'آماده تحویل' })));
  }));

  app.post('/api/prep', h((req, res) => {
    const kind = str(req.body?.kind);
    const projectId = Number(req.body?.project_id);
    if (!PREP_STAGES[kind]) return fail(res, 400, 'نوع آماده‌سازی معتبر نیست.');
    if (!db.prepare('SELECT 1 FROM projects WHERE id = ?').get(projectId)) return fail(res, 400, 'پروژه را انتخاب کنید.');
    if (db.prepare('SELECT 1 FROM prep_tasks WHERE project_id = ? AND kind = ?').get(projectId, kind)) return fail(res, 409, 'این پروژه قبلاً در این بخش ثبت شده است.');
    const start = normDate(req.body?.start_date) || getTodayJalali();
    const deadline = str(req.body?.deadline) ? normDate(req.body.deadline) : '';
    if (str(req.body?.deadline) && !deadline) return fail(res, 400, 'تاریخ Deadline معتبر نیست.');
    const stage = str(req.body?.stage) || PREP_STAGES[kind][0];
    if (!PREP_STAGES[kind].includes(stage)) return fail(res, 400, 'مرحله معتبر نیست.');
    const r = db.prepare('INSERT INTO prep_tasks (project_id, kind, stage, assignee, start_date, deadline, notes) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(projectId, kind, stage, str(req.body?.assignee) || null, start, deadline || null, str(req.body?.notes) || null);
    return ok(res, { id: Number(r.lastInsertRowid) }, 'با موفقیت ثبت شد');
  }));

  app.put('/api/prep/:id', h((req, res) => {
    const id = Number(req.params.id);
    const t = db.prepare('SELECT * FROM prep_tasks WHERE id = ?').get(id) as any;
    if (!t) return fail(res, 404, 'مورد یافت نشد.');
    const stage = str(req.body?.stage) || t.stage;
    if (!PREP_STAGES[t.kind].includes(stage)) return fail(res, 400, 'مرحله معتبر نیست.');
    const deadline = req.body?.deadline !== undefined ? (str(req.body.deadline) ? normDate(req.body.deadline) : '') : t.deadline || '';
    if (req.body?.deadline && str(req.body.deadline) && !deadline) return fail(res, 400, 'تاریخ Deadline معتبر نیست.');
    const start = req.body?.start_date !== undefined ? (normDate(req.body.start_date) || t.start_date) : t.start_date;
    const assignee = req.body?.assignee !== undefined ? str(req.body.assignee) : t.assignee;
    const notes = req.body?.notes !== undefined ? str(req.body.notes) : t.notes;
    let projectReady = false;
    tx(() => {
      db.prepare('UPDATE prep_tasks SET stage = ?, assignee = ?, start_date = ?, deadline = ?, notes = ? WHERE id = ?')
        .run(stage, assignee || null, start || null, deadline || null, notes || null, id);
      if (stage === 'آماده تحویل') {
        const all = db.prepare('SELECT stage FROM prep_tasks WHERE project_id = ?').all(t.project_id) as any[];
        if (all.length && all.every((x) => x.stage === 'آماده تحویل')) {
          const cur = db.prepare('SELECT status FROM projects WHERE id = ?').get(t.project_id) as any;
          if (cur && !['تحویل شده', 'لغو شده'].includes(cur.status)) {
            db.prepare("UPDATE projects SET status = 'آماده تحویل' WHERE id = ?").run(t.project_id);
            projectReady = true;
          }
        }
      }
    });
    return ok(res, { id, project_ready: projectReady }, projectReady ? 'همه مراحل آماده‌سازی تمام شد و پروژه «آماده تحویل» شد.' : 'با موفقیت ثبت شد');
  }));

  app.delete('/api/prep/:id', h((req, res) => {
    const r = db.prepare('DELETE FROM prep_tasks WHERE id = ?').run(Number(req.params.id));
    if (!r.changes) return fail(res, 404, 'مورد یافت نشد.');
    return ok(res, null, 'با موفقیت حذف شد');
  }));
}
