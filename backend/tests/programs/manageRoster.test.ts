import request from 'supertest';
import { createApp } from '../shared/app';
import { deleteTestProgramCycle, deleteTestUser, seedTestProgramCycle, seedTestUser, sql } from '../shared/db';
import { generateToken } from '../shared/tokenHelpers';

const app = createApp();

describe('Manage roster submission', () => {
  let adminId: string;
  let staffId: string;
  let unassignedId: string;
  let adminToken: string;
  let programId: string;
  let cycleId: string;
  let youthIds: string[];

  beforeAll(async () => {
    adminId = (await seedTestUser({ role: 'admin' })).userId;
    staffId = (await seedTestUser({ role: 'staff' })).userId;
    unassignedId = (await seedTestUser({ role: 'staff' })).userId;
    adminToken = generateToken(adminId, 'admin');
  });

  beforeEach(async () => {
    youthIds = [];
    const [program] = await sql<{ id: string }[]>`
      INSERT INTO programs (name, enrollment_required)
      VALUES ('Manage roster transaction test', TRUE)
      RETURNING id
    `;
    programId = program.id;
    ({ cycleId } = await seedTestProgramCycle({ programId }));
    await sql`INSERT INTO user_program_assignments (user_id, program_id) VALUES (${staffId}, ${programId})`;
    for (let index = 0; index < 3; index += 1) {
      const youth = await seedTestUser({ role: 'youth' });
      youthIds.push(youth.userId);
      await sql`INSERT INTO youth_profiles (user_id, date_of_birth) VALUES (${youth.userId}, CURRENT_DATE - INTERVAL '14 years')`;
    }
    await sql`
      INSERT INTO program_enrollments (program_id, cycle_id, youth_id, enrolled_on)
      SELECT ${programId}, ${cycleId}, youth_id, CURRENT_DATE - 30
      FROM UNNEST(${sql.array(youthIds.slice(0, 2))}::uuid[]) AS selected(youth_id)
    `;
  });

  afterEach(async () => {
    await sql`DELETE FROM audit_log WHERE user_id = ANY(${sql.array([adminId, staffId])}::uuid[])`;
    await sql`DELETE FROM program_enrollments WHERE program_id = ${programId}`;
    await sql`DELETE FROM user_program_assignments WHERE program_id = ${programId}`;
    await deleteTestProgramCycle(programId, cycleId);
    await sql`DELETE FROM programs WHERE id = ${programId}`;
    for (const id of youthIds) await deleteTestUser(id);
  });

  afterAll(async () => {
    for (const id of [adminId, staffId, unassignedId]) await deleteTestUser(id);
  });

  /**
   * Submits the complete roster selection to the public endpoint.
   * @param selected - Youth IDs to retain or enroll.
   * @param token - Authenticated caller, defaulting to this suite's administrator.
   * @example save([]) // withdraws both initial members
   */
  const save = (selected: string[], token = adminToken) => request(app)
    .put(`/api/programs/${programId}/cycles/${cycleId}/roster`)
    .set('Authorization', `Bearer ${token}`)
    .send({ youthIds: selected });

  it('diffs current membership, preserves retained dates, and groups changes in one audited transaction', async () => {
    const [retainedBefore] = await sql`SELECT * FROM program_enrollments WHERE youth_id = ${youthIds[0]}`;
    const response = await save([youthIds[0], youthIds[2]]);
    expect(response.status).toBe(200);
    expect(response.body.programCycle).toMatchObject({ programId, cycleId, enrolledCount: 2 });
    expect(response.body.updatedYouth.map((profile: { id: string }) => profile.id).sort()).toEqual([youthIds[1], youthIds[2]].sort());

    const [retainedAfter] = await sql`SELECT * FROM program_enrollments WHERE youth_id = ${youthIds[0]}`;
    expect(retainedAfter).toEqual(retainedBefore);
    const [withdrawn] = await sql`SELECT withdrawn_on = CURRENT_DATE AS withdrawn FROM program_enrollments WHERE youth_id = ${youthIds[1]}`;
    expect(withdrawn.withdrawn).toBe(true);
    const audits = await sql`SELECT transaction_id, action FROM audit_log WHERE user_id = ${adminId}`;
    expect(audits).toHaveLength(2);
    expect(new Set(audits.map(row => row.transactionId)).size).toBe(1);
    expect(audits.map(row => row.action).sort()).toEqual(['INSERT', 'UPDATE']);
  });

  it('withdraws an empty selection and can re-enroll a previously withdrawn member', async () => {
    expect((await save([])).status).toBe(200);
    expect(await sql`SELECT id FROM program_enrollments WHERE program_id = ${programId} AND withdrawn_on IS NULL`).toHaveLength(0);
    expect((await save([youthIds[0]])).status).toBe(200);
    expect(await sql`SELECT id FROM program_enrollments WHERE program_id = ${programId} AND withdrawn_on IS NULL`).toHaveLength(1);
  });

  it('rejects an ineligible addition without withdrawing unchecked members or auditing changes', async () => {
    await sql`UPDATE programs SET min_age = 12, max_age = 13 WHERE id = ${programId}`;
    const response = await save([youthIds[0], youthIds[2]]);
    expect(response.status).toBe(409);
    expect(await sql`SELECT id FROM program_enrollments WHERE program_id = ${programId} AND withdrawn_on IS NULL`).toHaveLength(2);
    expect(await sql`SELECT id FROM audit_log WHERE user_id = ${adminId}`).toHaveLength(0);
    // Retained members are allowed even after aging out; saving them does not rewrite their dates.
    expect((await save(youthIds.slice(0, 2))).status).toBe(200);
  });

  it('requires authentication and write permission independently from read access', async () => {
    expect((await request(app).put(`/api/programs/${programId}/cycles/${cycleId}/roster`).send({ youthIds: [] })).status).toBe(401);
    const reader = generateToken(adminId, 'admin', undefined, ['read:programs', 'read:youth_profiles']);
    expect((await save([], reader)).status).toBe(403);
    const writer = generateToken(adminId, 'admin', undefined, ['write:enrollments']);
    const response = await save(youthIds.slice(0, 2), writer);
    expect(response.status).toBe(200);
    expect(response.body.updatedYouth).toEqual([]);
  });

  it('allows assigned staff and rejects unrelated staff', async () => {
    expect((await save(youthIds.slice(0, 2), generateToken(staffId, 'staff'))).status).toBe(200);
    expect((await save([], generateToken(unassignedId, 'staff'))).status).toBe(403);
  });

  it('validates duplicate and malformed IDs and rejects open attendance rosters', async () => {
    expect((await save([youthIds[0], youthIds[0]])).status).toBe(400);
    expect((await save(['invalid'])).status).toBe(400);
    await sql`UPDATE programs SET enrollment_required = FALSE WHERE id = ${programId}`;
    expect((await save([])).status).toBe(409);
  });
});
