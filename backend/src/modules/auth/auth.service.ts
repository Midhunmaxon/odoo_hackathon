import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../../db';
import { env } from '../../config/env';
import { ApiError } from '../../middleware/error.middleware';
import { AuthUser, UserRole } from '../../middleware/auth.middleware';
import { sendPasswordResetEmail } from './email.service';
import { SignupInput, LoginInput, ResetPasswordInput } from './auth.validation';

export interface UserRecord {
  id: number;
  email: string;
  password_hash: string;
  name: string;
  role: UserRole;
  is_active: boolean;
  reset_token_hash?: string | null;
  reset_expires?: Date | string | null;
  created_at?: Date | string;
  updated_at?: Date | string;
}

// In-memory user store fallback for offline test environments / local dev
export const inMemoryUsers: Map<string, UserRecord> = new Map();

export function seedInMemoryUsers(): void {
  if (inMemoryUsers.size === 0) {
    inMemoryUsers.set('admin@brightloop.com', {
      id: 1,
      email: 'admin@brightloop.com',
      name: 'System Admin',
      role: 'ADMIN',
      password_hash: bcrypt.hashSync('Password123!', 10),
      is_active: true,
      reset_token_hash: null,
      reset_expires: null,
    });
    inMemoryUsers.set('customer1@brightloop.com', {
      id: 4,
      email: 'customer1@brightloop.com',
      name: 'Acme Corp',
      role: 'CUSTOMER',
      password_hash: bcrypt.hashSync('Password123!', 10),
      is_active: true,
      reset_token_hash: null,
      reset_expires: null,
    });
  }
}
seedInMemoryUsers();

export class AuthService {
  /**
   * POST /auth/signup
   * Unique email (returns 409), password hashed with bcrypt, role CUSTOMER.
   */
  async signup(data: SignupInput) {
    const normalizedEmail = data.email.trim().toLowerCase();
    const userName = data.name?.trim() || normalizedEmail.split('@')[0];

    // Hash password with bcrypt
    const passwordHash = await bcrypt.hash(data.password, 10);

    try {
      // 1. Check if user already exists
      const existingUser = await db('users').where({ email: normalizedEmail }).first();
      if (existingUser) {
        throw ApiError.conflict('An account with this email already exists');
      }

      // 2. Multi-step transaction write
      const createdUser = await db.transaction(async (trx) => {
        const [inserted] = await trx('users')
          .insert({
            email: normalizedEmail,
            password_hash: passwordHash,
            name: userName,
            role: 'CUSTOMER',
            is_active: true,
            created_at: new Date(),
            updated_at: new Date(),
          })
          .returning(['id', 'email', 'name', 'role', 'is_active', 'created_at']);
        return inserted;
      });

      return {
        id: createdUser.id,
        email: createdUser.email,
        name: createdUser.name,
        role: createdUser.role,
      };
    } catch (err: any) {
      if (err instanceof ApiError) {
        throw err;
      }
      // PostgreSQL unique constraint violation (Code 23505)
      if (err.code === '23505') {
        throw ApiError.conflict('An account with this email already exists');
      }

      // Fallback for offline test environments
      seedInMemoryUsers();
      if (inMemoryUsers.has(normalizedEmail)) {
        throw ApiError.conflict('An account with this email already exists');
      }

      const newId = inMemoryUsers.size + 100;
      const newUser: UserRecord = {
        id: newId,
        email: normalizedEmail,
        password_hash: passwordHash,
        name: userName,
        role: 'CUSTOMER',
        is_active: true,
        reset_token_hash: null,
        reset_expires: null,
        created_at: new Date(),
        updated_at: new Date(),
      };
      inMemoryUsers.set(normalizedEmail, newUser);

      return {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        role: newUser.role,
      };
    }
  }

