import request from 'supertest';
import { createApp } from '../shared/app';
import { deleteTestUser, seedTestUser, sql } from '../shared/db';
import { generateToken } from '../shared/tokenHelpers';

const app = createApp();

describe('Leads API', () => {
  let staffUserId: string;
  let staffToken: string;
  let youthUserId: string;
  let youthToken: string;
  let softSkillsProgramId: string;
  let softSkillsCohortId: string;
  let otherProgramCohortId: string;
  let convertedYouthId: string | undefined;
  let convertedYouthWithoutCohortId: string | undefined;

  const payload = {
    youthFirstName: 'Event',
    youthLastName: 'Prospect',
    age: 14,
    school: 'Community School',
    contactFirstName: 'Primary',
    contactLastName: 'Contact',
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
    const [program] = await sql<{ id: string }[]>`SELECT id FROM programs WHERE name = 'Soft Skills'`;
    softSkillsProgramId = program.id;
    const [cohort] = await sql<{ id: string }[]>`
      INSERT INTO program_cohorts (program_id, name, starts_on, ends_on)
      VALUES (${softSkillsProgramId}, ${`Lead Conversion ${Date.now()}`}, CURRENT_DATE, CURRENT_DATE + 90)
      RETURNING id
    `;
    softSkillsCohortId = cohort.id;
    const [otherProgramCohort] = await sql<{ id: string }[]>`
      INSERT INTO program_cohorts (program_id, name, starts_on, ends_on)
      SELECT id, ${`Other Program ${Date.now()}`}, CURRENT_DATE, CURRENT_DATE + 90
      FROM programs
      WHERE id != ${softSkillsProgramId}
      ORDER BY name
      LIMIT 1
      RETURNING id
    `;
    otherProgramCohortId = otherProgramCohort.id;
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
    await sql`DELETE FROM program_cohorts WHERE id IN (${softSkillsCohortId}, ${otherProgramCohortId})`;
    await deleteTestUser(youthUserId);
    await deleteTestUser(staffUserId);
  });

  it('lets staff create a direct lead and records its origin and creator', async () => {
    const res = await request(app)
      .post('/api/leads')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ ...payload, programOfInterestId: softSkillsProgramId });

    expect(res.status).toBe(201);
    expect(res.body).toEqual(expect.objectContaining({
      origin: 'staff_created',
      expressionOfInterestId: null,
      youthFirstName: 'Event',
      youthLastName: 'Prospect',
      status: 'new',
      programOfInterestId: softSkillsProgramId,
      programOfInterestName: 'Soft Skills',
      createdBy: staffUserId,
    }));
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

  it('lists leads for staff', async () => {
    const res = await request(app)
      .get('/api/leads')
      .set('Authorization', `Bearer ${staffToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(expect.arrayContaining([
      expect.objectContaining({ contactPhoneNumber: payload.contactPhoneNumber, origin: 'staff_created' }),
    ]));
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
      .get(`/api/leads?programIds=${softSkillsProgramId}`)
      .set('Authorization', `Bearer ${staffToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(expect.arrayContaining([
      expect.objectContaining({ youthFirstName: 'Event', programOfInterestId: softSkillsProgramId }),
    ]));
    expect(res.body.every((lead: { programOfInterestId: string }) => lead.programOfInterestId === softSkillsProgramId)).toBe(true);
  });

  it('rejects unsupported lead filters', async () => {
    const res = await request(app)
      .get('/api/leads?statuses=reviewed')
      .set('Authorization', `Bearer ${staffToken}`);

    expect(res.status).toBe(400);
  });

  it('updates a lead status and audit metadata', async () => {
    const [lead] = await sql<{ id: string }[]>`
      SELECT id FROM leads WHERE created_by = ${staffUserId} ORDER BY created_at DESC LIMIT 1
    `;

    const res = await request(app)
      .patch(`/api/leads/${lead.id}/status`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ status: 'eligible' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual(expect.objectContaining({
      id: lead.id,
      status: 'eligible',
      updatedBy: staffUserId,
      statusUpdatedAt: expect.any(String),
    }));
  });

  it('does not allow signed_up through the generic status endpoint', async () => {
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
      .send({ ...payload, school: 'Updated Community School', programOfInterestId: softSkillsProgramId });

    expect(res.status).toBe(200);
    expect(res.body).toEqual(expect.objectContaining({
      id: lead.id,
      school: 'Updated Community School',
      programOfInterestId: softSkillsProgramId,
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
      .send({ cohortId: softSkillsCohortId });

    expect(res.status).toBe(201);
    expect(res.body).toEqual(expect.objectContaining({
      id: lead.id,
      status: 'signed_up',
      convertedYouthId: expect.any(String),
    }));
    convertedYouthId = res.body.convertedYouthId;

    const [profile] = await sql<{ firstName: string; notes: string }[]>`
      SELECT u.first_name, yp.notes
      FROM youth_profiles yp
      JOIN users u ON u.id = yp.user_id
      WHERE yp.user_id = ${convertedYouthId!}
    `;
    expect(profile).toEqual(expect.objectContaining({
      firstName: payload.youthFirstName,
      notes: payload.notes,
    }));

    const [enrollment] = await sql<{ cohortId: string; youthId: string }[]>`
      SELECT cohort_id, youth_id
      FROM cohort_enrollments
      WHERE youth_id = ${convertedYouthId!}
    `;
    expect(enrollment).toEqual({
      cohortId: softSkillsCohortId,
      youthId: convertedYouthId,
    });

    const [contact] = await sql<{ firstName: string; phoneNumber: string }[]>`
      SELECT c.first_name, c.phone_number
      FROM contacts c
      JOIN user_has_contacts uhc ON uhc.contact_id = c.id
      WHERE uhc.user_id = ${convertedYouthId!} AND uhc.active = true
    `;
    expect(contact).toEqual(expect.objectContaining({
      firstName: payload.contactFirstName,
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
      .send({ ...payload, school: 'Should Not Change', programOfInterestId: softSkillsProgramId });
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
        programOfInterestId: softSkillsProgramId,
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

  it('rolls back conversion when the cohort conflicts with the program of interest', async () => {
    const youthLastName = `Rollback-${Date.now()}`;
    const created = await request(app)
      .post('/api/leads')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        ...payload,
        youthFirstName: 'Transactional',
        youthLastName,
        programOfInterestId: softSkillsProgramId,
      });

    const res = await request(app)
      .post(`/api/leads/${created.body.id}/sign-up`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ cohortId: otherProgramCohortId });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('Selected cohort does not belong to the lead program of interest');
    const [lead] = await sql<{ status: string; convertedYouthId: string | null }[]>`
      SELECT status, converted_youth_id
      FROM leads
      WHERE id = ${created.body.id}
    `;
    expect(lead).toEqual({ status: 'new', convertedYouthId: null });
    const [{ count }] = await sql<{ count: number }[]>`
      SELECT COUNT(*)::int AS count
      FROM users
      WHERE first_name = 'Transactional' AND last_name = ${youthLastName}
    `;
    expect(count).toBe(0);
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

    expect(list.status).toBe(403);
    expect(create.status).toBe(403);
    expect(update.status).toBe(403);
  });

  it('returns 404 when updating an unknown lead', async () => {
    const res = await request(app)
      .patch('/api/leads/00000000-0000-4000-8000-000000000000/status')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ status: 'ineligible' });

    expect(res.status).toBe(404);
  });
});
