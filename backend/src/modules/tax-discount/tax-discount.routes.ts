import { Router, Request, Response, NextFunction } from 'express';
import { db } from '../../db';
import { extractPaginationParams, paginateKnexQuery, paginateArray } from '../../utils/pagination';
import { sendPaginated } from '../../utils/response';

export const taxDiscountRouter = Router();

const DEMO_TAXES = [
  { id: 1, name: 'Standard VAT (20%)', rate_percent: 20.0, active: true },
  { id: 2, name: 'Reduced Rate GST (5%)', rate_percent: 5.0, active: true },
];

const DEMO_DISCOUNTS = [
  { id: 1, name: 'Early Bird Launch', type: 'PERCENT', value: 15.0, applies_to: 'SUBSCRIPTION', used_count: 3 },
  { id: 2, name: 'Volume Tier', type: 'FIXED', value: 50.0, applies_to: 'SUBSCRIPTION', used_count: 1 },
];

/**
 * GET /api/taxes
 * Supports ?page=&limit=&sort=
 * Returns { data, page, limit, total }
 */
taxDiscountRouter.get('/taxes', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const params = extractPaginationParams(req, 10, 'id:asc');
    try {
      const query = db('taxes').select('*');
      const result = await paginateKnexQuery(query, params);
      sendPaginated(res, result);
    } catch {
      sendPaginated(res, paginateArray(DEMO_TAXES, params));
    }
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/discounts
 * Supports ?page=&limit=&sort=
 * Returns { data, page, limit, total }
 */
taxDiscountRouter.get('/discounts', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const params = extractPaginationParams(req, 10, 'id:asc');
    try {
      const query = db('discounts').select('*');
      const result = await paginateKnexQuery(query, params);
      sendPaginated(res, result);
    } catch {
      sendPaginated(res, paginateArray(DEMO_DISCOUNTS, params));
    }
  } catch (err) {
    next(err);
  }
});
