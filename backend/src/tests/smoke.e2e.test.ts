import request from 'supertest';
import { app } from '../app';
import { db } from '../db';

describe('End-to-End Smoke Test: Signup → Login → Customer Portal', () => {
  const uniqueSuffix = Date.now();
  const testCustomer = {
    name: `E2E Smoke Tester ${uniqueSuffix}`,
    email: `smoke_test_${uniqueSuffix}@brightloop.com`,
    password: 'Password123!',
  };

  let authToken = '';
  let customerId: number = 0;

  beforeAll(async () => {
    // Ensure DB connection is active and migrations are applied
    try {
      await db.raw('SELECT 1');
      await db.migrate.latest();
    } catch {
      // In-memory or fallback mode
    }
  });

  afterAll(async () => {
    try {
      if (customerId) {
        await db('users').where({ id: customerId }).del();
      }
      await db.destroy();
    } catch {
      // ignore teardown error
    }
  });

  // Step 1: Customer Signup
  it('Step 1: POST /api/auth/signup should register a new customer', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send(testCustomer);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('id');
    expect(res.body.data.email).toBe(testCustomer.email.toLowerCase());
    expect(res.body.data.role).toBe('CUSTOMER');
    expect(res.body.data).not.toHaveProperty('password_hash');

    customerId = res.body.data.id;
  });

  // Step 2: Customer Login
  it('Step 2: POST /api/auth/login should authenticate credentials and issue JWT', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: testCustomer.email,
        password: testCustomer.password,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('token');
    expect(res.body.data.user).toHaveProperty('id', customerId);
    expect(res.body.data.user.role).toBe('CUSTOMER');

    authToken = res.body.data.token;
    expect(authToken).toBeTruthy();
  });

  // Step 3: Portal Access - Subscriptions
  it('Step 3: GET /api/users/portal/subscriptions should access customer subscriptions with row-level isolation', async () => {
    const res = await request(app)
      .get('/api/users/portal/subscriptions?page=1&limit=10')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('page', 1);
    expect(res.body).toHaveProperty('limit', 10);
    expect(res.body).toHaveProperty('total');
    expect(Array.isArray(res.body.data)).toBe(true);

    // Newly registered user has 0 subscriptions initially
    for (const sub of res.body.data) {
      expect(sub.customer_id).toBe(customerId);
    }
  });

  // Step 4: Portal Access - Invoices
  it('Step 4: GET /api/users/portal/invoices should access customer invoices with row-level isolation', async () => {
    const res = await request(app)
      .get('/api/users/portal/invoices?page=1&limit=10')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('total');
    expect(Array.isArray(res.body.data)).toBe(true);

    for (const inv of res.body.data) {
      expect(inv.customer_id).toBe(customerId);
    }
  });

  // Step 5: Data Privacy & Isolation - accessing another user's invoice must return 404
  it('Step 5: GET /api/users/portal/invoices/999999 should return 404 for foreign or non-existent record', async () => {
    const res = await request(app)
      .get('/api/users/portal/invoices/999999')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  // Step 6: RBAC Protection - Customer cannot access admin staff endpoints
  it('Step 6: Customer cannot access Admin endpoints (returns 403 Forbidden)', async () => {
    const resStaff = await request(app)
      .post('/api/users/staff')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ email: 'fake@staff.com', password: 'Password123!', name: 'Fake' });

    expect(resStaff.status).toBe(403);
    expect(resStaff.body.error.code).toBe('FORBIDDEN');
  });
});
