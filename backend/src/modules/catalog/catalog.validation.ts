import { z } from 'zod';

export const variantSchema = z.object({
  id: z.number().optional(),
  attribute: z.string().min(1, 'Attribute is required'),
  value: z.string().min(1, 'Value is required'),
  extra_price: z.coerce.number().min(0, 'Extra price must be >= 0').default(0),
});

export const createProductSchema = z.object({
  name: z.string().min(1, 'Product name is required'),
  type: z.string().default('service'),
  sales_price: z.coerce.number().min(0, 'Sales price must be >= 0').default(0),
  cost_price: z.coerce.number().min(0, 'Cost price must be >= 0').default(0),
  notes: z.string().nullable().optional(),
  variants: z.array(variantSchema).optional().default([]),
});

export const updateProductSchema = createProductSchema.partial();

export const planBillingPeriodEnum = z.enum(['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY']);

export const createPlanSchema = z
  .object({
    name: z.string().min(1, 'Plan name is required'),
    price: z.coerce.number().min(0, 'Plan price must be >= 0'),
    billing_period: planBillingPeriodEnum,
    min_quantity: z.coerce.number().int().min(1, 'Min quantity must be >= 1').default(1),
    start_date: z.string().nullable().optional(),
    end_date: z.string().nullable().optional(),
    auto_close: z.boolean().optional().default(false),
    allow_close: z.boolean().optional().default(true),
    allow_pause: z.boolean().optional().default(true),
    allow_renew: z.boolean().optional().default(true),
    status: z.string().optional().default('ACTIVE'),
  })
  .refine(
    (data) => {
      if (data.start_date && data.end_date) {
        return new Date(data.end_date).getTime() > new Date(data.start_date).getTime();
      }
      return true;
    },
    {
      message: 'end_date must be after start_date',
      path: ['end_date'],
    }
  );

export const updatePlanSchema = z
  .object({
    name: z.string().min(1).optional(),
    price: z.coerce.number().min(0).optional(),
    billing_period: planBillingPeriodEnum.optional(),
    min_quantity: z.coerce.number().int().min(1).optional(),
    start_date: z.string().nullable().optional(),
    end_date: z.string().nullable().optional(),
    auto_close: z.boolean().optional(),
    allow_close: z.boolean().optional(),
    allow_pause: z.boolean().optional(),
    allow_renew: z.boolean().optional(),
    status: z.string().optional(),
  })
  .refine(
    (data) => {
      if (data.start_date && data.end_date) {
        return new Date(data.end_date).getTime() > new Date(data.start_date).getTime();
      }
      return true;
    },
    {
      message: 'end_date must be after start_date',
      path: ['end_date'],
    }
  );

export type CreateProductInput = z.input<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type VariantInput = z.infer<typeof variantSchema>;
export type CreatePlanInput = z.input<typeof createPlanSchema>;
export type UpdatePlanInput = z.infer<typeof updatePlanSchema>;
