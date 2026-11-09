import request from 'supertest';
import { createApp } from '../shared/app';
import { deleteTestProgramCycle, deleteTestUser, seedTestProgramCycle, seedTestUser, sql } from '../shared/db';
import { generateToken } from '../shared/tokenHelpers';
import { asTransactionSql } from '../../src/db/client';

const app = createApp();

describe('Program cycle roster eligibility', () => {
  const userIds: string[] = [];
  const programIds: string[] = [];
  type ProgramCycleKey = { programId: string; cycleId: string };
  const programCycles: ProgramCycleKey[] = [];
  const youth: Record<string, string> = {};
  let adminId: string;
  let adminToken: string;
  let staffId: string;
  let staffToken: string;
  let unassignedToken: string;
  let ageLimitedProgramId: string;
  let ageLimitedCycle: ProgramCycleKey;
  let noAgeLimitCycle: ProgramCycleKey;
  let openAttendanceCycle: ProgramCycleKey;
  let otherCycle: ProgramCycleKey;
  let extraYouthIds: string[];

  /**
   * Creates a test user and records its ID for cleanup.
   * @param role - Account role needed by this fixture.
   * @example makeUser('staff') // staff account removed after the suite
   */
  async function makeUser(role: 'admin' | 'staff' | 'youth') {
    const user = await seedTestUser({ role });
    userIds.push(user.userId);
    return user;
  }

  /**
   * Creates a program and assigned cycle, recording both for cleanup.
   * @param label - Description to include in the test program's name.
   * @param enrollmentRequired - Whether the program requires enrollment before attendance.
   * @param hasAgeLimits - Whether to restrict new enrollments to ages 12 through 15.
   * @example makeProgram('age limited', true, true) // program and cycle IDs
   */
  async function makeProgram(label: string, enrollmentRequired: boolean, hasAgeLimits: boolean) {
    const [program] = await sql<{ id: string }[]>`
      INSERT INTO programs (name, enrollment_required, min_age, max_age)
      VALUES (${`Roster ${label} ${Date.now()}`}, ${enrollmentRequired}, ${hasAgeLimits ? 12 : null}, ${hasAgeLimits ? 15 : null})
      RETURNING id
    `;
    programIds.push(program.id);
    const programCycle = await seedTestProgramCycle({ programId: program.id });
    programCycles.push(programCycle);
    return programCycle;
  }

  /**
   * Requests the enrollment roster for a program and cycle.
   * @param programCycle - Program and cycle IDs; defaults to the age-limited fixture.
   * @param token - Authentication token; defaults to the test administrator's token.
   * @example loadRoster(ageLimitedCycle, staffToken) // roster response for the assigned staff member
   */
  const loadRoster = (programCycle = ageLimitedCycle, token = adminToken) => request(app)
    .get(`/api/programs/${programCycle.programId}/cycles/${programCycle.cycleId}/roster`)
    .set('Authorization', `Bearer ${token}`);

  /**
   * Enrolls youth as the test administrator.
   * @param youthIds - IDs of the youth to enroll together.
   * @param programCycle - Program and cycle IDs; defaults to the age-limited fixture.
   * @example enroll([youth.eligible]) // enrollment response
   */
  const enroll = (youthIds: string[], programCycle = ageLimitedCycle) => request(app)
    .post(`/api/programs/${programCycle.programId}/cycles/${programCycle.cycleId}/enrollments`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ youthIds });

  beforeAll(async () => {
    const admin = await makeUser('admin');
    adminId = admin.userId;
    adminToken = generateToken(admin.userId, 'admin');
    const staff = await makeUser('staff');
    staffId = staff.userId;
    staffToken = generateToken(staff.userId, 'staff');
    const unassigned = await makeUser('staff');
    unassignedToken = generateToken(unassigned.userId, 'staff');

    const ageLimited = await makeProgram('bounded', true, true);
    ageLimitedProgramId = ageLimited.programId;
    ageLimitedCycle = ageLimited;
    noAgeLimitCycle = await makeProgram('unbounded', true, false);
    openAttendanceCycle = await makeProgram('open', false, false);
    const other = await seedTestProgramCycle({ programId: ageLimitedProgramId });
    programCycles.push(other);
    otherCycle = other;
    await sql`INSERT INTO user_program_assignments (user_id, program_id) VALUES (${staffId}, ${ageLimitedProgramId})`;

    for (const [name, age] of Object.entries({ minimum: 12, maximum: 15, eligible: 14, young: 11, old: 16, unknown: null, retained: 18, withdrawn: 18 })) {
      const user = await makeUser('youth');
      youth[name] = user.userId;
      await sql`
        INSERT INTO youth_profiles (user_id, date_of_birth)
        VALUES (${user.userId}, CASE
          WHEN ${age}::int IS NULL THEN NULL
          ELSE (NOW() AT TIME ZONE 'America/Toronto')::date - make_interval(years => ${age}::int)
        END)
      `;
    }
    await sql`
      INSERT INTO program_enrollments (program_id, cycle_id, youth_id, enrolled_on, withdrawn_on)
      VALUES
        (${ageLimitedCycle.programId}, ${ageLimitedCycle.cycleId}, ${youth.retained}, (NOW() AT TIME ZONE 'America/Toronto')::date - 30, NULL),
        (${ageLimitedCycle.programId}, ${ageLimitedCycle.cycleId}, ${youth.withdrawn}, (NOW() AT TIME ZONE 'America/Toronto')::date - 30, (NOW() AT TIME ZONE 'America/Toronto')::date),
        (${otherCycle.programId}, ${otherCycle.cycleId}, ${youth.eligible}, (NOW() AT TIME ZONE 'America/Toronto')::date, NULL)
    `;

    const extras = await sql<{ id: string }[]>`
      INSERT INTO users (first_name, last_name, role_id)
      SELECT 'Roster extra', sequence::text, (SELECT id FROM user_roles WHERE name = 'youth')
      FROM generate_series(1, 26) sequence
      RETURNING id
    `;
    extraYouthIds = extras.map(user => user.id);
    userIds.push(...extraYouthIds);
    await sql`
      INSERT INTO youth_profiles (user_id, date_of_birth)
      SELECT id, (NOW() AT TIME ZONE 'America/Toronto')::date - INTERVAL '14 years'
      FROM UNNEST(${sql.array(extraYouthIds)}::uuid[]) AS selected(id)
    `;
  });

  afterAll(async () => {
    for (const programCycle of programCycles) {
      await sql`DELETE FROM program_enrollments WHERE program_id = ${programCycle.programId} AND cycle_id = ${programCycle.cycleId}`;
      await deleteTestProgramCycle(programCycle.programId, programCycle.cycleId);
    }
    await sql`DELETE FROM user_program_assignments WHERE user_id = ${staffId}`;
    for (const id of programIds) await sql`DELETE FROM programs WHERE id = ${id}`;
    for (const id of userIds) await deleteTestUser(id);
  });

  it('requires authentication', async () => {
    expect((await request(app).get(`/api/programs/${ageLimitedCycle.programId}/cycles/${ageLimitedCycle.cycleId}/roster`)).status).toBe(401);
  });

  it.each(['read:programs', 'read:youth_profiles'])('requires %s independently', async permission => {
    const remaining = ['read:programs', 'read:youth_profiles'].filter(value => value !== permission);
    const token = generateToken(adminId, 'admin', undefined, remaining);
    expect((await loadRoster(ageLimitedCycle, token)).status).toBe(403);
  });

  it('allows administrators and assigned staff while denying unassigned staff', async () => {
    expect((await loadRoster()).status).toBe(200);
    expect((await loadRoster(ageLimitedCycle, staffToken)).status).toBe(200);
    expect((await loadRoster(ageLimitedCycle, unassignedToken)).status).toBe(403);
  });

  it('validates identifiers and reports missing program-cycle assignments after program authorization', async () => {
    expect((await loadRoster({ ...ageLimitedCycle, cycleId: 'invalid' })).status).toBe(400);
    expect((await loadRoster({ ...ageLimitedCycle, cycleId: '00000000-0000-4000-8000-000000000000' })).status).toBe(404);
  });

  it('rejects enrollment roster lookup for open attendance programs', async () => {
    expect((await loadRoster(openAttendanceCycle)).status).toBe(409);
  });

  it('returns inclusive age bounds, authoritative numeric ages, and existing aged-out enrollment', async () => {
    const response = await loadRoster();
    expect(response.status).toBe(200);
    expect(response.body).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: youth.minimum, age: 12, dateOfBirth: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) }),
      expect.objectContaining({ id: youth.maximum, age: 15 }),
      expect.objectContaining({ id: youth.retained, age: 18, programCycles: [{ ...ageLimitedCycle, withdrawnOn: null }] }),
    ]));
    const ids = response.body.map((profile: { id: string }) => profile.id);
    for (const id of [youth.young, youth.old, youth.unknown, youth.withdrawn]) expect(ids).not.toContain(id);
  });

  it('returns only target-pair membership and all eligible candidates beyond 25 rows', async () => {
    const response = await loadRoster();
    expect(response.status).toBe(200);
    expect(response.body.find((profile: { id: string }) => profile.id === youth.eligible).programCycles).toEqual([]);
    const ids = response.body.map((profile: { id: string }) => profile.id);
    expect(ids).toEqual(expect.arrayContaining(extraYouthIds));
  });

  it('allows unknown birth dates when both program age bounds are absent', async () => {
    const response = await loadRoster(noAgeLimitCycle);
    expect(response.status).toBe(200);
    expect(response.body).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: youth.unknown, age: null, dateOfBirth: null }),
    ]));
    expect((await enroll([youth.unknown], noAgeLimitCycle)).status).toBe(201);
  });

  it.each(['young', 'old', 'unknown'])('rejects new bounded enrollment for %s youth', async name => {
    expect((await enroll([youth[name]])).status).toBe(409);
  });

  it('rejects an ineligible batch without inserting eligible members', async () => {
    expect((await enroll([youth.eligible, youth.old])).status).toBe(409);
    const rows = await sql`SELECT 1 FROM program_enrollments WHERE program_id = ${ageLimitedCycle.programId} AND cycle_id = ${ageLimitedCycle.cycleId} AND youth_id = ${youth.eligible}`;
    expect(rows).toHaveLength(0);
  });

  it('accepts both exact age boundaries', async () => {
    const response = await enroll([youth.minimum, youth.maximum]);
    expect(response.status).toBe(201);
    expect(response.body.enrollments).toEqual(expect.arrayContaining([
      expect.objectContaining({ youthId: youth.minimum }),
      expect.objectContaining({ youthId: youth.maximum }),
    ]));
    const listed = await request(app).get('/api/programs/cycle-assignments')
      .query({ programId: ageLimitedProgramId })
      .set('Authorization', `Bearer ${adminToken}`);
    expect(listed.body.find((row: ProgramCycleKey) => row.programId === ageLimitedCycle.programId && row.cycleId === ageLimitedCycle.cycleId)).toEqual(response.body.programCycle);
    expect(response.body.updatedYouth).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: youth.minimum }), expect.objectContaining({ id: youth.maximum }),
    ]));
  });

  it('returns canonical roster changes without exposing Youth rows to enrollment-only tokens', async () => {
    const token = generateToken(adminId, 'admin', undefined, ['write:enrollments']);
    const enrolled = await request(app).post(`/api/programs/${noAgeLimitCycle.programId}/cycles/${noAgeLimitCycle.cycleId}/enrollments`)
      .set('Authorization', `Bearer ${token}`).send({ youthIds: [extraYouthIds[0]] });
    expect(enrolled.status).toBe(201);
    expect(enrolled.body.programCycle).toMatchObject(noAgeLimitCycle);
    expect(enrolled.body.updatedYouth).toEqual([]);

    const withdrawn = await request(app).patch(`/api/programs/${noAgeLimitCycle.programId}/cycles/${noAgeLimitCycle.cycleId}/enrollments/${extraYouthIds[0]}/withdraw`)
      .set('Authorization', `Bearer ${token}`);
    expect(withdrawn.status).toBe(200);
    expect(withdrawn.body.programCycle.enrolledCount).toBe(enrolled.body.programCycle.enrolledCount - 1);
    expect(withdrawn.body.updatedYouth).toEqual([]);
  });

  it('waits for a concurrent program edit and validates its committed age bounds', async () => {
    let pending: Promise<request.Response> | undefined;

    try {
      await sql.begin(async tx => {
        const trx = asTransactionSql(tx);
        const [connection] = await trx<{ pid: number }[]>`SELECT pg_backend_pid() AS pid`;
        await trx`UPDATE programs SET max_age = 13 WHERE id = ${ageLimitedProgramId}`;
        pending = enroll([youth.eligible]).then(response => response);

        // Observe the endpoint waiting on this transaction before releasing its program lock.
        const deadline = Date.now() + 3000;
        let blocked = false;
        while (Date.now() < deadline) {
          const [state] = await sql<{ blocked: boolean }[]>`
            SELECT EXISTS (
              SELECT 1 FROM pg_stat_activity
              WHERE ${connection.pid}::int = ANY(pg_blocking_pids(pid))
                AND query ILIKE '%programs%'
            ) AS blocked
          `;
          if (state.blocked) {
            blocked = true;
            break;
          }
        }
        expect(blocked).toBe(true);
      });

      expect((await pending!).status).toBe(409);
      const rows = await sql`SELECT 1 FROM program_enrollments WHERE program_id = ${ageLimitedCycle.programId} AND cycle_id = ${ageLimitedCycle.cycleId} AND youth_id = ${youth.eligible}`;
      expect(rows).toHaveLength(0);
    } finally {
      if (pending) await pending;
      await sql`UPDATE programs SET max_age = 15 WHERE id = ${ageLimitedProgramId}`;
    }
  });
});
