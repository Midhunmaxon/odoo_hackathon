import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../app';
import { env } from '../config/env';
import { getEffectivePrice, catalogService } from '../modules/catalog/catalog.service';

describe('Catalog Module (Products, Variants & Plans)', () => {
  const adminToken = jwt.sign(
    { id: 1, email: 'admin@brightloop.com', role: 'ADMIN', name: 'Admin User' },
    env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  const staffToken = jwt.sign(
    { id: 2, email: 'staff1@brightloop.com', role: 'STAFF', name: 'Staff Member' },
    env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  const customerToken = jwt.sign(
    { id: 4, email: 'customer1@brightloop.com', role: 'CUSTOMER', name: 'Customer User' },
    env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  describe('Products & Variants CRUD & RBAC', () => {
    it('GET /catalog/products should allow Staff and Admin read access', async () => {
      const resStaff = await request(app)
        .get('/catalog/products?page=1&limit=5')
        .set('Authorization', `Bearer ${staffToken}`);
      expect(resStaff.status).toBe(200);
      expect(resStaff.body).toHaveProperty('data');
      expect(resStaff.body).toHaveProperty('page', 1);

      const resAdmin = await request(app)
        .get('/catalog/products')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(resAdmin.status).toBe(200);
    });

    it('POST /catalog/products should forbid Staff write access with 403', async () => {
      const res = await request(app)
        .post('/catalog/products')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          name: 'Unauthorized Product',
          sales_price: 100,
        });
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('POST /catalog/products should allow Admin to create a product with variants', async () => {
      const res = await request(app)
        .post('/catalog/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Enterprise ERP Suite',
          type: 'service',
          sales_price: 500,
          cost_price: 200,
          variants: [
            { attribute: 'Brand', value: 'Odoo', extra_price: 560 },
            { attribute: 'Tier', value: 'Gold', extra_price: 150 },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Enterprise ERP Suite');
      expect(res.body.data.variants).toHaveLength(2);
      expect(res.body.data.variants[0].value).toBe('Odoo');
      expect(Number(res.body.data.variants[0].extra_price)).toBe(560);
    });

    it('Helper getEffectivePrice should return base price without variant, and base + extra_price with variant', async () => {
      // Product 3 has base sales_price 299, Variant 7 has attribute Brand=Odoo, extra_price 560
      const basePrice = await getEffectivePrice(3);
      expect(basePrice).toBe(299);

      const effectivePrice = await getEffectivePrice(3, 7);
      expect(effectivePrice).toBe(299 + 560); // 859
    });

    it('GET /catalog/products/:id should return single product with its variants', async () => {
      const res = await request(app)
        .get('/catalog/products/3')
        .set('Authorization', `Bearer ${staffToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(3);
      expect(Array.isArray(res.body.data.variants)).toBe(true);
    });

    it('PATCH /catalog/products/:id should allow Admin to update product', async () => {
      const res = await request(app)
        .patch('/catalog/products/1')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ sales_price: 59 });
      expect(res.status).toBe(200);
      expect(Number(res.body.data.sales_price)).toBe(59);
    });
  });

  describe('Plans CRUD & Validation Rules', () => {
    it('POST /catalog/plans should validate min_quantity >= 1, prices >= 0, and end_date after start_date', async () => {
      // 1. Negative price
      const resNegPrice = await request(app)
        .post('/catalog/plans')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Invalid Plan 1',
          price: -10,
          billing_period: 'MONTHLY',
        });
      expect(resNegPrice.status).toBe(400);
      expect(resNegPrice.body.error.code).toBe('VALIDATION_ERROR');

      // 2. min_quantity < 1
      const resMinQty = await request(app)
        .post('/catalog/plans')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Invalid Plan 2',
          price: 50,
          billing_period: 'MONTHLY',
          min_quantity: 0,
        });
      expect(resMinQty.status).toBe(400);

      // 3. end_date before start_date
      const resDate = await request(app)
        .post('/catalog/plans')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Invalid Date Plan',
          price: 50,
          billing_period: 'MONTHLY',
          start_date: '2026-12-01',
          end_date: '2026-06-01', // earlier than start_date
        });
      expect(resDate.status).toBe(400);
      const messages = resDate.body.error.details.map((d: any) => d.message);
      expect(messages).toContain('end_date must be after start_date');
    });

    it('POST /catalog/plans should create valid plan for Admin', async () => {
      const res = await request(app)
        .post('/catalog/plans')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Custom Quarterly Plan',
          price: 199,
          billing_period: 'MONTHLY',
          min_quantity: 2,
          start_date: '2026-01-01',
          end_date: '2026-12-31',
          auto_close: true,
          allow_close: true,
          allow_pause: true,
          allow_renew: true,
        });
      expect(res.status).toBe(201);
      expect(res.body.data.name).toBe('Custom Quarterly Plan');
      expect(res.body.data.min_quantity).toBe(2);
    });

    it('POST /catalog/plans should reject non-Admin write access', async () => {
      const res = await request(app)
        .post('/catalog/plans')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          name: 'Staff Plan',
          price: 50,
          billing_period: 'MONTHLY',
        });
      expect(res.status).toBe(403);
    });
  });

  describe('Plan Actions (/plans/:id/close, /pause, /renew)', () => {
    it('POST /plans/:id/close should succeed when allow_close is true', async () => {
      // Plan 1 has allow_close: true
      const res = await request(app)
        .post('/plans/1/close')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('CLOSED');
    });

    it('POST /plans/:id/close should reject when plan allow_close is false', async () => {
      // Plan 3 has allow_close: false (Enterprise Annual)
      const res = await request(app)
        .post('/plans/3/close')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(400);
      expect(res.body.error.message).toMatch(/does not allow closing/i);
    });

    it('POST /plans/:id/pause should succeed when allow_pause is true', async () => {
      const res = await request(app)
        .post('/plans/2/pause')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('PAUSED');
    });

    it('POST /plans/:id/renew should succeed when allow_renew is true and reactivate plan', async () => {
      const res = await request(app)
        .post('/plans/1/renew')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('ACTIVE');
    });
  });

  describe('Daily Cron Job Auto-Close', () => {
    it('checkAndAutoClosePlans should auto-close expired plans with auto_close: true', async () => {
      // Create an expired plan with auto_close: true
      const expiredPlan = await catalogService.createPlan({
        name: 'Past Promo Plan',
        price: 29,
        billing_period: 'MONTHLY',
        min_quantity: 1,
        start_date: '2025-01-01',
        end_date: '2025-06-01', // in the past
        auto_close: true,
        allow_close: true,
        allow_pause: true,
        allow_renew: true,
        status: 'ACTIVE',
      });

      const closedCount = await catalogService.checkAndAutoClosePlans();
      expect(closedCount).toBeGreaterThanOrEqual(1);

      const refreshed = await catalogService.getPlanById(expiredPlan.id);
      expect(refreshed.status).toBe('CLOSED');
    });
  });
});
