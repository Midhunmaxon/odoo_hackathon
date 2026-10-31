import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../app';
import { env } from '../config/env';

describe('Auth & Role Guards', () => {
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

  it('GET /api/auth/me should reject requests without token with 401 UNAUTHORIZED', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('success', false);
    expect(res.body.error).toHaveProperty('code', 'UNAUTHORIZED');
  });

  it('GET /api/auth/me should succeed with valid token', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('email', 'admin@brightloop.com');
    expect(res.body.data).toHaveProperty('role', 'ADMIN');
  });

  it('GET /api/users should allow ADMIN access', async () => {
    const res = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('total');
  });

  it('GET /api/users should forbid CUSTOMER access with 403 FORBIDDEN', async () => {
    const res = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${customerToken}`);
    expect(res.status).toBe(403);
    expect(res.body).toHaveProperty('success', false);
    expect(res.body.error).toHaveProperty('code', 'FORBIDDEN');
  });

  it('POST /api/auth/login should validate input with Zod', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'invalid-email', password: '12' });
    expect(res.status).toBe(400);
    expect(res.body.error).toHaveProperty('code', 'VALIDATION_ERROR');
    expect(res.body.error).toHaveProperty('details');
  });
});
