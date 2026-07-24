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
  let activityId: string;
  let monthlyActivityId: string;
  let sessionId: string;
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
    const [clock] = await sql<{ today: string }[]>`
      SELECT (CURRENT_TIMESTAMP AT TIME ZONE 'America/Toronto')::date::text AS today
    `;
    today = clock.today;
  });

  afterAll(async () => {
    if (sessionId) await sql`DELETE FROM attendance_records WHERE session_id = ${sessionId}`;
    if (cohortId) await sql`DELETE FROM cohort_enrollments WHERE cohort_id = ${cohortId}`;
    if (monthlyActivityId) await sql`DELETE FROM cohort_activities WHERE id = ${monthlyActivityId}`;
    if (activityId) await sql`DELETE FROM cohort_activities WHERE id = ${activityId}`;
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
      .post(`/api/cohorts/${cohortId}/activities/generate`)
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
      .post(`/api/cohorts/${cohortId}/activities/generate`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        name: 'Weekly Soft Skills',
        focus: 'Communication',
        frequency: 'weekly',
        dayOfWeek: weekdayFor(firstSessionDate),
        startsOn: firstSessionDate,
        endsOn: addDays(today, 15),
        startTime: '17:00',
        endTime: '19:30',
      });

    expect(response.status).toBe(201);
    expect(response.body.sessions).toHaveLength(3);
    expect(response.body.sessions[0].focus).toBe('Communication');
    activityId = response.body.activityId;
    sessionId = response.body.sessions[0].id;

    const dates = await sql<{ localDate: string }[]>`
      SELECT (starts_at AT TIME ZONE 'America/Toronto')::date::text AS local_date
      FROM cohort_sessions
      WHERE activity_id = ${activityId}
      ORDER BY starts_at
    `;
    expect(dates.map(session => session.localDate)).toEqual([
      firstSessionDate,
      addDays(firstSessionDate, 7),
      addDays(firstSessionDate, 14),
    ]);
  });

  it('generates monthly sessions on the selected day of month', async () => {
    const response = await request(app)
      .post(`/api/cohorts/${cohortId}/activities/generate`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        name: 'Monthly Workshop',
        frequency: 'monthly',
        dayOfMonth: 15,
        startsOn: addDays(today, 1),
        endsOn: addDays(today, 60),
        startTime: '17:00',
        endTime: '19:30',
      });

    expect(response.status).toBe(201);
    expect(response.body.sessions.length).toBeGreaterThan(0);
    monthlyActivityId = response.body.activityId;

    const dates = await sql<{ dayOfMonth: number }[]>`
      SELECT EXTRACT(DAY FROM starts_at AT TIME ZONE 'America/Toronto')::int AS day_of_month
      FROM cohort_sessions
      WHERE activity_id = ${monthlyActivityId}
    `;
    expect(dates.every(session => session.dayOfMonth === 15)).toBe(true);
  });

  it('enforces the cohort date range at the database boundary', async () => {
    await expect(sql`
      INSERT INTO cohort_sessions (activity_id, starts_at, ends_at)
      VALUES (
        ${activityId},
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
        focus: 'Communication',
        attendanceMarkedCount: 2,
        attendanceRate: 100,
      }),
    ]));
  });

  it('uses attendance foreign keys to block deletion through the cohort tree', async () => {
    await expect(sql`DELETE FROM cohort_sessions WHERE id = ${sessionId}`).rejects.toBeDefined();
    await expect(sql`DELETE FROM cohort_activities WHERE id = ${activityId}`).rejects.toBeDefined();
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
