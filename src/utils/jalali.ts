import * as jalaali from 'jalaali-js';

const PERSIAN_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
const ENGLISH_DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

export const JALALI_MONTH_NAMES = [
  'فروردین', 'اردیبهشت', 'خرداد',
  'تیر', 'مرداد', 'شهریور',
  'مهر', 'آبان', 'آذر',
  'دی', 'بهمن', 'اسفند'
];

export const JALALI_WEEK_DAYS = [
  'شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'جمعه'
];

export function toPersianDigits(n: number | string | undefined | null): string {
  if (n === undefined || n === null || n === '') return '-';
  const str = String(n);
  return str.replace(/\d/g, (d) => PERSIAN_DIGITS[Number(d)] || d);
}

export function toEnglishDigits(str: any): string {
  if (str === null || str === undefined) return '';
  let res = String(str);
  for (let i = 0; i < 10; i++) {
    res = res.replace(new RegExp(PERSIAN_DIGITS[i], 'g'), ENGLISH_DIGITS[i]);
  }
  return res;
}

export function formatCurrency(amount: number | undefined | null, showUnit = true, forceEnglish = false): string {
  if (amount === undefined || amount === null) return forceEnglish ? '0' : '۰ تومان';
  const formatted = Math.round(amount).toLocaleString('en-US');
  if (forceEnglish) return showUnit ? `${formatted}` : formatted;
  const persianFormatted = Math.round(amount).toLocaleString('fa-IR');
  return showUnit ? `${persianFormatted} تومان` : persianFormatted;
}

export function getTodayJalali(): string {
  const now = new Date();
  const j = jalaali.toJalaali(now.getFullYear(), now.getMonth() + 1, now.getDate());
  const mm = String(j.jm).padStart(2, '0');
  const dd = String(j.jd).padStart(2, '0');
  return `${j.jy}/${mm}/${dd}`;
}

export function getJalaliDateParts(dateStr: string): { jy: number; jm: number; jd: number } | null {
  if (!dateStr) return null;
  const clean = toEnglishDigits(dateStr);
  const parts = clean.split(/[-/]/).map(Number);
  if (parts.length >= 3 && parts[0] > 1300) {
    return { jy: parts[0], jm: parts[1], jd: parts[2] };
  }
  return null;
}

export function formatJalaliHuman(dateStr: string): string {
  const parts = getJalaliDateParts(dateStr);
  if (!parts) return dateStr || '-';
  const monthName = JALALI_MONTH_NAMES[parts.jm - 1] || '';
  return `${toPersianDigits(parts.jd)} ${monthName} ${toPersianDigits(parts.jy)}`;
}

export function getMonthDaysCount(jy: number, jm: number): number {
  return jalaali.jalaaliMonthLength(jy, jm);
}

export function parseFinancialNumber(val: any): number {
  if (val === undefined || val === null || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : Math.round(val);
  const clean = toEnglishDigits(String(val)).replace(/[,،\s_]/g, '');
  const n = Number(clean);
  return isNaN(n) ? 0 : Math.round(n);
}

export function jalaliToGregorianDateStr(jalaliStr: string): string {
  if (!jalaliStr) return '';
  const clean = toEnglishDigits(jalaliStr).trim();
  const parts = clean.split(/[-/]/).map(Number);
  if (parts.length < 3 || parts[0] < 1300) return '';
  const g = jalaali.toGregorian(parts[0], parts[1], parts[2]);
  return `${g.gy}-${String(g.gm).padStart(2, '0')}-${String(g.gd).padStart(2, '0')}`;
}

export function gregorianToJalaliDateStr(gregorianStr: string): string {
  if (!gregorianStr) return '';
  const clean = toEnglishDigits(gregorianStr).trim();
  const parts = clean.split(/[-/]/).map(Number);
  if (parts.length < 3 || parts[0] < 1900) return '';
  const j = jalaali.toJalaali(parts[0], parts[1], parts[2]);
  return `${j.jy}/${String(j.jm).padStart(2, '0')}/${String(j.jd).padStart(2, '0')}`;
}
