/**
 * Jest tests for the reports module.
 *
 * Because PostgreSQL is not available in the test environment, the service
 * automatically falls back to the in-memory stores exported by
 * invoices.service.ts.  We populate those stores directly before each test.
 */

import {
  inMemoryInvoices,
  inMemoryPayments,
  inMemorySubscriptions,
  seedInMemoryInvoices,
} from '../modules/invoices/invoices.service';
import { reportsService, clearSummaryCache } from '../modules/reports/reports.service';

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

function resetStores(): void {
  inMemoryInvoices.clear();
  inMemoryPayments.clear();
  inMemorySubscriptions.clear();
  clearSummaryCache();
}

function addInvoice(
  id: number,
  opts: {
    customer_id?: number;
    subscription_id?: number;
    status?: string;
    total?: number;
    due_date?: string;
    period_start?: string;
    period_end?: string;
  } = {},
): void {
  inMemoryInvoices.set(id, {
    id,
    number: `INV-${id}`,
    subscription_id: opts.subscription_id ?? 1,
    customer_id: opts.customer_id ?? 1,
    period_start: opts.period_start ?? '2026-01-01',
    period_end: opts.period_end ?? '2026-01-31',
    status: (opts.status ?? 'CONFIRMED') as any,
    subtotal: opts.total ?? 100,
    tax_total: 0,
    discount_total: 0,
    total: opts.total ?? 100,
    due_date: opts.due_date ?? '2026-02-01',
    issued_at: '2026-01-01',
    notes: '',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  } as any);
}

function addPayment(
  id: number,
  invoice_id: number,
  amount: number,
  paid_at = '2026-01-15',
): void {
  inMemoryPayments.set(id, {
    id,
    invoice_id,
    method: 'CASH',
    amount,
    paid_at: new Date(paid_at),
    note: null,
  } as any);
}

function addSubscription(
  id: number,
  opts: { customer_id?: number; plan_id?: number; status?: string } = {},
): void {
  inMemorySubscriptions.set(id, {
    id,
    number: `SUB-${id}`,
    customer_id: opts.customer_id ?? 1,
    plan_id: opts.plan_id ?? 1,
    start_date: '2026-01-01',
    expiry_date: null,
    status: (opts.status ?? 'ACTIVE') as any,
    next_billing_date: '2026-02-01',
    last_billed_period_end: null,
    payment_terms: 'NET30',
  } as any);
}

// ────────────────────────────────────────────────────────────────────────────
// Tests
// ────────────────────────────────────────────────────────────────────────────

beforeEach(() => {
  resetStores();
});

describe('reportsService.getSummary – field shape', () => {
  it('returns all required fields with correct types', async () => {
    addSubscription(1);
    addInvoice(1, { total: 200 });
    addPayment(1, 1, 200, '2026-03-10');

    const result = await reportsService.getSummary({});

    expect(typeof result.activeSubscriptions).toBe('number');
    expect(typeof result.revenueCollected).toBe('number');
    expect(typeof result.outstandingAmount).toBe('number');
    expect(typeof result.overdueCount).toBe('number');
    expect(typeof result.overdueAmount).toBe('number');
    expect(typeof result.totalCustomers).toBe('number');
    expect(typeof result.unpaidInvoicesCount).toBe('number');
    expect(typeof result.unpaidInvoicesAmount).toBe('number');
    expect(Array.isArray(result.monthlyRevenueSeries)).toBe(true);
  });
});

describe('reportsService.getSummary – active subscriptions', () => {
  it('counts only ACTIVE subscriptions', async () => {
    addSubscription(1, { status: 'ACTIVE' });
    addSubscription(2, { status: 'ACTIVE' });
    addSubscription(3, { status: 'CLOSED' });

    const result = await reportsService.getSummary({});
    expect(result.activeSubscriptions).toBe(2);
  });

  it('filters by plan_id', async () => {
    addSubscription(1, { plan_id: 1 });
    addSubscription(2, { plan_id: 2 });
    addSubscription(3, { plan_id: 1 });

    const result = await reportsService.getSummary({ plan_id: 1 });
    expect(result.activeSubscriptions).toBe(2);
  });

  it('filters by customer_id', async () => {
    addSubscription(1, { customer_id: 10 });
    addSubscription(2, { customer_id: 20 });

    const result = await reportsService.getSummary({ customer_id: 10 });
    expect(result.activeSubscriptions).toBe(1);
  });
});

