import request from 'supertest';
import { createApp } from '../shared/app';
import { deleteTestUser, seedTestUser, sql } from '../shared/db';
import { generateToken } from '../shared/tokenHelpers';

const app = createApp();
const workDate = '2026-08-09';

describe('Time entries API', () => {
  let adminId: string;
  let adminToken: string;
  let firstStaffId: string;
  let firstStaffToken: string;
  let secondStaffId: string;
  let secondStaffToken: string;
  let unrelatedStaffId: string;
  let unrelatedStaffToken: string;
  let programId: string;
  let programName: string;
  let activeCohortId: string;
  let upcomingCohortId: string;
  let activeCycleId: string;
  let upcomingCycleId: string;
  let sessionId: string;
  let assignedTaskId: string | null = null;

  beforeAll(async () => {
    const stamp = Date.now();
    const admin = await seedTestUser({ email: `timesheet-admin-${stamp}@test.local`, role: 'admin' });
    const firstStaff = await seedTestUser({ email: `timesheet-staff-a-${stamp}@test.local`, role: 'staff' });
    const secondStaff = await seedTestUser({ email: `timesheet-staff-b-${stamp}@test.local`, role: 'staff' });
    const unrelatedStaff = await seedTestUser({ email: `timesheet-staff-c-${stamp}@test.local`, role: 'staff' });
    adminId = admin.userId;
    adminToken = generateToken(admin.userId, 'admin', admin.email);
    firstStaffId = firstStaff.userId;
    firstStaffToken = generateToken(firstStaff.userId, 'staff', firstStaff.email);
    secondStaffId = secondStaff.userId;
    secondStaffToken = generateToken(secondStaff.userId, 'staff', secondStaff.email);
    unrelatedStaffId = unrelatedStaff.userId;
    unrelatedStaffToken = generateToken(unrelatedStaff.userId, 'staff', unrelatedStaff.email);
    const programs = await sql<Array<{ id: string; name: string }>>`SELECT id, name FROM programs ORDER BY name LIMIT 1`;
    programId = programs[0].id;
    programName = programs[0].name;
    const cohorts = await sql<Array<{ id: string; cycleId: string }>>`
      WITH cycles AS (
        INSERT INTO program_cycles (name, starts_on, ends_on)
        VALUES
          (${`Active Timesheet ${stamp}`}, CURRENT_DATE - 7, CURRENT_DATE + 7),
          (${`Upcoming Timesheet ${stamp}`}, CURRENT_DATE + 14, CURRENT_DATE + 28)
        RETURNING id, starts_on
      )
      INSERT INTO program_cohorts (program_id, cycle_id)
      SELECT ${programId}, id FROM cycles ORDER BY starts_on
      RETURNING id, cycle_id
    `;
    [activeCohortId, upcomingCohortId] = cohorts.map(cohort => cohort.id);
    [activeCycleId, upcomingCycleId] = cohorts.map(cohort => cohort.cycleId);
    await sql`
      INSERT INTO user_program_assignments (user_id, program_id)
      VALUES (${adminId}, ${programId}), (${firstStaffId}, ${programId}), (${secondStaffId}, ${programId})
    `;
    const [session] = await sql<Array<{ id: string }>>`
      INSERT INTO cohort_sessions (cohort_id, session_type_id, theme, starts_at, ends_at)
      SELECT ${activeCohortId}, type.id, 'Timesheet workshop',
        ${workDate}::date + TIME '10:00', ${workDate}::date + TIME '12:00'
      FROM session_types type
      ORDER BY type.name
      LIMIT 1
      RETURNING id
    `;
    sessionId = session.id;
  });

  afterAll(async () => {
    await sql`DELETE FROM time_entries WHERE staff_id IN (${adminId}, ${firstStaffId}, ${secondStaffId}, ${unrelatedStaffId})`;
    if (assignedTaskId) await sql`DELETE FROM tasks WHERE id = ${assignedTaskId}`;
    await sql`DELETE FROM cohort_sessions WHERE id = ${sessionId}`;
    await sql`DELETE FROM program_cohorts WHERE id IN (${activeCohortId}, ${upcomingCohortId})`;
    await sql`DELETE FROM program_cycles WHERE name LIKE 'Active Timesheet %' OR name LIKE 'Upcoming Timesheet %'`;
    await deleteTestUser(unrelatedStaffId);
    await deleteTestUser(secondStaffId);
    await deleteTestUser(firstStaffId);
    await deleteTestUser(adminId);
  });

  it('allows staff to create and read their own other-time entry', async () => {
    const created = await request(app)
      .post('/api/time-entries')
      .set('Authorization', `Bearer ${firstStaffToken}`)
      .send({ source: 'other', staffId: firstStaffId, programId, cycleId: activeCycleId, category: 'meeting', workDate, hours: 2.5, note: 'Program meeting' });

    expect(created.status).toBe(201);
    expect(created.body).toEqual(expect.objectContaining({ staffId: firstStaffId, category: 'meeting', taskId: null, sessionId: null, hours: 2.5 }));

    const listed = await request(app)
      .get(`/api/time-entries?start=${workDate}&end=${workDate}`)
      .set('Authorization', `Bearer ${firstStaffToken}`);
    expect(listed.status).toBe(200);
    expect(listed.body.resources).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: firstStaffId, writable: true }),
      expect.objectContaining({ id: secondStaffId, writable: false }),
    ]));
    expect(listed.body.resources).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ id: unrelatedStaffId }),
    ]));
    expect(listed.body.programs).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: programId, name: programName }),
    ]));
    expect(listed.body.data[firstStaffId][workDate]).toEqual([
      expect.objectContaining({
        id: created.body.id,
        programId,
        programName,
        note: 'Program meeting',
      }),
    ]);
  });

  it('lists assigned sessions and derives session time metadata', async () => {
    const sessions = await request(app)
      .get(`/api/time-entries/sessions?staffId=${firstStaffId}&workDate=${workDate}`)
      .set('Authorization', `Bearer ${firstStaffToken}`);
    expect(sessions.status).toBe(200);
    expect(sessions.body).toEqual([
      expect.objectContaining({
        id: sessionId, label: 'Timesheet workshop', programId, cycleId: activeCycleId, workDate,
      }),
    ]);

    const created = await request(app)
      .post('/api/time-entries')
      .set('Authorization', `Bearer ${firstStaffToken}`)
      .send({ source: 'session', staffId: firstStaffId, sessionId, hours: 2, note: 'Delivered workshop' });

    expect(created.status).toBe(201);
    expect(created.body).toEqual(expect.objectContaining({
      staffId: firstStaffId,
      sessionId,
      category: 'program_delivery',
      programId,
      cycleId: activeCycleId,
      workDate,
    }));

    const adminSessions = await request(app)
      .get(`/api/time-entries/sessions?staffId=${adminId}&workDate=${workDate}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(adminSessions.status).toBe(200);
    expect(adminSessions.body).toEqual([
      expect.objectContaining({ id: sessionId, label: 'Timesheet workshop', workDate }),
    ]);

    const adminEntry = await request(app)
      .post('/api/time-entries')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ source: 'session', staffId: adminId, sessionId, hours: 1, note: 'Admin delivered workshop' });
    expect(adminEntry.status).toBe(201);
    expect(adminEntry.body).toEqual(expect.objectContaining({
      staffId: adminId, sessionId, category: 'program_delivery', workDate,
    }));
  });

  it('rejects Program Delivery through the Other workflow', async () => {
    const response = await request(app)
      .post('/api/time-entries')
      .set('Authorization', `Bearer ${firstStaffToken}`)
      .send({ source: 'other', staffId: firstStaffId, programId, cycleId: activeCycleId, category: 'program_delivery', workDate, hours: 1, note: 'Wrong workflow' });
    expect(response.status).toBe(400);
  });

  it('enforces a linked source for Program Delivery at the database boundary', async () => {
    await expect(sql`
      INSERT INTO time_entries (
        staff_id, program_id, cycle_id, category, work_date, hours, note
      )
      VALUES (
        ${firstStaffId}, ${programId}, ${activeCycleId}, 'program_delivery',
        ${workDate}, 1, 'Unlinked delivery'
      )
    `).rejects.toMatchObject({ code: '23514' });
  });

  it('returns the complete cycle-based dashboard overview for an authorized staff member', async () => {
    const [cycle] = await sql<Array<{ id: string; periodStart: string; periodEnd: string }>>`
      INSERT INTO program_cycles (name, starts_on, ends_on)
      VALUES (
        'Timesheet Overview Boundary',
        (NOW() AT TIME ZONE 'America/Toronto')::date - 15,
        (NOW() AT TIME ZONE 'America/Toronto')::date + 20
      )
      RETURNING id, (starts_on + 14)::text AS period_start, (starts_on + 27)::text AS period_end
    `;
    try {
      await sql`
        INSERT INTO time_entries (staff_id, cycle_id, category, work_date, hours, note)
        VALUES
          (${firstStaffId}, ${cycle.id}, 'meeting', ${cycle.periodStart}::date - 1, 9, 'Prior period'),
          (${firstStaffId}, ${cycle.id}, 'meeting', ${cycle.periodStart}::date, 2, 'Current meeting'),
          (${firstStaffId}, ${cycle.id}, 'outreach', (NOW() AT TIME ZONE 'America/Toronto')::date, 3, 'Current outreach')
      `;

      const overview = await request(app)
        .get(`/api/time-entries/overview?staffId=${firstStaffId}&cycleId=${cycle.id}`)
        .set('Authorization', `Bearer ${firstStaffToken}`);

      expect(overview.status).toBe(200);
      expect(overview.body).toEqual({
        payPeriod: {
          periodStart: cycle.periodStart,
          periodEnd: cycle.periodEnd,
          totalHours: 5,
          breakdown: [
            { label: 'Outreach', hours: 3 },
            { label: 'Meeting', hours: 2 },
          ],
        },
        biweeklyAverage: {
          periodCount: 2,
          averageHours: 7,
          breakdown: [
            { label: 'Meeting', hours: 5.5 },
            { label: 'Outreach', hours: 1.5 },
          ],
        },
      });
    } finally {
      await sql`DELETE FROM time_entries WHERE cycle_id = ${cycle.id}`;
      await sql`DELETE FROM program_cycles WHERE id = ${cycle.id}`;
    }
  });

  it('conceals dashboard overview data for an unreadable staff resource', async () => {
    const response = await request(app)
      .get(`/api/time-entries/overview?staffId=${unrelatedStaffId}&cycleId=${activeCycleId}`)
      .set('Authorization', `Bearer ${firstStaffToken}`);

    expect(response.status).toBe(404);
  });

  it('returns overview data for a shared-readable staff resource without matching entry metadata', async () => {
    const [entry] = await sql<Array<{ id: string }>>`
      INSERT INTO time_entries (staff_id, cycle_id, category, work_date, hours, note)
      VALUES (${secondStaffId}, ${activeCycleId}, 'meeting', CURRENT_DATE, 2, 'Shared resource overview')
      RETURNING id
    `;
    try {
      const response = await request(app)
        .get(`/api/time-entries/overview?staffId=${secondStaffId}&cycleId=${activeCycleId}`)
        .set('Authorization', `Bearer ${firstStaffToken}`);

      expect(response.status).toBe(200);
      expect(response.body.payPeriod.totalHours).toBe(2);
      expect(response.body.payPeriod.breakdown).toEqual([{ label: 'Meeting', hours: 2 }]);
    } finally {
      await sql`DELETE FROM time_entries WHERE id = ${entry.id}`;
    }
  });

  it('requires the read timesheets permission for dashboard overview data', async () => {
    const token = generateToken(firstStaffId, 'staff', 'timesheet-no-read@test.local', []);
    const response = await request(app)
      .get(`/api/time-entries/overview?staffId=${firstStaffId}&cycleId=${activeCycleId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(403);
  });

  it('returns read-only resource capabilities without writable rows', async () => {
    const readOnlyToken = generateToken(
      adminId,
      'admin',
      'timesheets-read-only@test.local',
      ['read:timesheets'],
    );
    const listed = await request(app)
      .get(`/api/time-entries?start=${workDate}&end=${workDate}`)
      .set('Authorization', `Bearer ${readOnlyToken}`);

    expect(listed.status).toBe(200);
    expect(listed.body.resources).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ writable: true }),
    ]));
  });

  it('requires a cycle', async () => {
    const response = await request(app)
      .post('/api/time-entries')
      .set('Authorization', `Bearer ${firstStaffToken}`)
      .send({ source: 'other', staffId: firstStaffId, category: 'maintenance', workDate, hours: 1, note: 'Office maintenance' });

    expect(response.status).toBe(400);
  });

  it('allows a cycle without a program', async () => {
    const response = await request(app)
      .post('/api/time-entries')
      .set('Authorization', `Bearer ${firstStaffToken}`)
      .send({
        source: 'other',
        staffId: firstStaffId,
        cycleId: activeCycleId,
        category: 'planning_prep',
        workDate,
        hours: 1,
        note: 'Cohort preparation',
      });

    expect(response.status).toBe(201);
    expect(response.body).toEqual(expect.objectContaining({
      programId: null,
      cycleId: activeCycleId,
    }));
  });

  it('loads active cohorts first for the selected program', async () => {
    const response = await request(app)
      .get(`/api/time-entries/cohorts?programId=${programId}`)
      .set('Authorization', `Bearer ${firstStaffToken}`);

    expect(response.status).toBe(200);
    expect(response.body[0]).toEqual(expect.objectContaining({ id: activeCohortId, cycleId: activeCycleId, state: 'active' }));
    expect(response.body).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: upcomingCohortId, cycleId: upcomingCycleId, state: 'upcoming' }),
    ]));
  });

  it('rejects missing notes', async () => {
    const response = await request(app)
      .post('/api/time-entries')
      .set('Authorization', `Bearer ${firstStaffToken}`)
      .send({ source: 'other', staffId: firstStaffId, programId, cycleId: activeCycleId, category: 'meeting', workDate, hours: 1, note: ' ' });
    expect(response.status).toBe(400);
  });

  it('prevents staff from creating entries for another staff member', async () => {
    const response = await request(app)
      .post('/api/time-entries')
      .set('Authorization', `Bearer ${firstStaffToken}`)
      .send({ source: 'other', staffId: secondStaffId, programId, cycleId: activeCycleId, category: 'meeting', workDate, hours: 1, note: 'Team meeting' });
    expect(response.status).toBe(403);
  });

  it('allows admins to create entries for staff and list all staff resources', async () => {
    const created = await request(app)
      .post('/api/time-entries')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ source: 'other', staffId: secondStaffId, programId, cycleId: activeCycleId, category: 'outreach', workDate, hours: 1, note: 'Created campaign materials' });
    expect(created.status).toBe(201);
    expect(created.body.category).toBe('outreach');

    const listed = await request(app)
      .get(`/api/time-entries?start=${workDate}&end=${workDate}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(listed.status).toBe(200);
    expect(listed.body.resources).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: firstStaffId, writable: true }),
      expect.objectContaining({ id: secondStaffId, writable: true }),
    ]));

    const coworkerRead = await request(app)
      .get(`/api/time-entries?start=${workDate}&end=${workDate}`)
      .set('Authorization', `Bearer ${firstStaffToken}`);
    expect(coworkerRead.status).toBe(200);
    expect(coworkerRead.body.data[secondStaffId][workDate]).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: created.body.id, programId, note: 'Created campaign materials' }),
    ]));

    const unrelatedRead = await request(app)
      .get(`/api/time-entries?start=${workDate}&end=${workDate}`)
      .set('Authorization', `Bearer ${unrelatedStaffToken}`);
    expect(unrelatedRead.status).toBe(200);
    expect(unrelatedRead.body.resources).toEqual([
      expect.objectContaining({ id: unrelatedStaffId, writable: true }),
    ]);
    expect(unrelatedRead.body.data[secondStaffId]).toBeUndefined();

    const coworkerUpdate = await request(app)
      .put(`/api/time-entries/${created.body.id}`)
      .set('Authorization', `Bearer ${firstStaffToken}`)
      .send({ source: 'other', staffId: secondStaffId, programId, cycleId: activeCycleId, category: 'outreach', workDate, hours: 2, note: 'Unauthorized edit' });
    expect(coworkerUpdate.status).toBe(403);

    const coworkerDelete = await request(app)
      .delete(`/api/time-entries/${created.body.id}`)
      .set('Authorization', `Bearer ${firstStaffToken}`);
    expect(coworkerDelete.status).toBe(403);
  });

  it('derives task scope for assigned staff time and starts the task', async () => {
    const createdTask = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Create marketing poster',
        details: 'Prepare the fall outreach poster',
        category: 'outreach',
        programId,
        cycleId: activeCycleId,
        status: 'todo',
        startDate: workDate,
        dueDate: workDate,
        staffId: firstStaffId,
      });
    expect(createdTask.status).toBe(201);
    assignedTaskId = createdTask.body.id;

    const unassignedEntry = await request(app)
      .post('/api/time-entries')
      .set('Authorization', `Bearer ${secondStaffToken}`)
      .send({
        source: 'task', staffId: secondStaffId, taskId: assignedTaskId,
        workDate, hours: 1, note: 'Not assigned to this task',
      });
    expect(unassignedEntry.status).toBe(404);

    const linkedEntry = await request(app)
      .post('/api/time-entries')
      .set('Authorization', `Bearer ${firstStaffToken}`)
      .send({
        source: 'task',
        staffId: firstStaffId,
        taskId: assignedTaskId,
        workDate: '2026-08-15',
        hours: 2,
        note: 'Drafted the poster',
      });
    expect(linkedEntry.status).toBe(201);
    expect(linkedEntry.body).toEqual(expect.objectContaining({
      taskId: assignedTaskId,
      taskTitle: 'Create marketing poster',
      category: 'outreach', programId, cycleId: activeCycleId,
    }));

    const startedTask = await request(app)
      .get('/api/tasks?category=outreach')
      .set('Authorization', `Bearer ${firstStaffToken}`);
    expect(startedTask.body).toEqual([
      expect.objectContaining({
        id: assignedTaskId,
        status: 'in_progress',
        hoursLogged: 2,
        loggedHoursByDate: [{ date: '2026-08-15', hours: 2 }],
      }),
    ]);

    const linkedDelete = await request(app)
      .delete(`/api/tasks/${assignedTaskId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(linkedDelete.status).toBe(409);
    expect(linkedDelete.body.error).toBe('Tasks with logged time cannot be deleted');

    const entriesAfterRejectedDelete = await request(app)
      .get('/api/time-entries?start=2026-08-15&end=2026-08-15')
      .set('Authorization', `Bearer ${firstStaffToken}`);
    expect(entriesAfterRejectedDelete.body.data[firstStaffId]['2026-08-15']).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: linkedEntry.body.id, taskId: assignedTaskId, taskTitle: 'Create marketing poster' }),
    ]));
  });

  it('lists all accessible cycle data when no date range is provided', async () => {
    const response = await request(app)
      .get('/api/time-entries')
      .set('Authorization', `Bearer ${firstStaffToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data[firstStaffId][workDate]).toEqual(expect.arrayContaining([
      expect.objectContaining({ cycleId: activeCycleId, note: 'Delivered workshop' }),
    ]));
    expect(response.body.data[secondStaffId][workDate]).toEqual(expect.arrayContaining([
      expect.objectContaining({ cycleId: activeCycleId, note: 'Created campaign materials' }),
    ]));
  });

  it('filters list data by the saved cycle identity rather than its date range', async () => {
    const outsideCycleDate = '2025-01-15';
    const created = await request(app)
      .post('/api/time-entries')
      .set('Authorization', `Bearer ${firstStaffToken}`)
      .send({
        source: 'other',
        staffId: firstStaffId,
        programId: null,
        cycleId: activeCycleId,
        category: 'planning_prep',
        workDate: outsideCycleDate,
        hours: 1,
        note: 'Planning attributed to the active cycle',
      });
    expect(created.status).toBe(201);

    const response = await request(app)
      .get(`/api/time-entries?cycleId=${activeCycleId}`)
      .set('Authorization', `Bearer ${firstStaffToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data[firstStaffId][outsideCycleDate]).toEqual([
      expect.objectContaining({ id: created.body.id, cycleId: activeCycleId }),
    ]);
  });

  it('requires range dates to be provided together', async () => {
    const response = await request(app)
      .get(`/api/time-entries?start=${workDate}`)
      .set('Authorization', `Bearer ${firstStaffToken}`);

    expect(response.status).toBe(400);
  });

  it('preserves newer entry content when calendar placement changes', async () => {
    const created = await request(app)
      .post('/api/time-entries')
      .set('Authorization', `Bearer ${firstStaffToken}`)
      .send({
        source: 'other', staffId: firstStaffId, programId, cycleId: activeCycleId,
        category: 'meeting', workDate, hours: 1, note: 'Original note',
      });
    expect(created.status).toBe(201);

    const contentUpdate = await request(app)
      .put(`/api/time-entries/${created.body.id}`)
      .set('Authorization', `Bearer ${firstStaffToken}`)
      .send({
        source: 'other', staffId: firstStaffId, programId: null, cycleId: activeCycleId,
        category: 'planning_prep', workDate, hours: 2.5, note: 'Newer saved note',
      });
    expect(contentUpdate.status).toBe(200);

    const placementUpdate = await request(app)
      .patch(`/api/time-entries/${created.body.id}/placement`)
      .set('Authorization', `Bearer ${firstStaffToken}`)
      .send({ workDate: '2026-08-10' });

    expect(placementUpdate.status).toBe(200);
    expect(placementUpdate.body).toEqual(expect.objectContaining({
      staffId: firstStaffId,
      programId: null,
      cycleId: activeCycleId,
      category: 'planning_prep',
      workDate: '2026-08-10',
      hours: 2.5,
      note: 'Newer saved note',
    }));
  });

  it('allows staff to update and delete their own entry', async () => {
    const created = await request(app)
      .post('/api/time-entries')
      .set('Authorization', `Bearer ${firstStaffToken}`)
      .send({ source: 'other', staffId: firstStaffId, programId, cycleId: activeCycleId, category: 'meeting', workDate, hours: 1, note: 'Initial note' });

    const updated = await request(app)
      .put(`/api/time-entries/${created.body.id}`)
      .set('Authorization', `Bearer ${firstStaffToken}`)
      .send({ source: 'other', staffId: firstStaffId, programId: null, cycleId: activeCycleId, category: 'planning_prep', workDate, hours: 1.5, note: 'Updated note' });
    expect(updated.status).toBe(200);
    expect(updated.body).toEqual(expect.objectContaining({ programId: null, category: 'planning_prep', hours: 1.5, note: 'Updated note' }));

    const deleted = await request(app)
      .delete(`/api/time-entries/${created.body.id}`)
      .set('Authorization', `Bearer ${firstStaffToken}`);
    expect(deleted.status).toBe(200);
  });

  it('rejects malformed dates and entry IDs as validation errors', async () => {
    const invalidDate = await request(app)
      .get('/api/time-entries?start=2026-99-99&end=2026-99-99')
      .set('Authorization', `Bearer ${firstStaffToken}`);
    const invalidId = await request(app)
      .delete('/api/time-entries/not-a-uuid')
      .set('Authorization', `Bearer ${firstStaffToken}`);

    expect(invalidDate.status).toBe(400);
    expect(invalidId.status).toBe(400);
  });

  it('rejects time-entry ranges larger than one year', async () => {
    const response = await request(app)
      .get('/api/time-entries?start=2025-01-01&end=2026-01-02')
      .set('Authorization', `Bearer ${firstStaffToken}`);

    expect(response.status).toBe(400);
  });
});
