import { z } from 'zod';

export const createPaymentBodySchema = z.object({
  invoice_id: z.coerce.number().int().positive('Invoice ID must be a positive integer'),
  amount: z.coerce.number().positive('Payment amount must be greater than 0'),
  method: z.string().min(1, 'Payment method is required'),
  date: z.string().optional(),
  paid_at: z.string().optional(),
  note: z.string().max(1000).optional(),
});

export const invoiceQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(10),
  sort: z.string().optional(),
  status: z.string().optional(),
  payment_status: z.enum(['paid', 'outstanding', 'overdue']).optional(),
  filter: z.enum(['paid', 'outstanding', 'overdue']).optional(),
  customer_id: z.coerce.number().int().positive().optional(),
  customer: z.coerce.number().int().positive().optional(),
  from_date: z.string().optional(),
  to_date: z.string().optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
  as_of_date: z.string().optional(),
});

export type CreatePaymentBodyInput = z.infer<typeof createPaymentBodySchema>;
export type InvoiceQueryInput = z.infer<typeof invoiceQuerySchema>;
