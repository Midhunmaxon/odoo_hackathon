import request from 'supertest';
import { app } from '../app';
import {
  inMemoryInvoices,
  inMemoryPayments,
  seedInMemoryInvoices,
} from '../modules/invoices/invoices.service';

describe('Payments Module', () => {
  beforeEach(() => {
    inMemoryInvoices.clear();
    inMemoryPayments.clear();
    seedInMemoryInvoices();
  });

  describe('POST /api/payments - Payment Recording & Lifecycle', () => {
    it('should record an exact payment and auto-mark invoice as PAID', async () => {
      // Create a confirmed invoice with total = 100
      inMemoryInvoices.set(101, {
        id: 101,
        number: 'INV-TEST-101',
        subscription_id: 1,
        customer_id: 4,
        period_start: '2026-05-01',
        period_end: '2026-05-31',
        status: 'CONFIRMED',
        subtotal: 100.0,
        tax_total: 0.0,
        discount_total: 0.0,
        total: 100.0,
        due_date: '2026-05-15',
      });

      const res = await request(app)
        .post('/api/payments')
        .send({
          invoice_id: 101,
          amount: 100.0,
          method: 'CREDIT_CARD',
          note: 'Full settlement',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.amount_paid).toBe(100.0);
      expect(res.body.data.balance).toBe(0.0);
      expect(res.body.data.is_paid).toBe(true);
      expect(res.body.data.invoice.status).toBe('PAID');

      // Verify in-memory invoice is marked PAID
      const updatedInv = inMemoryInvoices.get(101);
      expect(updatedInv?.status).toBe('PAID');
    });

    it('should support partial payments and keep status CONFIRMED until balance reaches 0', async () => {
      inMemoryInvoices.set(102, {
        id: 102,
        number: 'INV-TEST-102',
        subscription_id: 1,
        customer_id: 4,
        period_start: '2026-05-01',
        period_end: '2026-05-31',
        status: 'CONFIRMED',
        subtotal: 150.0,
        tax_total: 0.0,
        discount_total: 0.0,
        total: 150.0,
        due_date: '2026-05-15',
      });

      // 1. Partial payment: $60 of $150
      const part1 = await request(app)
        .post('/api/payments')
        .send({
          invoice_id: 102,
          amount: 60.0,
          method: 'UPI',
          note: 'Part 1',
        });

      expect(part1.status).toBe(201);
      expect(part1.body.data.amount_paid).toBe(60.0);
      expect(part1.body.data.balance).toBe(90.0);
      expect(part1.body.data.is_paid).toBe(false);
      expect(part1.body.data.invoice.status).toBe('CONFIRMED');

      // 2. Second partial payment: $40 of remaining $90
      const part2 = await request(app)
        .post('/api/payments')
        .send({
          invoice_id: 102,
          amount: 40.0,
          method: 'bank transfer',
          note: 'Part 2',
        });

      expect(part2.status).toBe(201);
      expect(part2.body.data.amount_paid).toBe(100.0);
      expect(part2.body.data.balance).toBe(50.0);
      expect(part2.body.data.is_paid).toBe(false);

      // 3. Final remainder payment: $50
      const finalPart = await request(app)
        .post('/api/payments')
        .send({
          invoice_id: 102,
          amount: 50.0,
          method: 'cash',
          note: 'Final settlement',
        });

      expect(finalPart.status).toBe(201);
      expect(finalPart.body.data.amount_paid).toBe(150.0);
      expect(finalPart.body.data.balance).toBe(0.0);
      expect(finalPart.body.data.is_paid).toBe(true);
      expect(finalPart.body.data.invoice.status).toBe('PAID');
    });

    it('should reject overpayment when amount exceeds remaining balance', async () => {
      inMemoryInvoices.set(103, {
        id: 103,
        number: 'INV-TEST-103',
        subscription_id: 1,
        customer_id: 4,
        period_start: '2026-05-01',
        period_end: '2026-05-31',
        status: 'CONFIRMED',
        subtotal: 50.0,
        tax_total: 0.0,
        discount_total: 0.0,
        total: 50.0,
        due_date: '2026-05-15',
      });

      // Attempting to pay $75 on a $50 balance
      const res = await request(app)
        .post('/api/payments')
        .send({
          invoice_id: 103,
          amount: 75.0,
          method: 'CREDIT_CARD',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('BAD_REQUEST');
      expect(res.body.error.message).toMatch(/exceeds remaining invoice balance/i);

      // Verify no payment was recorded
      const payments = Array.from(inMemoryPayments.values()).filter((p) => p.invoice_id === 103);
      expect(payments).toHaveLength(0);
    });

    it('should reject payment on DRAFT invoices with 400', async () => {
      inMemoryInvoices.set(104, {
        id: 104,
        number: 'INV-TEST-104',
        subscription_id: 1,
        customer_id: 4,
        period_start: '2026-05-01',
        period_end: '2026-05-31',
        status: 'DRAFT',
        subtotal: 100.0,
        tax_total: 0.0,
        discount_total: 0.0,
        total: 100.0,
        due_date: '2026-05-15',
      });

      const res = await request(app)
        .post('/api/payments')
        .send({
          invoice_id: 104,
          amount: 50.0,
          method: 'CREDIT_CARD',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('BAD_REQUEST');
      expect(res.body.error.message).toMatch(/cannot record payment on a DRAFT invoice/i);
    });

    it('should reject payment on CANCELLED invoices with 400', async () => {
      inMemoryInvoices.set(105, {
        id: 105,
        number: 'INV-TEST-105',
        subscription_id: 1,
        customer_id: 4,
        period_start: '2026-05-01',
        period_end: '2026-05-31',
        status: 'CANCELLED',
        subtotal: 100.0,
        tax_total: 0.0,
        discount_total: 0.0,
        total: 100.0,
        due_date: '2026-05-15',
      });

      const res = await request(app)
        .post('/api/payments')
        .send({
          invoice_id: 105,
          amount: 50.0,
          method: 'CREDIT_CARD',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('BAD_REQUEST');
      expect(res.body.error.message).toMatch(/cannot record payment on a CANCELLED invoice/i);
    });

    it('should validate payment input with Zod', async () => {
      const res = await request(app)
        .post('/api/payments')
        .send({
          invoice_id: 'invalid-id',
          amount: -25,
          method: '',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /api/invoices - Computed Fields & Filtering', () => {
    beforeEach(() => {
      // Seed test invoices with different states
      inMemoryInvoices.set(201, {
        id: 201,
        number: 'INV-PAID-201',
        subscription_id: 1,
        customer_id: 4,
        period_start: '2026-01-01',
        period_end: '2026-01-31',
        status: 'PAID',
        subtotal: 100.0,
        tax_total: 0.0,
        discount_total: 0.0,
        total: 100.0,
        due_date: '2026-01-15',
      });
      inMemoryPayments.set(501, {
        id: 501,
        invoice_id: 201,
        method: 'CREDIT_CARD',
        amount: 100.0,
        paid_at: '2026-01-10',
      });

      inMemoryInvoices.set(202, {
        id: 202,
        number: 'INV-OVERDUE-202',
        subscription_id: 1,
        customer_id: 4,
        period_start: '2026-02-01',
        period_end: '2026-02-28',
        status: 'CONFIRMED',
        subtotal: 200.0,
        tax_total: 0.0,
        discount_total: 0.0,
        total: 200.0,
        due_date: '2026-02-15', // Due in the past relative to 2026-03-01
      });
      inMemoryPayments.set(502, {
        id: 502,
        invoice_id: 202,
        method: 'BANK_TRANSFER',
        amount: 50.0, // Partial payment, balance is 150
        paid_at: '2026-02-10',
      });

      inMemoryInvoices.set(203, {
        id: 203,
        number: 'INV-CURRENT-203',
        subscription_id: 2,
        customer_id: 5,
        period_start: '2026-03-01',
        period_end: '2026-03-31',
        status: 'CONFIRMED',
        subtotal: 150.0,
        tax_total: 0.0,
        discount_total: 0.0,
        total: 150.0,
        due_date: '2026-03-25', // Future due date relative to 2026-03-01
      });
    });

    it('should compute amount_paid, balance, and overdue flag on all returned invoices', async () => {
      const res = await request(app).get('/api/invoices?as_of_date=2026-03-01');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');

      const inv201 = res.body.data.find((i: any) => i.id === 201);
      expect(inv201.amount_paid).toBe(100.0);
      expect(inv201.balance).toBe(0.0);
      expect(inv201.overdue).toBe(false);

      const inv202 = res.body.data.find((i: any) => i.id === 202);
      expect(inv202.amount_paid).toBe(50.0);
      expect(inv202.balance).toBe(150.0);
      expect(inv202.overdue).toBe(true);
      expect(inv202.days_overdue).toBeGreaterThan(0);

      const inv203 = res.body.data.find((i: any) => i.id === 203);
      expect(inv203.amount_paid).toBe(0.0);
      expect(inv203.balance).toBe(150.0);
      expect(inv203.overdue).toBe(false);
    });

    it('should filter invoices by payment_status=paid', async () => {
      const res = await request(app).get('/api/invoices?payment_status=paid&as_of_date=2026-03-01');
      expect(res.status).toBe(200);
      expect(res.body.data.every((i: any) => i.balance === 0 || i.status === 'PAID')).toBe(true);
    });

    it('should filter invoices by payment_status=outstanding', async () => {
      const res = await request(app).get('/api/invoices?payment_status=outstanding&as_of_date=2026-03-01');
      expect(res.status).toBe(200);
      expect(res.body.data.every((i: any) => i.balance > 0)).toBe(true);
    });

    it('should filter invoices by payment_status=overdue', async () => {
      const res = await request(app).get('/api/invoices?payment_status=overdue&as_of_date=2026-03-01');
      expect(res.status).toBe(200);
      expect(res.body.data.every((i: any) => i.overdue === true)).toBe(true);
    });

    it('should filter invoices by customer', async () => {
      const res = await request(app).get('/api/invoices?customer_id=5');
      expect(res.status).toBe(200);
      expect(res.body.data.every((i: any) => i.customer_id === 5)).toBe(true);
    });
  });

  describe('GET /api/invoices/overdue - Overdue Calculation & Oldest First Sorting', () => {
    beforeEach(() => {
      // 3 overdue invoices with different due dates
      inMemoryInvoices.set(301, {
        id: 301,
        number: 'INV-OVERDUE-10DAYS',
        subscription_id: 1,
        customer_id: 4,
        period_start: '2026-05-01',
        period_end: '2026-05-31',
        status: 'CONFIRMED',
        subtotal: 100.0,
        tax_total: 0.0,
        discount_total: 0.0,
        total: 100.0,
        due_date: '2026-05-20', // 11 days overdue relative to 2026-05-31
      });

      inMemoryInvoices.set(302, {
        id: 302,
        number: 'INV-OVERDUE-30DAYS',
        subscription_id: 1,
        customer_id: 4,
        period_start: '2026-04-01',
        period_end: '2026-04-30',
        status: 'CONFIRMED',
        subtotal: 200.0,
        tax_total: 0.0,
        discount_total: 0.0,
        total: 200.0,
        due_date: '2026-05-01', // 30 days overdue relative to 2026-05-31
      });

      inMemoryInvoices.set(303, {
        id: 303,
        number: 'INV-OVERDUE-50DAYS',
        subscription_id: 2,
        customer_id: 5,
        period_start: '2026-03-01',
        period_end: '2026-03-31',
        status: 'CONFIRMED',
        subtotal: 300.0,
        tax_total: 0.0,
        discount_total: 0.0,
        total: 300.0,
        due_date: '2026-04-11', // 50 days overdue relative to 2026-05-31
      });

      // Paid invoice with past due date should NOT appear in overdue list
      inMemoryInvoices.set(304, {
        id: 304,
        number: 'INV-PAID-PASTDUE',
        subscription_id: 2,
        customer_id: 5,
        period_start: '2026-01-01',
        period_end: '2026-01-31',
        status: 'PAID',
        subtotal: 50.0,
        tax_total: 0.0,
        discount_total: 0.0,
        total: 50.0,
        due_date: '2026-01-15',
      });
      inMemoryPayments.set(604, {
        id: 604,
        invoice_id: 304,
        method: 'CASH',
        amount: 50.0,
        paid_at: '2026-01-10',
      });
    });

    it('should return overdue invoices with computed days_overdue sorted oldest first', async () => {
      const res = await request(app).get('/api/invoices/overdue?as_of_date=2026-05-31');

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(3);

      // Verify days_overdue is positive and correct
      const inv50Days = res.body.data.find((i: any) => i.id === 303);
      expect(inv50Days.days_overdue).toBe(50);

      const inv30Days = res.body.data.find((i: any) => i.id === 302);
      expect(inv30Days.days_overdue).toBe(30);

      const inv10Days = res.body.data.find((i: any) => i.id === 301);
      expect(inv10Days.days_overdue).toBe(11);

      // Paid invoice should NOT be in overdue list
      const paidInv = res.body.data.find((i: any) => i.id === 304);
      expect(paidInv).toBeUndefined();

      // Assert sorted oldest first (due_date ASC, days_overdue DESC)
      const ids = res.body.data.map((i: any) => i.id);
      const idx303 = ids.indexOf(303); // oldest (due 2026-04-11)
      const idx302 = ids.indexOf(302); // middle (due 2026-05-01)
      const idx301 = ids.indexOf(301); // newest (due 2026-05-20)

      expect(idx303).toBeLessThan(idx302);
      expect(idx302).toBeLessThan(idx301);
    });

    it('should also be accessible via /api/payments/invoices/overdue', async () => {
      const res = await request(app).get('/api/payments/invoices/overdue?as_of_date=2026-05-31');
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(3);
      expect(res.body.data[0].due_date <= res.body.data[1].due_date).toBe(true);
    });
  });
});
