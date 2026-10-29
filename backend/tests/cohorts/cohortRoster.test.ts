import request from 'supertest';
import { createApp } from '../shared/app';
import { deleteTestCohort, deleteTestUser, seedTestCohort, seedTestUser, sql } from '../shared/db';
import { generateToken } from '../shared/tokenHelpers';
import { asTransactionSql } from '../../src/db/client';

const app = createApp();

describe('Cohort roster eligibility', () => {
  const userIds: string[] = [];
  const programIds: string[] = [];
  const cohorts: Array<{ cohortId: string; cycleId: string }> = [];
  const youth: Record<string, string> = {};
  let adminId: string;
  let adminToken: string;
  let staffId: string;
  let staffToken: string;
  let unassignedToken: string;
  let boundedProgramId: string;
  let boundedId: string;
  let unboundedId: string;
  let openId: string;
  let otherId: string;
  let extraYouthIds: string[];

  async function makeUser(role: 'admin' | 'staff' | 'youth') {
    const user = await seedTestUser({ role });
    userIds.push(user.userId);
    return user;
  }

  async function makeProgram(label: string, enrollmentRequired: boolean, bounded: boolean) {
    const [program] = await sql<{ id: string }[]>`
      INSERT INTO programs (name, enrollment_required, min_age, max_age)
      VALUES (${`Roster ${label} ${Date.now()}`}, ${enrollmentRequired}, ${bounded ? 12 : null}, ${bounded ? 15 : null})
      RETURNING id
    `;
    programIds.push(program.id);
    const cohort = await seedTestCohort({ programId: program.id });
    cohorts.push(cohort);
    return { programId: program.id, cohortId: cohort.cohortId };
  }

  const loadRoster = (cohortId = boundedId, token = adminToken) => request(app)
    .get(`/api/cohorts/${cohortId}/roster`)
    .set('Authorization', `Bearer ${token}`);

  const enroll = (youthIds: string[], cohortId = boundedId) => request(app)
    .post(`/api/cohorts/${cohortId}/enrollments`)
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

    const bounded = await makeProgram('bounded', true, true);
    boundedProgramId = bounded.programId;
    boundedId = bounded.cohortId;
    unboundedId = (await makeProgram('unbounded', true, false)).cohortId;
    openId = (await makeProgram('open', false, false)).cohortId;
    const other = await seedTestCohort({ programId: boundedProgramId });
    cohorts.push(other);
    otherId = other.cohortId;
    await sql`INSERT INTO user_program_assignments (user_id, program_id) VALUES (${staffId}, ${boundedProgramId})`;

    for (const [name, age] of Object.entries({ minimum: 12, maximum: 15, eligible: 14, young: 11, old: 16, unknown: null, retained: 18, withdrawn: 18 })) {
      const user = await makeUser('youth');
      youth[name] = user.userId;
      await sql`
        INSERT INTO youth_profiles (user_id, date_of_birth)
        VALUES (${user.userId}, CASE WHEN ${age}::int IS NULL THEN NULL
          ELSE (NOW() AT TIME ZONE 'America/Toronto')::date - make_interval(years => ${age}::int) END)
      `;
    }
    await sql`
      INSERT INTO cohort_enrollments (cohort_id, youth_id, enrolled_on, withdrawn_on)
      VALUES
        (${boundedId}, ${youth.retained}, (NOW() AT TIME ZONE 'America/Toronto')::date - 30, NULL),
        (${boundedId}, ${youth.withdrawn}, (NOW() AT TIME ZONE 'America/Toronto')::date - 30, (NOW() AT TIME ZONE 'America/Toronto')::date),
        (${otherId}, ${youth.eligible}, (NOW() AT TIME ZONE 'America/Toronto')::date, NULL)
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
    for (const cohort of cohorts) {
      await sql`DELETE FROM cohort_enrollments WHERE cohort_id = ${cohort.cohortId}`;
      await deleteTestCohort(cohort.cohortId, cohort.cycleId);
    }
    await sql`DELETE FROM user_program_assignments WHERE user_id = ${staffId}`;
    for (const id of programIds) await sql`DELETE FROM programs WHERE id = ${id}`;
    for (const id of userIds) await deleteTestUser(id);
  });

  it('requires authentication', async () => {
    expect((await request(app).get(`/api/cohorts/${boundedId}/roster`)).status).toBe(401);
  });

  it.each(['read:programs', 'read:youth_profiles'])('requires %s independently', async permission => {
    const remaining = ['read:programs', 'read:youth_profiles'].filter(value => value !== permission);
    const token = generateToken(adminId, 'admin', undefined, remaining);
    expect((await loadRoster(boundedId, token)).status).toBe(403);
  });

  it('allows administrators and assigned staff while denying unassigned staff', async () => {
    expect((await loadRoster()).status).toBe(200);
    expect((await loadRoster(boundedId, staffToken)).status).toBe(200);
    expect((await loadRoster(boundedId, unassignedToken)).status).toBe(403);
  });

  it('validates identifiers and conceals unavailable cohorts', async () => {
    expect((await loadRoster('invalid')).status).toBe(400);
    expect((await loadRoster('00000000-0000-4000-8000-000000000000')).status).toBe(403);
  });

  it('rejects enrollment roster lookup for open attendance programs', async () => {
    expect((await loadRoster(openId)).status).toBe(409);
  });

  it('returns inclusive age bounds, authoritative numeric ages, and existing aged-out enrollment', async () => {
    const response = await loadRoster();
    expect(response.status).toBe(200);
    expect(response.body).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: youth.minimum, age: 12 }),
      expect.objectContaining({ id: youth.maximum, age: 15 }),
      expect.objectContaining({ id: youth.retained, age: 18, cohorts: [{ id: boundedId, withdrawnOn: null }] }),
    ]));
    const ids = response.body.map((profile: { id: string }) => profile.id);
    for (const id of [youth.young, youth.old, youth.unknown, youth.withdrawn]) expect(ids).not.toContain(id);
  });

  it('returns only target-cohort membership and all eligible candidates beyond 25 rows', async () => {
    const response = await loadRoster();
    expect(response.status).toBe(200);
    expect(response.body.find((profile: { id: string }) => profile.id === youth.eligible).cohorts).toEqual([]);
    const ids = response.body.map((profile: { id: string }) => profile.id);
    expect(ids).toEqual(expect.arrayContaining(extraYouthIds));
  });

  it('allows unknown birth dates when both program age bounds are absent', async () => {
    const response = await loadRoster(unboundedId);
    expect(response.status).toBe(200);
    expect(response.body).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: youth.unknown, age: null }),
    ]));
    expect((await enroll([youth.unknown], unboundedId)).status).toBe(201);
  });

  it.each(['young', 'old', 'unknown'])('rejects new bounded enrollment for %s youth', async name => {
    expect((await enroll([youth[name]])).status).toBe(409);
  });

  it('rejects an ineligible batch without inserting eligible members', async () => {
    expect((await enroll([youth.eligible, youth.old])).status).toBe(409);
    const rows = await sql`SELECT 1 FROM cohort_enrollments WHERE cohort_id = ${boundedId} AND youth_id = ${youth.eligible}`;
    expect(rows).toHaveLength(0);
  });

  it('accepts both exact age boundaries', async () => {
    const response = await enroll([youth.minimum, youth.maximum]);
    expect(response.status).toBe(201);
    expect(response.body.enrollments).toEqual(expect.arrayContaining([
      expect.objectContaining({ youthId: youth.minimum }),
      expect.objectContaining({ youthId: youth.maximum }),
    ]));
    const listed = await request(app).get('/api/cohorts')
      .query({ programId: boundedProgramId, limit: 50 })
      .set('Authorization', `Bearer ${adminToken}`);
    expect(listed.body.rows.find((cohort: { id: string }) => cohort.id === boundedId)).toEqual(response.body.cohort);
    expect(response.body.updatedYouth).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: youth.minimum }), expect.objectContaining({ id: youth.maximum }),
    ]));
  });

  it('returns canonical roster changes without exposing Youth rows to enrollment-only tokens', async () => {
    const token = generateToken(adminId, 'admin', undefined, ['write:enrollments']);
    const enrolled = await request(app).post(`/api/cohorts/${unboundedId}/enrollments`)
      .set('Authorization', `Bearer ${token}`).send({ youthIds: [youth.eligible] });
    expect(enrolled.status).toBe(201);
    expect(enrolled.body.cohort.id).toBe(unboundedId);
    expect(enrolled.body.updatedYouth).toEqual([]);

    const withdrawn = await request(app).patch(`/api/cohorts/${unboundedId}/enrollments/${youth.eligible}/withdraw`)
      .set('Authorization', `Bearer ${token}`);
    expect(withdrawn.status).toBe(200);
    expect(withdrawn.body.cohort.enrolledCount).toBe(enrolled.body.cohort.enrolledCount - 1);
    expect(withdrawn.body.updatedYouth).toEqual([]);
  });

  it('waits for a concurrent program edit and validates its committed age bounds', async () => {
    let pending: Promise<request.Response> | undefined;

    try {
      await sql.begin(async tx => {
        const trx = asTransactionSql(tx);
        const [connection] = await trx<{ pid: number }[]>`SELECT pg_backend_pid() AS pid`;
        await trx`UPDATE programs SET max_age = 13 WHERE id = ${boundedProgramId}`;
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
      const rows = await sql`SELECT 1 FROM cohort_enrollments WHERE cohort_id = ${boundedId} AND youth_id = ${youth.eligible}`;
      expect(rows).toHaveLength(0);
    } finally {
      if (pending) await pending;
      await sql`UPDATE programs SET max_age = 15 WHERE id = ${boundedProgramId}`;
    }
  });
});
