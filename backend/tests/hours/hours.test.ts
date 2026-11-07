import request from 'supertest';
import { createApp } from '../shared/app';
import { deleteTestUser, seedTestUser, sql } from '../shared/db';
import { generateToken } from '../shared/tokenHelpers';
import { getBiweeklyPayPeriod } from '../../src/services/staff/hours/payPeriodUtils';

const app = createApp();

describe('Hours API', () => {
  let date: string;
  let linkedDate: string;
  let placementDate: string;
  let adminId: string;
  let adminToken: string;
  let firstStaffId: string;
  let firstStaffToken: string;
  let secondStaffId: string;
  let secondStaffToken: string;
  let unrelatedStaffId: string;
  let unrelatedStaffToken: string;
  let programId: string;
  let program: string;
  let activeCycleId: string;
  let upcomingCycleId: string;
  let upcomingDate: string;
  let sessionId: string | null = null;
  let assignedTaskId: string | null = null;

  beforeAll(async () => {
    const stamp = Date.now();
    const [dates] = await sql<Array<{
      date: string;
      linkedDate: string;
      placementDate: string;
    }>>`
      SELECT
        (NOW() AT TIME ZONE 'America/Toronto')::date::text AS date,
        ((NOW() AT TIME ZONE 'America/Toronto')::date + 1)::text AS linked_date,
        ((NOW() AT TIME ZONE 'America/Toronto')::date + 2)::text AS placement_date
    `;
    ({ date, linkedDate, placementDate } = dates);
    const admin = await seedTestUser({ email: `hours-admin-${stamp}@test.local`, role: 'admin' });
    const firstStaff = await seedTestUser({
      email: `hours-staff-a-${stamp}@test.local`, firstName: 'Zoe', lastName: 'Wilson', role: 'staff',
    });
    const secondStaff = await seedTestUser({
      email: `hours-staff-b-${stamp}@test.local`, firstName: 'Alex', lastName: 'Morgan', role: 'staff',
    });
    const unrelatedStaff = await seedTestUser({
      email: `hours-staff-c-${stamp}@test.local`, firstName: 'Jamie', lastName: 'Unrelated', role: 'staff',
    });
    adminId = admin.userId;
    adminToken = generateToken(admin.userId, 'admin', admin.email);
    firstStaffId = firstStaff.userId;
    firstStaffToken = generateToken(firstStaff.userId, 'staff', firstStaff.email);
    secondStaffId = secondStaff.userId;
    secondStaffToken = generateToken(secondStaff.userId, 'staff', secondStaff.email);
    unrelatedStaffId = unrelatedStaff.userId;
    unrelatedStaffToken = generateToken(unrelatedStaff.userId, 'staff', unrelatedStaff.email);
    const programs = await sql<Array<{ id: string; name: string }>>`
      SELECT id, name FROM programs WHERE enrollment_required = FALSE ORDER BY name LIMIT 1
    `;
    programId = programs[0].id;
    program = programs[0].name;
    const assignments = await sql<Array<{ cycleId: string }>>`
      WITH cycles AS (
        INSERT INTO program_cycles (name, starts_on, ends_on)
        VALUES
          (
            ${`Active Hours ${stamp}`},
            ${date}::date - 7,
            ${date}::date + 7
          ),
          (${`Upcoming Hours ${stamp}`}, ${date}::date + 14, ${date}::date + 28)
        RETURNING id, starts_on
      )
      INSERT INTO program_cycle_assignments (program_id, cycle_id)
      SELECT ${programId}, id FROM cycles ORDER BY starts_on
      RETURNING cycle_id
    `;
    [activeCycleId, upcomingCycleId] = assignments.map(assignment => assignment.cycleId);
    const upcomingDates = await sql<Array<{ startsOn: string }>>`
      SELECT starts_on::text FROM program_cycles WHERE id = ${upcomingCycleId}
    `;
    upcomingDate = upcomingDates[0].startsOn;
    await sql`
      INSERT INTO user_program_assignments (user_id, program_id)
      VALUES (${adminId}, ${programId}), (${firstStaffId}, ${programId}), (${secondStaffId}, ${programId})
    `;
    const [session] = await sql<Array<{ id: string }>>`
      INSERT INTO program_sessions (program_id, cycle_id, session_type, theme, starts_at, ends_at)
      SELECT ${programId}, ${activeCycleId}, 'Regular', 'Hours workshop',
        ${date}::date + TIME '10:00', ${date}::date + TIME '12:00'
      RETURNING id
    `;
    sessionId = session.id;
  });

  afterAll(async () => {
    await sql`DELETE FROM time_entries WHERE staff_id IN (${adminId}, ${firstStaffId}, ${secondStaffId}, ${unrelatedStaffId})`;
    if (assignedTaskId) await sql`DELETE FROM tasks WHERE id = ${assignedTaskId}`;
    if (sessionId) await sql`DELETE FROM program_sessions WHERE id = ${sessionId}`;
    await sql`DELETE FROM program_cycle_assignments WHERE program_id = ${programId} AND cycle_id IN (${activeCycleId}, ${upcomingCycleId})`;
    await sql`DELETE FROM program_cycles WHERE id IN (${activeCycleId}, ${upcomingCycleId})`;
    await deleteTestUser(unrelatedStaffId);
    await deleteTestUser(secondStaffId);
    await deleteTestUser(firstStaffId);
    await deleteTestUser(adminId);
  });

  it('lets project managers log their own hours without writing shared coworkers hours', async () => {
    const manager = await seedTestUser({ role: 'project_manager' });
    const token = generateToken(manager.userId, 'project_manager', manager.email);
    const entryIds: string[] = [];

    try {
      await sql`INSERT INTO user_program_assignments (user_id, program_id) VALUES (${manager.userId}, ${programId})`;
      const payload = { source: 'regular', programId, category: 'meeting', date, hours: 1, note: 'Project meeting' };
      const own = await request(app).post('/api/hours')
        .set('Authorization', `Bearer ${token}`).send({ ...payload, staffId: manager.userId });
      if (own.body.id) entryIds.push(own.body.id);
      expect(own.status).toBe(201);
      expect(own.body.staffId).toBe(manager.userId);

      const denied = await request(app).post('/api/hours')
        .set('Authorization', `Bearer ${token}`).send({ ...payload, staffId: firstStaffId });
      expect(denied.status).toBe(403);

      const shared = await request(app).post('/api/hours')
        .set('Authorization', `Bearer ${adminToken}`).send({ ...payload, staffId: firstStaffId });
      if (shared.body.id) entryIds.push(shared.body.id);
      expect(shared.status).toBe(201);

      const readable = await request(app).get(`/api/hours/calendar?start=${date}&end=${date}&staffIds=${firstStaffId}`)
        .set('Authorization', `Bearer ${token}`);
      expect(readable.status).toBe(200);
      expect(readable.body.filter((entry: { staffId: string; date: string }) => entry.staffId === firstStaffId && entry.date === date)).toEqual(expect.arrayContaining([
        expect.objectContaining({ id: shared.body.id }),
      ]));
      const deniedDelete = await request(app).delete(`/api/hours/${shared.body.id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(deniedDelete.status).toBe(403);
    } finally {
      if (entryIds.length) {
        await sql`DELETE FROM time_entries WHERE id IN ${sql(entryIds)}`;
        await sql`DELETE FROM audit_log WHERE table_name = 'time_entries' AND record_id IN ${sql(entryIds)}`;
      }
      await deleteTestUser(manager.userId);
    }
  });

  it('allows staff to create and read their own regular-time entry', async () => {
    const created = await request(app)
      .post('/api/hours')
      .set('Authorization', `Bearer ${firstStaffToken}`)
      .send({ source: 'regular', staffId: firstStaffId, programId, category: 'meeting', date, hours: 2.5, note: 'Program meeting' });

    expect(created.status).toBe(201);
    expect(created.body).toEqual(expect.objectContaining({ staffId: firstStaffId, category: 'meeting', type: 'regular', taskId: null, sessionId: null, hours: 2.5 }));

    const listed = await request(app)
      .get(`/api/hours/calendar?start=${date}&end=${date}`)
      .set('Authorization', `Bearer ${firstStaffToken}`);
    const referenceData = await request(app)
      .get('/api/reference-data/staff?feature=hours')
      .set('Authorization', `Bearer ${firstStaffToken}`);
    expect(listed.status).toBe(200);
    expect(referenceData.status).toBe(200);
    expect(referenceData.body).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: firstStaffId, firstName: 'Zoe', lastName: 'Wilson', name: 'Zoe Wilson', writable: true,
      }),
      expect.objectContaining({
        id: secondStaffId, firstName: 'Alex', lastName: 'Morgan', name: 'Alex Morgan', writable: false,
      }),
    ]));
    expect(referenceData.body).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ id: unrelatedStaffId }),
    ]));
    expect(listed.body.filter((entry: { staffId: string; date: string }) => entry.staffId === firstStaffId && entry.date === date)).toEqual([
      expect.objectContaining({
        id: created.body.id,
        programId,
        program: program,
        note: 'Program meeting',
      }),
    ]);
  });

  it('searches policy-scoped calendar entries with the same fields as the table', async () => {
    const marker = `Calendar search ${firstStaffId}`;
    const created = await request(app)
      .post('/api/hours')
      .set('Authorization', `Bearer ${firstStaffToken}`)
      .send({
        source: 'regular',
        staffId: firstStaffId,
        programId,
        category: 'meeting',
        date,
        hours: 1,
        note: marker,
      });
    expect(created.status).toBe(201);

    const matched = await request(app)
      .get(`/api/hours/calendar?start=${date}&end=${date}&search=${encodeURIComponent(marker)}`)
      .set('Authorization', `Bearer ${firstStaffToken}`);
    expect(matched.status).toBe(200);
    expect(matched.body.filter((entry: { staffId: string; date: string }) => entry.staffId === firstStaffId && entry.date === date)).toEqual([
      expect.objectContaining({ id: created.body.id, note: marker }),
    ]);

    const unmatched = await request(app)
      .get(`/api/hours/calendar?start=${date}&end=${date}&search=missing-calendar-entry`)
      .set('Authorization', `Bearer ${firstStaffToken}`);
    expect(unmatched.status).toBe(200);
    expect(unmatched.body).toEqual([]);
  });

  it('cursor-paginates the filtered hours list', async () => {
    const marker = `Paginated hours ${firstStaffId}`;
    for (const hours of [1, 2]) {
      const created = await request(app)
        .post('/api/hours')
        .set('Authorization', `Bearer ${firstStaffToken}`)
        .send({ source: 'regular', staffId: firstStaffId, programId, category: 'meeting', date, hours, note: `${marker} ${hours}` });
      expect(created.status).toBe(201);
    }

    const first = await request(app)
      .get(`/api/hours/table?search=${encodeURIComponent(marker)}&sort=hours&direction=asc&limit=1`)
      .set('Authorization', `Bearer ${firstStaffToken}`);
    expect(first.status).toBe(200);
    expect(first.body).toEqual({
      rows: [expect.objectContaining({ staffId: firstStaffId, hours: 1, note: `${marker} 1` })],
      nextCursor: expect.any(String),
    });

    const second = await request(app)
      .get(`/api/hours/table?search=${encodeURIComponent(marker)}&sort=hours&direction=asc&limit=1&cursor=${encodeURIComponent(first.body.nextCursor)}`)
      .set('Authorization', `Bearer ${firstStaffToken}`);
    expect(second.status).toBe(200);
    expect(second.body).toEqual({
      rows: [expect.objectContaining({ hours: 2, note: `${marker} 2` })],
      nextCursor: null,
    });
  });

  it('applies inclusive work-date bounds before table pagination', async () => {
    const marker = `Date-range hours ${firstStaffId}`;
    const ids: string[] = [];
    for (const entryDate of [date, linkedDate, placementDate]) {
      const created = await request(app)
        .post('/api/hours')
        .set('Authorization', `Bearer ${firstStaffToken}`)
        .send({ source: 'regular', staffId: firstStaffId, programId, category: 'meeting', date: entryDate, hours: 1, note: marker });
      expect(created.status).toBe(201);
      ids.push(created.body.id);
    }

    const query = `start=${linkedDate}&end=${placementDate}&search=${encodeURIComponent(marker)}&sort=date&direction=asc&limit=1`;
    const first = await request(app)
      .get(`/api/hours/table?${query}`)
      .set('Authorization', `Bearer ${firstStaffToken}`);
    expect(first.status).toBe(200);
    expect(first.body.rows.map((row: { id: string }) => row.id)).toEqual([ids[1]]);
    expect(first.body.nextCursor).toEqual(expect.any(String));

    const second = await request(app)
      .get(`/api/hours/table?${query}&cursor=${encodeURIComponent(first.body.nextCursor)}`)
      .set('Authorization', `Bearer ${firstStaffToken}`);
    expect(second.status).toBe(200);
    expect(second.body.rows.map((row: { id: string }) => row.id)).toEqual([ids[2]]);
    expect(second.body.nextCursor).toBeNull();

    const calendar = await request(app)
      .get(`/api/hours/calendar?start=${linkedDate}&end=${placementDate}&search=${encodeURIComponent(marker)}`)
      .set('Authorization', `Bearer ${firstStaffToken}`);
    expect(calendar.status).toBe(200);
    expect(calendar.body.map((entry: { id: string }) => entry.id).sort()).toEqual(ids.slice(1).sort());
  });

  it.each([
    'start=2026-06-12',
    'end=2026-06-15',
    'start=2026-06-15&end=2026-06-12',
    'start=2026-02-30&end=2026-03-01',
    'start=0000-01-01&end=0000-01-02',
  ])('rejects an invalid hours table range: %s', async query => {
    const response = await request(app)
      .get(`/api/hours/table?${query}`)
      .set('Authorization', `Bearer ${firstStaffToken}`);

    expect(response.status).toBe(400);
  });

  it('accepts a 366-day leap-year table range', async () => {
    const response = await request(app)
      .get('/api/hours/table?start=2024-01-01&end=2024-12-31')
      .set('Authorization', `Bearer ${firstStaffToken}`);

    expect(response.status).toBe(200);
  });

  it('accepts a multi-year table range for cycle-driven calendars', async () => {
    const response = await request(app)
      .get('/api/hours/table?start=2024-01-01&end=2025-01-01')
      .set('Authorization', `Bearer ${firstStaffToken}`);

    expect(response.status).toBe(200);
  });

  it('filters table and calendar collections by any selected cycle without widening staff scope', async () => {
    const marker = `Multi-cycle hours ${firstStaffId}`;
    const createdIds: string[] = [];
    for (const entryDate of [date, upcomingDate]) {
      const created = await request(app)
        .post('/api/hours')
        .set('Authorization', `Bearer ${firstStaffToken}`)
        .send({ source: 'regular', staffId: firstStaffId, programId, category: 'meeting', date: entryDate, hours: 1, note: marker });
      expect(created.status).toBe(201);
      createdIds.push(created.body.id);
    }

    for (const [selectedCycles, expectedIds] of [
      [[], createdIds],
      [[activeCycleId], [createdIds[0]]],
      [[activeCycleId, upcomingCycleId], createdIds],
    ] as Array<[string[], string[]]>) {
      const query = new URLSearchParams({ search: marker, cycleIds: selectedCycles.join(',') });
      const table = await request(app).get(`/api/hours/table?${query}`).set('Authorization', `Bearer ${firstStaffToken}`);
      const calendar = await request(app).get(`/api/hours/calendar?${query}`).set('Authorization', `Bearer ${firstStaffToken}`);
      expect(table.status).toBe(200);
      expect(calendar.status).toBe(200);
      expect(table.body.rows.map((row: { id: string }) => row.id).sort()).toEqual([...expectedIds].sort());
      const calendarIds = calendar.body.map((entry: { id: string }) => entry.id);
      expect(calendarIds.sort()).toEqual([...expectedIds].sort());
    }

    const unrelated = await request(app)
      .get(`/api/hours/table?cycleIds=${activeCycleId},${upcomingCycleId}&staffIds=${unrelatedStaffId}`)
      .set('Authorization', `Bearer ${firstStaffToken}`);
    expect(unrelated.status).toBe(200);
    expect(unrelated.body.rows).toEqual([]);

    const invalidCycle = await request(app).get('/api/hours/table?cycleIds=not-a-uuid').set('Authorization', `Bearer ${firstStaffToken}`);
    expect(invalidCycle.status).toBe(400);
  });

  it('lists assigned open-program sessions and derives session time metadata', async () => {
    const sessions = await request(app)
      .get(`/api/hours/sessions?staffId=${firstStaffId}&date=${date}`)
      .set('Authorization', `Bearer ${firstStaffToken}`);
    expect(sessions.status).toBe(200);
    expect(sessions.body).toEqual([
      expect.objectContaining({
        id: sessionId, label: 'Hours workshop', programId, date,
      }),
    ]);

    const unassignedSessions = await request(app)
      .get(`/api/hours/sessions?staffId=${unrelatedStaffId}&date=${date}`)
      .set('Authorization', `Bearer ${unrelatedStaffToken}`);
    expect(unassignedSessions.status).toBe(200);
    expect(unassignedSessions.body).toEqual([]);

    const unassignedEntry = await request(app)
      .post('/api/hours')
      .set('Authorization', `Bearer ${unrelatedStaffToken}`)
      .send({ source: 'session', staffId: unrelatedStaffId, sessionId, hours: 1, note: 'Unassigned delivery' });
    expect(unassignedEntry.status).toBe(404);

    const created = await request(app)
      .post('/api/hours')
      .set('Authorization', `Bearer ${firstStaffToken}`)
      .send({ source: 'session', staffId: firstStaffId, sessionId, hours: 2, note: 'Delivered workshop' });

    expect(created.status).toBe(201);
    expect(created.body).toEqual(expect.objectContaining({
      staffId: firstStaffId,
      sessionId,
      type: 'session',
      category: 'program_delivery',
      programId,
      cycleId: activeCycleId,
      date: date,
    }));

    const adminSessions = await request(app)
      .get(`/api/hours/sessions?staffId=${adminId}&date=${date}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(adminSessions.status).toBe(200);
    expect(adminSessions.body).toEqual([
      expect.objectContaining({ id: sessionId, label: 'Hours workshop', date }),
    ]);

    const adminEntry = await request(app)
      .post('/api/hours')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ source: 'session', staffId: adminId, sessionId, hours: 1, note: 'Admin delivered workshop' });
    expect(adminEntry.status).toBe(201);
    expect(adminEntry.body).toEqual(expect.objectContaining({
      staffId: adminId, sessionId, category: 'program_delivery', date: date,
    }));
  });

  it('rejects Program Delivery through the Regular workflow', async () => {
    const response = await request(app)
      .post('/api/hours')
      .set('Authorization', `Bearer ${firstStaffToken}`)
      .send({ source: 'regular', staffId: firstStaffId, programId, category: 'program_delivery', date, hours: 1, note: 'Wrong workflow' });
    expect(response.status).toBe(400);
  });

  it('applies identical table and calendar filters without widening staff scope', async () => {
    const general = await request(app)
      .post('/api/hours')
      .set('Authorization', `Bearer ${firstStaffToken}`)
      .send({ source: 'regular', staffId: firstStaffId, category: 'other', date, hours: 1, note: 'General filtered entry' });
    expect(general.status).toBe(201);

    const filterSets = [
      `categories=other`, `programIds=general`, `types=regular`, `staffIds=${firstStaffId}`, `cycleIds=${activeCycleId}`,
    ];
    for (const filter of filterSets) {
      const table = await request(app).get(`/api/hours/table?start=${date}&end=${date}&${filter}`).set('Authorization', `Bearer ${adminToken}`);
      const calendar = await request(app).get(`/api/hours/calendar?start=${date}&end=${date}&${filter}`).set('Authorization', `Bearer ${adminToken}`);
      expect(table.status).toBe(200);
      expect(calendar.status).toBe(200);
      const tableIds = table.body.rows.map((row: { id: string }) => row.id).sort();
      const calendarIds = calendar.body.map((entry: { id: string }) => entry.id).sort();
      expect(calendarIds).toEqual(tableIds);
    }
    const generalTable = await request(app)
      .get('/api/hours/table?programIds=general&types=regular')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(generalTable.body.rows.map((row: { id: string }) => row.id)).toContain(general.body.id);

    const widened = await request(app)
      .get(`/api/hours/calendar?start=${date}&end=${date}&staffIds=${secondStaffId}`)
      .set('Authorization', `Bearer ${firstStaffToken}`);
    expect(widened.status).toBe(200);
    expect(widened.body).toEqual([]);
  });

  it('returns the complete cycle-based dashboard overview for an authorized staff member', async () => {
    const [cycle] = await sql<Array<{ startsOn: string; currentDate: string }>>`
      SELECT
        starts_on::text AS starts_on,
        (NOW() AT TIME ZONE 'America/Toronto')::date::text AS current_date
      FROM program_cycles
      WHERE id = ${activeCycleId}
    `;
    const payPeriod = getBiweeklyPayPeriod(cycle.startsOn, cycle.currentDate);
    try {
      await sql`
        INSERT INTO time_entries (staff_id, cycle_id, category, date, hours, note)
        VALUES
          (${adminId}, ${activeCycleId}, 'meeting', ${payPeriod.periodStart}::date, 2, 'Current meeting'),
          (${adminId}, ${activeCycleId}, 'outreach', (NOW() AT TIME ZONE 'America/Toronto')::date, 3, 'Current outreach')
      `;

      const overview = await request(app)
        .get(`/api/hours/dashboard?staffId=${adminId}&cycleId=${activeCycleId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(overview.status).toBe(200);
      expect(overview.body).toEqual({
        payPeriod: {
          periodStart: payPeriod.periodStart,
          periodEnd: payPeriod.periodEnd,
          totalHours: 6,
          breakdown: [
            { label: 'Outreach', hours: 3 },
            { label: 'Meeting', hours: 2 },
            { label: 'Program Delivery', hours: 1 },
          ],
        },
        biweeklyAverage: {
          periodCount: 1,
          averageHours: 6,
          breakdown: [
            { label: 'Outreach', hours: 3 },
            { label: 'Meeting', hours: 2 },
            { label: 'Program Delivery', hours: 1 },
          ],
        },
      });
    } finally {
      await sql`DELETE FROM time_entries WHERE staff_id = ${adminId} AND note IN ('Current meeting', 'Current outreach')`;
    }
  });

  it('keeps the current organization pay period independent of an upcoming selected cycle', async () => {
    const [cycle] = await sql<Array<{ startsOn: string; currentDate: string }>>`
      SELECT
        starts_on::text AS starts_on,
        (NOW() AT TIME ZONE 'America/Toronto')::date::text AS current_date
      FROM program_cycles
      WHERE id = ${activeCycleId}
    `;
    const expected = getBiweeklyPayPeriod(cycle.startsOn, cycle.currentDate);

    const response = await request(app)
      .get(`/api/hours/dashboard?staffId=${firstStaffId}&cycleId=${upcomingCycleId}`)
      .set('Authorization', `Bearer ${firstStaffToken}`);

    expect(response.status).toBe(200);
    expect(response.body.payPeriod).toEqual(expect.objectContaining(expected));
  });

  it('keeps the dashboard available when multiple cycles overlap', async () => {
    const [overlappingCycle] = await sql<Array<{ id: string }>>`
      INSERT INTO program_cycles (name, starts_on, ends_on)
      SELECT ${`Overlapping Hours ${Date.now()}`}, starts_on, ends_on
      FROM program_cycles
      WHERE id = ${activeCycleId}
      RETURNING id
    `;

    try {
      const response = await request(app)
        .get(`/api/hours/dashboard?staffId=${firstStaffId}&cycleId=${activeCycleId}`)
        .set('Authorization', `Bearer ${firstStaffToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(expect.objectContaining({
        payPeriod: expect.any(Object),
        biweeklyAverage: expect.any(Object),
      }));
    } finally {
      await sql`DELETE FROM program_cycles WHERE id = ${overlappingCycle.id}`;
    }
  });

  it('conceals dashboard overview data for an unreadable staff resource', async () => {
    const response = await request(app)
      .get(`/api/hours/dashboard?staffId=${unrelatedStaffId}&cycleId=${activeCycleId}`)
      .set('Authorization', `Bearer ${firstStaffToken}`);

    expect(response.status).toBe(404);
  });

  it('returns overview data for a shared-readable staff resource without matching entry metadata', async () => {
    const [entry] = await sql<Array<{ id: string }>>`
      INSERT INTO time_entries (staff_id, cycle_id, category, date, hours, note)
      VALUES (${secondStaffId}, ${activeCycleId}, 'meeting', CURRENT_DATE, 2, 'Shared resource overview')
      RETURNING id
    `;
    try {
      const response = await request(app)
        .get(`/api/hours/dashboard?staffId=${secondStaffId}&cycleId=${activeCycleId}`)
        .set('Authorization', `Bearer ${firstStaffToken}`);

      expect(response.status).toBe(200);
      expect(response.body.payPeriod.totalHours).toBe(2);
      expect(response.body.payPeriod.breakdown).toEqual([{ label: 'Meeting', hours: 2 }]);
    } finally {
      await sql`DELETE FROM time_entries WHERE id = ${entry.id}`;
    }
  });

  it('requires the read hours permission for dashboard overview data', async () => {
    const token = generateToken(firstStaffId, 'staff', 'hours-no-read@test.local', []);
    const response = await request(app)
      .get(`/api/hours/dashboard?staffId=${firstStaffId}&cycleId=${activeCycleId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(403);
  });

  it('returns read-only resource capabilities without writable rows', async () => {
    const readOnlyToken = generateToken(
      adminId,
      'admin',
      'hours-read-only@test.local',
      ['read:hours'],
    );
    const referenceData = await request(app)
      .get('/api/reference-data/staff?feature=hours')
      .set('Authorization', `Bearer ${readOnlyToken}`);

    expect(referenceData.status).toBe(200);
    expect(referenceData.body).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ writable: true }),
    ]));
  });

  it('returns the derived cycle for time without a program', async () => {
    const response = await request(app)
      .post('/api/hours')
      .set('Authorization', `Bearer ${firstStaffToken}`)
      .send({
        source: 'regular',
        staffId: firstStaffId,
        category: 'planning_prep',
        date,
        hours: 1,
        note: 'Cohort preparation',
      });

    expect(response.status).toBe(201);
    expect(response.body).toEqual(expect.objectContaining({
      programId: null,
      cycleId: activeCycleId,
    }));
  });

  it('rejects missing notes', async () => {
    const response = await request(app)
      .post('/api/hours')
      .set('Authorization', `Bearer ${firstStaffToken}`)
      .send({ source: 'regular', staffId: firstStaffId, programId, category: 'meeting', date, hours: 1, note: ' ' });
    expect(response.status).toBe(400);
  });

  it('prevents staff from creating entries for another staff member', async () => {
    const response = await request(app)
      .post('/api/hours')
      .set('Authorization', `Bearer ${firstStaffToken}`)
      .send({ source: 'regular', staffId: secondStaffId, programId, category: 'meeting', date, hours: 1, note: 'Team meeting' });
    expect(response.status).toBe(403);
  });

  it('allows admins to create entries for staff and list all staff resources', async () => {
    const created = await request(app)
      .post('/api/hours')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ source: 'regular', staffId: secondStaffId, programId, category: 'outreach', date, hours: 1, note: 'Created campaign materials' });
    expect(created.status).toBe(201);
    expect(created.body.category).toBe('outreach');

    const listed = await request(app)
      .get(`/api/hours/calendar?start=${date}&end=${date}`)
      .set('Authorization', `Bearer ${adminToken}`);
    const referenceData = await request(app)
      .get('/api/reference-data/staff?feature=hours')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(listed.status).toBe(200);
    expect(referenceData.status).toBe(200);
    expect(referenceData.body).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: firstStaffId, writable: true }),
      expect.objectContaining({ id: secondStaffId, writable: true }),
    ]));

    const coworkerRead = await request(app)
      .get(`/api/hours/calendar?start=${date}&end=${date}`)
      .set('Authorization', `Bearer ${firstStaffToken}`);
    expect(coworkerRead.status).toBe(200);
    expect(coworkerRead.body.filter((entry: { staffId: string; date: string }) => entry.staffId === secondStaffId && entry.date === date)).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: created.body.id, programId, note: 'Created campaign materials' }),
    ]));

    const unrelatedRead = await request(app)
      .get(`/api/hours/calendar?start=${date}&end=${date}`)
      .set('Authorization', `Bearer ${unrelatedStaffToken}`);
    const unrelatedReferenceData = await request(app)
      .get('/api/reference-data/staff?feature=hours')
      .set('Authorization', `Bearer ${unrelatedStaffToken}`);
    expect(unrelatedRead.status).toBe(200);
    expect(unrelatedReferenceData.status).toBe(200);
    expect(unrelatedReferenceData.body).toEqual([
      expect.objectContaining({ id: unrelatedStaffId, writable: true }),
    ]);
    expect(unrelatedRead.body).not.toEqual(expect.arrayContaining([expect.objectContaining({ staffId: secondStaffId })]));

    const coworkerUpdate = await request(app)
      .put(`/api/hours/${created.body.id}`)
      .set('Authorization', `Bearer ${firstStaffToken}`)
      .send({ source: 'regular', staffId: secondStaffId, programId, category: 'outreach', date, hours: 2, note: 'Unauthorized edit' });
    expect(coworkerUpdate.status).toBe(403);

    const coworkerDelete = await request(app)
      .delete(`/api/hours/${created.body.id}`)
      .set('Authorization', `Bearer ${firstStaffToken}`);
    expect(coworkerDelete.status).toBe(403);
  });

  it('derives task scope for assigned staff time without changing its open lifecycle', async () => {
    const createdTask = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Create marketing poster',
        details: 'Prepare the fall outreach poster',
        category: 'outreach',
        programId,
        startDate: date,
        dueDate: date,
        staffId: firstStaffId,
      });
    expect(createdTask.status).toBe(201);
    assignedTaskId = createdTask.body.id;

    const unassignedEntry = await request(app)
      .post('/api/hours')
      .set('Authorization', `Bearer ${secondStaffToken}`)
      .send({
        source: 'task', staffId: secondStaffId, taskId: assignedTaskId,
        date, hours: 1, note: 'Not assigned to this task',
      });
    expect(unassignedEntry.status).toBe(404);

    const linkedEntry = await request(app)
      .post('/api/hours')
      .set('Authorization', `Bearer ${firstStaffToken}`)
      .send({
        source: 'task',
        staffId: firstStaffId,
        taskId: assignedTaskId,
        date: linkedDate,
        hours: 2,
        note: 'Drafted the poster',
      });
    expect(linkedEntry.status).toBe(201);
    expect(linkedEntry.body).toEqual(expect.objectContaining({
      taskId: assignedTaskId,
      type: 'task',
      taskTitle: 'Create marketing poster',
      category: 'outreach', programId,
    }));

    const taskWithHours = await request(app)
      .get(`/api/tasks?staffId=${firstStaffId}`)
      .set('Authorization', `Bearer ${firstStaffToken}`);
    expect(taskWithHours.body).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: assignedTaskId,
        state: 'open',
        hoursLogged: 2,
        loggedHoursByDate: [{ date: linkedDate, hours: 2 }],
      }),
    ]));

    const completed = await request(app)
      .patch(`/api/tasks/${assignedTaskId}/state`)
      .set('Authorization', `Bearer ${firstStaffToken}`)
      .send({ state: 'completed' });
    expect(completed.status).toBe(200);
    const completedTime = await request(app)
      .post('/api/hours')
      .set('Authorization', `Bearer ${firstStaffToken}`)
      .send({ source: 'task', staffId: firstStaffId, taskId: assignedTaskId, date, hours: 1, note: 'Closed task time' });
    expect(completedTime.status).toBe(404);

    const reopened = await request(app)
      .patch(`/api/tasks/${assignedTaskId}/state`)
      .set('Authorization', `Bearer ${firstStaffToken}`)
      .send({ state: 'open' });
    expect(reopened.status).toBe(200);
    const cancelled = await request(app)
      .patch(`/api/tasks/${assignedTaskId}/state`)
      .set('Authorization', `Bearer ${firstStaffToken}`)
      .send({ state: 'cancelled' });
    expect(cancelled.status).toBe(200);
    const cancelledTime = await request(app)
      .post('/api/hours')
      .set('Authorization', `Bearer ${firstStaffToken}`)
      .send({ source: 'task', staffId: firstStaffId, taskId: assignedTaskId, date, hours: 1, note: 'Cancelled task time' });
    expect(cancelledTime.status).toBe(404);

    const linkedDelete = await request(app)
      .delete(`/api/tasks/${assignedTaskId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(linkedDelete.status).toBe(409);
    expect(linkedDelete.body.error).toBe('Tasks with logged time cannot be deleted');

    const entriesAfterRejectedDelete = await request(app)
      .get(`/api/hours/calendar?start=${linkedDate}&end=${linkedDate}`)
      .set('Authorization', `Bearer ${firstStaffToken}`);
    expect(entriesAfterRejectedDelete.body.filter((entry: { staffId: string; date: string }) => entry.staffId === firstStaffId && entry.date === linkedDate)).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: linkedEntry.body.id, taskId: assignedTaskId, taskTitle: 'Create marketing poster' }),
    ]));
  });

  it('lists all accessible cycle data when no date range is provided', async () => {
    const response = await request(app)
      .get('/api/hours/calendar')
      .set('Authorization', `Bearer ${firstStaffToken}`);

    expect(response.status).toBe(200);
    expect(response.body.filter((entry: { staffId: string; date: string }) => entry.staffId === firstStaffId && entry.date === date)).toEqual(expect.arrayContaining([
      expect.objectContaining({ cycleId: activeCycleId, note: 'Delivered workshop' }),
    ]));
    expect(response.body.filter((entry: { staffId: string; date: string }) => entry.staffId === secondStaffId && entry.date === date)).toEqual(expect.arrayContaining([
      expect.objectContaining({ cycleId: activeCycleId, note: 'Created campaign materials' }),
    ]));
  });

  it('can complete an open task atomically while logging its time', async () => {
    const task = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Complete with time', category: 'planning_prep', programId,
        startDate: date, dueDate: date, staffId: firstStaffId,
      });
    expect(task.status).toBe(201);

    const entry = await request(app)
      .post('/api/hours')
      .set('Authorization', `Bearer ${firstStaffToken}`)
      .send({
        source: 'task', staffId: firstStaffId, taskId: task.body.id, completeTask: true,
        date, hours: 1, note: 'Finished in one session',
      });
    expect(entry.status).toBe(201);
    const tasks = await request(app)
      .get(`/api/tasks/calendar?start=${date}&end=${date}&staffIds=${firstStaffId}&statuses=completed`)
      .set('Authorization', `Bearer ${firstStaffToken}`);
    expect(tasks.body).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: task.body.id, status: 'completed', hoursLogged: 1 }),
    ]));
    expect(entry.body.updatedTasks[0]).toEqual(tasks.body.find((row: { id: string }) => row.id === task.body.id));

    await request(app).delete(`/api/hours/${entry.body.id}`).set('Authorization', `Bearer ${firstStaffToken}`);
    await request(app).delete(`/api/tasks/${task.body.id}`).set('Authorization', `Bearer ${adminToken}`);
  });

  it('returns canonical rows and every affected task when hours are moved, reassigned, and deleted', async () => {
    const tasks: string[] = [];
    let entryId: string | undefined;
    const note = `Canonical hours ${Date.now()}`;
    const payload = { source: 'task', staffId: firstStaffId, date, hours: 2, note };
    const taskRecord = async (id: string) => {
      const result = await request(app).get(`/api/tasks/${id}`).set('Authorization', `Bearer ${firstStaffToken}`);
      expect(result.status).toBe(200);
      return result.body;
    };
    const readableEntry = async () => {
      const result = await request(app).get('/api/hours/table').query({ search: note })
        .set('Authorization', `Bearer ${firstStaffToken}`);
      expect(result.status).toBe(200);
      expect(result.body.rows).toHaveLength(1);
      const calendar = await request(app).get('/api/hours/calendar').query({ search: note })
        .set('Authorization', `Bearer ${firstStaffToken}`);
      expect(calendar.status).toBe(200);
      expect(calendar.body).toEqual(result.body.rows);
      return result.body.rows[0];
    };

    try {
      for (const title of ['First hours task', 'Second hours task']) {
        const task = await request(app).post('/api/tasks').set('Authorization', `Bearer ${adminToken}`)
          .send({ title, category: 'planning_prep', programId, startDate: date, dueDate: placementDate, staffId: firstStaffId });
        expect(task.status).toBe(201);
        tasks.push(task.body.id);
      }
      const created = await request(app).post('/api/hours').set('Authorization', `Bearer ${firstStaffToken}`)
        .send({ ...payload, taskId: tasks[0] });
      expect(created.status).toBe(201);
      entryId = created.body.id;
      const { updatedTasks: createdTasks, ...createdEntry } = created.body;
      expect(createdEntry).toEqual(await readableEntry());
      expect(createdTasks).toEqual([await taskRecord(tasks[0])]);

      const moved = await request(app).patch(`/api/hours/${entryId}/placement`)
        .set('Authorization', `Bearer ${firstStaffToken}`).send({ date: placementDate });
      expect(moved.status).toBe(200);
      const { updatedTasks: movedTasks, ...movedEntry } = moved.body;
      expect(movedEntry).toEqual(await readableEntry());
      expect(movedTasks).toEqual([await taskRecord(tasks[0])]);
      expect(moved.body.updatedTasks[0].loggedHoursByDate).toEqual([{ date: placementDate, hours: 2 }]);

      const updated = await request(app).put(`/api/hours/${entryId}`).set('Authorization', `Bearer ${firstStaffToken}`)
        .send({ ...payload, taskId: tasks[1], hours: 3 });
      expect(updated.status).toBe(200);
      const { updatedTasks: updatedTasks, ...updatedEntry } = updated.body;
      expect(updatedEntry).toEqual(await readableEntry());
      expect(updatedTasks).toEqual([await taskRecord(tasks[0]), await taskRecord(tasks[1])]);
      expect(updated.body.updatedTasks.map((task: { hoursLogged: number }) => task.hoursLogged)).toEqual([0, 3]);

      const deleted = await request(app).delete(`/api/hours/${entryId}`).set('Authorization', `Bearer ${firstStaffToken}`);
      expect(deleted.status).toBe(200);
      expect(deleted.body.updatedTasks).toEqual([await taskRecord(tasks[1])]);
      expect(deleted.body.updatedTasks[0].hoursLogged).toBe(0);
      entryId = undefined;
    } finally {
      if (entryId) await request(app).delete(`/api/hours/${entryId}`).set('Authorization', `Bearer ${firstStaffToken}`);
      for (const id of tasks) await request(app).delete(`/api/tasks/${id}`).set('Authorization', `Bearer ${adminToken}`);
    }
  });

  it('requires task-write permission to complete a task while logging time', async () => {
    const task = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Protected task completion', category: 'planning_prep', programId,
        startDate: date, dueDate: date, staffId: firstStaffId,
      });
    expect(task.status).toBe(201);

    const hoursOnlyToken = generateToken(
      firstStaffId,
      'staff',
      'hours-write-only@test.local',
      ['write:hours'],
    );
    const entry = await request(app)
      .post('/api/hours')
      .set('Authorization', `Bearer ${hoursOnlyToken}`)
      .send({
        source: 'task', staffId: firstStaffId, taskId: task.body.id, completeTask: true,
        date, hours: 1, note: 'Should not complete task',
      });

    expect(entry.status).toBe(403);
    const [savedTask] = await sql<Array<{ state: string }>>`
      SELECT state FROM tasks WHERE id = ${task.body.id}
    `;
    const savedEntries = await sql<Array<{ id: string }>>`
      SELECT id FROM time_entries
      WHERE task_id = ${task.body.id} AND note = 'Should not complete task'
    `;
    expect(savedTask.state).toBe('open');
    expect(savedEntries).toHaveLength(0);

    const savedHours = await request(app)
      .post('/api/hours')
      .set('Authorization', `Bearer ${hoursOnlyToken}`)
      .send({
        source: 'task', staffId: firstStaffId, taskId: task.body.id,
        date, hours: 1, note: 'Hours without task read permission',
      });
    expect(savedHours.status).toBe(201);
    expect(savedHours.body).not.toHaveProperty('updatedTasks');
    await request(app).delete(`/api/hours/${savedHours.body.id}`).set('Authorization', `Bearer ${firstStaffToken}`);

    await request(app)
      .delete(`/api/tasks/${task.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`);
  });

  it('rejects work dates that are not covered by a cycle', async () => {
    const outsideCycleDate = '2025-01-15';
    const created = await request(app)
      .post('/api/hours')
      .set('Authorization', `Bearer ${firstStaffToken}`)
      .send({
        source: 'regular',
        staffId: firstStaffId,
        programId: null,
        cycleId: activeCycleId,
        category: 'planning_prep',
        date: outsideCycleDate,
        hours: 1,
        note: 'Planning attributed to the active cycle',
      });
    expect(created.status).toBe(409);
    expect(created.body.error).toBe('No cycle covers the selected work date');
  });

  it('rejects work dates covered by multiple eligible cycles', async () => {
    const [overlap] = await sql<Array<{ cycleId: string }>>`
      WITH cycle AS (
        INSERT INTO program_cycles (name, starts_on, ends_on)
        VALUES ('Overlapping write cycle', ${date}, ${date})
        RETURNING id
      ), assignment AS (
        INSERT INTO program_cycle_assignments (program_id, cycle_id)
        SELECT ${programId}, id FROM cycle
        RETURNING cycle_id
      )
      SELECT cycle_id FROM assignment
    `;
    try {
      const response = await request(app)
        .post('/api/hours')
        .set('Authorization', `Bearer ${firstStaffToken}`)
        .send({ source: 'regular', staffId: firstStaffId, programId, category: 'meeting', date, hours: 1, note: 'Ambiguous cycle' });

      expect(response.status).toBe(409);
      expect(response.body.error).toBe('Multiple cycles cover the selected work date');
    } finally {
      await sql`DELETE FROM program_cycle_assignments WHERE program_id = ${programId} AND cycle_id = ${overlap.cycleId}`;
      await sql`DELETE FROM program_cycles WHERE id = ${overlap.cycleId}`;
    }
  });

  it('updates the stored cycle atomically when placement crosses a cycle boundary', async () => {
    const created = await request(app)
      .post('/api/hours')
      .set('Authorization', `Bearer ${firstStaffToken}`)
      .send({ source: 'regular', staffId: firstStaffId, programId, category: 'meeting', date, hours: 1, note: 'Move across cycles' });
    expect(created.status).toBe(201);
    expect(created.body.cycleId).toBe(activeCycleId);

    const moved = await request(app)
      .patch(`/api/hours/${created.body.id}/placement`)
      .set('Authorization', `Bearer ${firstStaffToken}`)
      .send({ date: upcomingDate });

    expect(moved.status).toBe(200);
    expect(moved.body).toEqual(expect.objectContaining({ date: upcomingDate, cycleId: upcomingCycleId }));
  });

  it('requires range dates to be provided together', async () => {
    const response = await request(app)
      .get(`/api/hours/calendar?start=${date}`)
      .set('Authorization', `Bearer ${firstStaffToken}`);

    expect(response.status).toBe(400);
  });

  it('preserves newer entry content when calendar placement changes', async () => {
    const created = await request(app)
      .post('/api/hours')
      .set('Authorization', `Bearer ${firstStaffToken}`)
      .send({
        source: 'regular', staffId: firstStaffId, programId,
        category: 'meeting', date, hours: 1, note: 'Original note',
      });
    expect(created.status).toBe(201);

    const contentUpdate = await request(app)
      .put(`/api/hours/${created.body.id}`)
      .set('Authorization', `Bearer ${firstStaffToken}`)
      .send({
        source: 'regular', staffId: firstStaffId, programId: null,
        category: 'planning_prep', date, hours: 2.5, note: 'Newer saved note',
      });
    expect(contentUpdate.status).toBe(200);

    const placementUpdate = await request(app)
      .patch(`/api/hours/${created.body.id}/placement`)
      .set('Authorization', `Bearer ${firstStaffToken}`)
      .send({ date: placementDate });

    expect(placementUpdate.status).toBe(200);
    expect(placementUpdate.body).toEqual(expect.objectContaining({
      staffId: firstStaffId,
      programId: null,
      cycleId: activeCycleId,
      category: 'planning_prep',
      date: placementDate,
      hours: 2.5,
      note: 'Newer saved note',
    }));
    const listed = await request(app).get('/api/hours/table').query({ search: 'Newer saved note' })
      .set('Authorization', `Bearer ${firstStaffToken}`);
    expect(listed.status).toBe(200);
    const { updatedTasks: _updatedTasks, ...placedEntry } = placementUpdate.body;
    expect(placedEntry).toEqual(listed.body.rows.find((row: { id: string }) => row.id === created.body.id));
  });

  it('allows staff to update and delete their own entry', async () => {
    const created = await request(app)
      .post('/api/hours')
      .set('Authorization', `Bearer ${firstStaffToken}`)
      .send({ source: 'regular', staffId: firstStaffId, programId, category: 'meeting', date, hours: 1, note: 'Initial note' });

    const updated = await request(app)
      .put(`/api/hours/${created.body.id}`)
      .set('Authorization', `Bearer ${firstStaffToken}`)
      .send({ source: 'regular', staffId: firstStaffId, programId: null, category: 'planning_prep', date, hours: 1.5, note: 'Updated note' });
    expect(updated.status).toBe(200);
    expect(updated.body).toEqual(expect.objectContaining({ programId: null, category: 'planning_prep', hours: 1.5, note: 'Updated note' }));

    const deleted = await request(app)
      .delete(`/api/hours/${created.body.id}`)
      .set('Authorization', `Bearer ${firstStaffToken}`);
    expect(deleted.status).toBe(200);
  });

  it('rejects malformed dates and entry IDs as validation errors', async () => {
    const invalidDate = await request(app)
      .get('/api/hours/calendar?start=2026-99-99&end=2026-99-99')
      .set('Authorization', `Bearer ${firstStaffToken}`);
    const invalidId = await request(app)
      .delete('/api/hours/not-a-uuid')
      .set('Authorization', `Bearer ${firstStaffToken}`);

    expect(invalidDate.status).toBe(400);
    expect(invalidId.status).toBe(400);
  });

  it('accepts calendar ranges spanning more than one year', async () => {
    const response = await request(app)
      .get('/api/hours/calendar?start=2025-01-01&end=2026-01-02')
      .set('Authorization', `Bearer ${firstStaffToken}`);

    expect(response.status).toBe(200);
  });
});
