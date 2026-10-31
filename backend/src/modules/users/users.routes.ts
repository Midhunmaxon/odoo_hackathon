import { Router, Request, Response, NextFunction } from 'express';
import { authenticateJwt, requireRole } from '../../middleware/auth.middleware';
import { validateBody, validateParams } from '../../middleware/validate.middleware';
import { extractPaginationParams } from '../../utils/pagination';
import { sendSuccess, sendCreated, sendPaginated } from '../../utils/response';
import { usersService } from './users.service';
import {
  createStaffSchema,
  updateMeSchema,
  idParamSchema,
} from './users.validation';
import { ApiError } from '../../middleware/error.middleware';

export const usersRouter = Router();

/* =========================================================================
 * Shared middleware stacks
 * ========================================================================= */

const adminOnly = [authenticateJwt, requireRole('ADMIN')];
const adminOrStaff = [authenticateJwt, requireRole('ADMIN', 'STAFF')];
const anyAuthenticated = [authenticateJwt];

/* =========================================================================
 * ADMIN-ONLY  ENDPOINTS
 * ========================================================================= */

/**
 * POST /api/users/staff
 * Admin creates a new STAFF account.
 */
usersRouter.post(
  '/staff',
  ...adminOnly,
  validateBody(createStaffSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = await usersService.createStaff(req.body);
      sendCreated(res, user, 'Staff account created successfully');
    } catch (err) {
      next(err);
    }
  }
);

/**
 * PATCH /api/users/:id/deactivate
 * Admin deactivates (soft-deletes) a user account.
 */
usersRouter.patch(
  '/:id/deactivate',
  ...adminOnly,
  validateParams(idParamSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const targetId = parseInt(req.params.id, 10);
      const result = await usersService.deactivateUser(targetId, req.user!.id);
      sendSuccess(res, result, 'User deactivated successfully');
    } catch (err) {
      next(err);
    }
  }
);

/* =========================================================================
 * ADMIN / STAFF  ENDPOINTS
 * ========================================================================= */

/**
 * GET /api/users
 * Admin and Staff can list all users. Supports ?role=&is_active=&page=&limit=&sort=
 */
usersRouter.get(
  '/',
  ...adminOrStaff,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const params = extractPaginationParams(req, 10, 'id:asc');

      const filters: { role?: string; is_active?: boolean } = {};
      if (req.query.role && typeof req.query.role === 'string') {
        filters.role = req.query.role.toUpperCase();
      }
      if (req.query.is_active !== undefined) {
        filters.is_active = req.query.is_active === 'true';
      }

      const result = await usersService.listUsers(params, filters);
      sendPaginated(res, result);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/users/customers
 * Staff and Admin can list all CUSTOMER users.
 */
usersRouter.get(
  '/customers',
  ...adminOrStaff,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const params = extractPaginationParams(req, 10, 'id:asc');
      const result = await usersService.listCustomers(params);
      sendPaginated(res, result);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/users/customers/:id
 * Staff and Admin can view a single CUSTOMER profile.
 */
usersRouter.get(
  '/customers/:id',
  ...adminOrStaff,
  validateParams(idParamSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const customerId = parseInt(req.params.id, 10);
      const customer = await usersService.getCustomer(customerId);
      sendSuccess(res, customer, 'Customer retrieved successfully');
    } catch (err) {
      next(err);
    }
  }
);

/* =========================================================================
 * AUTHENTICATED USER  ENDPOINTS  (/me)
 * ========================================================================= */

/**
 * GET /api/users/me
 * Returns the authenticated user's full profile from the database.
 */
usersRouter.get(
  '/me',
  ...anyAuthenticated,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = await usersService.getMe(req.user!.id);
      sendSuccess(res, user, 'User profile retrieved successfully');
    } catch (err) {
      next(err);
    }
  }
);

/**
 * PATCH /api/users/me
 * Authenticated user updates their own profile (name, email).
 */
usersRouter.patch(
  '/me',
  ...anyAuthenticated,
  validateBody(updateMeSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Ensure at least one updatable field is present
      const { name, email } = req.body;
      if (name === undefined && email === undefined) {
        return next(ApiError.badRequest('At least one field must be provided for update'));
      }
      const updated = await usersService.updateMe(req.user!.id, req.body);
      sendSuccess(res, updated, 'Profile updated successfully');
    } catch (err) {
      next(err);
    }
  }
);

/* =========================================================================
 * PORTAL  ENDPOINTS  (/portal/*)
 * A CUSTOMER must only ever see their own records.
 * Enforcement is in the service-layer WHERE clauses.
 * ========================================================================= */

/**
 * GET /api/users/portal/subscriptions
 * Customer sees ONLY their own subscriptions.
 */
usersRouter.get(
  '/portal/subscriptions',
  ...anyAuthenticated,
  requireRole('CUSTOMER'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const params = extractPaginationParams(req, 10, 'id:desc');
      const result = await usersService.listMySubscriptions(req.user!.id, params);
      sendPaginated(res, result);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/users/portal/subscriptions/:id
 * Customer sees ONLY their own subscription – returns 404 for anyone else's.
 */
usersRouter.get(
  '/portal/subscriptions/:id',
  ...anyAuthenticated,
  requireRole('CUSTOMER'),
  validateParams(idParamSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const subscriptionId = parseInt(req.params.id, 10);
      const subscription = await usersService.getMySubscription(req.user!.id, subscriptionId);
      sendSuccess(res, subscription, 'Subscription retrieved successfully');
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/users/portal/invoices
 * Customer sees ONLY their own invoices.
 */
usersRouter.get(
  '/portal/invoices',
  ...anyAuthenticated,
  requireRole('CUSTOMER'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const params = extractPaginationParams(req, 10, 'id:desc');
      const result = await usersService.listMyInvoices(req.user!.id, params);
      sendPaginated(res, result);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/users/portal/invoices/:id
 * Customer sees ONLY their own invoice – returns 404 for anyone else's.
 */
usersRouter.get(
  '/portal/invoices/:id',
  ...anyAuthenticated,
  requireRole('CUSTOMER'),
  validateParams(idParamSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const invoiceId = parseInt(req.params.id, 10);
      const invoice = await usersService.getMyInvoice(req.user!.id, invoiceId);
      sendSuccess(res, invoice, 'Invoice retrieved successfully');
    } catch (err) {
      next(err);
    }
  }
);

export default usersRouter;
