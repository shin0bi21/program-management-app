import request from 'supertest';
import { createApp } from '../shared/app';
import { deleteTestCohort, deleteTestUser, seedTestCohort, seedTestUser, sql } from '../shared/db';
import { generateToken } from '../shared/tokenHelpers';

const app = createApp();

function birthDateForAge(age: number) {
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Toronto', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
  // January 1 stays valid in leap years and gives the requested age throughout the year.
  return `${Number(today.slice(0, 4)) - age}-01-01`;
}

describe('Leads API', () => {
  let staffUserId: string;
  let staffToken: string;
  let youthUserId: string;
  let youthToken: string;
  let eligibleProgramId: string;
  let eligibleProgramName: string;
  let eligibleProgramCohortId: string;
  let otherProgramCohortId: string;
  let otherProgramId: string;
  let eligibleProgramCycleId: string;
  let otherProgramCycleId: string;
  let convertedYouthId: string | undefined;
  let convertedYouthWithoutCohortId: string | undefined;
  let convertedExternalYouthId: string | undefined;
  let externalLeadId: string | undefined;
  let crossProgramYouthId: string | undefined;

  const payload = {
    youthFirstName: 'Event',
    youthLastName: 'Prospect',
    dateOfBirth: birthDateForAge(14),
    school: 'Community School',
    contactPhoneNumber: '416-555-0199',
    contactRelationship: 'guardian',
    discoverySource: 'community_outreach',
    notes: 'Met at a community event',
  };

  beforeAll(async () => {
    const staff = await seedTestUser({ email: `lead-staff-${Date.now()}@test.local`, role: 'staff' });
    staffUserId = staff.userId;
    staffToken = generateToken(staff.userId, 'staff', staff.email);

    const youth = await seedTestUser({ email: `lead-youth-${Date.now()}@test.local`, role: 'youth' });
    youthUserId = youth.userId;
    youthToken = generateToken(youth.userId, 'youth', youth.email);
    const [program] = await sql<{ id: string; name: string }[]>`
      SELECT id, name
      FROM programs
      WHERE enrollment_required = TRUE
        AND 14 BETWEEN min_age AND max_age
      ORDER BY min_age DESC, max_age ASC, name ASC
      LIMIT 1
    `;
    eligibleProgramId = program.id;
    eligibleProgramName = program.name;
    ({ cohortId: eligibleProgramCohortId, cycleId: eligibleProgramCycleId } = await seedTestCohort({
      programId: eligibleProgramId,
      name: `Lead Conversion ${Date.now()}`,
    }));
    const [otherProgram] = await sql<{ id: string }[]>`
      INSERT INTO programs (name, enrollment_required)
      VALUES (${`Lead alternate program ${Date.now()}`}, TRUE) RETURNING id
    `;
    otherProgramId = otherProgram.id;
    ({ cohortId: otherProgramCohortId, cycleId: otherProgramCycleId } = await seedTestCohort({
      programId: otherProgram.id,
      name: `Other Program ${Date.now()}`,
    }));
  });

  afterAll(async () => {
    await sql`DELETE FROM leads WHERE created_by = ${staffUserId}`;
    if (convertedYouthId) {
      await sql`DELETE FROM cohort_enrollments WHERE youth_id = ${convertedYouthId}`;
      await sql`DELETE FROM users WHERE id = ${convertedYouthId}`;
    }
    if (convertedYouthWithoutCohortId) {
      await sql`DELETE FROM users WHERE id = ${convertedYouthWithoutCohortId}`;
    }
    if (convertedExternalYouthId) await sql`DELETE FROM users WHERE id = ${convertedExternalYouthId}`;
    if (externalLeadId) await sql`DELETE FROM leads WHERE id = ${externalLeadId}`;
    if (crossProgramYouthId) {
      await sql`DELETE FROM cohort_enrollments WHERE youth_id = ${crossProgramYouthId}`;
      await sql`DELETE FROM users WHERE id = ${crossProgramYouthId}`;
    }
    await deleteTestCohort(eligibleProgramCohortId, eligibleProgramCycleId);
    await deleteTestCohort(otherProgramCohortId, otherProgramCycleId);
    await sql`DELETE FROM programs WHERE id = ${otherProgramId}`;
    await deleteTestUser(youthUserId);
    await deleteTestUser(staffUserId);
  });

  it('lets staff create a direct lead and records its origin and creator', async () => {
    const res = await request(app)
      .post('/api/leads')
      .set('Authorization', `Bearer ${staffToken}`)
      .send(payload);

    expect(res.status).toBe(201);
    expect(res.body).toEqual(expect.objectContaining({
      origin: 'internal',
      youthFirstName: 'Event',
      youthLastName: 'Prospect',
      status: 'new',
      recommendedProgramId: eligibleProgramId,
      recommendedProgramName: eligibleProgramName,
      createdBy: staffUserId,
    }));
  });

  it('creates editable follow-up notes without changing Lead status', async () => {
    const lead = await request(app)
      .post('/api/leads')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ ...payload, youthFirstName: 'Followup' });
    expect(lead.status).toBe(201);

    const created = await request(app)
      .post(`/api/leads/${lead.body.id}/notes`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ details: 'Called and left a message.' });
    expect(created.status).toBe(201);
    expect(created.body).toEqual(expect.objectContaining({
      leadId: lead.body.id,
      category: 'follow_up',
      details: 'Called and left a message.',
      createdByName: expect.any(String),
      createdAt: expect.any(String),
    }));

    const edited = await request(app)
      .put(`/api/leads/${lead.body.id}/notes/${created.body.id}`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ details: 'Corrected call details.' });
    expect(edited.status).toBe(200);
    expect(edited.body).toEqual(expect.objectContaining({
      id: created.body.id,
      category: 'follow_up',
      details: 'Corrected call details.',
    }));

    const listed = await request(app)
      .get(`/api/leads/${lead.body.id}/notes`)
      .set('Authorization', `Bearer ${staffToken}`);
    expect(listed.status).toBe(200);
    expect(listed.body).toEqual([
      expect.objectContaining({ id: created.body.id, category: 'follow_up', details: 'Corrected call details.' }),
    ]);

    const [unchangedLead] = await sql<{ status: string }[]>`SELECT status FROM leads WHERE id = ${lead.body.id}`;
    expect(unchangedLead.status).toBe('new');

    const deleted = await request(app)
      .delete(`/api/leads/${lead.body.id}/notes/${created.body.id}`)
      .set('Authorization', `Bearer ${staffToken}`);
    expect(deleted.status).toBe(200);
    expect(deleted.body).toEqual({ id: created.body.id });

    const afterDelete = await request(app)
      .get(`/api/leads/${lead.body.id}/notes`)
      .set('Authorization', `Bearer ${staffToken}`);
    expect(afterDelete.body).toEqual([]);

    const [deleteAudit] = await sql<Array<{
      action: string;
      oldLeadId: string | null;
      oldDetails: string | null;
      newData: unknown;
    }>>`
      SELECT action, old_data->>'leadId' AS old_lead_id,
        old_data->>'details' AS old_details, new_data
      FROM audit_log
      WHERE table_name = 'lead_notes' AND record_id = ${created.body.id} AND action = 'DELETE'
    `;
    expect(deleteAudit).toEqual({
      action: 'DELETE',
      oldLeadId: lead.body.id,
      oldDetails: 'Corrected call details.',
      newData: null,
    });

    const invalid = await request(app)
      .post(`/api/leads/${lead.body.id}/notes`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ details: '   ' });
    expect(invalid.status).toBe(400);
  });

  it('validates and authorizes follow-up note deletion without removing rejected notes', async () => {
    const lead = await request(app)
      .post('/api/leads')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ ...payload, youthFirstName: 'ProtectedNote' });
    const note = await request(app)
      .post(`/api/leads/${lead.body.id}/notes`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ details: 'Keep after rejected deletion.' });
    const readOnlyToken = generateToken(
      staffUserId,
      'staff',
      'lead-read-only@test.local',
      ['read:outreach'],
    );

    const forbidden = await request(app)
      .delete(`/api/leads/${lead.body.id}/notes/${note.body.id}`)
      .set('Authorization', `Bearer ${readOnlyToken}`);
    expect(forbidden.status).toBe(403);

    const invalid = await request(app)
      .delete(`/api/leads/${lead.body.id}/notes/not-a-uuid`)
      .set('Authorization', `Bearer ${staffToken}`);
    expect(invalid.status).toBe(400);

    const unknown = await request(app)
      .delete(`/api/leads/${lead.body.id}/notes/00000000-0000-4000-8000-000000000000`)
      .set('Authorization', `Bearer ${staffToken}`);
    expect(unknown.status).toBe(404);

    const [persistedNote] = await sql<{ details: string }[]>`
      SELECT details FROM lead_notes WHERE id = ${note.body.id}
    `;
    expect(persistedNote.details).toBe('Keep after rejected deletion.');
  });

  it('lets staff delete an unsigned lead and its follow-up notes', async () => {
    const created = await request(app).post('/api/leads')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ ...payload, youthFirstName: 'Delete', youthLastName: `Flow-${Date.now()}` });
    const note = await request(app).post(`/api/leads/${created.body.id}/notes`)
      .set('Authorization', `Bearer ${staffToken}`).send({ details: 'Delete with parent.' });

    const removed = await request(app).delete(`/api/leads/${created.body.id}`)
      .set('Authorization', `Bearer ${staffToken}`);
    expect(removed.status).toBe(200);
    const [remainingNote] = await sql<{ count: number }[]>`
      SELECT COUNT(*)::int AS count FROM lead_notes WHERE id = ${note.body.id}
    `;
    expect(remainingNote.count).toBe(0);
  });

  it('rejects emergency as a Lead relationship', async () => {
    const res = await request(app)
      .post('/api/leads')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ ...payload, contactRelationship: 'emergency' });

    expect(res.status).toBe(400);
    expect(res.body.details).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: 'body.contactRelationship' }),
    ]));
  });

  it.each([11, 20])('rejects age %i outside the supported Lead range', async (age) => {
    const res = await request(app)
      .post('/api/leads')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ ...payload, dateOfBirth: birthDateForAge(age) });

    expect(res.status).toBe(400);
    expect(res.body.details).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: 'body.dateOfBirth' }),
    ]));
  });

  it('lists leads for staff', async () => {
    const res = await request(app)
      .get('/api/leads')
      .set('Authorization', `Bearer ${staffToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(expect.arrayContaining([
      expect.objectContaining({ contactPhoneNumber: payload.contactPhoneNumber, origin: 'internal' }),
    ]));
  });

  it('sorts independently by first and last name and cursor-paginates without a total count', async () => {
    const marker = `Cursor${Date.now()}`;
    for (const leadName of [
      { youthFirstName: `${marker}B`, youthLastName: `${marker}A` },
      { youthFirstName: `${marker}A`, youthLastName: `${marker}B` },
    ]) {
      const created = await request(app)
        .post('/api/leads')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ ...payload, ...leadName });
      expect(created.status).toBe(201);
    }

    const first = await request(app)
      .get(`/api/leads?search=${marker}&sort=firstName&direction=asc&limit=1`)
      .set('Authorization', `Bearer ${staffToken}`);
    expect(first.status).toBe(200);
    expect(first.body).toEqual({
      rows: [expect.objectContaining({ youthFirstName: `${marker}A`, youthLastName: `${marker}B` })],
      nextCursor: expect.any(String),
    });
    expect(first.body).not.toHaveProperty('totalRows');

    const second = await request(app)
      .get(`/api/leads?search=${marker}&sort=firstName&direction=asc&limit=1&cursor=${encodeURIComponent(first.body.nextCursor)}`)
      .set('Authorization', `Bearer ${staffToken}`);
    expect(second.status).toBe(200);
    expect(second.body).toEqual({
      rows: [expect.objectContaining({ youthFirstName: `${marker}B`, youthLastName: `${marker}A` })],
      nextCursor: null,
    });

    const byLastName = await request(app)
      .get(`/api/leads?search=${marker}&sort=lastName&direction=asc&limit=1`)
      .set('Authorization', `Bearer ${staffToken}`);
    expect(byLastName.status).toBe(200);
    expect(byLastName.body.rows).toEqual([
      expect.objectContaining({ youthFirstName: `${marker}B`, youthLastName: `${marker}A` }),
    ]);
  });

  it('filters leads by status and youth or school search', async () => {
    const res = await request(app)
      .get('/api/leads?statuses=new&search=Event%20Prospect')
      .set('Authorization', `Bearer ${staffToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      expect.objectContaining({ youthFirstName: 'Event', youthLastName: 'Prospect', status: 'new' }),
    ]);
  });

  it('filters leads by program UUID', async () => {
    const res = await request(app)
      .get(`/api/leads?programIds=${eligibleProgramId}`)
      .set('Authorization', `Bearer ${staffToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(expect.arrayContaining([
      expect.objectContaining({ youthFirstName: 'Event', recommendedProgramId: eligibleProgramId }),
    ]));
    expect(res.body.every((lead: { recommendedProgramId: string }) => lead.recommendedProgramId === eligibleProgramId)).toBe(true);
  });

  it('filters leads by who submitted the outreach form', async () => {
    const res = await request(app)
      .get('/api/leads?origins=internal&submitterRoles=staff')
      .set('Authorization', `Bearer ${staffToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(expect.arrayContaining([
      expect.objectContaining({ youthFirstName: 'Event', submittedByRole: 'staff' }),
    ]));
    expect(res.body.every((lead: { submittedByRole: string }) => lead.submittedByRole === 'staff')).toBe(true);
  });

  it('rejects unsupported lead filters', async () => {
    const res = await request(app)
      .get('/api/leads?statuses=reviewed')
      .set('Authorization', `Bearer ${staffToken}`);

    expect(res.status).toBe(400);

    const invalidSubmitter = await request(app)
      .get('/api/leads?submitterRoles=teacher')
      .set('Authorization', `Bearer ${staffToken}`);

    expect(invalidSubmitter.status).toBe(400);
  });

  it.each(['new', 'contacted', 'eligible', 'ineligible', 'deferred', 'closed'] as const)(
    'directly updates an unsigned Lead status to %s without creating a note',
    async status => {
      const [lead] = await sql<{ id: string }[]>`
        SELECT id FROM leads WHERE created_by = ${staffUserId} ORDER BY created_at DESC LIMIT 1
      `;
      const [{ count: noteCountBefore }] = await sql<{ count: number }[]>`
        SELECT COUNT(*)::int AS count FROM lead_notes WHERE lead_id = ${lead.id}
      `;

      const res = await request(app)
        .patch(`/api/leads/${lead.id}/status`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ status });

      expect(res.status).toBe(200);
      expect(res.body).toEqual(expect.objectContaining({
        id: lead.id,
        status,
        updatedBy: staffUserId,
        statusUpdatedAt: expect.any(String),
      }));
      const [{ count: noteCountAfter }] = await sql<{ count: number }[]>`
        SELECT COUNT(*)::int AS count FROM lead_notes WHERE lead_id = ${lead.id}
      `;
      expect(noteCountAfter).toBe(noteCountBefore);
    },
  );

  it('does not allow signed_up through direct status updates', async () => {
    const [lead] = await sql<{ id: string }[]>`
      SELECT id FROM leads WHERE created_by = ${staffUserId} ORDER BY created_at DESC LIMIT 1
    `;
    const res = await request(app)
      .patch(`/api/leads/${lead.id}/status`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ status: 'signed_up' });

    expect(res.status).toBe(400);
  });

  it('updates a Lead without changing its workflow metadata', async () => {
    const [lead] = await sql<{ id: string; origin: string; status: string }[]>`
      SELECT id, origin, status FROM leads WHERE created_by = ${staffUserId} ORDER BY created_at DESC LIMIT 1
    `;
    const res = await request(app)
      .put(`/api/leads/${lead.id}`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ ...payload, school: 'Updated Community School' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual(expect.objectContaining({
      id: lead.id,
      school: 'Updated Community School',
      recommendedProgramId: eligibleProgramId,
      origin: lead.origin,
      status: lead.status,
      updatedBy: staffUserId,
    }));
  });

  it('signs up a lead into a youth profile and canonical contact', async () => {
    const [lead] = await sql<{ id: string }[]>`
      SELECT id FROM leads WHERE created_by = ${staffUserId} ORDER BY created_at DESC LIMIT 1
    `;
    const res = await request(app)
      .post(`/api/leads/${lead.id}/sign-up`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ cohortId: eligibleProgramCohortId, noteCategory: 'preference' });

    expect(res.status).toBe(201);
    expect(res.body).toEqual(expect.objectContaining({
      id: lead.id,
      status: 'signed_up',
      convertedYouthId: expect.any(String),
    }));
    convertedYouthId = res.body.convertedYouthId;

    const [profile] = await sql<{ firstName: string; dateOfBirth: string }[]>`
      SELECT u.first_name, yp.date_of_birth::text AS date_of_birth
      FROM youth_profiles yp
      JOIN users u ON u.id = yp.user_id
      WHERE yp.user_id = ${convertedYouthId!}
    `;
    expect(profile).toEqual(expect.objectContaining({
      firstName: payload.youthFirstName,
      dateOfBirth: payload.dateOfBirth,
    }));
    const [profileNote] = await sql<{ category: string; details: string }[]>`
      SELECT category, details FROM youth_profile_notes WHERE youth_id = ${convertedYouthId!}
    `;
    expect(profileNote).toEqual({ category: 'preference', details: payload.notes });

    const [{ count: signupNoteCount }] = await sql<{ count: number }[]>`
      SELECT COUNT(*)::int AS count
      FROM lead_notes
      WHERE lead_id = ${lead.id}
    `;
    expect(signupNoteCount).toBe(0);

    const [enrollment] = await sql<{ cohortId: string; youthId: string }[]>`
      SELECT cohort_id, youth_id
      FROM cohort_enrollments
      WHERE youth_id = ${convertedYouthId!}
    `;
    expect(enrollment).toEqual({
      cohortId: eligibleProgramCohortId,
      youthId: convertedYouthId,
    });

    const [contact] = await sql<{ phoneNumber: string }[]>`
      SELECT c.phone_number
      FROM contacts c
      JOIN user_has_contacts uhc ON uhc.contact_id = c.id
      WHERE uhc.user_id = ${convertedYouthId!} AND uhc.active = true
    `;
    expect(contact).toEqual(expect.objectContaining({
      phoneNumber: payload.contactPhoneNumber,
    }));

    const duplicate = await request(app)
      .post(`/api/leads/${lead.id}/sign-up`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ cohortId: null });
    expect(duplicate.status).toBe(409);

    const statusChange = await request(app)
      .patch(`/api/leads/${lead.id}/status`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ status: 'contacted' });
    expect(statusChange.status).toBe(409);

    const edit = await request(app)
      .put(`/api/leads/${lead.id}`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ ...payload, school: 'Should Not Change' });
    expect(edit.status).toBe(409);
    expect(edit.body.error).toBe('Signed-up leads must be edited through their youth profile');
  });

  it('can create a youth profile without enrolling it in a cohort', async () => {
    const created = await request(app)
      .post('/api/leads')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        ...payload,
        youthFirstName: 'Optional',
        youthLastName: `Enrollment-${Date.now()}`,
      });

    const res = await request(app)
      .post(`/api/leads/${created.body.id}/sign-up`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ cohortId: null });

    expect(res.status).toBe(201);
    convertedYouthWithoutCohortId = res.body.convertedYouthId;
    const [{ count }] = await sql<{ count: number }[]>`
      SELECT COUNT(*)::int AS count
      FROM cohort_enrollments
      WHERE youth_id = ${convertedYouthWithoutCohortId!}
    `;
    expect(count).toBe(0);
  });

  it('preserves the complete external lead to youth signup lifecycle', async () => {
    const youthLastName = `Lifecycle-${Date.now()}`;
    const submitted = await request(app)
      .post('/api/public/leads')
      .send({
        youthFirstName: 'Outreach',
        youthLastName,
        dateOfBirth: birthDateForAge(14),
        school: 'Lifecycle School',
        submittedByRole: 'guardian',
        discoverySource: 'online',
        contactPhoneNumber: '416-555-0177',
        contactRelationship: 'guardian',
        notes: 'Created through public intake.',
      });
    expect(submitted.status).toBe(201);

    const [externalLead] = await sql<{ id: string }[]>`
      SELECT id
      FROM leads
      WHERE youth_last_name = ${youthLastName}
      LIMIT 1
    `;
    externalLeadId = externalLead.id;

    const signedUp = await request(app)
      .post(`/api/leads/${externalLead.id}/sign-up`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ cohortId: null, noteCategory: 'general' });
    expect(signedUp.status).toBe(201);
    expect(signedUp.body).toEqual(expect.objectContaining({
      id: externalLead.id,
      convertedYouthId: expect.any(String),
      recommendedProgramId: eligibleProgramId,
      status: 'signed_up',
    }));
    convertedExternalYouthId = signedUp.body.convertedYouthId;
  });

  it('allows staff to choose an age-eligible cohort outside the recommended program', async () => {
    const youthLastName = `Rollback-${Date.now()}`;
    const created = await request(app)
      .post('/api/leads')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        ...payload,
        youthFirstName: 'Transactional',
        youthLastName,
      });

    const res = await request(app)
      .post(`/api/leads/${created.body.id}/sign-up`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ cohortId: otherProgramCohortId });

    expect(res.status).toBe(201);
    crossProgramYouthId = res.body.convertedYouthId;
    const [enrollment] = await sql<{ cohortId: string }[]>`
      SELECT cohort_id FROM cohort_enrollments WHERE youth_id = ${crossProgramYouthId!}
    `;
    expect(enrollment.cohortId).toBe(otherProgramCohortId);
  });

  it('rechecks the selected program enrollment requirement at signup', async () => {
    const created = await request(app).post('/api/leads')
      .set('Authorization', `Bearer ${staffToken}`).send({ ...payload, youthFirstName: 'CurrentRules' });
    await sql`UPDATE programs SET enrollment_required = FALSE WHERE id = ${otherProgramId}`;
    try {
      const rejected = await request(app).post(`/api/leads/${created.body.id}/sign-up`)
        .set('Authorization', `Bearer ${staffToken}`).send({ cohortId: otherProgramCohortId });
      expect(rejected.status).toBe(409);
      expect(rejected.body.error).toBe('Open attendance cohorts do not use enrollment');
      const [lead] = await sql<{ convertedYouthId: string | null }[]>`
        SELECT converted_youth_id FROM leads WHERE id = ${created.body.id}
      `;
      expect(lead.convertedYouthId).toBeNull();
    } finally {
      await sql`UPDATE programs SET enrollment_required = TRUE WHERE id = ${otherProgramId}`;
    }
  });

  it('keeps legacy unknown DOB and age null until signup supplies an exact DOB', async () => {
    const created = await request(app).post('/api/leads')
      .set('Authorization', `Bearer ${staffToken}`).send({ ...payload, youthFirstName: 'Legacy' });
    await sql`UPDATE leads SET date_of_birth = NULL WHERE id = ${created.body.id}`;

    const listed = await request(app).get('/api/leads?search=Legacy')
      .set('Authorization', `Bearer ${staffToken}`);
    expect(listed.body).toEqual(expect.arrayContaining([expect.objectContaining({
      id: created.body.id, dateOfBirth: null, age: null,
      recommendedProgramId: null, recommendedProgramName: null,
    })]));
    const rejected = await request(app).post(`/api/leads/${created.body.id}/sign-up`)
      .set('Authorization', `Bearer ${staffToken}`).send({});
    expect(rejected.status).toBe(409);

    const correctedDateOfBirth = birthDateForAge(25);
    const signedUp = await request(app).post(`/api/leads/${created.body.id}/sign-up`)
      .set('Authorization', `Bearer ${staffToken}`).send({ dateOfBirth: correctedDateOfBirth });
    expect(signedUp.status).toBe(201);
    const youthId = signedUp.body.convertedYouthId;
    try {
      expect(signedUp.body.dateOfBirth).toBe(correctedDateOfBirth);
      const [profile] = await sql<{ dateOfBirth: string }[]>`
        SELECT date_of_birth::text AS date_of_birth FROM youth_profiles WHERE user_id = ${youthId}
      `;
      expect(profile.dateOfBirth).toBe(correctedDateOfBirth);
      const [leadAudit] = await sql<{ oldDate: string | null; newDate: string }[]>`
        SELECT old_data->>'dateOfBirth' AS old_date, new_data->>'dateOfBirth' AS new_date
        FROM audit_log WHERE table_name = 'leads' AND record_id = ${created.body.id}
          AND new_data->>'convertedYouthId' = ${youthId}
      `;
      expect(leadAudit).toEqual({ oldDate: null, newDate: correctedDateOfBirth });
    } finally {
      await sql`DELETE FROM leads WHERE id = ${created.body.id}`;
      await sql`DELETE FROM users WHERE id = ${youthId}`;
    }
  });

  it('rolls back signup, DOB correction, and all audits when the selected cohort age is ineligible', async () => {
    const youthLastName = `AgeRollback-${Date.now()}`;
    const created = await request(app).post('/api/leads')
      .set('Authorization', `Bearer ${staffToken}`).send({ ...payload, youthLastName });
    const [{ count: auditsBefore }] = await sql<{ count: number }[]>`
      SELECT COUNT(*)::int AS count FROM audit_log WHERE user_id = ${staffUserId}
    `;
    const rejected = await request(app).post(`/api/leads/${created.body.id}/sign-up`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ cohortId: eligibleProgramCohortId, dateOfBirth: birthDateForAge(50) });
    expect(rejected.status).toBe(409);
    const [lead] = await sql<{ dateOfBirth: string; status: string; convertedYouthId: string | null }[]>`
      SELECT date_of_birth::text AS date_of_birth, status, converted_youth_id FROM leads WHERE id = ${created.body.id}
    `;
    expect(lead).toEqual({ dateOfBirth: payload.dateOfBirth, status: 'new', convertedYouthId: null });
    const [{ count: userCount }] = await sql<{ count: number }[]>`
      SELECT COUNT(*)::int AS count FROM users WHERE last_name = ${youthLastName}
    `;
    expect(userCount).toBe(0);
    const [{ count: auditsAfter }] = await sql<{ count: number }[]>`
      SELECT COUNT(*)::int AS count FROM audit_log WHERE user_id = ${staffUserId}
    `;
    expect(auditsAfter).toBe(auditsBefore);
  });

  it('rejects youth accounts', async () => {
    const list = await request(app)
      .get('/api/leads')
      .set('Authorization', `Bearer ${youthToken}`);
    const create = await request(app)
      .post('/api/leads')
      .set('Authorization', `Bearer ${youthToken}`)
      .send(payload);
    const update = await request(app)
      .put('/api/leads/00000000-0000-4000-8000-000000000000')
      .set('Authorization', `Bearer ${youthToken}`)
      .send(payload);
    const notes = await request(app)
      .get('/api/leads/00000000-0000-4000-8000-000000000000/notes')
      .set('Authorization', `Bearer ${youthToken}`);

    expect(list.status).toBe(403);
    expect(create.status).toBe(403);
    expect(update.status).toBe(403);
    expect(notes.status).toBe(403);
  });

  it('returns 404 when adding a note for an unknown lead', async () => {
    const res = await request(app)
      .post('/api/leads/00000000-0000-4000-8000-000000000000/notes')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ details: 'No matching lead.' });

    expect(res.status).toBe(404);
  });
});
