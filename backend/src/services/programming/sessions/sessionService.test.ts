import { randomUUID } from 'node:crypto';
import { ConflictError, NotFoundError } from '../../../errors';
import type { AccessTokenPayload } from '../../../types/auth';
import {
  deleteTestProgramCycle,
  deleteTestUser,
  seedTestProgramCycle,
  seedTestUser,
  sql,
} from '../../../../tests/shared/db';
import { setSession } from './sessionService';

interface ScheduleDates {
  past: string;
  today: string;
  start: string;
  edit: string;
  nextCycle: string;
  outside: string;
}

describe('setSession', () => {
  let user: AccessTokenPayload;
  let programId: string;
  let cycleId: string;
  let nextCycleId: string;
  let dates: ScheduleDates;

  beforeAll(async () => {
    const account = await seedTestUser({ role: 'admin' });
    user = {
      userId: account.userId, email: account.email, role: account.role,
      permissions: ['write:sessions'], tokenType: 'access', jti: randomUUID(), iat: 0, exp: 1,
    };
    const [program] = await sql<{ id: string }[]>`
      INSERT INTO programs (title, default_day_of_week, default_start_time, default_end_time)
      VALUES (${`Session saves ${randomUUID()}`}, 'tuesday', '17:30', '19:30')
      RETURNING id
    `;
    programId = program.id;
    [dates] = await sql<ScheduleDates[]>`
      SELECT CURRENT_DATE - 1 AS past, CURRENT_DATE AS today, CURRENT_DATE + 1 AS start,
        CURRENT_DATE + 8 AS edit, CURRENT_DATE + 21 AS next_cycle, CURRENT_DATE + 35 AS outside
    `;
    const firstCycle = await seedTestProgramCycle({ programId, startsOn: dates.past, endsOn: dates.edit });
    const secondCycle = await seedTestProgramCycle({ programId, startsOn: dates.nextCycle, endsOn: dates.nextCycle });
    cycleId = firstCycle.cycleId;
    nextCycleId = secondCycle.cycleId;
  });

  afterEach(async () => {
    await sql`DELETE FROM audit_log WHERE user_id = ${user.userId} AND table_name IN ('time_entries', 'program_sessions')`;
    await sql`DELETE FROM time_entries WHERE program_id = ${programId}`;
    await sql`
      DELETE FROM session_notes WHERE session_id IN (SELECT id FROM program_sessions WHERE program_id = ${programId})
    `;
    await sql`DELETE FROM program_sessions WHERE program_id = ${programId}`;
  });

  afterAll(async () => {
    await deleteTestProgramCycle(programId, nextCycleId);
    await deleteTestProgramCycle(programId, cycleId);
    await sql`DELETE FROM programs WHERE id = ${programId}`;
    await deleteTestUser(user.userId);
  });

  it('uses program schedule defaults when date and times are omitted', async () => {
    const [defaultDate] = await sql<{ date: string }[]>`
      SELECT CURRENT_DATE + distance AS date
      FROM generate_series(0, 7) AS distances(distance)
      WHERE EXTRACT(DOW FROM CURRENT_DATE + distance) = 2
        AND (distance > 0 OR LOCALTIME < TIME '17:30')
      ORDER BY distance
      LIMIT 1
    `;
    const session = await setSession({ programId, sessionType: 'Regular', title: 'Scheduled workshop' }, user);

    expect(session).toMatchObject({
      programId, cycleId, date: defaultDate.date, startTime: '17:30', endTime: '19:30',
    });
    await expect(setSession({
      programId, sessionType: 'Regular', title: 'Invalid schedule', startTime: '20:00',
    }, user)).rejects.toThrow('End time must be after start time');
  });

  it('preserves the latest full edit when saving a date and resolves the destination cycle', async () => {
    const { id } = await setSession({ programId, sessionType: 'Regular', title: 'Original', date: dates.start }, user);
    await setSession({
      id, sessionType: 'Guest Speaker', title: 'Latest title', description: 'Latest description',
      date: dates.edit, startTime: '02:30', endTime: '04:00',
    }, user);

    const session = await setSession({ id, date: dates.nextCycle }, user);

    expect(session).toMatchObject({
      id, programId, cycleId: nextCycleId, date: dates.nextCycle,
      title: 'Latest title', description: 'Latest description', sessionType: 'Guest Speaker',
      startTime: '02:30', endTime: '04:00',
    });
  });

  it('preserves omitted update fields and clears nullable fields only when supplied as null', async () => {
    const created = await setSession({
      programId, sessionType: 'Regular', title: 'Original', date: dates.start, description: 'Keep this description',
    }, user);
    const edited = await setSession({ id: created.id, title: 'Updated' }, user);

    expect(edited).toMatchObject({
      sessionType: created.sessionType, title: 'Updated', date: created.date,
      startTime: created.startTime, endTime: created.endTime, description: 'Keep this description',
    });

    const cleared = await setSession({ id: created.id, description: null }, user);
    expect(cleared.description).toBeNull();

    const audits = await sql<{ action: string; oldData: Record<string, unknown> | null; newData: Record<string, unknown> | null }[]>`
      SELECT action, old_data, new_data
      FROM audit_log
      WHERE user_id = ${user.userId} AND table_name = 'program_sessions' AND record_id = ${created.id}
    `;
    expect(audits).toHaveLength(3);
    const [createdAudit] = audits.filter(({ action }) => action === 'INSERT');
    const updates = audits.filter(({ action }) => action === 'UPDATE');
    const retainedDescription = updates.find(({ newData }) => newData?.description === 'Keep this description');
    const clearedDescription = updates.find(({ newData }) => newData?.description === null);
    expect(createdAudit).toMatchObject({ oldData: null, newData: expect.objectContaining({ id: created.id, description: 'Keep this description' }) });
    expect(retainedDescription).toMatchObject({ oldData: expect.objectContaining({ description: 'Keep this description' }) });
    expect(clearedDescription).toMatchObject({ oldData: expect.objectContaining({ description: 'Keep this description' }) });
  });

  it('rejects unassigned and overlapping dates without changing the saved session', async () => {
    const input = { programId, sessionType: 'Regular', title: 'Workshop' } as const;
    await expect(setSession({ ...input, date: dates.outside }, user)).rejects.toThrow('No assigned cycle covers');

    const { id } = await setSession({ ...input, date: dates.start }, user);
    await expect(setSession({ id, date: dates.outside }, user)).rejects.toThrow('No assigned cycle covers');
    await expect(setSession({
      id, title: 'Invalid edit', date: dates.nextCycle, startTime: '10:00', endTime: '11:00',
    }, user)).rejects.toThrow('Sessions must fall within the cycle date range');
    const overlap = await seedTestProgramCycle({ programId, startsOn: dates.edit, endsOn: dates.edit });

    try {
      await expect(setSession({ ...input, date: dates.edit }, user)).rejects.toThrow('Multiple assigned cycles cover');
      await expect(setSession({ id, date: dates.edit }, user)).rejects.toThrow('Multiple assigned cycles cover');
      const [saved] = await sql`SELECT date, title FROM program_sessions WHERE id = ${id}`;
      expect(saved).toEqual({ date: dates.start, title: input.title });
    } finally {
      await deleteTestProgramCycle(programId, overlap.cycleId);
    }
  });

  it('only reschedules active sessions between future dates', async () => {
    const { id } = await setSession({ programId, sessionType: 'Regular', title: 'Workshop', date: dates.start }, user);
    for (const date of [dates.today, dates.past]) {
      await expect(setSession({ id, date }, user)).rejects.toThrow('Session destination must be after today');
    }

    await sql`UPDATE program_sessions SET cancelled_at = NOW() WHERE id = ${id}`;
    await expect(setSession({ id, date: dates.edit }, user)).rejects.toBeInstanceOf(ConflictError);
    for (const date of [dates.today, dates.past]) {
      await sql`UPDATE program_sessions SET cancelled_at = NULL, date = ${date} WHERE id = ${id}`;
      await expect(setSession({ id, date: dates.edit }, user)).rejects.toBeInstanceOf(ConflictError);
    }
  });

  it('keeps a session with recorded activity in its original cycle', async () => {
    const { id } = await setSession({ programId, sessionType: 'Regular', title: 'Workshop', date: dates.start }, user);
    await sql`
      INSERT INTO session_notes (session_id, category, details, created_by, updated_by)
      VALUES (${id}, 'general', 'Planning note', ${user.userId}, ${user.userId})
    `;

    await expect(setSession({ id, date: dates.nextCycle }, user)).rejects.toThrow('Sessions with recorded data');
    await expect(setSession({ id, date: dates.edit }, user)).resolves.toMatchObject({ cycleId, date: dates.edit });
  });

  it('updates and audits the work dates of linked hours when the session is rescheduled', async () => {
    const { id } = await setSession({ programId, sessionType: 'Regular', title: 'Workshop', date: dates.start }, user);
    await sql`
      INSERT INTO time_entries (staff_id, program_id, cycle_id, session_id, category, date, hours, note)
      VALUES
        (${user.userId}, ${programId}, ${cycleId}, ${id}, 'program_delivery', ${dates.start}, 1.5, 'Delivery'),
        (${user.userId}, ${programId}, ${cycleId}, ${id}, 'program_delivery', ${dates.start}, 2, 'Additional delivery'),
        (${user.userId}, ${programId}, ${cycleId}, NULL, 'meeting', ${dates.start}, 1, 'Meeting')
    `;

    await expect(setSession({ id, date: dates.nextCycle }, user)).rejects.toThrow('Sessions with recorded data');
    await setSession({ id, date: dates.edit }, user);

    const entries = await sql`
      SELECT session_id, cycle_id, date, hours::double precision, note
      FROM time_entries
      WHERE program_id = ${programId}
      ORDER BY hours
    `;
    expect(entries).toEqual([
      { sessionId: null, cycleId, date: dates.start, hours: 1, note: 'Meeting' },
      { sessionId: id, cycleId, date: dates.edit, hours: 1.5, note: 'Delivery' },
      { sessionId: id, cycleId, date: dates.edit, hours: 2, note: 'Additional delivery' },
    ]);
    const audits = await sql<{ transactionId: string; oldData: unknown; newData: unknown }[]>`
      SELECT transaction_id, old_data, new_data
      FROM audit_log
      WHERE user_id = ${user.userId} AND table_name = 'time_entries' AND action = 'UPDATE'
    `;
    expect(audits).toHaveLength(2);
    expect(new Set(audits.map(row => row.transactionId)).size).toBe(1);
    for (const { oldData, newData } of audits) {
      expect(oldData).toEqual({ sessionId: id, date: dates.start });
      expect(newData).toEqual({ sessionId: id, date: dates.edit });
    }
    const [sessionAudit] = await sql<{ transactionId: string }[]>`
      SELECT transaction_id
      FROM audit_log
      WHERE user_id = ${user.userId} AND table_name = 'program_sessions'
        AND record_id = ${id} AND action = 'UPDATE'
    `;
    expect(sessionAudit.transactionId).toBe(audits[0].transactionId);
  });

  it('requires an existing record for a save with a session ID', async () => {
    await expect(setSession({ id: randomUUID(), date: dates.edit }, user)).rejects.toBeInstanceOf(NotFoundError);
  });

  it('enforces whole-minute ordering at the database boundary', async () => {
    const { id } = await setSession({ programId, sessionType: 'Regular', title: 'Workshop', date: dates.start }, user);

    await expect(sql`UPDATE program_sessions SET end_time = start_time WHERE id = ${id}`)
      .rejects.toMatchObject({ code: '23514' });
    await expect(sql`UPDATE program_sessions SET start_time = start_time + INTERVAL '1 second' WHERE id = ${id}`)
      .rejects.toMatchObject({ code: '23514' });
  });
});
