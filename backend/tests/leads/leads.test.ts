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
  });

  afterAll(async () => {
    await sql`DELETE FROM leads WHERE created_by = ${staffUserId}`;
    await deleteTestUser(youthUserId);
    await deleteTestUser(staffUserId);
  });

  it('lets staff create a direct lead and records its origin and creator', async () => {
    const res = await request(app)
      .post('/api/leads')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ ...payload, programId: softSkillsProgramId });

    expect(res.status).toBe(201);
    expect(res.body).toEqual(expect.objectContaining({
      origin: 'staff_created',
      expressionOfInterestId: null,
      youthFirstName: 'Event',
      youthLastName: 'Prospect',
      status: 'new',
      programId: softSkillsProgramId,
      programName: 'Soft Skills',
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
      expect.objectContaining({ youthFirstName: 'Event', programId: softSkillsProgramId }),
    ]));
    expect(res.body.every((lead: { programId: string }) => lead.programId === softSkillsProgramId)).toBe(true);
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
      .send({ status: 'contacted' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual(expect.objectContaining({
      id: lead.id,
      status: 'contacted',
      updatedBy: staffUserId,
      statusUpdatedAt: expect.any(String),
    }));
  });

  it('updates a Lead without changing its workflow metadata', async () => {
    const [lead] = await sql<{ id: string; origin: string; status: string }[]>`
      SELECT id, origin, status FROM leads WHERE created_by = ${staffUserId} ORDER BY created_at DESC LIMIT 1
    `;
    const res = await request(app)
      .put(`/api/leads/${lead.id}`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ ...payload, school: 'Updated Community School', programId: softSkillsProgramId });

    expect(res.status).toBe(200);
    expect(res.body).toEqual(expect.objectContaining({
      id: lead.id,
      school: 'Updated Community School',
      programId: softSkillsProgramId,
      origin: lead.origin,
      status: lead.status,
      updatedBy: staffUserId,
    }));
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
      .send({ status: 'lost' });

    expect(res.status).toBe(404);
  });
});
