import { Router, Request, Response, NextFunction } from 'express';
import { validateBody } from '../../middleware/validate.middleware';
import { requireAuth } from '../../middleware/auth.middleware';
import { sendSuccess, sendCreated } from '../../utils/response';
import {
  signupSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from './auth.validation';
import { authService } from './auth.service';

export const authRouter = Router();

/**
 * POST /api/auth/signup
 * Register a new user with role CUSTOMER, hashed password, unique email.
 */
authRouter.post(
  '/signup',
  validateBody(signupSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = await authService.signup(req.body);
      sendCreated(res, user, 'User registered successfully');
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/auth/login
 * Authenticate credentials and return JWT containing user id and role.
 */
authRouter.post(
  '/login',
  validateBody(loginSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await authService.login(req.body);
      sendSuccess(res, result, 'Login successful');
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/auth/forgot-password
 * Generate a random token, store its hash with 1h expiry, email reset link.
 * Returns identical response whether email exists or not to prevent email enumeration.
 */
authRouter.post(
  '/forgot-password',
  validateBody(forgotPasswordSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await authService.forgotPassword(req.body.email);
      sendSuccess(res, result, result.message);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/auth/reset-password
 * Validate token and expiry, enforce password rules, and invalidate token after use.
 */
authRouter.post(
  '/reset-password',
  (req: Request, _res: Response, next: NextFunction) => {
    // If token is provided in query param (?token=...), copy it to body if not already present
    if (!req.body.token && req.query.token && typeof req.query.token === 'string') {
      req.body.token = req.query.token;
    }
    next();
  },
  validateBody(resetPasswordSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await authService.resetPassword(req.body);
      sendSuccess(res, result, result.message);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/auth/me
 * Protected endpoint returning the authenticated user profile.
 */
authRouter.get('/me', requireAuth, (req: Request, res: Response): void => {
  sendSuccess(res, req.user);
});
