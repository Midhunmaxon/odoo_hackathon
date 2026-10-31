import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';

export const createTaxSchema = z.object({
  name: z.string().trim().min(1, 'Tax name is required').max(255, 'Tax name is too long'),
  rate_percent: z
    .number({ invalid_type_error: 'rate_percent must be a number' })
    .min(0, 'Tax rate cannot be negative')
    .max(100, 'Tax rate cannot exceed 100%'),
  active: z.boolean().optional().default(true),
});

export const updateTaxSchema = z
  .object({
    name: z.string().trim().min(1, 'Tax name cannot be empty').max(255).optional(),
    rate_percent: z
      .number({ invalid_type_error: 'rate_percent must be a number' })
      .min(0, 'Tax rate cannot be negative')
      .max(100, 'Tax rate cannot exceed 100%')
      .optional(),
    active: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided for update',
  });

export const createDiscountSchema = z
  .object({
    name: z.string().trim().min(1, 'Discount name is required').max(255),
    type: z.enum(['FIXED', 'PERCENT'], {
      errorMap: () => ({ message: "Discount type must be either 'FIXED' or 'PERCENT'" }),
    }),
    value: z.number({ invalid_type_error: 'Discount value must be a number' }).positive('Discount value must be greater than 0'),
    min_purchase: z.number().min(0, 'min_purchase cannot be negative').nullable().optional(),
    min_quantity: z.number().int().min(0, 'min_quantity cannot be negative').nullable().optional(),
    start_date: z.string().nullable().optional(),
    end_date: z.string().nullable().optional(),
    usage_limit: z.number().int().positive('usage_limit must be a positive integer').nullable().optional(),
    applies_to: z.enum(['PRODUCT', 'SUBSCRIPTION'], {
      errorMap: () => ({ message: "applies_to must be either 'PRODUCT' or 'SUBSCRIPTION'" }),
    }),
    product_id: z.number().int().positive('product_id must be a positive integer').nullable().optional(),
  })
  .superRefine((data, ctx) => {
    // Percentage value cannot exceed 100%
    if (data.type === 'PERCENT' && data.value > 100) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['value'],
        message: 'Percentage discount cannot exceed 100%',
      });
    }

    // If applies_to === 'PRODUCT', product_id is required
    if (data.applies_to === 'PRODUCT' && (!data.product_id || data.product_id <= 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['product_id'],
        message: "product_id is required when discount applies to 'PRODUCT'",
      });
    }

    // Date range validation: start_date <= end_date
    if (data.start_date && data.end_date) {
      const start = new Date(data.start_date).getTime();
      const end = new Date(data.end_date).getTime();
      if (!isNaN(start) && !isNaN(end) && start > end) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['end_date'],
          message: 'end_date must be on or after start_date',
        });
      }
    }
  });

export const updateDiscountSchema = z
  .object({
    name: z.string().trim().min(1).max(255).optional(),
    type: z.enum(['FIXED', 'PERCENT']).optional(),
    value: z.number().positive().optional(),
    min_purchase: z.number().min(0).nullable().optional(),
    min_quantity: z.number().int().min(0).nullable().optional(),
    start_date: z.string().nullable().optional(),
    end_date: z.string().nullable().optional(),
    usage_limit: z.number().int().positive().nullable().optional(),
    applies_to: z.enum(['PRODUCT', 'SUBSCRIPTION']).optional(),
    product_id: z.number().int().positive().nullable().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided for update',
  })
  .superRefine((data, ctx) => {
    if (data.type === 'PERCENT' && data.value !== undefined && data.value > 100) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['value'],
        message: 'Percentage discount cannot exceed 100%',
      });
    }

    if (data.applies_to === 'PRODUCT' && data.product_id === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['product_id'],
        message: "product_id cannot be null when discount applies to 'PRODUCT'",
      });
    }

    if (data.start_date && data.end_date) {
      const start = new Date(data.start_date).getTime();
      const end = new Date(data.end_date).getTime();
      if (!isNaN(start) && !isNaN(end) && start > end) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['end_date'],
          message: 'end_date must be on or after start_date',
        });
      }
    }
  });

export const idParamSchema = z.object({
  id: z.string().regex(/^\d+$/, 'ID must be a numeric integer'),
});

export const calculateTotalsSchema = z.object({
  lines: z.array(
    z.object({
      id: z.union([z.number(), z.string()]).optional(),
      product_id: z.number().nullable().optional(),
      description: z.string().optional(),
      quantity: z.number().positive('Quantity must be greater than 0'),
      unit_price: z.number().min(0, 'Unit price cannot be negative'),
      tax_id: z.number().nullable().optional(),
    })
  ),
  discounts: z.array(z.any()).optional().default([]),
  taxes: z.array(z.any()).optional().default([]),
  today: z.union([z.string(), z.date()]).optional(),
});

/**
 * Validation middleware supporting ZodEffects as well as AnyZodObject
 */
export function validateZodBody(schema: z.ZodTypeAny) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      req.body = await schema.parseAsync(req.body);
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function validateZodParams(schema: z.ZodTypeAny) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      req.params = await schema.parseAsync(req.params);
      next();
    } catch (error) {
      next(error);
    }
  };
}

export type CreateTaxInput = z.input<typeof createTaxSchema>;
export type UpdateTaxInput = z.input<typeof updateTaxSchema>;
export type CreateDiscountInput = z.input<typeof createDiscountSchema>;
export type UpdateDiscountInput = z.input<typeof updateDiscountSchema>;
