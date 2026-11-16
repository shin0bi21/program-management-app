import request from 'supertest';
import { createApp } from '../shared/app';
import { deleteTestUser, seedTestUser, sql } from '../shared/db';
import { generateToken } from '../shared/tokenHelpers';

const app = createApp();
const regularType = 'Regular';

describe('Single session scheduling defaults', () => {
  let userId: string;
  let token: string;
  let programId: string;
  let cycleId: string;

  beforeAll(async () => {
    const user = await seedTestUser({ role: 'admin' });
    userId = user.userId;
    token = generateToken(userId, 'admin', user.email);
    const [program] = await sql<{ id: string }[]>`
      INSERT INTO programs (title, default_start_time, default_end_time)
      VALUES (${`Session defaults ${Date.now()}`}, '17:30', '19:30') RETURNING id
    `;
    programId = program.id;
    const [cycle] = await sql<{ id: string }[]>`
      INSERT INTO program_cycles (title, starts_on, ends_on)
      VALUES (${`Session defaults ${Date.now()}`}, '2020-01-01', '2040-12-31') RETURNING id
    `;
    cycleId = cycle.id;
    await sql`
      INSERT INTO program_cycle_assignments (program_id, cycle_id) VALUES (${programId}, ${cycleId})
    `;
  });

  afterAll(async () => {
    if (programId) await sql`DELETE FROM program_sessions WHERE program_id = ${programId}`;
    if (programId) await sql`DELETE FROM program_cycle_assignments WHERE program_id = ${programId}`;
    if (cycleId) await sql`DELETE FROM program_cycles WHERE id = ${cycleId}`;
    if (programId) await sql`DELETE FROM programs WHERE id = ${programId}`;
    await deleteTestUser(userId);
  });

  /**
   * Creates within the fixture's explicit assignment, retaining per-request overrides.
   * @example create({ date: '2027-01-15' }) // request using program time defaults
   */
  function create(input: Record<string, unknown>, authToken = token) {
    return request(app).post(`/api/programs/${programId}/cycles/${cycleId}/sessions`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ sessionType: regularType, title: `Defaults ${Date.now()}`, ...input });
  }

  /**
   * Creates by program so the service must resolve the cycle from the requested date.
   * @example createForProgram({ date: '2027-01-15' }) // resolves the fixture's assigned cycle
   */
  function createForProgram(input: Record<string, unknown>, authToken = token) {
    return request(app).post('/api/sessions')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ programId, sessionType: regularType, title: 'Resolved session', ...input });
  }

  it('resolves the assigned cycle and saves the supplied date and clock times', async () => {
    const response = await createForProgram({ date: '2027-01-15', startTime: '10:00', endTime: '11:15' });
    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      programId, cycleId, date: '2027-01-15', startTime: '10:00', endTime: '11:15',
    });
  });

  it('resolves a missing date from the program defaults before finding its cycle', async () => {
    const response = await createForProgram({});
    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ programId, cycleId });
    const [scheduled] = await sql<{ weekday: string; time: string }[]>`
      SELECT lower(trim(to_char((date + start_time), 'Day'))) AS weekday,
        to_char((date + start_time), 'HH24:MI') AS time
      FROM program_sessions WHERE id = ${response.body.id}
    `;
    expect(scheduled).toEqual({ weekday: 'tuesday', time: '17:30' });
  });

  it('rejects a date outside assigned cycles and refuses to guess between overlapping cycles', async () => {
    const outside = await createForProgram({ date: '2041-01-01' });
    expect(outside.status).toBe(409);
    expect(JSON.stringify(outside.body)).toContain('No assigned cycle covers');

    const [overlap] = await sql<{ id: string }[]>`
      INSERT INTO program_cycles (title, starts_on, ends_on)
      VALUES (${`Overlapping session cycle ${Date.now()}`}, '2027-01-01', '2027-12-31') RETURNING id
    `;
    await sql`
      INSERT INTO program_cycle_assignments (program_id, cycle_id) VALUES (${programId}, ${overlap.id})
    `;
    try {
      const ambiguous = await createForProgram({ date: '2027-01-15' });
      expect(ambiguous.status).toBe(409);
      expect(JSON.stringify(ambiguous.body)).toContain('Multiple assigned cycles cover');
      const sessions = await sql`SELECT id FROM program_sessions WHERE program_id = ${programId} AND cycle_id = ${overlap.id}`;
      expect(sessions).toHaveLength(0);
    } finally {
      await sql`DELETE FROM program_sessions WHERE program_id = ${programId} AND cycle_id = ${overlap.id}`;
      await sql`DELETE FROM program_cycle_assignments WHERE program_id = ${programId} AND cycle_id = ${overlap.id}`;
      await sql`DELETE FROM program_cycles WHERE id = ${overlap.id}`;
    }
  });

  it('requires the explicit program and cycle pair to be assigned', async () => {
    const [unassigned] = await sql<{ id: string }[]>`
      INSERT INTO program_cycles (title, starts_on, ends_on)
      VALUES (${`Unassigned session cycle ${Date.now()}`}, '2027-01-01', '2027-12-31') RETURNING id
    `;
    try {
      const direct = await request(app)
        .post(`/api/programs/${programId}/cycles/${unassigned.id}/sessions`)
        .set('Authorization', `Bearer ${token}`)
        .send({ sessionType: regularType, title: 'Unassigned pair', date: '2027-01-15' });
      expect(direct.status).toBe(404);
      expect(await sql`SELECT 1 FROM program_sessions WHERE program_id = ${programId} AND cycle_id = ${unassigned.id}`).toHaveLength(0);
    } finally {
      await sql`DELETE FROM program_cycles WHERE id = ${unassigned.id}`;
    }
  });

  it('requires session permission and program access for date-resolved creation', async () => {
    const noPermission = generateToken(userId, 'admin', 'test@test.local', ['read:sessions']);
    const unrelated = generateToken(userId, 'staff', 'test@test.local', ['write:sessions']);
    expect((await createForProgram({ date: '2027-01-12' }, noPermission)).status).toBe(403);
    expect((await createForProgram({ date: '2027-01-12' }, unrelated)).status).toBe(403);
  });

  it('enforces inclusive cycle boundaries using the saved date', async () => {
    const [cycle] = await sql<{ id: string }[]>`
      INSERT INTO program_cycles (title, starts_on, ends_on)
      VALUES (${`Cycle date boundary ${Date.now()}`}, '2027-01-13', '2027-01-13') RETURNING id
    `;
    await sql`
      INSERT INTO program_cycle_assignments (program_id, cycle_id) VALUES (${programId}, ${cycle.id})
    `;
    try {
      const response = await request(app).post(`/api/programs/${programId}/cycles/${cycle.id}/sessions`)
        .set('Authorization', `Bearer ${token}`)
        .send({ sessionType: regularType, title: 'Cycle date boundary', date: '2027-01-13',
          startTime: '22:30', endTime: '23:00' });
      expect(response.status).toBe(201);
      expect(response.body.date).toBe('2027-01-13');
    } finally {
      await sql`DELETE FROM program_sessions WHERE program_id = ${programId} AND cycle_id = ${cycle.id}`;
      await sql`DELETE FROM program_cycle_assignments WHERE program_id = ${programId} AND cycle_id = ${cycle.id}`;
      await sql`DELETE FROM program_cycles WHERE id = ${cycle.id}`;
    }
  });

  it('rejects malformed dates, reversed default times, and dates outside the selected cycle', async () => {
    expect((await create({ date: '2027-02-30' })).status).toBe(400);
    expect((await create({ date: '2027-01-12', startTime: '17:00:30' })).status).toBe(400);
    expect((await create({ date: '2027-01-12', startTime: '20:00' })).status).toBe(409);
    expect((await create({ date: '2041-01-01' })).status).toBe(409);
  });

  it('rejects editing outside the assigned cycle without changing the saved session', async () => {
    const created = await create({ date: '2027-06-01', startTime: '17:00', endTime: '19:00' });
    expect(created.status).toBe(201);

    try {
      const response = await request(app).put(`/api/sessions/${created.body.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Rejected edit', date: '2041-01-01', startTime: '18:00', endTime: '20:00' });
      expect(response.status).toBe(409);
      expect(response.body.error).toBe('Sessions must fall within the cycle date range');

      const [saved] = await sql<{ title: string; date: string; startTime: string; endTime: string }[]>`
        SELECT title, date,
          to_char(start_time, 'HH24:MI') AS start_time,
          to_char(end_time, 'HH24:MI') AS end_time
        FROM program_sessions
        WHERE id = ${created.body.id}
      `;
      expect(saved).toEqual({
        title: created.body.title, date: '2027-06-01', startTime: '17:00', endTime: '19:00',
      });
    } finally {
      await sql`DELETE FROM program_sessions WHERE id = ${created.body.id}`;
    }
  });

  it('requires session write permission and program access', async () => {
    const noPermission = generateToken(userId, 'admin', 'test@test.local', ['read:sessions']);
    const noAssignment = generateToken(userId, 'staff', 'test@test.local', ['write:sessions']);
    expect((await create({ date: '2027-01-12' }, noPermission)).status).toBe(403);
    expect((await create({ date: '2027-01-12' }, noAssignment)).status).toBe(403);
  });
});
