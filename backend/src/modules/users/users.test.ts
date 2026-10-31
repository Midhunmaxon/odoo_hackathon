import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../../app';
import { env } from '../../config/env';
import { db } from '../../db';

/* =========================================================================
 * Helpers: generate JWTs for each role
 * ========================================================================= */

function makeToken(payload: { id: number; email: string; role: string; name: string }) {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: '1h' });
}

const ADMIN = { id: 1, email: 'admin@brightloop.com', role: 'ADMIN', name: 'Admin' };
const STAFF = { id: 2, email: 'staff1@brightloop.com', role: 'STAFF', name: 'Staff Sarah' };
const CUSTOMER_A = { id: 10, email: 'custA@brightloop.com', role: 'CUSTOMER', name: 'Customer A' };
const CUSTOMER_B = { id: 11, email: 'custB@brightloop.com', role: 'CUSTOMER', name: 'Customer B' };

const adminToken = makeToken(ADMIN);
const staffToken = makeToken(STAFF);
const customerAToken = makeToken(CUSTOMER_A);
const customerBToken = makeToken(CUSTOMER_B);

/* =========================================================================
 * Database seeding & teardown
 * ========================================================================= */

let dbAvailable = false;

beforeAll(async () => {
  try {
    await db.raw('SELECT 1');
    dbAvailable = true;

    // Run migrations
    await db.migrate.latest();

    // Seed users (upsert-style to be idempotent)
    const bcrypt = await import('bcryptjs');
    const hash = bcrypt.hashSync('Password123!', 10);

    for (const u of [ADMIN, STAFF, CUSTOMER_A, CUSTOMER_B]) {
      const exists = await db('users').where({ id: u.id }).first();
      if (!exists) {
        await db('users').insert({
          id: u.id,
          email: u.email,
          password_hash: hash,
          name: u.name,
          role: u.role,
          is_active: true,
        });
      }
    }

    // Reset the id sequence so new inserts don't collide
    await db.raw(`SELECT setval('users_id_seq', (SELECT MAX(id) FROM users))`);

    // Seed a plan so we can create subscriptions
    const planExists = await db('plans').where({ id: 1 }).first();
    if (!planExists) {
      await db('plans').insert({
        id: 1,
        name: 'Basic Monthly',
        price: 29.99,
        billing_period: 'MONTHLY',
        min_quantity: 1,
        status: 'ACTIVE',
      });
    }

    // Seed subscriptions for Customer A (id 10) – Customer B (id 11) has none
    const subExists = await db('subscriptions').where({ id: 100 }).first();
    if (!subExists) {
      await db('subscriptions').insert({
        id: 100,
        number: 'SUB-TEST-100',
        customer_id: CUSTOMER_A.id,
        plan_id: 1,
        start_date: '2026-01-01',
        status: 'ACTIVE',
      });
    }
    const sub2Exists = await db('subscriptions').where({ id: 200 }).first();
    if (!sub2Exists) {
      await db('subscriptions').insert({
        id: 200,
        number: 'SUB-TEST-200',
        customer_id: CUSTOMER_B.id,
        plan_id: 1,
        start_date: '2026-01-01',
        status: 'ACTIVE',
      });
    }

    // Seed invoices for Customer A and Customer B
    const invExists = await db('invoices').where({ id: 100 }).first();
    if (!invExists) {
      await db('invoices').insert({
        id: 100,
        number: 'INV-TEST-100',
        subscription_id: 100,
        customer_id: CUSTOMER_A.id,
        period_start: '2026-01-01',
        period_end: '2026-01-31',
        status: 'CONFIRMED',
        subtotal: 29.99,
        tax_total: 0,
        discount_total: 0,
        total: 29.99,
        due_date: '2026-02-15',
      });
    }
    const inv2Exists = await db('invoices').where({ id: 200 }).first();
    if (!inv2Exists) {
      await db('invoices').insert({
        id: 200,
        number: 'INV-TEST-200',
        subscription_id: 200,
        customer_id: CUSTOMER_B.id,
        period_start: '2026-02-01',
        period_end: '2026-02-28',
        status: 'CONFIRMED',
        subtotal: 29.99,
        tax_total: 0,
        discount_total: 0,
        total: 29.99,
        due_date: '2026-03-15',
      });
    }
  } catch {
    dbAvailable = false;
  }
});

