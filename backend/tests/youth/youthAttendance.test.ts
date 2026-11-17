import request from 'supertest';
import { createApp } from '../shared/app';
import { deleteTestProgramCycle, deleteTestUser, seedTestProgramCycle, seedTestUser, sql } from '../shared/db';
import { generateToken } from '../shared/tokenHelpers';
import { deleteTestYouth } from './helpers';

const app = createApp();

describe('Grouped attendance', () => {
  let adminId: string;
  let adminToken: string;
  let staffId: string;
  let staffToken: string;
  let youthId: string;
  const programIds: string[] = [];
  const cycles: Array<{ programId: string; cycleId: string }> = [];
  const sessionIds: string[] = [];
  const noteIds: string[] = [];

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
        INSERT INTO programs (title, enrollment_required)
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
          INSERT INTO program_sessions (program_id, cycle_id, title, date, start_time, end_time)
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
    const notes = await sql<{ id: string }[]>`
      INSERT INTO session_notes (session_id, category, details, created_by, updated_by)
      VALUES
        (${sessionIds[0]}, 'achievement', 'Led the discussion', ${adminId}, ${adminId}),
        (${sessionIds[0]}, 'general', 'Follow-up note', ${adminId}, ${adminId})
      RETURNING id
    `;
    noteIds.push(...notes.map(note => note.id));
    for (const noteId of noteIds) {
      await sql`INSERT INTO session_note_has_youth (note_id, youth_id) VALUES (${noteId}, ${youthId})`;
    }
  });

  afterAll(async () => {
    await sql`DELETE FROM session_notes WHERE id = ANY(${sql.array(noteIds)}::uuid[])`;
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
    expect((await request(app).get('/api/youth/attendance').query({ youthIds: youthId })).status).toBe(401);
    for (const missing of ['read:youth_profiles', 'read:attendance', 'read:sessions']) {
      const permissions = ['read:youth_profiles', 'read:attendance', 'read:sessions'].filter(permission => permission !== missing);
      const token = generateToken(adminId, 'admin', undefined, permissions);
      const response = await request(app).get('/api/youth/attendance').query({ youthIds: youthId })
        .set('Authorization', `Bearer ${token}`);
      expect(response.status).toBe(403);
    }
  });

  it('validates requested IDs and returns no records for unknown youth', async () => {
    for (const [id, status] of [['invalid', 400], ['00000000-0000-4000-8000-000000000000', 200]]) {
      const response = await request(app).get('/api/youth/attendance').query({ youthIds: id })
        .set('Authorization', `Bearer ${adminToken}`);
      expect(response.status).toBe(status);
    }
  });

  it('accepts requested youth IDs in one batch and restricts their attendance to the selected session', async () => {
    const youth = await seedTestUser({ role: 'youth' });
    await sql`INSERT INTO youth_profiles (user_id) VALUES (${youth.userId})`;
    await sql`
      INSERT INTO attendance_records (session_id, youth_id, status, marked_by)
      VALUES (${sessionIds[0]}, ${youth.userId}, 'late', ${adminId})
    `;
    try {
      const filters = { youthIds: `${youthId},${youth.userId}`, sessionId: sessionIds[0] };
      const response = await request(app).get('/api/youth/attendance').query(filters)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(response.status).toBe(200);
      expect(response.body.groups).toHaveLength(1);
      expect(response.body.groups[0].youth).toHaveLength(2);
      for (const participant of response.body.groups[0].youth) {
        expect(participant.sessions).toEqual([expect.objectContaining({ id: sessionIds[0] })]);
      }
      const cohort = await request(app).get(`/api/programs/${cycles[0].programId}/cycles/${cycles[0].cycleId}/attendance`)
        .query(filters).set('Authorization', `Bearer ${adminToken}`);
      expect(cohort.body).toEqual(response.body);
      const empty = await request(app).get('/api/youth/attendance').query({ youthIds: '' })
        .set('Authorization', `Bearer ${adminToken}`);
      expect(empty.body).toEqual({ groups: [] });
      const malformed = await request(app).get('/api/youth/attendance').query({ youthIds: youthId, sessionId: 'invalid' })
        .set('Authorization', `Bearer ${adminToken}`);
      expect(malformed.status).toBe(400);
    } finally {
      await sql`DELETE FROM attendance_records WHERE youth_id = ${youth.userId}`;
      await deleteTestUser(youth.userId);
    }
  });

  it('groups saved records and notes consistently for profile and cohort filters', async () => {
    const response = await request(app).get('/api/youth/attendance').query({ youthIds: youthId })
      .set('Authorization', `Bearer ${adminToken}`);
    expect(response.status).toBe(200);
    expect(response.body.groups).toHaveLength(2);
    for (const cycle of cycles) {
      const group = response.body.groups.find((item: { programCycle: { programId: string } }) => item.programCycle.programId === cycle.programId);
      const filtered = await request(app).get('/api/youth/attendance').query({ youthIds: youthId })
        .query(cycle).set('Authorization', `Bearer ${adminToken}`);
      expect(filtered.status).toBe(200);
      expect(filtered.body).toEqual({ groups: [group] });
      const cohort = await request(app).get(`/api/programs/${cycle.programId}/cycles/${cycle.cycleId}/attendance`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(cohort.status).toBe(200);
      expect(cohort.body.groups[0].youth.find((person: { id: string }) => person.id === youthId)).toEqual(group.youth[0]);
    }
    const enrolled = response.body.groups.find((item: { programCycle: { enrollmentRequired: boolean } }) => item.programCycle.enrollmentRequired);
    expect(enrolled.youth[0]).toEqual(expect.objectContaining({ presentCount: 1, lateCount: 1, absentCount: 1 }));
    expect(enrolled.averageAttendance).toBe(66.7);
    const session = enrolled.youth[0].sessions.find((item: { id: string }) => item.id === sessionIds[0]);
    expect(session.sessionNotes).toHaveLength(2);
    expect(session.sessionNotes.map((note: { id: string }) => note.id).sort()).toEqual([...noteIds].sort());

    const scoped = await request(app).get('/api/youth/attendance').query({ youthIds: youthId })
      .set('Authorization', `Bearer ${staffToken}`);
    expect(scoped.body).toEqual({ groups: [enrolled] });
  });

  it('validates filters and preserves explicit-target authorization and missing-assignment errors', async () => {
    for (const query of [{ cycleId: 'invalid' }, { programId: 'invalid' }]) {
      const response = await request(app).get('/api/youth/attendance').query({ youthIds: youthId })
        .query(query).set('Authorization', `Bearer ${adminToken}`);
      expect(response.status).toBe(400);
    }
    const denied = await request(app).get('/api/youth/attendance').query({ youthIds: youthId })
      .query(cycles[1]).set('Authorization', `Bearer ${staffToken}`);
    expect(denied.status).toBe(403);
    const missing = await request(app).get('/api/youth/attendance').query({ youthIds: youthId })
      .query({ programId: cycles[0].programId, cycleId: '00000000-0000-4000-8000-000000000000' })
      .set('Authorization', `Bearer ${staffToken}`);
    expect(missing.status).toBe(404);
    const unmatched = await request(app).get('/api/youth/attendance').query({ youthIds: youthId })
      .query({ cycleId: '00000000-0000-4000-8000-000000000000' }).set('Authorization', `Bearer ${adminToken}`);
    expect(unmatched.body).toEqual({ groups: [] });
  });

  it('filters a cycle across programs and keeps program/cycle selections on the same assignment', async () => {
    await sql`INSERT INTO program_cycle_assignments (program_id, cycle_id) VALUES (${programIds[1]}, ${cycles[0].cycleId})`;
    const [session] = await sql<{ id: string }[]>`
      INSERT INTO program_sessions (program_id, cycle_id, title, date, start_time, end_time)
      VALUES (${programIds[1]}, ${cycles[0].cycleId}, 'Shared cycle drop-in', CURRENT_DATE - 1, TIME '01:00', TIME '02:00') RETURNING id
    `;
    try {
      await sql`INSERT INTO attendance_records (session_id, youth_id, status, marked_by) VALUES (${session.id}, ${youthId}, 'present', ${adminId})`;
      const response = await request(app).get('/api/youth/attendance').query({ youthIds: youthId })
        .query({ cycleId: cycles[0].cycleId }).set('Authorization', `Bearer ${adminToken}`);
      expect(response.body.groups).toHaveLength(2);
      expect(response.body.groups.map((group: { programCycle: { cycleId: string } }) => group.programCycle.cycleId))
        .toEqual([cycles[0].cycleId, cycles[0].cycleId]);
      const selected = await request(app).get('/api/youth/attendance').query({ youthIds: youthId })
        .query({ programId: programIds[1] }).set('Authorization', `Bearer ${adminToken}`);
      expect(selected.body.groups).toHaveLength(2);
      expect(selected.body.groups.every((group: { programCycle: { programId: string } }) => group.programCycle.programId === programIds[1])).toBe(true);
      const mismatched = await request(app).get('/api/youth/attendance').query({ youthIds: youthId })
        .query({ programId: programIds[0], cycleId: cycles[1].cycleId }).set('Authorization', `Bearer ${adminToken}`);
      expect(mismatched.status).toBe(404);
    } finally {
      await sql`DELETE FROM attendance_records WHERE session_id = ${session.id}`;
      await sql`DELETE FROM program_sessions WHERE id = ${session.id}`;
      await sql`DELETE FROM program_cycle_assignments WHERE program_id = ${programIds[1]} AND cycle_id = ${cycles[0].cycleId}`;
    }
  });

  it('does not manufacture attendance from enrollment or scheduled sessions', async () => {
    const youth = await seedTestUser({ role: 'youth' });
    await sql`INSERT INTO youth_profiles (user_id) VALUES (${youth.userId})`;
    try {
      await sql`
        INSERT INTO program_enrollments (program_id, cycle_id, youth_id, enrolled_on)
        VALUES (${programIds[0]}, ${cycles[0].cycleId}, ${youth.userId}, CURRENT_DATE - 30)
      `;
      const response = await request(app).get('/api/youth/attendance').query({ youthIds: youth.userId })
        .set('Authorization', `Bearer ${adminToken}`);
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ groups: [] });
    } finally {
      await deleteTestYouth(youth.userId);
    }
  });

  it('returns today and cancelled marks without including them in completed counts', async () => {
    const sessions = await sql<{ id: string }[]>`
      INSERT INTO program_sessions (program_id, cycle_id, title, date, start_time, end_time, cancelled_at)
      VALUES
        (${programIds[0]}, ${cycles[0].cycleId}, 'Today', CURRENT_DATE, TIME '01:00', TIME '02:00', NULL),
        (${programIds[0]}, ${cycles[0].cycleId}, 'Cancelled', CURRENT_DATE - 1, TIME '01:00', TIME '02:00', NOW())
      RETURNING id
    `;
    try {
      for (const session of sessions) {
        await sql`INSERT INTO attendance_records (session_id, youth_id, status, marked_by) VALUES (${session.id}, ${youthId}, 'absent', ${adminId})`;
      }
      const response = await request(app).get('/api/youth/attendance').query({ youthIds: youthId, ...cycles[0] })
        .set('Authorization', `Bearer ${adminToken}`);
      const participant = response.body.groups[0].youth[0];
      expect(participant).toEqual(expect.objectContaining({ presentCount: 1, lateCount: 1, absentCount: 1 }));
      expect(participant.sessions).toEqual(expect.arrayContaining([
        expect.objectContaining({ id: sessions[0].id, completed: false }),
        expect.objectContaining({ id: sessions[1].id, cancelledAt: expect.any(String) }),
      ]));
    } finally {
      await sql`DELETE FROM attendance_records WHERE session_id = ANY(${sql.array(sessions.map(session => session.id))}::uuid[])`;
      await sql`DELETE FROM program_sessions WHERE id = ANY(${sql.array(sessions.map(session => session.id))}::uuid[])`;
    }
  });

  describe('Attendance replacement', () => {
    const baseYouth = { firstName: 'Jamie', lastName: 'Test', dateOfBirth: '2012-06-15' };
    let cycleId: string;
    let youthId: string;
    let otherYouthId: string;
    let firstSessionId: string;
    let secondSessionId: string;
    let openProgramId: string;
    let openCycleId: string;
    let openSessionId: string;

    beforeAll(async () => {
      const [dates] = await sql<{ startsOn: string; endsOn: string }[]>`
        SELECT (CURRENT_DATE - 30)::text AS starts_on, (CURRENT_DATE + 30)::text AS ends_on
      `;
      ({ cycleId } = await seedTestProgramCycle({ programId: programIds[0], ...dates }));
      const youth = await request(app)
        .post('/api/youth')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ...baseYouth, firstName: 'Attendance' });
      const otherYouth = await request(app)
        .post('/api/youth')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ...baseYouth, firstName: 'OtherAttendance' });
      youthId = youth.body.id;
      otherYouthId = otherYouth.body.id;

      await sql`
        INSERT INTO program_enrollments (program_id, cycle_id, youth_id, enrolled_on)
        VALUES
          (${programIds[0]}, ${cycleId}, ${youthId}, CURRENT_DATE - 30),
          (${programIds[0]}, ${cycleId}, ${otherYouthId}, CURRENT_DATE - 30)
      `;
      const sessions = await sql<{ id: string }[]>`
        INSERT INTO program_sessions (
          program_id, cycle_id, session_type, title, date, start_time, end_time, created_by, updated_by
        )
        VALUES
          (${programIds[0]}, ${cycleId}, ${'Regular'}, ${`Youth Attendance A ${Date.now()}`}, (CURRENT_DATE - 2), TIME '17:00', TIME '18:00', ${adminId}, ${adminId}),
          (${programIds[0]}, ${cycleId}, ${'Regular'}, ${`Youth Attendance B ${Date.now()}`}, (CURRENT_DATE - 1), TIME '17:00', TIME '18:00', ${adminId}, ${adminId})
        RETURNING id
      `;
      [firstSessionId, secondSessionId] = sessions.map(session => session.id);

      openProgramId = programIds[1];
      ({ cycleId: openCycleId } = await seedTestProgramCycle({ programId: openProgramId, ...dates }));
      const [openSession] = await sql<{ id: string }[]>`
        INSERT INTO program_sessions (
          program_id, cycle_id, session_type, title, date, start_time, end_time, created_by, updated_by
        )
        VALUES (${openProgramId}, ${openCycleId}, ${'Regular'}, 'Open attendance', (CURRENT_DATE - 1), TIME '19:00', TIME '20:00', ${adminId}, ${adminId})
        RETURNING id
      `;
      openSessionId = openSession.id;
    });

    beforeEach(async () => {
      await sql`DELETE FROM attendance_records WHERE youth_id IN (${youthId}, ${otherYouthId})`;
      await sql`
        INSERT INTO attendance_records (session_id, youth_id, status, marked_by)
        VALUES
          (${firstSessionId}, ${youthId}, 'present', ${adminId}),
          (${firstSessionId}, ${otherYouthId}, 'present', ${adminId})
      `;
    });

    afterAll(async () => {
      await sql`DELETE FROM attendance_records WHERE youth_id IN (${youthId}, ${otherYouthId})`;
      await sql`DELETE FROM program_sessions WHERE id IN (${firstSessionId}, ${secondSessionId}, ${openSessionId})`;
      await deleteTestYouth(youthId);
      await deleteTestYouth(otherYouthId);
      await deleteTestProgramCycle(programIds[0], cycleId);
      await deleteTestProgramCycle(openProgramId, openCycleId);
    });

    it('requires authentication and every attendance-save capability', async () => {
      const path = `/api/youth/${youthId}/programs/${programIds[0]}/cycles/${cycleId}/attendance`;
      expect((await request(app).put(path).send({ records: [] })).status).toBe(401);
      const required = ['read:youth_profiles', 'write:attendance', 'read:sessions'];
      for (const missing of required) {
        const permissions = required.filter(permission => permission !== missing);
        const response = await request(app).put(path).send({ records: [] })
          .set('Authorization', `Bearer ${generateToken(adminId, 'admin', undefined, permissions)}`);
        expect(response.status).toBe(403);
      }
    });

    it('atomically replaces one youth attendance without changing another youth', async () => {
      const [before] = await sql<{ id: string; createdAt: string }[]>`
        SELECT id, created_at FROM attendance_records WHERE session_id = ${firstSessionId} AND youth_id = ${youthId}
      `;
      await sql`
        INSERT INTO attendance_records (session_id, youth_id, status, marked_by)
        VALUES (${secondSessionId}, ${youthId}, 'present', ${adminId})
      `;
      const response = await request(app)
        .put(`/api/youth/${youthId}/programs/${programIds[0]}/cycles/${cycleId}/attendance`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ records: [
          { sessionId: firstSessionId, status: 'late', notes: 'Arrived after kickoff' },
          { sessionId: secondSessionId, status: null },
        ] });

      expect(response.status).toBe(200);
      expect(response.body.attendance.groups[0].youth[0].sessions).toEqual(expect.arrayContaining([
        expect.objectContaining({ id: firstSessionId, status: 'late', notes: 'Arrived after kickoff' }),
      ]));
      const profile = await request(app).get(`/api/youth?id=${youthId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(response.body.updatedYouth).toEqual(profile.body);
      const listedSessions = await request(app).get('/api/sessions')
        .set('Authorization', `Bearer ${adminToken}`).query({ paginate: 'true' });
      expect(response.body.updatedSessions).toEqual(expect.arrayContaining([
        listedSessions.body.rows.find((session: { id: string }) => session.id === firstSessionId),
      ]));
      expect(response.body.updatedProgramCycle).toEqual(expect.objectContaining({ programId: programIds[0], cycleId }));
      const readback = await request(app).get('/api/youth/attendance').query({ youthIds: youthId })
        .query({ programId: programIds[0], cycleId })
        .set('Authorization', `Bearer ${adminToken}`);
      expect(response.body.attendance).toEqual(readback.body);
      const [after] = await sql<{ id: string; createdAt: string }[]>`
        SELECT id, created_at FROM attendance_records WHERE session_id = ${firstSessionId} AND youth_id = ${youthId}
      `;
      expect(after).toEqual(before);
      expect(await sql`SELECT 1 FROM attendance_records WHERE session_id = ${secondSessionId} AND youth_id = ${youthId}`).toHaveLength(0);
      const otherAttendance = await sql<{ status: string }[]>`
        SELECT status FROM attendance_records
        WHERE session_id = ${firstSessionId} AND youth_id = ${otherYouthId}
      `;
      expect(otherAttendance).toEqual([{ status: 'present' }]);
    });

    it('rejects stale partial program attendance replacements without deleting saved attendance', async () => {
      await sql`
        INSERT INTO attendance_records (session_id, youth_id, status, marked_by)
        VALUES (${secondSessionId}, ${youthId}, 'present', ${adminId})
      `;
      const response = await request(app)
        .put(`/api/youth/${youthId}/programs/${programIds[0]}/cycles/${cycleId}/attendance`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ records: [{ sessionId: firstSessionId, status: 'absent' }] });

      expect(response.status).toBe(409);
      const attendance = await sql<{ status: string }[]>`
        SELECT status FROM attendance_records
        WHERE session_id = ${firstSessionId} AND youth_id = ${youthId}
      `;
      expect(attendance).toEqual([{ status: 'present' }]);
    });

    it('limits open-program youth attendance to attended or unmarked', async () => {
      const rejected = await request(app)
        .put(`/api/youth/${youthId}/programs/${openProgramId}/cycles/${openCycleId}/attendance`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ records: [{ sessionId: openSessionId, status: 'late' }] });
      expect(rejected.status).toBe(409);

      const saved = await request(app)
        .put(`/api/youth/${youthId}/programs/${openProgramId}/cycles/${openCycleId}/attendance`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ records: [{ sessionId: openSessionId, status: 'present' }] });
      expect(saved.status).toBe(200);
      expect(saved.body.attendance.groups[0].youth[0].sessions[0]).toEqual(expect.objectContaining({
        id: openSessionId,
        status: 'present',
      }));
    });
  });
});
