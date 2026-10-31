import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../app';
import { env } from '../config/env';
import { lastSentResetEmail } from '../modules/auth/email.service';
import { inMemoryUsers } from '../modules/auth/auth.service';
import crypto from 'crypto';

describe('Auth & Role Guards', () => {
  const adminToken = jwt.sign(
    { id: 1, email: 'admin@brightloop.com', role: 'ADMIN', name: 'Admin' },
    env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  const customerToken = jwt.sign(
    { id: 4, email: 'customer1@brightloop.com', role: 'CUSTOMER', name: 'Customer' },
    env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  it('GET /api/auth/me should reject requests without token with 401 UNAUTHORIZED', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('success', false);
    expect(res.body.error).toHaveProperty('code', 'UNAUTHORIZED');
  });

  it('GET /api/auth/me should reject malformed Authorization header with 401 UNAUTHORIZED', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'InvalidBearerFormat');
    expect(res.status).toBe(401);
    expect(res.body.error).toHaveProperty('code', 'UNAUTHORIZED');
  });

  it('GET /api/auth/me should reject expired token with 401 UNAUTHORIZED', async () => {
    const expiredToken = jwt.sign(
      { id: 1, email: 'admin@brightloop.com', role: 'ADMIN' },
      env.JWT_SECRET,
      { expiresIn: '-1s' }
    );
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${expiredToken}`);
    expect(res.status).toBe(401);
    expect(res.body.error.message).toMatch(/expired/i);
  });

  it('GET /api/auth/me should succeed with valid token', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('email', 'admin@brightloop.com');
    expect(res.body.data).toHaveProperty('role', 'ADMIN');
  });

  it('GET /api/users should allow ADMIN access', async () => {
    const res = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('total');
  });

  it('GET /api/users should forbid CUSTOMER access with 403 FORBIDDEN', async () => {
    const res = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${customerToken}`);
    expect(res.status).toBe(403);
    expect(res.body).toHaveProperty('success', false);
    expect(res.body.error).toHaveProperty('code', 'FORBIDDEN');
  });

  describe('Password Validation Rules', () => {
    it('POST /api/auth/signup should reject passwords with 8 characters or fewer (must be longer than 8)', async () => {
      // 8 characters
      const res8 = await request(app)
        .post('/api/auth/signup')
        .send({ email: 'rule1@brightloop.com', password: 'Pass12!a' });
      expect(res8.status).toBe(400);
      expect(res8.body.error.code).toBe('VALIDATION_ERROR');
      const messages8 = res8.body.error.details.map((d: any) => d.message);
      expect(messages8).toContain('Password must be longer than 8 characters');

      // 7 characters
      const res7 = await request(app)
        .post('/api/auth/signup')
        .send({ email: 'rule1b@brightloop.com', password: 'Pass1!a' });
      expect(res7.status).toBe(400);
      expect(res7.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('POST /api/auth/signup should reject passwords missing uppercase characters', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({ email: 'rule2@brightloop.com', password: 'lowercaseonly123!' });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      const messages = res.body.error.details.map((d: any) => d.message);
      expect(messages).toContain('Password must contain at least one uppercase letter');
    });

    it('POST /api/auth/signup should reject passwords missing lowercase characters', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({ email: 'rule3@brightloop.com', password: 'UPPERCASEONLY123!' });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      const messages = res.body.error.details.map((d: any) => d.message);
      expect(messages).toContain('Password must contain at least one lowercase letter');
    });

    it('POST /api/auth/signup should reject passwords missing special characters', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({ email: 'rule4@brightloop.com', password: 'NoSpecialChar123' });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      const messages = res.body.error.details.map((d: any) => d.message);
      expect(messages).toContain('Password must contain at least one special character');
    });

    it('POST /api/auth/signup should accept passwords satisfying all rules (longer than 8 chars, 1 upper, 1 lower, 1 special)', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({
          email: 'validuser@brightloop.com',
          password: 'StrongPassword123!',
          name: 'Valid User',
        });
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.role).toBe('CUSTOMER');
    });
  });

  describe('POST /api/auth/signup & Duplicate Email', () => {
    it('should return a clear 409 CONFLICT on duplicate email', async () => {
      const email = 'duplicate_test@brightloop.com';
      // First signup succeeds
      const firstRes = await request(app)
        .post('/api/auth/signup')
        .send({ email, password: 'SecurePassword123!', name: 'Original User' });
      expect(firstRes.status).toBe(201);
      expect(firstRes.body.data.email).toBe(email);
      expect(firstRes.body.data.role).toBe('CUSTOMER');

      // Duplicate signup with same email must return clear 409
      const dupRes = await request(app)
        .post('/api/auth/signup')
        .send({ email, password: 'SecurePassword123!', name: 'Copycat User' });
      expect(dupRes.status).toBe(409);
      expect(dupRes.body.success).toBe(false);
      expect(dupRes.body.error.code).toBe('CONFLICT');
      expect(dupRes.body.error.message).toMatch(/already exists|already registered/i);
    });

    it('should assign role CUSTOMER to new signups', async () => {
      const email = 'new_customer@brightloop.com';
      const res = await request(app)
        .post('/api/auth/signup')
        .send({ email, password: 'CustomerPassword999#' });
      expect(res.status).toBe(201);
      expect(res.body.data.role).toBe('CUSTOMER');
    });
  });

  describe('POST /api/auth/login', () => {
    it('should validate input with Zod', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'invalid-email', password: '' });
      expect(res.status).toBe(400);
      expect(res.body.error).toHaveProperty('code', 'VALIDATION_ERROR');
      expect(res.body.error).toHaveProperty('details');
    });

    it('should return a JWT containing id and role upon successful login', async () => {
      const email = 'logintest@brightloop.com';
      const password = 'LoginTestPassword123!';

      // Signup first
      await request(app).post('/api/auth/signup').send({ email, password });

      // Login
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email, password });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('token');
      expect(res.body.data).toHaveProperty('user');
      expect(res.body.data.user.role).toBe('CUSTOMER');

      // Verify the JWT payload contains id and role
      const decoded = jwt.verify(res.body.data.token, env.JWT_SECRET) as any;
      expect(decoded).toHaveProperty('id');
      expect(decoded).toHaveProperty('role', 'CUSTOMER');
      expect(decoded).toHaveProperty('email', email);
    });

    it('should reject login with wrong password with 401 UNAUTHORIZED', async () => {
      const email = 'admin@brightloop.com';
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email, password: 'WrongPassword123!' });
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should reject login with non-existent email with 401 UNAUTHORIZED', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'nonexistent@brightloop.com', password: 'SomePassword123!' });
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('POST /api/auth/forgot-password', () => {
    it('should return the same response whether or not the email exists', async () => {
      const existingEmail = 'admin@brightloop.com';
      const nonExistingEmail = 'ghost_user@brightloop.com';

      const resExisting = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: existingEmail });

      const resNonExisting = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: nonExistingEmail });

      expect(resExisting.status).toBe(200);
      expect(resNonExisting.status).toBe(200);
      expect(resExisting.body.success).toBe(true);
      expect(resNonExisting.body.success).toBe(true);
      expect(resExisting.body.message).toBe(resNonExisting.body.message);
    });

    it('should store only the token hash with 1-hour expiry and email the reset link', async () => {
      const email = 'forgot_target@brightloop.com';
      await request(app)
        .post('/api/auth/signup')
        .send({ email, password: 'InitialPassword123!' });

      const res = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email });

      expect(res.status).toBe(200);

      // Check last sent email captured
      expect(lastSentResetEmail).not.toBeNull();
      expect(lastSentResetEmail?.email).toBe(email);
      expect(lastSentResetEmail?.token).toBeDefined();

      const rawToken = lastSentResetEmail!.token;
      const expectedHash = crypto.createHash('sha256').update(rawToken).digest('hex');

      // Check user record in-memory store
      const user = inMemoryUsers.get(email);
      if (user) {
        expect(user.reset_token_hash).toBe(expectedHash);
        expect(user.reset_expires).toBeDefined();
        const expiresTime = new Date(user.reset_expires!).getTime();
        const now = Date.now();
        // Expiry should be approximately 1 hour (3600s) from now
        const diffMinutes = (expiresTime - now) / (1000 * 60);
        expect(diffMinutes).toBeGreaterThan(58);
        expect(diffMinutes).toBeLessThanOrEqual(60);
      }
    });
  });

  describe('POST /api/auth/reset-password', () => {
    it('should reset password with valid token, update password and invalidate the token', async () => {
      const email = 'reset_user@brightloop.com';
      const initialPassword = 'InitialPassword123!';
      const newPassword = 'BrandNewPassword999!';

      // 1. Signup
      await request(app).post('/api/auth/signup').send({ email, password: initialPassword });

      // 2. Forgot-password to generate token
      await request(app).post('/api/auth/forgot-password').send({ email });
      const rawToken = lastSentResetEmail!.token;

      // 3. Reset password
      const resetRes = await request(app)
        .post('/api/auth/reset-password')
        .send({ token: rawToken, password: newPassword });

      expect(resetRes.status).toBe(200);
      expect(resetRes.body.success).toBe(true);

      // 4. Invalidate token after use: reusing the same token should fail
      const reuseRes = await request(app)
        .post('/api/auth/reset-password')
        .send({ token: rawToken, password: 'AnotherPassword888!' });
      expect(reuseRes.status).toBe(400);
      expect(reuseRes.body.error.message).toMatch(/invalid or expired/i);

      // 5. Old password no longer works
      const oldLoginRes = await request(app)
        .post('/api/auth/login')
        .send({ email, password: initialPassword });
      expect(oldLoginRes.status).toBe(401);

      // 6. New password works
      const newLoginRes = await request(app)
        .post('/api/auth/login')
        .send({ email, password: newPassword });
      expect(newLoginRes.status).toBe(200);
      expect(newLoginRes.body.data).toHaveProperty('token');
    });

    it('should enforce password rules during reset-password', async () => {
      const email = 'enforce_rules@brightloop.com';
      await request(app).post('/api/auth/signup').send({ email, password: 'ValidOldPass123!' });
      await request(app).post('/api/auth/forgot-password').send({ email });
      const rawToken = lastSentResetEmail!.token;

      // Short password (<= 8)
      const resShort = await request(app)
        .post('/api/auth/reset-password')
        .send({ token: rawToken, password: 'Short1!' });
      expect(resShort.status).toBe(400);
      expect(resShort.body.error.code).toBe('VALIDATION_ERROR');

      // Missing uppercase
      const resNoUpper = await request(app)
        .post('/api/auth/reset-password')
        .send({ token: rawToken, password: 'nouppercase123!' });
      expect(resNoUpper.status).toBe(400);
      expect(resNoUpper.body.error.code).toBe('VALIDATION_ERROR');

      // Missing special char
      const resNoSpecial = await request(app)
        .post('/api/auth/reset-password')
        .send({ token: rawToken, password: 'NoSpecialChar123' });
      expect(resNoSpecial.status).toBe(400);
      expect(resNoSpecial.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject expired reset token with a clear error', async () => {
      const email = 'expired_token_user@brightloop.com';
      await request(app).post('/api/auth/signup').send({ email, password: 'InitialPass123!' });
      await request(app).post('/api/auth/forgot-password').send({ email });
      const rawToken = lastSentResetEmail!.token;

      // Manually set expiry to the past
      const user = inMemoryUsers.get(email);
      if (user) {
        user.reset_expires = new Date(Date.now() - 1000 * 60); // 1 minute in the past
      }

      const res = await request(app)
        .post('/api/auth/reset-password')
        .send({ token: rawToken, password: 'ValidNewPassword123!' });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toMatch(/expired/i);
    });

    it('should reject invalid non-existent reset token', async () => {
      const res = await request(app)
        .post('/api/auth/reset-password')
        .send({ token: 'nonexistent-token-value', password: 'ValidNewPassword123!' });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toMatch(/invalid or expired/i);
    });
  });

  describe('Direct /auth/* Route Aliases', () => {
    it('should support POST /auth/signup and POST /auth/login directly without /api prefix', async () => {
      const email = 'direct_route_user@brightloop.com';
      const password = 'DirectPassword123!';

      // POST /auth/signup
      const signupRes = await request(app)
        .post('/auth/signup')
        .send({ email, password, name: 'Direct User' });
      expect(signupRes.status).toBe(201);
      expect(signupRes.body.data.role).toBe('CUSTOMER');

      // POST /auth/login
      const loginRes = await request(app)
        .post('/auth/login')
        .send({ email, password });
      expect(loginRes.status).toBe(200);
      expect(loginRes.body.data).toHaveProperty('token');
      expect(loginRes.body.data.user.role).toBe('CUSTOMER');

      // POST /auth/forgot-password
      const forgotRes = await request(app)
        .post('/auth/forgot-password')
        .send({ email });
      expect(forgotRes.status).toBe(200);
      expect(forgotRes.body.success).toBe(true);
    });
  });
});
