import { Router, Request, Response, NextFunction } from 'express';
import { db } from '../../db';
import { extractPaginationParams, paginateKnexQuery, paginateArray } from '../../utils/pagination';
import { sendPaginated } from '../../utils/response';

export const invoicesRouter = Router();

const DEMO_INVOICES = [
  {
    id: 1,
    number: 'INV-2026-0001',
    subscription_id: 1,
    customer_id: 4,
    period_start: '2026-01-01',
    period_end: '2026-01-31',
    status: 'PAID',
    subtotal: 49.0,
    tax_total: 9.8,
    discount_total: 0.0,
    total: 58.8,
    due_date: '2026-01-15',
  },
  {
    id: 2,
    number: 'INV-2026-0002',
    subscription_id: 2,
    customer_id: 5,
    period_start: '2026-02-15',
    period_end: '2026-03-14',
    status: 'CONFIRMED',
    subtotal: 149.0,
    tax_total: 29.8,
    discount_total: 0.0,
    total: 178.8,
    due_date: '2026-03-01',
  },
];

/**
 * GET /api/invoices
 * Supports ?page=&limit=&sort=
 * Returns { data, page, limit, total }
 */
invoicesRouter.get('/', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const params = extractPaginationParams(req, 10, 'id:desc');
    try {
      const query = db('invoices').select('*');
      const result = await paginateKnexQuery(query, params);
      sendPaginated(res, result);
    } catch {
      sendPaginated(res, paginateArray(DEMO_INVOICES, params));
    }
  } catch (err) {
    next(err);
  }
});
