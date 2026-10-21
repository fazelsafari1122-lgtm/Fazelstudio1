import { db } from '../db.ts';
import { getTodayJalali, gregorianToJalaliDateStr } from '../jalali.ts';
import { STAGE_FOR_PREP } from '../extraSchema.ts';
import { Ctx, ok, fail, h, str, normDate, addDaysJalali, weekStartJalali, jalaliParts, toMinutes } from './util.ts';
import { totalDebt } from './queries.ts';
import { buildNotifications } from './followups.ts';

const MONTHS = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
const FINISHED = ['تحویل شده', 'لغو شده'];
const PREP_STAGE_NAMES = Object.values(STAGE_FOR_PREP);

function sum(sql: string, ...p: any[]): number {
  return Number((db.prepare(sql).get(...p) as any)?.t || 0);
}

function count(sql: string, ...p: any[]): number {
  return Number((db.prepare(sql).get(...p) as any)?.c || 0);
}

export function overview() {
  const today = getTodayJalali();
  const revenue = sum("SELECT COALESCE(SUM(total),0) AS t FROM invoices WHERE status != 'cancelled'");
  const paid = sum('SELECT COALESCE(SUM(amount),0) AS t FROM payments');
  const expenses = sum('SELECT COALESCE(SUM(amount),0) AS t FROM expenses');
  const stages = db.prepare('SELECT name, color FROM project_stages ORDER BY sort_order, id').all() as any[];
  const byStage = stages.map((s) => ({ ...s, count: count('SELECT COUNT(*) AS c FROM projects WHERE status = ?', s.name) }));
  const unfinished = `status NOT IN ('${FINISHED.join("','")}')`;
  return {
    revenue, paid, debt: totalDebt(), expenses, cashflow: paid - expenses,
    activeProjects: count(`SELECT COUNT(*) AS c FROM projects WHERE ${unfinished}`),
    preparingProjects: count(`SELECT COUNT(*) AS c FROM projects WHERE status IN ('${PREP_STAGE_NAMES.join("','")}')`),
    customers: count('SELECT COUNT(*) AS c FROM customers'),
    todayAppointments: count("SELECT COUNT(*) AS c FROM appointments WHERE date = ? AND status != 'لغو شده'", today),
    openFollowups: count("SELECT COUNT(*) AS c FROM followups WHERE status != 'بسته شده'"),
    projectsByStatus: byStage,
    recentPayments: db.prepare(`
      SELECT p.id, p.amount, p.payment_date, p.payment_method, cu.last_name FROM payments p JOIN customers cu ON cu.id = p.customer_id ORDER BY p.id DESC LIMIT 6
    `).all(),
    upcomingAppointments: db.prepare(`
      SELECT a.id, a.date, a.start_time, h.name AS hall_name, cu.last_name FROM appointments a JOIN halls h ON h.id = a.hall_id JOIN customers cu ON cu.id = a.customer_id
      WHERE a.date >= ? AND a.status = 'رزرو شده' ORDER BY a.date, a.start_time LIMIT 6
    `).all(today),
    notifications: buildNotifications(null).counts,
  };
}

type Range = 'day' | 'week' | 'month' | 'year';

function buckets(range: Range, today: string): { key: string; label: string }[] {
  const out: { key: string; label: string }[] = [];
  const t = jalaliParts(today);
  if (range === 'day') {
    for (let i = 13; i >= 0; i--) {
      const d = addDaysJalali(today, -i);
      out.push({ key: d, label: d.slice(5) });
    }
  } else if (range === 'week') {
    const start = weekStartJalali(today);
    for (let i = 7; i >= 0; i--) {
      const d = addDaysJalali(start, -7 * i);
      out.push({ key: d, label: d.slice(5) });
    }
  } else if (range === 'month') {
    let y = t.y; let m = t.m;
    const list: { key: string; label: string }[] = [];
    for (let i = 0; i < 12; i++) {
      list.unshift({ key: `${y}/${String(m).padStart(2, '0')}`, label: MONTHS[m - 1] });
      m -= 1; if (m === 0) { m = 12; y -= 1; }
    }
    out.push(...list);
  } else {
    for (let i = 4; i >= 0; i--) out.push({ key: String(t.y - i), label: String(t.y - i) });
  }
  return out;
}

function keyOf(range: Range, date: string): string {
  if (!date) return '';
  if (range === 'day') return date;
  if (range === 'week') return weekStartJalali(date);
  if (range === 'month') return date.slice(0, 7);
  return date.slice(0, 4);
}

export function series(range: Range) {
  const today = getTodayJalali();
  const bs = buckets(range, today);
  const idx = new Map(bs.map((b, i) => [b.key, i]));
  const mk = () => bs.map(() => 0);
  const income = mk(); const payments = mk(); const expenses = mk(); const projects = mk();
  const add = (arr: number[], date: string, v: number) => { const i = idx.get(keyOf(range, date)); if (i !== undefined) arr[i] += v; };
  for (const r of db.prepare("SELECT issue_date AS d, total AS v FROM invoices WHERE status != 'cancelled'").all() as any[]) add(income, r.d, r.v);
  for (const r of db.prepare('SELECT payment_date AS d, amount AS v FROM payments').all() as any[]) add(payments, r.d, r.v);
  for (const r of db.prepare('SELECT expense_date AS d, amount AS v FROM expenses').all() as any[]) add(expenses, r.d, r.v);
  for (const r of db.prepare('SELECT project_date AS d FROM projects').all() as any[]) add(projects, r.d, 1);
  return { range, labels: bs.map((b) => b.label), income, payments, expenses, projects };
}

