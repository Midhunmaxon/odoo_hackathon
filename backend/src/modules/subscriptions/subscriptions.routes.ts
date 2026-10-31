import { Router, Request, Response, NextFunction } from 'express';
import { subscriptionsService } from './subscriptions.service';
import {
  createQuotationTemplateSchema,
  updateQuotationTemplateSchema,
  fromTemplateSchema,
  createSubscriptionSchema,
  updateSubscriptionSchema,
  transitionStatusSchema,
} from './subscriptions.validation';
import { validateBody } from '../../middleware/validate.middleware';
import { requireAuth, requireRole } from '../../middleware/auth.middleware';
import { extractPaginationParams } from '../../utils/pagination';
import { sendSuccess, sendCreated, sendPaginated } from '../../utils/response';

export const subscriptionsRouter = Router();

/* ====================================================================
 * QUOTATION TEMPLATES ENDPOINTS
 * Staff and admin only for writes
 * ==================================================================== */

/**
 * GET /templates
 */
subscriptionsRouter.get(
  '/templates',
  requireAuth,
  requireRole('ADMIN', 'STAFF'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const pagination = extractPaginationParams(req, 10, 'id:asc');
      const result = await subscriptionsService.listTemplates(pagination);
      sendPaginated(res, result);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /templates/:id
 */
subscriptionsRouter.get(
  '/templates/:id',
  requireAuth,
  requireRole('ADMIN', 'STAFF'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseInt(req.params.id, 10);
      const template = await subscriptionsService.getTemplateById(id);
      sendSuccess(res, template);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /templates
 */
subscriptionsRouter.post(
  '/templates',
  requireAuth,
  requireRole('ADMIN', 'STAFF'),
  validateBody(createQuotationTemplateSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const template = await subscriptionsService.createTemplate(req.body);
      sendCreated(res, template, 'Quotation template created successfully');
    } catch (err) {
      next(err);
    }
  }
);

/**
 * PATCH /templates/:id
 */
subscriptionsRouter.patch(
  '/templates/:id',
  requireAuth,
  requireRole('ADMIN', 'STAFF'),
  validateBody(updateQuotationTemplateSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseInt(req.params.id, 10);
      const template = await subscriptionsService.updateTemplate(id, req.body);
      sendSuccess(res, template, 'Quotation template updated successfully');
    } catch (err) {
      next(err);
    }
  }
);

/**
 * PUT /templates/:id
 */
subscriptionsRouter.put(
  '/templates/:id',
  requireAuth,
  requireRole('ADMIN', 'STAFF'),
  validateBody(updateQuotationTemplateSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseInt(req.params.id, 10);
      const template = await subscriptionsService.updateTemplate(id, req.body);
      sendSuccess(res, template, 'Quotation template updated successfully');
    } catch (err) {
      next(err);
    }
  }
);

/**
 * DELETE /templates/:id
 */
subscriptionsRouter.delete(
  '/templates/:id',
  requireAuth,
  requireRole('ADMIN', 'STAFF'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseInt(req.params.id, 10);
      await subscriptionsService.deleteTemplate(id);
      sendSuccess(res, { id }, 'Quotation template deleted successfully');
    } catch (err) {
      next(err);
    }
  }
);

/* ====================================================================
 * POST /from-template/:id
 * Creates a DRAFT subscription with lines prefilled and computed expiry
 * ==================================================================== */

subscriptionsRouter.post(
  '/from-template/:id',
  requireAuth,
  requireRole('ADMIN', 'STAFF'),
  validateBody(fromTemplateSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const templateId = parseInt(req.params.id, 10);
      const sub = await subscriptionsService.createFromTemplate(templateId, req.body, req.user?.id);
      sendCreated(res, sub, 'Subscription created from template in DRAFT status');
    } catch (err) {
      next(err);
    }
  }
);

/* ====================================================================
 * SUBSCRIPTIONS CRUD
 * ==================================================================== */

/**
 * GET /
 * Filters by status, customer, date with pagination
 */
subscriptionsRouter.get(
  '/',
  requireAuth,
  requireRole('ADMIN', 'STAFF', 'CUSTOMER'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const pagination = extractPaginationParams(req, 10, 'id:desc');

      // If user is CUSTOMER, only list their own subscriptions
      let customerId = req.query.customer_id ? parseInt(req.query.customer_id as string, 10) : undefined;
      if (req.user?.role === 'CUSTOMER') {
        customerId = req.user.id;
      }

      const filter = {
        status: req.query.status as string | undefined,
        customer_id: customerId,
        start_date: req.query.start_date as string | undefined,
        expiry_date: req.query.expiry_date as string | undefined,
      };

      const result = await subscriptionsService.listSubscriptions(filter, pagination);
      sendPaginated(res, result);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /:id
 */
subscriptionsRouter.get(
  '/:id',
  requireAuth,
  requireRole('ADMIN', 'STAFF', 'CUSTOMER'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseInt(req.params.id, 10);
      const sub = await subscriptionsService.getSubscriptionById(id);

      // Customer authorization check
      if (req.user?.role === 'CUSTOMER' && sub.customer_id !== req.user.id) {
        return next(requireRole('ADMIN', 'STAFF')(req, res, next));
      }

      sendSuccess(res, sub);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST / (Admin and staff only for writes)
 */
subscriptionsRouter.post(
  '/',
  requireAuth,
  requireRole('ADMIN', 'STAFF'),
  validateBody(createSubscriptionSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const sub = await subscriptionsService.createSubscription(req.body, req.user?.id);
      sendCreated(res, sub, 'Subscription created successfully');
    } catch (err) {
      next(err);
    }
  }
);

/**
 * PATCH /:id (Admin and staff only for writes)
 */
subscriptionsRouter.patch(
  '/:id',
  requireAuth,
  requireRole('ADMIN', 'STAFF'),
  validateBody(updateSubscriptionSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseInt(req.params.id, 10);
      const sub = await subscriptionsService.updateSubscription(id, req.body);
      sendSuccess(res, sub, 'Subscription updated successfully');
    } catch (err) {
      next(err);
    }
  }
);

/**
 * PUT /:id (Admin and staff only for writes)
 */
subscriptionsRouter.put(
  '/:id',
  requireAuth,
  requireRole('ADMIN', 'STAFF'),
  validateBody(updateSubscriptionSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseInt(req.params.id, 10);
      const sub = await subscriptionsService.updateSubscription(id, req.body);
      sendSuccess(res, sub, 'Subscription updated successfully');
    } catch (err) {
      next(err);
    }
  }
);

/**
 * DELETE /:id (Admin and staff only)
 */
subscriptionsRouter.delete(
  '/:id',
  requireAuth,
  requireRole('ADMIN', 'STAFF'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseInt(req.params.id, 10);
      await subscriptionsService.deleteSubscription(id);
      sendSuccess(res, { id }, 'Subscription deleted successfully');
    } catch (err) {
      next(err);
    }
  }
);

/* ====================================================================
 * STRICT STATE MACHINE TRANSITION: POST /:id/transition
 * DRAFT → QUOTATION → CONFIRMED → ACTIVE → CLOSED
 * ==================================================================== */

subscriptionsRouter.post(
  '/:id/transition',
  requireAuth,
  requireRole('ADMIN', 'STAFF'),
  validateBody(transitionStatusSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseInt(req.params.id, 10);
      const sub = await subscriptionsService.transitionStatus(id, req.body.to_status, req.user?.id);
      sendSuccess(res, sub, `Subscription transitioned to ${req.body.to_status}`);
    } catch (err) {
      next(err);
    }
  }
);
