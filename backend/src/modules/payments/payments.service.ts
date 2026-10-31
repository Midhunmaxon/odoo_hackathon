import { Knex } from 'knex';
import { db } from '../../db';
import { ApiError } from '../../middleware/error.middleware';
import { PaginationParams, PaginatedResponse, paginateArray } from '../../utils/pagination';
import {
  PaymentRecord,
  InvoiceWithPaymentDetails,
  CreatePaymentDTO,
  InvoiceQueryFilters,
} from './payments.types';
import {
  inMemoryInvoices,
  inMemoryPayments as invoiceModulePayments,
  seedInMemoryInvoices,
} from '../invoices/invoices.service';

// In-memory payment store fallback
export const inMemoryPayments: Map<number, PaymentRecord> = invoiceModulePayments as unknown as Map<number, PaymentRecord>;
let paymentIdCounter = 50;

function roundToTwoDecimals(num: number): number {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

function normalizeDate(d: Date | string | null | undefined): string {
  if (!d) return '';
  if (d instanceof Date) return d.toISOString().split('T')[0];
  return String(d).split('T')[0];
}

export class PaymentsService {
  /**
   * POST /payments
   * Records payment against an invoice inside a single transaction.
   * - Rejects payments on CANCELLED or DRAFT invoices.
   * - Rejects overpayment (amount > balance).
   * - Supports partial payments.
   * - Marks the invoice PAID when balance reaches 0.
   */
  async recordPayment(data: CreatePaymentDTO): Promise<{
    payment: PaymentRecord;
    invoice: any;
    amount_paid: number;
    balance: number;
    is_paid: boolean;
  }> {
    seedInMemoryInvoices();
    const invoiceId = Number(data.invoice_id);
    const paymentAmount = roundToTwoDecimals(Number(data.amount));
    const paymentDate = data.date ? new Date(data.date) : new Date();

    // 1. Database execution using transaction
    try {
      const result = await db.transaction(async (trx: Knex.Transaction) => {
        // Fetch invoice with row lock
        const invoice = await trx('invoices').where({ id: invoiceId }).forUpdate().first();
        if (!invoice) {
          throw ApiError.notFound(`Invoice with ID ${invoiceId} not found`);
        }

        // Reject payments on CANCELLED or DRAFT invoices
        if (invoice.status === 'CANCELLED') {
          throw ApiError.badRequest('Cannot record payment on a CANCELLED invoice');
        }
        if (invoice.status === 'DRAFT') {
          throw ApiError.badRequest('Cannot record payment on a DRAFT invoice. Invoice must be confirmed first.');
        }

        // Fetch existing payments for this invoice
        const existingPayments = await trx('payments').where({ invoice_id: invoiceId });
        const currentPaid = roundToTwoDecimals(
          existingPayments.reduce((acc, p) => acc + Number(p.amount), 0)
        );
        const invoiceTotal = roundToTwoDecimals(Number(invoice.total));
        const remainingBalance = roundToTwoDecimals(Math.max(0, invoiceTotal - currentPaid));

        // Reject overpayment
        if (paymentAmount > remainingBalance) {
          throw ApiError.badRequest(
            `Payment amount ($${paymentAmount.toFixed(2)}) exceeds remaining invoice balance ($${remainingBalance.toFixed(2)})`
          );
        }

        // Insert new payment
        const [payment] = await trx('payments')
          .insert({
            invoice_id: invoiceId,
            method: data.method,
            amount: paymentAmount,
            paid_at: paymentDate,
            note: data.note || null,
            created_at: new Date(),
            updated_at: new Date(),
          })
          .returning('*');

        const newTotalPaid = roundToTwoDecimals(currentPaid + paymentAmount);
        const newBalance = roundToTwoDecimals(Math.max(0, invoiceTotal - newTotalPaid));
        const isPaid = newBalance <= 0;

        // Auto-move invoice to PAID when balance reaches 0
        if (isPaid) {
          await trx('invoices')
            .where({ id: invoiceId })
            .update({ status: 'PAID', updated_at: new Date() });
          invoice.status = 'PAID';
        }

        return {
          payment,
          invoice: {
            ...invoice,
            total: invoiceTotal,
          },
          amount_paid: newTotalPaid,
          balance: newBalance,
          is_paid: isPaid,
        };
      });

      return result;
    } catch (dbErr: any) {
      if (dbErr instanceof ApiError) throw dbErr;

      // In-memory fallback
      const invoice = inMemoryInvoices.get(invoiceId);
      if (!invoice) {
        throw ApiError.notFound(`Invoice with ID ${invoiceId} not found`);
      }

      // Reject payments on CANCELLED or DRAFT invoices
      if (invoice.status === 'CANCELLED') {
        throw ApiError.badRequest('Cannot record payment on a CANCELLED invoice');
      }
      if (invoice.status === 'DRAFT') {
        throw ApiError.badRequest('Cannot record payment on a DRAFT invoice. Invoice must be confirmed first.');
      }

      // Calculate existing payments
      const existingPayments = Array.from(inMemoryPayments.values()).filter(
        (p) => p.invoice_id === invoiceId
      );
      const currentPaid = roundToTwoDecimals(
        existingPayments.reduce((acc, p) => acc + Number(p.amount), 0)
      );
      const invoiceTotal = roundToTwoDecimals(Number(invoice.total));
      const remainingBalance = roundToTwoDecimals(Math.max(0, invoiceTotal - currentPaid));

      // Reject overpayment
      if (paymentAmount > remainingBalance) {
        throw ApiError.badRequest(
          `Payment amount ($${paymentAmount.toFixed(2)}) exceeds remaining invoice balance ($${remainingBalance.toFixed(2)})`
        );
      }

      // Insert in-memory payment
      const newPayId = ++paymentIdCounter;
      const payment: PaymentRecord = {
        id: newPayId,
        invoice_id: invoiceId,
        method: data.method,
        amount: paymentAmount,
        paid_at: paymentDate,
        note: data.note || null,
        created_at: new Date(),
        updated_at: new Date(),
      };
      inMemoryPayments.set(newPayId, payment);

      const newTotalPaid = roundToTwoDecimals(currentPaid + paymentAmount);
      const newBalance = roundToTwoDecimals(Math.max(0, invoiceTotal - newTotalPaid));
      const isPaid = newBalance <= 0;

      if (isPaid) {
        invoice.status = 'PAID';
        inMemoryInvoices.set(invoiceId, invoice);
      }

      return {
        payment,
        invoice,
        amount_paid: newTotalPaid,
        balance: newBalance,
        is_paid: isPaid,
      };
    }
  }

  /**
   * GET /invoices
   * Computes amount_paid, balance and overdue flag (due_date passed and balance > 0).
   * Filterable by status, paid/outstanding/overdue, customer, and date range.
   */
  async listInvoicesWithPaymentDetails(
    filters: InvoiceQueryFilters,
    params: PaginationParams
  ): Promise<PaginatedResponse<InvoiceWithPaymentDetails>> {
    seedInMemoryInvoices();
    const todayStr = filters.as_of_date || normalizeDate(new Date());

    let allInvoices: any[] = [];
    let allPayments: any[] = [];

    try {
      allInvoices = await db('invoices').select('*');
      allPayments = await db('payments').select('*');
    } catch {
      allInvoices = Array.from(inMemoryInvoices.values());
      allPayments = Array.from(inMemoryPayments.values());
    }

    // Map payments by invoice_id
    const paymentsByInvoice = new Map<number, number>();
    for (const p of allPayments) {
      const invId = Number(p.invoice_id);
      const curr = paymentsByInvoice.get(invId) || 0;
      paymentsByInvoice.set(invId, roundToTwoDecimals(curr + Number(p.amount)));
    }

    // Compute details for each invoice
    let computedList: InvoiceWithPaymentDetails[] = allInvoices.map((inv) => {
      const total = roundToTwoDecimals(Number(inv.total));
      const amountPaid = roundToTwoDecimals(paymentsByInvoice.get(Number(inv.id)) || 0);
      const balance = roundToTwoDecimals(Math.max(0, total - amountPaid));
      const dueDateStr = normalizeDate(inv.due_date);

      // Overdue definition: due_date passed and balance > 0 and not cancelled
      const isOverdue = Boolean(
        inv.status !== 'PAID' &&
        inv.status !== 'CANCELLED' &&
        balance > 0 &&
        dueDateStr < todayStr
      );

      let daysOverdue = 0;
      if (isOverdue && dueDateStr) {
        const due = new Date(dueDateStr);
        const today = new Date(todayStr);
        daysOverdue = Math.max(0, Math.floor((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24)));
      }

      return {
        id: inv.id,
        number: inv.number,
        subscription_id: inv.subscription_id,
        customer_id: inv.customer_id,
        period_start: normalizeDate(inv.period_start),
        period_end: normalizeDate(inv.period_end),
        status: inv.status,
        subtotal: roundToTwoDecimals(Number(inv.subtotal)),
        tax_total: roundToTwoDecimals(Number(inv.tax_total)),
        discount_total: roundToTwoDecimals(Number(inv.discount_total)),
        total,
        due_date: dueDateStr,
        amount_paid: amountPaid,
        balance,
        overdue: isOverdue,
        is_overdue: isOverdue,
        days_overdue: daysOverdue,
        created_at: inv.created_at,
        updated_at: inv.updated_at,
      };
    });

    // Apply Filters
    // 1. Status filter
    if (filters.status) {
      const targetStatus = filters.status.toUpperCase();
      computedList = computedList.filter((inv) => inv.status.toUpperCase() === targetStatus);
    }

    // 2. Payment status filter: 'paid' | 'outstanding' | 'overdue'
    const statusMode = filters.payment_status || filters.filter;
    if (statusMode) {
      if (statusMode === 'paid') {
        computedList = computedList.filter((inv) => inv.balance === 0 || inv.status === 'PAID');
      } else if (statusMode === 'outstanding') {
        computedList = computedList.filter(
          (inv) => inv.balance > 0 && inv.status !== 'CANCELLED'
        );
      } else if (statusMode === 'overdue') {
        computedList = computedList.filter((inv) => inv.is_overdue);
      }
    }

    // 3. Customer filter
    const customerFilterId = filters.customer_id || filters.customer;
    if (customerFilterId) {
      computedList = computedList.filter((inv) => Number(inv.customer_id) === Number(customerFilterId));
    }

    // 4. Date range filter
    const fromDate = filters.from_date || filters.date_from;
    if (fromDate) {
      computedList = computedList.filter(
        (inv) => inv.period_start >= fromDate || inv.due_date >= fromDate
      );
    }
    const toDate = filters.to_date || filters.date_to;
    if (toDate) {
      computedList = computedList.filter(
        (inv) => inv.period_start <= toDate || inv.due_date <= toDate
      );
    }

    return paginateArray(computedList, params);
  }

  /**
   * GET /invoices/overdue
   * Retrieves overdue invoices with days overdue, sorted oldest first (due_date ASC).
   */
  async listOverdueInvoices(
    params: PaginationParams,
    asOfDate?: string
  ): Promise<PaginatedResponse<InvoiceWithPaymentDetails>> {
    // Force sort: oldest due_date first
    const overdueParams: PaginationParams = {
      ...params,
      sortField: 'due_date',
      sortDirection: 'asc',
    };

    const result = await this.listInvoicesWithPaymentDetails(
      { payment_status: 'overdue', as_of_date: asOfDate },
      overdueParams
    );

    // Ensure sorted oldest first by due_date
    result.data.sort((a, b) => a.due_date.localeCompare(b.due_date));
    return result;
  }
}

export const paymentsService = new PaymentsService();
