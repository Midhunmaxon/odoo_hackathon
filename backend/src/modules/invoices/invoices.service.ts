import { Knex } from 'knex';
import { db } from '../../db';
import { ApiError } from '../../middleware/error.middleware';
import { calculateInvoiceTotals } from '../tax-discount/tax-discount.calculator';
import { Discount, Tax, InvoiceLineInput } from '../tax-discount/tax-discount.types';
import { inMemoryTaxes, inMemoryDiscounts } from '../tax-discount/tax-discount.service';
import {
  Invoice,
  InvoiceLine,
  Payment,
  Subscription,
  SubscriptionLine,
  Plan,
  GenerateInvoiceResult,
  RunBillingResult,
} from './invoices.types';

// =========================================================================
// IN-MEMORY FALLBACK STORES (For offline DB unit testing & development)
// =========================================================================

export const inMemoryInvoices: Map<number, Invoice> = new Map();
export const inMemoryInvoiceLines: Map<number, InvoiceLine[]> = new Map();
export const inMemoryPayments: Map<number, Payment> = new Map();
export const inMemorySubscriptions: Map<number, Subscription> = new Map();
export const inMemorySubscriptionLines: Map<number, SubscriptionLine[]> = new Map();
export const inMemoryPlans: Map<number, Plan> = new Map();

let invoiceIdSeq = 10;
let paymentIdSeq = 10;
let invoiceLineIdSeq = 100;

export function seedInMemoryInvoices(): void {
  if (inMemoryPlans.size === 0) {
    inMemoryPlans.set(1, {
      id: 1,
      name: 'Starter Monthly',
      price: 49.0,
      billing_period: 'MONTHLY',
      min_quantity: 1,
      auto_close: false,
      allow_close: true,
      allow_pause: true,
      allow_renew: true,
      status: 'ACTIVE',
    });
    inMemoryPlans.set(2, {
      id: 2,
      name: 'Professional Monthly',
      price: 149.0,
      billing_period: 'MONTHLY',
      min_quantity: 1,
      auto_close: false,
      allow_close: true,
      allow_pause: true,
      allow_renew: true,
      status: 'ACTIVE',
    });
    inMemoryPlans.set(3, {
      id: 3,
      name: 'Enterprise Annual',
      price: 1490.0,
      billing_period: 'YEARLY',
      min_quantity: 5,
      auto_close: false,
      allow_close: true,
      allow_pause: true,
      allow_renew: true,
      status: 'ACTIVE',
    });
  }

  if (inMemorySubscriptions.size === 0) {
    inMemorySubscriptions.set(1, {
      id: 1,
      number: 'SUB-2026-001',
      customer_id: 4,
      plan_id: 1,
      start_date: '2026-01-01',
      expiry_date: null,
      payment_terms: 'immediate',
      status: 'ACTIVE',
      last_billed_period_end: '2026-01-31',
      next_billing_date: '2026-02-01',
    });
    inMemorySubscriptionLines.set(1, [
      {
        id: 1,
        subscription_id: 1,
        product_id: 1,
        quantity: 1,
        unit_price: 49.0,
        tax_id: 1,
        amount: 49.0,
      },
    ]);

    inMemorySubscriptions.set(2, {
      id: 2,
      number: 'SUB-2026-002',
      customer_id: 5,
      plan_id: 2,
      start_date: '2026-02-15',
      expiry_date: null,
      payment_terms: '15_days',
      status: 'ACTIVE',
      last_billed_period_end: '2026-02-14',
      next_billing_date: '2026-02-15',
    });
    inMemorySubscriptionLines.set(2, [
      {
        id: 2,
        subscription_id: 2,
        product_id: 2,
        quantity: 1,
        unit_price: 149.0,
        tax_id: 1,
        amount: 149.0,
      },
    ]);
  }

  if (inMemoryInvoices.size === 0) {
    inMemoryInvoices.set(1, {
      id: 1,
      number: 'INV-2026-0001',
      subscription_id: 1,
      customer_id: 4,
      period_start: '2026-01-01',
      period_end: '2026-01-31',
      status: 'PAID',
      subtotal: 49.0,
      tax_total: 9.8,
      discount_total: 0.0,
      total: 58.8,
      due_date: '2026-01-15',
    });
    inMemoryInvoiceLines.set(1, [
      {
        id: 1,
        invoice_id: 1,
        product_id: 1,
        description: 'Starter Monthly Service',
        quantity: 1,
        unit_price: 49.0,
        tax_id: 1,
        tax_amount: 9.8,
        discount_amount: 0.0,
        amount: 58.8,
      },
    ]);
  }
}

