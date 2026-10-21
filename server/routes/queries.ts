import { db } from '../db.ts';
import { customerDebt } from '../finance.ts';
import { getTodayJalali } from '../jalali.ts';
import { ageFromJalali } from './util.ts';

const PAID_SQL = `
  COALESCE((
    SELECT SUM(x.amount) FROM payments x WHERE x.id IN (
      SELECT id FROM payments WHERE p.contract_id IS NOT NULL AND contract_id = p.contract_id
      UNION
      SELECT pay.id FROM payments pay JOIN invoices i ON pay.invoice_id = i.id
      WHERE i.project_id = p.id AND i.contract_id IS NULL
    )
  ), 0)`;

const AMOUNT_SQL = `
  CASE
    WHEN COALESCE(p.amount, 0) > 0 THEN p.amount
    WHEN c.final_amount IS NOT NULL THEN c.final_amount
    ELSE COALESCE((SELECT SUM(total) FROM invoices WHERE project_id = p.id AND status != 'cancelled'), 0)
  END`;

export function projectRows(where = '1=1', params: any[] = []) {
  const rows = db.prepare(`
    SELECT p.*, cu.first_name AS customer_first, cu.last_name AS customer_last, cu.phone AS customer_phone,
           c.contract_number,
           ${AMOUNT_SQL} AS amount_eff,
           ${PAID_SQL} AS paid
    FROM projects p
    JOIN customers cu ON cu.id = p.customer_id
    LEFT JOIN contracts c ON c.id = p.contract_id
    WHERE ${where}
    ORDER BY p.id DESC
  `).all(...params) as any[];
  return rows.map((r) => {
    const amount = Number(r.amount_eff) || 0;
    const paid = Number(r.paid) || 0;
    return { ...r, amount, paid, remaining: Math.max(0, amount - paid) };
  });
}

export function membersByCustomer(ids?: number[]) {
  const rows = (ids && ids.length
    ? db.prepare(`SELECT * FROM family_members WHERE customer_id IN (${ids.map(() => '?').join(',')}) ORDER BY sort_order, id`).all(...ids)
    : db.prepare('SELECT * FROM family_members ORDER BY sort_order, id').all()) as any[];
  const today = getTodayJalali();
  const map = new Map<number, any[]>();
  for (const m of rows) {
    const withAge = { ...m, age: ageFromJalali(m.birth_date, today) };
    if (!map.has(m.customer_id)) map.set(m.customer_id, []);
    map.get(m.customer_id)!.push(withAge);
  }
  return map;
}

export function tagsByCustomer() {
  const rows = db.prepare(`
    SELECT ct.customer_id, t.id, t.name, t.color FROM customer_tags ct JOIN tags t ON t.id = ct.tag_id ORDER BY t.name
  `).all() as any[];
  const map = new Map<number, any[]>();
  for (const r of rows) {
    if (!map.has(r.customer_id)) map.set(r.customer_id, []);
    map.get(r.customer_id)!.push({ id: r.id, name: r.name, color: r.color });
  }
  return map;
}

export function appointmentRows(where = '1=1', params: any[] = []) {
  return db.prepare(`
    SELECT a.*, cu.first_name AS customer_first, cu.last_name AS customer_last, cu.phone AS customer_phone,
           h.name AS hall_name, b.name AS branch_name
    FROM appointments a
    JOIN customers cu ON cu.id = a.customer_id
    JOIN halls h ON h.id = a.hall_id
    JOIN branches b ON b.id = a.branch_id
    WHERE ${where}
    ORDER BY a.date, a.start_time
  `).all(...params) as any[];
}

export function totalDebt(): number {
  const a = db.prepare("SELECT COALESCE(SUM(remaining_amount),0) AS d FROM invoices WHERE status != 'cancelled'").get() as any;
  const b = db.prepare(`
    SELECT COALESCE(SUM(c.remaining_amount),0) AS d FROM contracts c
    WHERE c.status != 'لغو شده' AND NOT EXISTS (SELECT 1 FROM invoices i WHERE i.contract_id = c.id)
  `).get() as any;
  return Math.round(Number(a.d) + Number(b.d));
}

export { customerDebt };
