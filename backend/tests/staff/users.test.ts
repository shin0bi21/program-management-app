import request from 'supertest';
import { createApp } from '../shared/app';
import { seedTestUser, deleteTestUser, generateToken, generateExpiredToken } from './helpers';
import { sql } from '../shared/db';
import type { SeededUser } from '../shared/db';

const app = createApp();

describe('Staff API', () => {
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
  // GET /api/staff
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe('GET /api/staff', () => {
    it('should require authentication', async () => {
      const res = await request(app).get('/api/staff');
      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/token/i);
    });

    it('should return staff list with valid admin token', async () => {
      const res = await request(app)
        .get('/api/staff')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    }, 30000);

    it('should reject staff access (403)', async () => {
      const staffUser = await seedTestUser({ email: `user-staff-${Date.now()}@test.local`, role: 'staff' });
      const staffToken = generateToken(staffUser.userId, 'staff', staffUser.email);

      const res = await request(app)
        .get('/api/staff')
        .set('Authorization', `Bearer ${staffToken}`);
      expect(res.status).toBe(403);

      await deleteTestUser(staffUser.userId);
    });

    it('should reject youth access (403)', async () => {
      const youthUser = await seedTestUser({ email: `user-youth-${Date.now()}@test.local`, role: 'youth' });
      const youthToken = generateToken(youthUser.userId, 'youth', youthUser.email);

      const res = await request(app)
        .get('/api/staff')
        .set('Authorization', `Bearer ${youthToken}`);
      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/permission/i);

      await deleteTestUser(youthUser.userId);
    });

    it('should reject expired access token (401)', async () => {
      const expiredToken = generateExpiredToken(adminUser.userId);

      const res = await request(app)
        .get('/api/staff')
        .set('Authorization', `Bearer ${expiredToken}`);
      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/expired/i);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // POST /api/staff
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe('POST /api/staff', () => {
    const createdUserIds: string[] = [];

    afterAll(async () => {
      for (const id of createdUserIds) {
        await deleteTestUser(id);
      }
    });

    it('should require authentication', async () => {
      const res = await request(app)
        .post('/api/staff')
        .send({ firstName: 'A', lastName: 'B', email: 'a@b.com', password: 'password123' });
      expect(res.status).toBe(401);
    });

    it('should create staff user with valid data (admin)', async () => {
      const uniqueEmail = `create-${Date.now()}@test.local`;
      const res = await request(app)
        .post('/api/staff')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          firstName: 'Created',
          lastName: 'User',
          email: uniqueEmail,
          password: 'password123',
          role: 'staff',
          active: true,
        });

      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.email).toBe(uniqueEmail);
      createdUserIds.push(res.body.id);
    });

    it('should reject missing firstName', async () => {
      const res = await request(app)
        .post('/api/staff')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ lastName: 'User', email: 'x@x.com', password: 'password123' });
      expect(res.status).toBe(400);
    });

    it('should reject missing lastName', async () => {
      const res = await request(app)
        .post('/api/staff')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ firstName: 'Test', email: 'x@x.com', password: 'password123' });
      expect(res.status).toBe(400);
    });

    it('should reject invalid email', async () => {
      const res = await request(app)
        .post('/api/staff')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ firstName: 'Test', lastName: 'User', email: 'not-email', password: 'password123' });
      expect(res.status).toBe(400);
    });

    it('should reject invalid role', async () => {
      const res = await request(app)
        .post('/api/staff')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ firstName: 'Test', lastName: 'User', email: 'x@x.com', role: 'youth' });
      expect(res.status).toBe(400);
    });

    it('should reject staff from creating staff (403)', async () => {
      const staffUser = await seedTestUser({ email: `create-staff-${Date.now()}@test.local`, role: 'staff' });
      const staffToken = generateToken(staffUser.userId, 'staff', staffUser.email);

      const res = await request(app)
        .post('/api/staff')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          firstName: 'Blocked',
          lastName: 'User',
          email: `blocked-${Date.now()}@test.local`,
          password: 'password123',
          active: true,
        });
      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/permission/i);

      await deleteTestUser(staffUser.userId);
    });

    it('should reject youth from creating staff (403)', async () => {
      const youthUser = await seedTestUser({ email: `create-youth-${Date.now()}@test.local`, role: 'youth' });
      const youthToken = generateToken(youthUser.userId, 'youth', youthUser.email);

      const res = await request(app)
        .post('/api/staff')
        .set('Authorization', `Bearer ${youthToken}`)
        .send({
          firstName: 'Blocked',
          lastName: 'User',
          email: `blocked-${Date.now()}@test.local`,
          password: 'password123',
          active: true,
        });
      expect(res.status).toBe(403);

      await deleteTestUser(youthUser.userId);
    });

    it('should reject duplicate email', async () => {
      const dupeEmail = `dupe-${Date.now()}@test.local`;
      const firstRes = await request(app)
        .post('/api/staff')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ firstName: 'First', lastName: 'User', email: dupeEmail, password: 'password123', role: 'staff', active: true });
      expect(firstRes.status).toBe(201);
      createdUserIds.push(firstRes.body.id);

      const dupeRes = await request(app)
        .post('/api/staff')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ firstName: 'Second', lastName: 'User', email: dupeEmail, password: 'password123', active: true });
      expect(dupeRes.status).toBe(409);
    });

    it('should reject expired access token', async () => {
      const expiredToken = generateExpiredToken(adminUser.userId);

      const res = await request(app)
        .post('/api/staff')
        .set('Authorization', `Bearer ${expiredToken}`)
        .send({ firstName: 'Test', lastName: 'User', email: 'x@x.com', password: 'password123', active: true });
      expect(res.status).toBe(401);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // POST /api/staff (UPDATE)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe('POST /api/staff (UPDATE)', () => {
    let testStaffUser: SeededUser;
    let testStaffId: string;

    beforeAll(async () => {
      // Create a staff user to update
      const uniqueEmail = `update-staff-${Date.now()}@test.local`;
      const res = await request(app)
        .post('/api/staff')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          firstName: 'Original',
          lastName: 'Name',
          email: uniqueEmail,
          role: 'staff',
        });
      testStaffId = res.body.id;
    });

    afterAll(async () => {
      if (testStaffId) await deleteTestUser(testStaffId);
    });

    it('should update staff user with valid data', async () => {
      const res = await request(app)
        .post('/api/staff')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          id: testStaffId,
          firstName: 'Updated',
          lastName: 'Name',
          email: `updated-${Date.now()}@test.local`,
          role: 'admin',
        });

      expect(res.status).toBe(201);
      expect(res.body.id).toBe(testStaffId);
      expect(res.body.firstName).toBe('Updated');
      expect(res.body.role).toBe('admin');
    });

    it('should reject update with invalid staff id', async () => {
      const res = await request(app)
        .post('/api/staff')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          id: '00000000-0000-0000-0000-000000000000',
          firstName: 'Test',
          lastName: 'User',
          email: 'test@test.local',
          role: 'staff',
        });

      expect(res.status).toBe(404);
    });

    it('should reject email conflict on update', async () => {
      // Create another staff user
      const otherEmail = `other-${Date.now()}@test.local`;
      const otherRes = await request(app)
        .post('/api/staff')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          firstName: 'Other',
          lastName: 'User',
          email: otherEmail,
          role: 'staff',
        });

      // Try to update first user with the other's email
      const res = await request(app)
        .post('/api/staff')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          id: testStaffId,
          firstName: 'Updated',
          lastName: 'Name',
          email: otherEmail,
          role: 'staff',
        });

      expect(res.status).toBe(409);
      expect(res.body.error).toMatch(/email already exists/i);

      await deleteTestUser(otherRes.body.id);
    });

    it('should reject unauthorized staff from updating', async () => {
      const staffUser = await seedTestUser({ email: `staff-update-${Date.now()}@test.local`, role: 'staff' });
      const staffToken = generateToken(staffUser.userId, 'staff', staffUser.email);

      const res = await request(app)
        .post('/api/staff')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          id: testStaffId,
          firstName: 'Updated',
          lastName: 'Name',
          email: `update-${Date.now()}@test.local`,
          role: 'staff',
        });

      expect(res.status).toBe(403);

      await deleteTestUser(staffUser.userId);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // DELETE /api/staff/:id  (revoke pending invite — hard delete)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe('DELETE /api/staff/:id', () => {
    it('should require authentication', async () => {
      const res = await request(app).delete('/api/staff/00000000-0000-0000-0000-000000000000');
      expect(res.status).toBe(401);
    });

    it('should hard-delete a pending-invite staff user', async () => {
      const uniqueEmail = `delete-${Date.now()}@test.local`;
      const createRes = await request(app)
        .post('/api/staff')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ firstName: 'Delete', lastName: 'Me', email: uniqueEmail, role: 'staff' });

      expect(createRes.status).toBe(201);
      const staffId = createRes.body.id;

      const deleteRes = await request(app)
        .delete(`/api/staff/${staffId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(deleteRes.status).toBe(200);

      // User should be completely removed from the database
      const dbCheck = await sql`SELECT id FROM users WHERE id = ${staffId}`;
      expect(dbCheck.length).toBe(0);
    });

    it('should reject DELETE on an activated account (use PATCH instead)', async () => {
      // Seed an active user (active=true, no pending token)
      const activeUser = await seedTestUser({ email: `active-delete-${Date.now()}@test.local`, role: 'staff' });

      const res = await request(app)
        .delete(`/api/staff/${activeUser.userId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/activated/i);

      await deleteTestUser(activeUser.userId);
    });

    it('should reject delete with invalid id', async () => {
      const res = await request(app)
        .delete('/api/staff/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });

    it('should reject unauthorized staff from deleting', async () => {
      const staffUser = await seedTestUser({ email: `staff-delete-${Date.now()}@test.local`, role: 'staff' });
      const staffToken = generateToken(staffUser.userId, 'staff', staffUser.email);

      const res = await request(app)
        .delete(`/api/staff/${staffUser.userId}`)
        .set('Authorization', `Bearer ${staffToken}`);

      expect(res.status).toBe(403);

      await deleteTestUser(staffUser.userId);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // PATCH /api/staff/:id  (toggle active for real accounts)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe('PATCH /api/staff/:id', () => {
    it('should require authentication', async () => {
      const res = await request(app).patch('/api/staff/00000000-0000-0000-0000-000000000000');
      expect(res.status).toBe(401);
    });

    it('should deactivate an active staff user', async () => {
      const activeUser = await seedTestUser({ email: `toggle-${Date.now()}@test.local`, role: 'staff' });

      const res = await request(app)
        .patch(`/api/staff/${activeUser.userId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('inactive');
      expect(res.body.id).toBe(activeUser.userId);

      await deleteTestUser(activeUser.userId);
    });

    it('should reactivate an inactive staff user', async () => {
      const activeUser = await seedTestUser({ email: `toggle2-${Date.now()}@test.local`, role: 'staff' });

      // First deactivate
      await request(app)
        .patch(`/api/staff/${activeUser.userId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      // Then reactivate
      const res = await request(app)
        .patch(`/api/staff/${activeUser.userId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('active');

      await deleteTestUser(activeUser.userId);
    });

    it('should reject PATCH on a pending-invite user', async () => {
      const uniqueEmail = `patch-invite-${Date.now()}@test.local`;
      const createRes = await request(app)
        .post('/api/staff')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ firstName: 'Pending', lastName: 'User', email: uniqueEmail, role: 'staff' });

      const staffId = createRes.body.id;

      const res = await request(app)
        .patch(`/api/staff/${staffId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/pending invite/i);

      // Clean up
      await request(app)
        .delete(`/api/staff/${staffId}`)
        .set('Authorization', `Bearer ${adminToken}`);
    });

    it('should reject invalid id', async () => {
      const res = await request(app)
        .patch('/api/staff/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });

    it('should reject unauthorized staff from toggling active', async () => {
      const targetUser = await seedTestUser({ email: `patch-target-${Date.now()}@test.local`, role: 'staff' });
      const staffUser = await seedTestUser({ email: `patch-actor-${Date.now()}@test.local`, role: 'staff' });
      const staffToken = generateToken(staffUser.userId, 'staff', staffUser.email);

      const res = await request(app)
        .patch(`/api/staff/${targetUser.userId}`)
        .set('Authorization', `Bearer ${staffToken}`);

      expect(res.status).toBe(403);

      await deleteTestUser(targetUser.userId);
      await deleteTestUser(staffUser.userId);
    });
  });
});
