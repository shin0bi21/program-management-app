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

  it('creates a cohort interest submission with email only', async () => {
    const res = await request(app)
      .post('/api/public/cohort-interest')
      .send({
        youthFirstName,
        youthLastName,
        age: 14,
        school: 'Test Secondary',
        email: 'cohort@test.local',
        discoverySource: 'school',
        contactFirstName: 'Parent',
        contactLastName: 'Test',
        contactPhoneNumber: '416-555-0199',
        contactRelationship: 'parent',
        message: 'Interested in learning more.',
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
      email: string | null;
      phoneNumber: string | null;
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
        email,
        phone_number as "phoneNumber",
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
      email: 'cohort@test.local',
      phoneNumber: null,
      discoverySource: 'school',
    });
  });

  it('rejects submissions without email or phone', async () => {
    const res = await request(app)
      .post('/api/public/cohort-interest')
      .send({
        youthFirstName: 'Missing',
        youthLastName: 'Contact',
        age: 15,
        school: 'Test Secondary',
        discoverySource: 'online',
        contactFirstName: 'Parent',
        contactLastName: 'Contact',
        contactPhoneNumber: '416-555-0199',
        contactRelationship: 'parent',
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

  it('requires all primary contact fields', async () => {
    const res = await request(app)
      .post('/api/public/cohort-interest')
      .send({
        youthFirstName: 'Partial',
        youthLastName: 'Contact',
        age: 15,
        school: 'Test Secondary',
        email: 'partial-contact@test.local',
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
