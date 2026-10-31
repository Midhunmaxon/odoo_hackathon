import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { env } from './config/env';
import { errorHandler, ApiError } from './middleware/error.middleware';

// Module Routers
import { authRouter } from './modules/auth/auth.routes';
import { usersRouter } from './modules/users/users.routes';
import { catalogRouter } from './modules/catalog/catalog.routes';
import { subscriptionsRouter } from './modules/subscriptions/subscriptions.routes';
import { taxDiscountRouter } from './modules/tax-discount/tax-discount.routes';
import { invoicesRouter } from './modules/invoices/invoices.routes';
import { paymentsRouter } from './modules/payments/payments.routes';
import { reportsRouter } from './modules/reports/reports.routes';

export const app: Application = express();

// Global Middlewares
app.use(cors({ origin: env.CLIENT_URL || '*', credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health Check Endpoint
app.get('/api/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'brightloop-backend',
    env: env.NODE_ENV,
  });
});

// Mount Module Routers
app.use('/api/auth', authRouter);
app.use('/auth', authRouter); // Alias for direct module path
app.use('/api/users', usersRouter);
app.use('/api/catalog', catalogRouter);
app.use('/catalog', catalogRouter);
app.use('/plans', (req, res, next) => {
  req.url = '/plans' + req.url;
  catalogRouter(req, res, next);
});
app.use('/api/subscriptions', subscriptionsRouter);
app.use('/subscriptions', subscriptionsRouter);
app.use('/api/tax-discount', taxDiscountRouter);
app.use('/api/taxes', taxDiscountRouter); // Alias for convenience
app.use('/api/invoices', invoicesRouter);
app.use('/api/payments', paymentsRouter);
app.use('/api/reports', reportsRouter);

// 404 Handler
app.use((_req: Request, _res: Response, next: NextFunction) => {
  next(ApiError.notFound('The requested API resource does not exist.'));
});

// Centralized Error Handling Middleware
app.use(errorHandler);

export default app;
