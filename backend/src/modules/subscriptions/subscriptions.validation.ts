import { z } from 'zod';

export const quotationTemplateLineSchema = z.object({
  id: z.number().optional(),
  product_id: z.coerce.number().int().positive('Product ID is required'),
  variant_id: z.coerce.number().int().positive().nullable().optional(),
  quantity: z.coerce.number().min(1, 'Quantity must be >= 1').default(1),
});

export const createQuotationTemplateSchema = z.object({
  name: z.string().min(1, 'Template name is required'),
  validity_days: z.coerce.number().int().min(1, 'Validity days must be >= 1').default(30),
  plan_id: z.coerce.number().int().positive().nullable().optional(),
  lines: z.array(quotationTemplateLineSchema).min(1, 'At least one product line is required'),
});

export const updateQuotationTemplateSchema = createQuotationTemplateSchema.partial();

export const fromTemplateSchema = z.object({
  customer_id: z.coerce.number().int().positive('Customer ID is required'),
  start_date: z.string().optional(),
  payment_terms: z.string().default('immediate'),
});

export const subscriptionLineSchema = z.object({
  id: z.number().optional(),
  product_id: z.coerce.number().int().positive('Product ID is required'),
  variant_id: z.coerce.number().int().positive().nullable().optional(),
  quantity: z.coerce.number().min(1, 'Quantity must be >= 1').default(1),
  tax_id: z.coerce.number().int().positive().nullable().optional(),
});

export const createSubscriptionSchema = z.object({
  customer_id: z.coerce.number().int().positive('Customer ID is required'),
  plan_id: z.coerce.number().int().positive('Plan ID is required'),
  start_date: z.string().optional(),
  expiry_date: z.string().nullable().optional(),
  payment_terms: z.string().optional().default('immediate'),
  status: z.enum(['DRAFT', 'QUOTATION', 'CONFIRMED', 'ACTIVE', 'CLOSED']).optional().default('DRAFT'),
  lines: z.array(subscriptionLineSchema).min(1, 'At least one subscription line is required'),
});

export const updateSubscriptionSchema = z.object({
  customer_id: z.coerce.number().int().positive().optional(),
  plan_id: z.coerce.number().int().positive().optional(),
  start_date: z.string().optional(),
  expiry_date: z.string().nullable().optional(),
  payment_terms: z.string().optional(),
  lines: z.array(subscriptionLineSchema).optional(),
});

export const transitionStatusSchema = z.object({
  to_status: z.enum(['DRAFT', 'QUOTATION', 'CONFIRMED', 'ACTIVE', 'CLOSED'], {
    required_error: 'to_status is required',
  }),
  reason: z.string().optional(),
});

export type CreateQuotationTemplateInput = z.infer<typeof createQuotationTemplateSchema>;
export type UpdateQuotationTemplateInput = z.infer<typeof updateQuotationTemplateSchema>;
export type FromTemplateInput = z.infer<typeof fromTemplateSchema>;
export type SubscriptionLineInput = z.infer<typeof subscriptionLineSchema>;
export type CreateSubscriptionInput = z.input<typeof createSubscriptionSchema>;
export type UpdateSubscriptionInput = z.infer<typeof updateSubscriptionSchema>;
export type TransitionStatusInput = z.infer<typeof transitionStatusSchema>;
