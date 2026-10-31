import { db } from '../../db';
import { SummaryQueryFilters } from './reports.validation';
import {
  inMemoryInvoices,
  inMemoryPayments,
  inMemorySubscriptions,
} from '../invoices/invoices.service';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MonthlyRevenueDatum {
  month: string; // 'YYYY-MM'
  revenue: number;
}

export interface SummaryReport {
  activeSubscriptions: number;
  revenueCollected: number;
  outstandingAmount: number;
  overdueCount: number;
  overdueAmount: number;
  monthlyRevenueSeries: MonthlyRevenueDatum[];
  totalCustomers: number;
  unpaidInvoicesCount: number;
  unpaidInvoicesAmount: number;
}

// ---------------------------------------------------------------------------
// Short-lived in-process cache (60-second TTL)
// ---------------------------------------------------------------------------

interface CacheEntry {
  data: SummaryReport;
  ts: number;
}

const summaryCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60_000;

function getCached(key: string): SummaryReport | null {
  const entry = summaryCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL_MS) {
    summaryCache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache(key: string, data: SummaryReport): void {
  summaryCache.set(key, { data, ts: Date.now() });
}

// Exposed for tests to flush the cache
export function clearSummaryCache(): void {
  summaryCache.clear();
}

// ---------------------------------------------------------------------------
// In-memory fallback (used when the DB is not reachable)
// ---------------------------------------------------------------------------

function computeFromMemory(filters: SummaryQueryFilters): SummaryReport {
  const today = new Date().toISOString().split('T')[0];

  // Active subscriptions
  let activeSubs = [...inMemorySubscriptions.values()].filter(
    (s) => s.status === 'ACTIVE',
  );
  if (filters.plan_id) activeSubs = activeSubs.filter((s) => s.plan_id === filters.plan_id);
  if (filters.customer_id)
    activeSubs = activeSubs.filter((s) => s.customer_id === filters.customer_id);

  // Payments → revenue collected
  const allPayments = [...inMemoryPayments.values()];
  const allInvoices = [...inMemoryInvoices.values()];

  // Build invoice_id → customer_id map for customer filter on payments
  const invoiceCustomerMap = new Map<number, number>();
  allInvoices.forEach((inv) => invoiceCustomerMap.set(inv.id, inv.customer_id));

  let filteredPayments = allPayments;
  if (filters.date_from) {
    filteredPayments = filteredPayments.filter((p) => {
      const d = (p.paid_at instanceof Date ? p.paid_at.toISOString() : String(p.paid_at)).split('T')[0];
      return d >= filters.date_from!;
    });
  }
  if (filters.date_to) {
    filteredPayments = filteredPayments.filter((p) => {
      const d = (p.paid_at instanceof Date ? p.paid_at.toISOString() : String(p.paid_at)).split('T')[0];
      return d <= filters.date_to!;
    });
  }
  if (filters.customer_id) {
    filteredPayments = filteredPayments.filter(
      (p) => invoiceCustomerMap.get(p.invoice_id) === filters.customer_id,
    );
  }

  const revenueCollected = filteredPayments.reduce((sum, p) => sum + Number(p.amount), 0);

  // Payments per invoice (total paid)
  const paidPerInvoice = new Map<number, number>();
  allPayments.forEach((p) => {
    paidPerInvoice.set(p.invoice_id, (paidPerInvoice.get(p.invoice_id) ?? 0) + Number(p.amount));
  });

  // Invoices filtered by customer if needed
  let filteredInvoices = allInvoices;
  if (filters.customer_id)
    filteredInvoices = filteredInvoices.filter((i) => i.customer_id === filters.customer_id);

  // Outstanding: non-PAID, non-CANCELLED invoices
  const unpaidInvoices = filteredInvoices.filter(
    (i) => i.status !== 'PAID' && i.status !== 'CANCELLED',
  );
  const outstandingAmount = unpaidInvoices.reduce((sum, i) => {
    const paid = paidPerInvoice.get(i.id) ?? 0;
    return sum + Math.max(0, Number(i.total) - paid);
  }, 0);

  const unpaidInvoicesCount = unpaidInvoices.length;
  const unpaidInvoicesAmount = unpaidInvoices.reduce(
    (sum, i) => sum + Number(i.total),
    0,
  );

  // Overdue: due_date < today AND status not PAID/CANCELLED
  const overdueInvoices = filteredInvoices.filter((i) => {
    const due = i.due_date ? String(i.due_date).split('T')[0] : null;
    return due && due < today && i.status !== 'PAID' && i.status !== 'CANCELLED';
  });
  const overdueCount = overdueInvoices.length;
  const overdueAmount = overdueInvoices.reduce((sum, i) => {
    const paid = paidPerInvoice.get(i.id) ?? 0;
    return sum + Math.max(0, Number(i.total) - paid);
  }, 0);

  // Monthly revenue series — group by YYYY-MM of paid_at
  const monthlyMap = new Map<string, number>();
  filteredPayments.forEach((p) => {
    const raw = p.paid_at instanceof Date ? p.paid_at.toISOString() : String(p.paid_at);
    const month = raw.substring(0, 7); // 'YYYY-MM'
    monthlyMap.set(month, (monthlyMap.get(month) ?? 0) + Number(p.amount));
  });
  const monthlyRevenueSeries: MonthlyRevenueDatum[] = [...monthlyMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, revenue]) => ({ month, revenue: Math.round(revenue * 100) / 100 }));

  // Total customers (users with role CUSTOMER) — approximate from subscription customer_ids
  const customerIds = new Set([...inMemorySubscriptions.values()].map((s) => s.customer_id));
  const totalCustomers = customerIds.size;

  return {
    activeSubscriptions: activeSubs.length,
    revenueCollected: Math.round(revenueCollected * 100) / 100,
    outstandingAmount: Math.round(outstandingAmount * 100) / 100,
    overdueCount,
    overdueAmount: Math.round(overdueAmount * 100) / 100,
    monthlyRevenueSeries,
    totalCustomers,
    unpaidInvoicesCount,
    unpaidInvoicesAmount: Math.round(unpaidInvoicesAmount * 100) / 100,
  };
}

