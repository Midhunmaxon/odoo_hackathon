import { Router, Request, Response, NextFunction } from 'express';
import { db } from '../../db';
import { authenticateJwt, requireRole } from '../../middleware/auth.middleware';
import { extractPaginationParams, paginateKnexQuery, paginateArray } from '../../utils/pagination';
import { sendPaginated } from '../../utils/response';

export const usersRouter = Router();

// Demo fallback data if database is not initialized yet
const DEMO_USERS = [
  { id: 1, email: 'admin@brightloop.com', name: 'System Admin', role: 'ADMIN', is_active: true },
  { id: 2, email: 'staff1@brightloop.com', name: 'Sarah Connor', role: 'STAFF', is_active: true },
  { id: 3, email: 'staff2@brightloop.com', name: 'James Miller', role: 'STAFF', is_active: true },
  { id: 4, email: 'customer1@brightloop.com', name: 'Acme Corp', role: 'CUSTOMER', is_active: true },
  { id: 5, email: 'customer2@brightloop.com', name: 'TechFlow Inc', role: 'CUSTOMER', is_active: true },
];

/**
 * GET /api/users
 * Supports ?page=&limit=&sort=
 * Returns { data, page, limit, total }
 */
usersRouter.get(
  '/',
  authenticateJwt,
  requireRole('ADMIN', 'STAFF'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const paginationParams = extractPaginationParams(req, 10, 'id:asc');

      try {
        const query = db('users').select('id', 'email', 'name', 'role', 'is_active', 'created_at');
        const result = await paginateKnexQuery(query, paginationParams);
        sendPaginated(res, result);
      } catch (dbErr) {
        // Fallback to demo users in-memory pagination
        const result = paginateArray(DEMO_USERS, paginationParams);
        sendPaginated(res, result);
      }
    } catch (error) {
      next(error);
    }
  }
);
