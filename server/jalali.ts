import * as jalaali from 'jalaali-js';

const PERSIAN_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
const ARABIC_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

export function toEnglishDigits(str: string | number | undefined | null): string {
  if (str === undefined || str === null) return '';
  let res = String(str);
  for (let i = 0; i < 10; i++) {
    res = res.replaceAll(PERSIAN_DIGITS[i], String(i));
    res = res.replaceAll(ARABIC_DIGITS[i], String(i));
  }
  return res;
}

export function parseFinancialNumber(val: any): number {
  if (val === undefined || val === null || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : Math.round(val);
  const clean = toEnglishDigits(val).replace(/[,،\s_]/g, '');
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

export function getTodayJalali(): string {
  const now = new Date();
  const j = jalaali.toJalaali(now.getFullYear(), now.getMonth() + 1, now.getDate());
  const mm = String(j.jm).padStart(2, '0');
  const dd = String(j.jd).padStart(2, '0');
  return `${j.jy}/${mm}/${dd}`;
}
