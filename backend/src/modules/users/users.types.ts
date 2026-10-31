import { UserRole } from '../../middleware/auth.middleware';

/* =========================================================================
 * Database row interfaces
 * ========================================================================= */

export interface UserRow {
  id: number;
  email: string;
  password_hash: string;
  name: string;
  role: UserRole;
  is_active: boolean;
  reset_token_hash: string | null;
  reset_expires: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

/** Safe projection returned to callers – never includes password_hash */
export interface UserPublic {
  id: number;
  email: string;
  name: string;
  role: UserRole;
  is_active: boolean;
  created_at: Date | string;
  updated_at: Date | string;
}

/** The columns selected for list / single-user queries (no password_hash). */
export const USER_PUBLIC_COLUMNS = [
  'id',
  'email',
  'name',
  'role',
  'is_active',
  'created_at',
  'updated_at',
] as const;
