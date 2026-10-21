import React from 'react';
import { renderToString } from 'react-dom/server';
import { calcInvoice } from '../src/components/InvoiceFormModal.tsx';
import { previewSms } from '../src/components/SmsComposeModal.tsx';
import { buildCsv } from '../src/components/ui/csv.ts';
import { firstWeekday, normalizeJalali, PersianDatePicker } from '../src/components/ui/PersianDatePicker.tsx';
import { addDays, addMonths, monthLength, weekStart, weekdayIndex } from '../src/utils/jdate.ts';
import { parseHash, hashFor, TAB_PATHS } from '../src/router.ts';
import { errMsg } from '../src/hooks.ts';
import { Chart, Donut } from '../src/components/ui/Chart.tsx';
import { DataTable } from '../src/components/ui/DataTable.tsx';
import { StatCard, StatusBadge, EmptyState, LoadingState, money } from '../src/components/ui/Common.tsx';
import { TimePicker } from '../src/components/ui/TimePicker.tsx';

let pass = 0; let fail = 0;
const check = (name: string, cond: any, extra: any = '') => { if (cond) { pass++; console.log('  ok  ', name); } else { fail++; console.log('  FAIL', name, extra); } };

console.log('# pure logic');
const c = calcInvoice([{ quantity: '2', unit_price: '1,000,000' }, { quantity: 1, unit_price: 500000 }], '200000', '100000', 10);
check('invoice calc matches server (2.64M)', c.subtotal === 2500000 && c.tax === 240000 && c.total === 2640000, c);
check('invoice calc with Persian digits', calcInvoice([{ quantity: '۲', unit_price: '۱۰۰۰' }], '', '', 0).total === 2000);
check('invoice calc empty', calcInvoice([], '', '', 0).total === 0);
check('sms preview fills known vars, keeps unknown', previewSms('سلام {{نام}} {{ساعت}}', { 'نام': 'رضا' }) === 'سلام رضا {{ساعت}}');
check('csv escapes quotes/commas/newlines', buildCsv([{ header: 'a', value: (r: any) => r.a }, { header: 'b', value: (r: any) => r.b }], [{ a: 'x,y', b: 'he said "hi"\nok' }]) === 'a,b\r\n"x,y","he said ""hi""\nok"');
check('normalizeJalali pads + converts', normalizeJalali('۱۴۰۵/۷/۵') === '1405/07/05');
check('normalizeJalali rejects month 7 day 31', normalizeJalali('1405/07/31') === '');
check('normalizeJalali rejects garbage', normalizeJalali('abc') === '');
check('1405/01/01 is Saturday (index 0)', firstWeekday(1405, 1) === 0, firstWeekday(1405, 1));
check('1405/07/01 is Wednesday (index 4)', firstWeekday(1405, 7) === 4, firstWeekday(1405, 7));
check('addDays crosses year end', addDays('1405/12/29', 1) === '1406/01/01', addDays('1405/12/29', 1));
check('addDays negative across month', addDays('1405/02/01', -1) === '1405/01/31');
check('leap year month length (1403 esfand = 30)', monthLength(1403, 12) === 30);
check('non-leap esfand = 29', monthLength(1405, 12) === 29);
check('addMonths rolls year', addMonths('1405/12/10', 1) === '1406/01/01');
check('weekStart is a Saturday', weekdayIndex(weekStart('1405/07/28')) === 0);
check('week has 7 days between starts', addDays(weekStart('1405/07/28'), 7) === weekStart(addDays('1405/07/28', 7)));
for (const [tab, path] of Object.entries(TAB_PATHS)) {
  const r = parseHash('#' + path);
  if (r.tab !== tab) { check(`route roundtrip ${tab}`, false, r); }
}
check('all routes roundtrip', Object.entries(TAB_PATHS).every(([t, p]) => parseHash('#' + p).tab === t));
check('profile route /customers/12', JSON.stringify(parseHash('#/customers/12')) === '{"tab":"customers","id":12}');
check('project route /projects/7', parseHash('#/projects/7').id === 7);
check('hashFor builds', hashFor('customers', 5) === '#/customers/5' && hashFor('prep_photo') === '#/projects/preparation/photo');
check('unknown route falls back to dashboard', parseHash('#/nope').tab === 'dashboard');
check('raw JS error is hidden', errMsg(new TypeError("Cannot read properties of undefined (reading 'x')")) === 'خطایی رخ داد');
check('persian server message is shown', errMsg(new Error('این سالن در این ساعت قبلاً رزرو شده است.')) === 'این سالن در این ساعت قبلاً رزرو شده است.');
check('network error is friendly', errMsg(new TypeError('Failed to fetch')) === 'ارتباط با سرور برقرار نشد');

console.log('\n# server-side render smoke (initial render must not throw)');
const html = (el: React.ReactElement) => renderToString(el).replace(/<!-- -->/g, '');
let h = html(<PersianDatePicker value="1405/07/28" onChange={() => {}} />);
check('date picker renders Persian digits', h.includes('۱۴۰۵/۰۷/۲۸'), h.slice(0, 200));
h = html(<TimePicker value="10:30" onChange={() => {}} />);
check('time picker renders', h.includes('۱۰') && h.includes('۳۰'));
h = html(<Chart labels={['a', 'b']} series={[{ name: 'x', color: '#fff', values: [0, 0] }]} />);
check('chart empty state message', h.includes('داده‌ای در این بازه ثبت نشده است'));
h = html(<Chart labels={['۱', '۲']} series={[{ name: 'x', color: '#fff', values: [5, 10] }]} kind="line" />);
check('line chart renders polyline', h.includes('<polyline'));
h = html(<Donut items={[{ name: 'الف', value: 3, color: '#f00' }, { name: 'ب', value: 1, color: '#0f0' }]} />);
check('donut shows total', h.includes('۴'));
h = html(<DataTable rows={[{ id: 1, n: 'علی' }, { id: 2, n: 'رضا' }]} rowKey={(r) => r.id} exportName="t" columns={[{ key: 'n', header: 'نام', value: (r) => r.n }]} />);
check('table renders rows + excel export button', h.includes('علی') && h.includes('خروجی اکسل'));
h = html(<DataTable rows={[]} rowKey={(r: any) => r.id} onAdd={() => {}} columns={[{ key: 'n', header: 'نام' }]} />);
check('empty table shows Persian empty-state + add button', h.includes('اطلاعاتی برای نمایش وجود ندارد') && h.includes('افزودن مورد جدید'));
h = html(<DataTable rows={Array.from({ length: 40 }, (_, i) => ({ id: i }))} rowKey={(r) => r.id} pageSize={15} columns={[{ key: 'id', header: 'ID', value: (r) => r.id }]} />);
check('pagination appears for >15 rows', h.includes('۴۰ مورد') && h.includes('۱ از ۳'), h.slice(-300));
check('stat card', html(<StatCard label="بدهی" value="۱۰" />).includes('بدهی'));
check('status badge labels invoice status', html(<StatusBadge status="partially_paid" />).includes('پرداخت ناقص'));
check('empty state', html(<EmptyState onAdd={() => {}} />).includes('افزودن مورد جدید'));
check('loading state', html(<LoadingState />).includes('در حال بارگذاری'));
check('money formats with Persian digits', money(1234567) === '۱,۲۳۴,۵۶۷' || money(1234567).includes('۱'), money(1234567));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
