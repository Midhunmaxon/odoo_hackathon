import { Router, Request, Response, NextFunction } from 'express';
import { db } from '../../db';
import { extractPaginationParams, paginateKnexQuery, paginateArray } from '../../utils/pagination';
import { sendPaginated } from '../../utils/response';

export const paymentsRouter = Router();

const DEMO_PAYMENTS = [
  {
    id: 1,
    invoice_id: 1,
    method: 'CREDIT_CARD',
    amount: 58.8,
    paid_at: '2026-01-05T12:00:00Z',
    note: 'Stripe charge ch_1A2B3C',
  },
];

/**
 * GET /api/payments
 * Supports ?page=&limit=&sort=
 * Returns { data, page, limit, total }
 */
paymentsRouter.get('/', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const params = extractPaginationParams(req, 10, 'id:desc');
    try {
      const query = db('payments').select('*');
      const result = await paginateKnexQuery(query, params);
      sendPaginated(res, result);
    } catch {
      sendPaginated(res, paginateArray(DEMO_PAYMENTS, params));
    }
  } catch (err) {
    next(err);
  }
});
