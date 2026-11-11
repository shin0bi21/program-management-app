import request from 'supertest';
import { createApp } from '../shared/app';
import { deleteTestProgramCycle, deleteTestUser, seedTestProgramCycle, seedTestUser, sql } from '../shared/db';
import { generateToken } from '../shared/tokenHelpers';

const app = createApp();

describe('Youth active-cycle attendance', () => {
  let adminId: string;
  let adminToken: string;
  let staffId: string;
  let staffToken: string;
  let youthId: string;
  const programIds: string[] = [];
  const cycles: Array<{ programId: string; cycleId: string }> = [];
  const sessionIds: string[] = [];

  beforeAll(async () => {
    const admin = await seedTestUser({ role: 'admin' });
    adminId = admin.userId;
    adminToken = generateToken(adminId, 'admin');
    const staff = await seedTestUser({ role: 'staff' });
    staffId = staff.userId;
    staffToken = generateToken(staffId, 'staff');
    const youth = await seedTestUser({ role: 'youth' });
    youthId = youth.userId;
    await sql`INSERT INTO youth_profiles (user_id) VALUES (${youthId})`;

    const [dates] = await sql<{ startsOn: string; endsOn: string }[]>`
      SELECT (CURRENT_DATE - 30)::text AS starts_on,
        (CURRENT_DATE + 30)::text AS ends_on
    `;

    for (const enrollmentRequired of [true, false]) {
      const [program] = await sql<{ id: string }[]>`
        INSERT INTO programs (name, enrollment_required)
        VALUES (${`Attendance data ${enrollmentRequired} ${Date.now()}`}, ${enrollmentRequired})
        RETURNING id
      `;
      programIds.push(program.id);
      const cycle = await seedTestProgramCycle({ programId: program.id, ...dates });
      cycles.push(cycle);
      if (enrollmentRequired) {
        await sql`
          INSERT INTO program_enrollments (program_id, cycle_id, youth_id, enrolled_on)
          VALUES (${program.id}, ${cycle.cycleId}, ${youthId}, ${dates.startsOn})
        `;
        await sql`INSERT INTO user_program_assignments (user_id, program_id) VALUES (${staffId}, ${program.id})`;
      }
      for (const status of enrollmentRequired ? ['present', 'late', 'absent'] : ['present']) {
        const [session] = await sql<{ id: string }[]>`
          INSERT INTO program_sessions (program_id, cycle_id, theme, date, start_time, end_time)
          VALUES (${program.id}, ${cycle.cycleId}, ${`Summary fixture ${status}`}, CURRENT_DATE - 1, TIME '00:00', TIME '00:01')
          RETURNING id
        `;
        sessionIds.push(session.id);
        await sql`
          INSERT INTO attendance_records (session_id, youth_id, status, marked_by)
          VALUES (${session.id}, ${youthId}, ${status}, ${adminId})
        `;
      }
    }
  });

  afterAll(async () => {
    await sql`DELETE FROM attendance_records WHERE youth_id = ${youthId}`;
    await sql`DELETE FROM program_sessions WHERE id = ANY(${sql.array(sessionIds)}::uuid[])`;
    await sql`DELETE FROM program_enrollments WHERE youth_id = ${youthId}`;
    await sql`DELETE FROM user_program_assignments WHERE user_id = ${staffId}`;
    for (const cycle of cycles) await deleteTestProgramCycle(cycle.programId, cycle.cycleId);
    for (const id of programIds) await sql`DELETE FROM programs WHERE id = ${id}`;
    await deleteTestUser(youthId);
    await deleteTestUser(staffId);
    await deleteTestUser(adminId);
  });

  it('requires authentication and each read capability', async () => {
    expect((await request(app).get(`/api/youth/${youthId}/attendance`)).status).toBe(401);
    for (const permissions of [['read:youth_profiles'], ['read:attendance']]) {
      const token = generateToken(adminId, 'admin', undefined, permissions);
      const response = await request(app).get(`/api/youth/${youthId}/attendance`)
        .set('Authorization', `Bearer ${token}`);
      expect(response.status).toBe(403);
    }
  });

  it('validates identifiers and reports missing profiles', async () => {
    for (const [id, status] of [['invalid', 400], ['00000000-0000-4000-8000-000000000000', 404]]) {
      const response = await request(app).get(`/api/youth/${id}/attendance`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(response.status).toBe(status);
    }
  });

  it('returns scoped full-cycle attendance without adding it to profile rows', async () => {
    const response = await request(app).get(`/api/youth/${youthId}/attendance`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(response.status).toBe(200);
    expect(response.body.programCycle).toEqual(expect.objectContaining({ ...cycles[0], enrollmentRequired: true }));
    expect(response.body.youth).toEqual([expect.objectContaining({ id: youthId, presentCount: 1, lateCount: 1, absentCount: 1 })]);
    expect(response.body.youth[0].sessions).toEqual(expect.arrayContaining([
      expect.objectContaining({ status: 'present', sessionNotes: [] }),
      expect.objectContaining({ status: 'late', sessionNotes: [] }),
      expect.objectContaining({ status: 'absent', sessionNotes: [] }),
    ]));

    const scoped = await request(app).get(`/api/youth/${youthId}/attendance`)
      .set('Authorization', `Bearer ${staffToken}`);
    expect(scoped.status).toBe(200);
    expect(scoped.body.programCycle.programId).toBe(programIds[0]);

    const profile = await request(app).get(`/api/youth?id=${youthId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(profile.status).toBe(200);
    expect(profile.body).not.toHaveProperty('lastAttendedOn');
    expect(profile.body.activeProgram).toEqual(expect.objectContaining({ programId: programIds[0] }));
    expect(profile.body.activeProgram).not.toHaveProperty('presentCount');
  });
});
