import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../../app';
import { env } from '../../config/env';
import {
  calculateInvoiceTotals,
  roundToTwoDecimals,
  normalizeDateString,
  isDiscountValidAndAvailable,
} from './tax-discount.calculator';
import { taxDiscountService, inMemoryDiscounts, inMemoryTaxes } from './tax-discount.service';
import { Discount, Tax, InvoiceLineInput } from './tax-discount.types';

describe('Tax & Discount Module', () => {
  const adminToken = jwt.sign(
    { id: 1, email: 'admin@brightloop.com', role: 'ADMIN', name: 'Admin' },
    env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  const customerToken = jwt.sign(
    { id: 4, email: 'customer1@brightloop.com', role: 'CUSTOMER', name: 'Customer' },
    env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  const staffToken = jwt.sign(
    { id: 2, email: 'staff1@brightloop.com', role: 'STAFF', name: 'Staff' },
    env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  /* =========================================================================
   * 1. PURE FUNCTION: calculateInvoiceTotals() UNIT TESTS
   * ========================================================================= */
  describe('calculateInvoiceTotals()', () => {
    const today = '2026-06-15';

    const sampleTaxes: Tax[] = [
      { id: 1, name: 'Standard VAT', rate_percent: 20.0, active: true },
      { id: 2, name: 'Reduced GST', rate_percent: 5.0, active: true },
      { id: 3, name: 'Inactive Tax', rate_percent: 15.0, active: false },
    ];

    it('should calculate basic totals with no discounts and no taxes', () => {
      const lines: InvoiceLineInput[] = [
        { product_id: 1, quantity: 2, unit_price: 50.0 }, // 100.00
        { product_id: 2, quantity: 1, unit_price: 35.5 }, // 35.50
      ];

      const res = calculateInvoiceTotals(lines, [], [], today);
      expect(res.subtotal).toBe(135.5);
      expect(res.discountTotal).toBe(0);
      expect(res.taxTotal).toBe(0);
      expect(res.total).toBe(135.5);
      expect(res.lines).toHaveLength(2);
      expect(res.lines[0].subtotal).toBe(100.0);
      expect(res.lines[1].subtotal).toBe(35.5);
    });

    it('should correctly apply percentage tax to invoice lines', () => {
      const lines: InvoiceLineInput[] = [
        { product_id: 1, quantity: 2, unit_price: 100.0, tax_id: 1 }, // 200 + 20% = 240
        { product_id: 2, quantity: 1, unit_price: 100.0, tax_id: 2 }, // 100 + 5% = 105
      ];

      const res = calculateInvoiceTotals(lines, [], sampleTaxes, today);
      expect(res.subtotal).toBe(300.0);
      expect(res.discountTotal).toBe(0);
      expect(res.taxTotal).toBe(45.0); // 40 + 5
      expect(res.total).toBe(345.0);

      expect(res.lines[0].taxAmount).toBe(40.0);
      expect(res.lines[0].total).toBe(240.0);
      expect(res.lines[1].taxAmount).toBe(5.0);
      expect(res.lines[1].total).toBe(105.0);
    });

    it('should ignore inactive taxes (treat tax rate as 0%)', () => {
      const lines: InvoiceLineInput[] = [
        { product_id: 1, quantity: 1, unit_price: 100.0, tax_id: 3 }, // tax_id 3 is inactive
      ];

      const res = calculateInvoiceTotals(lines, [], sampleTaxes, today);
      expect(res.subtotal).toBe(100.0);
      expect(res.taxTotal).toBe(0);
      expect(res.total).toBe(100.0);
      expect(res.lines[0].taxRatePercent).toBe(0);
    });

    it('should apply discount BEFORE tax (tax computed on discounted amount)', () => {
      const lines: InvoiceLineInput[] = [
        { product_id: 1, quantity: 1, unit_price: 100.0, tax_id: 1 }, // 20% VAT
      ];
      const discounts: Discount[] = [
        {
          id: 10,
          name: '10% Off Product 1',
          type: 'PERCENT',
          value: 10.0,
          applies_to: 'PRODUCT',
          product_id: 1,
          used_count: 0,
        },
      ];

      const res = calculateInvoiceTotals(lines, discounts, sampleTaxes, today);
      expect(res.subtotal).toBe(100.0);
      expect(res.discountTotal).toBe(10.0); // 10% of 100
      // Taxable amount is 90.00. Tax is 20% of 90.00 = 18.00 (NOT 20.00)
      expect(res.taxTotal).toBe(18.0);
      expect(res.total).toBe(108.0); // 90 + 18
      expect(res.lines[0].taxableAmount).toBe(90.0);
      expect(res.lines[0].taxAmount).toBe(18.0);
    });

    it('should apply FIXED discount to a specific PRODUCT', () => {
      const lines: InvoiceLineInput[] = [
        { product_id: 1, quantity: 2, unit_price: 50.0 }, // 100
        { product_id: 2, quantity: 1, unit_price: 80.0 }, // 80
      ];
      const discounts: Discount[] = [
        {
          id: 11,
          name: '$25 Off Product 1',
          type: 'FIXED',
          value: 25.0,
          applies_to: 'PRODUCT',
          product_id: 1,
          used_count: 0,
        },
      ];

      const res = calculateInvoiceTotals(lines, discounts, [], today);
      expect(res.subtotal).toBe(180.0);
      expect(res.discountTotal).toBe(25.0);
      expect(res.total).toBe(155.0);
      expect(res.lines[0].discountAmount).toBe(25.0);
      expect(res.lines[1].discountAmount).toBe(0);
    });

    it('should apply PERCENT discount to the whole SUBSCRIPTION', () => {
      const lines: InvoiceLineInput[] = [
        { product_id: 1, quantity: 1, unit_price: 100.0 },
        { product_id: 2, quantity: 1, unit_price: 200.0 },
      ];
      const discounts: Discount[] = [
        {
          id: 12,
          name: '15% Off Subscription',
          type: 'PERCENT',
          value: 15.0,
          applies_to: 'SUBSCRIPTION',
          used_count: 0,
        },
      ];

      const res = calculateInvoiceTotals(lines, discounts, [], today);
      expect(res.subtotal).toBe(300.0);
      expect(res.discountTotal).toBe(45.0); // 15% of 300
      expect(res.total).toBe(255.0);
      expect(res.lines[0].discountAmount).toBe(15.0); // 15% of 100
      expect(res.lines[1].discountAmount).toBe(30.0); // 15% of 200
    });

    it('should proportionally distribute FIXED SUBSCRIPTION discount across lines', () => {
      const lines: InvoiceLineInput[] = [
        { product_id: 1, quantity: 1, unit_price: 100.0 }, // 1/3 of subtotal
        { product_id: 2, quantity: 1, unit_price: 200.0 }, // 2/3 of subtotal
      ];
      const discounts: Discount[] = [
        {
          id: 13,
          name: '$60 Off Subscription',
          type: 'FIXED',
          value: 60.0,
          applies_to: 'SUBSCRIPTION',
          used_count: 0,
        },
      ];

      const res = calculateInvoiceTotals(lines, discounts, [], today);
      expect(res.subtotal).toBe(300.0);
      expect(res.discountTotal).toBe(60.0);
      expect(res.total).toBe(240.0);
      expect(res.lines[0].discountAmount).toBe(20.0);
      expect(res.lines[1].discountAmount).toBe(40.0);
    });

    /* --- EDGE CASES --- */

    it('EDGE CASE: expired discount (end_date in past) does NOT apply', () => {
      const lines: InvoiceLineInput[] = [{ product_id: 1, quantity: 1, unit_price: 100.0 }];
      const discounts: Discount[] = [
        {
          id: 20,
          name: 'Expired Promo',
          type: 'PERCENT',
          value: 50.0,
          applies_to: 'SUBSCRIPTION',
          start_date: '2026-01-01',
          end_date: '2026-05-31', // Before today '2026-06-15'
          used_count: 0,
        },
      ];

      const res = calculateInvoiceTotals(lines, discounts, [], today);
      expect(res.discountTotal).toBe(0);
      expect(res.total).toBe(100.0);
    });

    it('EDGE CASE: future discount (start_date in future) does NOT apply', () => {
      const lines: InvoiceLineInput[] = [{ product_id: 1, quantity: 1, unit_price: 100.0 }];
      const discounts: Discount[] = [
        {
          id: 21,
          name: 'Future Black Friday',
          type: 'PERCENT',
          value: 30.0,
          applies_to: 'SUBSCRIPTION',
          start_date: '2026-11-01', // After today '2026-06-15'
          used_count: 0,
        },
      ];

      const res = calculateInvoiceTotals(lines, discounts, [], today);
      expect(res.discountTotal).toBe(0);
      expect(res.total).toBe(100.0);
    });

    it('EDGE CASE: exhausted discount (used_count >= usage_limit) does NOT apply', () => {
      const lines: InvoiceLineInput[] = [{ product_id: 1, quantity: 1, unit_price: 100.0 }];
      const discounts: Discount[] = [
        {
          id: 22,
          name: 'First 10 Customers Only',
          type: 'FIXED',
          value: 20.0,
          applies_to: 'SUBSCRIPTION',
          usage_limit: 10,
          used_count: 10, // Exhausted
        },
      ];

      const res = calculateInvoiceTotals(lines, discounts, [], today);
      expect(res.discountTotal).toBe(0);
      expect(res.total).toBe(100.0);
    });

    it('EDGE CASE: discount below min_purchase threshold does NOT apply', () => {
      const lines: InvoiceLineInput[] = [{ product_id: 1, quantity: 1, unit_price: 80.0 }];
      const discounts: Discount[] = [
        {
          id: 23,
          name: 'Big Spender Discount',
          type: 'FIXED',
          value: 20.0,
          min_purchase: 100.0, // Subtotal 80 is below 100
          applies_to: 'SUBSCRIPTION',
          used_count: 0,
        },
      ];

      const res = calculateInvoiceTotals(lines, discounts, [], today);
      expect(res.discountTotal).toBe(0);
      expect(res.total).toBe(80.0);
    });

    it('EDGE CASE: discount below min_quantity threshold does NOT apply', () => {
      const lines: InvoiceLineInput[] = [{ product_id: 1, quantity: 2, unit_price: 50.0 }];
      const discounts: Discount[] = [
        {
          id: 24,
          name: 'Bulk Pack Discount',
          type: 'PERCENT',
          value: 10.0,
          min_quantity: 5, // Qty 2 is below 5
          applies_to: 'SUBSCRIPTION',
          used_count: 0,
        },
      ];

      const res = calculateInvoiceTotals(lines, discounts, [], today);
      expect(res.discountTotal).toBe(0);
      expect(res.total).toBe(100.0);
    });

    it('EDGE CASE: fixed discount amount greater than subtotal - capped at subtotal, total NEVER negative', () => {
      const lines: InvoiceLineInput[] = [
        { product_id: 1, quantity: 1, unit_price: 75.0, tax_id: 1 }, // 75 subtotal, 20% VAT
      ];
      const discounts: Discount[] = [
        {
          id: 25,
          name: 'Huge $500 Credit',
          type: 'FIXED',
          value: 500.0, // Exceeds 75.00
          applies_to: 'SUBSCRIPTION',
          used_count: 0,
        },
      ];

      const res = calculateInvoiceTotals(lines, discounts, sampleTaxes, today);
      expect(res.subtotal).toBe(75.0);
      // Discount must be capped at 75.00
      expect(res.discountTotal).toBe(75.0);
      expect(res.lines[0].taxableAmount).toBe(0.0);
      expect(res.taxTotal).toBe(0.0);
      // Total must be 0 and never negative
      expect(res.total).toBe(0.0);
      expect(res.total).toBeGreaterThanOrEqual(0);
    });

    it('EDGE CASE: handles repeating decimals and half-cent rounding consistently', () => {
      const lines: InvoiceLineInput[] = [
        { product_id: 1, quantity: 3, unit_price: 33.3333, tax_id: 1 }, // 20% VAT
      ];

      const res = calculateInvoiceTotals(lines, [], sampleTaxes, today);
      expect(res.subtotal).toBe(100.0);
      expect(res.taxTotal).toBe(20.0);
      expect(res.total).toBe(120.0);
    });

    it('EDGE CASE: empty lines array returns zeroed structure', () => {
      const res = calculateInvoiceTotals([], [], sampleTaxes, today);
      expect(res.lines).toHaveLength(0);
      expect(res.subtotal).toBe(0);
      expect(res.discountTotal).toBe(0);
      expect(res.taxTotal).toBe(0);
      expect(res.total).toBe(0);
    });
  });

  /* =========================================================================
   * 2. CONDITIONAL USAGE INCREMENT: incrementDiscountUsage()
   * ========================================================================= */
  describe('incrementDiscountUsage()', () => {
    it('should increment used_count when used_count < usage_limit', async () => {
      // Create a test discount in the service
      const discount = await taxDiscountService.createDiscount({
        name: 'Limited Flash Sale',
        type: 'PERCENT',
        value: 10.0,
        usage_limit: 5,
        applies_to: 'SUBSCRIPTION',
      });

      expect(discount.used_count).toBe(0);

      // Increment 1
      const inc1 = await taxDiscountService.incrementDiscountUsage(discount.id);
      expect(inc1.used_count).toBe(1);

      // Increment 2
      const inc2 = await taxDiscountService.incrementDiscountUsage(discount.id);
      expect(inc2.used_count).toBe(2);
    });

    it('should fail and throw ApiError.badRequest when usage_limit is reached (exhausted)', async () => {
      const discount = await taxDiscountService.createDiscount({
        name: 'Single-Use Voucher',
        type: 'FIXED',
        value: 20.0,
        usage_limit: 1,
        applies_to: 'SUBSCRIPTION',
      });

      // Use the single allowed usage
      await taxDiscountService.incrementDiscountUsage(discount.id);

      // Attempting to increment past the limit must throw
      await expect(
        taxDiscountService.incrementDiscountUsage(discount.id)
      ).rejects.toThrow(/exhausted|usage limit/i);
    });

    it('should increment without limit when usage_limit is null', async () => {
      const discount = await taxDiscountService.createDiscount({
        name: 'Evergreen Promotion',
        type: 'PERCENT',
        value: 5.0,
        usage_limit: null,
        applies_to: 'SUBSCRIPTION',
      });

      const updated = await taxDiscountService.incrementDiscountUsage(discount.id);
      expect(updated.used_count).toBe(1);
    });

    it('should throw ApiError.notFound if discount does not exist', async () => {
      await expect(
        taxDiscountService.incrementDiscountUsage(999999)
      ).rejects.toThrow(/not found/i);
    });
  });

  /* =========================================================================
   * 3. ADMIN-ONLY TAXES CRUD API ENDPOINTS
   * ========================================================================= */
  describe('Taxes Admin-only CRUD Endpoints', () => {
    it('POST /api/tax-discount/taxes should reject requests without token with 401 UNAUTHORIZED', async () => {
      const res = await request(app)
        .post('/api/tax-discount/taxes')
        .send({ name: 'State Tax', rate_percent: 7.5 });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('POST /api/tax-discount/taxes should reject non-admin (CUSTOMER) with 403 FORBIDDEN', async () => {
      const res = await request(app)
        .post('/api/tax-discount/taxes')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ name: 'State Tax', rate_percent: 7.5 });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('POST /api/tax-discount/taxes should reject non-admin (STAFF) with 403 FORBIDDEN', async () => {
      const res = await request(app)
        .post('/api/tax-discount/taxes')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ name: 'State Tax', rate_percent: 7.5 });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('POST /api/tax-discount/taxes should validate input with Zod', async () => {
      // Negative tax rate
      const resNeg = await request(app)
        .post('/api/tax-discount/taxes')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Bad Tax', rate_percent: -5 });

      expect(resNeg.status).toBe(400);
      expect(resNeg.body.error.code).toBe('VALIDATION_ERROR');

      // Rate > 100%
      const resOver = await request(app)
        .post('/api/tax-discount/taxes')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Bad Tax', rate_percent: 150 });

      expect(resOver.status).toBe(400);
      expect(resOver.body.error.code).toBe('VALIDATION_ERROR');

      // Empty name
      const resEmpty = await request(app)
        .post('/api/tax-discount/taxes')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: '', rate_percent: 10 });

      expect(resEmpty.status).toBe(400);
      expect(resEmpty.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('POST /api/tax-discount/taxes should allow ADMIN to create tax (201 Created)', async () => {
      const res = await request(app)
        .post('/api/tax-discount/taxes')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Municipal GST', rate_percent: 8.5, active: true });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data.name).toBe('Municipal GST');
      expect(res.body.data.rate_percent).toBe(8.5);
      expect(res.body.data.active).toBe(true);
    });

    it('GET /api/tax-discount/taxes should return standard paginated format', async () => {
      const res = await request(app)
        .get('/api/tax-discount/taxes?page=1&limit=5&sort=name:asc')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body).toHaveProperty('page', 1);
      expect(res.body).toHaveProperty('limit', 5);
      expect(res.body).toHaveProperty('total');
    });

    it('GET /api/tax-discount/taxes/:id should return single tax', async () => {
      const res = await request(app)
        .get('/api/tax-discount/taxes/1')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(1);
    });

    it('PATCH /api/tax-discount/taxes/:id should allow ADMIN to update tax', async () => {
      const res = await request(app)
        .patch('/api/tax-discount/taxes/1')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ rate_percent: 21.0 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.rate_percent).toBe(21.0);
    });

    it('DELETE /api/tax-discount/taxes/:id should allow ADMIN to delete tax', async () => {
      // Create a temporary tax to delete
      const created = await taxDiscountService.createTax({
        name: 'Temporary Tax',
        rate_percent: 4.0,
      });

      const res = await request(app)
        .delete(`/api/tax-discount/taxes/${created.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('DIRECT MOUNT: GET /api/taxes should support direct alias', async () => {
      const res = await request(app)
        .get('/api/taxes')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
    });
  });

  /* =========================================================================
   * 4. ADMIN-ONLY DISCOUNTS CRUD API ENDPOINTS
   * ========================================================================= */
  describe('Discounts Admin-only CRUD Endpoints', () => {
    it('POST /api/tax-discount/discounts should reject unauthenticated requests with 401', async () => {
      const res = await request(app)
        .post('/api/tax-discount/discounts')
        .send({ name: 'Promo', type: 'FIXED', value: 10, applies_to: 'SUBSCRIPTION' });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('POST /api/tax-discount/discounts should reject non-admin (CUSTOMER) with 403', async () => {
      const res = await request(app)
        .post('/api/tax-discount/discounts')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ name: 'Promo', type: 'FIXED', value: 10, applies_to: 'SUBSCRIPTION' });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('POST /api/tax-discount/discounts should validate with Zod (rejects invalid percentage, missing product_id, bad dates)', async () => {
      // PERCENT > 100
      const resOverPercent = await request(app)
        .post('/api/tax-discount/discounts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Invalid Percent',
          type: 'PERCENT',
          value: 120,
          applies_to: 'SUBSCRIPTION',
        });
      expect(resOverPercent.status).toBe(400);
      expect(resOverPercent.body.error.code).toBe('VALIDATION_ERROR');

      // PRODUCT discount without product_id
      const resNoProdId = await request(app)
        .post('/api/tax-discount/discounts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Product Discount without Product',
          type: 'FIXED',
          value: 15,
          applies_to: 'PRODUCT',
        });
      expect(resNoProdId.status).toBe(400);
      expect(resNoProdId.body.error.code).toBe('VALIDATION_ERROR');

      // end_date before start_date
      const resBadDates = await request(app)
        .post('/api/tax-discount/discounts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Time Travel Discount',
          type: 'FIXED',
          value: 10,
          applies_to: 'SUBSCRIPTION',
          start_date: '2026-12-01',
          end_date: '2026-01-01',
        });
      expect(resBadDates.status).toBe(400);
      expect(resBadDates.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('POST /api/tax-discount/discounts should allow ADMIN to create valid discount', async () => {
      const res = await request(app)
        .post('/api/tax-discount/discounts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Summer Splash Sale',
          type: 'PERCENT',
          value: 20.0,
          min_purchase: 100.0,
          min_quantity: 2,
          start_date: '2026-06-01',
          end_date: '2026-08-31',
          usage_limit: 200,
          applies_to: 'SUBSCRIPTION',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Summer Splash Sale');
      expect(res.body.data.used_count).toBe(0);
      expect(res.body.data.type).toBe('PERCENT');
      expect(res.body.data.value).toBe(20.0);
    });

    it('GET /api/tax-discount/discounts should support pagination and filtering', async () => {
      const res = await request(app)
        .get('/api/tax-discount/discounts?page=1&limit=5&sort=name:asc')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body).toHaveProperty('page', 1);
      expect(res.body).toHaveProperty('total');
    });

    it('PATCH /api/tax-discount/discounts/:id should allow ADMIN to update discount', async () => {
      const res = await request(app)
        .patch('/api/tax-discount/discounts/1')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ value: 18.0 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.value).toBe(18.0);
    });

    it('POST /api/tax-discount/discounts/:id/increment-usage should conditionally increment used_count', async () => {
      const created = await taxDiscountService.createDiscount({
        name: 'Invoiced Discount Test',
        type: 'FIXED',
        value: 10,
        usage_limit: 10,
        applies_to: 'SUBSCRIPTION',
      });

      const res = await request(app)
        .post(`/api/tax-discount/discounts/${created.id}/increment-usage`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.used_count).toBe(1);
    });

    it('DELETE /api/tax-discount/discounts/:id should allow ADMIN to delete discount', async () => {
      const created = await taxDiscountService.createDiscount({
        name: 'Discount to Delete',
        type: 'FIXED',
        value: 5,
        applies_to: 'SUBSCRIPTION',
      });

      const res = await request(app)
        .delete(`/api/tax-discount/discounts/${created.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  /* =========================================================================
   * 5. INVOICE TOTALS CALCULATION ENDPOINT
   * ========================================================================= */
  describe('POST /api/tax-discount/calculate-totals', () => {
    it('should calculate invoice totals with line discounts and taxes via API', async () => {
      const payload = {
        lines: [
          {
            product_id: 1,
            description: 'Cloud Suite',
            quantity: 2,
            unit_price: 50.0,
            tax_id: 1,
          },
        ],
        discounts: [
          {
            id: 1,
            name: '10% Off',
            type: 'PERCENT',
            value: 10,
            applies_to: 'SUBSCRIPTION',
            used_count: 0,
          },
        ],
        taxes: [
          {
            id: 1,
            name: 'VAT',
            rate_percent: 20,
            active: true,
          },
        ],
        today: '2026-06-15',
      };

      const res = await request(app)
        .post('/api/tax-discount/calculate-totals')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(payload);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.subtotal).toBe(100.0);
      expect(res.body.data.discountTotal).toBe(10.0);
      // Taxable: 90.00. Tax: 20% of 90 = 18.00
      expect(res.body.data.taxTotal).toBe(18.0);
      expect(res.body.data.total).toBe(108.0);
    });
  });
});
