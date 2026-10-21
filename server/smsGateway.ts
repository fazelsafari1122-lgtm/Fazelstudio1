/**
 * SMS gateway abstraction. The mock implementation never leaves the process.
 * To go live, implement SmsGateway against a real provider (Kavenegar, Melipayamak, ...)
 * and return it from getSmsGateway().
 */
export interface SmsResult { ok: boolean; response: string }
export interface SmsGateway { send(phone: string, body: string): Promise<SmsResult> }

const MOBILE_RE = /^09\d{9}$/;

export class MockSmsGateway implements SmsGateway {
  async send(phone: string, body: string): Promise<SmsResult> {
    const clean = String(phone || '').replace(/\D/g, '');
    if (!MOBILE_RE.test(clean)) return { ok: false, response: 'شماره موبایل نامعتبر است' };
    if (!body.trim()) return { ok: false, response: 'متن پیام خالی است' };
    return { ok: true, response: 'ارسال شد (درگاه آزمایشی)' };
  }
}

let gateway: SmsGateway = new MockSmsGateway();
export function getSmsGateway(): SmsGateway { return gateway; }
export function setSmsGateway(g: SmsGateway) { gateway = g; }

export function isValidMobile(phone: string): boolean {
  return MOBILE_RE.test(String(phone || '').replace(/\D/g, ''));
}