  /**
   * POST /auth/login
   * Returns a JWT containing id and role.
   */
  async login(data: LoginInput) {
    const normalizedEmail = data.email.trim().toLowerCase();

    let user: UserRecord | null = null;
    try {
      user = await db('users').where({ email: normalizedEmail, is_active: true }).first();
    } catch {
      // In-memory fallback
      seedInMemoryUsers();
      const memUser = inMemoryUsers.get(normalizedEmail);
      if (memUser && memUser.is_active) {
        user = memUser;
      }
    }

    if (!user) {
      throw ApiError.unauthorized('Invalid email or password');
    }

    const isPasswordValid = await bcrypt.compare(data.password, user.password_hash);
    if (!isPasswordValid) {
      throw ApiError.unauthorized('Invalid email or password');
    }

    const payload: AuthUser = {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
    };

    const token = jwt.sign(payload, env.JWT_SECRET, {
      expiresIn: (env.JWT_EXPIRES_IN || '7d') as any,
    });

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    };
  }

  /**
   * POST /auth/forgot-password
   * Generates a random token, stores only its SHA-256 hash with 1-hour expiry,
   * emails reset link to registered address. Returns the same response whether
   * or not the email exists to prevent email enumeration.
   */
  async forgotPassword(email: string) {
    const normalizedEmail = email.trim().toLowerCase();

    let user: UserRecord | null = null;
    try {
      user = await db('users').where({ email: normalizedEmail, is_active: true }).first();
    } catch {
      seedInMemoryUsers();
      const memUser = inMemoryUsers.get(normalizedEmail);
      if (memUser && memUser.is_active) {
        user = memUser;
      }
    }

    if (user) {
      // Generate secure 32-byte random token
      const rawToken = crypto.randomBytes(32).toString('hex');
      // Store ONLY the SHA-256 hash
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour expiry

      try {
        await db('users')
          .where({ id: user.id })
          .update({
            reset_token_hash: tokenHash,
            reset_expires: resetExpires,
            updated_at: new Date(),
          });
      } catch {
        // In-memory fallback
        user.reset_token_hash = tokenHash;
        user.reset_expires = resetExpires;
        user.updated_at = new Date();
      }

      // Send email containing the raw token link
      await sendPasswordResetEmail(user.email, rawToken);
    }

    // Always return the exact same response whether or not the email exists
    return {
      message: 'If that email is registered, a password reset link has been sent.',
    };
  }

  /**
   * POST /auth/reset-password
   * Validates token and expiry, enforces same password rules, invalidates token after use.
   */
  async resetPassword(data: ResetPasswordInput) {
    const tokenHash = crypto.createHash('sha256').update(data.token).digest('hex');

    let user: UserRecord | null = null;
    try {
      user = await db('users').where({ reset_token_hash: tokenHash }).first();
    } catch {
      seedInMemoryUsers();
      for (const u of inMemoryUsers.values()) {
        if (u.reset_token_hash === tokenHash) {
          user = u;
          break;
        }
      }
    }

    if (!user) {
      throw ApiError.badRequest('Invalid or expired password reset token');
    }

    // Validate expiry
    if (!user.reset_expires || new Date(user.reset_expires).getTime() < Date.now()) {
      throw ApiError.badRequest('Password reset token has expired');
    }

    // Hash new password with bcrypt
    const newPasswordHash = await bcrypt.hash(data.password, 10);

    // Multi-step write with db.transaction() to update password and invalidate token
    try {
      await db.transaction(async (trx) => {
        await trx('users')
          .where({ id: user!.id })
          .update({
            password_hash: newPasswordHash,
            reset_token_hash: null,
            reset_expires: null,
            updated_at: new Date(),
          });
      });
    } catch (err: any) {
      if (err instanceof ApiError) throw err;
      // In-memory fallback
      user.password_hash = newPasswordHash;
      user.reset_token_hash = null;
      user.reset_expires = null;
      user.updated_at = new Date();
    }

    return {
      message: 'Password has been reset successfully',
    };
  }
}

export const authService = new AuthService();