export function detailedReport(from: string, to: string) {
  const inRange = (col: string) => `${col} >= ? AND ${col} <= ?`;
  const paid = sum(`SELECT COALESCE(SUM(amount),0) AS t FROM payments WHERE ${inRange('payment_date')}`, from, to);
  const expenses = sum(`SELECT COALESCE(SUM(amount),0) AS t FROM expenses WHERE ${inRange('expense_date')}`, from, to);
  const income = sum(`SELECT COALESCE(SUM(total),0) AS t FROM invoices WHERE status != 'cancelled' AND ${inRange('issue_date')}`, from, to);
  const byMethod = db.prepare(`SELECT payment_method AS name, SUM(amount) AS total, COUNT(*) AS count FROM payments WHERE ${inRange('payment_date')} GROUP BY payment_method ORDER BY total DESC`).all(from, to);
  const byCategory = db.prepare(`SELECT category AS name, SUM(amount) AS total, COUNT(*) AS count FROM expenses WHERE ${inRange('expense_date')} GROUP BY category ORDER BY total DESC`).all(from, to);

  const customers = db.prepare('SELECT id, created_at FROM customers').all() as any[];
  const newCustomers = customers.filter((c) => {
    const j = gregorianToJalaliDateStr(String(c.created_at || '').slice(0, 10));
    return j && j >= from && j <= to;
  }).length;
  const activeIds = new Set<number>();
  for (const r of db.prepare(`SELECT DISTINCT customer_id AS id FROM appointments WHERE ${inRange('date')}`).all(from, to) as any[]) activeIds.add(r.id);
  for (const r of db.prepare(`SELECT DISTINCT customer_id AS id FROM payments WHERE ${inRange('payment_date')}`).all(from, to) as any[]) activeIds.add(r.id);
  for (const r of db.prepare(`SELECT DISTINCT customer_id AS id FROM projects WHERE ${inRange('project_date')}`).all(from, to) as any[]) activeIds.add(r.id);

  const projRows = db.prepare(`SELECT status FROM projects WHERE ${inRange('project_date')}`).all(from, to) as any[];
  const projectsByStatus: Record<string, number> = {};
  for (const p of projRows) projectsByStatus[p.status] = (projectsByStatus[p.status] || 0) + 1;

  const appts = db.prepare(`SELECT a.*, h.name AS hall_name FROM appointments a JOIN halls h ON h.id = a.hall_id WHERE ${inRange('a.date')}`).all(from, to) as any[];
  const halls = db.prepare('SELECT id, name FROM halls ORDER BY id').all() as any[];
  const hallStats = halls.map((hl) => {
    const mine = appts.filter((a) => a.hall_id === hl.id && a.status !== 'لغو شده');
    const minutes = mine.reduce((s, a) => s + (toMinutes(a.end_time) - toMinutes(a.start_time)), 0);
    return { id: hl.id, name: hl.name, bookings: mine.length, hours: Math.round((minutes / 60) * 10) / 10 };
  });

  return {
    range: { from, to },
    finance: { income, paid, expenses, profit: paid - expenses, debt: totalDebt(), byMethod, byCategory },
    customers: { total: customers.length, new: newCustomers, active: activeIds.size, inactive: Math.max(0, customers.length - activeIds.size) },
    projects: {
      new: projRows.length,
      inProgress: projRows.filter((p) => !FINISHED.includes(p.status)).length,
      delivered: projRows.filter((p) => p.status === 'تحویل شده').length,
      cancelled: projRows.filter((p) => p.status === 'لغو شده').length,
      byStatus: Object.entries(projectsByStatus).map(([name, c]) => ({ name, count: c })),
    },
    appointments: {
      total: appts.length,
      cancelled: appts.filter((a) => a.status === 'لغو شده').length,
      done: appts.filter((a) => a.status === 'انجام شد').length,
      reserved: appts.filter((a) => a.status === 'رزرو شده').length,
    },
    halls: hallStats,
  };
}

export function registerReportRoutes(app: any, _ctx: Ctx) {
  app.get('/api/dashboard/overview', h((_req, res) => ok(res, overview())));

  app.get('/api/dashboard/series', h((req, res) => {
    const range = str(req.query.range) as Range;
    if (!['day', 'week', 'month', 'year'].includes(range)) return fail(res, 400, 'بازه معتبر نیست.');
    return ok(res, series(range));
  }));

  app.get('/api/reports/overview', h((req, res) => {
    const today = getTodayJalali();
    const p = jalaliParts(today);
    const from = normDate(req.query.from) || `${p.y}/${String(p.m).padStart(2, '0')}/01`;
    const to = normDate(req.query.to) || today;
    if (from > to) return fail(res, 400, 'تاریخ شروع باید قبل از تاریخ پایان باشد.');
    return ok(res, detailedReport(from, to));
  }));
}
