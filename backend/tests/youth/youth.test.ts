import request from 'supertest';
import { createApp } from '../shared/app';
import { seedTestUser, deleteTestUser, sql } from '../shared/db';
import { generateToken, generateExpiredToken, deleteTestYouth } from './helpers';

const app = createApp();

// ─── Minimal valid youth payload ─────────────────────────────────────────────
const baseYouth = {
  firstName: 'Jamie',
  lastName: 'Test',
};

describe('Youth API', () => {
  let adminUserId: string;
  let adminToken: string;
  let softSkillsProgramId: string;
  let softSkillsCohortId: string;

  beforeAll(async () => {
    const admin = await seedTestUser({ email: `youth-admin-${Date.now()}@test.local`, role: 'admin' });
    adminUserId = admin.userId;
    adminToken = generateToken(admin.userId, 'admin', admin.email);
    const [program] = await sql<{ id: string }[]>`SELECT id FROM programs WHERE name = 'Soft Skills'`;
    softSkillsProgramId = program.id;
    const [cohort] = await sql<{ id: string }[]>`
      INSERT INTO program_cohorts (program_id, name, starts_on, ends_on)
      VALUES (${softSkillsProgramId}, ${`Youth Test ${Date.now()}`}, CURRENT_DATE - 30, CURRENT_DATE + 30)
      RETURNING id
    `;
    softSkillsCohortId = cohort.id;
  });

  afterAll(async () => {
    await sql`DELETE FROM program_cohorts WHERE id = ${softSkillsCohortId}`;
    await deleteTestUser(adminUserId);
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // GET /api/youth
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe('GET /api/youth', () => {
    it('should require authentication', async () => {
      const res = await request(app).get('/api/youth');
      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/token/i);
    });

    it('should return youth list with valid admin token', async () => {
      const res = await request(app)
        .get('/api/youth')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    }, 30000);

    it('should allow staff access', async () => {
      const staff = await seedTestUser({ email: `youth-staff-${Date.now()}@test.local`, role: 'staff' });
      const staffToken = generateToken(staff.userId, 'staff', staff.email);

      const res = await request(app)
        .get('/api/youth')
        .set('Authorization', `Bearer ${staffToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);

      await deleteTestUser(staff.userId);
    });

    it('should reject youth user access (403)', async () => {
      const youth = await seedTestUser({ email: `youth-user-${Date.now()}@test.local`, role: 'youth' });
      const youthToken = generateToken(youth.userId, 'youth', youth.email);

      const res = await request(app)
        .get('/api/youth')
        .set('Authorization', `Bearer ${youthToken}`);
      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/permission/i);

      await deleteTestUser(youth.userId);
    });

    it('should reject expired access token (401)', async () => {
      const expiredToken = generateExpiredToken(adminUserId);
      const res = await request(app)
        .get('/api/youth')
        .set('Authorization', `Bearer ${expiredToken}`);
      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/expired/i);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // POST /api/youth (Create)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe('POST /api/youth — create', () => {
    const createdIds: string[] = [];

    afterAll(async () => {
      for (const id of createdIds) {
        await deleteTestYouth(id);
      }
    });

    it('should require authentication', async () => {
      const res = await request(app).post('/api/youth').send(baseYouth);
      expect(res.status).toBe(401);
    });

    it('should create youth with required fields only (201)', async () => {
      const res = await request(app)
        .post('/api/youth')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(baseYouth);
      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      createdIds.push(res.body.id);
    });

    it('should create youth with optional fields (201)', async () => {
      const res = await request(app)
        .post('/api/youth')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          ...baseYouth,
          firstName: 'Jordan',
          dateOfBirth: '2012-06-15',
          gradeLevel: 7,
          notes: 'Needs transportation support',
        });
      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.cohorts).toEqual([]);
      expect(res.body.notes).toBe('Needs transportation support');
      await sql`
        INSERT INTO cohort_enrollments (cohort_id, youth_id, enrolled_on)
        VALUES (
          ${softSkillsCohortId},
          ${res.body.id},
          (NOW() AT TIME ZONE 'America/Toronto')::date
        )
      `;
      createdIds.push(res.body.id);
    });

    it('should filter youth by program UUID', async () => {
      const res = await request(app)
        .get(`/api/youth?programIds=${softSkillsProgramId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(expect.arrayContaining([
        expect.objectContaining({
          firstName: 'Jordan',
          cohorts: expect.arrayContaining([
            expect.objectContaining({ id: softSkillsCohortId, programId: softSkillsProgramId }),
          ]),
        }),
      ]));
      expect(res.body.every((profile: { cohorts: Array<{ programId: string }> }) =>
        profile.cohorts.some(cohort => cohort.programId === softSkillsProgramId)
      )).toBe(true);
    });

    it('should filter youth by cohort UUID', async () => {
      const res = await request(app)
        .get(`/api/youth?cohortIds=${softSkillsCohortId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(expect.arrayContaining([
        expect.objectContaining({
          firstName: 'Jordan',
          cohorts: expect.arrayContaining([
            expect.objectContaining({ id: softSkillsCohortId }),
          ]),
        }),
      ]));
      expect(res.body.every((profile: { cohorts: Array<{ id: string }> }) =>
        profile.cohorts.some(cohort => cohort.id === softSkillsCohortId)
      )).toBe(true);
    });

    it('should derive and filter active status from current cohort enrollment', async () => {
      const res = await request(app)
        .get('/api/youth?statuses=active')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(expect.arrayContaining([
        expect.objectContaining({ firstName: 'Jordan', status: 'active' }),
      ]));
      expect(res.body.every((profile: { status: string }) => profile.status === 'active')).toBe(true);
    });

    it('should create and invite a youth account when email is provided', async () => {
      const email = `new-youth-account-${Date.now()}@test.local`;
      const res = await request(app)
        .post('/api/youth')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ...baseYouth, firstName: 'Invited', email });

      expect(res.status).toBe(201);
      expect(res.body.account).toEqual({ email, status: 'invited' });
      createdIds.push(res.body.id);
    });

    it('should create youth with addresses (201)', async () => {
      const res = await request(app)
        .post('/api/youth')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          ...baseYouth,
          firstName: 'Alex',
          addresses: [
            { address: '123 Main St' },
          ],
        });
      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      createdIds.push(res.body.id);
    });

    it('should create youth with contacts (201)', async () => {
      const res = await request(app)
        .post('/api/youth')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          ...baseYouth,
          firstName: 'Morgan',
          contacts: [
            { phoneNumber: '4165551234', type: 'parent' },
          ],
        });
      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      createdIds.push(res.body.id);
    });

    it('should allow staff to create youth (201)', async () => {
      const staff = await seedTestUser({ email: `youth-create-staff-${Date.now()}@test.local`, role: 'staff' });
      const staffToken = generateToken(staff.userId, 'staff', staff.email);

      const res = await request(app)
        .post('/api/youth')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ ...baseYouth, firstName: 'StaffCreated' });
      expect(res.status).toBe(201);
      createdIds.push(res.body.id);

      await deleteTestUser(staff.userId);
    });

    it('should reject missing firstName (400)', async () => {
      const res = await request(app)
        .post('/api/youth')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ lastName: 'Test', status: 'active' });
      expect(res.status).toBe(400);
    });

    it('should reject missing lastName (400)', async () => {
      const res = await request(app)
        .post('/api/youth')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ firstName: 'Test', status: 'active' });
      expect(res.status).toBe(400);
    });

    it('should derive no active cohort for a newly created youth', async () => {
      const res = await request(app)
        .post('/api/youth')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ firstName: 'Test', lastName: 'User' });
      expect(res.status).toBe(201);
      expect(res.body.status).toBe('inactive');
      createdIds.push(res.body.id);
    });

    it('should reject invalid dateOfBirth format (400)', async () => {
      const res = await request(app)
        .post('/api/youth')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ...baseYouth, dateOfBirth: '15-06-2012' });
      expect(res.status).toBe(400);
    });

    it('should reject an invalid login email (400)', async () => {
      const res = await request(app)
        .post('/api/youth')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ...baseYouth, email: 'not-an-email' });
      expect(res.status).toBe(400);
    });

    it('should reject gradeLevel above 12 (400)', async () => {
      const res = await request(app)
        .post('/api/youth')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ...baseYouth, gradeLevel: 13 });
      expect(res.status).toBe(400);
    });

    it('should reject gradeLevel below 0 (400)', async () => {
      const res = await request(app)
        .post('/api/youth')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ...baseYouth, gradeLevel: -1 });
      expect(res.status).toBe(400);
    });

    it('should reject youth user from creating (403)', async () => {
      const youth = await seedTestUser({ email: `youth-create-block-${Date.now()}@test.local`, role: 'youth' });
      const youthToken = generateToken(youth.userId, 'youth', youth.email);

      const res = await request(app)
        .post('/api/youth')
        .set('Authorization', `Bearer ${youthToken}`)
        .send(baseYouth);
      expect(res.status).toBe(403);

      await deleteTestUser(youth.userId);
    });

    it('should reject expired access token (401)', async () => {
      const expiredToken = generateExpiredToken(adminUserId);
      const res = await request(app)
        .post('/api/youth')
        .set('Authorization', `Bearer ${expiredToken}`)
        .send(baseYouth);
      expect(res.status).toBe(401);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // GET /api/youth?id=uuid
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe('GET /api/youth?id=uuid', () => {
    let youthId: string;

    beforeAll(async () => {
      const res = await request(app)
        .post('/api/youth')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ...baseYouth, firstName: 'GetById' });
      youthId = res.body.id;
    });

    afterAll(async () => {
      await deleteTestYouth(youthId);
    });

    it('should return single youth profile by id (200)', async () => {
      const res = await request(app)
        .get(`/api/youth?id=${youthId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body).not.toBeNull();
      expect(res.body.id).toBe(youthId);
      expect(res.body.firstName).toBe('GetById');
      expect(res.body.lastAttendedOn).toBeNull();
    });

    it('should return the latest session date marked present or late', async () => {
      const sessions = await sql<{ id: string; sessionDate: string }[]>`
        INSERT INTO cohort_sessions (cohort_id, theme, starts_at, ends_at)
        VALUES
          (
            ${softSkillsCohortId},
            ${`Attendance Test ${Date.now()}`},
            (CURRENT_DATE - 2 + TIME '17:00') AT TIME ZONE 'America/Toronto',
            (CURRENT_DATE - 2 + TIME '19:00') AT TIME ZONE 'America/Toronto'
          ),
          (
            ${softSkillsCohortId},
            ${`Attendance Test Latest ${Date.now()}`},
            (CURRENT_DATE - 1 + TIME '17:00') AT TIME ZONE 'America/Toronto',
            (CURRENT_DATE - 1 + TIME '19:00') AT TIME ZONE 'America/Toronto'
          )
        RETURNING id, (starts_at AT TIME ZONE 'America/Toronto')::date::text AS session_date
      `;

      try {
        await sql`
          INSERT INTO cohort_enrollments (cohort_id, youth_id, enrolled_on)
          VALUES (${softSkillsCohortId}, ${youthId}, CURRENT_DATE - 3)
        `;
        await sql`
          INSERT INTO attendance_records (session_id, youth_id, status, marked_by)
          VALUES
            (${sessions[0].id}, ${youthId}, 'present', ${adminUserId}),
            (${sessions[1].id}, ${youthId}, 'absent', ${adminUserId})
        `;

        const res = await request(app)
          .get(`/api/youth?id=${youthId}`)
          .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
        expect(res.body.lastAttendedOn).toBe(sessions[0].sessionDate);
        expect(res.body.cohorts).toEqual(expect.arrayContaining([
          expect.objectContaining({
            id: softSkillsCohortId,
            presentCount: 1,
            lateCount: 0,
            absentCount: 1,
            lastAttendedOn: sessions[0].sessionDate,
          }),
        ]));
      } finally {
        await sql`DELETE FROM attendance_records WHERE youth_id = ${youthId}`;
        await sql`DELETE FROM cohort_enrollments WHERE youth_id = ${youthId}`;
        await sql`DELETE FROM cohort_sessions WHERE id = ANY(${sql.array(sessions.map(session => session.id))}::uuid[])`;
      }
    });

    it('should return null for nonexistent id (200)', async () => {
      const res = await request(app)
        .get('/api/youth?id=00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body).toBeNull();
    });
  });

  describe('POST /api/youth/:id/invite', () => {
    let youthId: string;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/youth')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ...baseYouth, firstName: 'InviteTarget' });
      youthId = res.body.id;
    });

    afterEach(async () => {
      await deleteTestYouth(youthId);
    });

    it('should attach invited credentials without changing youth participation', async () => {
      const email = `invited-youth-${Date.now()}@test.local`;
      const inviteRes = await request(app)
        .post(`/api/youth/${youthId}/invite`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ email });

      expect(inviteRes.status).toBe(201);
      expect(inviteRes.body).toEqual({ email, status: 'invited' });

      const getRes = await request(app)
        .get(`/api/youth?id=${youthId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(getRes.body.status).toBe('inactive');
      expect(getRes.body.account).toEqual({ email, status: 'invited' });
    });

    it('should reject inviting a youth who already has an account', async () => {
      const email = `duplicate-youth-${Date.now()}@test.local`;
      await request(app)
        .post(`/api/youth/${youthId}/invite`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ email });

      const duplicateRes = await request(app)
        .post(`/api/youth/${youthId}/invite`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ email: `other-${email}` });
      expect(duplicateRes.status).toBe(409);
    });

    it('should reject an invalid email', async () => {
      const res = await request(app)
        .post(`/api/youth/${youthId}/invite`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ email: 'not-an-email' });
      expect(res.status).toBe(400);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // POST /api/youth (Update / Upsert)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe('POST /api/youth — update (upsert)', () => {
    let youthId: string;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/youth')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ...baseYouth, firstName: 'Original' });
      youthId = res.body.id;
    });

    afterEach(async () => {
      await deleteTestYouth(youthId);
    });

    it('should update an existing youth profile (200)', async () => {
      const updateRes = await request(app)
        .post('/api/youth')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ id: youthId, firstName: 'Updated', lastName: 'Name' });
      expect(updateRes.status).toBe(200);
      expect(updateRes.body.id).toBe(youthId);

      // Verify the change persisted
      const getRes = await request(app)
        .get(`/api/youth?id=${youthId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(getRes.body.firstName).toBe('Updated');
      expect(getRes.body.status).toBe('inactive');
    });

    it('should add addresses on update (200)', async () => {
      const updateRes = await request(app)
        .post('/api/youth')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          id: youthId,
          ...baseYouth,
          addresses: [
            { address: '456 Oak Ave' },
          ],
        });
      expect(updateRes.status).toBe(200);

      const getRes = await request(app)
        .get(`/api/youth?id=${youthId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(Array.isArray(getRes.body.addresses)).toBe(true);
      expect(getRes.body.addresses).toHaveLength(1);
      expect(getRes.body.addresses[0]).toEqual(expect.objectContaining({
        address: '456 Oak Ave',
      }));
    });

    it('should add contacts on update (200)', async () => {
      const updateRes = await request(app)
        .post('/api/youth')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          id: youthId,
          ...baseYouth,
          contacts: [
            { phoneNumber: '4165559999', type: 'guardian' },
          ],
        });
      expect(updateRes.status).toBe(200);

      const getRes = await request(app)
        .get(`/api/youth?id=${youthId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(Array.isArray(getRes.body.contacts)).toBe(true);
      expect(getRes.body.contacts).toHaveLength(1);
      expect(getRes.body.contacts[0]).toEqual(expect.objectContaining({
        phoneNumber: '4165559999',
        type: 'guardian',
      }));
    });

    it('should remove addresses when synced with empty array (200)', async () => {
      // First add an address
      await request(app)
        .post('/api/youth')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          id: youthId,
          ...baseYouth,
          addresses: [{ address: '789 Elm St' }],
        });

      // Then sync with empty — should clear addresses
      const updateRes = await request(app)
        .post('/api/youth')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ id: youthId, ...baseYouth, addresses: [] });
      expect(updateRes.status).toBe(200);

      const getRes = await request(app)
        .get(`/api/youth?id=${youthId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(getRes.body.addresses).toBeNull();
    });
  });
});
