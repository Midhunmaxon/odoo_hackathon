import request from 'supertest';
import { app } from '../app';

describe('App & Base Endpoints', () => {
  it('GET /api/health should return 200 ok', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status', 'ok');
    expect(res.body).toHaveProperty('service', 'brightloop-backend');
  });

  it('GET /api/unknown-endpoint should return 404 NOT_FOUND', async () => {
    const res = await request(app).get('/api/unknown-endpoint');
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('success', false);
    expect(res.body.error).toHaveProperty('code', 'NOT_FOUND');
  });

  it('GET /api/catalog/products should return standard paginated format { data, page, limit, total }', async () => {
    const res = await request(app).get('/api/catalog/products?page=1&limit=2&sort=name:asc');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body).toHaveProperty('page', 1);
    expect(res.body).toHaveProperty('limit', 2);
    expect(res.body).toHaveProperty('total');
    expect(typeof res.body.total).toBe('number');
  });

  it('GET /api/catalog/plans should support pagination & sorting parameters', async () => {
    const res = await request(app).get('/api/catalog/plans?page=1&limit=10&sort=price:desc');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('page', 1);
    expect(res.body).toHaveProperty('limit', 10);
    expect(res.body).toHaveProperty('total');
  });
});
