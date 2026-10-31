import request from 'supertest';
import { app } from '../app';
import {
  invoicesService,
  inMemoryInvoices,
  inMemorySubscriptions,
  inMemorySubscriptionLines,
  seedInMemoryInvoices,
  advanceBillingPeriod,
} from '../modules/invoices/invoices.service';

describe('Invoices Module', () => {
  beforeEach(() => {
    // Reset and reseed in-memory store for predictable test runs
    inMemoryInvoices.clear();
    inMemorySubscriptions.clear();
    inMemorySubscriptionLines.clear();
    seedInMemoryInvoices();
  });

  describe('advanceBillingPeriod() & Date Arithmetic', () => {
    it('should correctly advance monthly billing period from 2026-02-15 to 2026-03-14 and set next date to 2026-03-15', () => {
      const res = advanceBillingPeriod('2026-02-15', 'MONTHLY');
      expect(res.period_start).toBe('2026-02-15');
      expect(res.period_end).toBe('2026-03-14');
      expect(res.next_billing_date).toBe('2026-03-15');
    });

    it('should correctly advance monthly billing period covering the full month from 2026-01-01 to 2026-01-31', () => {
      const res = advanceBillingPeriod('2026-01-01', 'MONTHLY');
      expect(res.period_start).toBe('2026-01-01');
      expect(res.period_end).toBe('2026-01-31');
      expect(res.next_billing_date).toBe('2026-02-01');
    });

    it('should correctly advance yearly billing period', () => {
      const res = advanceBillingPeriod('2026-01-01', 'YEARLY');
      expect(res.period_start).toBe('2026-01-01');
      expect(res.period_end).toBe('2026-12-31');
      expect(res.next_billing_date).toBe('2027-01-01');
    });

    it('should correctly advance weekly billing period', () => {
      const res = advanceBillingPeriod('2026-05-01', 'WEEKLY');
      expect(res.period_start).toBe('2026-05-01');
      expect(res.period_end).toBe('2026-05-07');
      expect(res.next_billing_date).toBe('2026-05-08');
    });
  });

  describe('generateInvoiceForSubscription() Idempotency', () => {
    it('should generate a DRAFT invoice and advance subscription dates', async () => {
      // SUB-2026-001 has next_billing_date = 2026-02-01
      const result = await invoicesService.generateInvoiceForSubscription(1);
      expect(result.alreadyBilled).toBe(false);
      expect(result.invoice).toBeDefined();
      expect(result.invoice?.status).toBe('DRAFT');
      expect(result.invoice?.period_start).toBe('2026-02-01');
      expect(result.invoice?.period_end).toBe('2026-02-28');
      expect(Number(result.invoice?.total)).toBeGreaterThan(0);

      // Check subscription dates were advanced
      const updatedSub = await invoicesService.getSubscriptionById(1);
      expect(updatedSub?.last_billed_period_end).toBe('2026-02-28');
      expect(updatedSub?.next_billing_date).toBe('2026-03-01');
    });

    it('should be idempotent and treat zero rows inserted on conflict as already billed', async () => {
      // Reset subscription 1 to next_billing_date = 2026-02-01
      const sub = inMemorySubscriptions.get(1)!;
      sub.next_billing_date = '2026-02-01';

      // 1. First run generates the invoice
      const firstRun = await invoicesService.generateInvoiceForSubscription(1);
      expect(firstRun.alreadyBilled).toBe(false);
      expect(firstRun.invoice).toBeDefined();

      // Reset next_billing_date back to 2026-02-01 to simulate duplicate billing attempt for the same period
      sub.next_billing_date = '2026-02-01';

      // 2. Second run for same period detects conflict and ignores
      const secondRun = await invoicesService.generateInvoiceForSubscription(1);
      expect(secondRun.alreadyBilled).toBe(true);
      expect(secondRun.skippedPeriod).toBe('2026-02-01');
    });
  });

  describe('POST /api/invoices/run-billing & Catch-up Logic', () => {
    it('should run billing twice and assert no duplicate invoices are created', async () => {
      // Set test subscriptions with next_billing_date <= today
      const testDate = '2026-02-15';
      const sub1 = inMemorySubscriptions.get(1)!;
      sub1.next_billing_date = '2026-02-01'; // 1 period to bill (Feb 1 -> Feb 28, next is Mar 1 > Feb 15)

      const sub2 = inMemorySubscriptions.get(2)!;
      sub2.next_billing_date = '2026-02-15'; // 1 period to bill (Feb 15 -> Mar 14, next is Mar 15 > Feb 15)

      // First billing run
      const res1 = await request(app)
        .post('/api/invoices/run-billing')
        .send({ date: testDate });

      expect(res1.status).toBe(200);
      expect(res1.body.success).toBe(true);
      expect(res1.body.data.created).toBeGreaterThanOrEqual(2);
      expect(res1.body.data.failed).toHaveLength(0);

      const countAfterFirstRun = inMemoryInvoices.size;

      // Second billing run with the exact same date
      const res2 = await request(app)
        .post('/api/invoices/run-billing')
        .send({ date: testDate });

      expect(res2.status).toBe(200);
      expect(res2.body.success).toBe(true);
      // No new invoices should be created
      expect(res2.body.data.created).toBe(0);
      // Invoices count in store remains identical
      expect(inMemoryInvoices.size).toBe(countAfterFirstRun);
    });

    it('should implement catch-up logic: generate each missing period exactly once when subscription missed several periods', async () => {
      // Subscription 1 missed 3 periods (Jan 1, Feb 1, Mar 1), today is 2026-03-15
      const sub = inMemorySubscriptions.get(1)!;
      sub.next_billing_date = '2026-01-01';

      // Remove any previously existing invoice for subscription 1
      for (const [id, inv] of inMemoryInvoices.entries()) {
        if (inv.subscription_id === 1) {
          inMemoryInvoices.delete(id);
        }
      }

      const runDate = '2026-03-15';
      const res = await request(app)
        .post('/api/invoices/run-billing')
        .send({ date: runDate });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify all 3 missing periods were billed for subscription 1:
      // Period 1: Jan 1 -> Jan 31
      // Period 2: Feb 1 -> Feb 28
      // Period 3: Mar 1 -> Mar 31
      const sub1Invoices = Array.from(inMemoryInvoices.values()).filter(
        (inv) => inv.subscription_id === 1
      );

      const periodStarts = sub1Invoices.map((inv) => inv.period_start).sort();
      expect(periodStarts).toContain('2026-01-01');
      expect(periodStarts).toContain('2026-02-01');
      expect(periodStarts).toContain('2026-03-01');

      // Next billing date is advanced past runDate (2026-04-01 > 2026-03-15)
      expect(sub.next_billing_date).toBe('2026-04-01');
      expect(sub.last_billed_period_end).toBe('2026-03-31');
    });

    it('should continue processing remaining subscriptions when one subscription fails', async () => {
      // Introduce an invalid subscription
      inMemorySubscriptions.set(999, {
        id: 999,
        number: 'SUB-CORRUPT',
        customer_id: 4,
        plan_id: 99999, // non-existent plan
        start_date: '2026-01-01',
        payment_terms: 'immediate',
        status: 'ACTIVE',
        next_billing_date: '2026-01-01',
      });

      const res = await request(app)
        .post('/api/invoices/run-billing')
        .send({ date: '2026-02-01' });

      expect(res.status).toBe(200);
      expect(res.body.data.created).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Invoice Lifecycle Transitions & Guardrails', () => {
    it('POST /api/invoices/:id/confirm should transition DRAFT to CONFIRMED', async () => {
      // Invoice 1 is PAID initially in seed, let's create a DRAFT invoice
      const gen = await invoicesService.generateInvoiceForSubscription(1);
      const draftId = gen.invoice!.id;

      const res = await request(app).post(`/api/invoices/${draftId}/confirm`);
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('CONFIRMED');
    });

    it('POST /api/invoices/:id/confirm should reject confirming a CANCELLED invoice with 400', async () => {
      const gen = await invoicesService.generateInvoiceForSubscription(1);
      const draftId = gen.invoice!.id;

      // Cancel it first
      await request(app).post(`/api/invoices/${draftId}/cancel`);

      // Try confirming cancelled invoice
      const res = await request(app).post(`/api/invoices/${draftId}/confirm`);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('BAD_REQUEST');
      expect(res.body.error.message).toMatch(/cannot confirm/i);
    });

    it('POST /api/invoices/:id/cancel should cancel a DRAFT or CONFIRMED invoice', async () => {
      const gen = await invoicesService.generateInvoiceForSubscription(1);
      const draftId = gen.invoice!.id;

      const res = await request(app).post(`/api/invoices/${draftId}/cancel`);
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('CANCELLED');
    });

    it('POST /api/invoices/:id/cancel should reject cancelling a PAID invoice with 400', async () => {
      // Invoice 1 in seed data has status: 'PAID'
      const res = await request(app).post('/api/invoices/1/cancel');
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('BAD_REQUEST');
      expect(res.body.error.message).toMatch(/cannot cancel/i);
    });

    it('POST /api/invoices/:id/send should send email with console fallback in dev', async () => {
      const res = await request(app).post('/api/invoices/1/send');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toMatch(/invoice sent/i);
    });

    it('GET /api/invoices/:id/print should return HTML print view', async () => {
      const res = await request(app).get('/api/invoices/1/print');
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/text\/html/);
      expect(res.text).toContain('INV-2026-0001');
      expect(res.text).toContain('Brightloop');
    });

    it('POST /api/invoices/:id/payments should record payment and auto-move to PAID when payments cover total', async () => {
      const gen = await invoicesService.generateInvoiceForSubscription(1);
      const invoice = gen.invoice!;
      const totalAmount = Number(invoice.total);

      // Confirm invoice first
      await request(app).post(`/api/invoices/${invoice.id}/confirm`);

      // 1. Partial payment (e.g. half)
      const half = Math.floor(totalAmount / 2);
      const partRes = await request(app)
        .post(`/api/invoices/${invoice.id}/payments`)
        .send({ amount: half, method: 'CREDIT_CARD', note: 'Partial payment' });

      expect(partRes.status).toBe(201);
      expect(partRes.body.data.isPaid).toBe(false);
      expect(partRes.body.data.invoice.status).toBe('CONFIRMED');

      // 2. Remainder payment
      const remainder = totalAmount - half;
      const fullRes = await request(app)
        .post(`/api/invoices/${invoice.id}/payments`)
        .send({ amount: remainder, method: 'CREDIT_CARD', note: 'Final payment' });

      expect(fullRes.status).toBe(201);
      expect(fullRes.body.data.isPaid).toBe(true);
      expect(fullRes.body.data.invoice.status).toBe('PAID');
    });

    it('POST /api/invoices/:id/payments should reject payments on CANCELLED invoices', async () => {
      const gen = await invoicesService.generateInvoiceForSubscription(1);
      const invoice = gen.invoice!;

      await request(app).post(`/api/invoices/${invoice.id}/cancel`);

      const res = await request(app)
        .post(`/api/invoices/${invoice.id}/payments`)
        .send({ amount: 50, method: 'CREDIT_CARD' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('BAD_REQUEST');
      expect(res.body.error.message).toMatch(/cannot record a payment/i);
    });
  });
});

