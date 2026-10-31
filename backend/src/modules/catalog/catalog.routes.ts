import { Router, Request, Response, NextFunction } from 'express';
import { catalogService } from './catalog.service';
import {
  createProductSchema,
  updateProductSchema,
  createPlanSchema,
  updatePlanSchema,
} from './catalog.validation';
import { validateBody } from '../../middleware/validate.middleware';
import { requireAuth, requireRole } from '../../middleware/auth.middleware';
import { extractPaginationParams } from '../../utils/pagination';
import { sendSuccess, sendCreated, sendPaginated } from '../../utils/response';

export const catalogRouter = Router();

/* ====================================================================
 * PRODUCTS ENDPOINTS
 * Admin-only CRUD, Staff & authenticated read-only
 * ==================================================================== */

/**
 * GET /products
 * Supports ?page=&limit=&sort=&type=&search=
 */
catalogRouter.get(
  '/products',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const pagination = extractPaginationParams(req, 10, 'id:asc');
      const filter = {
        type: req.query.type as string | undefined,
        search: req.query.search as string | undefined,
      };

      const result = await catalogService.listProducts(filter, pagination);
      sendPaginated(res, result);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /products/:id
 */
catalogRouter.get(
  '/products/:id',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseInt(req.params.id, 10);
      const product = await catalogService.getProductById(id);
      sendSuccess(res, product);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /products (Admin-only)
 */
catalogRouter.post(
  '/products',
  requireAuth,
  requireRole('ADMIN'),
  validateBody(createProductSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const product = await catalogService.createProduct(req.body);
      sendCreated(res, product, 'Product created successfully');
    } catch (err) {
      next(err);
    }
  }
);

/**
 * PATCH /products/:id (Admin-only)
 */
catalogRouter.patch(
  '/products/:id',
  requireAuth,
  requireRole('ADMIN'),
  validateBody(updateProductSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseInt(req.params.id, 10);
      const product = await catalogService.updateProduct(id, req.body);
      sendSuccess(res, product, 'Product updated successfully');
    } catch (err) {
      next(err);
    }
  }
);

/**
 * PUT /products/:id (Admin-only)
 */
catalogRouter.put(
  '/products/:id',
  requireAuth,
  requireRole('ADMIN'),
  validateBody(updateProductSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseInt(req.params.id, 10);
      const product = await catalogService.updateProduct(id, req.body);
      sendSuccess(res, product, 'Product updated successfully');
    } catch (err) {
      next(err);
    }
  }
);

/**
 * DELETE /products/:id (Admin-only)
 */
catalogRouter.delete(
  '/products/:id',
  requireAuth,
  requireRole('ADMIN'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseInt(req.params.id, 10);
      await catalogService.deleteProduct(id);
      sendSuccess(res, { id }, 'Product deleted successfully');
    } catch (err) {
      next(err);
    }
  }
);

/* ====================================================================
 * PLANS ENDPOINTS
 * Admin-only CRUD, Staff & authenticated read-only
 * ==================================================================== */

/**
 * GET /plans
 * Supports ?page=&limit=&sort=&billing_period=&status=&search=
 */
catalogRouter.get(
  '/plans',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const pagination = extractPaginationParams(req, 10, 'id:asc');
      const filter = {
        billing_period: req.query.billing_period as string | undefined,
        status: req.query.status as string | undefined,
        search: req.query.search as string | undefined,
      };

      const result = await catalogService.listPlans(filter, pagination);
      sendPaginated(res, result);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /plans/:id
 */
catalogRouter.get(
  '/plans/:id',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseInt(req.params.id, 10);
      const plan = await catalogService.getPlanById(id);
      sendSuccess(res, plan);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /plans (Admin-only)
 */
catalogRouter.post(
  '/plans',
  requireAuth,
  requireRole('ADMIN'),
  validateBody(createPlanSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const plan = await catalogService.createPlan(req.body);
      sendCreated(res, plan, 'Plan created successfully');
    } catch (err) {
      next(err);
    }
  }
);

/**
 * PATCH /plans/:id (Admin-only)
 */
catalogRouter.patch(
  '/plans/:id',
  requireAuth,
  requireRole('ADMIN'),
  validateBody(updatePlanSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseInt(req.params.id, 10);
      const plan = await catalogService.updatePlan(id, req.body);
      sendSuccess(res, plan, 'Plan updated successfully');
    } catch (err) {
      next(err);
    }
  }
);

/**
 * PUT /plans/:id (Admin-only)
 */
catalogRouter.put(
  '/plans/:id',
  requireAuth,
  requireRole('ADMIN'),
  validateBody(updatePlanSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseInt(req.params.id, 10);
      const plan = await catalogService.updatePlan(id, req.body);
      sendSuccess(res, plan, 'Plan updated successfully');
    } catch (err) {
      next(err);
    }
  }
);

/**
 * DELETE /plans/:id (Admin-only)
 */
catalogRouter.delete(
  '/plans/:id',
  requireAuth,
  requireRole('ADMIN'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseInt(req.params.id, 10);
      await catalogService.deletePlan(id);
      sendSuccess(res, { id }, 'Plan deleted successfully');
    } catch (err) {
      next(err);
    }
  }
);

/* ====================================================================
 * PLAN ACTIONS: /plans/:id/close, /pause, /renew (Admin-only)
 * ==================================================================== */

catalogRouter.post(
  '/plans/:id/close',
  requireAuth,
  requireRole('ADMIN'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseInt(req.params.id, 10);
      const plan = await catalogService.closePlan(id);
      sendSuccess(res, plan, 'Plan closed successfully');
    } catch (err) {
      next(err);
    }
  }
);

catalogRouter.post(
  '/plans/:id/pause',
  requireAuth,
  requireRole('ADMIN'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseInt(req.params.id, 10);
      const plan = await catalogService.pausePlan(id);
      sendSuccess(res, plan, 'Plan paused successfully');
    } catch (err) {
      next(err);
    }
  }
);

catalogRouter.post(
  '/plans/:id/renew',
  requireAuth,
  requireRole('ADMIN'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseInt(req.params.id, 10);
      const plan = await catalogService.renewPlan(id);
      sendSuccess(res, plan, 'Plan renewed successfully');
    } catch (err) {
      next(err);
    }
  }
);
