import { db } from './db.ts';

/** Recompute paid / remaining for a contract and its invoices from the payments table. */
export function syncContractAndInvoiceBalances(contractId: number) {
  const contract = db.prepare('SELECT id, final_amount FROM contracts WHERE id = ?').get(contractId) as any;
  if (!contract) return;
  const paidRow = db.prepare('SELECT COALESCE(SUM(amount), 0) AS total_paid FROM payments WHERE contract_id = ?').get(contractId) as any;
  const totalPaid = Math.round(Number(paidRow.total_paid) || 0);
  const remaining = Math.max(0, contract.final_amount - totalPaid);
  const paymentStatus = remaining === 0 ? 'تسویه شده' : totalPaid > 0 ? 'پرداخت ناقص' : 'ثبت شده';
  db.prepare(`
    UPDATE contracts
    SET paid_amount = ?, remaining_amount = ?,
        status = CASE WHEN status IN ('لغو شده', 'تکمیل شده', 'فعال') THEN status ELSE ? END
    WHERE id = ?
  `).run(totalPaid, remaining, paymentStatus, contractId);

  const invoices = db.prepare('SELECT id, total FROM invoices WHERE contract_id = ?').all(contractId) as any[];
  for (const inv of invoices) {
    const invRemaining = Math.max(0, inv.total - totalPaid);
    const invStatus = invRemaining === 0 ? 'paid' : totalPaid > 0 ? 'partially_paid' : 'unpaid';
    db.prepare('UPDATE invoices SET paid_amount = ?, remaining_amount = ?, status = ? WHERE id = ?').run(totalPaid, invRemaining, invStatus, inv.id);
  }
}

export function syncInvoiceBalance(invoiceId: number) {
  const invoice = db.prepare('SELECT id, total, contract_id, status FROM invoices WHERE id = ?').get(invoiceId) as any;
  if (!invoice) return;
  if (invoice.contract_id) {
    syncContractAndInvoiceBalances(invoice.contract_id);
    return;
  }
  const paidRow = db.prepare('SELECT COALESCE(SUM(amount), 0) AS total_paid FROM payments WHERE invoice_id = ?').get(invoiceId) as any;
  const totalPaid = Math.round(Number(paidRow.total_paid) || 0);
  const remaining = Math.max(0, invoice.total - totalPaid);
  const status = invoice.status === 'cancelled' ? 'cancelled' : remaining === 0 ? 'paid' : totalPaid > 0 ? 'partially_paid' : 'unpaid';
  db.prepare('UPDATE invoices SET paid_amount = ?, remaining_amount = ?, status = ? WHERE id = ?').run(totalPaid, remaining, status, invoiceId);
}

export function syncPaymentTargets(p: { contract_id?: number | null; invoice_id?: number | null }) {
  if (p.contract_id) syncContractAndInvoiceBalances(p.contract_id);
  else if (p.invoice_id) syncInvoiceBalance(p.invoice_id);
}

export interface NewPayment {
  customer_id: number;
  amount: number;
  payment_date: string;
  payment_time?: string | null;
  payment_method: string;
  bank_account?: string | null;
  tracking_code?: string | null;
  receiver_name?: string | null;
  description?: string | null;
  invoice_id?: number | null;
  contract_id?: number | null;
}

/** Insert a payment and refresh every dependent balance. Caller wraps in a transaction if needed. */
export function insertPayment(p: NewPayment): number {
  const num = `PAY-${Date.now().toString().slice(-7)}${Math.floor(Math.random() * 90 + 10)}`;
  const res = db.prepare(`
    INSERT INTO payments (payment_number, contract_id, invoice_id, customer_id, amount, payment_date, payment_time,
                          payment_method, bank_account, tracking_code, receiver_name, description)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    num, p.contract_id ?? null, p.invoice_id ?? null, p.customer_id, p.amount, p.payment_date, p.payment_time ?? null,
    p.payment_method, p.bank_account ?? null, p.tracking_code ?? null, p.receiver_name ?? 'مدیریت استودیو', p.description ?? null
  );
  syncPaymentTargets(p);
  return Number(res.lastInsertRowid);
}

export function removePayment(paymentId: number) {
  const pay = db.prepare('SELECT * FROM payments WHERE id = ?').get(paymentId) as any;
  if (!pay) return;
  db.prepare('DELETE FROM payments WHERE id = ?').run(paymentId);
  syncPaymentTargets(pay);
}

/** Total unpaid balance for a customer (non-cancelled invoices). Contract-linked invoices are already included. */
export function customerDebt(customerId: number): number {
  const row = db.prepare(`
    SELECT COALESCE(SUM(remaining_amount), 0) AS d FROM invoices
    WHERE customer_id = ? AND status != 'cancelled'
  `).get(customerId) as any;
  const contractsWithoutInvoice = db.prepare(`
    SELECT COALESCE(SUM(c.remaining_amount), 0) AS d FROM contracts c
    WHERE c.customer_id = ? AND c.status != 'لغو شده'
      AND NOT EXISTS (SELECT 1 FROM invoices i WHERE i.contract_id = c.id)
  `).get(customerId) as any;
  return Math.round(Number(row.d) + Number(contractsWithoutInvoice.d));
}