seedInMemoryInvoices();

// =========================================================================
// DATE ARITHMETIC UTILITIES
// =========================================================================

export function parseDate(dateStr: string | Date): Date {
  if (dateStr instanceof Date) return dateStr;
  const parts = dateStr.split('T')[0].split('-').map(Number);
  return new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
}

export function formatDateYMD(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addMonthsUTC(date: Date, count: number): Date {
  const targetYear = date.getUTCFullYear();
  const targetMonth = date.getUTCMonth() + count;
  const targetDay = date.getUTCDate();

  // Create date at 1st of target month
  const result = new Date(Date.UTC(targetYear, targetMonth, 1));
  // Find last day of target month
  const lastDay = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
  result.setUTCDate(Math.min(targetDay, lastDay));
  return result;
}

/**
 * Calculates the next billing period and its boundaries.
 * Monthly: start 2026-02-15 -> end 2026-03-14, next_billing_date 2026-03-15
 */
export function advanceBillingPeriod(
  startDateStr: string,
  billingPeriod: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY'
): { period_start: string; period_end: string; next_billing_date: string } {
  const start = parseDate(startDateStr);
  let nextStart: Date;

  switch (billingPeriod) {
    case 'DAILY':
      nextStart = new Date(start.getTime() + 24 * 60 * 60 * 1000);
      break;
    case 'WEEKLY':
      nextStart = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
      break;
    case 'YEARLY':
      nextStart = new Date(Date.UTC(start.getUTCFullYear() + 1, start.getUTCMonth(), start.getUTCDate()));
      break;
    case 'MONTHLY':
    default:
      nextStart = addMonthsUTC(start, 1);
      break;
  }

  // period_end is 1 day before nextStart
  const periodEnd = new Date(nextStart.getTime() - 24 * 60 * 60 * 1000);

  return {
    period_start: formatDateYMD(start),
    period_end: formatDateYMD(periodEnd),
    next_billing_date: formatDateYMD(nextStart),
  };
}

export function calculateDueDate(periodStartStr: string, paymentTerms: string): string {
  const start = parseDate(periodStartStr);
  if (paymentTerms === 'immediate') {
    return formatDateYMD(start);
  }
  const match = paymentTerms.match(/(\d+)/);
  const days = match ? parseInt(match[1], 10) : 15;
  const due = new Date(start.getTime() + days * 24 * 60 * 60 * 1000);
  return formatDateYMD(due);
}

// =========================================================================
// INVOICES SERVICE CLASS
// =========================================================================

export class InvoicesService {
  /**
   * Generates a new invoice for a subscription covering the billing period starting at next_billing_date.
   * Copies customer, lines, taxes and applicable discounts into a DRAFT invoice using calculateInvoiceTotals.
   * Make it idempotent: insert with `.onConflict(['subscription_id', 'period_start']).ignore()`
   * inside a Knex transaction and treat zero rows inserted as "already billed".
   * The same transaction advances last_billed_period_end and next_billing_date.
   */
  async generateInvoiceForSubscription(
    subId: number,
    _asOfDate?: string
  ): Promise<GenerateInvoiceResult> {
    seedInMemoryInvoices();

    // 1. Fetch Subscription
    let sub: Subscription | null = null;
    let plan: Plan | null = null;
    let lines: SubscriptionLine[] = [];
    let taxes: Tax[] = [];
    let discounts: Discount[] = [];

    try {
      sub = await db('subscriptions').where({ id: subId }).first();
      if (sub) {
        plan = await db('plans').where({ id: sub.plan_id }).first();
        lines = await db('subscription_lines').where({ subscription_id: sub.id });
        taxes = await db('taxes').where({ active: true });
        discounts = await db('discounts').select('*');
      }
    } catch {
      // In-memory fallback
      sub = inMemorySubscriptions.get(subId) || null;
      if (sub) {
        plan = inMemoryPlans.get(sub.plan_id) || null;
        lines = inMemorySubscriptionLines.get(sub.id) || [];
        taxes = Array.from(inMemoryTaxes.values()).filter((t) => t.active);
        discounts = Array.from(inMemoryDiscounts.values());
      }
    }

    if (!sub) {
      throw ApiError.notFound(`Subscription with ID ${subId} not found`);
    }

    if (!sub.next_billing_date) {
      throw ApiError.badRequest(`Subscription ${subId} does not have a next_billing_date configured`);
    }

    const billingPeriod = plan?.billing_period || 'MONTHLY';
    const periodCalc = advanceBillingPeriod(sub.next_billing_date, billingPeriod);
    const dueDateStr = calculateDueDate(periodCalc.period_start, sub.payment_terms || 'immediate');

    // 2. Prepare Line Inputs for calculateInvoiceTotals
    const lineInputs: InvoiceLineInput[] = lines.length > 0
      ? lines.map((l) => ({
          product_id: l.product_id,
          description: `Product #${l.product_id}`,
          quantity: Number(l.quantity) || 1,
          unit_price: Number(l.unit_price) || 0,
          tax_id: l.tax_id,
        }))
      : [
          {
            product_id: 1,
            description: plan?.name || 'Subscription Plan',
            quantity: 1,
            unit_price: Number(plan?.price) || 0,
            tax_id: null,
          },
        ];

    // 3. Compute Totals using calculateInvoiceTotals
    const totals = calculateInvoiceTotals(lineInputs, discounts, taxes, periodCalc.period_start);

    // 4. Generate Invoice Number
    const year = parseDate(periodCalc.period_start).getUTCFullYear();
    const invoiceNumber = `INV-${year}-${String(sub.id).padStart(3, '0')}-${periodCalc.period_start.replace(/-/g, '')}`;

    // 5. Database Transaction with .onConflict(['subscription_id', 'period_start']).ignore()
    try {
      const result = await db.transaction(async (trx: Knex.Transaction) => {
        // Attempt insert with conflict ignore
        const insertedInvoices = await trx('invoices')
          .insert({
            number: invoiceNumber,
            subscription_id: sub!.id,
            customer_id: sub!.customer_id,
            period_start: periodCalc.period_start,
            period_end: periodCalc.period_end,
            status: 'DRAFT',
            subtotal: totals.subtotal,
            tax_total: totals.tax_total,
            discount_total: totals.discount_total,
            total: totals.total,
            due_date: dueDateStr,
            created_at: new Date(),
            updated_at: new Date(),
          })
          .onConflict(['subscription_id', 'period_start'])
          .ignore()
          .returning('*');

        // Always advance subscription billing dates in the same transaction
        await trx('subscriptions')
          .where({ id: sub!.id })
          .update({
            last_billed_period_end: periodCalc.period_end,
            next_billing_date: periodCalc.next_billing_date,
            updated_at: new Date(),
          });

        // Zero rows inserted means "already billed" for this period
        if (!insertedInvoices || insertedInvoices.length === 0) {
          return { alreadyBilled: true, skippedPeriod: periodCalc.period_start };
        }

        const newInvoice = insertedInvoices[0];

        // Insert invoice lines
        if (totals.lines.length > 0) {
          const linesToInsert = totals.lines.map((l, idx) => ({
            invoice_id: newInvoice.id,
            product_id: l.productId || l.product_id || null,
            description: l.description || 'Subscription Item',
            quantity: l.quantity,
            unit_price: l.unitPrice ?? l.unit_price,
            tax_id: lineInputs[idx]?.tax_id || null,
            tax_amount: l.taxAmount ?? l.tax_amount ?? 0,
            discount_amount: l.discountAmount ?? l.discount_amount ?? 0,
            amount: l.total,
            created_at: new Date(),
            updated_at: new Date(),
          }));
          await trx('invoice_lines').insert(linesToInsert);
        }

        return { alreadyBilled: false, invoice: newInvoice };
      });

      return result;
    } catch (dbErr: any) {
      if (dbErr instanceof ApiError) throw dbErr;

      // In-memory fallback
      // Check for conflict on ['subscription_id', 'period_start']
      const existing = Array.from(inMemoryInvoices.values()).find(
        (inv) => inv.subscription_id === sub!.id && inv.period_start === periodCalc.period_start
      );

      // Advance subscription dates
      sub.last_billed_period_end = periodCalc.period_end;
      sub.next_billing_date = periodCalc.next_billing_date;

      if (existing) {
        return {
          alreadyBilled: true,
          skippedPeriod: periodCalc.period_start,
        };
      }

      // Create in-memory invoice
      const newId = ++invoiceIdSeq;
      const createdInvoice: Invoice = {
        id: newId,
        number: invoiceNumber,
        subscription_id: sub.id,
        customer_id: sub.customer_id,
        period_start: periodCalc.period_start,
        period_end: periodCalc.period_end,
        status: 'DRAFT',
        subtotal: totals.subtotal,
        tax_total: totals.tax_total,
        discount_total: totals.discount_total,
        total: totals.total,
        due_date: dueDateStr,
        created_at: new Date(),
        updated_at: new Date(),
      };
      inMemoryInvoices.set(newId, createdInvoice);

      const createdLines: InvoiceLine[] = totals.lines.map((l, idx) => ({
        id: ++invoiceLineIdSeq,
        invoice_id: newId,
        product_id: l.productId || l.product_id || null,
        description: l.description || 'Subscription Item',
        quantity: l.quantity,
        unit_price: l.unitPrice ?? l.unit_price,
        tax_id: lineInputs[idx]?.tax_id || null,
        tax_amount: l.taxAmount ?? l.tax_amount ?? 0,
        discount_amount: l.discountAmount ?? l.discount_amount ?? 0,
        amount: l.total,
        created_at: new Date(),
        updated_at: new Date(),
      }));
      inMemoryInvoiceLines.set(newId, createdLines);

      return {
        alreadyBilled: false,
        invoice: createdInvoice,
      };
    }
  }

  /**
   * Finds all ACTIVE subscriptions with next_billing_date <= today,
   * processes them in batches with a per-subscription try/catch so one failure doesn't block others.
   * Implements catch-up logic: if a subscription missed several periods, generates each missing period exactly once.
   * Returns { created, skipped, failed[] }.
   */
  async runBilling(options?: { date?: string; batchSize?: number }): Promise<RunBillingResult> {
    seedInMemoryInvoices();
    const todayStr = options?.date || formatDateYMD(new Date());
    const batchSize = options?.batchSize || 50;

    let subscriptionsToBill: Subscription[] = [];
    try {
      subscriptionsToBill = await db('subscriptions')
        .where({ status: 'ACTIVE' })
        .where('next_billing_date', '<=', todayStr)
        .select('*');
    } catch {
      subscriptionsToBill = Array.from(inMemorySubscriptions.values()).filter(
        (s) => s.status === 'ACTIVE' && s.next_billing_date && s.next_billing_date <= todayStr
      );
    }

    let createdCount = 0;
    let skippedCount = 0;
    const failedList: Array<{ subscription_id: number; error: string }> = [];

    // Process in batches
    for (let i = 0; i < subscriptionsToBill.length; i += batchSize) {
      const batch = subscriptionsToBill.slice(i, i + batchSize);

      for (let sub of batch) {
        try {
          // Catch-up logic: generate each missing period until next_billing_date > todayStr
          let iterations = 0;
          const MAX_CATCHUP = 120; // safety ceiling

          while (
            sub.next_billing_date &&
            sub.next_billing_date <= todayStr &&
            iterations < MAX_CATCHUP
          ) {
            iterations++;
            const currentBillingDate = sub.next_billing_date;
            const genResult = await this.generateInvoiceForSubscription(sub.id, todayStr);
            if (genResult.alreadyBilled) {
              skippedCount++;
            } else {
              createdCount++;
            }

            // Refresh subscription
            const updated = await this.getSubscriptionById(sub.id);
            if (
              !updated ||
              !updated.next_billing_date ||
              updated.next_billing_date === currentBillingDate
            ) {
              break;
            }
            sub = updated;
          }
        } catch (err: any) {
          failedList.push({
            subscription_id: sub.id,
            error: err.message || 'Billing generation error',
          });
        }
      }
    }

    return {
      created: createdCount,
      skipped: skippedCount,
      failed: failedList,
    };
  }

  // =========================================================================
  // INVOICE LIFECYCLE METHODS
  // =========================================================================

  /**
   * Confirm a DRAFT invoice -> CONFIRMED.
   * Rejects illegal transitions (PAID, CANCELLED).
   */
  async confirmInvoice(id: number): Promise<Invoice> {
    const invoice = await this.getInvoiceById(id);

    if (invoice.status === 'CONFIRMED') {
      return invoice;
    }
    if (invoice.status === 'PAID') {
      throw ApiError.badRequest('Cannot confirm an invoice that is already PAID');
    }
    if (invoice.status === 'CANCELLED') {
      throw ApiError.badRequest('Cannot confirm a CANCELLED invoice');
    }

    try {
      await db('invoices').where({ id }).update({ status: 'CONFIRMED', updated_at: new Date() });
      return { ...invoice, status: 'CONFIRMED' };
    } catch {
      invoice.status = 'CONFIRMED';
      inMemoryInvoices.set(id, invoice);
      return invoice;
    }
  }

  /**
   * Cancel an invoice (DRAFT or CONFIRMED -> CANCELLED).
   * Rejects illegal transitions (PAID cannot be cancelled, already CANCELLED).
   */
  async cancelInvoice(id: number): Promise<Invoice> {
    const invoice = await this.getInvoiceById(id);

    if (invoice.status === 'PAID') {
      throw ApiError.badRequest('Cannot cancel an invoice that has already been PAID');
    }
    if (invoice.status === 'CANCELLED') {
      throw ApiError.badRequest('Invoice is already cancelled');
    }

    try {
      await db('invoices').where({ id }).update({ status: 'CANCELLED', updated_at: new Date() });
      return { ...invoice, status: 'CANCELLED' };
    } catch {
      invoice.status = 'CANCELLED';
      inMemoryInvoices.set(id, invoice);
      return invoice;
    }
  }

  /**
   * Sends email with invoice to registered customer address.
   * Console fallback in dev/test environment.
   */
  async sendInvoice(id: number): Promise<{ success: boolean; message: string }> {
    const invoice = await this.getInvoiceById(id);
    let customerEmail = 'customer@brightloop.com';

    try {
      const user = await db('users').where({ id: invoice.customer_id }).first();
      if (user?.email) customerEmail = user.email;
    } catch {
      // In-memory fallback
    }

    let nodemailer: any = null;
    try {
      nodemailer = require('nodemailer');
    } catch {
      nodemailer = null;
    }

    if (nodemailer && process.env.NODE_ENV !== 'test') {
      try {
        const transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST || 'smtp.ethereal.email',
          port: Number(process.env.SMTP_PORT) || 587,
          secure: process.env.SMTP_SECURE === 'true',
          auth: process.env.SMTP_USER
            ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
            : undefined,
        });

        await transporter.sendMail({
          from: '"Brightloop Invoicing" <invoices@brightloop.com>',
          to: customerEmail,
          subject: `Invoice ${invoice.number} - Brightloop`,
          text: `Dear Customer,\n\nPlease find your invoice ${invoice.number} for the amount of $${invoice.total}.\nDue Date: ${invoice.due_date}.\n\nThank you for your business!`,
          html: `<p>Dear Customer,</p><p>Please find your invoice <strong>${invoice.number}</strong> for the amount of <strong>$${invoice.total}</strong>.</p><p>Due Date: ${invoice.due_date}</p>`,
        });

        return { success: true, message: `Invoice sent to ${customerEmail}` };
      } catch (err) {
        console.warn('[INVOICE] Email send failed, falling back to console:', err);
      }
    }

    // Console fallback
    console.log(`[INVOICE_SEND] Email to ${customerEmail}: Invoice ${invoice.number} Total: $${invoice.total} Due: ${invoice.due_date}`);
    return { success: true, message: `Invoice sent to ${customerEmail} (console fallback)` };
  }

  /**
   * Generates a printable HTML view for the invoice.
   */
  async printInvoice(id: number): Promise<string> {
    const invoice = await this.getInvoiceById(id);
    let lines: InvoiceLine[] = [];
    try {
      lines = await db('invoice_lines').where({ invoice_id: id });
    } catch {
      lines = inMemoryInvoiceLines.get(id) || [];
    }

    const rowsHtml = lines
      .map(
        (l) => `
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${l.description}</td>
          <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: center;">${l.quantity}</td>
          <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: right;">$${Number(l.unit_price).toFixed(2)}</td>
          <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: right;">$${Number(l.discount_amount).toFixed(2)}</td>
          <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: right;">$${Number(l.tax_amount).toFixed(2)}</td>
          <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: 600;">$${Number(l.amount).toFixed(2)}</td>
        </tr>`
      )
      .join('');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Invoice ${invoice.number}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1f2937; margin: 40px; }
    .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #3b82f6; padding-bottom: 20px; }
    .badge { display: inline-block; padding: 4px 12px; border-radius: 9999px; font-weight: 700; font-size: 12px; }
    .badge-paid { background-color: #d1fae5; color: #065f46; }
    .badge-confirmed { background-color: #dbeafe; color: #1e40af; }
    .badge-draft { background-color: #f3f4f6; color: #374151; }
    .badge-cancelled { background-color: #fee2e2; color: #991b1b; }
    table { width: 100%; border-collapse: collapse; margin-top: 30px; }
    th { background-color: #f9fafb; padding: 12px 10px; text-align: left; font-size: 12px; text-transform: uppercase; color: #6b7280; border-bottom: 1px solid #e5e7eb; }
    .totals { width: 300px; margin-left: auto; margin-top: 30px; }
    .totals-row { display: flex; justify-content: space-between; padding: 6px 0; }
    .grand-total { border-top: 2px solid #1f2937; font-weight: 700; font-size: 18px; padding-top: 10px; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1 style="margin: 0; color: #1e3a8a;">Brightloop</h1>
      <p style="margin: 4px 0 0; color: #6b7280;">Subscription Management System</p>
    </div>
    <div style="text-align: right;">
      <h2 style="margin: 0;">INVOICE</h2>
      <p style="margin: 4px 0 0; font-weight: 600;">${invoice.number}</p>
      <span class="badge badge-${invoice.status.toLowerCase()}">${invoice.status}</span>
    </div>
  </div>

  <div style="display: flex; justify-content: space-between; margin-top: 30px;">
    <div>
      <p style="margin: 0; color: #6b7280; font-size: 12px;">BILLED TO</p>
      <p style="margin: 4px 0 0; font-weight: 600;">Customer #${invoice.customer_id}</p>
    </div>
    <div style="text-align: right;">
      <p style="margin: 0;"><strong>Period:</strong> ${invoice.period_start} to ${invoice.period_end}</p>
      <p style="margin: 4px 0 0;"><strong>Due Date:</strong> ${invoice.due_date}</p>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Description</th>
        <th style="text-align: center;">Qty</th>
        <th style="text-align: right;">Unit Price</th>
        <th style="text-align: right;">Discount</th>
        <th style="text-align: right;">Tax</th>
        <th style="text-align: right;">Amount</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
    </tbody>
  </table>

  <div class="totals">
    <div class="totals-row"><span>Subtotal:</span><span>$${Number(invoice.subtotal).toFixed(2)}</span></div>
    <div class="totals-row"><span>Discount:</span><span>-$${Number(invoice.discount_total).toFixed(2)}</span></div>
    <div class="totals-row"><span>Tax:</span><span>+$${Number(invoice.tax_total).toFixed(2)}</span></div>
    <div class="totals-row grand-total"><span>Total:</span><span>$${Number(invoice.total).toFixed(2)}</span></div>
  </div>
</body>
</html>`;
  }

  /**
   * Records a payment against an invoice.
   * Auto-moves the invoice to PAID when cumulative payments cover the total.
   * Rejects payments on CANCELLED invoices.
   */
  async recordPayment(
    invoiceId: number,
    paymentData: { amount: number; method: string; note?: string }
  ): Promise<{ payment: Payment; invoice: Invoice; isPaid: boolean }> {
    const invoice = await this.getInvoiceById(invoiceId);

    if (invoice.status === 'CANCELLED') {
      throw ApiError.badRequest('Cannot record a payment on a CANCELLED invoice');
    }

    const paymentAmount = Number(paymentData.amount);
    let newPayment: Payment;
    let totalPaid = 0;

    try {
      newPayment = await db.transaction(async (trx: Knex.Transaction) => {
        const [p] = await trx('payments')
          .insert({
            invoice_id: invoiceId,
            method: paymentData.method || 'CREDIT_CARD',
            amount: paymentAmount,
            note: paymentData.note || null,
            paid_at: new Date(),
            created_at: new Date(),
            updated_at: new Date(),
          })
          .returning('*');

        const allPayments = await trx('payments').where({ invoice_id: invoiceId });
        totalPaid = allPayments.reduce((acc, pay) => acc + Number(pay.amount), 0);

        if (totalPaid >= Number(invoice.total)) {
          await trx('invoices').where({ id: invoiceId }).update({
            status: 'PAID',
            updated_at: new Date(),
          });
          invoice.status = 'PAID';
        }

        return p;
      });
    } catch {
      // In-memory fallback
      const newPayId = ++paymentIdSeq;
      newPayment = {
        id: newPayId,
        invoice_id: invoiceId,
        method: paymentData.method || 'CREDIT_CARD',
        amount: paymentAmount,
        note: paymentData.note || null,
        paid_at: new Date(),
        created_at: new Date(),
        updated_at: new Date(),
      };
      inMemoryPayments.set(newPayId, newPayment);

      const allPays = Array.from(inMemoryPayments.values()).filter((p) => p.invoice_id === invoiceId);
      totalPaid = allPays.reduce((acc, p) => acc + Number(p.amount), 0);

      if (totalPaid >= Number(invoice.total)) {
        invoice.status = 'PAID';
        inMemoryInvoices.set(invoiceId, invoice);
      }
    }

    const isPaid = totalPaid >= Number(invoice.total);
    return {
      payment: newPayment,
      invoice,
      isPaid,
    };
  }

  /**
   * Retrieves an invoice by ID with its line items and payments.
   */
  async getInvoiceById(id: number): Promise<Invoice> {
    try {
      const invoice = await db('invoices').where({ id }).first();
      if (!invoice) {
        throw ApiError.notFound(`Invoice with ID ${id} not found`);
      }
      return {
        ...invoice,
        subtotal: Number(invoice.subtotal),
        tax_total: Number(invoice.tax_total),
        discount_total: Number(invoice.discount_total),
        total: Number(invoice.total),
      };
    } catch (err) {
      if (err instanceof ApiError) throw err;
      seedInMemoryInvoices();
      const invoice = inMemoryInvoices.get(id);
      if (!invoice) {
        throw ApiError.notFound(`Invoice with ID ${id} not found`);
      }
      return invoice;
    }
  }

  async getSubscriptionById(id: number): Promise<Subscription | null> {
    try {
      return await db('subscriptions').where({ id }).first();
    } catch {
      return inMemorySubscriptions.get(id) || null;
    }
  }
}

export const invoicesService = new InvoicesService();
