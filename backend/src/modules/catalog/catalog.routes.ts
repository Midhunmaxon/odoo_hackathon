import { Router, Request, Response, NextFunction } from 'express';
import { db } from '../../db';
import { extractPaginationParams, paginateKnexQuery, paginateArray } from '../../utils/pagination';
import { sendPaginated } from '../../utils/response';

export const catalogRouter = Router();

const DEMO_PRODUCTS = [
  { id: 1, name: 'Cloud Workspace Suite', type: 'service', sales_price: 49.0, cost_price: 15.0, notes: 'Cloud tools' },
  { id: 2, name: 'Dedicated Support Pack', type: 'service', sales_price: 199.0, cost_price: 60.0, notes: '24/7 support' },
  { id: 3, name: 'Odoo Enterprise Connector', type: 'service', sales_price: 299.0, cost_price: 80.0, notes: 'Sync with Odoo' },
];

const DEMO_PLANS = [
  { id: 1, name: 'Starter Monthly', price: 49.0, billing_period: 'MONTHLY', min_quantity: 1, status: 'ACTIVE' },
  { id: 2, name: 'Professional Monthly', price: 149.0, billing_period: 'MONTHLY', min_quantity: 1, status: 'ACTIVE' },
  { id: 3, name: 'Enterprise Annual', price: 1490.0, billing_period: 'YEARLY', min_quantity: 5, status: 'ACTIVE' },
];

/**
 * GET /api/catalog/products
 * Supports ?page=&limit=&sort=
 * Returns { data, page, limit, total }
 */
catalogRouter.get('/products', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const params = extractPaginationParams(req, 10, 'id:asc');
    try {
      const query = db('products').select('*');
      const result = await paginateKnexQuery(query, params);
      sendPaginated(res, result);
    } catch {
      sendPaginated(res, paginateArray(DEMO_PRODUCTS, params));
    }
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/catalog/plans
 * Supports ?page=&limit=&sort=
 * Returns { data, page, limit, total }
 */
catalogRouter.get('/plans', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const params = extractPaginationParams(req, 10, 'id:asc');
    try {
      const query = db('plans').select('*');
      const result = await paginateKnexQuery(query, params);
      sendPaginated(res, result);
    } catch {
      sendPaginated(res, paginateArray(DEMO_PLANS, params));
    }
  } catch (err) {
    next(err);
  }
});
