import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { db } from '../../db';
import { env } from '../../config/env';
import { validateBody } from '../../middleware/validate.middleware';
import { authenticateJwt, AuthUser } from '../../middleware/auth.middleware';
import { ApiError } from '../../middleware/error.middleware';
import { sendSuccess } from '../../utils/response';

export const authRouter = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

/**
 * POST /api/auth/login
 */
authRouter.post(
  '/login',
  validateBody(loginSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { email, password } = req.body;

      let user: any = null;
      try {
        user = await db('users').where({ email, is_active: true }).first();
      } catch (dbErr) {
        // Fallback demo users if DB is not connected during local dev
        if (email === 'admin@brightloop.com') {
          user = {
            id: 1,
            email: 'admin@brightloop.com',
            name: 'System Admin',
            role: 'ADMIN',
            password_hash: bcrypt.hashSync('Password123!', 10),
            is_active: true,
          };
        }
      }

      if (!user) {
        throw ApiError.unauthorized('Invalid email or password');
      }

      const isPasswordValid = await bcrypt.compare(password, user.password_hash);
      if (!isPasswordValid) {
        throw ApiError.unauthorized('Invalid email or password');
      }

      const payload: AuthUser = {
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.name,
      };

      const token = jwt.sign(payload, env.JWT_SECRET, { expiresIn: '7d' });

      sendSuccess(res, {
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/auth/me
 */
authRouter.get('/me', authenticateJwt, (req: Request, res: Response): void => {
  sendSuccess(res, req.user);
});
