import request from 'supertest';
import { createApp } from '../shared/app';
import { seedTestUser, deleteTestUser, generateToken, generateExpiredToken } from './helpers';
import { sql } from '../shared/db';
import type { SeededUser } from '../shared/db';

const app = createApp();

describe('User API', () => {
  let adminUser: SeededUser;
  let adminToken: string;

  beforeAll(async () => {
    adminUser = await seedTestUser({ email: `user-admin-${Date.now()}@test.local` });
    adminToken = generateToken(adminUser.userId, 'admin', adminUser.email);
  });

  afterAll(async () => {
    await deleteTestUser(adminUser.userId);
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // GET /api/users/all
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe('GET /api/users/all', () => {
    it('should require authentication', async () => {
      const res = await request(app).get('/api/users/all');
      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/token/i);
    });

    it('should return users list with valid admin token', async () => {
      const res = await request(app)
        .get('/api/users/all')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    }, 30000);

    it('should allow staff access', async () => {
      const staffUser = await seedTestUser({ email: `user-staff-${Date.now()}@test.local`, permission: 'staff' });
      const staffToken = generateToken(staffUser.userId, 'staff', staffUser.email);

      const res = await request(app)
        .get('/api/users/all')
        .set('Authorization', `Bearer ${staffToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);

      await deleteTestUser(staffUser.userId);
    });

    it('should reject youth access (403)', async () => {
      const youthUser = await seedTestUser({ email: `user-youth-${Date.now()}@test.local`, permission: 'youth' });
      const youthToken = generateToken(youthUser.userId, 'youth', youthUser.email);

      const res = await request(app)
        .get('/api/users/all')
        .set('Authorization', `Bearer ${youthToken}`);
      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/permission/i);

      await deleteTestUser(youthUser.userId);
    });

    it('should reject expired access token (401)', async () => {
      const expiredToken = generateExpiredToken(adminUser.userId);

      const res = await request(app)
        .get('/api/users/all')
        .set('Authorization', `Bearer ${expiredToken}`);
      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/expired/i);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // GET /api/users/ (root — same handler as /all)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe('GET /api/users/', () => {
    it('should require authentication', async () => {
      const res = await request(app).get('/api/users/');
      expect(res.status).toBe(401);
    });

    it('should return users list (same as /all)', async () => {
      const res = await request(app)
        .get('/api/users/')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // POST /api/users/
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe('POST /api/users/', () => {
    const createdUserIds: string[] = [];

    afterAll(async () => {
      for (const id of createdUserIds) {
        await deleteTestUser(id);
      }
    });

    it('should require authentication', async () => {
      const res = await request(app)
        .post('/api/users')
        .send({ firstName: 'A', lastName: 'B', email: 'a@b.com', password: 'password123' });
      expect(res.status).toBe(401);
    });

    it('should create user with valid data (admin)', async () => {
      const uniqueEmail = `create-${Date.now()}@test.local`;
      const res = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          firstName: 'Created',
          lastName: 'User',
          email: uniqueEmail,
          password: 'password123',
          permission: 'youth',
        });

      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.email).toBe(uniqueEmail);
      createdUserIds.push(res.body.id);
    });

    it('should reject missing firstName', async () => {
      const res = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ lastName: 'User', email: 'x@x.com', password: 'password123' });
      expect(res.status).toBe(400);
    });

    it('should reject missing lastName', async () => {
      const res = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ firstName: 'Test', email: 'x@x.com', password: 'password123' });
      expect(res.status).toBe(400);
    });

    it('should reject invalid email', async () => {
      const res = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ firstName: 'Test', lastName: 'User', email: 'not-email', password: 'password123' });
      expect(res.status).toBe(400);
    });

    it('should reject short password', async () => {
      const res = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ firstName: 'Test', lastName: 'User', email: 'x@x.com', password: 'short' });
      expect(res.status).toBe(400);
    });

    it('should reject staff from creating users (403)', async () => {
      const staffUser = await seedTestUser({ email: `create-staff-${Date.now()}@test.local`, permission: 'staff' });
      const staffToken = generateToken(staffUser.userId, 'staff', staffUser.email);

      const res = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          firstName: 'Blocked',
          lastName: 'User',
          email: `blocked-${Date.now()}@test.local`,
          password: 'password123',
        });
      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/permission/i);

      await deleteTestUser(staffUser.userId);
    });

    it('should reject youth from creating users (403)', async () => {
      const youthUser = await seedTestUser({ email: `create-youth-${Date.now()}@test.local`, permission: 'youth' });
      const youthToken = generateToken(youthUser.userId, 'youth', youthUser.email);

      const res = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${youthToken}`)
        .send({
          firstName: 'Blocked',
          lastName: 'User',
          email: `blocked-${Date.now()}@test.local`,
          password: 'password123',
        });
      expect(res.status).toBe(403);

      await deleteTestUser(youthUser.userId);
    });

    it('should reject duplicate email', async () => {
      // Create a user first
      const dupeEmail = `dupe-${Date.now()}@test.local`;
      const firstRes = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ firstName: 'First', lastName: 'User', email: dupeEmail, password: 'password123' });
      expect(firstRes.status).toBe(201);
      createdUserIds.push(firstRes.body.id);

      // Try the same email again
      const dupeRes = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ firstName: 'Second', lastName: 'User', email: dupeEmail, password: 'password123' });
      expect(dupeRes.status).toBe(500); // DB constraint violation → 500
    });

    it('should reject expired access token', async () => {
      const expiredToken = generateExpiredToken(adminUser.userId);

      const res = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${expiredToken}`)
        .send({ firstName: 'Test', lastName: 'User', email: 'x@x.com', password: 'password123' });
      expect(res.status).toBe(401);
    });
  });
});
