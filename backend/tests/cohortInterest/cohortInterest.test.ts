import request from 'supertest';
import { createApp } from '../shared/app';
import { deleteTestUser, seedTestUser, sql } from '../shared/db';
import { generateExpiredToken, generateToken } from '../shared/tokenHelpers';

const app = createApp();

describe('Cohort interest API', () => {
  let adminUserId: string;
  let adminToken: string;
  const fixtureYouthLastName = `Youth-${Date.now()}`;

  beforeAll(async () => {
    const admin = await seedTestUser({ email: `cohort-admin-${Date.now()}@test.local`, role: 'admin' });
    adminUserId = admin.userId;
    adminToken = generateToken(admin.userId, 'admin', admin.email);

    await sql`
      INSERT INTO cohort_interest_submissions (
        youth_first_name,
        youth_last_name,
        contact_first_name,
        contact_last_name,
        contact_phone_number,
        contact_relationship,
        age,
        school,
        discovery_source,
        notes
      )
      VALUES (
        ${'Dashboard'},
        ${fixtureYouthLastName},
        ${'Parent'},
        ${'Viewer'},
        ${'416-555-0188'},
        ${'parent'},
        ${15},
        ${'Test School'},
        ${'online'},
        ${'Needs follow-up'}
      )
    `;
  });

  afterAll(async () => {
    await sql`
      DELETE FROM leads
      WHERE interest_submission_id IN (
        SELECT id FROM cohort_interest_submissions WHERE youth_last_name = ${fixtureYouthLastName}
      )
    `;
    await sql`DELETE FROM cohort_interest_submissions WHERE youth_last_name = ${fixtureYouthLastName}`;
    await deleteTestUser(adminUserId);
  });

  it('returns submissions for admins', async () => {
    const res = await request(app)
      .get('/api/cohort-interest')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0]).toEqual(expect.objectContaining({
      youthFirstName: expect.any(String),
      youthLastName: expect.any(String),
      contactFirstName: 'Parent',
      age: expect.any(Number),
      status: expect.any(String),
      statusUpdatedAt: expect.any(String),
    }));
  });

  it('returns submissions for staff', async () => {
    const staff = await seedTestUser({ email: `cohort-staff-${Date.now()}@test.local`, role: 'staff' });
    const staffToken = generateToken(staff.userId, 'staff', staff.email);

    const res = await request(app)
      .get('/api/cohort-interest')
      .set('Authorization', `Bearer ${staffToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);

    await deleteTestUser(staff.userId);
  });

  it('rejects expired tokens', async () => {
    const res = await request(app)
      .get('/api/cohort-interest')
      .set('Authorization', `Bearer ${generateExpiredToken(adminUserId)}`);

    expect(res.status).toBe(401);
  });

  it('updates submission status for admins', async () => {
    const [submission] = await sql<{ id: string }[]>`
      SELECT id
      FROM cohort_interest_submissions
      WHERE youth_last_name = ${fixtureYouthLastName}
      LIMIT 1
    `;

    const res = await request(app)
      .patch(`/api/cohort-interest/${submission.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'signed_up' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('signed_up');

    const [updated] = await sql<{ status: string; statusUpdatedAt: string }[]>`
      SELECT status, status_updated_at::text AS "statusUpdatedAt"
      FROM cohort_interest_submissions
      WHERE id = ${submission.id}
    `;

    expect(res.body.statusUpdatedAt).toBeTruthy();
    expect(updated.status).toBe('signed_up');
    expect(updated.statusUpdatedAt).toBeTruthy();
  });

  it('supports the reviewed status', async () => {
    const [submission] = await sql<{ id: string }[]>`
      SELECT id FROM cohort_interest_submissions WHERE youth_last_name = ${fixtureYouthLastName} LIMIT 1
    `;

    const res = await request(app)
      .patch(`/api/cohort-interest/${submission.id}`)
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
      FROM cohort_interest_submissions
      WHERE youth_last_name = ${fixtureYouthLastName}
      LIMIT 1
    `;

    const res = await request(app)
      .patch(`/api/cohort-interest/${submission.id}`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ status: 'contacted' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('contacted');

    await deleteTestUser(staff.userId);
  });

  it('atomically converts a submission into a lead with normalized data', async () => {
    const [submission] = await sql<{ id: string }[]>`
      SELECT id FROM cohort_interest_submissions WHERE youth_last_name = ${fixtureYouthLastName} LIMIT 1
    `;

    const res = await request(app)
      .post(`/api/cohort-interest/${submission.id}/convert`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(201);
    expect(res.body).toEqual(expect.objectContaining({
      origin: 'interest_submission',
      interestSubmissionId: submission.id,
      youthFirstName: 'Dashboard',
      contactFirstName: 'Parent',
      discoverySource: 'online',
      notes: 'Needs follow-up',
      status: 'new',
      createdBy: adminUserId,
    }));

    const [updatedSubmission] = await sql<{ status: string }[]>`
      SELECT status FROM cohort_interest_submissions WHERE id = ${submission.id}
    `;
    expect(updatedSubmission.status).toBe('converted');
  });

  it('rejects converting the same submission twice', async () => {
    const [submission] = await sql<{ id: string }[]>`
      SELECT id FROM cohort_interest_submissions WHERE youth_last_name = ${fixtureYouthLastName} LIMIT 1
    `;

    const res = await request(app)
      .post(`/api/cohort-interest/${submission.id}/convert`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('This interest submission has already been converted');
  });
});
