import { z } from 'zod';
import { passwordSchema } from '../auth/auth.validation';

/* =========================================================================
 * Shared helpers
 * ========================================================================= */

/** Coerce string id param to a positive integer. */
export const idParamSchema = z.object({
  id: z.coerce.number().int().positive('id must be a positive integer'),
});

/* =========================================================================
 * POST /users/staff  – Admin creates a STAFF account
 * ========================================================================= */

export const createStaffSchema = z.object({
  email: z.string({ required_error: 'Email is required' }).email('Invalid email address'),
  password: passwordSchema,
  name: z.string({ required_error: 'Name is required' }).min(1, 'Name cannot be empty'),
});

export type CreateStaffInput = z.infer<typeof createStaffSchema>;

/* =========================================================================
 * PATCH /me  – Authenticated user updates own profile
 * ========================================================================= */

export const updateMeSchema = z.object({
  name: z.string().min(1, 'Name cannot be empty').optional(),
  email: z.string().email('Invalid email address').optional(),
});

/** Refined version used at runtime to ensure at least one field is present. */
export const updateMeRefinedSchema = updateMeSchema.refine(
  (data) => Object.keys(data).length > 0,
  { message: 'At least one field must be provided for update' }
);

export type UpdateMeInput = z.infer<typeof updateMeSchema>;

/* =========================================================================
 * PATCH /users/:id/deactivate  – Admin deactivates a user
 * ========================================================================= */

export const deactivateUserSchema = z.object({
  is_active: z.literal(false, {
    errorMap: () => ({ message: 'is_active must be false' }),
  }),
});

export type DeactivateUserInput = z.infer<typeof deactivateUserSchema>;