afterAll(async () => {
  if (dbAvailable) {
    // Clean up test data in reverse dependency order
    try {
      await db('invoice_lines').whereIn('invoice_id', [100, 200]).del();
      await db('invoices').whereIn('id', [100, 200]).del();
      await db('subscription_lines').whereIn('subscription_id', [100, 200]).del();
      await db('subscriptions').whereIn('id', [100, 200]).del();
      await db('plans').where({ id: 1 }).del();
      // Delete test-created staff users (emails containing 'newstaff')
      await db('users').where('email', 'like', '%newstaff%').del();
      await db('users').whereIn('id', [ADMIN.id, STAFF.id, CUSTOMER_A.id, CUSTOMER_B.id]).del();
    } catch {
      // ignore cleanup errors
    }
    await db.destroy();
  }
});

/* =========================================================================
 * Conditional test runner – skip DB-dependent tests when DB is unavailable
 * ========================================================================= */

const dbIt = (name: string, fn: () => Promise<void>) => {
  it(name, async () => {
    if (!dbAvailable) {
      console.warn(`  ⏭  Skipped (no DB): ${name}`);
      return;
    }
    await fn();
  });
};

/* =========================================================================
 * TEST SUITES
 * ========================================================================= */

describe('Users Module – Admin / Staff / Customer Permission Matrix', () => {
  /* =====================================================================
   * POST /api/users/staff  (ADMIN only)
   * =================================================================== */

  describe('POST /api/users/staff', () => {
    it('should reject unauthenticated requests with 401', async () => {
      const res = await request(app)
        .post('/api/users/staff')
        .send({ email: 'x@x.com', password: 'Password123!', name: 'X' });
      expect(res.status).toBe(401);
    });

    it('should reject STAFF role with 403', async () => {
      const res = await request(app)
        .post('/api/users/staff')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ email: 'x@x.com', password: 'Password123!', name: 'X' });
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('should reject CUSTOMER role with 403', async () => {
      const res = await request(app)
        .post('/api/users/staff')
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({ email: 'x@x.com', password: 'Password123!', name: 'X' });
      expect(res.status).toBe(403);
    });

    it('should validate input with Zod (missing name)', async () => {
      const res = await request(app)
        .post('/api/users/staff')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ email: 'y@y.com', password: 'Password123!' });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should validate password rules', async () => {
      const res = await request(app)
        .post('/api/users/staff')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ email: 'y@y.com', password: 'weak', name: 'Test' });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    dbIt('should create a STAFF account when ADMIN calls', async () => {
      const res = await request(app)
        .post('/api/users/staff')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: 'newstaff1@brightloop.com',
          password: 'StaffPassword123!',
          name: 'New Staff',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.role).toBe('STAFF');
      expect(res.body.data.email).toBe('newstaff1@brightloop.com');
      // Should not expose password_hash
      expect(res.body.data).not.toHaveProperty('password_hash');
    });

    dbIt('should return 409 on duplicate email', async () => {
      // First creation
      await request(app)
        .post('/api/users/staff')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: 'newstaff_dup@brightloop.com',
          password: 'StaffPassword123!',
          name: 'Dup Staff',
        });

      // Duplicate
      const res = await request(app)
        .post('/api/users/staff')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: 'newstaff_dup@brightloop.com',
          password: 'StaffPassword123!',
          name: 'Dup Staff 2',
        });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CONFLICT');
    });
  });

  /* =====================================================================
   * GET /api/users  (ADMIN + STAFF only)
   * =================================================================== */

  describe('GET /api/users', () => {
    it('should reject unauthenticated with 401', async () => {
      const res = await request(app).get('/api/users');
      expect(res.status).toBe(401);
    });

    it('should reject CUSTOMER with 403', async () => {
      const res = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${customerAToken}`);
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    dbIt('should allow ADMIN to list users with pagination', async () => {
      const res = await request(app)
        .get('/api/users?page=1&limit=5')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('page', 1);
      expect(res.body).toHaveProperty('limit', 5);
      expect(res.body).toHaveProperty('total');
      // No password_hash in results
      for (const u of res.body.data) {
        expect(u).not.toHaveProperty('password_hash');
      }
    });

    dbIt('should allow STAFF to list users', async () => {
      const res = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${staffToken}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
    });
  });

  /* =====================================================================
   * PATCH /api/users/:id/deactivate  (ADMIN only)
   * =================================================================== */

  describe('PATCH /api/users/:id/deactivate', () => {
    it('should reject unauthenticated with 401', async () => {
      const res = await request(app).patch('/api/users/10/deactivate');
      expect(res.status).toBe(401);
    });

    it('should reject STAFF with 403', async () => {
      const res = await request(app)
        .patch('/api/users/10/deactivate')
        .set('Authorization', `Bearer ${staffToken}`);
      expect(res.status).toBe(403);
    });

    it('should reject CUSTOMER with 403', async () => {
      const res = await request(app)
        .patch('/api/users/10/deactivate')
        .set('Authorization', `Bearer ${customerAToken}`);
      expect(res.status).toBe(403);
    });

    dbIt('should allow ADMIN to deactivate a user', async () => {
      // Create a throwaway user to deactivate
      const createRes = await request(app)
        .post('/api/users/staff')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: 'newstaff_deact@brightloop.com',
          password: 'DeactPassword123!',
          name: 'To Deactivate',
        });
      const userId = createRes.body.data.id;

      const res = await request(app)
        .patch(`/api/users/${userId}/deactivate`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.is_active).toBe(false);
    });

    dbIt('should prevent ADMIN from deactivating themselves', async () => {
      const res = await request(app)
        .patch(`/api/users/${ADMIN.id}/deactivate`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error.message).toMatch(/own account/i);
    });

    dbIt('should return 404 for non-existent user', async () => {
      const res = await request(app)
        .patch('/api/users/999999/deactivate')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });
  });

  /* =====================================================================
   * GET /api/users/me  (any authenticated)
   * =================================================================== */

  describe('GET /api/users/me', () => {
    it('should reject unauthenticated with 401', async () => {
      const res = await request(app).get('/api/users/me');
      expect(res.status).toBe(401);
    });

    dbIt('should return profile for ADMIN', async () => {
      const res = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.email).toBe(ADMIN.email);
      expect(res.body.data.role).toBe('ADMIN');
      expect(res.body.data).not.toHaveProperty('password_hash');
    });

    dbIt('should return profile for STAFF', async () => {
      const res = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${staffToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.email).toBe(STAFF.email);
    });

    dbIt('should return profile for CUSTOMER', async () => {
      const res = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${customerAToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.email).toBe(CUSTOMER_A.email);
    });
  });

  /* =====================================================================
   * PATCH /api/users/me  (any authenticated)
   * =================================================================== */

  describe('PATCH /api/users/me', () => {
    it('should reject unauthenticated with 401', async () => {
      const res = await request(app)
        .patch('/api/users/me')
        .send({ name: 'Hacker' });
      expect(res.status).toBe(401);
    });

    it('should reject empty body with 400', async () => {
      const res = await request(app)
        .patch('/api/users/me')
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({});
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    dbIt('should allow CUSTOMER to update their own name', async () => {
      const res = await request(app)
        .patch('/api/users/me')
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({ name: 'Updated Customer A' });
      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('Updated Customer A');

      // Restore original name
      await request(app)
        .patch('/api/users/me')
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({ name: CUSTOMER_A.name });
    });

    dbIt('should allow ADMIN to update their own profile', async () => {
      const res = await request(app)
        .patch('/api/users/me')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Updated Admin' });
      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('Updated Admin');

      // Restore
      await request(app)
        .patch('/api/users/me')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: ADMIN.name });
    });

    dbIt('should allow STAFF to update their own profile', async () => {
      const res = await request(app)
        .patch('/api/users/me')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ name: 'Updated Staff' });
      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('Updated Staff');

      // Restore
      await request(app)
        .patch('/api/users/me')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ name: STAFF.name });
    });
  });

  /* =====================================================================
   * GET /api/users/customers  (ADMIN + STAFF only)
   * =================================================================== */

  describe('GET /api/users/customers', () => {
    it('should reject unauthenticated with 401', async () => {
      const res = await request(app).get('/api/users/customers');
      expect(res.status).toBe(401);
    });

    it('should reject CUSTOMER with 403', async () => {
      const res = await request(app)
        .get('/api/users/customers')
        .set('Authorization', `Bearer ${customerAToken}`);
      expect(res.status).toBe(403);
    });

    dbIt('should allow STAFF to list all customers', async () => {
      const res = await request(app)
        .get('/api/users/customers')
        .set('Authorization', `Bearer ${staffToken}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      for (const u of res.body.data) {
        expect(u.role).toBe('CUSTOMER');
      }
    });

    dbIt('should allow ADMIN to list all customers', async () => {
      const res = await request(app)
        .get('/api/users/customers')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
    });
  });

  /* =====================================================================
   * GET /api/users/customers/:id  (ADMIN + STAFF only)
   * =================================================================== */

  describe('GET /api/users/customers/:id', () => {
    it('should reject unauthenticated with 401', async () => {
      const res = await request(app).get(`/api/users/customers/${CUSTOMER_A.id}`);
      expect(res.status).toBe(401);
    });

    it('should reject CUSTOMER with 403', async () => {
      const res = await request(app)
        .get(`/api/users/customers/${CUSTOMER_A.id}`)
        .set('Authorization', `Bearer ${customerAToken}`);
      expect(res.status).toBe(403);
    });

    dbIt('should allow STAFF to view a single customer', async () => {
      const res = await request(app)
        .get(`/api/users/customers/${CUSTOMER_A.id}`)
        .set('Authorization', `Bearer ${staffToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(CUSTOMER_A.id);
      expect(res.body.data.role).toBe('CUSTOMER');
    });

    dbIt('should return 404 for non-customer user id', async () => {
      const res = await request(app)
        .get(`/api/users/customers/${ADMIN.id}`)
        .set('Authorization', `Bearer ${staffToken}`);
      expect(res.status).toBe(404);
    });
  });

  /* =====================================================================
   * PORTAL: GET /api/users/portal/subscriptions  (CUSTOMER only)
   * =================================================================== */

  describe('GET /api/users/portal/subscriptions', () => {
    it('should reject unauthenticated with 401', async () => {
      const res = await request(app).get('/api/users/portal/subscriptions');
      expect(res.status).toBe(401);
    });

    it('should reject ADMIN with 403', async () => {
      const res = await request(app)
        .get('/api/users/portal/subscriptions')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(403);
    });

    it('should reject STAFF with 403', async () => {
      const res = await request(app)
        .get('/api/users/portal/subscriptions')
        .set('Authorization', `Bearer ${staffToken}`);
      expect(res.status).toBe(403);
    });

    dbIt('should return only Customer A subscriptions for Customer A', async () => {
      const res = await request(app)
        .get('/api/users/portal/subscriptions')
        .set('Authorization', `Bearer ${customerAToken}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      for (const sub of res.body.data) {
        expect(sub.customer_id).toBe(CUSTOMER_A.id);
      }
    });

    dbIt('should NOT include Customer B subscriptions for Customer A', async () => {
      const res = await request(app)
        .get('/api/users/portal/subscriptions')
        .set('Authorization', `Bearer ${customerAToken}`);
      expect(res.status).toBe(200);
      const ids = res.body.data.map((s: any) => s.id);
      expect(ids).not.toContain(200); // sub 200 belongs to Customer B
    });
  });

  /* =====================================================================
   * PORTAL: GET /api/users/portal/subscriptions/:id  (CUSTOMER only)
   * =================================================================== */

  describe('GET /api/users/portal/subscriptions/:id', () => {
    it('should reject unauthenticated with 401', async () => {
      const res = await request(app).get('/api/users/portal/subscriptions/100');
      expect(res.status).toBe(401);
    });

    it('should reject ADMIN with 403', async () => {
      const res = await request(app)
        .get('/api/users/portal/subscriptions/100')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(403);
    });

    it('should reject STAFF with 403', async () => {
      const res = await request(app)
        .get('/api/users/portal/subscriptions/100')
        .set('Authorization', `Bearer ${staffToken}`);
      expect(res.status).toBe(403);
    });

    dbIt('should return Customer A own subscription', async () => {
      const res = await request(app)
        .get('/api/users/portal/subscriptions/100')
        .set('Authorization', `Bearer ${customerAToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(100);
      expect(res.body.data.customer_id).toBe(CUSTOMER_A.id);
    });

    dbIt('should return 404 when Customer A tries to access Customer B subscription', async () => {
      const res = await request(app)
        .get('/api/users/portal/subscriptions/200')
        .set('Authorization', `Bearer ${customerAToken}`);
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    dbIt('should return 404 for non-existent subscription id', async () => {
      const res = await request(app)
        .get('/api/users/portal/subscriptions/999999')
        .set('Authorization', `Bearer ${customerAToken}`);
      expect(res.status).toBe(404);
    });
  });

  /* =====================================================================
   * PORTAL: GET /api/users/portal/invoices  (CUSTOMER only)
   * =================================================================== */

  describe('GET /api/users/portal/invoices', () => {
    it('should reject unauthenticated with 401', async () => {
      const res = await request(app).get('/api/users/portal/invoices');
      expect(res.status).toBe(401);
    });

    it('should reject ADMIN with 403', async () => {
      const res = await request(app)
        .get('/api/users/portal/invoices')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(403);
    });

    it('should reject STAFF with 403', async () => {
      const res = await request(app)
        .get('/api/users/portal/invoices')
        .set('Authorization', `Bearer ${staffToken}`);
      expect(res.status).toBe(403);
    });

    dbIt('should return only Customer A invoices for Customer A', async () => {
      const res = await request(app)
        .get('/api/users/portal/invoices')
        .set('Authorization', `Bearer ${customerAToken}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      for (const inv of res.body.data) {
        expect(inv.customer_id).toBe(CUSTOMER_A.id);
      }
    });

    dbIt('should NOT include Customer B invoices for Customer A', async () => {
      const res = await request(app)
        .get('/api/users/portal/invoices')
        .set('Authorization', `Bearer ${customerAToken}`);
      expect(res.status).toBe(200);
      const ids = res.body.data.map((i: any) => i.id);
      expect(ids).not.toContain(200); // invoice 200 belongs to Customer B
    });
  });

  /* =====================================================================
   * PORTAL: GET /api/users/portal/invoices/:id  (CUSTOMER only)
   * =================================================================== */

  describe('GET /api/users/portal/invoices/:id', () => {
    it('should reject unauthenticated with 401', async () => {
      const res = await request(app).get('/api/users/portal/invoices/100');
      expect(res.status).toBe(401);
    });

    it('should reject ADMIN with 403', async () => {
      const res = await request(app)
        .get('/api/users/portal/invoices/100')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(403);
    });

    it('should reject STAFF with 403', async () => {
      const res = await request(app)
        .get('/api/users/portal/invoices/100')
        .set('Authorization', `Bearer ${staffToken}`);
      expect(res.status).toBe(403);
    });

    dbIt('should return Customer A own invoice', async () => {
      const res = await request(app)
        .get('/api/users/portal/invoices/100')
        .set('Authorization', `Bearer ${customerAToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(100);
      expect(res.body.data.customer_id).toBe(CUSTOMER_A.id);
    });

    dbIt('should return 404 when Customer A tries to access Customer B invoice', async () => {
      const res = await request(app)
        .get('/api/users/portal/invoices/200')
        .set('Authorization', `Bearer ${customerAToken}`);
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    dbIt('should return 404 for non-existent invoice id', async () => {
      const res = await request(app)
        .get('/api/users/portal/invoices/999999')
        .set('Authorization', `Bearer ${customerAToken}`);
      expect(res.status).toBe(404);
    });
  });
});
