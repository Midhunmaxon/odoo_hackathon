import { Router, Request, Response, NextFunction } from 'express';
import { authenticateJwt, requireRole } from '../../middleware/auth.middleware';
import { sendSuccess } from '../../utils/response';

export const reportsRouter = Router();

/**
 * GET /api/reports/summary
 */
reportsRouter.get(
  '/summary',
  authenticateJwt,
  requireRole('ADMIN', 'STAFF'),
  async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      sendSuccess(res, {
        activeSubscriptions: 24,
        monthlyRecurringRevenue: 3420.0,
        totalCustomers: 58,
        unpaidInvoicesCount: 4,
        unpaidInvoicesAmount: 640.0,
      });
    } catch (err) {
      next(err);
    }
  }
);
