import crypto from 'crypto';
import request from 'supertest';
import { createApp } from '../shared/app';
import { deleteTestProgramCycle, deleteTestUser, seedTestProgramCycle, seedTestUser, sql } from '../shared/db';
import { generateToken } from '../shared/tokenHelpers';
import { asTransactionSql } from '../../src/db/client';

const app = createApp();

type ProgramCycle = { programId: string; cycleId: string };

/**
 * Checks whether a youth can join one enrollment-based program at a time.
 * Each case creates its own programs and memberships, retaining history until cleanup.
 */
describe('Single enrolled program per youth', () => {
  let adminId: string;
  let token: string;
  let youthIds: string[];
  let pairs: ProgramCycle[];

  beforeAll(async () => {
    const admin = await seedTestUser({ role: 'admin' });
    adminId = admin.userId;
    token = generateToken(adminId, 'admin');
  });

  beforeEach(async () => {
    pairs = [];
    youthIds = [];
    for (let index = 0; index < 2; index += 1) {
      const youth = await seedTestUser({ role: 'youth' });
      youthIds.push(youth.userId);
      await sql`INSERT INTO youth_profiles (user_id) VALUES (${youth.userId})`;
      const [program] = await sql<{ id: string }[]>`
        INSERT INTO programs (title)
        VALUES (${`Single program ${crypto.randomUUID()}`})
        RETURNING id
      `;
      const [today] = await sql<{ date: string }[]>`
        SELECT CURRENT_DATE::text AS date
      `;
      pairs.push(await seedTestProgramCycle({
        programId: program.id,
        startsOn: `${today.date.slice(0, 4)}-01-01`,
        endsOn: `${today.date.slice(0, 4)}-12-31`,
      }));
    }
  });

  afterEach(async () => {
    await sql`DELETE FROM program_enrollments WHERE youth_id = ANY(${sql.array(youthIds)}::uuid[])`;
    const programIds = [...new Set(pairs.map(pair => pair.programId))];
    await sql`DELETE FROM program_cycle_assignments WHERE program_id = ANY(${sql.array(programIds)}::uuid[])`;
    for (const pair of pairs) await deleteTestProgramCycle(pair.programId, pair.cycleId);
    await sql`DELETE FROM programs WHERE id = ANY(${sql.array(programIds)}::uuid[])`;
    for (const youthId of youthIds) await deleteTestUser(youthId);
  });

  afterAll(async () => {
    await deleteTestUser(adminId);
  });

  /**
   * Enrolls selected profiles through the public command.
   * @param pair - Assigned program and cycle to join.
   * @param selectedYouthIds - Complete batch, defaulting to the first test youth.
   * @example enroll(pairs[0]) // enrolls the first youth
   */
  const enroll = (pair: ProgramCycle, selectedYouthIds = [youthIds[0]]) => request(app)
    .post(`/api/programs/${pair.programId}/cycles/${pair.cycleId}/enrollments`)
    .set('Authorization', `Bearer ${token}`)
    .send({ youthIds: selectedYouthIds });

  it('rejects a conflicting batch atomically and keeps its retained membership available for withdrawal', async () => {
    expect((await enroll(pairs[0])).status).toBe(201);

    const roster = await request(app).get(`/api/programs/${pairs[1].programId}/cycles/${pairs[1].cycleId}/roster`)
      .set('Authorization', `Bearer ${token}`);
    expect(roster.status).toBe(200);
    expect(roster.body.map((row: { id: string }) => row.id)).not.toContain(youthIds[0]);
    expect(roster.body.map((row: { id: string }) => row.id)).toContain(youthIds[1]);

    const rejected = await enroll(pairs[1], youthIds);
    expect(rejected.status).toBe(409);
    expect(rejected.body.error).toBe('Youth can only be enrolled in one program at a time');
    expect(await sql`SELECT id FROM program_enrollments WHERE program_id = ${pairs[1].programId}`).toHaveLength(0);

    const retained = await request(app).get(`/api/programs/${pairs[0].programId}/cycles/${pairs[0].cycleId}/roster`)
      .set('Authorization', `Bearer ${token}`);
    expect(retained.body.map((row: { id: string }) => row.id)).toContain(youthIds[0]);
    expect((await request(app)
      .patch(`/api/programs/${pairs[0].programId}/cycles/${pairs[0].cycleId}/enrollments/${youthIds[0]}/withdraw`)
      .set('Authorization', `Bearer ${token}`)).status).toBe(200);
    expect((await enroll(pairs[1])).status).toBe(201);
    expect((await enroll(pairs[0])).status).toBe(409);
  });

  it('permits overlapping cycles within the same program and repeated saves', async () => {
    const [dates] = await sql<{ startsOn: string; endsOn: string }[]>`
      SELECT starts_on, ends_on FROM program_cycles WHERE id = ${pairs[0].cycleId}
    `;
    const secondCycle = await seedTestProgramCycle({ programId: pairs[0].programId, ...dates });
    pairs.push(secondCycle);

    expect((await enroll(pairs[0])).status).toBe(201);
    expect((await enroll(pairs[0])).status).toBe(201);
    expect((await enroll(secondCycle)).status).toBe(201);
  });

  it('preserves nonoverlapping history and treats withdrawal day as exclusive', async () => {
    await sql`UPDATE program_cycles SET starts_on = '2025-01-01', ends_on = '2025-12-31'
      WHERE id = ANY(${sql.array(pairs.map(pair => pair.cycleId))}::uuid[])`;
    await sql`
      INSERT INTO program_enrollments (program_id, cycle_id, youth_id, enrolled_on, withdrawn_on)
      VALUES (${pairs[0].programId}, ${pairs[0].cycleId}, ${youthIds[0]}, '2025-01-01', '2025-06-01'),
        (${pairs[1].programId}, ${pairs[1].cycleId}, ${youthIds[0]}, '2025-06-01', NULL)
    `;

    await expect(sql`
      UPDATE program_enrollments SET withdrawn_on = '2025-06-02'
      WHERE program_id = ${pairs[0].programId} AND youth_id = ${youthIds[0]}
    `).rejects.toMatchObject({ code: '23P01', constraint_name: 'program_enrollments_one_program_per_youth' });
    expect(await sql`SELECT id FROM program_enrollments WHERE youth_id = ${youthIds[0]}`).toHaveLength(2);
  });

  it('clips enrollment to inclusive cycle dates and ignores empty intersections', async () => {
    await sql`UPDATE program_cycles SET starts_on = '2025-01-01', ends_on = '2025-06-01' WHERE id = ${pairs[0].cycleId}`;
    await sql`UPDATE program_cycles SET starts_on = '2025-06-02', ends_on = '2025-12-31' WHERE id = ${pairs[1].cycleId}`;
    await sql`
      INSERT INTO program_enrollments (program_id, cycle_id, youth_id, enrolled_on)
      VALUES (${pairs[0].programId}, ${pairs[0].cycleId}, ${youthIds[0]}, '2025-01-01'),
        (${pairs[1].programId}, ${pairs[1].cycleId}, ${youthIds[0]}, '2025-01-01')
    `;

    await expect(sql`UPDATE program_cycles SET starts_on = '2025-06-01' WHERE id = ${pairs[1].cycleId}`)
      .rejects.toMatchObject({ code: '23P01' });
    await sql`UPDATE program_enrollments SET enrolled_on = '2026-01-01' WHERE program_id = ${pairs[1].programId}`;
    await sql`UPDATE program_cycles SET starts_on = '2025-01-01' WHERE id = ${pairs[1].cycleId}`;
  });

  it('excludes open attendance history and rejects changing its mode into conflicting enrollment', async () => {
    await sql`UPDATE programs SET enrollment_required = FALSE WHERE id = ${pairs[1].programId}`;
    expect((await enroll(pairs[0])).status).toBe(201);
    await sql`INSERT INTO program_enrollments (program_id, cycle_id, youth_id)
      VALUES (${pairs[1].programId}, ${pairs[1].cycleId}, ${youthIds[0]})`;

    const updated = await request(app).put(`/api/programs/${pairs[1].programId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: `Enrollment mode ${crypto.randomUUID()}`, enrollmentRequired: true });
    expect(updated.status).toBe(409);
    expect((await sql`SELECT enrollment_required FROM programs WHERE id = ${pairs[1].programId}`)[0].enrollmentRequired).toBe(false);
    expect((await enroll(pairs[1])).status).toBe(409);
  });

  it('rejects a cycle extension that would overlap another program and rolls back its metadata', async () => {
    await sql`UPDATE program_cycles SET starts_on = '2025-01-01', ends_on = '2025-05-31' WHERE id = ${pairs[0].cycleId}`;
    await sql`UPDATE program_cycles SET starts_on = '2025-06-01', ends_on = '2025-12-31' WHERE id = ${pairs[1].cycleId}`;
    await sql`
      INSERT INTO program_enrollments (program_id, cycle_id, youth_id, enrolled_on)
      VALUES (${pairs[0].programId}, ${pairs[0].cycleId}, ${youthIds[0]}, '2025-01-01'),
        (${pairs[1].programId}, ${pairs[1].cycleId}, ${youthIds[0]}, '2025-01-01')
    `;

    const updated = await request(app).put(`/api/cycles/${pairs[0].cycleId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Conflicting extension', startsOn: '2025-01-01', endsOn: '2025-06-01', programIds: [pairs[0].programId] });
    expect(updated.status).toBe(409);
    expect((await sql`SELECT ends_on FROM program_cycles WHERE id = ${pairs[0].cycleId}`)[0].endsOn).toBe('2025-05-31');
  });

  it('permits only one concurrent cross-program enrollment request', async () => {
    const responses = await Promise.all(pairs.map(pair => enroll(pair)));

    expect(responses.map(response => response.status).sort()).toEqual([201, 409]);
    expect(await sql`SELECT id FROM program_enrollments WHERE youth_id = ${youthIds[0]}`).toHaveLength(1);
  });

  it('also enforces the invariant for concurrent raw inserts', async () => {
    const results = await Promise.allSettled(pairs.map(pair => sql`
      INSERT INTO program_enrollments (program_id, cycle_id, youth_id)
      VALUES (${pair.programId}, ${pair.cycleId}, ${youthIds[0]})
    `));

    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.find(result => result.status === 'rejected');
    expect(rejected).toMatchObject({ status: 'rejected', reason: { code: expect.stringMatching(/^(23P01|40P01)$/) } });
    expect(await sql`SELECT id FROM program_enrollments WHERE youth_id = ${youthIds[0]}`).toHaveLength(1);
  });

  it('prevents bypassing the derived period and preserves parent values', async () => {
    const [programBefore] = await sql`SELECT title, enrollment_required FROM programs WHERE id = ${pairs[0].programId}`;
    const [cycleBefore] = await sql`SELECT updated_at, updated_by FROM program_cycles WHERE id = ${pairs[0].cycleId}`;
    expect((await enroll(pairs[0])).status).toBe(201);
    await sql`UPDATE program_enrollments SET effective_period = 'empty'::daterange WHERE youth_id = ${youthIds[0]}`;

    expect((await enroll(pairs[1])).status).toBe(409);
    expect((await sql`SELECT title, enrollment_required FROM programs WHERE id = ${pairs[0].programId}`)[0]).toEqual(programBefore);
    expect((await sql`SELECT updated_at, updated_by FROM program_cycles WHERE id = ${pairs[0].cycleId}`)[0]).toEqual(cycleBefore);
  });

  it('aborts a stale repeatable-read cycle edit after an enrollment commits', async () => {
    await sql`UPDATE program_cycles SET starts_on = '2025-01-01', ends_on = '2025-05-31' WHERE id = ${pairs[0].cycleId}`;
    await sql`UPDATE program_cycles SET starts_on = '2025-06-01', ends_on = '2025-12-31' WHERE id = ${pairs[1].cycleId}`;
    await sql`INSERT INTO program_enrollments (program_id, cycle_id, youth_id, enrolled_on)
      VALUES (${pairs[1].programId}, ${pairs[1].cycleId}, ${youthIds[0]}, '2025-01-01')`;

    const staleEdit = sql.begin('isolation level repeatable read', async transaction => {
      const trx = asTransactionSql(transaction);
      await trx`SELECT id FROM program_cycles WHERE id = ${pairs[0].cycleId}`;
      await sql`INSERT INTO program_enrollments (program_id, cycle_id, youth_id, enrolled_on)
        VALUES (${pairs[0].programId}, ${pairs[0].cycleId}, ${youthIds[0]}, '2025-01-01')`;
      await trx`UPDATE program_cycles SET ends_on = '2025-06-01' WHERE id = ${pairs[0].cycleId}`;
    });

    await expect(staleEdit).rejects.toMatchObject({ code: '40001' });
    expect((await sql`SELECT ends_on FROM program_cycles WHERE id = ${pairs[0].cycleId}`)[0].endsOn).toBe('2025-05-31');
  });

  it('serializes concurrent program mode changes across shared cycles', async () => {
    await sql`UPDATE programs SET enrollment_required = FALSE WHERE id = ANY(${sql.array(pairs.map(pair => pair.programId))}::uuid[])`;
    await sql`
      INSERT INTO program_cycle_assignments (program_id, cycle_id)
      VALUES (${pairs[0].programId}, ${pairs[1].cycleId}), (${pairs[1].programId}, ${pairs[0].cycleId})
    `;
    const enrollmentIds = Array.from({ length: 4 }, () => crypto.randomUUID()).sort();
    await sql`
      INSERT INTO program_enrollments (id, program_id, cycle_id, youth_id)
      VALUES (${enrollmentIds[0]}, ${pairs[0].programId}, ${pairs[0].cycleId}, ${youthIds[0]}),
        (${enrollmentIds[1]}, ${pairs[0].programId}, ${pairs[1].cycleId}, ${youthIds[0]}),
        (${enrollmentIds[2]}, ${pairs[1].programId}, ${pairs[1].cycleId}, ${youthIds[1]}),
        (${enrollmentIds[3]}, ${pairs[1].programId}, ${pairs[0].cycleId}, ${youthIds[1]})
    `;

    // Child refresh order visits the two shared cycles in opposite directions.
    const responses = await Promise.all(pairs.map(pair => request(app).put(`/api/programs/${pair.programId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: `Mode changed ${pair.programId}`, enrollmentRequired: true })));

    expect(responses.map(response => response.status)).toEqual([200, 200]);
    const programs = await sql`SELECT enrollment_required FROM programs WHERE id = ANY(${sql.array(pairs.map(pair => pair.programId))}::uuid[])`;
    expect(programs).toEqual([{ enrollmentRequired: true }, { enrollmentRequired: true }]);
  });

});
