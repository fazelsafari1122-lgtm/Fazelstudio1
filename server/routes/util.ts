import { db } from '../db.ts';
import { toEnglishDigits, jalaliToGregorianDateStr, gregorianToJalaliDateStr } from '../jalali.ts';

export interface Ctx {
  getAuthUser: (req: any) => any;
  logAudit: (userId: number | null, userName: string, action: string, object: string, objectId: string, oldVal: any, newVal: any) => void;
}

export const GENERIC_ERROR = 'خطایی رخ داد. لطفاً دوباره تلاش کنید.';

export function ok(res: any, data: any = null, message = '') {
  return res.json({ success: true, data, message });
}

export function fail(res: any, status: number, message: string, extra: Record<string, any> = {}) {
  return res.status(status).json({ success: false, message, ...extra });
}

/** Wrap a (possibly async) route handler so raw JS errors never reach the client. */
export function h(fn: (req: any, res: any) => any) {
  return async (req: any, res: any) => {
    try {
      return await fn(req, res);
    } catch (err) {
      console.error('Route error:', req.method, req.originalUrl, err);
      if (!res.headersSent) return fail(res, 500, GENERIC_ERROR);
    }
  };
}

export function tx<T>(fn: () => T): T {
  db.exec('BEGIN TRANSACTION;');
  try {
    const r = fn();
    db.exec('COMMIT;');
    return r;
  } catch (e) {
    db.exec('ROLLBACK;');
    throw e;
  }
}

export function str(v: any): string {
  return v === undefined || v === null ? '' : String(v).trim();
}

export function num(v: any): number {
  if (v === undefined || v === null || v === '') return 0;
  const n = Number(toEnglishDigits(v).replace(/[,،\s_]/g, ''));
  return Number.isFinite(n) ? Math.round(n) : 0;
}

export function normDate(v: any): string {
  const s = toEnglishDigits(str(v)).replace(/-/g, '/');
  const m = s.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (!m) return '';
  const y = Number(m[1]); const mo = Number(m[2]); const d = Number(m[3]);
  if (y < 1300 || y > 1600 || mo < 1 || mo > 12 || d < 1 || d > 31) return '';
  if (mo > 6 && d > 30) return '';
  return `${y}/${String(mo).padStart(2, '0')}/${String(d).padStart(2, '0')}`;
}

export function normTime(v: any): string {
  const s = toEnglishDigits(str(v));
  const m = s.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return '';
  const hh = Number(m[1]); const mm = Number(m[2]);
  if (hh > 23 || mm > 59) return '';
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

export function normPhone(v: any): string {
  return toEnglishDigits(str(v)).replace(/[\s\-()]/g, '');
}

export function toMinutes(t: string): number {
  const [hh, mm] = t.split(':').map(Number);
  return hh * 60 + mm;
}

export function fromMinutes(m: number): string {
  const hh = Math.floor(m / 60) % 24;
  return `${String(hh).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

function jalaliToUtc(j: string): Date | null {
  const g = jalaliToGregorianDateStr(j);
  if (!g) return null;
  const [y, m, d] = g.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function utcToJalali(d: Date): string {
  return gregorianToJalaliDateStr(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`);
}

export function addDaysJalali(j: string, days: number): string {
  const d = jalaliToUtc(j);
  if (!d) return j;
  d.setUTCDate(d.getUTCDate() + days);
  return utcToJalali(d);
}

/** Saturday = 0 ... Friday = 6 */
export function weekdayIndex(j: string): number {
  const d = jalaliToUtc(j);
  if (!d) return 0;
  return (d.getUTCDay() + 1) % 7;
}

export function weekStartJalali(j: string): string {
  return addDaysJalali(j, -weekdayIndex(j));
}

export function jalaliParts(j: string): { y: number; m: number; d: number } {
  const [y, m, d] = j.split('/').map(Number);
  return { y, m, d };
}

export function nowTimeHHMM(): string {
  const n = new Date();
  return `${String(n.getHours()).padStart(2, '0')}:${String(n.getMinutes()).padStart(2, '0')}`;
}

export function ageFromJalali(birth: string | null | undefined, today: string): number | null {
  const b = normDate(birth);
  if (!b) return null;
  const bp = jalaliParts(b); const tp = jalaliParts(today);
  let age = tp.y - bp.y;
  if (tp.m < bp.m || (tp.m === bp.m && tp.d < bp.d)) age -= 1;
  return age < 0 ? null : age;
}

export function formatMoney(n: number): string {
  return Number(n || 0).toLocaleString('fa-IR');
}

export function fullName(first?: string | null, last?: string | null) {
  return `${first || ''} ${last || ''}`.trim();
}
