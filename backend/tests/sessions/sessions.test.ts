import request from 'supertest';
import { createApp } from '../shared/app';
import { deleteTestUser, seedTestUser, sql } from '../shared/db';
import { generateToken } from '../shared/tokenHelpers';

const app = createApp();

/**
 * Shifts an ISO calendar date by the requested number of days.
 * @example addDays('2027-01-31', 1) // '2027-02-01'
 */
function addDays(date: string, days: number) {
  const value = new Date(`${date}T12:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

/**
 * Builds a valid general note with scenario-specific replacements.
 * @example sessionNoteInput({ details: 'Follow-up' }) // general note with no youth links
 */
function sessionNoteInput(
  overrides: Partial<{
    category: 'general' | 'attendance' | 'behaviour' | 'achievement';
    details: string;
    youthIds: string[];
  }> = {},
) {
  return {
    category: 'general' as const,
    details: 'Session note details.',
    youthIds: [],
    ...overrides,
  };
}

describe('Program cycle sessions and attendance API', () => {
  let staffId: string;
  let staffToken: string;
  let adminId: string;
  let adminToken: string;
  let youthId: string;
  let secondYouthId: string;
  let programId: string;
  let sessionId: string;
  let openProgramId: string;
  let openSessionId: string;
  let unassignedProgramId: string;
  let mainCycleId: string;
  let today: string;
  const guestSpeakerType = 'Guest Speaker';

  beforeAll(async () => {
    const staff = await seedTestUser({ role: 'staff' });
    staffId = staff.userId;
    staffToken = generateToken(staff.userId, 'staff', staff.email);
    const admin = await seedTestUser({ role: 'admin' });
    adminId = admin.userId;
    adminToken = generateToken(admin.userId, 'admin', admin.email);

    const youth = await seedTestUser({ role: 'youth' });
    youthId = youth.userId;
    await sql`
      INSERT INTO youth_profiles (user_id, date_of_birth)
      VALUES (${youthId}, (NOW() AT TIME ZONE 'America/Toronto')::date - INTERVAL '13 years')
    `;
    const secondYouth = await seedTestUser({ role: 'youth' });
    secondYouthId = secondYouth.userId;
    await sql`
      INSERT INTO youth_profiles (user_id, date_of_birth)
      VALUES (${secondYouthId}, (NOW() AT TIME ZONE 'America/Toronto')::date - INTERVAL '14 years')
    `;

    const [program] = await sql<{ id: string }[]>`SELECT id FROM programs WHERE name = 'Soft Skills'`;
    programId = program.id;
    await sql`
      INSERT INTO user_program_assignments (user_id, program_id)
      VALUES (${staffId}, ${programId})
    `;
    const [openProgram] = await sql<{ id: string }[]>`SELECT id FROM programs WHERE name = 'Drop In'`;
    openProgramId = openProgram.id;
    await sql`
      INSERT INTO user_program_assignments (user_id, program_id)
      VALUES (${staffId}, ${openProgramId})
    `;
    const [clock] = await sql<{ today: string }[]>`
      SELECT (CURRENT_TIMESTAMP AT TIME ZONE 'America/Toronto')::date::text AS today
    `;
    today = clock.today;
    const [cycle] = await sql<{ id: string }[]>`
      INSERT INTO program_cycles (name, starts_on, ends_on)
      VALUES (${`Program cycle API ${Date.now()}`}, ${addDays(today, -7)}, ${addDays(today, 60)})
      RETURNING id
    `;
    mainCycleId = cycle.id;
    await sql`INSERT INTO program_cycle_assignments (program_id, cycle_id) VALUES (${programId}, ${mainCycleId})`;

  });

  afterAll(async () => {
    if (openSessionId) {
      await sql`
        DELETE FROM session_note_has_youth
        WHERE note_id IN (SELECT id FROM session_notes WHERE session_id = ${openSessionId})
      `;
      await sql`DELETE FROM session_notes WHERE session_id = ${openSessionId}`;
    }
    if (openSessionId) await sql`DELETE FROM attendance_records WHERE session_id = ${openSessionId}`;
    if (openProgramId) await sql`DELETE FROM program_sessions WHERE program_id = ${openProgramId} AND cycle_id = ${mainCycleId}`;
    if (openProgramId) await sql`DELETE FROM program_cycle_assignments WHERE program_id = ${openProgramId} AND cycle_id = ${mainCycleId}`;
    if (unassignedProgramId) await sql`DELETE FROM program_cycle_assignments WHERE program_id = ${unassignedProgramId} AND cycle_id = ${mainCycleId}`;
    if (sessionId) await sql`DELETE FROM attendance_records WHERE session_id = ${sessionId}`;
    if (sessionId) {
      await sql`
        DELETE FROM session_note_has_youth
        WHERE note_id IN (SELECT id FROM session_notes WHERE session_id = ${sessionId})
      `;
      await sql`DELETE FROM session_notes WHERE session_id = ${sessionId}`;
    }
    if (programId) await sql`DELETE FROM program_enrollments WHERE program_id = ${programId} AND cycle_id = ${mainCycleId}`;
    if (programId) await sql`DELETE FROM program_sessions WHERE program_id = ${programId} AND cycle_id = ${mainCycleId}`;
    if (programId) await sql`DELETE FROM program_cycle_assignments WHERE program_id = ${programId} AND cycle_id = ${mainCycleId}`;
    if (mainCycleId) await sql`DELETE FROM program_cycles WHERE id = ${mainCycleId}`;
    await deleteTestUser(youthId);
    await deleteTestUser(secondYouthId);
    await deleteTestUser(staffId);
    await deleteTestUser(adminId);
  });

  it('reserves global cycle management for admins', async () => {
    const cycle = `Admin Cycle ${Date.now()}`;
    const denied = await request(app)
      .post('/api/cycles')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ name: cycle, programIds: [], startsOn: addDays(today, 70), endsOn: addDays(today, 100) });
    expect(denied.status).toBe(403);

    const created = await request(app)
      .post('/api/cycles')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: cycle, programIds: [], startsOn: addDays(today, 70), endsOn: addDays(today, 100) });
    expect(created.status).toBe(201);

    const updated = await request(app)
      .put(`/api/cycles/${created.body.cycle.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: `${cycle} Updated`, programIds: [], startsOn: addDays(today, 71), endsOn: addDays(today, 101) });
    expect(updated.status).toBe(200);
    expect(updated.body.cycle).toEqual(expect.objectContaining({ name: `${cycle} Updated` }));

    const deniedDelete = await request(app)
      .delete(`/api/cycles/${created.body.cycle.id}`)
      .set('Authorization', `Bearer ${staffToken}`);
    expect(deniedDelete.status).toBe(403);

    const deleted = await request(app)
      .delete(`/api/cycles/${created.body.cycle.id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(deleted.status).toBe(200);
    expect(deleted.body).toEqual({ id: created.body.cycle.id });
    expect(await sql`SELECT id FROM program_cycles WHERE id = ${created.body.cycle.id}`).toHaveLength(0);

    const missing = await request(app)
      .delete(`/api/cycles/${created.body.cycle.id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(missing.status).toBe(404);
  });

  it('keeps the full program cycle lookup available for Youth profile filters', async () => {
    const [jobReadiness] = await sql<{ id: string }[]>`
      SELECT id FROM programs WHERE name = 'Job Readiness'
    `;
    await sql`
      INSERT INTO program_cycle_assignments (program_id, cycle_id)
      VALUES (${jobReadiness.id}, ${mainCycleId})
    `;
    unassignedProgramId = jobReadiness.id;

    const scoped = await request(app)
      .get('/api/programs/cycle-assignments')
      .set('Authorization', `Bearer ${staffToken}`);
    const all = await request(app)
      .get('/api/programs/cycle-assignments?scope=all')
      .set('Authorization', `Bearer ${staffToken}`);

    expect(scoped.body.map((row: { programId: string }) => row.programId)).not.toContain(unassignedProgramId);
    expect(all.body.map((row: { programId: string }) => row.programId)).toContain(unassignedProgramId);
  });

  it('does not partially enroll a batch containing an unknown youth', async () => {
    const response = await request(app)
      .post(`/api/programs/${programId}/cycles/${mainCycleId}/enrollments`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        youthIds: [youthId, '00000000-0000-0000-0000-000000000000'],
      });

    expect(response.status).toBe(404);
    const enrollments = await sql<{ count: number }[]>`
      SELECT COUNT(*)::int AS count
      FROM program_enrollments
      WHERE program_id = ${programId} AND cycle_id = ${mainCycleId}
        AND youth_id = ${youthId}
    `;
    expect(enrollments[0].count).toBe(0);
  });

  it('enrolls multiple youth atomically with server-generated dates', async () => {
    const response = await request(app)
      .post(`/api/programs/${programId}/cycles/${mainCycleId}/enrollments`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ youthIds: [youthId, secondYouthId] });

    expect(response.status).toBe(201);
    expect(response.body.enrollments).toEqual(expect.arrayContaining([
      expect.objectContaining({
        programId, cycleId: mainCycleId,
        youthId,
        enrolledOn: today,
        withdrawnOn: null,
      }),
      expect.objectContaining({
        programId, cycleId: mainCycleId,
        youthId: secondYouthId,
        enrolledOn: today,
        withdrawnOn: null,
      }),
    ]));
  });

  it('creates individual sessions with explicit dates and type', async () => {
    const firstSessionDate = addDays(today, 1);
    const sessionDates = [firstSessionDate, addDays(firstSessionDate, 7), addDays(firstSessionDate, 14)];
    for (const date of sessionDates) {
      const response = await request(app)
        .post(`/api/programs/${programId}/cycles/${mainCycleId}/sessions`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ sessionType: guestSpeakerType, theme: 'Communication', date, startTime: '17:00', endTime: '19:30' });

      expect(response.status).toBe(201);
      expect(response.body.theme).toBe('Communication');
      expect(response.body.sessionType).toBe('Guest Speaker');
      if (date === firstSessionDate) sessionId = response.body.id;
    }

    const dates = await sql<{ localDate: string }[]>`
      SELECT (starts_at AT TIME ZONE 'America/Toronto')::date::text AS local_date
      FROM program_sessions
      WHERE program_id = ${programId} AND cycle_id = ${mainCycleId} AND theme = 'Communication'
      ORDER BY starts_at
    `;
    expect(dates.map(session => session.localDate)).toEqual([
      firstSessionDate,
      addDays(firstSessionDate, 7),
      addDays(firstSessionDate, 14),
    ]);
  });

  it('rejects a session without a title or theme', async () => {
    const response = await request(app)
      .post(`/api/programs/${programId}/cycles/${mainCycleId}/sessions`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        sessionType: guestSpeakerType,
        date: addDays(today, 2),
        startTime: '13:00',
        endTime: '14:00',
      });

    expect(response.status).toBe(400);
  });

  it('stores session notes separately with optional enrolled youth attachments', async () => {
    const attached = await request(app)
      .post(`/api/sessions/${sessionId}/notes`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send(sessionNoteInput({
        category: 'achievement',
        details: 'Youth led the group discussion.',
        youthIds: [youthId, secondYouthId],
      }));
    expect(attached.status).toBe(201);
    expect(attached.body).toEqual(expect.objectContaining({
      sessionId,
      category: 'achievement',
      details: 'Youth led the group discussion.',
      youth: expect.arrayContaining([
        expect.objectContaining({ youthId }),
        expect.objectContaining({ youthId: secondYouthId }),
      ]),
    }));

    const unlinked = await request(app)
      .post(`/api/sessions/${sessionId}/notes`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        category: 'general',
        details: 'Extended session note.',
        youthIds: [],
      });
    expect(unlinked.status).toBe(201);
    expect(unlinked.body.details).toBe('Extended session note.');
    expect(unlinked.body.youth).toEqual([]);

    const notes = await request(app)
      .get(`/api/sessions/${sessionId}/notes`)
      .set('Authorization', `Bearer ${staffToken}`);
    expect(notes.status).toBe(200);
    expect(notes.body).toHaveLength(2);

    const unlinkedYouth = await request(app)
      .delete(`/api/sessions/${sessionId}/notes/${attached.body.id}/youth/${youthId}`)
      .set('Authorization', `Bearer ${staffToken}`);
    expect(unlinkedYouth.status).toBe(200);
    expect(unlinkedYouth.body).toEqual({ noteId: attached.body.id, youthId });

    const notesAfterUnlink = await request(app)
      .get(`/api/sessions/${sessionId}/notes`)
      .set('Authorization', `Bearer ${staffToken}`);
    expect(notesAfterUnlink.body).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: attached.body.id,
        youth: [expect.objectContaining({ youthId: secondYouthId })],
      }),
    ]));

    const unlinkedLastYouth = await request(app)
      .delete(`/api/sessions/${sessionId}/notes/${attached.body.id}/youth/${secondYouthId}`)
      .set('Authorization', `Bearer ${staffToken}`);
    expect(unlinkedLastYouth.status).toBe(200);

    const notesWithoutYouthLinks = await request(app)
      .get(`/api/sessions/${sessionId}/notes`)
      .set('Authorization', `Bearer ${staffToken}`);
    expect(notesWithoutYouthLinks.body).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: attached.body.id, youth: [] }),
    ]));

    const missingLink = await request(app)
      .delete(`/api/sessions/${sessionId}/notes/${attached.body.id}/youth/${secondYouthId}`)
      .set('Authorization', `Bearer ${staffToken}`);
    expect(missingLink.status).toBe(404);

    const invalidYouthId = await request(app)
      .delete(`/api/sessions/${sessionId}/notes/${attached.body.id}/youth/not-a-uuid`)
      .set('Authorization', `Bearer ${staffToken}`);
    expect(invalidYouthId.status).toBe(400);

    const forbidden = await request(app)
      .delete(`/api/sessions/${sessionId}/notes/${attached.body.id}/youth/${youthId}`)
      .set('Authorization', `Bearer ${generateToken(youthId, 'youth', 'youth@example.com')}`);
    expect(forbidden.status).toBe(403);

    const [session] = await sql<{ description: string | null }[]>`
      SELECT description FROM program_sessions WHERE id = ${sessionId}
    `;
    expect(session.description).toBeNull();
  });

  it('updates and deletes session notes', async () => {
    const notes = await request(app)
      .get(`/api/sessions/${sessionId}/notes`)
      .set('Authorization', `Bearer ${staffToken}`);
    const attached = notes.body.find((note: { details: string }) => (
      note.details === 'Youth led the group discussion.'
    ));
    const unlinked = notes.body.find((note: { details: string }) => (
      note.details === 'Extended session note.'
    ));

    const updated = await request(app)
      .put(`/api/sessions/${sessionId}/notes/${attached.id}`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send(sessionNoteInput({
        category: 'behaviour',
        details: 'Updated details.',
        youthIds: [secondYouthId],
      }));
    expect(updated.status).toBe(200);
    expect(updated.body).toEqual(expect.objectContaining({
      id: attached.id,
      category: 'behaviour',
      details: 'Updated details.',
      youth: [expect.objectContaining({ youthId: secondYouthId })],
    }));

    const deleted = await request(app)
      .delete(`/api/sessions/${sessionId}/notes/${unlinked.id}`)
      .set('Authorization', `Bearer ${staffToken}`);
    expect(deleted.status).toBe(200);
    expect(deleted.body).toEqual({ id: unlinked.id });

    const remaining = await request(app)
      .get(`/api/sessions/${sessionId}/notes`)
      .set('Authorization', `Bearer ${staffToken}`);
    expect(remaining.body).toHaveLength(1);
    expect(remaining.body[0].id).toBe(attached.id);
  });

  it('uploads, edits, downloads by title, and deletes session attachments with linked youth', async () => {
    const uploaded = await request(app)
      .post(`/api/sessions/${sessionId}/attachments`)
      .set('Authorization', `Bearer ${staffToken}`)
      .field('title', 'Reflection worksheet')
      .field('description', 'Completed during the session.')
      .field('youthIds', JSON.stringify([youthId]))
      .attach('file', Buffer.from('reflection notes'), {
        filename: 'reflection.txt',
        contentType: 'text/plain',
      });

    expect(uploaded.status).toBe(201);
    expect(uploaded.body).toEqual(expect.objectContaining({
      title: 'Reflection worksheet',
      originalFilename: 'reflection.txt',
      youth: [expect.objectContaining({ youthId })],
    }));
    const attachment = uploaded.body;

    const updated = await request(app)
      .put(`/api/sessions/${sessionId}/attachments/${attachment.id}`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        title: 'Updated / worksheet.',
        description: 'Updated attachment details.',
        youthIds: [youthId],
      });
    expect(updated.status).toBe(200);
    expect(updated.body).toEqual(expect.objectContaining({
      id: attachment.id,
      title: 'Updated / worksheet.',
      description: 'Updated attachment details.',
      youth: [expect.objectContaining({ youthId })],
    }));

    const downloaded = await request(app)
      .get(`/api/sessions/${sessionId}/attachments/${attachment.id}/file`)
      .set('Authorization', `Bearer ${staffToken}`);
    expect(downloaded.status).toBe(200);
    expect(downloaded.headers['content-disposition']).toContain('Updated - worksheet.txt');

    const deleted = await request(app)
      .delete(`/api/sessions/${sessionId}/attachments/${attachment.id}`)
      .set('Authorization', `Bearer ${staffToken}`);
    expect(deleted.status).toBe(200);

    const listed = await request(app)
      .get(`/api/sessions/${sessionId}/attachments`)
      .set('Authorization', `Bearer ${staffToken}`);
    expect(listed.status).toBe(200);
    expect(listed.body).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ id: attachment.id }),
    ]));
  });

  it('rejects spreadsheet session attachments', async () => {
    const response = await request(app)
      .post(`/api/sessions/${sessionId}/attachments`)
      .set('Authorization', `Bearer ${staffToken}`)
      .field('title', 'Spreadsheet')
      .field('youthIds', '[]')
      .attach('file', Buffer.from('spreadsheet'), {
        filename: 'attendance.xlsx',
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Unsupported attachment file type');
  });

  it('returns linked session notes with context on a youth profile', async () => {
    const response = await request(app)
      .get(`/api/youth/${secondYouthId}/session-notes`)
      .set('Authorization', `Bearer ${staffToken}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual([
      expect.objectContaining({
        category: 'behaviour',
        details: 'Updated details.',
        sessionId,
        programId, cycleId: mainCycleId,
        program: 'Soft Skills',
        youth: [expect.objectContaining({ youthId: secondYouthId })],
      }),
    ]);

    const unassignedStaff = await seedTestUser({ role: 'staff' });
    try {
      const unassignedToken = generateToken(
        unassignedStaff.userId,
        'staff',
        unassignedStaff.email,
      );
      const restricted = await request(app)
        .get(`/api/youth/${secondYouthId}/session-notes`)
        .set('Authorization', `Bearer ${unassignedToken}`);
      expect(restricted.status).toBe(200);
      expect(restricted.body).toEqual([]);
    } finally {
      await deleteTestUser(unassignedStaff.userId);
    }
  });

  it('rejects youth attachments outside the session program cycle', async () => {
    const response = await request(app)
      .post(`/api/sessions/${sessionId}/notes`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send(sessionNoteInput({
        details: 'This should not be saved.',
        youthIds: ['00000000-0000-0000-0000-000000000000'],
      }));

    expect(response.status).toBe(409);
  });

  it('rejects youth who were not enrolled on the session date', async () => {
    await sql`
      UPDATE program_enrollments
      SET enrolled_on = ${addDays(today, 2)}
      WHERE program_id = ${programId} AND cycle_id = ${mainCycleId}
        AND youth_id = ${secondYouthId}
    `;

    const response = await request(app)
      .post(`/api/sessions/${sessionId}/notes`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send(sessionNoteInput({
        details: 'This should not be saved.',
        youthIds: [secondYouthId],
      }));

    await sql`
      UPDATE program_enrollments
      SET enrolled_on = ${today}
      WHERE program_id = ${programId} AND cycle_id = ${mainCycleId}
        AND youth_id = ${secondYouthId}
    `;

    expect(response.status).toBe(409);
  });

  it('prevents deleting a session or assignment that has session notes', async () => {
    const sessionResponse = await request(app)
      .delete(`/api/sessions/${sessionId}`)
      .set('Authorization', `Bearer ${staffToken}`);
    const assignmentResponse = await request(app)
      .put(`/api/programs/${programId}/cycles`)
      .set('Authorization', `Bearer ${adminToken}`).send({ cycleIds: [] });

    expect(sessionResponse.status).toBe(409);
    expect(assignmentResponse.status).toBe(409);
  });

  it('creates an open Drop In session with no enrollment roster', async () => {
    await sql`INSERT INTO program_cycle_assignments (program_id, cycle_id) VALUES (${openProgramId}, ${mainCycleId})`;

    const created = await request(app)
      .post(`/api/programs/${openProgramId}/cycles/${mainCycleId}/sessions`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        theme: 'Friday Drop In',
        sessionType: guestSpeakerType,
        date: addDays(today, 1),
        startTime: '17:00',
        endTime: '20:00',
      });
    expect(created.status).toBe(201);
    openSessionId = created.body.id;

    const roster = await request(app)
      .get(`/api/sessions/${openSessionId}/roster`)
      .set('Authorization', `Bearer ${staffToken}`);
    expect(roster.status).toBe(200);
    expect(roster.body).toEqual([]);
  });

  it('checks any youth profile into an open session as attended', async () => {
    const checkedIn = await request(app)
      .put(`/api/sessions/${openSessionId}/attendance`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ records: [{ youthId, status: 'present' }] });
    expect(checkedIn.status).toBe(200);
    expect(checkedIn.body.roster).toEqual([
      expect.objectContaining({ youthId, status: 'present' }),
    ]);

    const late = await request(app)
      .put(`/api/sessions/${openSessionId}/attendance`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ records: [{ youthId, status: 'late' }] });
    expect(late.status).toBe(409);

    const replaced = await request(app)
      .put(`/api/sessions/${openSessionId}/attendance`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ records: [{ youthId: secondYouthId, status: 'present' }] });
    expect(replaced.status).toBe(200);
    expect(replaced.body.roster).toEqual([
      expect.objectContaining({ youthId: secondYouthId, status: 'present' }),
    ]);
  });

  it('allows open session notes to attach checked-in youth', async () => {
    const response = await request(app)
      .post(`/api/sessions/${openSessionId}/notes`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send(sessionNoteInput({
        category: 'general',
        details: 'Followed up after Drop In.',
        youthIds: [secondYouthId],
      }));

    expect(response.status).toBe(201);
    expect(response.body.youth).toEqual([
      expect.objectContaining({ youthId: secondYouthId }),
    ]);
  });

  it('rejects open session notes for youth who are not checked in', async () => {
    const response = await request(app)
      .post(`/api/sessions/${openSessionId}/notes`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send(sessionNoteInput({
        details: 'This should not be saved.',
        youthIds: [youthId],
      }));

    expect(response.status).toBe(409);
  });

  it('rejects enrollment in an open attendance program', async () => {
    const directEnrollment = await request(app)
      .post(`/api/programs/${openProgramId}/cycles/${mainCycleId}/enrollments`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ youthIds: [youthId] });
    expect(directEnrollment.status).toBe(409);
  });

  it('reports open-session reach without creating an enrollment', async () => {
    await sql`
      INSERT INTO attendance_records (session_id, youth_id, status, marked_by)
      VALUES (${openSessionId}, ${youthId}, 'absent', ${staffId})
      ON CONFLICT (session_id, youth_id)
      DO UPDATE SET status = EXCLUDED.status
    `;

    const enrollments = await sql<{ count: number }[]>`
      SELECT COUNT(*)::int AS count
      FROM program_enrollments
      WHERE program_id = ${openProgramId} AND cycle_id = ${mainCycleId}
    `;
    expect(enrollments[0].count).toBe(0);

    const overview = await request(app)
      .get(`/api/programs/cycle-assignments?programId=${openProgramId}`)
      .set('Authorization', `Bearer ${staffToken}`);
    expect(overview.status).toBe(200);
    expect(overview.body).toEqual(expect.arrayContaining([
      expect.objectContaining({
        programId: openProgramId, cycleId: mainCycleId,
        enrollmentRequired: false,
        enrolledCount: 0,
        uniqueAttendeeCount: 1,
      }),
    ]));

    await sql`
      DELETE FROM attendance_records
      WHERE session_id = ${openSessionId} AND youth_id = ${youthId}
    `;

  });

  it('returns enrolled youth on the session roster and saves attendance', async () => {
    const roster = await request(app)
      .get(`/api/sessions/${sessionId}/roster`)
      .set('Authorization', `Bearer ${staffToken}`);

    expect(roster.status).toBe(200);
    expect(roster.body).toEqual(expect.arrayContaining([
      expect.objectContaining({ youthId, status: null }),
    ]));

    const saved = await request(app)
      .put(`/api/sessions/${sessionId}/attendance`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        records: [
          { youthId, status: 'present' },
          { youthId: secondYouthId, status: 'present' },
        ],
      });

    expect(saved.status).toBe(200);
    expect(saved.body.session).toMatchObject({ id: sessionId, programId, cycleId: mainCycleId });
    expect(saved.body.session.cycle).toEqual(expect.any(String));
    expect(saved.body.updatedProgramCycle).toMatchObject({ programId, cycleId: mainCycleId, });
    expect(saved.body.updatedYouth).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: youthId }), expect.objectContaining({ id: secondYouthId }),
    ]));
    expect(saved.body.roster).toEqual(expect.arrayContaining([
      expect.objectContaining({ youthId, status: 'present' }),
      expect.objectContaining({ youthId: secondYouthId, status: 'present' }),
    ]));
  });

  it('limits attendance mutation side-loaded rows to the actor capabilities', async () => {
    const attendanceWriter = generateToken(staffId, 'staff', undefined, ['write:attendance']);
    const response = await request(app).put(`/api/sessions/${sessionId}/attendance`)
      .set('Authorization', `Bearer ${attendanceWriter}`)
      .send({ records: [{ youthId, status: 'present' }, { youthId: secondYouthId, status: 'present' }] });

    expect(response.status).toBe(200);
    expect(response.body.session).toMatchObject({ id: sessionId, programId, cycleId: mainCycleId });
    expect(response.body).not.toHaveProperty('updatedProgramCycle');
    expect(response.body).not.toHaveProperty('updatedYouth');
  });

  it('returns program cycle overview metrics for Programming', async () => {
    const overview = await request(app)
      .get(`/api/programs/cycle-assignments?programId=${programId}`)
      .set('Authorization', `Bearer ${staffToken}`);
    expect(overview.status).toBe(200);
    expect(overview.body).toEqual(expect.arrayContaining([
      expect.objectContaining({
        programId, cycleId: mainCycleId,
        nextSessionId: sessionId,
        nextSessionAt: expect.any(String),
        minAge: 12,
        maxAge: 15,
      }),
    ]));
  });

  it('lists sessions for management with program and cycle filters and attendance', async () => {
    const response = await request(app)
      .get(
        `/api/sessions?programIds=${programId}&cycleIds=${mainCycleId}`
        + `&sessionTypes=${encodeURIComponent(guestSpeakerType)}&statuses=upcoming&search=Communication`,
      )
      .set('Authorization', `Bearer ${staffToken}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: sessionId,
        programId, cycleId: mainCycleId,
        theme: 'Communication',

        sessionType: 'Guest Speaker',
      }),
    ]));
  });

  it('filters sessions across selected cycles while preserving program scope and pagination', async () => {
    const [otherCycle] = await sql<{ id: string }[]>`
      INSERT INTO program_cycles (name, starts_on, ends_on)
      VALUES (${`Other session cycle ${Date.now()}`}, ${today}, ${addDays(today, 60)})
      RETURNING id
    `;
    let unrelatedSessionId: string | undefined;

    try {
      await sql`
        INSERT INTO program_cycle_assignments (program_id, cycle_id)
        VALUES (${programId}, ${otherCycle.id})
      `;
      const [otherSession, unrelatedSession] = await sql<{ id: string }[]>`
        INSERT INTO program_sessions (program_id, cycle_id, theme, starts_at, ends_at)
        VALUES
          (${programId}, ${otherCycle.id}, 'Other cycle session', ${addDays(today, 1)}::date + TIME '12:00', ${addDays(today, 1)}::date + TIME '13:00'),
          (${unassignedProgramId}, ${mainCycleId}, 'Unassigned program session', ${addDays(today, 1)}::date + TIME '12:00', ${addDays(today, 1)}::date + TIME '13:00')
        RETURNING id
      `;
      unrelatedSessionId = unrelatedSession.id;

      const response = await request(app)
        .get('/api/sessions')
        .query({ cycleIds: mainCycleId })
        .set('Authorization', `Bearer ${staffToken}`);

      expect(response.status).toBe(200);
      const sessionIds = response.body.map((session: { id: string }) => session.id);
      expect(sessionIds).toEqual(expect.arrayContaining([sessionId, openSessionId]));
      expect(sessionIds).not.toContain(otherSession.id);
      expect(sessionIds).not.toContain(unrelatedSession.id);
      expect(new Set(response.body.map((session: { programId: string }) => session.programId)))
        .toEqual(new Set([programId, openProgramId]));

      const selectedCycles = `${mainCycleId},${otherCycle.id}`;
      const multipleCycles = await request(app)
        .get('/api/sessions')
        .query({ cycleIds: selectedCycles })
        .set('Authorization', `Bearer ${staffToken}`);

      expect(multipleCycles.status).toBe(200);
      const multipleIds = multipleCycles.body.map((session: { id: string }) => session.id);
      expect(multipleIds).toEqual(expect.arrayContaining([sessionId, openSessionId, otherSession.id]));
      expect(multipleIds).not.toContain(unrelatedSession.id);
      expect(new Set(multipleIds).size).toBe(multipleIds.length);

      const dateRange = await request(app)
        .get('/api/sessions')
        .query({
          cycleIds: selectedCycles,
          programIds: programId,
          search: 'Other cycle session',
          start: `${today}T00:00:00Z`,
          end: `${addDays(today, 3)}T00:00:00Z`,
          paginate: 'true',
        })
        .set('Authorization', `Bearer ${staffToken}`);

      expect(dateRange.status).toBe(200);
      expect(dateRange.body).toEqual({
        rows: [expect.objectContaining({ id: otherSession.id, programId })],
        nextCursor: null,
      });

      const programPage = await request(app)
        .get('/api/sessions')
        .query({ cycleIds: selectedCycles, programIds: openProgramId, paginate: 'true' })
        .set('Authorization', `Bearer ${staffToken}`);

      expect(programPage.status).toBe(200);
      expect(programPage.body).toEqual({
        rows: [expect.objectContaining({ id: openSessionId, programId: openProgramId })],
        nextCursor: null,
      });

      const adminResponse = await request(app)
        .get('/api/sessions')
        .query({ cycleIds: mainCycleId, programIds: unassignedProgramId })
        .set('Authorization', `Bearer ${adminToken}`);

      expect(adminResponse.status).toBe(200);
      expect(adminResponse.body).toEqual([expect.objectContaining({ id: unrelatedSession.id })]);
    } finally {
      if (unrelatedSessionId) await sql`DELETE FROM program_sessions WHERE id = ${unrelatedSessionId}`;
      await sql`DELETE FROM program_sessions WHERE cycle_id = ${otherCycle.id}`;
      await sql`DELETE FROM program_cycle_assignments WHERE cycle_id = ${otherCycle.id}`;
      await sql`DELETE FROM program_cycles WHERE id = ${otherCycle.id}`;
    }
  });

  it('rejects malformed cycle filters on the session list', async () => {
    const response = await request(app)
      .get('/api/sessions')
      .query({ cycleIds: 'not-a-uuid' })
      .set('Authorization', `Bearer ${staffToken}`);

    expect(response.status).toBe(400);

    const tooMany = await request(app)
      .get('/api/sessions')
      .query({ cycleIds: Array(21).fill(mainCycleId).join(',') })
      .set('Authorization', `Bearer ${staffToken}`);
    expect(tooMany.status).toBe(400);
  });

  it('defaults omitted management session filters', async () => {
    const response = await request(app)
      .get('/api/sessions')
      .set('Authorization', `Bearer ${staffToken}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: sessionId }),
    ]));
  });

  it('filters calendar sessions on the backend', async () => {
    const response = await request(app)
      .get('/api/sessions')
      .query({
        start: `${addDays(today, -1)}T00:00:00.000Z`,
        end: `${addDays(today, 10)}T00:00:00.000Z`,
        programIds: openProgramId, cycleIds: mainCycleId,
        statuses: 'upcoming',
        search: 'Drop In',
      })
      .set('Authorization', `Bearer ${staffToken}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual([
      expect.objectContaining({
        id: openSessionId,
        programId: openProgramId, cycleId: mainCycleId,
        state: 'upcoming',
      }),
    ]);
  });

  it('returns sessions across a multi-year read range', async () => {
    const response = await request(app).get('/api/sessions')
      .query({
        start: `${addDays(today, -400)}T00:00:00.000Z`,
        end: `${addDays(today, 400)}T00:00:00.000Z`,
        programIds: openProgramId, cycleIds: mainCycleId,
      })
      .set('Authorization', `Bearer ${staffToken}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual([expect.objectContaining({ id: openSessionId })]);
  });

  it('rejects a session range whose end is chronologically before its start', async () => {
    const response = await request(app)
      .get('/api/sessions')
      .query({
        start: '2026-07-01T10:00:00.000-04:00',
        end: '2026-07-01T13:00:00.000Z',
      })
      .set('Authorization', `Bearer ${staffToken}`);

    expect(response.status).toBe(400);
  });

  it('preserves a session and its logged hours when hours are the only deletion dependency', async () => {
    const created = await request(app)
      .post(`/api/programs/${programId}/cycles/${mainCycleId}/sessions`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ sessionType: guestSpeakerType, theme: 'Session with logged hours', date: today, startTime: '12:00', endTime: '13:00' });
    expect(created.status).toBe(201);
    const recordedSessionId = created.body.id;
    let entryId: string | undefined;

    try {
      const hours = await request(app).post('/api/hours')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ source: 'session', staffId, sessionId: recordedSessionId, hours: 1, note: 'Delivered session' });
      expect(hours.status).toBe(201);
      entryId = hours.body.id as string;

      const response = await request(app).delete(`/api/sessions/${recordedSessionId}`)
        .set('Authorization', `Bearer ${staffToken}`);

      expect(response.status).toBe(409);
      expect(response.body.error).toBe('Session cannot be deleted because hours have been logged');
      expect(await sql`SELECT id FROM program_sessions WHERE id = ${recordedSessionId}`).toHaveLength(1);
      expect(await sql`SELECT id FROM time_entries WHERE id = ${entryId} AND session_id = ${recordedSessionId}`).toHaveLength(1);
    } finally {
      await sql`DELETE FROM time_entries WHERE session_id = ${recordedSessionId}`;
      if (entryId) await sql`DELETE FROM audit_log WHERE table_name = 'time_entries' AND record_id = ${entryId}`;
      await sql`DELETE FROM program_sessions WHERE id = ${recordedSessionId}`;
    }
  });

  it('edits and deletes sessions while retaining enrollment history', async () => {
    const created = await request(app)
      .post(`/api/programs/${programId}/cycles/${mainCycleId}/sessions`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ sessionType: guestSpeakerType, theme: 'Disposable Session', date: addDays(today, 1), startTime: '17:00', endTime: '19:00' });
    expect(created.status).toBe(201);
    const disposableSessionId = created.body.id;

    const updated = await request(app).put(`/api/sessions/${disposableSessionId}`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ theme: 'Updated theme', startsAt: `${addDays(today, 1)}T21:30:00.000Z`, endsAt: `${addDays(today, 1)}T23:00:00.000Z`, description: 'Updated description' });
    expect(updated.status).toBe(200);
    expect(updated.body.session.theme).toBe('Updated theme');
    expect((await request(app).delete(`/api/sessions/${disposableSessionId}`)
      .set('Authorization', `Bearer ${staffToken}`)).status).toBe(200);
    expect(await sql`SELECT 1 FROM program_enrollments WHERE program_id = ${programId} AND cycle_id = ${mainCycleId}`).toHaveLength(2);
  });

  it('clears an existing attendance record when a roster member is not marked', async () => {
    const response = await request(app)
      .put(`/api/sessions/${sessionId}/attendance`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ records: [{ youthId, status: 'present' }] });

    expect(response.status).toBe(200);
    expect(response.body.roster).toEqual(expect.arrayContaining([
      expect.objectContaining({ youthId, status: 'present' }),
      expect.objectContaining({ youthId: secondYouthId, status: null }),
    ]));
  });
  it('loads scoped cycle attendance and renders that supplied data as a PDF', async () => {
    await sql`UPDATE program_cycles SET starts_on = ${addDays(today, -2)} WHERE id = ${mainCycleId}`;
    await sql`
      UPDATE program_sessions
      SET starts_at = ${addDays(today, -1) + 'T17:00:00.000Z'},
          ends_at = ${addDays(today, -1) + 'T18:00:00.000Z'}
      WHERE id = ${sessionId}
    `;
    await sql`
      UPDATE program_enrollments
      SET enrolled_on = ${addDays(today, -2)}
      WHERE program_id = ${programId} AND cycle_id = ${mainCycleId}
    `;
    const response = await request(app)
      .get(`/api/programs/${programId}/cycles/${mainCycleId}/attendance`)
      .set('Authorization', `Bearer ${staffToken}`);

    expect(response.status).toBe(200);
    expect(response.body.programCycle).toEqual(expect.objectContaining({ programId, cycleId: mainCycleId, cycle: expect.any(String) }));
    expect(response.body.youth).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: youthId, sessions: expect.arrayContaining([
        expect.objectContaining({ id: sessionId, sessionType: 'Guest Speaker', theme: 'Communication', status: 'present' }),
      ]) }),
      expect.objectContaining({ id: secondYouthId, sessions: expect.arrayContaining([
        expect.objectContaining({ id: sessionId, sessionNotes: expect.arrayContaining([
          expect.objectContaining({ category: 'behaviour', details: 'Updated details.' }),
        ]) }),
      ]) }),
    ]));

    const filteredResponse = await request(app)
      .get(`/api/youth/${youthId}/attendance`)
      .set('Authorization', `Bearer ${staffToken}`);
    expect(filteredResponse.status).toBe(200);
    expect(filteredResponse.body.youth).toHaveLength(1);
    expect(filteredResponse.body.youth[0]).toEqual(expect.objectContaining({ id: youthId }));

    const pdfResponse = await request(app)
      .post(`/api/programs/${programId}/cycles/${mainCycleId}/reports/youth.pdf`)
      .send(response.body)
      .set('Authorization', `Bearer ${staffToken}`)
      .buffer(true);
    expect(pdfResponse.status).toBe(200);
    expect(pdfResponse.headers['content-type']).toMatch(/^application\/pdf/);
    expect(pdfResponse.headers['cache-control']).toBe('private, no-store');
    expect(pdfResponse.headers['content-disposition']).toContain('inline; filename=');
    expect(pdfResponse.headers['content-disposition']).toContain("filename*=UTF-8''");
    expect(Buffer.isBuffer(pdfResponse.body)).toBe(true);
    expect(pdfResponse.body.subarray(0, 4).toString()).toBe('%PDF');

    await sql`UPDATE program_sessions SET cancelled_at = NOW() WHERE id = ${sessionId}`;
    const cancelledSessionReport = await request(app)
      .get(`/api/programs/${programId}/cycles/${mainCycleId}/attendance`)
      .set('Authorization', `Bearer ${staffToken}`);
    const youthWithCancelledSession = cancelledSessionReport.body.youth.find(
      (person: { id: string }) => person.id === secondYouthId,
    );
    expect(youthWithCancelledSession.sessions).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: sessionId, cancelledAt: expect.any(String) }),
    ]));
    await sql`UPDATE program_sessions SET cancelled_at = NULL WHERE id = ${sessionId}`;

    const denied = await request(app)
      .get(`/api/programs/${unassignedProgramId}/cycles/${mainCycleId}/attendance`)
      .set('Authorization', `Bearer ${staffToken}`);
    expect(denied.status).toBe(403);
    const deniedPdf = await request(app)
      .post(`/api/programs/${unassignedProgramId}/cycles/${mainCycleId}/reports/youth.pdf`)
      .send({ ...response.body, programCycle: { ...response.body.programCycle, programId: unassignedProgramId } })
      .set('Authorization', `Bearer ${staffToken}`);
    expect(deniedPdf.status).toBe(403);
  });

  it('withdraws a youth without deleting their attendance history', async () => {
    const response = await request(app)
      .patch(`/api/programs/${programId}/cycles/${mainCycleId}/enrollments/${youthId}/withdraw`)
      .set('Authorization', `Bearer ${staffToken}`);

    expect(response.status).toBe(200);
    expect(response.body.enrollment).toEqual(expect.objectContaining({
      programId, cycleId: mainCycleId,
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

});
