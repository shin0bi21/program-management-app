import request from 'supertest';
import { createApp } from '../shared/app';
import { sql } from '../shared/db';

const app = createApp();

describe('Public cohort interest API', () => {
  const youthName = `Cohort Test ${Date.now()}`;

  afterAll(async () => {
    await sql`DELETE FROM cohort_interest_submissions WHERE youth_name LIKE 'Cohort Test %'`;
  });

  it('creates a cohort interest submission with email only', async () => {
    const res = await request(app)
      .post('/api/public/cohort-interest')
      .send({
        youthName,
        parentName: 'Parent Test',
        age: 14,
        school: 'Test Secondary',
        email: 'cohort@test.local',
        discoverySource: 'school',
        message: 'Interested in learning more.',
      });

    expect(res.status).toBe(201);
    expect(res.body.message).toMatch(/submitted successfully/i);

    const rows = await sql<{
      youthName: string;
      parentName: string | null;
      age: number;
      school: string | null;
      email: string | null;
      phoneNumber: string | null;
      discoverySource: string | null;
    }[]>`
      SELECT
        youth_name as "youthName",
        parent_name as "parentName",
        age,
        school,
        email,
        phone_number as "phoneNumber",
        discovery_source as "discoverySource"
      FROM cohort_interest_submissions
      WHERE youth_name = ${youthName}
      LIMIT 1
    `;

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      youthName,
      parentName: 'Parent Test',
      age: 14,
      school: 'Test Secondary',
      email: 'cohort@test.local',
      phoneNumber: null,
      discoverySource: 'school',
    });
  });

  it('rejects submissions without email or phone', async () => {
    const res = await request(app)
      .post('/api/public/cohort-interest')
      .send({
        youthName: 'Missing Contact',
        age: 15,
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/validation/i);
    expect(res.body.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'body.email', message: 'Provide an email or phone number' }),
        expect.objectContaining({ field: 'body.phoneNumber', message: 'Provide an email or phone number' }),
      ]),
    );
  });
});
