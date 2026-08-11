import request from 'supertest';
import { createApp } from '../shared/app';
import { deleteTestUser, seedTestUser, sql } from '../shared/db';
import { generateToken } from '../shared/tokenHelpers';

const app = createApp();
const taskDate = '2026-08-09';

describe('Tasks API', () => {
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
  let cohortId: string;
  const taskIds = new Set<string>();

  const rememberTask = <T extends { body: { id?: string } }>(response: T) => {
    if (response.body.id) taskIds.add(response.body.id);
    return response;
  };

  beforeAll(async () => {
    const stamp = Date.now();
    const admin = await seedTestUser({ email: `tasks-admin-${stamp}@test.local`, role: 'admin' });
    const firstStaff = await seedTestUser({ email: `tasks-staff-a-${stamp}@test.local`, role: 'staff' });
    const secondStaff = await seedTestUser({ email: `tasks-staff-b-${stamp}@test.local`, role: 'staff' });
    const unrelatedStaff = await seedTestUser({ email: `tasks-staff-c-${stamp}@test.local`, role: 'staff' });
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
      VALUES (${`Tasks API ${stamp}`}, CURRENT_DATE - 7, CURRENT_DATE + 28)
      RETURNING id
    `;
    cycleId = cycles[0].id;
    const cohorts = await sql<Array<{ id: string }>>`
      INSERT INTO program_cohorts (program_id, cycle_id)
      VALUES (${programId}, ${cycleId})
      RETURNING id
    `;
    cohortId = cohorts[0].id;
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
    await sql`DELETE FROM program_cohorts WHERE id = ${cohortId}`;
    await sql`DELETE FROM program_cycles WHERE id = ${cycleId}`;
    await deleteTestUser(unrelatedStaffId);
    await deleteTestUser(secondStaffId);
    await deleteTestUser(firstStaffId);
    await deleteTestUser(adminId);
  });

  it('returns policy-scoped task options', async () => {
    const adminOptions = await request(app)
      .get('/api/tasks/options')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(adminOptions.status).toBe(200);
    expect(adminOptions.body.resources).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: firstStaffId }),
      expect.objectContaining({ id: secondStaffId }),
      expect.objectContaining({ id: unrelatedStaffId }),
    ]));
    expect(adminOptions.body.programs).toEqual(expect.arrayContaining([expect.objectContaining({ id: programId })]));
    expect(adminOptions.body.cycles).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: cycleId, programId }),
    ]));

    const staffOptions = await request(app)
      .get('/api/tasks/options')
      .set('Authorization', `Bearer ${firstStaffToken}`);
    expect(staffOptions.status).toBe(200);
    expect(staffOptions.body.resources).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: firstStaffId, writable: true }),
      expect.objectContaining({ id: secondStaffId, writable: false }),
    ]));
    expect(staffOptions.body.resources).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ id: unrelatedStaffId }),
    ]));
    expect(staffOptions.body.programs).toEqual(expect.arrayContaining([expect.objectContaining({ id: programId })]));
    expect(staffOptions.body.cycles).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: cycleId, programId }),
    ]));
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
      .get('/api/tasks/options')
      .set('Authorization', `Bearer ${readOnlyToken}`);

    expect(deniedRead.status).toBe(403);
    expect(deniedWrite.status).toBe(403);
    expect(readOnlyOptions.status).toBe(200);
    expect(readOnlyOptions.body.resources).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ writable: true }),
    ]));
  });

  it('reads every task in a visible resource row while keeping staff writes self-scoped', async () => {
    const ownTask = rememberTask(await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${firstStaffToken}`)
      .send({
        title: 'Staff-owned task', details: 'Owned by the authenticated staff member',
        category: 'outreach', cycleId, status: 'todo', startDate: taskDate, dueDate: taskDate,
        staffId: firstStaffId,
      }));
    expect(ownTask.status).toBe(201);
    expect(ownTask.body.assignee).toEqual(expect.objectContaining({ id: firstStaffId }));

    const otherCreate = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${firstStaffToken}`)
      .send({
        title: 'Other staff task', category: 'outreach', cycleId, status: 'todo',
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
      .patch(`/api/tasks/${ownTask.body.id}/status`)
      .set('Authorization', `Bearer ${secondStaffToken}`)
      .send({ status: 'completed' });
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

  it('validates required task scope and date boundaries', async () => {
    const missingDates = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Missing dates', category: 'outreach', cycleId, status: 'todo', staffId: firstStaffId });
    expect(missingDates.status).toBe(400);

    const missingCycle = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Missing cycle', category: 'outreach', status: 'todo',
        startDate: taskDate, dueDate: taskDate, staffId: firstStaffId,
      });
    expect(missingCycle.status).toBe(400);
    expect(missingCycle.body.details).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: 'body.cycleId' }),
    ]));

    const reversedDates = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Reversed dates', category: 'outreach', cycleId, status: 'todo',
        startDate: '2026-08-11', dueDate: '2026-08-10', staffId: firstStaffId,
      });
    expect(reversedDates.status).toBe(400);
    expect(reversedDates.body.details).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: 'body.dueDate', message: 'Due date must be on or after start date' }),
    ]));

    await expect(sql`
      INSERT INTO tasks (title, category, cycle_id, status, start_date, due_date)
      VALUES ('Ownerless task', 'outreach', ${cycleId}, 'todo', ${taskDate}, ${taskDate})
    `).rejects.toMatchObject({ code: '23502' });

    const malformedId = await request(app)
      .delete('/api/tasks/not-a-uuid')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(malformedId.status).toBe(400);
  });

  it('preserves newer task content and status when placement changes', async () => {
    const task = rememberTask(await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Original task', details: 'Original details', category: 'outreach',
        cycleId, status: 'todo', startDate: taskDate, dueDate: taskDate, staffId: firstStaffId,
      }));
    expect(task.status).toBe(201);

    const contentUpdate = await request(app)
      .put(`/api/tasks/${task.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Newer task title', details: 'Newer task details', category: 'planning_prep',
        cycleId, status: 'in_progress', startDate: taskDate, dueDate: taskDate, staffId: firstStaffId,
      });
    expect(contentUpdate.status).toBe(200);

    const placementUpdate = await request(app)
      .patch(`/api/tasks/${task.body.id}/placement`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ startDate: '2026-08-10', dueDate: '2026-08-12' });

    expect(placementUpdate.status).toBe(200);
    expect(placementUpdate.body).toEqual(expect.objectContaining({
      title: 'Newer task title',
      details: 'Newer task details',
      category: 'planning_prep',
      status: 'in_progress',
      startDate: '2026-08-10',
      dueDate: '2026-08-12',
    }));
  });

  it('supports admin assignment and flexible date changes before or after logged time', async () => {
    const task = rememberTask(await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Create marketing poster', details: 'Prepare the outreach poster', category: 'outreach',
        programId, cycleId, status: 'todo', startDate: taskDate, dueDate: taskDate, staffId: firstStaffId,
      }));
    expect(task.status).toBe(201);

    const reassigned = await request(app)
      .patch(`/api/tasks/${task.body.id}/placement`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        startDate: taskDate, dueDate: taskDate, staffId: secondStaffId,
      });
    expect(reassigned.status).toBe(200);
    expect(reassigned.body.assignee).toEqual(expect.objectContaining({ id: secondStaffId }));

    const returned = await request(app)
      .patch(`/api/tasks/${task.body.id}/placement`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        startDate: taskDate, dueDate: taskDate, staffId: firstStaffId,
      });
    expect(returned.status).toBe(200);

    const linkedTime = await request(app)
      .post('/api/time-entries')
      .set('Authorization', `Bearer ${firstStaffToken}`)
      .send({
        source: 'task', staffId: firstStaffId, taskId: task.body.id,
        workDate: '2026-08-15', hours: 2, note: 'Worked outside the planned task dates',
      });
    expect(linkedTime.status).toBe(201);

    const started = await request(app)
      .get('/api/tasks')
      .set('Authorization', `Bearer ${firstStaffToken}`);
    expect(started.body).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: task.body.id, status: 'in_progress', hoursLogged: 2,
        loggedHoursByDate: [{ date: '2026-08-15', hours: 2 }],
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
      status: 'in_progress',
      startDate: '2026-08-10', dueDate: '2026-08-12', hoursLogged: 2,
    }));

    const cancelled = await request(app)
      .patch(`/api/tasks/${task.body.id}/status`)
      .set('Authorization', `Bearer ${firstStaffToken}`)
      .send({ status: 'cancelled' });
    expect(cancelled.status).toBe(409);
    expect(cancelled.body.error).toBe('In-progress tasks cannot be cancelled');

    const changedAssignee = await request(app)
      .patch(`/api/tasks/${task.body.id}/placement`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        startDate: taskDate, dueDate: taskDate, staffId: secondStaffId,
      });
    expect(changedAssignee.status).toBe(409);
    expect(changedAssignee.body.error).toBe('Only to-do tasks without logged time can be reassigned');

    const deleted = await request(app)
      .delete(`/api/tasks/${task.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(deleted.status).toBe(409);
    expect(deleted.body.error).toBe('Tasks with logged time cannot be deleted');
  });

  it('writes create, update, and delete audit snapshots transactionally', async () => {
    const task = rememberTask(await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Audited task', category: 'planning_prep', cycleId, status: 'todo',
        startDate: taskDate, dueDate: taskDate, staffId: firstStaffId,
      }));
    expect(task.status).toBe(201);

    const updated = await request(app)
      .patch(`/api/tasks/${task.body.id}/status`)
      .set('Authorization', `Bearer ${firstStaffToken}`)
      .send({ status: 'completed' });
    expect(updated.status).toBe(200);

    const deleted = await request(app)
      .delete(`/api/tasks/${task.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(deleted.status).toBe(204);
    taskIds.delete(task.body.id);

    const audits = await sql<Array<{ action: string; oldStatus: string | null; newStatus: string | null }>>`
      SELECT action, old_data->>'status' AS old_status, new_data->>'status' AS new_status
      FROM audit_log
      WHERE table_name = 'tasks' AND record_id = ${task.body.id}
      ORDER BY created_at
    `;
    expect(audits).toEqual([
      expect.objectContaining({ action: 'INSERT', oldStatus: null, newStatus: 'todo' }),
      expect.objectContaining({ action: 'UPDATE', oldStatus: 'todo', newStatus: 'completed' }),
      expect.objectContaining({ action: 'DELETE', oldStatus: 'completed', newStatus: null }),
    ]);
    await sql`DELETE FROM audit_log WHERE table_name = 'tasks' AND record_id = ${task.body.id}`;
  });
});
