import request from 'supertest';
import { createApp } from '../shared/app';
import { deleteTestUser, seedTestUser, sql } from '../shared/db';
import { generateExpiredToken, generateToken } from '../shared/tokenHelpers';

const app = createApp();

describe('Cohort interest API', () => {
  let adminUserId: string;
  let adminToken: string;

  beforeAll(async () => {
    const admin = await seedTestUser({ email: `cohort-admin-${Date.now()}@test.local`, role: 'admin' });
    adminUserId = admin.userId;
    adminToken = generateToken(admin.userId, 'admin', admin.email);

    await sql`
      INSERT INTO cohort_interest_submissions (
        youth_name,
        parent_name,
        age,
        school,
        email,
        phone_number,
        discovery_source,
        message
      )
      VALUES (
        ${`Dashboard Youth ${Date.now()}`},
        ${'Parent Viewer'},
        ${15},
        ${'Test School'},
        ${'viewer@test.local'},
        ${null},
        ${'online'},
        ${'Needs follow-up'}
      )
    `;
  });

  afterAll(async () => {
    await sql`DELETE FROM cohort_interest_submissions WHERE email = 'viewer@test.local'`;
    await deleteTestUser(adminUserId);
  });

  it('returns submissions for admins', async () => {
    const res = await request(app)
      .get('/api/cohort-interest')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0]).toEqual(expect.objectContaining({
      youthName: expect.any(String),
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
      WHERE email = 'viewer@test.local'
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

  it('updates submission status for staff', async () => {
    const staff = await seedTestUser({ email: `cohort-staff-write-${Date.now()}@test.local`, role: 'staff' });
    const staffToken = generateToken(staff.userId, 'staff', staff.email);

    const [submission] = await sql<{ id: string }[]>`
      SELECT id
      FROM cohort_interest_submissions
      WHERE email = 'viewer@test.local'
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
});