// ---------------------------------------------------------------------------
// DB implementation (aggregated Knex queries — no JS loops for aggregation)
// ---------------------------------------------------------------------------

async function computeFromDB(filters: SummaryQueryFilters): Promise<SummaryReport> {
  // ── 1. Active subscription count ─────────────────────────────────────────
  let subQuery = db('subscriptions').where({ status: 'ACTIVE' }).count('id as count');
  if (filters.plan_id) subQuery = subQuery.where({ plan_id: filters.plan_id });
  if (filters.customer_id) subQuery = subQuery.where({ customer_id: filters.customer_id });
  const [subRow] = await subQuery;
  const activeSubscriptions = Number(subRow.count);

  // ── 2. Total customers ────────────────────────────────────────────────────
  const [custRow] = await db('users').where({ role: 'CUSTOMER' }).count('id as count');
  const totalCustomers = Number(custRow.count);

  // ── 3. Revenue collected (SUM of payments filtered by date range) ─────────
  let revQuery = db('payments')
    .join('invoices', 'payments.invoice_id', 'invoices.id')
    .sum('payments.amount as total');
  if (filters.date_from) revQuery = revQuery.where('payments.paid_at', '>=', filters.date_from);
  if (filters.date_to) revQuery = revQuery.where('payments.paid_at', '<=', filters.date_to);
  if (filters.customer_id)
    revQuery = revQuery.where('invoices.customer_id', filters.customer_id);
  if (filters.plan_id) {
    // Join subscriptions to filter by plan
    revQuery = revQuery.join('subscriptions', 'invoices.subscription_id', 'subscriptions.id').where(
      'subscriptions.plan_id',
      filters.plan_id,
    );
  }
  const [revRow] = await revQuery;
  const revenueCollected = Math.round(Number(revRow.total ?? 0) * 100) / 100;

  // ── 4. Outstanding amount (total - paid for non-PAID, non-CANCELLED invoices) ──
  let outstandingBase = db('invoices')
    .whereNotIn('invoices.status', ['PAID', 'CANCELLED'])
    .leftJoin(
      db('payments').select('invoice_id').sum('amount as paid_sum').groupBy('invoice_id').as('pmt'),
      'invoices.id',
      'pmt.invoice_id',
    )
    .sum(db.raw('GREATEST(invoices.total - COALESCE(pmt.paid_sum, 0), 0) as outstanding_amount'));
  if (filters.customer_id)
    outstandingBase = outstandingBase.where('invoices.customer_id', filters.customer_id);
  const [outRow] = await outstandingBase;
  const outstandingAmount = Math.round(Number((outRow as any).outstanding_amount ?? 0) * 100) / 100;

  // ── 5. Unpaid invoices count + amount ─────────────────────────────────────
  let unpaidQuery = db('invoices')
    .whereNotIn('status', ['PAID', 'CANCELLED'])
    .count('id as count')
    .sum('total as amount');
  if (filters.customer_id)
    unpaidQuery = unpaidQuery.where({ customer_id: filters.customer_id });
  const [unpaidRow] = await unpaidQuery;
  const unpaidInvoicesCount = Number(unpaidRow.count);
  const unpaidInvoicesAmount = Math.round(Number(unpaidRow.amount ?? 0) * 100) / 100;

  // ── 6. Overdue count + amount ─────────────────────────────────────────────
  const today = new Date().toISOString().split('T')[0];
  let overdueBase = db('invoices')
    .where('due_date', '<', today)
    .whereNotIn('invoices.status', ['PAID', 'CANCELLED'])
    .leftJoin(
      db('payments').select('invoice_id').sum('amount as paid_sum').groupBy('invoice_id').as('pmt2'),
      'invoices.id',
      'pmt2.invoice_id',
    )
    .count('invoices.id as count')
    .sum(db.raw('GREATEST(invoices.total - COALESCE(pmt2.paid_sum, 0), 0) as overdue_amount'));
  if (filters.customer_id)
    overdueBase = overdueBase.where('invoices.customer_id', filters.customer_id);
  const [overdueRow] = await overdueBase;
  const overdueCount = Number((overdueRow as any).count);
  const overdueAmount = Math.round(Number((overdueRow as any).overdue_amount ?? 0) * 100) / 100;

  // ── 7. Monthly revenue series ─────────────────────────────────────────────
  let monthlyQuery = db('payments')
    .join('invoices', 'payments.invoice_id', 'invoices.id')
    .select(db.raw("TO_CHAR(payments.paid_at, 'YYYY-MM') as month"))
    .sum('payments.amount as revenue')
    .groupByRaw("TO_CHAR(payments.paid_at, 'YYYY-MM')")
    .orderByRaw("TO_CHAR(payments.paid_at, 'YYYY-MM') ASC");
  if (filters.date_from) monthlyQuery = monthlyQuery.where('payments.paid_at', '>=', filters.date_from);
  if (filters.date_to) monthlyQuery = monthlyQuery.where('payments.paid_at', '<=', filters.date_to);
  if (filters.customer_id)
    monthlyQuery = monthlyQuery.where('invoices.customer_id', filters.customer_id);
  const monthlyRows = await monthlyQuery;
  const monthlyRevenueSeries: MonthlyRevenueDatum[] = monthlyRows.map((r: any) => ({
    month: r.month as string,
    revenue: Math.round(Number(r.revenue) * 100) / 100,
  }));

  return {
    activeSubscriptions,
    revenueCollected,
    outstandingAmount,
    overdueCount,
    overdueAmount,
    monthlyRevenueSeries,
    totalCustomers,
    unpaidInvoicesCount,
    unpaidInvoicesAmount,
  };
}

// ---------------------------------------------------------------------------
// Public service
// ---------------------------------------------------------------------------

class ReportsService {
  /**
   * Returns aggregated financial summary.
   * Tries the live DB first; falls back to in-memory stores on error.
   * Results are cached for 60 seconds per filter combination.
   */
  async getSummary(filters: SummaryQueryFilters): Promise<SummaryReport> {
    const cacheKey = JSON.stringify(filters);
    const cached = getCached(cacheKey);
    if (cached) return cached;

    let result: SummaryReport;
    try {
      result = await computeFromDB(filters);
    } catch (_dbErr) {
      result = computeFromMemory(filters);
    }

    setCache(cacheKey, result);
    return result;
  }
}

export const reportsService = new ReportsService();
