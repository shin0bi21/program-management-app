import request from 'supertest';
import { createApp } from '../shared/app';
import { deleteTestUser, seedTestUser, sql } from '../shared/db';
import { generateToken } from '../shared/tokenHelpers';

const app = createApp();
const regularType = '00000000-0000-4000-8000-000000000001';

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
      INSERT INTO programs (name, default_start_time, default_end_time)
      VALUES (${`Session defaults ${Date.now()}`}, '17:30', '19:30') RETURNING id
    `;
    programId = program.id;
    const [cycle] = await sql<{ id: string }[]>`
      INSERT INTO program_cycles (name, starts_on, ends_on)
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

  function create(input: Record<string, unknown>, authToken = token) {
    return request(app).post(`/api/programs/${programId}/cycles/${cycleId}/sessions`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ sessionTypeId: regularType, theme: `Defaults ${Date.now()}`, ...input });
  }

  function createForProgram(input: Record<string, unknown>, authToken = token) {
    return request(app).post('/api/sessions')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ programId, sessionTypeId: regularType, theme: 'Resolved session', ...input });
  }

  it('resolves the assigned cycle by program and date and preserves explicit local times', async () => {
    const response = await createForProgram({ date: '2027-01-15', startTime: '10:00', endTime: '11:15' });
    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ programId, cycleId });
    expect(response.body.startsAt).toBe('2027-01-15T15:00:00.000Z');
    expect(response.body.endsAt).toBe('2027-01-15T16:15:00.000Z');
  });

  it('resolves a missing date from the program defaults before finding its cycle', async () => {
    const response = await createForProgram({});
    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ programId, cycleId });
    const [scheduled] = await sql<{ weekday: string; time: string }[]>`
      SELECT lower(trim(to_char(starts_at AT TIME ZONE 'America/Toronto', 'Day'))) AS weekday,
        to_char(starts_at AT TIME ZONE 'America/Toronto', 'HH24:MI') AS time
      FROM program_sessions WHERE id = ${response.body.id}
    `;
    expect(scheduled).toEqual({ weekday: 'tuesday', time: '17:30' });
  });

  it('rejects a date outside assigned cycles and refuses to guess between overlapping cycles', async () => {
    const outside = await createForProgram({ date: '2041-01-01' });
    expect(outside.status).toBe(409);
    expect(JSON.stringify(outside.body)).toContain('No assigned cycle covers');

    const [overlap] = await sql<{ id: string }[]>`
      INSERT INTO program_cycles (name, starts_on, ends_on)
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
      INSERT INTO program_cycles (name, starts_on, ends_on)
      VALUES (${`Unassigned session cycle ${Date.now()}`}, '2027-01-01', '2027-12-31') RETURNING id
    `;
    try {
      const direct = await request(app)
        .post(`/api/programs/${programId}/cycles/${unassigned.id}/sessions`)
        .set('Authorization', `Bearer ${token}`)
        .send({ sessionTypeId: regularType, theme: 'Unassigned pair', date: '2027-01-15' });
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
    expect((await createForProgram({ programId: 'invalid' })).status).toBe(400);
  });

  it('preserves supplied dates and converts program local times across daylight saving', async () => {
    const winter = await create({ date: '2027-01-12' });
    const summer = await create({ date: '2027-07-13' });

    expect(winter.status).toBe(201);
    expect(winter.body.startsAt).toBe('2027-01-12T22:30:00.000Z');
    expect(winter.body.endsAt).toBe('2027-01-13T00:30:00.000Z');
    expect(summer.status).toBe(201);
    expect(summer.body.startsAt).toBe('2027-07-13T21:30:00.000Z');
  });

  it('uses explicit times and a non-default weekday unchanged', async () => {
    const response = await create({ date: '2027-01-15', startTime: '10:00', endTime: '11:15' });

    expect(response.status).toBe(201);
    expect(response.body.startsAt).toBe('2027-01-15T15:00:00.000Z');
    expect(response.body.endsAt).toBe('2027-01-15T16:15:00.000Z');
  });

  it('resolves the default date using the Toronto clock', async () => {
    const [clock] = await sql<{ timezone: string; today: string; weekday: string; nextWeek: string; localTime: string }[]>`
      SELECT 'America/Toronto' AS timezone,
        (CURRENT_TIMESTAMP AT TIME ZONE 'America/Toronto')::date::text AS today,
        to_char(CURRENT_TIMESTAMP AT TIME ZONE 'America/Toronto', 'HH24:MI:SS') AS local_time,
        lower(trim(to_char(CURRENT_TIMESTAMP AT TIME ZONE 'America/Toronto', 'Day'))) AS weekday,
        ((CURRENT_TIMESTAMP AT TIME ZONE 'America/Toronto')::date + 7)::text AS next_week
    `;
    await sql`UPDATE programs SET timezone = ${clock.timezone}, default_day_of_week = ${clock.weekday},
      default_start_time = '22:00', default_end_time = '23:00' WHERE id = ${programId}`;
    const before = await create({ theme: 'Before default time' });
    expect(before.status).toBe(201);
    const [beforeDate] = await sql<{ date: string }[]>`
      SELECT (starts_at AT TIME ZONE ${clock.timezone})::date::text AS date
      FROM program_sessions WHERE id = ${before.body.id}
    `;
    expect(beforeDate.date).toBe(clock.localTime < '22:00:00' ? clock.today : clock.nextWeek);

    await sql`UPDATE programs SET default_start_time = '00:00', default_end_time = '01:00'
      WHERE id = ${programId}`;
    const after = await create({ theme: 'After default time' });
    expect(after.status).toBe(201);
    const [afterDate] = await sql<{ date: string }[]>`
      SELECT (starts_at AT TIME ZONE ${clock.timezone})::date::text AS date
      FROM program_sessions WHERE id = ${after.body.id}
    `;
    expect(afterDate.date).toBe(clock.nextWeek);
    await sql`UPDATE programs SET timezone = 'America/Toronto', default_day_of_week = 'tuesday',
      default_start_time = '17:30', default_end_time = '19:30' WHERE id = ${programId}`;
  });

  it('enforces cycle boundaries in the program timezone', async () => {
    const [cycle] = await sql<{ id: string }[]>`
      INSERT INTO program_cycles (name, starts_on, ends_on)
      VALUES (${`Timezone boundary ${Date.now()}`}, '2027-01-13', '2027-01-13') RETURNING id
    `;
    await sql`
      INSERT INTO program_cycle_assignments (program_id, cycle_id) VALUES (${programId}, ${cycle.id})
    `;
    try {
      const response = await request(app).post(`/api/programs/${programId}/cycles/${cycle.id}/sessions`)
        .set('Authorization', `Bearer ${token}`)
        .send({ sessionTypeId: regularType, theme: 'Timezone boundary', date: '2027-01-13',
          startTime: '22:30', endTime: '23:00' });
      expect(response.status).toBe(201);
      expect(response.body.startsAt).toBe('2027-01-14T03:30:00.000Z');
    } finally {
      await sql`DELETE FROM program_sessions WHERE program_id = ${programId} AND cycle_id = ${cycle.id}`;
      await sql`DELETE FROM program_cycle_assignments WHERE program_id = ${programId} AND cycle_id = ${cycle.id}`;
      await sql`DELETE FROM program_cycles WHERE id = ${cycle.id}`;
      await sql`UPDATE programs SET timezone = 'America/Toronto' WHERE id = ${programId}`;
    }
  });

  it('rejects invalid input, reversed effective times, and dates outside the cycle', async () => {
    expect((await create({ date: '2027-02-30' })).status).toBe(400);
    expect((await create({ date: '2027-01-12', startTime: '25:00' })).status).toBe(400);
    expect((await create({ date: '2027-01-12', startTime: '20:00' })).status).toBe(409);
    expect((await create({ date: '2041-01-01' })).status).toBe(409);
  });

  it('rejects a local time skipped by daylight saving', async () => {
    const response = await create({ date: '2027-03-14', startTime: '02:30', endTime: '04:00' });
    expect(response.status).toBe(409);
  });

  it('rejects a local time repeated by daylight saving', async () => {
    const response = await create({ date: '2027-11-07', startTime: '01:30', endTime: '03:00' });
    expect(response.status).toBe(409);
  });

  it('requires session write permission and program access', async () => {
    const noPermission = generateToken(userId, 'admin', 'test@test.local', ['read:sessions']);
    const noAssignment = generateToken(userId, 'staff', 'test@test.local', ['write:sessions']);
    expect((await create({ date: '2027-01-12' }, noPermission)).status).toBe(403);
    expect((await create({ date: '2027-01-12' }, noAssignment)).status).toBe(403);
  });
});
