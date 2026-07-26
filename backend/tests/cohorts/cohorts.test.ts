import request from 'supertest';
import { createApp } from '../shared/app';
import { deleteTestUser, seedTestUser, sql } from '../shared/db';
import { generateToken } from '../shared/tokenHelpers';

const app = createApp();

function addDays(date: string, days: number) {
  const value = new Date(`${date}T12:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function weekdayFor(date: string) {
  const weekdays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;
  return weekdays[new Date(`${date}T12:00:00.000Z`).getUTCDay()];
}

describe('Cohorts and attendance API', () => {
  let staffId: string;
  let staffToken: string;
  let youthId: string;
  let secondYouthId: string;
  let programId: string;
  let cohortId: string;
  let sessionId: string;
  let openProgramId: string;
  let openCohortId: string;
  let openSessionId: string;
  let unassignedCohortId: string;
  let today: string;

  beforeAll(async () => {
    const staff = await seedTestUser({ role: 'staff' });
    staffId = staff.userId;
    staffToken = generateToken(staff.userId, 'staff', staff.email);

    const youth = await seedTestUser({ role: 'youth' });
    youthId = youth.userId;
    await sql`
      INSERT INTO youth_profiles (user_id)
      VALUES (${youthId})
    `;
    const secondYouth = await seedTestUser({ role: 'youth' });
    secondYouthId = secondYouth.userId;
    await sql`
      INSERT INTO youth_profiles (user_id)
      VALUES (${secondYouthId})
    `;

    const [program] = await sql<{ id: string }[]>`SELECT id FROM programs WHERE name = 'Soft Skills'`;
    programId = program.id;
    await sql`
      INSERT INTO staff_program_assignments (staff_id, program_id)
      VALUES (${staffId}, ${programId})
    `;
    const [openProgram] = await sql<{ id: string }[]>`SELECT id FROM programs WHERE name = 'Drop In'`;
    openProgramId = openProgram.id;
    const [clock] = await sql<{ today: string }[]>`
      SELECT (CURRENT_TIMESTAMP AT TIME ZONE 'America/Toronto')::date::text AS today
    `;
    today = clock.today;
  });

  afterAll(async () => {
    if (openSessionId) await sql`DELETE FROM attendance_records WHERE session_id = ${openSessionId}`;
    if (openCohortId) await sql`DELETE FROM program_cohorts WHERE id = ${openCohortId}`;
    if (unassignedCohortId) await sql`DELETE FROM program_cohorts WHERE id = ${unassignedCohortId}`;
    if (sessionId) await sql`DELETE FROM attendance_records WHERE session_id = ${sessionId}`;
    if (cohortId) await sql`DELETE FROM cohort_enrollments WHERE cohort_id = ${cohortId}`;
    if (cohortId) await sql`DELETE FROM program_cohorts WHERE id = ${cohortId}`;
    await deleteTestUser(youthId);
    await deleteTestUser(secondYouthId);
    await deleteTestUser(staffId);
  });

  it('creates a dated cohort', async () => {
    const response = await request(app)
      .post('/api/cohorts')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        programId,
        name: `Summer Test ${Date.now()}`,
        startsOn: addDays(today, -7),
        endsOn: addDays(today, 60),
      });

    cohortId = response.body.id;
    expect(response.status).toBe(201);
    expect(response.body).toEqual(expect.objectContaining({
      programId,
      startsOn: addDays(today, -7),
      endsOn: addDays(today, 60),
    }));
  });

  it('blocks cohorts outside the staff program scope', async () => {
    const [jobReadiness] = await sql<{ id: string }[]>`
      SELECT id FROM programs WHERE name = 'Job Readiness'
    `;
    const response = await request(app)
      .post('/api/cohorts')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        programId: jobReadiness.id,
        name: `Blocked ${Date.now()}`,
        startsOn: addDays(today, -7),
        endsOn: addDays(today, 60),
      });

    expect(response.status).toBe(403);
  });

  it('keeps the full cohort lookup available for Youth profile filters', async () => {
    const [jobReadiness] = await sql<{ id: string }[]>`
      SELECT id FROM programs WHERE name = 'Job Readiness'
    `;
    const [unassignedCohort] = await sql<{ id: string }[]>`
      INSERT INTO program_cohorts (program_id, name, starts_on, ends_on)
      VALUES (
        ${jobReadiness.id},
        ${`Profile Filter ${Date.now()}`},
        ${addDays(today, -7)},
        ${addDays(today, 60)}
      )
      RETURNING id
    `;
    unassignedCohortId = unassignedCohort.id;

    const scoped = await request(app)
      .get('/api/cohorts')
      .set('Authorization', `Bearer ${staffToken}`);
    const all = await request(app)
      .get('/api/cohorts?scope=all')
      .set('Authorization', `Bearer ${staffToken}`);

    expect(scoped.body.map((cohort: { id: string }) => cohort.id)).not.toContain(unassignedCohortId);
    expect(all.body.map((cohort: { id: string }) => cohort.id)).toContain(unassignedCohortId);
  });

  it('does not partially enroll a batch containing an unknown youth', async () => {
    const response = await request(app)
      .post(`/api/cohorts/${cohortId}/enrollments`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        youthIds: [youthId, '00000000-0000-0000-0000-000000000000'],
      });

    expect(response.status).toBe(404);
    const enrollments = await sql<{ count: number }[]>`
      SELECT COUNT(*)::int AS count
      FROM cohort_enrollments
      WHERE cohort_id = ${cohortId}
        AND youth_id = ${youthId}
    `;
    expect(enrollments[0].count).toBe(0);
  });

  it('enrolls multiple youth atomically with server-generated dates', async () => {
    const response = await request(app)
      .post(`/api/cohorts/${cohortId}/enrollments`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ youthIds: [youthId, secondYouthId] });

    expect(response.status).toBe(201);
    expect(response.body).toEqual(expect.arrayContaining([
      expect.objectContaining({
        cohortId,
        youthId,
        enrolledOn: today,
        withdrawnOn: null,
      }),
      expect.objectContaining({
        cohortId,
        youthId: secondYouthId,
        enrolledOn: today,
        withdrawnOn: null,
      }),
    ]));
  });

  it('requires a weekday for weekly and biweekly schedules', async () => {
    const response = await request(app)
      .post(`/api/cohorts/${cohortId}/sessions/generate`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        name: 'Missing Weekday',
        frequency: 'weekly',
        startsOn: addDays(today, 1),
        endsOn: addDays(today, 15),
        startTime: '17:00',
        endTime: '19:30',
      });

    expect(response.status).toBe(400);
  });

  it('generates weekly sessions from form input without persisting a schedule', async () => {
    const firstSessionDate = addDays(today, 1);
    const response = await request(app)
      .post(`/api/cohorts/${cohortId}/sessions/generate`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        theme: 'Communication',
        frequency: 'weekly',
        dayOfWeek: weekdayFor(firstSessionDate),
        startsOn: firstSessionDate,
        endsOn: addDays(today, 15),
        startTime: '17:00',
        endTime: '19:30',
      });

    expect(response.status).toBe(201);
    expect(response.body.sessions).toHaveLength(3);
    expect(response.body.sessions[0].theme).toBe('Communication');
    sessionId = response.body.sessions[0].id;

    const dates = await sql<{ localDate: string }[]>`
      SELECT (starts_at AT TIME ZONE 'America/Toronto')::date::text AS local_date
      FROM cohort_sessions
      WHERE cohort_id = ${cohortId} AND theme = 'Communication'
      ORDER BY starts_at
    `;
    expect(dates.map(session => session.localDate)).toEqual([
      firstSessionDate,
      addDays(firstSessionDate, 7),
      addDays(firstSessionDate, 14),
    ]);
  });

  it('generates a session without a theme', async () => {
    const response = await request(app)
      .post(`/api/cohorts/${cohortId}/sessions/generate`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        frequency: 'once',
        startsOn: addDays(today, 2),
        startTime: '13:00',
        endTime: '14:00',
      });

    expect(response.status).toBe(201);
    expect(response.body.sessions).toHaveLength(1);
    expect(response.body.sessions[0].theme).toBeNull();
  });

  it('generates monthly sessions on the selected day of month', async () => {
    const response = await request(app)
      .post(`/api/cohorts/${cohortId}/sessions/generate`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        theme: 'Monthly Workshop',
        frequency: 'monthly',
        dayOfMonth: 15,
        startsOn: addDays(today, 1),
        endsOn: addDays(today, 60),
        startTime: '17:00',
        endTime: '19:30',
      });

    expect(response.status).toBe(201);
    expect(response.body.sessions.length).toBeGreaterThan(0);
    const dates = await sql<{ dayOfMonth: number }[]>`
      SELECT EXTRACT(DAY FROM starts_at AT TIME ZONE 'America/Toronto')::int AS day_of_month
      FROM cohort_sessions
      WHERE cohort_id = ${cohortId} AND theme = 'Monthly Workshop'
    `;
    expect(dates.every(session => session.dayOfMonth === 15)).toBe(true);
  });

  it('creates an open Drop In session with no enrollment roster', async () => {
    const cohort = await request(app)
      .post('/api/cohorts')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        programId: openProgramId,
        name: `Open Drop In ${Date.now()}`,
        startsOn: addDays(today, -7),
        endsOn: addDays(today, 60),
      });
    expect(cohort.status).toBe(201);
    expect(cohort.body.rosterMode).toBe('open');
    openCohortId = cohort.body.id;

    const generated = await request(app)
      .post(`/api/cohorts/${openCohortId}/sessions/generate`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        theme: 'Friday Drop In',
        frequency: 'once',
        startsOn: today,
        startTime: '17:00',
        endTime: '20:00',
      });
    expect(generated.status).toBe(201);
    openSessionId = generated.body.sessions[0].id;

    const roster = await request(app)
      .get(`/api/cohorts/sessions/${openSessionId}/roster`)
      .set('Authorization', `Bearer ${staffToken}`);
    expect(roster.status).toBe(200);
    expect(roster.body).toEqual([]);
  });

  it('checks any youth profile into an open session as attended', async () => {
    const checkedIn = await request(app)
      .put(`/api/cohorts/sessions/${openSessionId}/attendance`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ records: [{ youthId, status: 'present' }] });
    expect(checkedIn.status).toBe(200);
    expect(checkedIn.body).toEqual([
      expect.objectContaining({ youthId, status: 'present' }),
    ]);

    const late = await request(app)
      .put(`/api/cohorts/sessions/${openSessionId}/attendance`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ records: [{ youthId, status: 'late' }] });
    expect(late.status).toBe(409);

    const replaced = await request(app)
      .put(`/api/cohorts/sessions/${openSessionId}/attendance`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ records: [{ youthId: secondYouthId, status: 'present' }] });
    expect(replaced.status).toBe(200);
    expect(replaced.body).toEqual([
      expect.objectContaining({ youthId: secondYouthId, status: 'present' }),
    ]);
  });

  it('rejects enrollment in an open attendance cohort', async () => {
    const directEnrollment = await request(app)
      .post(`/api/cohorts/${openCohortId}/enrollments`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ youthIds: [youthId] });
    expect(directEnrollment.status).toBe(409);

    const checklistEnrollment = await request(app)
      .put(`/api/cohorts/enrollments/${youthId}`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ cohortIds: [openCohortId] });
    expect(checklistEnrollment.status).toBe(409);
  });

  it('reports open-session reach without creating an enrollment', async () => {
    const enrollments = await sql<{ count: number }[]>`
      SELECT COUNT(*)::int AS count
      FROM cohort_enrollments
      WHERE cohort_id = ${openCohortId}
    `;
    expect(enrollments[0].count).toBe(0);

    const overview = await request(app)
      .get(`/api/cohorts?programId=${openProgramId}`)
      .set('Authorization', `Bearer ${staffToken}`);
    expect(overview.status).toBe(200);
    expect(overview.body).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: openCohortId,
        rosterMode: 'open',
        enrolledCount: 0,
        uniqueAttendeeCount: 1,
        attendanceRecordedCount: 1,
      }),
    ]));

    const profile = await request(app)
      .get(`/api/youth?id=${secondYouthId}`)
      .set('Authorization', `Bearer ${staffToken}`);
    expect(profile.status).toBe(200);
    expect(profile.body.cohorts).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: openCohortId,
        programName: 'Drop In',
        rosterMode: 'open',
        enrolledOn: null,
        presentCount: 1,
      }),
    ]));
  });

  it('enforces the cohort date range at the database boundary', async () => {
    await expect(sql`
      INSERT INTO cohort_sessions (cohort_id, theme, starts_at, ends_at)
      VALUES (
        ${cohortId},
        'Outside range',
        ${`${addDays(today, 61)}T21:00:00.000Z`},
        ${`${addDays(today, 61)}T23:30:00.000Z`}
      )
    `).rejects.toBeDefined();

    await expect(sql`
      UPDATE program_cohorts
      SET ends_on = ${addDays(today, 7)}
      WHERE id = ${cohortId}
    `).rejects.toBeDefined();
  });

  it('returns enrolled youth on the session roster and saves attendance', async () => {
    const roster = await request(app)
      .get(`/api/cohorts/sessions/${sessionId}/roster`)
      .set('Authorization', `Bearer ${staffToken}`);

    expect(roster.status).toBe(200);
    expect(roster.body).toEqual(expect.arrayContaining([
      expect.objectContaining({ youthId, status: null }),
    ]));

    const saved = await request(app)
      .put(`/api/cohorts/sessions/${sessionId}/attendance`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        records: [
          { youthId, status: 'present' },
          { youthId: secondYouthId, status: 'present' },
        ],
      });

    expect(saved.status).toBe(200);
    expect(saved.body).toEqual(expect.arrayContaining([
      expect.objectContaining({ youthId, status: 'present' }),
      expect.objectContaining({ youthId: secondYouthId, status: 'present' }),
    ]));
  });

  it('rejects duplicate youth in an attendance replacement', async () => {
    const response = await request(app)
      .put(`/api/cohorts/sessions/${sessionId}/attendance`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        records: [
          { youthId, status: 'present' },
          { youthId, status: 'late' },
        ],
      });

    expect(response.status).toBe(400);
  });

  it('returns cohort overview metrics for Programming', async () => {
    const overview = await request(app)
      .get(`/api/cohorts?programId=${programId}`)
      .set('Authorization', `Bearer ${staffToken}`);
    expect(overview.status).toBe(200);
    expect(overview.body).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: cohortId,
        nextSessionId: sessionId,
        nextSessionAt: expect.any(String),
        averageAttendance: 100,
        minAge: 12,
        maxAge: 15,
      }),
    ]));
  });

  it('lists sessions for management with cohort filters and attendance', async () => {
    const response = await request(app)
      .get(`/api/cohorts/sessions?cohortId=${cohortId}&timing=all&search=Communication`)
      .set('Authorization', `Bearer ${staffToken}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: sessionId,
        cohortId,
        programId,
        theme: 'Communication',
        attendanceMarkedCount: 2,
        attendanceRate: 100,
      }),
    ]));
  });

  it('edits and deletes sessions and cohorts that have no attendance', async () => {
    const cohort = await request(app)
      .post('/api/cohorts')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        programId,
        name: `Disposable ${Date.now()}`,
        startsOn: today,
        endsOn: addDays(today, 10),
      });
    const disposableCohortId = cohort.body.id;
    await request(app)
      .post(`/api/cohorts/${disposableCohortId}/enrollments`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ youthIds: [youthId] });
    const generated = await request(app)
      .post(`/api/cohorts/${disposableCohortId}/sessions/generate`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        theme: 'Disposable Session',
        frequency: 'once',
        startsOn: addDays(today, 1),
        startTime: '17:00',
        endTime: '19:00',
      });
    const disposableSessionId = generated.body.sessions[0].id;

    const updatedSession = await request(app)
      .put(`/api/cohorts/sessions/${disposableSessionId}`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        theme: 'Updated theme',
        startsAt: `${addDays(today, 1)}T21:30:00.000Z`,
        endsAt: `${addDays(today, 1)}T23:00:00.000Z`,
        description: 'Updated description',
      });
    expect(updatedSession.status).toBe(200);
    expect((await sql`SELECT theme FROM cohort_sessions WHERE id = ${disposableSessionId}`)[0].theme)
      .toBe('Updated theme');

    expect((await request(app)
      .delete(`/api/cohorts/sessions/${disposableSessionId}`)
      .set('Authorization', `Bearer ${staffToken}`)).status).toBe(200);

    expect((await request(app)
      .put(`/api/cohorts/${disposableCohortId}`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ name: 'Disposable Updated', startsOn: today, endsOn: addDays(today, 12) })).status)
      .toBe(200);

    expect((await request(app)
      .delete(`/api/cohorts/${disposableCohortId}`)
      .set('Authorization', `Bearer ${staffToken}`)).status).toBe(200);
    expect((await sql`SELECT id FROM cohort_enrollments WHERE cohort_id = ${disposableCohortId}`))
      .toHaveLength(0);
  });

  it('returns a conflict when deleting a session or cohort with attendance', async () => {
    expect((await request(app)
      .delete(`/api/cohorts/sessions/${sessionId}`)
      .set('Authorization', `Bearer ${staffToken}`)).status).toBe(409);
    expect((await request(app)
      .delete(`/api/cohorts/${cohortId}`)
      .set('Authorization', `Bearer ${staffToken}`)).status).toBe(409);
  });

  it('uses attendance foreign keys to block deletion through the cohort tree', async () => {
    await expect(sql`DELETE FROM cohort_sessions WHERE id = ${sessionId}`).rejects.toBeDefined();
    await expect(sql`DELETE FROM program_cohorts WHERE id = ${cohortId}`).rejects.toBeDefined();
  });

  it('clears an existing attendance record when a roster member is not marked', async () => {
    const response = await request(app)
      .put(`/api/cohorts/sessions/${sessionId}/attendance`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ records: [{ youthId, status: 'present' }] });

    expect(response.status).toBe(200);
    expect(response.body).toEqual(expect.arrayContaining([
      expect.objectContaining({ youthId, status: 'present' }),
      expect.objectContaining({ youthId: secondYouthId, status: null }),
    ]));
  });

  it('withdraws a youth without deleting their attendance history', async () => {
    const response = await request(app)
      .patch(`/api/cohorts/${cohortId}/enrollments/${youthId}/withdraw`)
      .set('Authorization', `Bearer ${staffToken}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual(expect.objectContaining({
      cohortId,
      youthId,
      withdrawnOn: today,
    }));

    const attendance = await sql<{ count: number }[]>`
      SELECT COUNT(*)::int AS count
      FROM attendance_records
      WHERE youth_id = ${youthId}
    `;
    expect(attendance[0].count).toBe(1);
  });

  it('synchronizes a youth cohort checklist in one request', async () => {
    const remove = await request(app)
      .put(`/api/cohorts/enrollments/${secondYouthId}`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ cohortIds: [] });
    expect(remove.status).toBe(200);
    expect(remove.body).toEqual(expect.arrayContaining([
      expect.objectContaining({ cohortId, youthId: secondYouthId, withdrawnOn: today }),
    ]));

    const restore = await request(app)
      .put(`/api/cohorts/enrollments/${secondYouthId}`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ cohortIds: [cohortId] });
    expect(restore.status).toBe(200);
    expect(restore.body).toEqual(expect.arrayContaining([
      expect.objectContaining({ cohortId, youthId: secondYouthId, withdrawnOn: null }),
    ]));
  });
});
