import request from 'supertest';
import { createApp } from '../shared/app';
import { deleteTestUser, seedTestUser, sql } from '../shared/db';
import { generateToken } from '../shared/tokenHelpers';

const app = createApp();
const regularType = 'Regular';

describe('Future session date moves', () => {
  let userId: string;
  let token: string;
  let programId: string;
  let cycleId: string;
  let nextCycleId: string;
  let sessionId: string;

  beforeAll(async () => {
    const user = await seedTestUser({ role: 'admin' });
    userId = user.userId;
    token = generateToken(userId, 'admin', user.email);
    const [program] = await sql<{ id: string }[]>`INSERT INTO programs (name)
      VALUES (${`Move sessions ${Date.now()}`}) RETURNING id`;
    programId = program.id;
    const [cycle] = await sql<{ id: string }[]>`INSERT INTO program_cycles (name, starts_on, ends_on)
      VALUES (${`Move source ${Date.now()}`}, '2020-01-01', '2031-12-31') RETURNING id`;
    const [nextCycle] = await sql<{ id: string }[]>`INSERT INTO program_cycles (name, starts_on, ends_on)
      VALUES (${`Move destination ${Date.now()}`}, '2032-01-01', '2033-12-31') RETURNING id`;
    cycleId = cycle.id;
    nextCycleId = nextCycle.id;
    await sql`INSERT INTO program_cycle_assignments (program_id, cycle_id)
      VALUES (${programId}, ${cycleId})`;
    await sql`INSERT INTO program_cycle_assignments (program_id, cycle_id)
      VALUES (${programId}, ${nextCycleId})`;
  });

  beforeEach(async () => {
    const [session] = await sql<{ id: string }[]>`INSERT INTO program_sessions
      (program_id, cycle_id, session_type, theme, starts_at, ends_at, description)
      VALUES (${programId}, ${cycleId}, ${regularType}, 'Keep my theme', '2030-03-03T22:30:00Z', '2030-03-04T00:30:00Z', 'Keep my description') RETURNING id`;
    sessionId = session.id;
  });
  afterEach(async () => {
    await sql`DELETE FROM session_notes WHERE session_id = ${sessionId}`;
    await sql`DELETE FROM program_sessions WHERE id = ${sessionId}`;
  });
  afterAll(async () => {
    await sql`DELETE FROM program_cycle_assignments WHERE program_id = ${programId}`;
    await sql`DELETE FROM program_cycles WHERE id IN (${cycleId}, ${nextCycleId})`;
    await sql`DELETE FROM programs WHERE id = ${programId}`;
    await deleteTestUser(userId);
  });

  const move = (date: string, authToken = token) => request(app).put(`/api/sessions/${sessionId}/date`)
    .set('Authorization', `Bearer ${authToken}`).send({ date });

  it('preserves local times across DST and leaves unrelated session fields unchanged', async () => {
    const response = await move('2030-03-10');
    expect(response.status).toBe(200);
    expect(response.body.session).toMatchObject({ id: sessionId, programId, cycleId,
      startsAt: '2030-03-10T21:30:00.000Z', endsAt: '2030-03-10T23:30:00.000Z' });
    const [session] = await sql`SELECT theme, description, session_type FROM program_sessions WHERE id = ${sessionId}`;
    expect(session).toMatchObject({ theme: 'Keep my theme', description: 'Keep my description', sessionType: regularType });
  });

  it('returns the canonical session row with fields changed after an earlier client read', async () => {
    await sql`UPDATE program_sessions SET theme = 'Latest authoritative theme', description = 'Latest description'
      WHERE id = ${sessionId}`;

    const response = await move('2030-03-10');

    expect(response.status).toBe(200);
    expect(response.body.session).toMatchObject({
      id: sessionId, programId, cycleId, sessionType: regularType,
      theme: 'Latest authoritative theme', description: 'Latest description',
      enrollmentRequired: true, state: 'upcoming',
    });
    expect(response.body.session.programName).toEqual(expect.any(String));
    expect(response.body.session.sessionType).toEqual(expect.any(String));
  });

  it('returns canonical rows after full edits and deletion without stale next-session metadata', async () => {
    const edited = await request(app).put(`/api/sessions/${sessionId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ sessionType: regularType, theme: 'Edited theme', startsAt: '2030-03-03T22:30:00Z', endsAt: '2030-03-04T00:30:00Z', description: 'Edited description' });

    expect(edited.status).toBe(200);
    expect(edited.body.session).toMatchObject({ id: sessionId, theme: 'Edited theme', programId, cycleId });
    expect(edited.body.updatedProgramCycles).toEqual([expect.objectContaining({ programId, cycleId, nextSessionId: sessionId })]);

    const list = await request(app).get(`/api/sessions?programIds=${programId}&cycleIds=${cycleId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(list.status).toBe(200);
    expect(list.body.find((row: { id: string }) => row.id === sessionId)).toEqual(edited.body.session);

    const removed = await request(app).delete(`/api/sessions/${sessionId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(removed.status).toBe(200);
    expect(removed.body).toMatchObject({ id: sessionId, updatedProgramCycles: [expect.objectContaining({ programId, cycleId, nextSessionId: null })] });
  });

  it('omits cross-area program cycle rows without program-read capability', async () => {
    const writer = generateToken(userId, 'admin', 'session-writer@test.local', ['write:sessions']);

    const response = await move('2030-03-10', writer);

    expect(response.status).toBe(200);
    expect(response.body.session).toMatchObject({ id: sessionId, theme: 'Keep my theme' });
    expect(response.body).not.toHaveProperty('updatedProgramCycles');
  });

  it('preserves the local day span of an overnight session across DST', async () => {
    await sql`UPDATE program_sessions SET ends_at = '2030-03-04T09:00:00Z' WHERE id = ${sessionId}`;
    const response = await move('2030-03-09');
    expect(response.status).toBe(200);
    expect(response.body.session).toMatchObject({ startsAt: '2030-03-09T22:30:00.000Z', endsAt: '2030-03-10T08:00:00.000Z' });
  });

  it('rejects nonexistent and repeated destination wall-clock times', async () => {
    await sql`UPDATE program_sessions SET starts_at = '2030-03-03T07:30:00Z', ends_at = '2030-03-03T09:00:00Z' WHERE id = ${sessionId}`;
    expect((await move('2030-03-10')).status).toBe(409);
    await sql`UPDATE program_sessions SET starts_at = '2030-03-03T06:30:00Z', ends_at = '2030-03-03T08:00:00Z' WHERE id = ${sessionId}`;
    expect((await move('2030-11-03')).status).toBe(409);
  });

  it('resolves another assigned cycle for an unrecorded session', async () => {
    const response = await move('2032-01-12');
    expect(response.status).toBe(200);
    expect(response.body.session).toMatchObject({ programId, cycleId: nextCycleId });
    expect(response.body.updatedProgramCycles).toEqual(expect.arrayContaining([
      expect.objectContaining({ programId, cycleId, nextSessionId: null }),
      expect.objectContaining({ programId, cycleId: nextCycleId, nextSessionId: sessionId }),
    ]));
  });

  it('rejects past sources, cancelled sessions, and past destinations', async () => {
    expect((await move('2025-03-01')).status).toBe(409);
    await sql`UPDATE program_sessions SET cancelled_at = NOW() WHERE id = ${sessionId}`;
    expect((await move('2030-03-11')).status).toBe(409);
    await sql`UPDATE program_sessions SET cancelled_at = NULL, starts_at = '2025-01-01', ends_at = '2025-01-02' WHERE id = ${sessionId}`;
    expect((await move('2030-03-11')).status).toBe(409);
  });

  it('rejects unassigned and overlapping destination cycles without writing', async () => {
    expect((await move('2035-01-01')).status).toBe(409);
    const [cycle] = await sql<{ id: string }[]>`INSERT INTO program_cycles (name, starts_on, ends_on)
      VALUES (${`Overlap ${Date.now()}`}, '2030-03-01', '2030-03-31') RETURNING id`;
    try {
      await sql`INSERT INTO program_cycle_assignments (program_id, cycle_id) VALUES (${programId}, ${cycle.id})`;
      expect((await move('2030-03-11')).status).toBe(409);
      const [session] = await sql`SELECT starts_at FROM program_sessions WHERE id = ${sessionId}`;
      expect(new Date(session.startsAt).toISOString()).toBe('2030-03-03T22:30:00.000Z');
    } finally {
      await sql`DELETE FROM program_cycle_assignments WHERE cycle_id = ${cycle.id}`;
      await sql`DELETE FROM program_cycles WHERE id = ${cycle.id}`;
    }
  });

  it('keeps recorded relationships in their original cycle', async () => {
    await sql`INSERT INTO session_notes (session_id, category, details, created_by, updated_by)
      VALUES (${sessionId}, 'general', 'Planning note', ${userId}, ${userId})`;
    expect((await move('2032-01-12')).status).toBe(409);
    expect((await move('2030-03-11')).status).toBe(200);
  });

  it('validates date-only input and enforces write permission and program access', async () => {
    expect((await move('2030-02-30')).status).toBe(400);
    expect((await move('2030-03-11', generateToken(userId, 'admin', 'none@test.local', ['read:sessions']))).status).toBe(403);
    expect((await move('2030-03-11', generateToken(userId, 'staff', 'none@test.local', ['write:sessions']))).status).toBe(403);
  });
});
