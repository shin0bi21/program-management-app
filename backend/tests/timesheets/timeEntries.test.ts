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
  let programId: string;
  let programName: string;
  let activeCohortId: string;
  let upcomingCohortId: string;
  let activeCycleId: string;
  let upcomingCycleId: string;

  beforeAll(async () => {
    const stamp = Date.now();
    const admin = await seedTestUser({ email: `timesheet-admin-${stamp}@test.local`, role: 'admin' });
    const firstStaff = await seedTestUser({ email: `timesheet-staff-a-${stamp}@test.local`, role: 'staff' });
    const secondStaff = await seedTestUser({ email: `timesheet-staff-b-${stamp}@test.local`, role: 'staff' });
    adminId = admin.userId;
    adminToken = generateToken(admin.userId, 'admin', admin.email);
    firstStaffId = firstStaff.userId;
    firstStaffToken = generateToken(firstStaff.userId, 'staff', firstStaff.email);
    secondStaffId = secondStaff.userId;
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
  });

  afterAll(async () => {
    await sql`DELETE FROM time_entries WHERE staff_id IN (${adminId}, ${firstStaffId}, ${secondStaffId})`;
    await sql`DELETE FROM program_cohorts WHERE id IN (${activeCohortId}, ${upcomingCohortId})`;
    await sql`DELETE FROM program_cycles WHERE name LIKE 'Active Timesheet %' OR name LIKE 'Upcoming Timesheet %'`;
    await deleteTestUser(secondStaffId);
    await deleteTestUser(firstStaffId);
    await deleteTestUser(adminId);
  });

  it('allows staff to create and read their own required-note entry', async () => {
    const created = await request(app)
      .post('/api/time-entries')
      .set('Authorization', `Bearer ${firstStaffToken}`)
      .send({ staffId: firstStaffId, programId, cycleId: activeCycleId, task: 'program_delivery', workDate, hours: 2.5, note: 'Delivered workshop' });

    expect(created.status).toBe(201);
    expect(created.body).toEqual(expect.objectContaining({ staffId: firstStaffId, task: 'program_delivery', hours: 2.5 }));

    const listed = await request(app)
      .get(`/api/time-entries?start=${workDate}&end=${workDate}`)
      .set('Authorization', `Bearer ${firstStaffToken}`);
    expect(listed.status).toBe(200);
    expect(listed.body.resources).toHaveLength(1);
    expect(listed.body.programs).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: programId, name: programName }),
    ]));
    expect(listed.body.data[firstStaffId][workDate]).toEqual([
      expect.objectContaining({
        id: created.body.id,
        programId,
        programName,
        note: 'Delivered workshop',
      }),
    ]);
  });

  it('requires a cycle', async () => {
    const response = await request(app)
      .post('/api/time-entries')
      .set('Authorization', `Bearer ${firstStaffToken}`)
      .send({ staffId: firstStaffId, task: 'maintenance', workDate, hours: 1, note: 'Office maintenance' });

    expect(response.status).toBe(400);
  });

  it('allows a cycle without a program', async () => {
    const response = await request(app)
      .post('/api/time-entries')
      .set('Authorization', `Bearer ${firstStaffToken}`)
      .send({
        staffId: firstStaffId,
        cycleId: activeCycleId,
        task: 'planning_prep',
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
      .send({ staffId: firstStaffId, programId, cycleId: activeCycleId, task: 'meeting', workDate, hours: 1, note: ' ' });
    expect(response.status).toBe(400);
  });

  it('prevents staff from creating entries for another staff member', async () => {
    const response = await request(app)
      .post('/api/time-entries')
      .set('Authorization', `Bearer ${firstStaffToken}`)
      .send({ staffId: secondStaffId, programId, cycleId: activeCycleId, task: 'meeting', workDate, hours: 1, note: 'Team meeting' });
    expect(response.status).toBe(403);
  });

  it('allows admins to create entries for staff and list all staff resources', async () => {
    const created = await request(app)
      .post('/api/time-entries')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ staffId: secondStaffId, programId, cycleId: activeCycleId, task: 'outreach', workDate, hours: 1, note: 'Created campaign materials' });
    expect(created.status).toBe(201);
    expect(created.body.task).toBe('outreach');

    const listed = await request(app)
      .get(`/api/time-entries?start=${workDate}&end=${workDate}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(listed.status).toBe(200);
    expect(listed.body.resources).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: firstStaffId }),
      expect.objectContaining({ id: secondStaffId }),
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
    expect(response.body.data[secondStaffId]).toBeUndefined();
  });

  it('filters list data by the saved cycle identity rather than its date range', async () => {
    const outsideCycleDate = '2025-01-15';
    const created = await request(app)
      .post('/api/time-entries')
      .set('Authorization', `Bearer ${firstStaffToken}`)
      .send({
        staffId: firstStaffId,
        programId: null,
        cycleId: activeCycleId,
        task: 'planning_prep',
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

  it('allows staff to update and delete their own entry', async () => {
    const created = await request(app)
      .post('/api/time-entries')
      .set('Authorization', `Bearer ${firstStaffToken}`)
      .send({ staffId: firstStaffId, programId, cycleId: activeCycleId, task: 'meeting', workDate, hours: 1, note: 'Initial note' });

    const updated = await request(app)
      .put(`/api/time-entries/${created.body.id}`)
      .set('Authorization', `Bearer ${firstStaffToken}`)
      .send({ staffId: firstStaffId, programId: null, cycleId: activeCycleId, task: 'planning_prep', workDate, hours: 1.5, note: 'Updated note' });
    expect(updated.status).toBe(200);
    expect(updated.body).toEqual(expect.objectContaining({ programId: null, task: 'planning_prep', hours: 1.5, note: 'Updated note' }));

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
