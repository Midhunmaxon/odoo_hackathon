import { Router, Request, Response, NextFunction } from 'express';
import { authenticateJwt, requireRole } from '../../middleware/auth.middleware';
import { extractPaginationParams } from '../../utils/pagination';
import { sendSuccess, sendCreated, sendPaginated } from '../../utils/response';
import { taxDiscountService } from './tax-discount.service';
import { calculateInvoiceTotals } from './tax-discount.calculator';
import {
  createTaxSchema,
  updateTaxSchema,
  createDiscountSchema,
  updateDiscountSchema,
  idParamSchema,
  calculateTotalsSchema,
  validateZodBody,
  validateZodParams,
} from './tax-discount.validation';

export const taxDiscountRouter = Router();

/* =========================================================================
 * CONTROLLER HANDLERS FOR TAXES (Admin-only CRUD)
 * ========================================================================= */

const listTaxesHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const params = extractPaginationParams(req, 10, 'id:asc');
    let activeFilter: boolean | undefined = undefined;
    if (req.query.active !== undefined) {
      activeFilter = req.query.active === 'true';
    }
    const result = await taxDiscountService.listTaxes(params, activeFilter);
    sendPaginated(res, result);
  } catch (err) {
    next(err);
  }
};

const getTaxByIdHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    const tax = await taxDiscountService.getTaxById(id);
    sendSuccess(res, tax, 'Tax retrieved successfully');
  } catch (err) {
    next(err);
  }
};

const createTaxHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const tax = await taxDiscountService.createTax(req.body);
    sendCreated(res, tax, 'Tax created successfully');
  } catch (err) {
    next(err);
  }
};

const updateTaxHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    const updated = await taxDiscountService.updateTax(id, req.body);
    sendSuccess(res, updated, 'Tax updated successfully');
  } catch (err) {
    next(err);
  }
};

const deleteTaxHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    const result = await taxDiscountService.deleteTax(id);
    sendSuccess(res, result, result.message);
  } catch (err) {
    next(err);
  }
};

/* =========================================================================
 * CONTROLLER HANDLERS FOR DISCOUNTS (Admin-only CRUD)
 * ========================================================================= */

const listDiscountsHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const params = extractPaginationParams(req, 10, 'id:asc');
    const appliesToFilter = req.query.applies_to as string | undefined;
    const result = await taxDiscountService.listDiscounts(params, appliesToFilter);
    sendPaginated(res, result);
  } catch (err) {
    next(err);
  }
};

const getDiscountByIdHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    const discount = await taxDiscountService.getDiscountById(id);
    sendSuccess(res, discount, 'Discount retrieved successfully');
  } catch (err) {
    next(err);
  }
};

const createDiscountHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const discount = await taxDiscountService.createDiscount(req.body);
    sendCreated(res, discount, 'Discount created successfully');
  } catch (err) {
    next(err);
  }
};

const updateDiscountHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    const updated = await taxDiscountService.updateDiscount(id, req.body);
    sendSuccess(res, updated, 'Discount updated successfully');
  } catch (err) {
    next(err);
  }
};

const deleteDiscountHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    const result = await taxDiscountService.deleteDiscount(id);
    sendSuccess(res, result, result.message);
  } catch (err) {
    next(err);
  }
};

const incrementDiscountUsageHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    const updated = await taxDiscountService.incrementDiscountUsage(id);
    sendSuccess(res, updated, 'Discount usage count incremented successfully');
  } catch (err) {
    next(err);
  }
};

/* =========================================================================
 * CONTROLLER HANDLER FOR INVOICE TOTALS CALCULATION
 * ========================================================================= */

const calculateTotalsHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { lines, discounts, taxes, today } = req.body;
    const result = calculateInvoiceTotals(lines, discounts, taxes, today);
    sendSuccess(res, result, 'Invoice totals calculated successfully');
  } catch (err) {
    next(err);
  }
};

/* =========================================================================
 * ROUTE REGISTRATIONS
 * ========================================================================= */

// Common middlewares for admin-only CRUD
const adminAuth = [authenticateJwt, requireRole('ADMIN')];

// 1. Tax routes under /taxes
taxDiscountRouter.get('/taxes', adminAuth, listTaxesHandler);
taxDiscountRouter.get('/taxes/:id', adminAuth, validateZodParams(idParamSchema), getTaxByIdHandler);
taxDiscountRouter.post('/taxes', adminAuth, validateZodBody(createTaxSchema), createTaxHandler);
taxDiscountRouter.patch('/taxes/:id', adminAuth, validateZodParams(idParamSchema), validateZodBody(updateTaxSchema), updateTaxHandler);
taxDiscountRouter.put('/taxes/:id', adminAuth, validateZodParams(idParamSchema), validateZodBody(updateTaxSchema), updateTaxHandler);
taxDiscountRouter.delete('/taxes/:id', adminAuth, validateZodParams(idParamSchema), deleteTaxHandler);

// 2. Discount routes under /discounts
taxDiscountRouter.get('/discounts', adminAuth, listDiscountsHandler);
taxDiscountRouter.get('/discounts/:id', adminAuth, validateZodParams(idParamSchema), getDiscountByIdHandler);
taxDiscountRouter.post('/discounts', adminAuth, validateZodBody(createDiscountSchema), createDiscountHandler);
taxDiscountRouter.patch('/discounts/:id', adminAuth, validateZodParams(idParamSchema), validateZodBody(updateDiscountSchema), updateDiscountHandler);
taxDiscountRouter.put('/discounts/:id', adminAuth, validateZodParams(idParamSchema), validateZodBody(updateDiscountSchema), updateDiscountHandler);
taxDiscountRouter.delete('/discounts/:id', adminAuth, validateZodParams(idParamSchema), deleteDiscountHandler);
taxDiscountRouter.post('/discounts/:id/increment-usage', adminAuth, validateZodParams(idParamSchema), incrementDiscountUsageHandler);

// 3. Calculation helper endpoint
taxDiscountRouter.post('/calculate-totals', adminAuth, validateZodBody(calculateTotalsSchema), calculateTotalsHandler);

// 4. Aliases for direct mount at /api/taxes (e.g. app.use('/api/taxes', taxDiscountRouter))
taxDiscountRouter.get('/', adminAuth, listTaxesHandler);
taxDiscountRouter.post('/', adminAuth, validateZodBody(createTaxSchema), createTaxHandler);
taxDiscountRouter.get('/:id(\\d+)', adminAuth, validateZodParams(idParamSchema), getTaxByIdHandler);
taxDiscountRouter.patch('/:id(\\d+)', adminAuth, validateZodParams(idParamSchema), validateZodBody(updateTaxSchema), updateTaxHandler);
taxDiscountRouter.put('/:id(\\d+)', adminAuth, validateZodParams(idParamSchema), validateZodBody(updateTaxSchema), updateTaxHandler);
taxDiscountRouter.delete('/:id(\\d+)', adminAuth, validateZodParams(idParamSchema), deleteTaxHandler);

export default taxDiscountRouter;
