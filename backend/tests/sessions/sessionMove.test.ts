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
      (program_id, cycle_id, session_type, theme, date, start_time, end_time, description)
      VALUES (${programId}, ${cycleId}, ${regularType}, 'Keep my theme', '2030-03-03', '17:30:00', '19:30:00', 'Keep my description') RETURNING id`;
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

  /**
   * Requests a date move as the authorized fixture actor unless a scoped token is supplied.
   * @example move('2030-03-10') // keeps the current session's clock times
   */
  const move = (date: string, authToken = token) => request(app).put(`/api/sessions/${sessionId}/date`)
    .set('Authorization', `Bearer ${authToken}`).send({ date });

  it('preserves clock times and newer session details across date moves', async () => {
    const edited = await request(app).put(`/api/sessions/${sessionId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ theme: 'Latest theme', description: 'Latest description', date: '2030-03-03',
        startTime: '17:45', endTime: '19:15' });
    expect(edited.status).toBe(200);

    const response = await move('2030-03-10');
    expect(response.status).toBe(200);
    expect(response.body.session).toMatchObject({ id: sessionId, programId, cycleId,
      date: '2030-03-10', startTime: '17:45', endTime: '19:15',
      theme: 'Latest theme', description: 'Latest description', movable: true });
    const [session] = await sql`SELECT theme, description, session_type FROM program_sessions WHERE id = ${sessionId}`;
    expect(session).toMatchObject({ theme: 'Latest theme', description: 'Latest description', sessionType: regularType });
  });

  it('returns canonical rows after full edits and deletion without stale next-session metadata', async () => {
    const edited = await request(app).put(`/api/sessions/${sessionId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ sessionType: regularType, theme: 'Edited theme', date: '2030-03-03', startTime: '17:45', endTime: '19:15', description: 'Edited description' });

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

  it('enforces ordered whole-minute schedules in the database', async () => {
    await expect(sql`UPDATE program_sessions SET end_time = start_time WHERE id = ${sessionId}`)
      .rejects.toMatchObject({ code: '23514' });
    await expect(sql`UPDATE program_sessions SET start_time = start_time + INTERVAL '1 second' WHERE id = ${sessionId}`)
      .rejects.toMatchObject({ code: '23514' });
  });

  it('preserves saved clock times when moving onto a daylight-saving transition date', async () => {
    await sql`UPDATE program_sessions SET start_time = '02:30', end_time = '04:00' WHERE id = ${sessionId}`;
    const response = await move('2030-03-10');

    expect(response.status).toBe(200);
    expect(response.body.session).toMatchObject({ date: '2030-03-10', startTime: '02:30', endTime: '04:00' });
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

  it('rejects today and past destinations, cancelled sessions, and today and past sources', async () => {
    const [{ today }] = await sql<{ today: string }[]>`SELECT CURRENT_DATE AS today`;
    expect((await move(today)).status).toBe(409);
    expect((await move('2025-03-01')).status).toBe(409);
    await sql`UPDATE program_sessions SET cancelled_at = NOW() WHERE id = ${sessionId}`;
    expect((await move('2030-03-11')).status).toBe(409);
    await sql`UPDATE program_sessions SET cancelled_at = NULL, date = ${today} WHERE id = ${sessionId}`;
    expect((await move('2030-03-11')).status).toBe(409);
    await sql`UPDATE program_sessions SET cancelled_at = NULL, date = '2025-01-01' WHERE id = ${sessionId}`;
    expect((await move('2030-03-11')).status).toBe(409);
  });

  it('rejects unassigned and overlapping destination cycles without writing', async () => {
    expect((await move('2035-01-01')).status).toBe(409);
    const [cycle] = await sql<{ id: string }[]>`INSERT INTO program_cycles (name, starts_on, ends_on)
      VALUES (${`Overlap ${Date.now()}`}, '2030-03-01', '2030-03-31') RETURNING id`;
    try {
      await sql`INSERT INTO program_cycle_assignments (program_id, cycle_id) VALUES (${programId}, ${cycle.id})`;
      expect((await move('2030-03-11')).status).toBe(409);
      const [session] = await sql`SELECT date::text FROM program_sessions WHERE id = ${sessionId}`;
      expect(session.date).toBe('2030-03-03');
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
