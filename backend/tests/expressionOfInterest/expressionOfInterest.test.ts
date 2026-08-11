import request from 'supertest';
import { createApp } from '../shared/app';
import { deleteTestUser, seedTestUser, sql } from '../shared/db';
import { generateExpiredToken, generateToken } from '../shared/tokenHelpers';

const app = createApp();

describe('Expression of interest API', () => {
  let adminUserId: string;
  let adminToken: string;
  const fixtureYouthLastName = `Youth-${Date.now()}`;
  const jobReadinessYouthLastName = `Older-Youth-${Date.now()}`;

  beforeAll(async () => {
    const admin = await seedTestUser({ email: `cohort-admin-${Date.now()}@test.local`, role: 'admin' });
    adminUserId = admin.userId;
    adminToken = generateToken(admin.userId, 'admin', admin.email);

    await sql`
      INSERT INTO expressions_of_interest (
        youth_first_name,
        youth_last_name,
        contact_phone_number,
        contact_relationship,
        age,
        school,
        submitted_by_role,
        discovery_source,
        notes
      )
      VALUES (
        ${'Dashboard'},
        ${fixtureYouthLastName},
        ${'416-555-0188'},
        ${'parent'},
        ${15},
        ${'Test School'},
        ${'parent'},
        ${'online'},
        ${'Needs follow-up'}
      )
    `;
    await sql`
      INSERT INTO expressions_of_interest (
        youth_first_name, youth_last_name,
        contact_phone_number, contact_relationship, age, school, submitted_by_role, discovery_source
      ) VALUES (
        'Older', ${jobReadinessYouthLastName}, '416-555-0189',
        'parent', 17, 'Test School', 'parent', 'online'
      )
    `;
  });

  afterAll(async () => {
    await sql`
      DELETE FROM leads
      WHERE expression_of_interest_id IN (
        SELECT id FROM expressions_of_interest
        WHERE youth_last_name IN (${fixtureYouthLastName}, ${jobReadinessYouthLastName})
      )
    `;
    await sql`
      DELETE FROM expressions_of_interest
      WHERE youth_last_name IN (${fixtureYouthLastName}, ${jobReadinessYouthLastName})
    `;
    await deleteTestUser(adminUserId);
  });

  it('returns submissions for admins', async () => {
    const res = await request(app)
      .get('/api/expressions-of-interest')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toEqual(expect.arrayContaining([expect.objectContaining({
      youthFirstName: 'Dashboard',
      youthLastName: fixtureYouthLastName,
      contactPhoneNumber: '416-555-0188',
      submittedByRole: 'parent',
      age: expect.any(Number),
      status: expect.any(String),
      statusUpdatedAt: expect.any(String),
    })]));
  });

  it('returns submissions for staff', async () => {
    const staff = await seedTestUser({ email: `cohort-staff-${Date.now()}@test.local`, role: 'staff' });
    const staffToken = generateToken(staff.userId, 'staff', staff.email);

    const res = await request(app)
      .get('/api/expressions-of-interest')
      .set('Authorization', `Bearer ${staffToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);

    await deleteTestUser(staff.userId);
  });

  it('filters submissions by their inferred program', async () => {
    const [program] = await sql<{ id: string }[]>`SELECT id FROM programs WHERE name = 'Soft Skills'`;
    const res = await request(app)
      .get(`/api/expressions-of-interest?programIds=${program.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(expect.arrayContaining([
      expect.objectContaining({ youthLastName: fixtureYouthLastName, suggestedProgramName: 'Soft Skills' }),
    ]));
    expect(res.body.every((item: { suggestedProgramId: string }) => item.suggestedProgramId === program.id)).toBe(true);
  });

  it('rejects expired tokens', async () => {
    const res = await request(app)
      .get('/api/expressions-of-interest')
      .set('Authorization', `Bearer ${generateExpiredToken(adminUserId)}`);

    expect(res.status).toBe(401);
  });

  it('updates submission status for admins', async () => {
    const [submission] = await sql<{ id: string }[]>`
      SELECT id
      FROM expressions_of_interest
      WHERE youth_last_name = ${fixtureYouthLastName}
      LIMIT 1
    `;

    const res = await request(app)
      .patch(`/api/expressions-of-interest/${submission.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'signed_up' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('signed_up');

    const [updated] = await sql<{ status: string; statusUpdatedAt: string }[]>`
      SELECT status, status_updated_at::text AS "statusUpdatedAt"
      FROM expressions_of_interest
      WHERE id = ${submission.id}
    `;

    expect(res.body.statusUpdatedAt).toBeTruthy();
    expect(updated.status).toBe('signed_up');
    expect(updated.statusUpdatedAt).toBeTruthy();
  });

  it('supports the reviewed status', async () => {
    const [submission] = await sql<{ id: string }[]>`
      SELECT id FROM expressions_of_interest WHERE youth_last_name = ${fixtureYouthLastName} LIMIT 1
    `;

    const res = await request(app)
      .patch(`/api/expressions-of-interest/${submission.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'reviewed' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('reviewed');
  });

  it('updates submission status for staff', async () => {
    const staff = await seedTestUser({ email: `cohort-staff-write-${Date.now()}@test.local`, role: 'staff' });
    const staffToken = generateToken(staff.userId, 'staff', staff.email);

    const [submission] = await sql<{ id: string }[]>`
      SELECT id
      FROM expressions_of_interest
      WHERE youth_last_name = ${fixtureYouthLastName}
      LIMIT 1
    `;

    const res = await request(app)
      .patch(`/api/expressions-of-interest/${submission.id}`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ status: 'contacted' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('contacted');

    await deleteTestUser(staff.userId);
  });

  it('atomically converts a submission into a lead with normalized data', async () => {
    const [submission] = await sql<{ id: string }[]>`
      SELECT id FROM expressions_of_interest WHERE youth_last_name = ${fixtureYouthLastName} LIMIT 1
    `;

    const res = await request(app)
      .post(`/api/expressions-of-interest/${submission.id}/convert`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(201);
    expect(res.body).toEqual(expect.objectContaining({
      origin: 'expression_of_interest',
      expressionOfInterestId: submission.id,
      youthFirstName: 'Dashboard',
      contactPhoneNumber: '416-555-0188',
      discoverySource: 'online',
      notes: 'Needs follow-up',
      status: 'new',
      programOfInterestId: null,
      programOfInterestName: null,
      createdBy: adminUserId,
    }));

    const [updatedSubmission] = await sql<{ status: string }[]>`
      SELECT status FROM expressions_of_interest WHERE id = ${submission.id}
    `;
    expect(updatedSubmission.status).toBe('converted');
  });

  it('rejects converting the same submission twice', async () => {
    const [submission] = await sql<{ id: string }[]>`
      SELECT id FROM expressions_of_interest WHERE youth_last_name = ${fixtureYouthLastName} LIMIT 1
    `;

    const res = await request(app)
      .post(`/api/expressions-of-interest/${submission.id}/convert`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('This expression of interest has already been converted');
  });

  it('does not allow a converted submission to return to an editable status', async () => {
    const [submission] = await sql<{ id: string }[]>`
      SELECT expression.id
      FROM expressions_of_interest expression
      INNER JOIN leads lead ON lead.expression_of_interest_id = expression.id
      WHERE expression.youth_last_name = ${fixtureYouthLastName}
      LIMIT 1
    `;

    const response = await request(app)
      .patch(`/api/expressions-of-interest/${submission.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'reviewed' });

    expect(response.status).toBe(409);
    expect(response.body.error).toBe('Converted expressions of interest cannot be changed');
    await expect(sql`
      UPDATE expressions_of_interest SET status = 'reviewed' WHERE id = ${submission.id}
    `).rejects.toMatchObject({ code: '23514' });
  });

  it('does not automatically assign a program of interest during conversion', async () => {
    const [submission] = await sql<{ id: string }[]>`
      SELECT id FROM expressions_of_interest WHERE youth_last_name = ${jobReadinessYouthLastName} LIMIT 1
    `;

    const res = await request(app)
      .post(`/api/expressions-of-interest/${submission.id}/convert`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(201);
    expect(res.body.programOfInterestId).toBeNull();
    expect(res.body.programOfInterestName).toBeNull();
  });
});
