import request from 'supertest';
import { createApp } from '../shared/app';
import { seedTestUser, deleteTestUser } from '../shared/db';
import { generateToken, generateExpiredToken, deleteTestSchool } from './helpers';

const app = createApp();

const baseSchool = { name: 'Test Secondary School' };

describe('Schools API', () => {
  let adminUserId: string;
  let adminToken: string;

  beforeAll(async () => {
    const admin = await seedTestUser({ email: `schools-admin-${Date.now()}@test.local`, role: 'admin' });
    adminUserId = admin.userId;
    adminToken = generateToken(admin.userId, 'admin', admin.email);
  });

  afterAll(async () => {
    await deleteTestUser(adminUserId);
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // GET /api/schools
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe('GET /api/schools', () => {
    it('should require authentication', async () => {
      const res = await request(app).get('/api/schools');
      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/token/i);
    });

    it('should return schools list with valid admin token', async () => {
      const res = await request(app)
        .get('/api/schools')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    }, 30000);

    it('should allow staff access', async () => {
      const staff = await seedTestUser({ email: `schools-staff-get-${Date.now()}@test.local`, role: 'staff' });
      const staffToken = generateToken(staff.userId, 'staff', staff.email);

      const res = await request(app)
        .get('/api/schools')
        .set('Authorization', `Bearer ${staffToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);

      await deleteTestUser(staff.userId);
    });

    it('should reject youth user access (403)', async () => {
      const youth = await seedTestUser({ email: `schools-youth-get-${Date.now()}@test.local`, role: 'youth' });
      const youthToken = generateToken(youth.userId, 'youth', youth.email);

      const res = await request(app)
        .get('/api/schools')
        .set('Authorization', `Bearer ${youthToken}`);
      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/permission/i);

      await deleteTestUser(youth.userId);
    });

    it('should reject expired access token (401)', async () => {
      const expiredToken = generateExpiredToken(adminUserId);
      const res = await request(app)
        .get('/api/schools')
        .set('Authorization', `Bearer ${expiredToken}`);
      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/expired/i);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // POST /api/schools — create
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe('POST /api/schools — create', () => {
    const createdIds: string[] = [];

    afterAll(async () => {
      for (const id of createdIds) {
        await deleteTestSchool(id);
      }
    });

    it('should require authentication', async () => {
      const res = await request(app).post('/api/schools').send(baseSchool);
      expect(res.status).toBe(401);
    });

    it('should create school with name only (200)', async () => {
      const res = await request(app)
        .post('/api/schools')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: `Name-Only School ${Date.now()}` });
      expect(res.status).toBe(200);
      expect(res.body.id).toBeDefined();
      expect(res.body.name).toBeDefined();
      createdIds.push(res.body.id);
    });

    it('should create school with all optional fields (200)', async () => {
      const res = await request(app)
        .post('/api/schools')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: `Full School ${Date.now()}`,
          board: 'public',
          address: '100 School Road',
          postalCode: 'M1A 1A1',
        });
      expect(res.status).toBe(200);
      expect(res.body.id).toBeDefined();
      expect(res.body.board).toBe('public');
      expect(res.body.address).toBe('100 School Road');
      expect(res.body.postalCode).toBe('M1A 1A1');
      createdIds.push(res.body.id);
    });

    it('should create school with catholic board (200)', async () => {
      const res = await request(app)
        .post('/api/schools')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: `Catholic School ${Date.now()}`, board: 'catholic' });
      expect(res.status).toBe(200);
      expect(res.body.board).toBe('catholic');
      createdIds.push(res.body.id);
    });

    it('should allow staff with write:schools to create (200)', async () => {
      const staff = await seedTestUser({ email: `schools-staff-create-${Date.now()}@test.local`, role: 'staff' });
      const staffToken = generateToken(staff.userId, 'staff', staff.email);

      const res = await request(app)
        .post('/api/schools')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ name: `Staff Created School ${Date.now()}` });
      expect(res.status).toBe(200);
      expect(res.body.id).toBeDefined();
      createdIds.push(res.body.id);

      await deleteTestUser(staff.userId);
    });

    it('should reject missing name (400)', async () => {
      const res = await request(app)
        .post('/api/schools')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ board: 'public' });
      expect(res.status).toBe(400);
    });

    it('should reject empty name (400)', async () => {
      const res = await request(app)
        .post('/api/schools')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: '' });
      expect(res.status).toBe(400);
    });

    it('should reject name exceeding 200 characters (400)', async () => {
      const res = await request(app)
        .post('/api/schools')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'A'.repeat(201) });
      expect(res.status).toBe(400);
    });

    it('should reject invalid board value (400)', async () => {
      const res = await request(app)
        .post('/api/schools')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Test School', board: 'private' });
      expect(res.status).toBe(400);
    });

    it('should reject duplicate school name (409)', async () => {
      const name = `Duplicate School ${Date.now()}`;
      const first = await request(app)
        .post('/api/schools')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name });
      expect(first.status).toBe(200);
      createdIds.push(first.body.id);

      const second = await request(app)
        .post('/api/schools')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name });
      expect(second.status).toBe(409);
    });

    it('should reject youth user (403)', async () => {
      const youth = await seedTestUser({ email: `schools-youth-create-${Date.now()}@test.local`, role: 'youth' });
      const youthToken = generateToken(youth.userId, 'youth', youth.email);

      const res = await request(app)
        .post('/api/schools')
        .set('Authorization', `Bearer ${youthToken}`)
        .send(baseSchool);
      expect(res.status).toBe(403);

      await deleteTestUser(youth.userId);
    });

    it('should reject expired access token (401)', async () => {
      const expiredToken = generateExpiredToken(adminUserId);
      const res = await request(app)
        .post('/api/schools')
        .set('Authorization', `Bearer ${expiredToken}`)
        .send(baseSchool);
      expect(res.status).toBe(401);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // POST /api/schools — update (upsert with id)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe('POST /api/schools — update', () => {
    let schoolId: string;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/schools')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: `Update Target ${Date.now()}` });
      schoolId = res.body.id;
    });

    afterEach(async () => {
      await deleteTestSchool(schoolId);
    });

    it('should update school name (200)', async () => {
      const res = await request(app)
        .post('/api/schools')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ id: schoolId, name: 'Updated Name' });
      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Updated Name');
    });

    it('should update optional fields (200)', async () => {
      const res = await request(app)
        .post('/api/schools')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ id: schoolId, name: 'Updated Fields', board: 'catholic', address: '55 Oak Ave', postalCode: 'K1A 0A9' });
      expect(res.status).toBe(200);
      expect(res.body.board).toBe('catholic');
      expect(res.body.address).toBe('55 Oak Ave');
      expect(res.body.postalCode).toBe('K1A 0A9');
    });

    it('should clear optional fields when set to null (200)', async () => {
      // First set them
      await request(app)
        .post('/api/schools')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ id: schoolId, name: 'With Fields', board: 'public', address: '1 Main St' });

      // Then clear them
      const res = await request(app)
        .post('/api/schools')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ id: schoolId, name: 'With Fields', board: null, address: null });
      expect(res.status).toBe(200);
      expect(res.body.board).toBeNull();
      expect(res.body.address).toBeNull();
    });

    it('should reject update with nonexistent id (404)', async () => {
      const res = await request(app)
        .post('/api/schools')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ id: '00000000-0000-0000-0000-000000000000', name: 'Ghost School' });
      expect(res.status).toBe(404);
    });

    it('should reject name conflict on update (409)', async () => {
      const other = await request(app)
        .post('/api/schools')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: `Other School ${Date.now()}` });
      const otherId = other.body.id;

      const res = await request(app)
        .post('/api/schools')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ id: schoolId, name: other.body.name });
      expect(res.status).toBe(409);

      await deleteTestSchool(otherId);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // DELETE /api/schools/:id
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe('DELETE /api/schools/:id', () => {
    it('should require authentication', async () => {
      const res = await request(app).delete('/api/schools/00000000-0000-0000-0000-000000000000');
      expect(res.status).toBe(401);
    });

    it('should delete a school (200)', async () => {
      const created = await request(app)
        .post('/api/schools')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: `To Delete ${Date.now()}` });
      const schoolId = created.body.id;

      const res = await request(app)
        .delete(`/api/schools/${schoolId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should allow staff with write:schools to delete (200)', async () => {
      const staff = await seedTestUser({ email: `schools-staff-del-${Date.now()}@test.local`, role: 'staff' });
      const staffToken = generateToken(staff.userId, 'staff', staff.email);

      const created = await request(app)
        .post('/api/schools')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: `Staff Delete Target ${Date.now()}` });

      const res = await request(app)
        .delete(`/api/schools/${created.body.id}`)
        .set('Authorization', `Bearer ${staffToken}`);
      expect(res.status).toBe(200);

      await deleteTestUser(staff.userId);
    });

    it('should return 404 for nonexistent id', async () => {
      const res = await request(app)
        .delete('/api/schools/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(404);
    });

    it('should reject youth user (403)', async () => {
      const youth = await seedTestUser({ email: `schools-youth-del-${Date.now()}@test.local`, role: 'youth' });
      const youthToken = generateToken(youth.userId, 'youth', youth.email);

      const res = await request(app)
        .delete('/api/schools/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${youthToken}`);
      expect(res.status).toBe(403);

      await deleteTestUser(youth.userId);
    });

    it('should reject expired access token (401)', async () => {
      const expiredToken = generateExpiredToken(adminUserId);
      const res = await request(app)
        .delete('/api/schools/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${expiredToken}`);
      expect(res.status).toBe(401);
    });
  });
});
