import request from 'supertest';
import { createApp } from '../shared/app';
import { seedTestUser, deleteTestUser, generateToken, generateExpiredToken } from './helpers';
import { sql } from '../shared/db';
import type { SeededUser } from '../shared/db';

const app = createApp();

describe('Accounts API', () => {
  let adminUser: SeededUser;
  let adminToken: string;

  beforeAll(async () => {
    adminUser = await seedTestUser({ email: `user-admin-${Date.now()}@test.local` });
    adminToken = generateToken(adminUser.userId, 'admin', adminUser.email);
  });

  afterAll(async () => {
    await deleteTestUser(adminUser.userId);
  });

  describe('project manager role', () => {
    it('grants exactly staff permissions plus program management', async () => {
      const grants = await sql<{ role: string; permission: string }[]>`
        SELECT role.name AS role, permission.name AS permission
        FROM user_roles role
        INNER JOIN user_role_has_permissions grant_row ON grant_row.role_id = role.id
        INNER JOIN user_permissions permission ON permission.id = grant_row.permission_id
        WHERE role.name IN ('staff', 'project_manager')
      `;
      const staffPermissions = grants.filter(grant => grant.role === 'staff').map(grant => grant.permission);
      const managerPermissions = grants.filter(grant => grant.role === 'project_manager').map(grant => grant.permission);

      expect(staffPermissions.length).toBeGreaterThan(0);
      expect(managerPermissions.sort()).toEqual([...new Set([...staffPermissions, 'write:programs'])].sort());
    });

    it('lets administrators invite, filter and edit project managers without changing their role', async () => {
      const email = `invite-manager-${Date.now()}@test.local`;
      const created = await request(app).post('/api/accounts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ firstName: 'Project', lastName: 'Manager', email, role: 'project_manager' });

      expect(created.status).toBe(201);
      try {
        const listed = await request(app).get('/api/accounts')
          .query({ roles: 'project_manager', search: email })
          .set('Authorization', `Bearer ${adminToken}`);
        expect(listed.status).toBe(200);
        expect(listed.body).toEqual([expect.objectContaining({ id: created.body.id, role: 'project_manager' })]);

        const updated = await request(app).post('/api/accounts')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ id: created.body.id, firstName: 'Updated', lastName: 'Manager', email, role: 'project_manager' });
        expect(updated.status).toBe(201);
        expect(updated.body).toMatchObject({ firstName: 'Updated', role: 'project_manager' });
      } finally {
        await deleteTestUser(created.body.id);
      }
    });

    it('limits managers to youth account results and youth account management', async () => {
      const manager = await seedTestUser({ role: 'project_manager' });
      const youth = await seedTestUser({ role: 'youth' });
      const managerToken = generateToken(manager.userId, 'project_manager', manager.email);

      try {
        const listed = await request(app).get('/api/accounts')
          .set('Authorization', `Bearer ${managerToken}`);
        expect(listed.status).toBe(200);
        expect(listed.body.every((account: { role: string }) => account.role === 'youth')).toBe(true);

        const employeeResults = await request(app).get('/api/accounts')
          .query({ roles: 'admin,project_manager,staff' })
          .set('Authorization', `Bearer ${managerToken}`);
        expect(employeeResults.status).toBe(200);
        expect(employeeResults.body).toEqual([]);

        const youthStatus = await request(app).patch(`/api/accounts/${youth.userId}`)
          .set('Authorization', `Bearer ${managerToken}`);
        expect(youthStatus.status).toBe(200);
        expect(youthStatus.body.status).toBe('inactive');

        const employeeStatus = await request(app).patch(`/api/accounts/${manager.userId}`)
          .set('Authorization', `Bearer ${managerToken}`);
        expect(employeeStatus.status).toBe(403);

        for (const role of ['staff', 'project_manager', 'admin']) {
          const denied = await request(app).post('/api/accounts')
            .set('Authorization', `Bearer ${managerToken}`)
            .send({ firstName: 'Denied', lastName: 'Employee', email: `denied-${role}-${Date.now()}@test.local`, role });
          expect(denied.status).toBe(403);
        }

        const deniedEdit = await request(app).post('/api/accounts')
          .set('Authorization', `Bearer ${managerToken}`)
          .send({ id: manager.userId, firstName: 'Denied', lastName: 'Employee', email: manager.email, role: 'admin' });
        expect(deniedEdit.status).toBe(403);
      } finally {
        await deleteTestUser(youth.userId);
        await deleteTestUser(manager.userId);
      }
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // GET /api/accounts
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe('GET /api/accounts', () => {
    it('should require authentication', async () => {
      const res = await request(app).get('/api/accounts');
      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/token/i);
    });

    it('should return all accounts with a valid admin token', async () => {
      const res = await request(app)
        .get('/api/accounts')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    }, 30000);

    it('should filter accounts by search, role, and status', async () => {
      const filteredUser = await seedTestUser({
        email: `account-filter-${Date.now()}@test.local`,
        role: 'staff',
      });

      const res = await request(app)
        .get('/api/accounts')
        .query({ search: filteredUser.email, roles: 'staff', statuses: 'active' })
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0]).toMatchObject({ id: filteredUser.userId, role: 'staff', status: 'active' });

      await deleteTestUser(filteredUser.userId);
    });

    it('should support multiple role selections', async () => {
      const staffUser = await seedTestUser({ email: `multi-role-${Date.now()}@test.local`, role: 'staff' });

      const res = await request(app)
        .get('/api/accounts')
        .query({ roles: 'admin,staff' })
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.some((account: { id: string }) => account.id === adminUser.userId)).toBe(true);
      expect(res.body.some((account: { id: string }) => account.id === staffUser.userId)).toBe(true);
      expect(res.body.every((account: { role: string }) => ['admin', 'staff'].includes(account.role))).toBe(true);

      await deleteTestUser(staffUser.userId);
    });

    it('should filter by status independently', async () => {
      const inactiveUser = await seedTestUser({ email: `inactive-filter-${Date.now()}@test.local`, role: 'staff' });
      await sql`UPDATE user_credentials SET status = 'inactive' WHERE user_id = ${inactiveUser.userId}`;

      const res = await request(app)
        .get('/api/accounts')
        .query({ statuses: 'inactive' })
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.some((account: { id: string }) => account.id === inactiveUser.userId)).toBe(true);
      expect(res.body.every((account: { status: string }) => account.status === 'inactive')).toBe(true);

      await deleteTestUser(inactiveUser.userId);
    });

    it('should search partial names case-insensitively', async () => {
      const suffix = Date.now().toString().slice(-6);
      const namedUser = await seedTestUser({
        email: `partial-name-${suffix}@test.local`,
        firstName: `Quartz${suffix}`,
        lastName: 'Searchable',
        role: 'staff',
      });

      const res = await request(app)
        .get('/api/accounts')
        .query({ search: `quartz${suffix.slice(0, 3)}` })
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.map((account: { id: string }) => account.id)).toContain(namedUser.userId);

      await deleteTestUser(namedUser.userId);
    });

    it('should reject invalid account filter values', async () => {
      const res = await request(app)
        .get('/api/accounts')
        .query({ statuses: 'deleted' })
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/validation/i);
    });

    it('should reject invalid role filters', async () => {
      const res = await request(app)
        .get('/api/accounts')
        .query({ roles: 'owner' })
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/validation/i);
    });

    it('should return only youth accounts to staff', async () => {
      const staffUser = await seedTestUser({ email: `user-staff-${Date.now()}@test.local`, role: 'staff' });
      const youthUser = await seedTestUser({ email: `scoped-youth-${Date.now()}@test.local`, role: 'youth' });
      const staffToken = generateToken(staffUser.userId, 'staff', staffUser.email);

      const res = await request(app)
        .get('/api/accounts')
        .set('Authorization', `Bearer ${staffToken}`);
      expect(res.status).toBe(200);
      expect(res.body.some((account: { id: string }) => account.id === youthUser.userId)).toBe(true);
      expect(res.body.every((account: { role: string }) => account.role === 'youth')).toBe(true);

      await deleteTestUser(staffUser.userId);
      await deleteTestUser(youthUser.userId);
    });

    it('should never let a requested role broaden the staff account scope', async () => {
      const staffUser = await seedTestUser({ email: `scoped-staff-${Date.now()}@test.local`, role: 'staff' });
      const staffToken = generateToken(staffUser.userId, 'staff', staffUser.email);

      const res = await request(app)
        .get('/api/accounts')
        .query({ roles: 'admin,staff' })
        .set('Authorization', `Bearer ${staffToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);

      await deleteTestUser(staffUser.userId);
    });

    it('should reject youth access (403)', async () => {
      const youthUser = await seedTestUser({ email: `user-youth-${Date.now()}@test.local`, role: 'youth' });
      const youthToken = generateToken(youthUser.userId, 'youth', youthUser.email);

      const res = await request(app)
        .get('/api/accounts')
        .set('Authorization', `Bearer ${youthToken}`);
      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/permission/i);

      await deleteTestUser(youthUser.userId);
    });

    it('should reject expired access token (401)', async () => {
      const expiredToken = generateExpiredToken(adminUser.userId);

      const res = await request(app)
        .get('/api/accounts')
        .set('Authorization', `Bearer ${expiredToken}`);
      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/expired/i);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // POST /api/accounts
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe('POST /api/accounts', () => {
    const createdUserIds: string[] = [];

    afterAll(async () => {
      for (const id of createdUserIds) {
        await deleteTestUser(id);
      }
    });

    it('should require authentication', async () => {
      const res = await request(app)
        .post('/api/accounts')
        .send({ firstName: 'A', lastName: 'B', email: 'a@b.com', password: 'password123' });
      expect(res.status).toBe(401);
    });

    it('should create staff user with valid data (admin)', async () => {
      const uniqueEmail = `create-${Date.now()}@test.local`;
      const [program] = await sql<{ id: string }[]>`
        SELECT id FROM programs WHERE name = 'Drop In'
      `;
      const res = await request(app)
        .post('/api/accounts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          firstName: 'Created',
          lastName: 'User',
          email: uniqueEmail,
          password: 'password123',
          role: 'staff',
          programIds: [program.id],
          active: true,
        });

      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.email).toBe(uniqueEmail);
      expect(res.body.programIds).toEqual([program.id]);
      createdUserIds.push(res.body.id);
    });

    it('should reject missing firstName', async () => {
      const res = await request(app)
        .post('/api/accounts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ lastName: 'User', email: 'x@x.com', password: 'password123' });
      expect(res.status).toBe(400);
    });

    it('should reject missing lastName', async () => {
      const res = await request(app)
        .post('/api/accounts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ firstName: 'Test', email: 'x@x.com', password: 'password123' });
      expect(res.status).toBe(400);
    });

    it('should reject invalid email', async () => {
      const res = await request(app)
        .post('/api/accounts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ firstName: 'Test', lastName: 'User', email: 'not-email', password: 'password123' });
      expect(res.status).toBe(400);
    });

    it('should reject invalid role', async () => {
      const res = await request(app)
        .post('/api/accounts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ firstName: 'Test', lastName: 'User', email: 'x@x.com', role: 'youth' });
      expect(res.status).toBe(400);
    });

    it('should reject staff from creating staff (403)', async () => {
      const staffUser = await seedTestUser({ email: `create-staff-${Date.now()}@test.local`, role: 'staff' });
      const staffToken = generateToken(staffUser.userId, 'staff', staffUser.email);

      const res = await request(app)
        .post('/api/accounts')
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
        .post('/api/accounts')
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
        .post('/api/accounts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ firstName: 'First', lastName: 'User', email: dupeEmail, password: 'password123', role: 'staff', active: true });
      expect(firstRes.status).toBe(201);
      createdUserIds.push(firstRes.body.id);

      const dupeRes = await request(app)
        .post('/api/accounts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ firstName: 'Second', lastName: 'User', email: dupeEmail, password: 'password123', active: true });
      expect(dupeRes.status).toBe(409);
    });

    it('should reject expired access token', async () => {
      const expiredToken = generateExpiredToken(adminUser.userId);

      const res = await request(app)
        .post('/api/accounts')
        .set('Authorization', `Bearer ${expiredToken}`)
        .send({ firstName: 'Test', lastName: 'User', email: 'x@x.com', password: 'password123', active: true });
      expect(res.status).toBe(401);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // POST /api/accounts (UPDATE)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe('POST /api/accounts (UPDATE)', () => {
    let testStaffId: string;

    beforeAll(async () => {
      // Create a staff user to update
      const uniqueEmail = `update-staff-${Date.now()}@test.local`;
      const res = await request(app)
        .post('/api/accounts')
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

    it('should update an admin account with explicit program assignments', async () => {
      const [program] = await sql<{ id: string }[]>`
        SELECT id FROM programs WHERE enrollment_required = TRUE ORDER BY name LIMIT 1
      `;
      const res = await request(app)
        .post('/api/accounts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          id: testStaffId,
          firstName: 'Updated',
          lastName: 'Name',
          email: `updated-${Date.now()}@test.local`,
          role: 'admin',
          programIds: [program.id],
        });

      expect(res.status).toBe(201);
      expect(res.body.id).toBe(testStaffId);
      expect(res.body.firstName).toBe('Updated');
      expect(res.body.role).toBe('admin');
      expect(res.body.programIds).toEqual([program.id]);
    });

    it('should preserve admin program assignments when an update omits program IDs', async () => {
      const before = await request(app)
        .get('/api/accounts')
        .set('Authorization', `Bearer ${adminToken}`);
      const account = before.body.find((candidate: { id: string }) => candidate.id === testStaffId);

      const res = await request(app)
        .post('/api/accounts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          id: testStaffId,
          firstName: 'Updated Again',
          lastName: 'Name',
          email: account.email,
          role: 'admin',
        });

      expect(res.status).toBe(201);
      expect(res.body.programIds).toEqual(account.programIds);
    });

    it('should let admins replace a staff member program assignments', async () => {
      const email = `assigned-staff-${Date.now()}@test.local`;
      const created = await request(app)
        .post('/api/accounts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          firstName: 'Assigned',
          lastName: 'Staff',
          email,
          role: 'staff',
        });
      try {
        const programs = await sql<{ id: string }[]>`
          SELECT id
          FROM programs
          WHERE enrollment_required = TRUE
          ORDER BY name
          LIMIT 2
        `;
        expect(programs).toHaveLength(2);

        const updated = await request(app)
          .post('/api/accounts')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            id: created.body.id,
            firstName: 'Assigned',
            lastName: 'Staff',
            email,
            role: 'staff',
            programIds: programs.map(program => program.id),
          });

        expect(updated.status).toBe(201);
        expect(updated.body.programIds).toEqual(
          expect.arrayContaining(programs.map(program => program.id)),
        );
        expect(updated.body.programIds).toHaveLength(programs.length);
      } finally {
        await deleteTestUser(created.body.id);
      }
    });

    it('should reject update with invalid staff id', async () => {
      const res = await request(app)
        .post('/api/accounts')
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
        .post('/api/accounts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          firstName: 'Other',
          lastName: 'User',
          email: otherEmail,
          role: 'staff',
        });

      // Try to update first user with the other's email
      const res = await request(app)
        .post('/api/accounts')
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
        .post('/api/accounts')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          id: testStaffId,
          firstName: 'Updated',
          lastName: 'Name',
          email: `update-${Date.now()}@test.local`,
          programIds: [],
          role: 'staff',
        });

      expect(res.status).toBe(403);

      await deleteTestUser(staffUser.userId);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // DELETE /api/accounts/:id  (revoke pending invite — hard delete)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe('DELETE /api/accounts/:id', () => {
    it('should require authentication', async () => {
      const res = await request(app).delete('/api/accounts/00000000-0000-0000-0000-000000000000');
      expect(res.status).toBe(401);
    });

    it('should hard-delete a pending-invite staff user', async () => {
      const uniqueEmail = `delete-${Date.now()}@test.local`;
      const createRes = await request(app)
        .post('/api/accounts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ firstName: 'Delete', lastName: 'Me', email: uniqueEmail, role: 'staff' });

      expect(createRes.status).toBe(201);
      const staffId = createRes.body.id;

      const deleteRes = await request(app)
        .delete(`/api/accounts/${staffId}`)
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
        .delete(`/api/accounts/${activeUser.userId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/activated/i);

      await deleteTestUser(activeUser.userId);
    });

    it('should reject delete with invalid id', async () => {
      const res = await request(app)
        .delete('/api/accounts/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });

    it('should reject unauthorized staff from deleting', async () => {
      const staffUser = await seedTestUser({ email: `staff-delete-${Date.now()}@test.local`, role: 'staff' });
      const staffToken = generateToken(staffUser.userId, 'staff', staffUser.email);

      const res = await request(app)
        .delete(`/api/accounts/${staffUser.userId}`)
        .set('Authorization', `Bearer ${staffToken}`);

      expect(res.status).toBe(403);

      await deleteTestUser(staffUser.userId);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // PATCH /api/accounts/:id  (toggle active for real accounts)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe('PATCH /api/accounts/:id', () => {
    it('should require authentication', async () => {
      const res = await request(app).patch('/api/accounts/00000000-0000-0000-0000-000000000000');
      expect(res.status).toBe(401);
    });

    it('should deactivate an active staff user', async () => {
      const activeUser = await seedTestUser({ email: `toggle-${Date.now()}@test.local`, role: 'staff' });

      const res = await request(app)
        .patch(`/api/accounts/${activeUser.userId}`)
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
        .patch(`/api/accounts/${activeUser.userId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      // Then reactivate
      const res = await request(app)
        .patch(`/api/accounts/${activeUser.userId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('active');

      await deleteTestUser(activeUser.userId);
    });

    it('should reject PATCH on a pending-invite user', async () => {
      const uniqueEmail = `patch-invite-${Date.now()}@test.local`;
      const createRes = await request(app)
        .post('/api/accounts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ firstName: 'Pending', lastName: 'User', email: uniqueEmail, role: 'staff' });

      const staffId = createRes.body.id;

      const res = await request(app)
        .patch(`/api/accounts/${staffId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/pending invite/i);

      // Clean up
      await request(app)
        .delete(`/api/accounts/${staffId}`)
        .set('Authorization', `Bearer ${adminToken}`);
    });

    it('should reject invalid id', async () => {
      const res = await request(app)
        .patch('/api/accounts/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });

    it('should reject unauthorized staff from toggling active', async () => {
      const targetUser = await seedTestUser({ email: `patch-target-${Date.now()}@test.local`, role: 'staff' });
      const staffUser = await seedTestUser({ email: `patch-actor-${Date.now()}@test.local`, role: 'staff' });
      const staffToken = generateToken(staffUser.userId, 'staff', staffUser.email);

      const res = await request(app)
        .patch(`/api/accounts/${targetUser.userId}`)
        .set('Authorization', `Bearer ${staffToken}`);

      expect(res.status).toBe(403);

      await deleteTestUser(targetUser.userId);
      await deleteTestUser(staffUser.userId);
    });
  });
});
