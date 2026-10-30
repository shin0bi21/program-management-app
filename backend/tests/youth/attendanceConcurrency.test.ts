import crypto from 'crypto';
import request from 'supertest';
import { asTransactionSql } from '../../src/db/client';
import { createApp } from '../shared/app';
import { deleteTestUser, seedTestCohort, seedTestUser, sql } from '../shared/db';
import { generateToken } from '../shared/tokenHelpers';

const app = createApp();

it('serializes Youth attendance saves and same-cohort session moves through the program lock', async () => {
  const userIds: string[] = [];
  let programId: string | undefined;
  let cycleId: string | undefined;
  let cohortId: string | undefined;
  let sessionId: string | undefined;
  let blocker: Promise<unknown> | undefined;
  const requests: Array<Promise<request.Response>> = [];
  let readinessTimer: ReturnType<typeof setTimeout> | undefined;
  let releaseBlocker = () => {};

  try {
    const actor = await seedTestUser({ role: 'admin' });
    userIds.push(actor.userId);
    const youth = await seedTestUser({ role: 'youth' });
    userIds.push(youth.userId);
    await sql`INSERT INTO youth_profiles (user_id, date_of_birth) VALUES (${youth.userId}, '2012-01-01')`;
    const token = generateToken(actor.userId, 'admin');
    const year = new Date().getUTCFullYear() + 2;
    const [program] = await sql<{ id: string }[]>`
      INSERT INTO programs (name) VALUES (${`Attendance lock ${crypto.randomUUID()}`}) RETURNING id
    `;
    programId = program.id;
    const fixture = await seedTestCohort({ programId, startsOn: `${year}-01-01`, endsOn: `${year}-12-31` });
    cohortId = fixture.cohortId;
    cycleId = fixture.cycleId;
    await sql`INSERT INTO cohort_enrollments (cohort_id, youth_id) VALUES (${cohortId}, ${youth.userId})`;
    const [session] = await sql<{ id: string }[]>`
      INSERT INTO cohort_sessions (cohort_id, theme, starts_at, ends_at)
      VALUES (${cohortId}, 'Concurrent attendance', ${`${year}-03-03T22:30:00Z`}, ${`${year}-03-04T00:30:00Z`})
      RETURNING id
    `;
    sessionId = session.id;

    let signalReady!: (pid: number) => void;
    let rejectReady!: (error: unknown) => void;
    const ready = new Promise<number>((resolve, reject) => { signalReady = resolve; rejectReady = reject; });
    const released = new Promise<void>(resolve => { releaseBlocker = resolve; });
    blocker = sql.begin(async tx => {
      const trx = asTransactionSql(tx);
      const [connection] = await trx<{ pid: number }[]>`SELECT pg_backend_pid() AS pid`;
      await trx`SELECT id FROM programs WHERE id = ${programId!} FOR UPDATE`;
      signalReady(connection.pid);
      await released;
    });
    void blocker.catch(rejectReady);
    const blockerPid = await Promise.race([
      ready,
      new Promise<never>((_resolve, reject) => {
        readinessTimer = setTimeout(() => reject(new Error('Program blocker did not become ready')), 3000);
      }),
    ]);
    clearTimeout(readinessTimer);

    requests.push(request(app).put(`/api/youth/${youth.userId}/cohorts/${cohortId}/attendance`)
      .set('Authorization', `Bearer ${token}`)
      .send({ records: [{ sessionId, status: 'present' }] })
      .then(response => response));
    requests.push(request(app).put(`/api/cohorts/sessions/${sessionId}/date`)
      .set('Authorization', `Bearer ${token}`)
      .send({ date: `${year}-03-10` })
      .then(response => response));

    const deadline = Date.now() + 3000;
    let waitingRequests = 0;
    while (Date.now() < deadline) {
      // A second row-lock waiter can queue behind the first waiter, so follow the complete blocking chain.
      const [waiting] = await sql<{ count: number }[]>`
        WITH RECURSIVE blocked AS (
          SELECT activity.pid, ARRAY[activity.pid] AS path
          FROM pg_stat_activity activity
          WHERE ${blockerPid} = ANY(pg_blocking_pids(activity.pid))
          UNION ALL
          SELECT activity.pid, blocked.path || activity.pid
          FROM pg_stat_activity activity
          INNER JOIN blocked ON blocked.pid = ANY(pg_blocking_pids(activity.pid))
          WHERE NOT activity.pid = ANY(blocked.path)
        )
        SELECT COUNT(DISTINCT pid)::int AS count FROM blocked
      `;
      waitingRequests = waiting.count;
      if (waitingRequests === 2) break;
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    expect(waitingRequests).toBe(2);

    // Neither command may hold the cohort while it is waiting to enter through the program lock.
    await sql.begin(async tx => {
      await asTransactionSql(tx)`SELECT id FROM program_cohorts WHERE id = ${cohortId!} FOR UPDATE NOWAIT`;
    });
    releaseBlocker();
    await blocker;
    const [attendance, moved] = await Promise.all(requests);

    expect(attendance.status).toBe(200);
    expect(moved.status).toBe(200);
    expect(attendance.body.youth.id).toBe(youth.userId);
    expect(attendance.body.updatedSessions).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: sessionId, cohortId, attendedCount: 1 }),
    ]));
    expect(moved.body.session).toEqual(expect.objectContaining({ id: sessionId, cohortId, theme: 'Concurrent attendance' }));
    const [stored] = await sql<{ date: string; status: string }[]>`
      SELECT (session.starts_at AT TIME ZONE 'America/Toronto')::date::text AS date, attendance.status
      FROM cohort_sessions session
      INNER JOIN attendance_records attendance ON attendance.session_id = session.id
      WHERE session.id = ${sessionId} AND attendance.youth_id = ${youth.userId}
    `;
    expect(stored).toEqual({ date: `${year}-03-10`, status: 'present' });
  } finally {
    clearTimeout(readinessTimer);
    releaseBlocker();
    await Promise.allSettled([...(blocker ? [blocker] : []), ...requests]);
    if (sessionId) {
      await sql`DELETE FROM attendance_records WHERE session_id = ${sessionId}`;
      await sql`DELETE FROM cohort_sessions WHERE id = ${sessionId}`;
    }
    if (cohortId) {
      await sql`DELETE FROM cohort_enrollments WHERE cohort_id = ${cohortId}`;
      await sql`DELETE FROM program_cohorts WHERE id = ${cohortId}`;
    }
    if (cycleId) await sql`DELETE FROM program_cycles WHERE id = ${cycleId}`;
    if (programId) await sql`DELETE FROM programs WHERE id = ${programId}`;
    for (const id of userIds) await deleteTestUser(id);
  }
});
