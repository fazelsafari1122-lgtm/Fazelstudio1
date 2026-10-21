import * as jalaali from 'jalaali-js';
import { JALALI_MONTH_NAMES } from './jalali.ts';

export const WEEKDAYS = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه'];

export const pad2 = (n: number) => String(n).padStart(2, '0');

export function parseJ(j: string): { y: number; m: number; d: number } {
  const [y, m, d] = j.split('/').map(Number);
  return { y, m, d };
}

export function fmtJ(y: number, m: number, d: number) {
  return `${y}/${pad2(m)}/${pad2(d)}`;
}

function toUtc(j: string): Date {
  const { y, m, d } = parseJ(j);
  const g = jalaali.toGregorian(y, m, d);
  return new Date(Date.UTC(g.gy, g.gm - 1, g.gd));
}

function fromUtc(dt: Date): string {
  const j = jalaali.toJalaali(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
  return fmtJ(j.jy, j.jm, j.jd);
}

export function addDays(j: string, n: number): string {
  const dt = toUtc(j);
  dt.setUTCDate(dt.getUTCDate() + n);
  return fromUtc(dt);
}

/** Saturday = 0 ... Friday = 6 */
export function weekdayIndex(j: string): number {
  return (toUtc(j).getUTCDay() + 1) % 7;
}

export function weekStart(j: string): string {
  return addDays(j, -weekdayIndex(j));
}

export function monthLength(y: number, m: number): number {
  return jalaali.jalaaliMonthLength(y, m);
}

export function monthStart(j: string): string {
  const { y, m } = parseJ(j);
  return fmtJ(y, m, 1);
}

export function monthEnd(j: string): string {
  const { y, m } = parseJ(j);
  return fmtJ(y, m, monthLength(y, m));
}

export function addMonths(j: string, n: number): string {
  let { y, m } = parseJ(j);
  m += n;
  while (m > 12) { m -= 12; y++; }
  while (m < 1) { m += 12; y--; }
  return fmtJ(y, m, 1);
}

export function monthTitle(j: string): string {
  const { y, m } = parseJ(j);
  return `${JALALI_MONTH_NAMES[m - 1]} ${y}`;
}

export const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
export const fromMin = (n: number) => `${pad2(Math.floor(n / 60) % 24)}:${pad2(n % 60)}`;
