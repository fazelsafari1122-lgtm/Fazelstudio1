import { db } from './db.ts';
import { getSmsGateway, isValidMobile } from './smsGateway.ts';
import { getTodayJalali } from './jalali.ts';
import { nowTimeHHMM, formatMoney } from './routes/util.ts';
import { customerDebt } from './finance.ts';

export const SMS_PENDING = 'در انتظار';
export const SMS_SENDING = 'در حال ارسال';
export const SMS_SENT = 'ارسال شد';
export const SMS_FAILED = 'خطا';

/** Replace {{key}} placeholders. Returns the text and the list of keys that had no value. */
export function renderTemplate(text: string, vars: Record<string, any>): { text: string; missing: string[] } {
  const missing: string[] = [];
  const out = text.replace(/\{\{\s*([^{}]+?)\s*\}\}|\{([^{}\s]+)\}/g, (_m, k1, k2) => {
    const key = k1 || k2;
    const v = vars[key];
    if (v === undefined || v === null || v === '') {
      if (!missing.includes(key)) missing.push(key);
      return '';
    }
    return String(v);
  });
  return { text: out, missing };
}

export function customerVars(customerId: number | null | undefined): Record<string, any> {
  if (!customerId) return {};
  const c = db.prepare('SELECT first_name, last_name FROM customers WHERE id = ?').get(customerId) as any;
  if (!c) return {};
  const debt = customerDebt(customerId);
  return { 'نام': c.first_name, 'نام_خانوادگی': c.last_name, 'مانده': `${formatMoney(debt)} تومان` };
}

export interface EnqueueInput {
  customer_id?: number | null;
  phone: string;
  body: string;
  template_id?: number | null;
  scheduled_date?: string | null;
  scheduled_time?: string | null;
}

export function enqueueSms(i: EnqueueInput): number {
  const r = db.prepare(`
    INSERT INTO sms_messages (customer_id, phone, template_id, message_body, status, provider_response, scheduled_date, scheduled_time)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(i.customer_id ?? null, i.phone, i.template_id ?? null, i.body, SMS_PENDING, 'در صف ارسال', i.scheduled_date ?? null, i.scheduled_time ?? null);
  return Number(r.lastInsertRowid);
}

function isDue(row: any, today: string, now: string) {
  if (!row.scheduled_date) return true;
  if (row.scheduled_date < today) return true;
  if (row.scheduled_date > today) return false;
  return !row.scheduled_time || row.scheduled_time <= now;
}

export async function sendOne(id: number) {
  const row = db.prepare('SELECT * FROM sms_messages WHERE id = ?').get(id) as any;
  if (!row) return null;
  db.prepare('UPDATE sms_messages SET status = ? WHERE id = ?').run(SMS_SENDING, id);
  let ok = false; let response = '';
  try {
    if (!isValidMobile(row.phone)) { response = 'شماره موبایل نامعتبر است'; }
    else {
      const r = await getSmsGateway().send(row.phone, row.message_body);
      ok = r.ok; response = r.response;
    }
  } catch {
    response = 'خطا در ارتباط با درگاه پیامک';
  }
  db.prepare('UPDATE sms_messages SET status = ?, provider_response = ?, sent_date = ?, sent_time = ?, sent_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(ok ? SMS_SENT : SMS_FAILED, response, getTodayJalali(), nowTimeHHMM(), id);
  return { id, ok, response };
}

/** Send every pending message that is due. `onlyIds` limits the run. */
export async function processQueue(onlyIds?: number[]) {
  const today = getTodayJalali();
  const now = nowTimeHHMM();
  const rows = db.prepare('SELECT * FROM sms_messages WHERE status = ? ORDER BY id').all(SMS_PENDING) as any[];
  let sent = 0; let failed = 0; let waiting = 0;
  for (const r of rows) {
    if (onlyIds && !onlyIds.includes(r.id)) continue;
    if (!isDue(r, today, now)) { waiting++; continue; }
    const res = await sendOne(r.id);
    if (res?.ok) sent++; else failed++;
  }
  return { sent, failed, waiting };
}
