import { z } from 'zod';

export const runBillingSchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be formatted as YYYY-MM-DD')
    .optional(),
  batchSize: z.coerce.number().int().positive().optional().default(50),
});

export const invoiceIdParamSchema = z.object({
  id: z.coerce.number().int().positive('Invoice ID must be a positive integer'),
});

export const createPaymentSchema = z.object({
  amount: z.coerce.number().positive('Payment amount must be greater than 0'),
  method: z.enum(['CREDIT_CARD', 'BANK_TRANSFER', 'CASH', 'OTHER']).default('CREDIT_CARD'),
  note: z.string().max(500).optional(),
});

export type RunBillingInput = z.infer<typeof runBillingSchema>;
export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;

