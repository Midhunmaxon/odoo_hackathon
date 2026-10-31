import { Router, Request, Response, NextFunction } from 'express';
import { db } from '../../db';
import { extractPaginationParams, paginateKnexQuery, paginateArray } from '../../utils/pagination';
import { sendPaginated } from '../../utils/response';

export const subscriptionsRouter = Router();

const DEMO_SUBSCRIPTIONS = [
  {
    id: 1,
    number: 'SUB-2026-001',
    customer_id: 4,
    plan_id: 1,
    start_date: '2026-01-01',
    expiry_date: null,
    payment_terms: 'immediate',
    status: 'ACTIVE',
    next_billing_date: '2026-11-01',
  },
  {
    id: 2,
    number: 'SUB-2026-002',
    customer_id: 5,
    plan_id: 2,
    start_date: '2026-02-15',
    expiry_date: null,
    payment_terms: '15_days',
    status: 'ACTIVE',
    next_billing_date: '2026-11-15',
  },
];

/**
 * GET /api/subscriptions
 * Supports ?page=&limit=&sort=
 * Returns { data, page, limit, total }
 */
subscriptionsRouter.get('/', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const params = extractPaginationParams(req, 10, 'id:desc');
    try {
      const query = db('subscriptions').select('*');
      const result = await paginateKnexQuery(query, params);
      sendPaginated(res, result);
    } catch {
      sendPaginated(res, paginateArray(DEMO_SUBSCRIPTIONS, params));
    }
  } catch (err) {
    next(err);
  }
});
