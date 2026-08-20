import request from 'supertest';
import { createApp } from '../shared/app';
import { sql } from '../shared/db';

const app = createApp();

describe('Public lead API', () => {
  const youthFirstName = 'Cohort';
  const youthLastName = `Test-${Date.now()}`;

  afterAll(async () => {
    await sql`DELETE FROM leads WHERE youth_last_name = ${youthLastName}`;
  });

  it('creates an external lead using the primary contact', async () => {
    const res = await request(app)
      .post('/api/public/leads')
      .send({
        youthFirstName,
        youthLastName,
        age: 14,
        school: 'Test Secondary',
        submittedByRole: 'parent',
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
      origin: string;
      submittedByRole: string;
    }[]>`
      SELECT
        youth_first_name as "youthFirstName",
        youth_last_name as "youthLastName",
        contact_phone_number as "contactPhoneNumber",
        contact_relationship as "contactRelationship",
        age,
        school,
        discovery_source as "discoverySource",
        origin,
        submitted_by_role as "submittedByRole"
      FROM leads
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
      origin: 'external',
      submittedByRole: 'parent',
    });
  });

  it('requires all primary contact fields', async () => {
    const res = await request(app)
      .post('/api/public/leads')
      .send({
        youthFirstName: 'Partial',
        youthLastName: 'Contact',
        age: 15,
        school: 'Test Secondary',
        discoverySource: 'online',
        submittedByRole: 'youth',
      });

    expect(res.status).toBe(400);
    expect(res.body.details).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: 'body.contactPhoneNumber' }),
      expect.objectContaining({ field: 'body.contactRelationship' }),
    ]));
  });

  it.each([11, 20])('rejects age %i outside the supported program range', async (age) => {
    const res = await request(app)
      .post('/api/public/leads')
      .send({
        youthFirstName: 'Age',
        youthLastName: 'Boundary',
        age,
        school: 'Test Secondary',
        submittedByRole: 'parent',
        discoverySource: 'online',
        contactPhoneNumber: '416-555-0199',
        contactRelationship: 'parent',
      });

    expect(res.status).toBe(400);
    expect(res.body.details).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: 'body.age' }),
    ]));
  });

  it('rejects emergency as an Outreach relationship', async () => {
    const res = await request(app)
      .post('/api/public/leads')
      .send({
        youthFirstName: 'Relationship',
        youthLastName: 'Test',
        age: 14,
        school: 'Test Secondary',
        submittedByRole: 'guardian',
        discoverySource: 'online',
        contactPhoneNumber: '416-555-0199',
        contactRelationship: 'emergency',
      });

    expect(res.status).toBe(400);
    expect(res.body.details).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: 'body.contactRelationship' }),
    ]));
  });

  it('rejects unknown server-owned fields and intake information over 500 characters', async () => {
    const base = {
      youthFirstName: 'Strict', youthLastName: 'Boundary', age: 14,
      school: 'Test Secondary', discoverySource: 'online',
      submittedByRole: 'parent',
      contactPhoneNumber: '416-555-0199', contactRelationship: 'parent',
    };
    const unknown = await request(app).post('/api/public/leads').send({ ...base, status: 'signed_up' });
    const tooLong = await request(app).post('/api/public/leads').send({ ...base, notes: 'x'.repeat(501) });
    expect(unknown.status).toBe(400);
    expect(tooLong.status).toBe(400);
  });
});
