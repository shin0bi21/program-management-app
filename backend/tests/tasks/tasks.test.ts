import request from 'supertest';
import { createApp } from '../shared/app';
import { deleteTestUser, seedTestUser, sql } from '../shared/db';
import { generateToken } from '../shared/tokenHelpers';
import { getTaskRows } from '../../src/services/staff/tasks/taskRowQuery';
import type { AccessTokenPayload } from '../../src/types/auth';

const app = createApp();

describe('Tasks API', () => {
  let taskDate: string;
  let loggedDate: string;
  let adminId: string;
  let adminToken: string;
  let firstStaffId: string;
  let firstStaffToken: string;
  let secondStaffId: string;
  let secondStaffToken: string;
  let unrelatedStaffId: string;
  let unrelatedStaffToken: string;
  let programId: string;
  let cycleId: string;
  const taskIds = new Set<string>();

  /**
   * Tracks a created task for suite cleanup and returns its response.
   * @param response - Task request response, possibly without an ID after failure.
   * @example rememberTask(response).body.id
   */
  const rememberTask = <T extends { body: { id?: string } }>(response: T) => {
    if (response.body.id) taskIds.add(response.body.id);
    return response;
  };

  /**
   * Shifts a business date using PostgreSQL calendar arithmetic.
   * @param date - Starting business date.
   * @param days - Signed number of calendar days.
   * @example await shiftDate('2026-08-10', 1) // '2026-08-11'
   */
  const shiftDate = async (date: string, days: number) => {
    const [shifted] = await sql<{ date: string }[]>`SELECT ${date}::date + ${days}::integer AS date`;
    return shifted.date;
  };

  beforeAll(async () => {
    const stamp = Date.now();
    const [dates] = await sql<Array<{ taskDate: string; loggedDate: string }>>`
      SELECT
        CURRENT_DATE::text AS task_date,
        (CURRENT_DATE + 1)::text AS logged_date
    `;
    ({ taskDate, loggedDate } = dates);
    const admin = await seedTestUser({ email: `tasks-admin-${stamp}@test.local`, role: 'admin' });
    const firstStaff = await seedTestUser({
      email: `tasks-staff-a-${stamp}@test.local`, firstName: 'Zoe', lastName: 'Wilson', role: 'staff',
    });
    const secondStaff = await seedTestUser({
      email: `tasks-staff-b-${stamp}@test.local`, firstName: 'Alex', lastName: 'Smith', role: 'staff',
    });
    const unrelatedStaff = await seedTestUser({
      email: `tasks-staff-c-${stamp}@test.local`, firstName: 'Jamie', lastName: 'Unrelated', role: 'staff',
    });
    adminId = admin.userId;
    adminToken = generateToken(admin.userId, 'admin', admin.email);
    firstStaffId = firstStaff.userId;
    firstStaffToken = generateToken(firstStaff.userId, 'staff', firstStaff.email);
    secondStaffId = secondStaff.userId;
    secondStaffToken = generateToken(secondStaff.userId, 'staff', secondStaff.email);
    unrelatedStaffId = unrelatedStaff.userId;
    unrelatedStaffToken = generateToken(unrelatedStaff.userId, 'staff', unrelatedStaff.email);
    const programs = await sql<Array<{ id: string }>>`SELECT id FROM programs ORDER BY name LIMIT 1`;
    programId = programs[0].id;
    const cycles = await sql<Array<{ id: string }>>`
      INSERT INTO program_cycles (name, starts_on, ends_on)
      VALUES (
        ${`Tasks API ${stamp}`},
        LEAST(${taskDate}::date - 7, '2024-01-01'::date),
        GREATEST(${taskDate}::date + 28, '2027-12-31'::date)
      )
      RETURNING id
    `;
    cycleId = cycles[0].id;
    await sql`INSERT INTO program_cycle_assignments (program_id, cycle_id) VALUES (${programId}, ${cycleId})`;
    await sql`
      INSERT INTO user_program_assignments (user_id, program_id)
      VALUES (${firstStaffId}, ${programId}), (${secondStaffId}, ${programId})
    `;
  });

  afterAll(async () => {
    const ids = [...taskIds];
    if (ids.length) {
      await sql`DELETE FROM time_entries WHERE task_id IN ${sql(ids)}`;
      await sql`DELETE FROM tasks WHERE id IN ${sql(ids)}`;
      await sql`DELETE FROM audit_log WHERE table_name = 'tasks' AND record_id IN ${sql(ids)}`;
    }
    await sql`DELETE FROM program_cycle_assignments WHERE program_id = ${programId} AND cycle_id = ${cycleId}`;
    await sql`DELETE FROM program_cycles WHERE id = ${cycleId}`;
    await deleteTestUser(unrelatedStaffId);
    await deleteTestUser(secondStaffId);
    await deleteTestUser(firstStaffId);
    await deleteTestUser(adminId);
  });

  it('lets project managers manage their own tasks and read shared staff without employee-wide writes', async () => {
    const manager = await seedTestUser({ role: 'project_manager' });
    const token = generateToken(manager.userId, 'project_manager', manager.email);
    const createdIds: string[] = [];

    try {
      await sql`INSERT INTO user_program_assignments (user_id, program_id) VALUES (${manager.userId}, ${programId})`;
      const payload = { title: 'Project manager task', category: 'outreach', startDate: taskDate, dueDate: taskDate };
      const own = await request(app).post('/api/tasks')
        .set('Authorization', `Bearer ${token}`).send({ ...payload, staffId: manager.userId });
      if (own.body.id) createdIds.push(own.body.id);
      expect(own.status).toBe(201);
      expect(own.body.staffId).toBe(manager.userId);

      const denied = await request(app).post('/api/tasks')
        .set('Authorization', `Bearer ${token}`).send({ ...payload, staffId: firstStaffId });
      expect(denied.status).toBe(403);

      const shared = await request(app).post('/api/tasks')
        .set('Authorization', `Bearer ${adminToken}`).send({ ...payload, staffId: firstStaffId });
      if (shared.body.id) createdIds.push(shared.body.id);
      expect(shared.status).toBe(201);

      const readable = await request(app).get(`/api/tasks/${shared.body.id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(readable.status).toBe(200);
      expect(readable.body).toMatchObject({ id: shared.body.id, staffId: firstStaffId, writable: false });
      const deniedStatus = await request(app).patch(`/api/tasks/${shared.body.id}/state`)
        .set('Authorization', `Bearer ${token}`).send({ state: 'completed' });
      expect(deniedStatus.status).toBe(404);
    } finally {
      if (createdIds.length) {
        await sql`DELETE FROM tasks WHERE id IN ${sql(createdIds)}`;
        await sql`DELETE FROM audit_log WHERE table_name = 'tasks' AND record_id IN ${sql(createdIds)}`;
      }
      await deleteTestUser(manager.userId);
    }
  });

  it('keeps staff scope inside the canonical query without caller-supplied permission filters', async () => {
    const createdIds: string[] = [];
    for (const staffId of [firstStaffId, secondStaffId, unrelatedStaffId]) {
      const created = rememberTask(await request(app).post('/api/tasks')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: 'Canonical scope check', category: 'outreach', startDate: taskDate, dueDate: taskDate, staffId }));
      expect(created.status).toBe(201);
      createdIds.push(created.body.id);
    }
    const actor: AccessTokenPayload = {
      userId: firstStaffId, email: 'scope-check@test.local', role: 'staff',
      permissions: ['read:tasks'], tokenType: 'access', jti: 'scope-check', iat: 0, exp: 1,
    };

    const ownAndShared = await getTaskRows(actor);
    expect(ownAndShared.filter(row => createdIds.includes(row.id)).map(row => row.id).sort())
      .toEqual(createdIds.slice(0, 2).sort());
    expect(await getTaskRows(actor, sql`task.id = ${createdIds[2]}`)).toEqual([]);
    const broadFilter = await getTaskRows(actor, sql`TRUE OR task.id = ${createdIds[2]}`);
    expect(broadFilter.some(row => row.id === createdIds[2])).toBe(false);
    const adminRows = await getTaskRows({ ...actor, userId: adminId, role: 'admin' });
    expect(adminRows.filter(row => createdIds.includes(row.id)).map(row => row.id).sort())
      .toEqual([...createdIds].sort());
  });

  it('requires explicit task capabilities at the route boundary', async () => {
    const writeOnlyToken = generateToken(adminId, 'admin', 'tasks-write-only@test.local', ['write:tasks']);
    const readOnlyToken = generateToken(adminId, 'admin', 'tasks-read-only@test.local', ['read:tasks']);

    const deniedRead = await request(app)
      .get('/api/tasks')
      .set('Authorization', `Bearer ${writeOnlyToken}`);
    const deniedWrite = await request(app)
      .patch('/api/tasks/00000000-0000-4000-8000-000000000000/placement')
      .set('Authorization', `Bearer ${readOnlyToken}`)
      .send({ startDate: taskDate, dueDate: taskDate });
    const readOnlyOptions = await request(app)
      .get('/api/reference-data/staff?feature=tasks')
      .set('Authorization', `Bearer ${readOnlyToken}`);

    expect(deniedRead.status).toBe(403);
    expect(deniedWrite.status).toBe(403);
    expect(readOnlyOptions.status).toBe(200);
    expect(readOnlyOptions.body).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ writable: true }),
    ]));
  });

  describe('direct task reads', () => {
    it('requires authentication and read capability, validates IDs, and conceals missing records', async () => {
      const missingId = '00000000-0000-4000-8000-000000000000';
      const writeOnlyToken = generateToken(adminId, 'admin', 'tasks-write-only@test.local', ['write:tasks']);

      const unauthenticated = await request(app).get(`/api/tasks/${missingId}`);
      expect(unauthenticated.status).toBe(401);

      const denied = await request(app)
        .get(`/api/tasks/${missingId}`)
        .set('Authorization', `Bearer ${writeOnlyToken}`);
      expect(denied.status).toBe(403);

      const invalid = await request(app)
        .get('/api/tasks/not-a-uuid')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(invalid.status).toBe(400);

      const missing = await request(app)
        .get(`/api/tasks/${missingId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(missing.status).toBe(404);
      expect(missing.body.error).toBe('Task not found');
    });

    it('reads own and shared-staff member tasks regardless of task program metadata and conceals unrelated tasks', async () => {
      const created = rememberTask(await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${firstStaffToken}`)
        .send({
          title: 'Directly readable general task', category: 'outreach',
          startDate: taskDate, dueDate: taskDate, staffId: firstStaffId,
        }));
      expect(created.status).toBe(201);
      expect(Object.keys(created.body).sort()).toEqual([
        'id', 'title', 'details', 'category', 'categoryLabel',
        'staffId', 'firstName', 'lastName', 'programId', 'program',
        'state', 'status', 'statusLabel', 'startDate', 'dueDate',
        'hoursLogged', 'loggedHoursByDate', 'completedAt', 'writable',
      ].sort());
      expect(created.body).toMatchObject({
        staffId: firstStaffId, firstName: 'Zoe', lastName: 'Wilson', state: 'open',
      });
      for (const endpoint of ['list', 'calendar']) {
        const collection = await request(app).get(`/api/tasks/${endpoint}`)
          .query({ staffIds: firstStaffId, search: 'Directly readable general task', start: taskDate, end: taskDate })
          .set('Authorization', `Bearer ${firstStaffToken}`);
        expect(collection.status).toBe(200);
        expect(endpoint === 'list' ? collection.body.rows : collection.body).toEqual([created.body]);
      }

      for (const [token, writable] of [[firstStaffToken, true], [secondStaffToken, false], [adminToken, true]] as const) {
        const result = await request(app)
          .get(`/api/tasks/${created.body.id}`)
          .set('Authorization', `Bearer ${token}`);
        expect(result.status).toBe(200);
        expect(result.body).toEqual({ ...created.body, writable });
      }

      const unrelated = await request(app)
        .get(`/api/tasks/${created.body.id}`)
        .set('Authorization', `Bearer ${unrelatedStaffToken}`);
      expect(unrelated.status).toBe(404);
      expect(unrelated.body.error).toBe('Task not found');
    });

    it('returns current hours and completed state after logging hours, and includes cancelled tasks', async () => {
      const created = rememberTask(await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${firstStaffToken}`)
        .send({
          title: 'Task refreshed after hours save', category: 'outreach',
          startDate: taskDate, dueDate: taskDate, staffId: firstStaffId,
        }));
      expect(created.status).toBe(201);

      const hours = await request(app)
        .post('/api/hours')
        .set('Authorization', `Bearer ${firstStaffToken}`)
        .send({
          source: 'task', staffId: firstStaffId, taskId: created.body.id, completeTask: true,
          date: taskDate, hours: 2, note: 'Finished task',
        });
      expect(hours.status).toBe(201);

      const completed = await request(app)
        .get(`/api/tasks/${created.body.id}`)
        .set('Authorization', `Bearer ${firstStaffToken}`);
      expect(completed.status).toBe(200);
      expect(hours.body.updatedTasks[0]).toEqual(completed.body);
      expect(completed.body).toEqual({
        ...created.body,
        state: 'completed', status: 'completed', statusLabel: 'Completed',
        completedAt: expect.any(String), hoursLogged: 2,
        loggedHoursByDate: [{ date: taskDate, hours: 2 }],
      });

      const reopened = await request(app)
        .patch(`/api/tasks/${created.body.id}/state`)
        .set('Authorization', `Bearer ${firstStaffToken}`)
        .send({ state: 'open' });
      expect(reopened.status).toBe(200);

      const cancelled = await request(app)
        .patch(`/api/tasks/${created.body.id}/state`)
        .set('Authorization', `Bearer ${firstStaffToken}`)
        .send({ state: 'cancelled' });
      expect(cancelled.status).toBe(200);

      const result = await request(app)
        .get(`/api/tasks/${created.body.id}`)
        .set('Authorization', `Bearer ${firstStaffToken}`);
      expect(result.status).toBe(200);
      expect(result.body).toEqual(cancelled.body);
    });
  });

  it('reads every task in a visible staff member row while keeping staff writes self-scoped', async () => {
    const ownTask = rememberTask(await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${firstStaffToken}`)
      .send({
        title: 'Staff-owned task', details: 'Owned by the authenticated staff member',
        category: 'outreach', startDate: taskDate, dueDate: taskDate,
        staffId: firstStaffId,
      }));
    expect(ownTask.status).toBe(201);
    expect(ownTask.body).toEqual(expect.objectContaining({
      staffId: firstStaffId, firstName: 'Zoe', lastName: 'Wilson',
    }));

    const otherCreate = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${firstStaffToken}`)
      .send({
        title: 'Other staff task', category: 'outreach',
        startDate: taskDate, dueDate: taskDate, staffId: secondStaffId,
      });
    expect(otherCreate.status).toBe(403);

    const otherRead = await request(app)
      .get('/api/tasks')
      .set('Authorization', `Bearer ${secondStaffToken}`);
    expect(otherRead.status).toBe(200);
    expect(otherRead.body).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: ownTask.body.id, programId: null, writable: false }),
    ]));

    const unrelatedRead = await request(app)
      .get('/api/tasks')
      .set('Authorization', `Bearer ${unrelatedStaffToken}`);
    expect(unrelatedRead.status).toBe(200);
    expect(unrelatedRead.body).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ id: ownTask.body.id }),
    ]));

    const otherUpdate = await request(app)
      .patch(`/api/tasks/${ownTask.body.id}/state`)
      .set('Authorization', `Bearer ${secondStaffToken}`)
      .send({ state: 'completed' });
    expect(otherUpdate.status).toBe(404);

    const otherDelete = await request(app)
      .delete(`/api/tasks/${ownTask.body.id}`)
      .set('Authorization', `Bearer ${secondStaffToken}`);
    expect(otherDelete.status).toBe(404);

    const ownDelete = await request(app)
      .delete(`/api/tasks/${ownTask.body.id}`)
      .set('Authorization', `Bearer ${firstStaffToken}`);
    expect(ownDelete.status).toBe(204);
    taskIds.delete(ownTask.body.id);
  });

  it('searches the task table by title', async () => {
    const marker = `Paginated task ${firstStaffId}`;
    for (const suffix of ['A', 'B']) {
      const created = rememberTask(await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${firstStaffToken}`)
        .send({
          title: `${marker} ${suffix}`, category: 'outreach', startDate: taskDate, dueDate: taskDate,
          staffId: firstStaffId,
        }));
      expect(created.status).toBe(201);
    }

    const response = await request(app)
      .get(`/api/tasks/list?search=${encodeURIComponent(marker)}`)
      .set('Authorization', `Bearer ${firstStaffToken}`);
    expect(response.status).toBe(200);
    expect(response.body.rows).toHaveLength(2);
    expect(response.body.rows).toEqual(expect.arrayContaining([
      expect.objectContaining({ title: `${marker} A` }), expect.objectContaining({ title: `${marker} B` }),
    ]));
  });

  it('searches tasks by their displayed category label', async () => {
    const created = rememberTask(await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: `Category search target ${firstStaffId}`,
        category: 'planning_prep',
        startDate: taskDate,
        dueDate: taskDate,
        staffId: firstStaffId,
      }));
    expect(created.status).toBe(201);

    const response = await request(app)
      .get(`/api/tasks/list?staffIds=${firstStaffId}&search=${encodeURIComponent('Planning / Prep')}`)
      .set('Authorization', `Bearer ${firstStaffToken}`);

    expect(response.status).toBe(200);
    expect(response.body.rows).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: created.body.id, category: 'planning_prep' }),
    ]));
  });

  it('filters the task list by readable staff', async () => {
    const marker = `Staff-filtered task ${firstStaffId}`;
    const firstTask = rememberTask(await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: `${marker} first`, category: 'outreach', startDate: taskDate, dueDate: taskDate,
        staffId: firstStaffId,
      }));
    const secondTask = rememberTask(await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: `${marker} second`, category: 'outreach', startDate: taskDate, dueDate: taskDate,
        staffId: secondStaffId,
      }));
    expect(firstTask.status).toBe(201);
    expect(secondTask.status).toBe(201);

    const response = await request(app)
      .get(`/api/tasks/list?staffIds=${secondStaffId}&search=${encodeURIComponent(marker)}`)
      .set('Authorization', `Bearer ${firstStaffToken}`);

    expect(response.status).toBe(200);
    expect(response.body.rows).toEqual([
      expect.objectContaining({ id: secondTask.body.id, staffId: secondStaffId }),
    ]);
  });

  it('filters open tasks by their date-derived timing state', async () => {
    const marker = `Timing-filtered task ${firstStaffId}`;
    const cases = [
      { status: 'upcoming', label: 'Upcoming', title: `${marker} upcoming`, startDate: await shiftDate(taskDate, 1), dueDate: await shiftDate(taskDate, 2) },
      { status: 'in_progress', label: 'In Progress', title: `${marker} in progress`, startDate: await shiftDate(taskDate, -1), dueDate: await shiftDate(taskDate, 1) },
      { status: 'overdue', label: 'Overdue', title: `${marker} overdue`, startDate: await shiftDate(taskDate, -2), dueDate: await shiftDate(taskDate, -1) },
    ] as const;

    for (const taskCase of cases) {
      const created = rememberTask(await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: taskCase.title,
          category: 'outreach',
          startDate: taskCase.startDate,
          dueDate: taskCase.dueDate,
          staffId: firstStaffId,
        }));
      expect(created.status).toBe(201);
      expect(created.body).toMatchObject({ state: 'open', status: taskCase.status, statusLabel: taskCase.label });
    }

    for (const taskCase of cases) {
      const response = await request(app)
        .get(`/api/tasks/list?search=${encodeURIComponent(marker)}&statuses=${taskCase.status}`)
        .set('Authorization', `Bearer ${firstStaffToken}`);

      expect(response.status).toBe(200);
      expect(response.body.rows).toEqual([
        expect.objectContaining({
          title: taskCase.title,
          state: 'open',
          status: taskCase.status,
          statusLabel: taskCase.label,
        }),
      ]);

      const calendar = await request(app)
        .get(`/api/tasks/calendar?start=${await shiftDate(taskDate, -3)}&end=${await shiftDate(taskDate, 3)}&search=${encodeURIComponent(marker)}&statuses=${taskCase.status}`)
        .set('Authorization', `Bearer ${firstStaffToken}`);

      expect(calendar.status).toBe(200);
      expect(calendar.body).toEqual([
        expect.objectContaining({ title: taskCase.title, state: 'open', status: taskCase.status, statusLabel: taskCase.label }),
      ]);
    }
  });

  it('rejects the obsolete active task status filter', async () => {
    for (const endpoint of [
      '/api/tasks/list?statuses=active',
      `/api/tasks/calendar?start=${taskDate}&end=${taskDate}&statuses=active`,
    ]) {
      const response = await request(app).get(endpoint)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(400);
      expect(response.body.details).toEqual(expect.arrayContaining([
        expect.objectContaining({ field: 'query.statuses.0' }),
      ]));
    }
  });

  it('validates required task dates and date boundaries', async () => {
    const missingDates = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Missing dates', category: 'outreach', staffId: firstStaffId });
    expect(missingDates.status).toBe(400);

    const reversedDates = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Reversed dates', category: 'outreach',
        startDate: '2026-08-11', dueDate: '2026-08-10', staffId: firstStaffId,
      });
    expect(reversedDates.status).toBe(400);
    expect(reversedDates.body.details).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: 'body.dueDate', message: 'Due date must be on or after start date' }),
    ]));

    await expect(sql`
      INSERT INTO tasks (title, category, state, start_date, due_date)
      VALUES ('Ownerless task', 'outreach', 'open', ${taskDate}, ${taskDate})
    `).rejects.toMatchObject({ code: '23502' });

    const malformedId = await request(app)
      .delete('/api/tasks/not-a-uuid')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(malformedId.status).toBe(400);
  });

  it('intersects task dates with selected cycle spans and endpoint ranges independently of program membership', async () => {
    const cycles = await sql<Array<{ id: string }>>`
      INSERT INTO program_cycles (name, starts_on, ends_on) VALUES
        ('Tasks early boundary', '2081-01-01', '2081-01-31'),
        ('Tasks late boundary', '2081-03-01', '2081-03-31')
      RETURNING id
    `;
    const create = async (title: string, startDate: string, dueDate: string, linkedProgramId: string | null) => {
      const response = rememberTask(await request(app).post('/api/tasks')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: `Cycle resolution ${title}`, category: 'outreach', startDate, dueDate, staffId: firstStaffId, programId: linkedProgramId }));
      expect(response.status).toBe(201);
      return response.body.id as string;
    };

    try {
      const early = await create('general boundary', '2080-12-30', '2081-01-01', null);
      const gap = await create('gap', '2081-02-15', '2081-02-15', programId);
      const late = await create('program without cycle assignment', '2081-03-31', '2081-04-02', programId);
      await create('outside', '2081-04-03', '2081-04-03', null);
      const spanning = await create('spans disjoint windows', '2080-01-01', '2082-01-01', null);

      for (const endpoint of ['list', 'calendar']) {
        const read = async (cycleIds: string, start = '2081-01-01', end = '2081-03-31') => {
          const response = await request(app).get(`/api/tasks/${endpoint}`)
            .query({ cycleIds, start, end, staffIds: firstStaffId, search: 'Cycle resolution' })
            .set('Authorization', `Bearer ${adminToken}`);
          expect(response.status).toBe(200);
          const rows = endpoint === 'list' ? response.body.rows : response.body;
          return rows.map((task: { id: string }) => task.id) as string[];
        };

        expect((await read(cycles.map(cycle => cycle.id).join(','))).sort()).toEqual([early, gap, late, spanning].sort());
        expect((await read(cycles[0].id)).sort()).toEqual([early, spanning].sort());
        expect(await read(cycles[0].id, '2081-03-01', '2081-03-31')).toEqual([]);
        expect(await read('00000000-0000-4000-8000-000000000000')).toEqual([]);
        expect((await read('')).sort()).toEqual([early, gap, late, spanning].sort());
      }

      const list = await request(app).get('/api/tasks/list')
        .query({ cycleIds: cycles[1].id, staffIds: firstStaffId, search: 'Cycle resolution' })
        .set('Authorization', `Bearer ${adminToken}`);
      expect(list.status).toBe(200);
      expect(list.body.rows.map((task: { id: string }) => task.id).sort()).toEqual([late, spanning].sort());

      for (const endpoint of ['list', 'calendar']) {
        const malformed = await request(app).get(`/api/tasks/${endpoint}`)
          .query({ cycleIds: 'invalid', start: taskDate, end: taskDate })
          .set('Authorization', `Bearer ${adminToken}`);
        expect(malformed.status).toBe(400);
      }
    } finally {
      await sql`DELETE FROM program_cycles WHERE id IN ${sql(cycles.map(cycle => cycle.id))}`;
    }
  });

  it('returns complete tasks whose date ranges intersect the same table and calendar range', async () => {
    const create = async (title: string, startDate: string, dueDate: string) => rememberTask(await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title, category: 'outreach', startDate, dueDate, staffId: firstStaffId }));
    const spanning = await create('Spans calendar range', '2026-06-10', '2026-06-20');
    const inside = await create('Inside calendar range', '2026-06-14', '2026-06-14');
    const outside = await create('Outside calendar range', '2026-06-21', '2026-06-22');
    const boundary = await create('Boundary calendar range', '2026-06-15', '2026-06-16');

    const response = await request(app)
      .get(`/api/tasks/calendar?start=2026-06-12&end=2026-06-15&staffIds=${firstStaffId}&categories=outreach&search=calendar%20range`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: spanning.body.id, startDate: '2026-06-10', dueDate: '2026-06-20' }),
      expect.objectContaining({ id: inside.body.id }),
    ]));
    expect(response.body).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ id: outside.body.id }),
    ]));

    const table = await request(app)
      .get(`/api/tasks/list?start=2026-06-12&end=2026-06-15&staffIds=${firstStaffId}&categories=outreach&search=calendar%20range`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(table.status).toBe(200);
    expect(table.body.rows.map((task: { id: string }) => task.id).sort()).toEqual([spanning.body.id, inside.body.id, boundary.body.id].sort());
    expect(table.body.nextCursor).toBeNull();

    const incompleteRange = await request(app)
      .get('/api/tasks/calendar?start=2026-06-12')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(incompleteRange.status).toBe(400);
  });

  it('returns tasks across a multi-year table and calendar read range', async () => {
    const ids: string[] = [];
    for (const date of ['2024-02-29', '2027-12-31']) {
      const created = rememberTask(await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: 'Multi-year range task', category: 'outreach', startDate: date, dueDate: date, staffId: firstStaffId }));
      expect(created.status).toBe(201);
      ids.push(created.body.id);
    }

    for (const endpoint of ['list', 'calendar']) {
      const response = await request(app).get(`/api/tasks/${endpoint}`)
        .query({ start: '2024-01-01', end: '2027-12-31', staffIds: firstStaffId, search: 'Multi-year range task' })
        .set('Authorization', `Bearer ${adminToken}`);
      expect(response.status).toBe(200);
      const rows = endpoint === 'list' ? response.body.rows : response.body;
      expect(rows.map((task: { id: string }) => task.id)).toEqual(ids);
    }
  });

  it.each([
    'start=2026-06-12',
    'end=2026-06-15',
    'start=2026-06-15&end=2026-06-12',
    'start=2026-02-30&end=2026-03-01',
    'start=0000-01-01&end=0000-01-02',
  ])('rejects an invalid table range: %s', async query => {
    const response = await request(app)
      .get(`/api/tasks/list?${query}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(400);
  });

  it('preserves newer task content and status when placement changes', async () => {
    const task = rememberTask(await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Original task', details: 'Original details', category: 'outreach',
        startDate: taskDate, dueDate: taskDate, staffId: firstStaffId,
      }));
    expect(task.status).toBe(201);

    const contentUpdate = await request(app)
      .put(`/api/tasks/${task.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Newer task title', details: 'Newer task details', category: 'planning_prep',
        startDate: taskDate, dueDate: taskDate, staffId: firstStaffId,
      });
    expect(contentUpdate.status).toBe(200);

    const placementUpdate = await request(app)
      .patch(`/api/tasks/${task.body.id}/placement`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ startDate: '2026-08-10', dueDate: '2026-08-12' });

    expect(placementUpdate.status).toBe(200);
    const saved = await request(app).get(`/api/tasks/${task.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(saved.status).toBe(200);
    expect(placementUpdate.body).toEqual(saved.body);
    expect(Object.keys(placementUpdate.body).sort()).toEqual(Object.keys(contentUpdate.body).sort());
    expect(placementUpdate.body).toEqual(expect.objectContaining({
      title: 'Newer task title',
      details: 'Newer task details',
      category: 'planning_prep',
      state: 'open',
      startDate: '2026-08-10',
      dueDate: '2026-08-12',
    }));

    const cancelled = await request(app)
      .patch(`/api/tasks/${task.body.id}/state`)
      .set('Authorization', `Bearer ${firstStaffToken}`)
      .send({ state: 'cancelled' });
    expect(cancelled.status).toBe(200);
    expect(cancelled.body.state).toBe('cancelled');

    const reopened = await request(app)
      .patch(`/api/tasks/${task.body.id}/state`)
      .set('Authorization', `Bearer ${firstStaffToken}`)
      .send({ state: 'open' });
    expect(reopened.status).toBe(200);
    expect(reopened.body.state).toBe('open');
  });

  it('supports admin assignment and flexible date changes before or after logged time', async () => {
    const task = rememberTask(await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Create marketing poster', details: 'Prepare the outreach poster', category: 'outreach',
        programId, startDate: taskDate, dueDate: taskDate, staffId: firstStaffId,
      }));
    expect(task.status).toBe(201);

    const reassigned = await request(app)
      .patch(`/api/tasks/${task.body.id}/placement`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        startDate: taskDate, dueDate: taskDate, staffId: secondStaffId,
      });
    expect(reassigned.status).toBe(200);
    expect(reassigned.body).toEqual(expect.objectContaining({
      staffId: secondStaffId, firstName: 'Alex', lastName: 'Smith',
    }));

    const returned = await request(app)
      .patch(`/api/tasks/${task.body.id}/placement`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        startDate: taskDate, dueDate: taskDate, staffId: firstStaffId,
      });
    expect(returned.status).toBe(200);

    const linkedTime = await request(app)
      .post('/api/hours')
      .set('Authorization', `Bearer ${firstStaffToken}`)
      .send({
        source: 'task', staffId: firstStaffId, taskId: task.body.id,
        date: loggedDate, hours: 2, note: 'Worked outside the planned task dates',
      });
    expect(linkedTime.status).toBe(201);

    const taskWithHours = await request(app)
      .get('/api/tasks')
      .set('Authorization', `Bearer ${firstStaffToken}`);
    expect(taskWithHours.body).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: task.body.id, state: 'open', hoursLogged: 2,
        loggedHoursByDate: [{ date: loggedDate, hours: 2 }],
      }),
    ]));

    const changedDates = await request(app)
      .patch(`/api/tasks/${task.body.id}/placement`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ startDate: '2026-08-10', dueDate: '2026-08-12' });
    expect(changedDates.status).toBe(200);
    expect(changedDates.body).toEqual(expect.objectContaining({
      title: 'Create marketing poster',
      details: 'Prepare the outreach poster',
      state: 'open',
      startDate: '2026-08-10', dueDate: '2026-08-12', hoursLogged: 2,
    }));

    const cancelled = await request(app)
      .patch(`/api/tasks/${task.body.id}/state`)
      .set('Authorization', `Bearer ${firstStaffToken}`)
      .send({ state: 'cancelled' });
    expect(cancelled.status).toBe(200);
    expect(cancelled.body.state).toBe('cancelled');

    const reopened = await request(app)
      .patch(`/api/tasks/${task.body.id}/state`)
      .set('Authorization', `Bearer ${firstStaffToken}`)
      .send({ state: 'open' });
    expect(reopened.status).toBe(200);
    expect(reopened.body.state).toBe('open');

    const changedAssignee = await request(app)
      .patch(`/api/tasks/${task.body.id}/placement`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        startDate: taskDate, dueDate: taskDate, staffId: secondStaffId,
      });
    expect(changedAssignee.status).toBe(409);
    expect(changedAssignee.body.error).toBe('Only open tasks without logged time can be reassigned');

    const deleted = await request(app)
      .delete(`/api/tasks/${task.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(deleted.status).toBe(409);
    expect(deleted.body.error).toBe('Tasks with logged time cannot be deleted');
  });

  it('requires terminal tasks to be reopened before edits and protects completed deletion', async () => {
    const completedTask = rememberTask(await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Completed locked task', category: 'outreach',
        startDate: taskDate, dueDate: taskDate, staffId: firstStaffId,
      }));
    expect(completedTask.status).toBe(201);
    const completedEntry = await request(app)
      .post('/api/hours')
      .set('Authorization', `Bearer ${firstStaffToken}`)
      .send({
        source: 'task', staffId: firstStaffId, taskId: completedTask.body.id, completeTask: true,
        date: taskDate, hours: 1, note: 'Completed locked task',
      });
    expect(completedEntry.status).toBe(201);

    const completedEdit = await request(app)
      .put(`/api/tasks/${completedTask.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Changed completed task', category: 'planning_prep',
        startDate: taskDate, dueDate: taskDate, staffId: firstStaffId,
      });
    expect(completedEdit.status).toBe(409);
    expect(completedEdit.body.error).toBe('Completed or cancelled tasks must be reopened before they can be edited');

    const completedPlacement = await request(app)
      .patch(`/api/tasks/${completedTask.body.id}/placement`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ startDate: '2026-08-10', dueDate: '2026-08-12' });
    expect(completedPlacement.status).toBe(409);
    expect(completedPlacement.body.error).toBe('Completed or cancelled tasks must be reopened before their placement can change');

    const completedDelete = await request(app)
      .delete(`/api/tasks/${completedTask.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(completedDelete.status).toBe(409);
    expect(completedDelete.body.error).toBe('Tasks with logged time cannot be deleted');

    const cancelledTask = rememberTask(await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Cancelled deletable task', category: 'outreach',
        startDate: taskDate, dueDate: taskDate, staffId: firstStaffId,
      }));
    expect(cancelledTask.status).toBe(201);
    const cancelled = await request(app)
      .patch(`/api/tasks/${cancelledTask.body.id}/state`)
      .set('Authorization', `Bearer ${firstStaffToken}`)
      .send({ state: 'cancelled' });
    expect(cancelled.status).toBe(200);

    const cancelledEdit = await request(app)
      .put(`/api/tasks/${cancelledTask.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Changed cancelled task', category: 'planning_prep',
        startDate: taskDate, dueDate: taskDate, staffId: firstStaffId,
      });
    expect(cancelledEdit.status).toBe(409);

    const cancelledPlacement = await request(app)
      .patch(`/api/tasks/${cancelledTask.body.id}/placement`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ startDate: '2026-08-10', dueDate: '2026-08-12' });
    expect(cancelledPlacement.status).toBe(409);

    const cancelledDelete = await request(app)
      .delete(`/api/tasks/${cancelledTask.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(cancelledDelete.status).toBe(204);
    taskIds.delete(cancelledTask.body.id);
  });

  it('writes create, update, and delete audit snapshots transactionally', async () => {
    const task = rememberTask(await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Audited task', category: 'planning_prep',
        startDate: taskDate, dueDate: taskDate, staffId: firstStaffId,
    }));
    expect(task.status).toBe(201);

    const zeroHourCompletion = await request(app)
      .patch(`/api/tasks/${task.body.id}/state`)
      .set('Authorization', `Bearer ${firstStaffToken}`)
      .send({ state: 'completed' });
    expect(zeroHourCompletion.status).toBe(409);
    expect(zeroHourCompletion.body.error).toBe('Tasks need logged time before they can be completed');

    const completedEntry = await request(app)
      .post('/api/hours')
      .set('Authorization', `Bearer ${firstStaffToken}`)
      .send({
        source: 'task', staffId: firstStaffId, taskId: task.body.id, completeTask: true,
        date: taskDate, hours: 1, note: 'Completed audited task',
      });
    expect(completedEntry.status).toBe(201);
    const completedTasks = await request(app)
      .get(`/api/tasks/calendar?start=${taskDate}&end=${taskDate}&staffIds=${firstStaffId}&statuses=completed`)
      .set('Authorization', `Bearer ${firstStaffToken}`);
    expect(completedTasks.status).toBe(200);
    expect(completedTasks.body).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: task.body.id, state: 'completed', status: 'completed', hoursLogged: 1 }),
    ]));

    await sql`DELETE FROM time_entries WHERE id = ${completedEntry.body.id}`;

    const reopened = await request(app)
      .patch(`/api/tasks/${task.body.id}/state`)
      .set('Authorization', `Bearer ${firstStaffToken}`)
      .send({ state: 'open' });
    expect(reopened.status).toBe(200);
    expect(reopened.body).toEqual(expect.objectContaining({ state: 'open', completedAt: null }));

    const deleted = await request(app)
      .delete(`/api/tasks/${task.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(deleted.status).toBe(204);
    taskIds.delete(task.body.id);

    const audits = await sql<Array<{ action: string; oldState: string | null; newState: string | null }>>`
      SELECT action, old_data->>'state' AS old_state, new_data->>'state' AS new_state
      FROM audit_log
      WHERE table_name = 'tasks' AND record_id = ${task.body.id}
      ORDER BY created_at
    `;
    expect(audits).toEqual([
      expect.objectContaining({ action: 'INSERT', oldState: null, newState: 'open' }),
      expect.objectContaining({ action: 'UPDATE', oldState: 'open', newState: 'completed' }),
      expect.objectContaining({ action: 'UPDATE', oldState: 'completed', newState: 'open' }),
      expect.objectContaining({ action: 'DELETE', oldState: 'open', newState: null }),
    ]);
    await sql`DELETE FROM audit_log WHERE table_name = 'tasks' AND record_id = ${task.body.id}`;
  });
});
