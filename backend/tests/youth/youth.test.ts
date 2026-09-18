import { randomUUID } from 'crypto';
import request from 'supertest';
import { createApp } from '../shared/app';
import { deleteTestCohort, seedTestCohort, seedTestUser, deleteTestUser, sql } from '../shared/db';
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
  let softSkillsCycleId: string;

  beforeAll(async () => {
    const admin = await seedTestUser({ email: `youth-admin-${Date.now()}@test.local`, role: 'admin' });
    adminUserId = admin.userId;
    adminToken = generateToken(admin.userId, 'admin', admin.email);
    const [program] = await sql<{ id: string }[]>`SELECT id FROM programs WHERE name = 'Soft Skills'`;
    softSkillsProgramId = program.id;
    ({ cohortId: softSkillsCohortId, cycleId: softSkillsCycleId } = await seedTestCohort({
      programId: softSkillsProgramId,
      name: `Youth Test ${Date.now()}`,
    }));
  });

  afterAll(async () => {
    await deleteTestCohort(softSkillsCohortId, softSkillsCycleId);
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

    describe('cycle filters', () => {
      let openProgramId: string;
      let current: { cohortId: string; cycleId: string };
      let past: { cohortId: string; cycleId: string };
      let open: { cohortId: string; cycleId: string };
      let otherCohortId: string;
      let sessionId: string;
      const youthIds: string[] = [];
      const youth: Record<string, string> = {};

      beforeAll(async () => {
        const [otherProgram] = await sql<{ id: string }[]>`
          SELECT id FROM programs WHERE roster_mode = 'enrolled' AND id != ${softSkillsProgramId} LIMIT 1
        `;
        const [openProgram] = await sql<{ id: string }[]>`
          SELECT id FROM programs WHERE roster_mode = 'open' LIMIT 1
        `;
        openProgramId = openProgram.id;
        const [dates] = await sql<{ startsOn: string; endsOn: string }[]>`
          SELECT ((NOW() AT TIME ZONE 'America/Toronto')::date - 30)::text AS starts_on,
            ((NOW() AT TIME ZONE 'America/Toronto')::date + 30)::text AS ends_on
        `;
        current = await seedTestCohort({ programId: softSkillsProgramId, name: `Current ${randomUUID()}`, ...dates });
        past = await seedTestCohort({
          programId: softSkillsProgramId, name: `Past ${randomUUID()}`, startsOn: '2020-01-01', endsOn: '2020-12-31',
        });
        open = await seedTestCohort({ programId: openProgramId, name: `Open ${randomUUID()}`, ...dates });
        const [otherCohort] = await sql<{ id: string }[]>`
          INSERT INTO program_cohorts (program_id, cycle_id)
          VALUES (${otherProgram.id}, ${past.cycleId}) RETURNING id
        `;
        otherCohortId = otherCohort.id;

        for (const name of ['Current', 'Past', 'Both', 'Cross', 'Withdrawn', 'Open', 'Unlinked']) {
          const response = await request(app).post('/api/youth')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ firstName: name, lastName: 'CycleFilter' });
          expect(response.status).toBe(201);
          youth[name] = response.body.id;
          youthIds.push(response.body.id);
        }
        await sql`
          INSERT INTO cohort_enrollments (cohort_id, youth_id, enrolled_on)
          VALUES
            (${current.cohortId}, ${youth.Current}, '2020-01-01'),
            (${past.cohortId}, ${youth.Past}, '2020-01-01'),
            (${current.cohortId}, ${youth.Both}, '2020-01-01'),
            (${past.cohortId}, ${youth.Both}, '2020-01-01'),
            (${current.cohortId}, ${youth.Cross}, '2020-01-01'),
            (${otherCohortId}, ${youth.Cross}, '2020-01-01')
        `;
        await sql`
          INSERT INTO cohort_enrollments (cohort_id, youth_id, enrolled_on, withdrawn_on)
          VALUES (${current.cohortId}, ${youth.Withdrawn}, '2020-01-01', '2020-02-01')
        `;
        const [session] = await sql<{ id: string }[]>`
          INSERT INTO cohort_sessions (cohort_id, theme, starts_at, ends_at)
          VALUES (${open.cohortId}, 'Cycle filter attendance', CURRENT_DATE - 1 + TIME '17:00',
            CURRENT_DATE - 1 + TIME '18:00') RETURNING id
        `;
        sessionId = session.id;
        await sql`
          INSERT INTO attendance_records (session_id, youth_id, status, marked_by)
          VALUES (${sessionId}, ${youth.Open}, 'present', ${adminUserId})
        `;
      });

      afterAll(async () => {
        await sql`DELETE FROM attendance_records WHERE session_id = ${sessionId}`;
        await sql`DELETE FROM cohort_sessions WHERE id = ${sessionId}`;
        for (const id of youthIds) await deleteTestYouth(id);
        await sql`DELETE FROM program_cohorts WHERE id = ${otherCohortId}`;
        for (const cohort of [current, past, open]) await deleteTestCohort(cohort.cohortId, cohort.cycleId);
      });

      const list = (query: Record<string, string | number> = {}) => request(app)
        .get('/api/youth').query(query).set('Authorization', `Bearer ${adminToken}`);
      const ids = (rows: Array<{ id: string }>) => rows.map(row => row.id).sort();

      it('filters one cycle and excludes withdrawn and unrelated youth', async () => {
        const response = await list({ cycleIds: current.cycleId });
        expect(response.status).toBe(200);
        expect(ids(response.body)).toEqual([youth.Current, youth.Both, youth.Cross].sort());
      });

      it('matches any selected cycle without returning duplicate youth', async () => {
        const response = await list({ cycleIds: `${current.cycleId},${past.cycleId}` });
        expect(response.status).toBe(200);
        expect(ids(response.body)).toEqual([youth.Current, youth.Past, youth.Both, youth.Cross].sort());
      });

      it('requires program and cycle to match the same cohort participation', async () => {
        const response = await list({ programIds: softSkillsProgramId, cycleIds: past.cycleId });
        expect(response.status).toBe(200);
        expect(ids(response.body)).toEqual([youth.Past, youth.Both].sort());
      });

      it('includes open-roster attendance and composes its program and cycle filters', async () => {
        const response = await list({ cycleIds: open.cycleId, programIds: openProgramId });
        expect(response.status).toBe(200);
        expect(ids(response.body)).toEqual([youth.Open]);

        const mismatch = await list({ cycleIds: open.cycleId, programIds: softSkillsProgramId });
        expect(mismatch.status).toBe(200);
        expect(mismatch.body).toEqual([]);
      });

      it('combines cycle filtering with search and paginates matching youth', async () => {
        const query = { cycleIds: current.cycleId, search: 'CycleFilter', limit: 1, sort: 'firstName' };
        const first = await list(query);
        expect(first.status).toBe(200);
        expect(ids(first.body.rows)).toEqual([youth.Both]);
        expect(first.body.nextCursor).toEqual(expect.any(String));

        const second = await list({ ...query, cursor: first.body.nextCursor });
        expect(second.status).toBe(200);
        expect(ids(second.body.rows)).toEqual([youth.Cross]);

        const third = await list({ ...query, cursor: second.body.nextCursor });
        expect(third.status).toBe(200);
        expect(ids(third.body.rows)).toEqual([youth.Current]);
        expect(third.body.nextCursor).toBeNull();
      });

      it('returns an empty list for an unmatched cycle and leaves omitted cycles unrestricted', async () => {
        const missing = await list({ cycleIds: randomUUID() });
        expect(missing.status).toBe(200);
        expect(missing.body).toEqual([]);

        const unrestricted = await list({ search: 'CycleFilter' });
        expect(unrestricted.status).toBe(200);
        expect(ids(unrestricted.body)).toEqual([...youthIds].sort());
      });

      it('rejects malformed cycle identifiers and more than 20 selections', async () => {
        for (const cycleIds of ['invalid', Array.from({ length: 21 }, () => randomUUID()).join(',')]) {
          const response = await list({ cycleIds });
          expect(response.status).toBe(400);
        }
      });

      it('preserves planned participation in program and cycle filters', async () => {
        const created = await request(app).post('/api/youth')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ firstName: 'Planned', lastName: 'CycleFilter' });
        expect(created.status).toBe(201);
        youthIds.push(created.body.id);
        await sql`
          INSERT INTO cohort_enrollments (cohort_id, youth_id, enrolled_on)
          VALUES (${current.cohortId}, ${created.body.id}, (NOW() AT TIME ZONE 'America/Toronto')::date + 1)
        `;

        const query = { cycleIds: current.cycleId, programIds: softSkillsProgramId, search: 'Planned CycleFilter' };
        const response = await list(query);
        expect(response.status).toBe(200);
        expect(ids(response.body)).toEqual([created.body.id]);
      });
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
        });
      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.cohorts).toEqual([]);
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

    it('should filter youth by cycle UUID', async () => {
      const res = await request(app)
        .get(`/api/youth?cycleIds=${softSkillsCycleId}`)
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

    it('should derive active status from current cohort enrollment', async () => {
      const res = await request(app)
        .get('/api/youth')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(expect.arrayContaining([
        expect.objectContaining({ firstName: 'Jordan', status: 'active' }),
      ]));
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

  describe('Youth profile notes', () => {
    let youthId: string;
    beforeAll(async () => {
      const res = await request(app).post('/api/youth').set('Authorization', `Bearer ${adminToken}`).send({ ...baseYouth, firstName: 'Notes' });
      youthId = res.body.id;
    });
    afterAll(async () => { await deleteTestYouth(youthId); });

    it('requires authentication and profile permissions', async () => {
      const unauthenticated = await request(app).get(`/api/youth/${youthId}/notes`);
      expect(unauthenticated.status).toBe(401);

      const youthUser = await seedTestUser({ email: `profile-notes-youth-${Date.now()}@test.local`, role: 'youth' });
      const youthToken = generateToken(youthUser.userId, 'youth', youthUser.email);
      const forbidden = await request(app)
        .get(`/api/youth/${youthId}/notes`)
        .set('Authorization', `Bearer ${youthToken}`);
      expect(forbidden.status).toBe(403);
      await deleteTestUser(youthUser.userId);
    });

    it('rejects invalid note input', async () => {
      const invalidCategory = await request(app)
        .post(`/api/youth/${youthId}/notes`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ category: 'private', details: 'Test' });
      expect(invalidCategory.status).toBe(400);

      const emptyNote = await request(app)
        .post(`/api/youth/${youthId}/notes`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ category: 'general', details: '   ' });
      expect(emptyNote.status).toBe(400);
    });

    it('does not allow a note id to be used through another youth profile', async () => {
      const otherYouth = await request(app)
        .post('/api/youth')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ...baseYouth, firstName: 'OtherNotes' });
      const created = await request(app)
        .post(`/api/youth/${youthId}/notes`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ category: 'general', details: 'Scoped note' });

      const update = await request(app)
        .put(`/api/youth/${otherYouth.body.id}/notes/${created.body.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ category: 'general', details: 'Moved note' });
      expect(update.status).toBe(404);

      const remove = await request(app)
        .delete(`/api/youth/${otherYouth.body.id}/notes/${created.body.id}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(remove.status).toBe(404);

      await sql`DELETE FROM youth_profile_notes WHERE id = ${created.body.id}`;
      await deleteTestYouth(otherYouth.body.id);
    });

    it('creates, lists, updates, and deletes typed notes', async () => {
      const created = await request(app).post(`/api/youth/${youthId}/notes`).set('Authorization', `Bearer ${adminToken}`).send({
        category: 'health', details: 'Avoid peanuts',
      });
      expect(created.status).toBe(201);
      expect(created.body).toEqual(expect.objectContaining({ youthId, category: 'health', details: 'Avoid peanuts' }));

      const listed = await request(app).get(`/api/youth/${youthId}/notes`).set('Authorization', `Bearer ${adminToken}`);
      expect(listed.body).toHaveLength(1);

      const updated = await request(app).put(`/api/youth/${youthId}/notes/${created.body.id}`).set('Authorization', `Bearer ${adminToken}`).send({
        category: 'preference', details: 'Prefers apples',
      });
      expect(updated.body).toEqual(expect.objectContaining({ category: 'preference', details: 'Prefers apples' }));

      const deleted = await request(app).delete(`/api/youth/${youthId}/notes/${created.body.id}`).set('Authorization', `Bearer ${adminToken}`);
      expect(deleted.status).toBe(200);
      const empty = await request(app).get(`/api/youth/${youthId}/notes`).set('Authorization', `Bearer ${adminToken}`);
      expect(empty.body).toEqual([]);
    });
  });

  describe('Youth cohort attendance', () => {
    let youthId: string;
    let otherYouthId: string;
    let firstSessionId: string;
    let secondSessionId: string;
    let linkedSessionNoteId: string;
    let openCohortId: string;
    let openCycleId: string;
    let openSessionId: string;

    beforeAll(async () => {
      const youth = await request(app)
        .post('/api/youth')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ...baseYouth, firstName: 'Attendance' });
      const otherYouth = await request(app)
        .post('/api/youth')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ...baseYouth, firstName: 'OtherAttendance' });
      youthId = youth.body.id;
      otherYouthId = otherYouth.body.id;

      await sql`
        INSERT INTO cohort_enrollments (cohort_id, youth_id, enrolled_on)
        VALUES
          (${softSkillsCohortId}, ${youthId}, CURRENT_DATE - 30),
          (${softSkillsCohortId}, ${otherYouthId}, CURRENT_DATE - 30)
      `;
      const [sessionType] = await sql<{ id: string }[]>`SELECT id FROM session_types ORDER BY name LIMIT 1`;
      const sessions = await sql<{ id: string }[]>`
        INSERT INTO cohort_sessions (
          cohort_id, session_type_id, theme, starts_at, ends_at, created_by, updated_by
        )
        VALUES
          (${softSkillsCohortId}, ${sessionType.id}, ${`Youth Attendance A ${Date.now()}`}, CURRENT_DATE - 2 + TIME '17:00', CURRENT_DATE - 2 + TIME '18:00', ${adminUserId}, ${adminUserId}),
          (${softSkillsCohortId}, ${sessionType.id}, ${`Youth Attendance B ${Date.now()}`}, CURRENT_DATE - 1 + TIME '17:00', CURRENT_DATE - 1 + TIME '18:00', ${adminUserId}, ${adminUserId})
        RETURNING id
      `;
      [firstSessionId, secondSessionId] = sessions.map(session => session.id);

      await sql`
        INSERT INTO attendance_records (session_id, youth_id, status, marked_by)
        VALUES
          (${firstSessionId}, ${youthId}, 'present', ${adminUserId}),
          (${firstSessionId}, ${otherYouthId}, 'present', ${adminUserId})
      `;

      const [linkedSessionNote] = await sql<{ id: string }[]>`
        INSERT INTO session_notes (
          session_id, category, details, created_by, updated_by
        )
        VALUES (
          ${firstSessionId}, 'achievement', 'Led the opening activity',
          ${adminUserId}, ${adminUserId}
        )
        RETURNING id
      `;
      linkedSessionNoteId = linkedSessionNote.id;
      await sql`
        INSERT INTO session_note_has_youth (note_id, youth_id)
        VALUES (${linkedSessionNoteId}, ${youthId})
      `;

      const [openProgram] = await sql<{ id: string }[]>`
        SELECT id FROM programs WHERE roster_mode = 'open' ORDER BY name LIMIT 1
      `;
      const openCohort = await seedTestCohort({
        programId: openProgram.id,
        name: `Youth Open Attendance ${Date.now()}`,
      });
      openCohortId = openCohort.cohortId;
      openCycleId = openCohort.cycleId;
      const [openSession] = await sql<{ id: string }[]>`
        INSERT INTO cohort_sessions (
          cohort_id, session_type_id, theme, starts_at, ends_at, created_by, updated_by
        )
        VALUES (${openCohortId}, ${sessionType.id}, 'Open attendance', CURRENT_DATE - 1 + TIME '19:00', CURRENT_DATE - 1 + TIME '20:00', ${adminUserId}, ${adminUserId})
        RETURNING id
      `;
      openSessionId = openSession.id;
    });

    afterAll(async () => {
      await sql`DELETE FROM attendance_records WHERE youth_id IN (${youthId}, ${otherYouthId})`;
      await sql`DELETE FROM session_notes WHERE id = ${linkedSessionNoteId}`;
      await sql`DELETE FROM cohort_sessions WHERE id IN (${firstSessionId}, ${secondSessionId}, ${openSessionId})`;
      await deleteTestCohort(openCohortId, openCycleId);
      await deleteTestYouth(youthId);
      await deleteTestYouth(otherYouthId);
    });

    it('requires authentication', async () => {
      const response = await request(app)
        .get(`/api/youth/${youthId}/cohorts/${softSkillsCohortId}/attendance`);
      expect(response.status).toBe(401);
    });

    it('requires attendance permissions', async () => {
      const response = await request(app)
        .get(`/api/youth/${youthId}/cohorts/${softSkillsCohortId}/attendance`)
        .set('Authorization', `Bearer ${generateToken(youthId, 'youth')}`);
      expect(response.status).toBe(403);
    });

    it('validates identifiers, reports missing youth, and hides unavailable cohorts', async () => {
      const invalid = await request(app)
        .get(`/api/youth/not-a-uuid/cohorts/${softSkillsCohortId}/attendance`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(invalid.status).toBe(400);

      const missingYouth = await request(app)
        .get(`/api/youth/00000000-0000-4000-8000-000000000000/cohorts/${softSkillsCohortId}/attendance`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(missingYouth.status).toBe(404);

      const missingCohort = await request(app)
        .get(`/api/youth/${youthId}/cohorts/00000000-0000-4000-8000-000000000000/attendance`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(missingCohort.status).toBe(403);
    });

    it('lists every eligible cohort session with this youth attendance only', async () => {
      const response = await request(app)
        .get(`/api/youth/${youthId}/cohorts/${softSkillsCohortId}/attendance`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.cohort).toEqual(expect.objectContaining({
        id: softSkillsCohortId,
        programName: 'Soft Skills',
        rosterMode: 'enrolled',
      }));
      expect(response.body.sessions).toHaveLength(2);
      expect(response.body.sessions).toEqual(expect.arrayContaining([
        expect.objectContaining({
          id: firstSessionId,
          status: 'present',
          sessionNotes: [expect.objectContaining({
            id: linkedSessionNoteId,
            details: 'Led the opening activity',
          })],
        }),
        expect.objectContaining({ id: secondSessionId, status: null, sessionNotes: [] }),
      ]));
    });

    it('atomically replaces one youth attendance without changing another youth', async () => {
      const response = await request(app)
        .put(`/api/youth/${youthId}/cohorts/${softSkillsCohortId}/attendance`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ records: [
          { sessionId: firstSessionId, status: 'late', notes: 'Arrived after kickoff' },
          { sessionId: secondSessionId, status: null },
        ] });

      expect(response.status).toBe(200);
      expect(response.body.sessions).toEqual(expect.arrayContaining([
        expect.objectContaining({ id: firstSessionId, status: 'late', notes: 'Arrived after kickoff' }),
        expect.objectContaining({ id: secondSessionId, status: null }),
      ]));
      const otherAttendance = await sql<{ status: string }[]>`
        SELECT status FROM attendance_records
        WHERE session_id = ${firstSessionId} AND youth_id = ${otherYouthId}
      `;
      expect(otherAttendance).toEqual([{ status: 'present' }]);
    });

    it('rejects stale partial cohort replacements without deleting saved attendance', async () => {
      const response = await request(app)
        .put(`/api/youth/${youthId}/cohorts/${softSkillsCohortId}/attendance`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ records: [{ sessionId: firstSessionId, status: 'absent' }] });

      expect(response.status).toBe(409);
      const attendance = await sql<{ status: string }[]>`
        SELECT status FROM attendance_records
        WHERE session_id = ${firstSessionId} AND youth_id = ${youthId}
      `;
      expect(attendance).toEqual([{ status: 'late' }]);
    });

    it('limits open-program youth attendance to attended or unmarked', async () => {
      const rejected = await request(app)
        .put(`/api/youth/${youthId}/cohorts/${openCohortId}/attendance`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ records: [{ sessionId: openSessionId, status: 'late' }] });
      expect(rejected.status).toBe(409);

      const saved = await request(app)
        .put(`/api/youth/${youthId}/cohorts/${openCohortId}/attendance`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ records: [{ sessionId: openSessionId, status: 'present' }] });
      expect(saved.status).toBe(200);
      expect(saved.body.sessions[0]).toEqual(expect.objectContaining({
        id: openSessionId,
        status: 'present',
      }));
    });
  });
});
