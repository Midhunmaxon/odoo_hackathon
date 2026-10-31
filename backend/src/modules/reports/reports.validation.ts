import { z } from 'zod';

/**
 * Query-param schema for GET /api/reports/summary
 */
export const summaryQuerySchema = z.object({
  date_from: z.string().optional(),
  date_to: z.string().optional(),
  plan_id: z.coerce.number().int().positive().optional(),
  customer_id: z.coerce.number().int().positive().optional(),
});

export type SummaryQueryFilters = z.infer<typeof summaryQuerySchema>;

