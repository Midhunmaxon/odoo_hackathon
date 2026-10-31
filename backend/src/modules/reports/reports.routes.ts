import { Router, Request, Response, NextFunction } from 'express';
import { authenticateJwt, requireRole } from '../../middleware/auth.middleware';
import { validateQuery } from '../../middleware/validate.middleware';
import { sendSuccess } from '../../utils/response';
import { summaryQuerySchema, SummaryQueryFilters } from './reports.validation';
import { reportsService } from './reports.service';

export const reportsRouter = Router();

/**
 * GET /api/reports/summary
 *
 * Returns aggregated financial KPIs:
 *   - activeSubscriptions, revenueCollected, outstandingAmount,
 *     overdueCount, overdueAmount, monthlyRevenueSeries,
 *     totalCustomers, unpaidInvoicesCount, unpaidInvoicesAmount
 *
 * Query params (all optional): date_from, date_to, plan_id, customer_id
 */
reportsRouter.get(
  '/summary',
  authenticateJwt,
  requireRole('ADMIN', 'STAFF'),
  validateQuery(summaryQuerySchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const filters = req.query as unknown as SummaryQueryFilters;
      const result = await reportsService.getSummary(filters);
      sendSuccess(res, result, 'Summary report generated successfully');
    } catch (err) {
      next(err);
    }
  },
);
