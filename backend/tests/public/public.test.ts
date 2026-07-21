import request from 'supertest';
import { createApp } from '../shared/app';
import { sql } from '../shared/db';

const app = createApp();

describe('Public cohort interest API', () => {
  const youthFirstName = 'Cohort';
  const youthLastName = `Test-${Date.now()}`;

  afterAll(async () => {
    await sql`DELETE FROM cohort_interest_submissions WHERE youth_last_name = ${youthLastName}`;
  });

  it('creates a cohort interest submission using the primary contact', async () => {
    const res = await request(app)
      .post('/api/public/cohort-interest')
      .send({
        youthFirstName,
        youthLastName,
        age: 14,
        school: 'Test Secondary',
        discoverySource: 'school',
        contactFirstName: 'Parent',
        contactLastName: 'Test',
        contactPhoneNumber: '416-555-0199',
        contactRelationship: 'parent',
        notes: 'Interested in learning more.',
      });

    expect(res.status).toBe(201);
    expect(res.body.message).toMatch(/submitted successfully/i);

    const rows = await sql<{
      youthFirstName: string;
      youthLastName: string;
      contactFirstName: string | null;
      contactLastName: string | null;
      contactPhoneNumber: string | null;
      contactRelationship: string | null;
      age: number;
      school: string | null;
      discoverySource: string | null;
    }[]>`
      SELECT
        youth_first_name as "youthFirstName",
        youth_last_name as "youthLastName",
        contact_first_name as "contactFirstName",
        contact_last_name as "contactLastName",
        contact_phone_number as "contactPhoneNumber",
        contact_relationship as "contactRelationship",
        age,
        school,
        discovery_source as "discoverySource"
      FROM cohort_interest_submissions
      WHERE youth_last_name = ${youthLastName}
      LIMIT 1
    `;

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      youthFirstName,
      youthLastName,
      contactFirstName: 'Parent',
      contactLastName: 'Test',
      contactPhoneNumber: '416-555-0199',
      contactRelationship: 'parent',
      age: 14,
      school: 'Test Secondary',
      discoverySource: 'school',
    });
  });

  it('requires all primary contact fields', async () => {
    const res = await request(app)
      .post('/api/public/cohort-interest')
      .send({
        youthFirstName: 'Partial',
        youthLastName: 'Contact',
        age: 15,
        school: 'Test Secondary',
        discoverySource: 'online',
        contactFirstName: 'Parent',
      });

    expect(res.status).toBe(400);
    expect(res.body.details).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: 'body.contactLastName' }),
      expect.objectContaining({ field: 'body.contactPhoneNumber' }),
      expect.objectContaining({ field: 'body.contactRelationship' }),
    ]));
  });
});
