import request from 'supertest';
import { createApp } from '../shared/app';
import { sql } from '../shared/db';

const app = createApp();

describe('Public expression of interest API', () => {
  const youthFirstName = 'Cohort';
  const youthLastName = `Test-${Date.now()}`;

  afterAll(async () => {
    await sql`DELETE FROM expressions_of_interest WHERE youth_last_name = ${youthLastName}`;
  });

  it('creates an expression of interest using the primary contact', async () => {
    const res = await request(app)
      .post('/api/public/expressions-of-interest')
      .send({
        youthFirstName,
        youthLastName,
        age: 14,
        school: 'Test Secondary',
        discoverySource: 'school',
        contactPhoneNumber: '416-555-0199',
        contactRelationship: 'parent',
        notes: 'Interested in learning more.',
      });

    expect(res.status).toBe(201);
    expect(res.body.message).toMatch(/submitted successfully/i);

    const rows = await sql<{
      youthFirstName: string;
      youthLastName: string;
      contactPhoneNumber: string | null;
      contactRelationship: string | null;
      age: number;
      school: string | null;
      discoverySource: string | null;
    }[]>`
      SELECT
        youth_first_name as "youthFirstName",
        youth_last_name as "youthLastName",
        contact_phone_number as "contactPhoneNumber",
        contact_relationship as "contactRelationship",
        age,
        school,
        discovery_source as "discoverySource"
      FROM expressions_of_interest
      WHERE youth_last_name = ${youthLastName}
      LIMIT 1
    `;

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      youthFirstName,
      youthLastName,
      contactPhoneNumber: '416-555-0199',
      contactRelationship: 'parent',
      age: 14,
      school: 'Test Secondary',
      discoverySource: 'school',
    });
  });

  it('requires all primary contact fields', async () => {
    const res = await request(app)
      .post('/api/public/expressions-of-interest')
      .send({
        youthFirstName: 'Partial',
        youthLastName: 'Contact',
        age: 15,
        school: 'Test Secondary',
        discoverySource: 'online',
      });

    expect(res.status).toBe(400);
    expect(res.body.details).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: 'body.contactPhoneNumber' }),
      expect.objectContaining({ field: 'body.contactRelationship' }),
    ]));
  });

  it('rejects emergency as an Outreach relationship', async () => {
    const res = await request(app)
      .post('/api/public/expressions-of-interest')
      .send({
        youthFirstName: 'Relationship',
        youthLastName: 'Test',
        age: 14,
        school: 'Test Secondary',
        discoverySource: 'online',
        contactPhoneNumber: '416-555-0199',
        contactRelationship: 'emergency',
      });

    expect(res.status).toBe(400);
    expect(res.body.details).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: 'body.contactRelationship' }),
    ]));
  });
});
