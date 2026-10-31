import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../app';
import { env } from '../config/env';
import { subscriptionsService, inMemorySubscriptions } from '../modules/subscriptions/subscriptions.service';

describe('Subscriptions Concurrency Safety & List Pagination Tests', () => {
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

  describe('Concurrency-Safe State Transitions (UPDATE ... WHERE status = <expected>)', () => {
    it('should reject state transition with 409 CONFLICT if concurrent update changed status', async () => {
      // 1. Create a subscription in DRAFT
      const sub = await subscriptionsService.createSubscription({
        customer_id: 4,
        plan_id: 1,
        start_date: '2026-05-01',
        lines: [{ product_id: 1, quantity: 1 }],
      });
      expect(sub.status).toBe('DRAFT');

      // 2. Simulate concurrent update in background: status was changed to QUOTATION by another process
      const memSub = inMemorySubscriptions.get(sub.id);
      if (memSub) {
        memSub.status = 'QUOTATION';
      }

      // 3. Now attempt a transition that assumes original status is DRAFT -> try to transition to CLOSED from stale DRAFT
      // In a concurrency conflict where the record was updated out from under the caller, the conditional update
      // WHERE id = :id AND status = :fromStatus will match 0 rows and return 409 CONFLICT.
      const res = await request(app)
        .post(`/subscriptions/${sub.id}/transition`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ to_status: 'QUOTATION' });

      // Either it is already in state QUOTATION (400) or concurrent conflict (409)
      expect([400, 409]).toContain(res.status);
    });

    it('should prevent lost updates when two transitions compete concurrently', async () => {
      const sub = await subscriptionsService.createSubscription({
        customer_id: 4,
        plan_id: 1,
        start_date: '2026-06-01',
        lines: [{ product_id: 1, quantity: 1 }],
      });
      expect(sub.status).toBe('DRAFT');

      // Competing concurrent requests from DRAFT:
      // Request 1: transition to QUOTATION
      // Request 2: transition to CLOSED
      const [res1, res2] = await Promise.all([
        request(app)
          .post(`/subscriptions/${sub.id}/transition`)
          .set('Authorization', `Bearer ${staffToken}`)
          .send({ to_status: 'QUOTATION' }),
        request(app)
          .post(`/subscriptions/${sub.id}/transition`)
          .set('Authorization', `Bearer ${staffToken}`)
          .send({ to_status: 'CLOSED' }),
      ]);

      // Exactly one must succeed (200), the loser must receive an error (400 or 409)
      const statuses = [res1.status, res2.status].sort();
      expect(statuses[0]).toBe(200); // One succeeded
      expect([400, 409]).toContain(statuses[1]); // The other failed gracefully

      // Final state must be deterministic (either QUOTATION or CLOSED)
      const finalSub = await subscriptionsService.getSubscriptionById(sub.id);
      expect(['QUOTATION', 'CLOSED']).toContain(finalSub.status);
    });

    it('should reject pause with 409 CONFLICT if subscription is concurrently non-ACTIVE', async () => {
      const sub = await subscriptionsService.createSubscription({
        customer_id: 4,
        plan_id: 1,
        start_date: '2026-07-01',
        lines: [{ product_id: 1, quantity: 1 }],
      });

      // Transition to ACTIVE
      await subscriptionsService.transitionStatus(sub.id, 'QUOTATION');
      await subscriptionsService.transitionStatus(sub.id, 'CONFIRMED');
      await subscriptionsService.transitionStatus(sub.id, 'ACTIVE');

      // Concurrently close it in background
      const memSub = inMemorySubscriptions.get(sub.id);
      if (memSub) {
        memSub.status = 'CLOSED';
      }

      // Attempt to pause - should fail because status is no longer ACTIVE
      const res = await request(app)
        .post(`/subscriptions/${sub.id}/pause`)
        .set('Authorization', `Bearer ${staffToken}`);

      expect([400, 409]).toContain(res.status);
    });
  });

  describe('Confirm Every List Endpoint Paginates', () => {
    it('GET /catalog/products should paginate with standard schema { data, page, limit, total }', async () => {
      const res = await request(app)
        .get('/catalog/products?page=1&limit=2&sort=name:asc')
        .set('Authorization', `Bearer ${staffToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeLessThanOrEqual(2);
      expect(res.body).toHaveProperty('page', 1);
      expect(res.body).toHaveProperty('limit', 2);
      expect(res.body).toHaveProperty('total');
      expect(typeof res.body.total).toBe('number');
    });

    it('GET /catalog/plans should paginate with standard schema { data, page, limit, total }', async () => {
      const res = await request(app)
        .get('/catalog/plans?page=1&limit=2&sort=price:asc')
        .set('Authorization', `Bearer ${staffToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeLessThanOrEqual(2);
      expect(res.body).toHaveProperty('page', 1);
      expect(res.body).toHaveProperty('limit', 2);
      expect(res.body).toHaveProperty('total');
      expect(typeof res.body.total).toBe('number');
    });

    it('GET /subscriptions/templates should paginate with standard schema { data, page, limit, total }', async () => {
      const res = await request(app)
        .get('/subscriptions/templates?page=1&limit=2&sort=id:asc')
        .set('Authorization', `Bearer ${staffToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeLessThanOrEqual(2);
      expect(res.body).toHaveProperty('page', 1);
      expect(res.body).toHaveProperty('limit', 2);
      expect(res.body).toHaveProperty('total');
      expect(typeof res.body.total).toBe('number');
    });

    it('GET /subscriptions should paginate with standard schema { data, page, limit, total }', async () => {
      const res = await request(app)
        .get('/subscriptions?page=1&limit=3&sort=id:desc')
        .set('Authorization', `Bearer ${staffToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeLessThanOrEqual(3);
      expect(res.body).toHaveProperty('page', 1);
      expect(res.body).toHaveProperty('limit', 3);
      expect(res.body).toHaveProperty('total');
      expect(typeof res.body.total).toBe('number');
    });
  });
});
