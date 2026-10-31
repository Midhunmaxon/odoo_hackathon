import { Router, Request, Response, NextFunction } from 'express';
import { db } from '../../db';
import { extractPaginationParams, paginateKnexQuery, paginateArray } from '../../utils/pagination';
import { sendPaginated, sendSuccess, sendCreated } from '../../utils/response';
import { validateBody, validateParams } from '../../middleware/validate.middleware';
import {
  runBillingSchema,
  invoiceIdParamSchema,
  createPaymentSchema,
} from './invoices.validation';
import { invoicesService, inMemoryInvoices, inMemoryInvoiceLines, inMemoryPayments } from './invoices.service';
import { startBillingCron } from './invoices.cron';

// Initialize the daily billing background cron
startBillingCron();

export const invoicesRouter = Router();

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
      const list = Array.from(inMemoryInvoices.values()).sort((a, b) => b.id - a.id);
      sendPaginated(res, paginateArray(list, params));
    }
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/invoices/run-billing
 * Finds all ACTIVE subscriptions with next_billing_date <= today,
 * processes them in batches with catch-up logic, and returns { created, skipped, failed[] }.
 */
invoicesRouter.post(
  '/run-billing',
  validateBody(runBillingSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await invoicesService.runBilling(req.body);
      sendSuccess(res, result, 'Billing run completed successfully');
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/invoices/:id
 * Get single invoice with lines and payments.
 */
invoicesRouter.get(
  '/:id',
  validateParams(invoiceIdParamSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = Number(req.params.id);
      const invoice = await invoicesService.getInvoiceById(id);

      let lines: any[] = [];
      let payments: any[] = [];
      try {
        lines = await db('invoice_lines').where({ invoice_id: id });
        payments = await db('payments').where({ invoice_id: id });
      } catch {
        lines = inMemoryInvoiceLines.get(id) || [];
        payments = Array.from(inMemoryPayments.values()).filter((p) => p.invoice_id === id);
      }

      sendSuccess(res, {
        ...invoice,
        lines,
        payments,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/invoices/:id/confirm
 * Transitions DRAFT invoice to CONFIRMED.
 */
invoicesRouter.post(
  '/:id/confirm',
  validateParams(invoiceIdParamSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = Number(req.params.id);
      const updated = await invoicesService.confirmInvoice(id);
      sendSuccess(res, updated, 'Invoice confirmed successfully');
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/invoices/:id/cancel
 * Transitions DRAFT or CONFIRMED invoice to CANCELLED.
 */
invoicesRouter.post(
  '/:id/cancel',
  validateParams(invoiceIdParamSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = Number(req.params.id);
      const updated = await invoicesService.cancelInvoice(id);
      sendSuccess(res, updated, 'Invoice cancelled successfully');
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/invoices/:id/send
 * Sends invoice to customer email with console fallback in dev/test.
 */
invoicesRouter.post(
  '/:id/send',
  validateParams(invoiceIdParamSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = Number(req.params.id);
      const result = await invoicesService.sendInvoice(id);
      sendSuccess(res, result, result.message);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/invoices/:id/print
 * Returns HTML print view for browser or PDF printing.
 */
invoicesRouter.get(
  '/:id/print',
  validateParams(invoiceIdParamSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = Number(req.params.id);
      if (req.query.format === 'json' || req.headers.accept?.includes('application/json')) {
        const invoice = await invoicesService.getInvoiceById(id);
        const lines = inMemoryInvoiceLines.get(id) || [];
        sendSuccess(res, { invoice, lines });
        return;
      }
      const html = await invoicesService.printInvoice(id);
      res.setHeader('Content-Type', 'text/html');
      res.send(html);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/invoices/:id/payments
 * Records a payment against the invoice and auto-moves status to PAID if total is covered.
 */
invoicesRouter.post(
  '/:id/payments',
  validateParams(invoiceIdParamSchema),
  validateBody(createPaymentSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = Number(req.params.id);
      const result = await invoicesService.recordPayment(id, req.body);
      sendCreated(res, result, result.isPaid ? 'Payment recorded, invoice is now PAID' : 'Payment recorded successfully');
    } catch (err) {
      next(err);
    }
  }
);
