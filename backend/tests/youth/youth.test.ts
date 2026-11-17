import { randomUUID } from 'crypto';
import request from 'supertest';
import { createApp } from '../shared/app';
import { deleteTestProgramCycle, seedTestProgramCycle, seedTestUser, deleteTestUser, sql } from '../shared/db';
import { generateToken, generateExpiredToken, deleteTestYouth } from './helpers';

const app = createApp();

const baseYouth = {
  firstName: 'Jamie',
  lastName: 'Test',
  dateOfBirth: '2012-06-15',
};

describe('Youth API', () => {
  let adminUserId: string;
  let adminToken: string;
  let softSkillsProgramId: string;
  let softSkillsCycleId: string;

  beforeAll(async () => {
    const admin = await seedTestUser({ email: `youth-admin-${Date.now()}@test.local`, role: 'admin' });
    adminUserId = admin.userId;
    adminToken = generateToken(admin.userId, 'admin', admin.email);
    const [program] = await sql<{ id: string }[]>`SELECT id FROM programs WHERE title = 'Soft Skills'`;
    softSkillsProgramId = program.id;
    const [dates] = await sql<{ startsOn: string; endsOn: string }[]>`
      SELECT (CURRENT_DATE - 30)::text AS starts_on,
        (CURRENT_DATE + 30)::text AS ends_on
    `;
    ({ cycleId: softSkillsCycleId } = await seedTestProgramCycle({
      programId: softSkillsProgramId,
      name: `Youth Test ${Date.now()}`,
      ...dates,
    }));
  });

  afterAll(async () => {
    await deleteTestProgramCycle(softSkillsProgramId, softSkillsCycleId);
    await deleteTestUser(adminUserId);
  });

  // GET /api/youth

  describe('GET /api/youth', () => {
    it('should require authentication', async () => {
      const res = await request(app).get('/api/youth');
      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/token/i);
    });

    it.each(['age', 'grade', 'status', 'completedPrograms'])('rejects the removed %s sort', async sort => {
      const res = await request(app).get('/api/youth').query({ sort })
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(400);
    });

    it('projects only eligible active enrolled programs', async () => {
      const surname = `ProgramSort${randomUUID().replace(/[0-9]/g, digit => String.fromCharCode(97 + Number(digit)))}`;
      const youthIds: string[] = [];
      const fixtures: Array<{ programId: string; cycleId: string }> = [];
      const [today] = await sql<{ date: string }[]>`
        SELECT CURRENT_DATE::text AS date
      `;
      const [openProgram] = await sql<{ id: string }[]>`
        SELECT id FROM programs WHERE enrollment_required = FALSE LIMIT 1
      `;
      const [jobProgram] = await sql<{ id: string }[]>`
        SELECT id FROM programs WHERE title = 'Job Readiness'
      `;

      try {
        for (let index = 0; index < 3; index += 1) {
          const saved = await request(app).post('/api/youth')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ ...baseYouth, lastName: surname });
          expect(saved.status).toBe(201);
          youthIds.push(saved.body.id);
        }

        for (const [programId, name, startsOn, endsOn] of [
          [jobProgram.id, 'Zulu current', today.date, today.date],
          [softSkillsProgramId, 'Alpha current', today.date, today.date],
          [softSkillsProgramId, 'Alpha completed', '2000-01-01', '2000-12-31'],
          [jobProgram.id, 'Zulu completed', '2000-01-01', '2000-12-31'],
          [jobProgram.id, 'Future', '2999-01-01', '2999-12-31'],
        ] as const) {
          fixtures.push(await seedTestProgramCycle({ programId, name: `${name} ${surname}`, startsOn, endsOn }));
        }
        fixtures.push(await seedTestProgramCycle({ programId: openProgram.id, name: `Open ${surname}` }));

        for (const [fixtureIndex, youthIndex, withdrawn] of [
          [0, 0, false], [1, 1, false], [2, 0, false], [3, 1, false],
          [0, 2, true], [2, 2, true], [4, 2, false], [5, 2, false],
        ] as const) {
          const fixture = fixtures[fixtureIndex];
          await sql`
            INSERT INTO program_enrollments (program_id, cycle_id, youth_id, enrolled_on, withdrawn_on)
            VALUES (${fixture.programId}, ${fixture.cycleId}, ${youthIds[youthIndex]},
              '2000-01-01', ${withdrawn ? '2000-06-01' : null})
          `;
        }

        const response = await request(app).get('/api/youth')
          .query({ search: surname, paginate: 'true' })
          .set('Authorization', `Bearer ${adminToken}`);

        expect(response.status).toBe(200);
        expect(response.body.rows).toHaveLength(3);
        expect(response.body.rows).toEqual(expect.arrayContaining([
          expect.objectContaining({ id: youthIds[0], activeProgram: { programId: jobProgram.id, program: 'Job Readiness' } }),
          expect.objectContaining({ id: youthIds[1], activeProgram: { programId: softSkillsProgramId, program: 'Soft Skills' } }),
          expect.objectContaining({ id: youthIds[2], activeProgram: null }),
        ]));
      } finally {
        for (const id of youthIds) await deleteTestYouth(id);
        for (const fixture of fixtures) await deleteTestProgramCycle(fixture.programId, fixture.cycleId);
      }
    });

    it('should allow staff access', async () => {
      const staff = await seedTestUser({ email: `youth-staff-${Date.now()}@test.local`, role: 'staff' });
      const staffToken = generateToken(staff.userId, 'staff', staff.email);

      const res = await request(app)
        .get('/api/youth')
        .set('Authorization', `Bearer ${staffToken}`);
      expect(res.status).toBe(200);

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
      let current: { programId: string; cycleId: string };
      let past: { programId: string; cycleId: string };
      let open: { programId: string; cycleId: string };
      let otherProgramId: string;
      let sessionId: string;
      const surname = `CycleFilter${randomUUID().replace(/[0-9]/g, digit => String.fromCharCode(97 + Number(digit)))}`;
      const youthIds: string[] = [];
      const youth: Record<string, string> = {};

      beforeAll(async () => {
        const [otherProgram] = await sql<{ id: string }[]>`
          SELECT id FROM programs WHERE enrollment_required = TRUE AND id != ${softSkillsProgramId} LIMIT 1
        `;
        const [openProgram] = await sql<{ id: string }[]>`
          SELECT id FROM programs WHERE enrollment_required = FALSE LIMIT 1
        `;
        openProgramId = openProgram.id;
        const [dates] = await sql<{ startsOn: string; endsOn: string }[]>`
          SELECT (CURRENT_DATE - 30)::text AS starts_on,
            (CURRENT_DATE + 30)::text AS ends_on
        `;
        current = await seedTestProgramCycle({ programId: softSkillsProgramId, name: `Current ${randomUUID()}`, ...dates });
        past = await seedTestProgramCycle({
          programId: softSkillsProgramId, name: `Past ${randomUUID()}`, startsOn: '2020-01-01', endsOn: '2020-12-31',
        });
        open = await seedTestProgramCycle({ programId: openProgramId, name: `Open ${randomUUID()}`, ...dates });
        otherProgramId = otherProgram.id;
        await sql`INSERT INTO program_cycle_assignments (program_id, cycle_id)
          VALUES (${otherProgramId}, ${past.cycleId})`;

        for (const name of ['Current', 'Past', 'Both', 'Cross', 'Withdrawn', 'Open', 'Unlinked']) {
          const response = await request(app).post('/api/youth')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ ...baseYouth, firstName: name, lastName: surname });
          expect(response.status).toBe(201);
          youth[name] = response.body.id;
          youthIds.push(response.body.id);
        }
        await sql`
          INSERT INTO program_enrollments (program_id, cycle_id, youth_id, enrolled_on)
          VALUES
            (${current.programId}, ${current.cycleId}, ${youth.Current}, '2020-01-01'),
            (${past.programId}, ${past.cycleId}, ${youth.Past}, '2020-01-01'),
            (${current.programId}, ${current.cycleId}, ${youth.Both}, '2020-01-01'),
            (${past.programId}, ${past.cycleId}, ${youth.Both}, '2020-01-01'),
            (${current.programId}, ${current.cycleId}, ${youth.Cross}, '2020-01-01'),
            (${otherProgramId}, ${past.cycleId}, ${youth.Cross}, '2020-01-01')
        `;
        await sql`
          INSERT INTO program_enrollments (program_id, cycle_id, youth_id, enrolled_on, withdrawn_on)
          VALUES (${current.programId}, ${current.cycleId}, ${youth.Withdrawn}, '2020-01-01', '2020-02-01')
        `;
        const [session] = await sql<{ id: string }[]>`
          INSERT INTO program_sessions (program_id, cycle_id, title, date, start_time, end_time)
          VALUES (${open.programId}, ${open.cycleId}, 'Cycle filter attendance', (CURRENT_DATE - 1), TIME '17:00', TIME '18:00') RETURNING id
        `;
        sessionId = session.id;
        await sql`
          INSERT INTO attendance_records (session_id, youth_id, status, marked_by)
          VALUES (${sessionId}, ${youth.Open}, 'present', ${adminUserId})
        `;
      });

      afterAll(async () => {
        await sql`DELETE FROM attendance_records WHERE session_id = ${sessionId}`;
        await sql`DELETE FROM program_sessions WHERE id = ${sessionId}`;
        for (const id of youthIds) await deleteTestYouth(id);
        await sql`DELETE FROM program_cycle_assignments WHERE program_id = ${otherProgramId} AND cycle_id = ${past.cycleId}`;
        for (const programCycle of [current, past, open]) await deleteTestProgramCycle(programCycle.programId, programCycle.cycleId);
      });

      /**
       * Lists youth matching the supplied query parameters as the test administrator.
       * @param query - Search, filter, or pagination parameters for the request.
       * @example list({ cycleIds: current.cycleId }) // profiles participating in the current cycle
       */
      const list = (query: Record<string, string | number> = {}) => request(app)
        .get('/api/youth').query(query).set('Authorization', `Bearer ${adminToken}`);

      /**
       * Extracts IDs in a stable order for comparisons that do not depend on list sorting.
       * @param rows - Records returned by the list request.
       * @example ids([{ id: 'b' }, { id: 'a' }]) // ['a', 'b']
       */
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

      it('requires program and cycle to match the same program-cycle participation', async () => {
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

      it('combines cycle filtering with search for the table', async () => {
        const response = await list({ cycleIds: current.cycleId, search: surname, paginate: 'true', sort: 'firstName' });
        expect(response.status).toBe(200);
        expect(ids(response.body.rows)).toEqual([youth.Both, youth.Cross, youth.Current].sort());
        expect(response.body.nextCursor).toBeNull();
      });

      it('returns an empty list for an unmatched cycle and leaves omitted cycles unrestricted', async () => {
        const missing = await list({ cycleIds: randomUUID() });
        expect(missing.status).toBe(200);
        expect(missing.body).toEqual([]);

        const unrestricted = await list({ search: surname });
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
          .send({ ...baseYouth, firstName: 'Planned', lastName: surname });
        expect(created.status).toBe(201);
        try {
          await sql`
            INSERT INTO program_enrollments (program_id, cycle_id, youth_id, enrolled_on)
            VALUES (${current.programId}, ${current.cycleId}, ${created.body.id}, CURRENT_DATE + 1)
          `;

          const query = { cycleIds: current.cycleId, programIds: softSkillsProgramId, search: `Planned ${surname}` };
          const response = await list(query);
          expect(response.status).toBe(200);
          expect(ids(response.body)).toEqual([created.body.id]);
        } finally {
          await deleteTestYouth(created.body.id);
        }
      });
    });
  });

  // POST /api/youth (Create)

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
      expect(res.body).not.toHaveProperty('age');
      expect(res.body).not.toHaveProperty('status');
      expect(res.body).not.toHaveProperty('gradeLevel');
      expect(res.body).not.toHaveProperty('ageGroup');
      createdIds.push(res.body.id);

      const direct = await request(app).get(`/api/youth?id=${res.body.id}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(direct.status).toBe(200);
      expect(direct.body).toEqual(res.body);

      const listed = await request(app).get('/api/youth').query({ search: baseYouth.firstName })
        .set('Authorization', `Bearer ${adminToken}`);
      expect(listed.status).toBe(200);
      expect(listed.body.find((youth: { id: string }) => youth.id === res.body.id)).toEqual(res.body);
    });

    it('should create youth and support later enrollment (201)', async () => {
      const res = await request(app)
        .post('/api/youth')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          ...baseYouth,
          firstName: 'Jordan',
          dateOfBirth: '2012-06-15',
        });
      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.activeProgram).toBeNull();
      await sql`
        INSERT INTO program_enrollments (program_id, cycle_id, youth_id, enrolled_on)
        VALUES (
          ${softSkillsProgramId}, ${softSkillsCycleId},
          ${res.body.id},
          CURRENT_DATE
        )
      `;
      createdIds.push(res.body.id);
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
        .send({ ...baseYouth, firstName: undefined });
      expect(res.status).toBe(400);
    });

    it('should reject missing lastName (400)', async () => {
      const res = await request(app)
        .post('/api/youth')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ...baseYouth, lastName: undefined });
      expect(res.status).toBe(400);
    });

    it('should reject an invalid login email (400)', async () => {
      const res = await request(app)
        .post('/api/youth')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ...baseYouth, email: 'not-an-email' });
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
  });

  // GET /api/youth?id=uuid

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
      expect(res.body.id).toBe(youthId);
      expect(res.body.firstName).toBe('GetById');
      expect(res.body).not.toHaveProperty('lastAttendedOn');
    });

    it('should reject a nonexistent required profile (404)', async () => {
      const res = await request(app)
        .get('/api/youth?id=00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Youth profile not found');
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
      expect(getRes.body.account).toEqual({ email, status: 'invited' });
      expect(getRes.body.activeProgram).toBeNull();
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

  // POST /api/youth (Update / Upsert)

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
        .send({ ...baseYouth, id: youthId, firstName: 'Updated', lastName: 'Name' });
      expect(updateRes.status).toBe(200);
      expect(updateRes.body.id).toBe(youthId);

      // Verify the change persisted
      const getRes = await request(app)
        .get(`/api/youth?id=${youthId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(getRes.body.firstName).toBe('Updated');
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

});
