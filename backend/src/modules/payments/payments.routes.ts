import { Router, Request, Response, NextFunction } from 'express';
import { db } from '../../db';
import { extractPaginationParams, paginateKnexQuery, paginateArray } from '../../utils/pagination';
import { sendPaginated, sendSuccess, sendCreated } from '../../utils/response';
import { validateBody } from '../../middleware/validate.middleware';
import { createPaymentBodySchema } from './payments.validation';
import { paymentsService, inMemoryPayments } from './payments.service';

export const paymentsRouter = Router();

/**
 * GET /api/payments/invoices/overdue
 * Must be registered BEFORE /invoices to avoid matching /invoices/:id
 */
paymentsRouter.get(
  '/invoices/overdue',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const params = extractPaginationParams(req, 10, 'due_date:asc');
      const asOfDate = typeof req.query.as_of_date === 'string' ? req.query.as_of_date : undefined;
      const result = await paymentsService.listOverdueInvoices(params, asOfDate);
      sendPaginated(res, result);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/payments/invoices
 * Computes amount_paid, balance, and overdue flag. Supports status, customer, date filters.
 */
paymentsRouter.get(
  '/invoices',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const params = extractPaginationParams(req, 10, 'id:desc');
      const filters = {
        status: typeof req.query.status === 'string' ? req.query.status : undefined,
        payment_status: typeof req.query.payment_status === 'string'
          ? (req.query.payment_status as any)
          : typeof req.query.filter === 'string'
            ? (req.query.filter as any)
            : undefined,
        customer_id: req.query.customer_id
          ? Number(req.query.customer_id)
          : req.query.customer
            ? Number(req.query.customer)
            : undefined,
        from_date: typeof req.query.from_date === 'string'
          ? req.query.from_date
          : typeof req.query.date_from === 'string'
            ? req.query.date_from
            : undefined,
        to_date: typeof req.query.to_date === 'string'
          ? req.query.to_date
          : typeof req.query.date_to === 'string'
            ? req.query.date_to
            : undefined,
        as_of_date: typeof req.query.as_of_date === 'string' ? req.query.as_of_date : undefined,
      };

      const result = await paymentsService.listInvoicesWithPaymentDetails(filters, params);
      sendPaginated(res, result);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/payments
 * Records a payment against an invoice inside one transaction.
 * Rejects overpayments and payments on DRAFT or CANCELLED invoices.
 * Marks invoice PAID when balance reaches 0.
 */
paymentsRouter.post(
  '/',
  validateBody(createPaymentBodySchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await paymentsService.recordPayment({
        invoice_id: req.body.invoice_id,
        amount: req.body.amount,
        method: req.body.method,
        date: req.body.date || req.body.paid_at,
        note: req.body.note,
      });

      sendCreated(
        res,
        result,
        result.is_paid
          ? 'Payment recorded successfully. Invoice is now PAID in full.'
          : 'Payment recorded successfully.'
      );
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/payments
 * List payments with pagination.
 */
paymentsRouter.get('/', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const params = extractPaginationParams(req, 10, 'id:desc');
    try {
      const query = db('payments').select('*');
      const result = await paginateKnexQuery(query, params);
      sendPaginated(res, result);
    } catch {
      const list = Array.from(inMemoryPayments.values()).sort((a, b) => b.id - a.id);
      sendPaginated(res, paginateArray(list, params));
    }
  } catch (err) {
    next(err);
  }
});
