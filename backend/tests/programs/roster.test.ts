import request from 'supertest';
import { createApp } from '../shared/app';
import { deleteTestProgramCycle, deleteTestUser, seedTestProgramCycle, seedTestUser, sql } from '../shared/db';
import { generateToken } from '../shared/tokenHelpers';
import { asTransactionSql } from '../../src/db/client';

const app = createApp();

describe('Program cycle roster eligibility', () => {
  const userIds: string[] = [];
  const programIds: string[] = [];
  type Pair = { programId: string; cycleId: string };
  const pairs: Pair[] = [];
  const youth: Record<string, string> = {};
  let adminId: string;
  let adminToken: string;
  let staffId: string;
  let staffToken: string;
  let unassignedToken: string;
  let boundedProgramId: string;
  let boundedPair: Pair;
  let unboundedPair: Pair;
  let openPair: Pair;
  let otherPair: Pair;
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
    const pair = await seedTestProgramCycle({ programId: program.id });
    pairs.push(pair);
    return pair;
  }

  const loadRoster = (pair = boundedPair, token = adminToken) => request(app)
    .get(`/api/programs/${pair.programId}/cycles/${pair.cycleId}/roster`)
    .set('Authorization', `Bearer ${token}`);

  const enroll = (youthIds: string[], pair = boundedPair) => request(app)
    .post(`/api/programs/${pair.programId}/cycles/${pair.cycleId}/enrollments`)
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
    boundedPair = bounded;
    unboundedPair = await makeProgram('unbounded', true, false);
    openPair = await makeProgram('open', false, false);
    const other = await seedTestProgramCycle({ programId: boundedProgramId });
    pairs.push(other);
    otherPair = other;
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
      INSERT INTO program_enrollments (program_id, cycle_id, youth_id, enrolled_on, withdrawn_on)
      VALUES
        (${boundedPair.programId}, ${boundedPair.cycleId}, ${youth.retained}, (NOW() AT TIME ZONE 'America/Toronto')::date - 30, NULL),
        (${boundedPair.programId}, ${boundedPair.cycleId}, ${youth.withdrawn}, (NOW() AT TIME ZONE 'America/Toronto')::date - 30, (NOW() AT TIME ZONE 'America/Toronto')::date),
        (${otherPair.programId}, ${otherPair.cycleId}, ${youth.eligible}, (NOW() AT TIME ZONE 'America/Toronto')::date, NULL)
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
    for (const pair of pairs) {
      await sql`DELETE FROM program_enrollments WHERE program_id = ${pair.programId} AND cycle_id = ${pair.cycleId}`;
      await deleteTestProgramCycle(pair.programId, pair.cycleId);
    }
    await sql`DELETE FROM user_program_assignments WHERE user_id = ${staffId}`;
    for (const id of programIds) await sql`DELETE FROM programs WHERE id = ${id}`;
    for (const id of userIds) await deleteTestUser(id);
  });

  it('requires authentication', async () => {
    expect((await request(app).get(`/api/programs/${boundedPair.programId}/cycles/${boundedPair.cycleId}/roster`)).status).toBe(401);
  });

  it.each(['read:programs', 'read:youth_profiles'])('requires %s independently', async permission => {
    const remaining = ['read:programs', 'read:youth_profiles'].filter(value => value !== permission);
    const token = generateToken(adminId, 'admin', undefined, remaining);
    expect((await loadRoster(boundedPair, token)).status).toBe(403);
  });

  it('allows administrators and assigned staff while denying unassigned staff', async () => {
    expect((await loadRoster()).status).toBe(200);
    expect((await loadRoster(boundedPair, staffToken)).status).toBe(200);
    expect((await loadRoster(boundedPair, unassignedToken)).status).toBe(403);
  });

  it('validates identifiers and reports missing pairs after program authorization', async () => {
    expect((await loadRoster({ ...boundedPair, cycleId: 'invalid' })).status).toBe(400);
    expect((await loadRoster({ ...boundedPair, cycleId: '00000000-0000-4000-8000-000000000000' })).status).toBe(404);
  });

  it('rejects enrollment roster lookup for open attendance programs', async () => {
    expect((await loadRoster(openPair)).status).toBe(409);
  });

  it('returns inclusive age bounds, authoritative numeric ages, and existing aged-out enrollment', async () => {
    const response = await loadRoster();
    expect(response.status).toBe(200);
    expect(response.body).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: youth.minimum, age: 12 }),
      expect.objectContaining({ id: youth.maximum, age: 15 }),
      expect.objectContaining({ id: youth.retained, age: 18, programCycles: [{ ...boundedPair, withdrawnOn: null }] }),
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
    const response = await loadRoster(unboundedPair);
    expect(response.status).toBe(200);
    expect(response.body).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: youth.unknown, age: null }),
    ]));
    expect((await enroll([youth.unknown], unboundedPair)).status).toBe(201);
  });

  it.each(['young', 'old', 'unknown'])('rejects new bounded enrollment for %s youth', async name => {
    expect((await enroll([youth[name]])).status).toBe(409);
  });

  it('rejects an ineligible batch without inserting eligible members', async () => {
    expect((await enroll([youth.eligible, youth.old])).status).toBe(409);
    const rows = await sql`SELECT 1 FROM program_enrollments WHERE program_id = ${boundedPair.programId} AND cycle_id = ${boundedPair.cycleId} AND youth_id = ${youth.eligible}`;
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
      .query({ programId: boundedProgramId })
      .set('Authorization', `Bearer ${adminToken}`);
    expect(listed.body.find((row: Pair) => row.programId === boundedPair.programId && row.cycleId === boundedPair.cycleId)).toEqual(response.body.programCycle);
    expect(response.body.updatedYouth).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: youth.minimum }), expect.objectContaining({ id: youth.maximum }),
    ]));
  });

  it('returns canonical roster changes without exposing Youth rows to enrollment-only tokens', async () => {
    const token = generateToken(adminId, 'admin', undefined, ['write:enrollments']);
    const enrolled = await request(app).post(`/api/programs/${unboundedPair.programId}/cycles/${unboundedPair.cycleId}/enrollments`)
      .set('Authorization', `Bearer ${token}`).send({ youthIds: [extraYouthIds[0]] });
    expect(enrolled.status).toBe(201);
    expect(enrolled.body.programCycle).toMatchObject(unboundedPair);
    expect(enrolled.body.updatedYouth).toEqual([]);

    const withdrawn = await request(app).patch(`/api/programs/${unboundedPair.programId}/cycles/${unboundedPair.cycleId}/enrollments/${extraYouthIds[0]}/withdraw`)
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
      const rows = await sql`SELECT 1 FROM program_enrollments WHERE program_id = ${boundedPair.programId} AND cycle_id = ${boundedPair.cycleId} AND youth_id = ${youth.eligible}`;
      expect(rows).toHaveLength(0);
    } finally {
      if (pending) await pending;
      await sql`UPDATE programs SET max_age = 15 WHERE id = ${boundedProgramId}`;
    }
  });
});