describe('reportsService.getSummary – revenue collected', () => {
  it('sums payment amounts', async () => {
    addInvoice(1, { total: 200 });
    addPayment(1, 1, 75, '2026-03-10');
    addPayment(2, 1, 125, '2026-03-12');

    const result = await reportsService.getSummary({});
    expect(result.revenueCollected).toBeCloseTo(200, 2);
  });

  it('filters by date_from', async () => {
    addInvoice(1, { total: 300 });
    addPayment(1, 1, 100, '2026-01-05'); // before filter
    addPayment(2, 1, 200, '2026-03-05'); // after filter

    const result = await reportsService.getSummary({ date_from: '2026-02-01' });
    expect(result.revenueCollected).toBeCloseTo(200, 2);
  });

  it('filters by date_to', async () => {
    addInvoice(1, { total: 300 });
    addPayment(1, 1, 100, '2026-01-05');
    addPayment(2, 1, 200, '2026-03-05'); // after cutoff

    const result = await reportsService.getSummary({ date_to: '2026-02-01' });
    expect(result.revenueCollected).toBeCloseTo(100, 2);
  });
});

describe('reportsService.getSummary – outstanding & unpaid invoices', () => {
  it('outstanding excludes PAID invoices', async () => {
    addInvoice(1, { status: 'PAID', total: 500 });
    addInvoice(2, { status: 'CONFIRMED', total: 200 });

    const result = await reportsService.getSummary({});
    // Only invoice 2 contributes
    expect(result.outstandingAmount).toBeCloseTo(200, 2);
    expect(result.unpaidInvoicesCount).toBe(1);
  });

  it('outstanding excludes CANCELLED invoices', async () => {
    addInvoice(1, { status: 'CANCELLED', total: 500 });
    addInvoice(2, { status: 'DRAFT', total: 300 });

    const result = await reportsService.getSummary({});
    expect(result.outstandingAmount).toBeCloseTo(300, 2);
  });

  it('reduces outstanding by partial payments', async () => {
    addInvoice(1, { status: 'CONFIRMED', total: 400 });
    addPayment(1, 1, 150, '2026-02-01');

    const result = await reportsService.getSummary({});
    expect(result.outstandingAmount).toBeCloseTo(250, 2);
  });
});

describe('reportsService.getSummary – overdue', () => {
  const pastDate = '2020-01-01'; // definitely in the past

  it('counts overdue invoices (due_date past, not PAID or CANCELLED)', async () => {
    addInvoice(1, { status: 'CONFIRMED', total: 100, due_date: pastDate });
    addInvoice(2, { status: 'PAID', total: 200, due_date: pastDate });
    addInvoice(3, { status: 'CANCELLED', total: 150, due_date: pastDate });
    addInvoice(4, { status: 'CONFIRMED', total: 80, due_date: '2099-01-01' }); // future, not overdue

    const result = await reportsService.getSummary({});
    expect(result.overdueCount).toBe(1);
    expect(result.overdueAmount).toBeCloseTo(100, 2);
  });

  it('overdue amount is reduced by partial payments', async () => {
    addInvoice(1, { status: 'CONFIRMED', total: 300, due_date: pastDate });
    addPayment(1, 1, 100, '2026-01-15');

    const result = await reportsService.getSummary({});
    expect(result.overdueAmount).toBeCloseTo(200, 2);
  });
});

describe('reportsService.getSummary – monthly revenue series', () => {
  it('groups payments by month and sorts chronologically', async () => {
    addInvoice(1, { total: 500 });
    addPayment(1, 1, 100, '2026-01-10');
    addPayment(2, 1, 200, '2026-03-05');
    addPayment(3, 1, 50, '2026-01-25');

    const result = await reportsService.getSummary({});
    const series = result.monthlyRevenueSeries;

    expect(series.length).toBeGreaterThanOrEqual(2);
    // Should be sorted ascending
    for (let i = 1; i < series.length; i++) {
      expect(series[i].month >= series[i - 1].month).toBe(true);
    }
    const jan = series.find((s) => s.month === '2026-01');
    expect(jan?.revenue).toBeCloseTo(150, 2);
    const mar = series.find((s) => s.month === '2026-03');
    expect(mar?.revenue).toBeCloseTo(200, 2);
  });
});

describe('reportsService.getSummary – caching', () => {
  it('returns the same result on a second call within TTL', async () => {
    addSubscription(1);
    addInvoice(1, { total: 100 });
    addPayment(1, 1, 100, '2026-01-10');

    const first = await reportsService.getSummary({});

    // Mutate the store — the cache should still return the old result
    addSubscription(99);
    const second = await reportsService.getSummary({});

    expect(second.activeSubscriptions).toBe(first.activeSubscriptions);
  });

  it('returns fresh data after cache is cleared', async () => {
    addSubscription(1);
    const first = await reportsService.getSummary({});

    clearSummaryCache();
    addSubscription(2);
    const second = await reportsService.getSummary({});

    expect(second.activeSubscriptions).toBeGreaterThan(first.activeSubscriptions);
  });
});

