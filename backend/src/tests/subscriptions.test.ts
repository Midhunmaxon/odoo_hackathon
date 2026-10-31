import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../app';
import { env } from '../config/env';
import { subscriptionsService } from '../modules/subscriptions/subscriptions.service';
import { catalogService } from '../modules/catalog/catalog.service';

describe('Subscriptions Module (Templates, Subscriptions & Strict State Machine)', () => {
  const adminToken = jwt.sign(
    { id: 1, email: 'admin@brightloop.com', role: 'ADMIN', name: 'Admin User' },
    env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  const staffToken = jwt.sign(
    { id: 2, email: 'staff1@brightloop.com', role: 'STAFF', name: 'Staff User' },
    env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  const customerToken = jwt.sign(
    { id: 4, email: 'customer1@brightloop.com', role: 'CUSTOMER', name: 'Customer' },
    env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  describe('Quotation Templates CRUD', () => {
    let createdTemplateId: number;

    it('POST /subscriptions/templates should allow Staff to create quotation template', async () => {
      const res = await request(app)
        .post('/subscriptions/templates')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          name: 'Custom ERP Starter Template',
          validity_days: 21,
          plan_id: 1,
          lines: [
            { product_id: 1, variant_id: 1, quantity: 2 },
            { product_id: 3, variant_id: 7, quantity: 1 },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Custom ERP Starter Template');
      expect(res.body.data.validity_days).toBe(21);
      expect(res.body.data.lines).toHaveLength(2);
      createdTemplateId = res.body.data.id;
    });

    it('GET /subscriptions/templates should list templates with pagination', async () => {
      const res = await request(app)
        .get('/subscriptions/templates?page=1&limit=10')
        .set('Authorization', `Bearer ${staffToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.total).toBeGreaterThanOrEqual(1);
    });

    it('POST /subscriptions/from-template/:id should create DRAFT subscription with prefilled lines and computed expiry', async () => {
      const res = await request(app)
        .post(`/subscriptions/from-template/${createdTemplateId}`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          customer_id: 4,
          start_date: '2026-03-01',
          payment_terms: '15_days',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('DRAFT');
      expect(res.body.data.customer_id).toBe(4);
      expect(res.body.data.number).toMatch(/^SUB-\d{6}$/);

      // Expiry should be start_date + validity_days (2026-03-01 + 21 days = 2026-03-22)
      expect(res.body.data.expiry_date).toBe('2026-03-22');

      // Lines should be prefilled and server-computed
      expect(res.body.data.lines).toHaveLength(2);
      expect(res.body.data.lines[0].unit_price).toBeGreaterThan(0);
      expect(res.body.data.lines[0].amount).toBe(
        res.body.data.lines[0].unit_price * res.body.data.lines[0].quantity
      );
    });
  });

  describe('Subscription Creation & Business Rules', () => {
    it('POST /subscriptions should reject if total quantity < plan.min_quantity', async () => {
      // Plan 3 (Enterprise Annual) requires min_quantity: 5
      const res = await request(app)
        .post('/subscriptions')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          customer_id: 4,
          plan_id: 3, // min_quantity 5
          start_date: '2026-04-01',
          lines: [{ product_id: 1, quantity: 2 }], // 2 < 5
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toMatch(/less than plan.*minimum quantity/i);
    });

    it('POST /subscriptions should succeed with auto-generated unique number SUB-xxxxxx and server-computed line amounts', async () => {
      const res = await request(app)
        .post('/subscriptions')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          customer_id: 5,
          plan_id: 1, // Starter Monthly, min_quantity 1
          start_date: '2026-05-01',
          payment_terms: '30_days',
          lines: [
            { product_id: 3, variant_id: 7, quantity: 2 }, // Product 3 + Variant 7 ($299 + $560 = $859) * 2 = $1718
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.data.number).toMatch(/^SUB-\d{6}$/);
      expect(res.body.data.status).toBe('DRAFT');
      expect(res.body.data.lines).toHaveLength(1);
      expect(res.body.data.lines[0].unit_price).toBe(859);
      expect(res.body.data.lines[0].amount).toBe(1718);
    });

    it('POST /subscriptions should forbid CUSTOMER from creating subscriptions directly', async () => {
      const res = await request(app)
        .post('/subscriptions')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          customer_id: 4,
          plan_id: 1,
          lines: [{ product_id: 1, quantity: 1 }],
        });

      expect(res.status).toBe(403);
    });
  });

  describe('Strict State Machine (DRAFT → QUOTATION → CONFIRMED → ACTIVE → CLOSED)', () => {
    let subId: number;

    beforeAll(async () => {
      // Create a fresh subscription for state machine tests
      const sub = await subscriptionsService.createSubscription({
        customer_id: 4,
        plan_id: 1, // allow_close: true, allow_pause: true, allow_renew: true
        start_date: '2026-06-01',
        payment_terms: 'immediate',
        lines: [{ product_id: 1, quantity: 1 }],
      });
      subId = sub.id;
    });

    it('Should reject illegal jump: DRAFT → ACTIVE directly with 400', async () => {
      const res = await request(app)
        .post(`/subscriptions/${subId}/transition`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ to_status: 'ACTIVE' });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toMatch(/Illegal status transition.*cannot transition subscription from DRAFT to ACTIVE/i);
    });

    it('Should reject illegal jump: DRAFT → CONFIRMED with 400', async () => {
      const res = await request(app)
        .post(`/subscriptions/${subId}/transition`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ to_status: 'CONFIRMED' });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toMatch(/Illegal status transition/i);
    });

    it('Legal Transition 1: DRAFT → QUOTATION should succeed and record history row', async () => {
      const res = await request(app)
        .post(`/subscriptions/${subId}/transition`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ to_status: 'QUOTATION' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('QUOTATION');

      // Check history recorded
      const history = res.body.data.history;
      expect(history.length).toBeGreaterThanOrEqual(2);
      const lastEntry = history[history.length - 1];
      expect(lastEntry.from_status).toBe('DRAFT');
      expect(lastEntry.to_status).toBe('QUOTATION');
    });

    it('Legal Transition 2: QUOTATION → CONFIRMED should succeed', async () => {
      const res = await request(app)
        .post(`/subscriptions/${subId}/transition`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ to_status: 'CONFIRMED' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('CONFIRMED');
    });

    it('Legal Transition 3: CONFIRMED → ACTIVE should set next_billing_date and status ACTIVE', async () => {
      const res = await request(app)
        .post(`/subscriptions/${subId}/transition`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ to_status: 'ACTIVE' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('ACTIVE');
      expect(res.body.data.next_billing_date).toBeDefined();
      expect(res.body.data.next_billing_date).not.toBeNull();
    });

    it('Legal Transition 4: ACTIVE → CLOSED should close the subscription', async () => {
      const res = await request(app)
        .post(`/subscriptions/${subId}/transition`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ to_status: 'CLOSED' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('CLOSED');
    });

    it('Should reject transition from CLOSED to any state (terminal state)', async () => {
      const res = await request(app)
        .post(`/subscriptions/${subId}/transition`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ to_status: 'ACTIVE' });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toMatch(/Illegal status transition.*from CLOSED to ACTIVE/i);
    });

    it('Should honor plan rules: reject transition to CLOSED if plan.allow_close is false', async () => {
      // Create a plan with allow_close: false
      const nonClosablePlan = await catalogService.createPlan({
        name: 'Fixed Term Non-Closable Plan',
        price: 999,
        billing_period: 'YEARLY',
        min_quantity: 1,
        allow_close: false,
        allow_pause: true,
        allow_renew: true,
        status: 'ACTIVE',
      });

      // Create subscription under this plan
      const sub = await subscriptionsService.createSubscription({
        customer_id: 4,
        plan_id: nonClosablePlan.id,
        start_date: '2026-07-01',
        lines: [{ product_id: 1, quantity: 1 }],
      });

      // Attempt to transition to CLOSED
      const res = await request(app)
        .post(`/subscriptions/${sub.id}/transition`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ to_status: 'CLOSED' });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toMatch(/does not allow closing/i);
    });
  });

  describe('Subscriptions List & Filtering', () => {
    it('GET /subscriptions should support filters by status, customer and pagination', async () => {
      const res = await request(app)
        .get('/subscriptions?status=ACTIVE&page=1&limit=5&sort=id:desc')
        .set('Authorization', `Bearer ${staffToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('page', 1);
      expect(res.body).toHaveProperty('limit', 5);
      expect(res.body).toHaveProperty('total');
    });
  });
});
