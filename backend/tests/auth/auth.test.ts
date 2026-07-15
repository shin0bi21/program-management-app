import request from 'supertest';
import { createApp } from '../shared/app';
import {
  seedTestUser,
  deleteTestUser,
  seedTrustedDeviceUser,
  get2FACode,
  insertExpired2FACode,
  generateAccessToken,
  generateRefreshToken,
  generateRefreshTokenWithoutJTI,
  storeRefreshToken,
  generateAndStoreRefreshToken,
  insertResetToken,
  insertExpiredResetToken,
  insertUsedResetToken,
  extractCookie,
  sql,
} from './helpers';
import type { SeededUser } from '../shared/db';

const app = createApp();

async function seedYouthAccount(participationStatus: 'active' | 'inactive', accountStatus: 'invited' | 'active' | 'inactive') {
  const user = await seedTestUser({
    email: `youth-auth-${Date.now()}-${Math.random().toString(36).slice(2)}@test.local`,
    role: 'youth',
  });
  await sql`
    INSERT INTO youth_profiles (user_id, status)
    VALUES (${user.userId}, ${participationStatus})
  `;
  await sql`
    UPDATE user_credentials
    SET status = ${accountStatus}
    WHERE user_id = ${user.userId}
  `;
  return user;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// LOGIN
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe('POST /api/auth/login', () => {
  let user: SeededUser;

  beforeAll(async () => {
    user = await seedTestUser();
  });

  afterAll(async () => {
    await deleteTestUser(user.userId);
  });

  // ── Validation ──────────────────────────────────────────────────
  describe('Validation', () => {
    it('should reject login without email', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ password: 'somepassword1' });
      expect(res.status).toBe(400);
      expect(res.body.error || res.body.errors).toBeDefined();
    });

    it('should reject login without password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com' });
      expect(res.status).toBe(400);
      expect(res.body.error || res.body.errors).toBeDefined();
    });

    it('should reject invalid email format', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'not-an-email', password: 'password123' });
      expect(res.status).toBe(400);
      expect(res.body.error || res.body.errors).toBeDefined();
    });

    it('should reject password shorter than 8 characters', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'short' });
      expect(res.status).toBe(400);
      expect(res.body.error || res.body.errors).toBeDefined();
    });
  });

  // ── Authentication ──────────────────────────────────────────────
  describe('Authentication', () => {
    it('should reject nonexistent email', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'nonexistent@example.com', password: 'wrongpass1' });
      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/invalid/i);
    });

    it('should reject wrong password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: user.email, password: 'WrongPass99!' });
      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/invalid/i);
    });

    it('should successfully login and require 2FA', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: user.email, password: user.password });
      expect(res.status).toBe(200);
      expect(res.body.requires2FA).toBe(true);
      expect(res.body.userId).toBe(user.userId);
      expect(res.body.message).toMatch(/2FA code sent/i);
    });
  });

  // ── Account Lockout ─────────────────────────────────────────────
  describe('Account Lockout', () => {
    let lockoutUser: SeededUser;

    beforeAll(async () => {
      lockoutUser = await seedTestUser({ email: `lockout-${Date.now()}@test.local` });
    });

    afterAll(async () => {
      await deleteTestUser(lockoutUser.userId);
    });

    it('should lock account after 5 failed login attempts', async () => {
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/auth/login')
          .send({ email: lockoutUser.email, password: 'WrongPass99!' });
      }

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: lockoutUser.email, password: 'WrongPass99!' });
      expect(res.status).toBe(423);
      expect(res.body.error).toMatch(/locked/i);
    });

    it('should remain locked even with correct password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: lockoutUser.email, password: lockoutUser.password });
      expect(res.status).toBe(423);
      expect(res.body.error).toMatch(/locked/i);
    });
  });

  // ── Trusted Device Bypass ───────────────────────────────────────
  describe('Trusted Device Bypass', () => {
    let trustedUser: SeededUser;
    let deviceFingerprint: string;

    beforeAll(async () => {
      const result = await seedTrustedDeviceUser('trusted-login');
      trustedUser = result.user;
      deviceFingerprint = result.deviceFingerprint;
    });

    afterAll(async () => {
      await deleteTestUser(trustedUser.userId);
    });

    it('should skip 2FA and return tokens when device is trusted', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: trustedUser.email,
          password: trustedUser.password,
          deviceFingerprint,
        });

      expect(res.status).toBe(200);
      expect(res.body.requires2FA).toBeUndefined();
      expect(res.body.token).toBeDefined();
      expect(res.body.message).toMatch(/trusted device/i);
      expect(res.body.user.id).toBe(trustedUser.userId);

      const refreshCookie = extractCookie(res.headers, 'refreshToken');
      expect(refreshCookie).toBeDefined();
    });
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// VERIFY 2FA
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe('POST /api/auth/verify', () => {
  describe('Validation', () => {
    it('should reject invalid userId format', async () => {
      const res = await request(app)
        .post('/api/auth/verify')
        .send({ userId: 'not-a-uuid', code: '123456' });
      expect(res.status).toBe(400);
    });

    it('should reject code shorter than 6 digits', async () => {
      const res = await request(app)
        .post('/api/auth/verify')
        .send({ userId: '550e8400-e29b-41d4-a716-446655440001', code: '12345' });
      expect(res.status).toBe(400);
    });

    it('should reject non-numeric code', async () => {
      const res = await request(app)
        .post('/api/auth/verify')
        .send({ userId: '550e8400-e29b-41d4-a716-446655440001', code: 'ABCDEF' });
      expect(res.status).toBe(400);
    });
  });

  describe('Happy Path', () => {
    let user: SeededUser;

    beforeAll(async () => {
      user = await seedTestUser({ email: `verify-hp-${Date.now()}@test.local` });
    });

    afterAll(async () => {
      await deleteTestUser(user.userId);
    });

    it('should verify valid 2FA code and return tokens', async () => {
      // Login to trigger 2FA
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: user.email, password: user.password });
      expect(loginRes.status).toBe(200);

      // Pull code from DB
      const code = await get2FACode(user.userId);
      expect(code).not.toBeNull();

      // Verify code
      const verifyRes = await request(app)
        .post('/api/auth/verify')
        .send({ userId: user.userId, code });

      expect(verifyRes.status).toBe(200);
      expect(verifyRes.body.token).toBeDefined();
      expect(verifyRes.body.user.id).toBe(user.userId);
      expect(verifyRes.body.message).toMatch(/login successful/i);

      const refreshCookie = extractCookie(verifyRes.headers, 'refreshToken');
      expect(refreshCookie).toBeDefined();
    });
  });

  describe('Edge Cases', () => {
    let user: SeededUser;

    beforeAll(async () => {
      user = await seedTestUser({ email: `verify-edge-${Date.now()}@test.local` });
    });

    afterAll(async () => {
      await deleteTestUser(user.userId);
    });

    it('should reject wrong code', async () => {
      await request(app).post('/api/auth/login').send({ email: user.email, password: user.password });

      const res = await request(app)
        .post('/api/auth/verify')
        .send({ userId: user.userId, code: '000000' });
      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/invalid|expired/i);
    });

    it('should reject expired 2FA code', async () => {
      await insertExpired2FACode(user.userId, '888888');

      const res = await request(app)
        .post('/api/auth/verify')
        .send({ userId: user.userId, code: '888888' });
      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/invalid|expired/i);
    });

    it('should reject code for nonexistent user', async () => {
      const res = await request(app)
        .post('/api/auth/verify')
        .send({ userId: '00000000-0000-4000-a000-000000000000', code: '123456' });
      expect(res.status).toBe(401);
    });

    it('should reject an already-used code', async () => {
      await request(app).post('/api/auth/login').send({ email: user.email, password: user.password });
      const code = await get2FACode(user.userId);
      expect(code).not.toBeNull();

      // Use once
      await request(app).post('/api/auth/verify').send({ userId: user.userId, code });
      // Reuse — should fail
      const res = await request(app).post('/api/auth/verify').send({ userId: user.userId, code });
      expect(res.status).toBe(401);
    });
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// RESEND 2FA
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe('POST /api/auth/resend', () => {
  describe('Validation', () => {
    it('should reject invalid userId', async () => {
      const res = await request(app).post('/api/auth/resend').send({ userId: 'not-a-uuid' });
      expect(res.status).toBe(400);
    });
  });

  describe('Happy Path', () => {
    let user: SeededUser;

    beforeAll(async () => {
      user = await seedTestUser({ email: `resend-hp-${Date.now()}@test.local` });
    });

    afterAll(async () => {
      await deleteTestUser(user.userId);
    });

    it('should resend 2FA code for valid user', async () => {
      const res = await request(app).post('/api/auth/resend').send({ userId: user.userId });
      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/code sent/i);
    });
  });

  describe('Edge Cases', () => {
    it('should return 404 for nonexistent user', async () => {
      const res = await request(app)
        .post('/api/auth/resend')
        .send({ userId: '00000000-0000-4000-a000-000000000000' });
      expect(res.status).toBe(404);
      expect(res.body.error).toMatch(/not found/i);
    });
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// REFRESH TOKEN
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe('POST /api/auth/refresh', () => {
  describe('Validation', () => {
    it('should reject refresh without cookie', async () => {
      const res = await request(app).post('/api/auth/refresh');
      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/token/i);
    });

    it('should reject invalid refresh token', async () => {
      const res = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', ['refreshToken=invalid.token.here']);
      expect(res.status).toBe(403);
    });
  });

  describe('Happy Path', () => {
    let user: SeededUser;

    beforeAll(async () => {
      user = await seedTestUser({ email: `refresh-hp-${Date.now()}@test.local` });
    });

    afterAll(async () => {
      await deleteTestUser(user.userId);
    });

    it('should rotate tokens and return new access token', async () => {
      const { token, jti } = generateRefreshToken(user.userId, user.email);
      await storeRefreshToken(user.userId, jti, token);

      const res = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', [`refreshToken=${token}`]);

      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();

      const refreshCookie = extractCookie(res.headers, 'refreshToken');
      expect(refreshCookie).toBeDefined();
    });
  });

  describe('Token Reuse Detection', () => {
    let user: SeededUser;

    beforeAll(async () => {
      user = await seedTestUser({ email: `refresh-reuse-${Date.now()}@test.local` });
    });

    afterAll(async () => {
      await deleteTestUser(user.userId);
    });

    it('should revoke entire token family on reuse', async () => {
      const { token, jti } = generateRefreshToken(user.userId, user.email);
      await storeRefreshToken(user.userId, jti, token);

      // First use — succeeds
      const firstRes = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', [`refreshToken=${token}`]);
      expect(firstRes.status).toBe(200);

      // Second use of same token — reuse detected
      const reuseRes = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', [`refreshToken=${token}`]);
      expect(reuseRes.status).toBe(403);
      expect(reuseRes.body.error).toMatch(/reuse|revoked|invalid/i);
    });
  });

  describe('Edge Cases', () => {
    let user: SeededUser;

    beforeAll(async () => {
      user = await seedTestUser({ email: `refresh-edge-${Date.now()}@test.local` });
    });

    afterAll(async () => {
      await deleteTestUser(user.userId);
    });

    it('should reject refresh token without JTI (old format)', async () => {
      const token = generateRefreshTokenWithoutJTI(user.userId, user.email);

      const res = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', [`refreshToken=${token}`]);
      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/invalid|format/i);
    });

    it('should reject refresh token not stored in DB', async () => {
      const { token } = generateRefreshToken(user.userId, user.email);

      const res = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', [`refreshToken=${token}`]);
      expect(res.status).toBe(403);
    });
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// LOGOUT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe('POST /api/auth/logout', () => {
  describe('Basic', () => {
    it('should succeed even without any tokens', async () => {
      const res = await request(app).post('/api/auth/logout');
      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/logged out/i);
    });

    it('should clear refreshToken cookie', async () => {
      const res = await request(app).post('/api/auth/logout');
      expect(res.status).toBe(200);
      const cookies = res.headers['set-cookie'];
      if (cookies && Array.isArray(cookies)) {
        expect(cookies.some((c: string) => c.includes('refreshToken='))).toBe(true);
      }
    });
  });

  describe('Access Token Blacklisting', () => {
    let user: SeededUser;

    beforeAll(async () => {
      user = await seedTestUser({ email: `logout-at-${Date.now()}@test.local` });
    });

    afterAll(async () => {
      await deleteTestUser(user.userId);
    });

    it('should blacklist access token on logout', async () => {
      const accessToken = generateAccessToken(user.userId, user.email);

      const logoutRes = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`);
      expect(logoutRes.status).toBe(200);

      // Token should now be rejected on protected route
      const protectedRes = await request(app)
        .get('/api/staff')
        .set('Authorization', `Bearer ${accessToken}`);
      expect(protectedRes.status).toBe(401);
      expect(protectedRes.body.error).toMatch(/revoked/i);
    });
  });

  describe('Refresh Token Revoking', () => {
    let user: SeededUser;

    beforeAll(async () => {
      user = await seedTestUser({ email: `logout-rt-${Date.now()}@test.local` });
    });

    afterAll(async () => {
      await deleteTestUser(user.userId);
    });

    it('should revoke refresh token on logout', async () => {
      const refreshToken = await generateAndStoreRefreshToken(user.userId, user.email);

      const logoutRes = await request(app)
        .post('/api/auth/logout')
        .set('Cookie', [`refreshToken=${refreshToken}`]);
      expect(logoutRes.status).toBe(200);

      // Refresh should now fail
      const refreshRes = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', [`refreshToken=${refreshToken}`]);
      expect(refreshRes.status).toBe(403);
    });
  });

  describe('Both Tokens', () => {
    let user: SeededUser;

    beforeAll(async () => {
      user = await seedTestUser({ email: `logout-both-${Date.now()}@test.local` });
    });

    afterAll(async () => {
      await deleteTestUser(user.userId);
    });

    it('should blacklist access token AND revoke refresh token', async () => {
      const accessToken = generateAccessToken(user.userId, user.email);
      const refreshToken = await generateAndStoreRefreshToken(user.userId, user.email);

      const logoutRes = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('Cookie', [`refreshToken=${refreshToken}`]);
      expect(logoutRes.status).toBe(200);

      // Access token rejected
      const protectedRes = await request(app)
        .get('/api/staff')
        .set('Authorization', `Bearer ${accessToken}`);
      expect(protectedRes.status).toBe(401);

      // Refresh token rejected
      const refreshRes = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', [`refreshToken=${refreshToken}`]);
      expect(refreshRes.status).toBe(403);
    });
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// FORGOT PASSWORD
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe('POST /api/auth/forgot-password', () => {
  let user: SeededUser;

  beforeAll(async () => {
    user = await seedTestUser({ email: `forgot-${Date.now()}@test.local` });
  });

  afterAll(async () => {
    await deleteTestUser(user.userId);
  });

  it('should accept valid email and return success', async () => {
    const res = await request(app).post('/api/auth/forgot-password').send({ email: user.email });
    expect(res.status).toBe(200);
    expect(res.body.message).toBeDefined();
  });

  it('should not reveal if email exists (security)', async () => {
    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'nonexistent@example.com' });
    expect(res.status).toBe(200);
    expect(res.body.message).toBeDefined();
  });

  it('should reject invalid email format', async () => {
    const res = await request(app).post('/api/auth/forgot-password').send({ email: 'not-an-email' });
    expect(res.status).toBe(400);
  });

  it('should reject missing email', async () => {
    const res = await request(app).post('/api/auth/forgot-password').send({});
    expect(res.status).toBe(400);
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// RESET PASSWORD
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe('POST /api/auth/reset-password', () => {
  describe('Validation', () => {
    it('should reject missing token', async () => {
      const res = await request(app)
        .post('/api/auth/reset-password')
        .send({ newPassword: 'newpassword123' });
      expect(res.status).toBe(400);
    });

    it('should reject missing password', async () => {
      const res = await request(app)
        .post('/api/auth/reset-password')
        .send({ token: 'some-token' });
      expect(res.status).toBe(400);
    });

    it('should reject short password', async () => {
      const res = await request(app)
        .post('/api/auth/reset-password')
        .send({ token: 'some-token', newPassword: 'short' });
      expect(res.status).toBe(400);
    });

    it('should reject invalid (non-matching) token', async () => {
      const res = await request(app)
        .post('/api/auth/reset-password')
        .send({ token: 'deadbeef'.repeat(8), newPassword: 'newpassword123' });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/invalid|expired/i);
    });
  });

  describe('Happy Path', () => {
    let user: SeededUser;

    beforeAll(async () => {
      user = await seedTestUser({ email: `reset-hp-${Date.now()}@test.local` });
    });

    afterAll(async () => {
      await deleteTestUser(user.userId);
    });

    it('should reset password with valid token, then login with new password', async () => {
      const rawToken = await insertResetToken(user.userId);
      const newPassword = 'BrandNewPass456!';

      const resetRes = await request(app)
        .post('/api/auth/reset-password')
        .send({ token: rawToken, newPassword });
      expect(resetRes.status).toBe(200);
      expect(resetRes.body.message).toMatch(/password reset successful/i);

      // Login with new password — should work
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: user.email, password: newPassword });
      expect(loginRes.status).toBe(200);
      expect(loginRes.body.requires2FA).toBe(true);

      // Login with old password — should fail
      const oldLoginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: user.email, password: user.password });
      expect(oldLoginRes.status).toBe(401);
    });
  });

  describe('Edge Cases', () => {
    let user: SeededUser;

    beforeAll(async () => {
      user = await seedTestUser({ email: `reset-edge-${Date.now()}@test.local` });
    });

    afterAll(async () => {
      await deleteTestUser(user.userId);
    });

    it('should reject expired reset token', async () => {
      const rawToken = await insertExpiredResetToken(user.userId);

      const res = await request(app)
        .post('/api/auth/reset-password')
        .send({ token: rawToken, newPassword: 'newpassword123' });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/invalid|expired/i);
    });

    it('should reject already-used reset token', async () => {
      const rawToken = await insertUsedResetToken(user.userId);

      const res = await request(app)
        .post('/api/auth/reset-password')
        .send({ token: rawToken, newPassword: 'newpassword123' });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/invalid|expired/i);
    });
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// YOUTH ACCOUNT LIFECYCLE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe('Youth account lifecycle', () => {
  it('should allow an active youth account to authenticate when participation is inactive', async () => {
    const user = await seedYouthAccount('inactive', 'active');

    try {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: user.email, password: user.password });

      expect(res.status).toBe(200);
      expect(res.body.requires2FA).toBe(true);

      const [profile] = await sql<{ status: string }[]>`
        SELECT status FROM youth_profiles WHERE user_id = ${user.userId}
      `;
      expect(profile.status).toBe('inactive');
    } finally {
      await deleteTestUser(user.userId);
    }
  });

  it('should reject an inactive youth account when participation is active', async () => {
    const user = await seedYouthAccount('active', 'inactive');

    try {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: user.email, password: user.password });

      expect(res.status).toBe(403);

      const [profile] = await sql<{ status: string }[]>`
        SELECT status FROM youth_profiles WHERE user_id = ${user.userId}
      `;
      expect(profile.status).toBe('active');
    } finally {
      await deleteTestUser(user.userId);
    }
  });

  it('should activate invited youth credentials after password setup without changing participation', async () => {
    const user = await seedYouthAccount('inactive', 'invited');

    try {
      const beforeLogin = await request(app)
        .post('/api/auth/login')
        .send({ email: user.email, password: user.password });
      expect(beforeLogin.status).toBe(403);

      const rawToken = await insertResetToken(user.userId);
      const newPassword = 'YouthNewPassword456!';
      const resetRes = await request(app)
        .post('/api/auth/reset-password')
        .send({ token: rawToken, newPassword });
      expect(resetRes.status).toBe(200);

      const [states] = await sql<{ accountStatus: string; participationStatus: string }[]>`
        SELECT uc.status AS account_status, yp.status AS participation_status
        FROM user_credentials uc
        INNER JOIN youth_profiles yp ON yp.user_id = uc.user_id
        WHERE uc.user_id = ${user.userId}
      `;
      expect(states.accountStatus).toBe('active');
      expect(states.participationStatus).toBe('inactive');

      const afterLogin = await request(app)
        .post('/api/auth/login')
        .send({ email: user.email, password: newPassword });
      expect(afterLogin.status).toBe(200);
      expect(afterLogin.body.requires2FA).toBe(true);
    } finally {
      await deleteTestUser(user.userId);
    }
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// FULL FLOW: login → 2FA → protected route → refresh → logout → verify revoked
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe('Full Auth Flow', () => {
  let user: SeededUser;

  beforeAll(async () => {
    user = await seedTestUser({ email: `flow-${Date.now()}@test.local` });
  });

  afterAll(async () => {
    await deleteTestUser(user.userId);
  });

  it('login → 2FA → protected route → refresh → logout → verify revoked', async () => {
    // 1. Login
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: user.password });
    expect(loginRes.status).toBe(200);
    expect(loginRes.body.requires2FA).toBe(true);

    // 2. Verify 2FA
    const code = await get2FACode(user.userId);
    expect(code).not.toBeNull();

    const verifyRes = await request(app)
      .post('/api/auth/verify')
      .send({ userId: user.userId, code });
    expect(verifyRes.status).toBe(200);

    const accessToken = verifyRes.body.token;
    const refreshToken = extractCookie(verifyRes.headers, 'refreshToken');
    expect(accessToken).toBeDefined();
    expect(refreshToken).toBeDefined();

    // 3. Access protected route
    const protectedRes = await request(app)
      .get('/api/staff')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(protectedRes.status).toBe(200);
    expect(Array.isArray(protectedRes.body)).toBe(true);

    // 4. Refresh tokens
    const refreshRes = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', [`refreshToken=${refreshToken}`]);
    expect(refreshRes.status).toBe(200);

    const newAccessToken = refreshRes.body.token;
    const newRefreshToken = extractCookie(refreshRes.headers, 'refreshToken');
    expect(newAccessToken).toBeDefined();
    expect(newRefreshToken).toBeDefined();

    // New access token works
    const protectedRes2 = await request(app)
      .get('/api/staff')
      .set('Authorization', `Bearer ${newAccessToken}`);
    expect(protectedRes2.status).toBe(200);

    // Old refresh token no longer works (rotated)
    const oldRefreshRes = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', [`refreshToken=${refreshToken}`]);
    expect(oldRefreshRes.status).toBe(403);

    // 5. Logout
    const logoutRes = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${newAccessToken}`)
      .set('Cookie', [`refreshToken=${newRefreshToken}`]);
    expect(logoutRes.status).toBe(200);

    // 6. Verify everything is revoked
    const revokedAccessRes = await request(app)
      .get('/api/staff')
      .set('Authorization', `Bearer ${newAccessToken}`);
    expect(revokedAccessRes.status).toBe(401);

    const revokedRefreshRes = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', [`refreshToken=${newRefreshToken}`]);
    expect(revokedRefreshRes.status).toBe(403);
  }, 30000);
});
