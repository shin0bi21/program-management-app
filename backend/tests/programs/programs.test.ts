import request from 'supertest';
import { createApp } from '../shared/app';
import { deleteTestUser, seedTestUser, sql } from '../shared/db';
import { generateToken } from '../shared/tokenHelpers';

const app = createApp();

describe('Programs API', () => {
  let staffUserId: string;
  let staffToken: string;
  let youthUserId: string;
  let youthToken: string;
  let adminUserId: string;
  let adminToken: string;
  let softSkillsProgramId: string;
  let createdProgramId: string;
  const createdName = `Leadership ${Date.now()}`;

  beforeAll(async () => {
    const staff = await seedTestUser({ email: `program-staff-${Date.now()}@test.local`, role: 'staff' });
    staffUserId = staff.userId;
    staffToken = generateToken(staff.userId, 'staff', staff.email);
    const youth = await seedTestUser({ email: `program-youth-${Date.now()}@test.local`, role: 'youth' });
    youthUserId = youth.userId;
    youthToken = generateToken(youth.userId, 'youth', youth.email);
    const admin = await seedTestUser({ email: `program-admin-${Date.now()}@test.local`, role: 'admin' });
    adminUserId = admin.userId;
    adminToken = generateToken(admin.userId, 'admin', admin.email);

    const [softSkills] = await sql<{ id: string }[]>`
      SELECT id FROM programs WHERE name = 'Soft Skills'
    `;
    softSkillsProgramId = softSkills.id;
    await sql`
      INSERT INTO user_program_assignments (user_id, program_id)
      VALUES (${staffUserId}, ${softSkillsProgramId})
    `;
  });

  afterAll(async () => {
    if (createdProgramId) await sql`DELETE FROM programs WHERE id = ${createdProgramId}`;
    await deleteTestUser(adminUserId);
    await deleteTestUser(youthUserId);
    await deleteTestUser(staffUserId);
  });

  it('allows admins to create a program', async () => {
    const res = await request(app)
      .post('/api/programs')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: ` ${createdName} `,
        rosterMode: 'open',
        minAge: 14,
        maxAge: 18,
      });

    expect(res.status).toBe(201);
    expect(res.body).toEqual(expect.objectContaining({
      id: expect.any(String),
      name: createdName,
      rosterMode: 'open',
      minAge: 14,
      maxAge: 18,
    }));
    createdProgramId = res.body.id;
  });

  it('allows admins to edit a program', async () => {
    const res = await request(app)
      .put(`/api/programs/${createdProgramId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: createdName,
        description: 'Updated program description',
        rosterMode: 'enrolled',
        minAge: 15,
        maxAge: 19,
      });

    expect(res.status).toBe(200);
    expect(res.body).toEqual(expect.objectContaining({
      id: createdProgramId,
      description: 'Updated program description',
      rosterMode: 'enrolled',
      minAge: 15,
      maxAge: 19,
    }));
  });

  it('rejects program creation by staff', async () => {
    const res = await request(app)
      .post('/api/programs')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ name: 'Staff Program' });

    expect(res.status).toBe(403);
  });

  it('rejects program edits by staff', async () => {
    const res = await request(app)
      .put(`/api/programs/${softSkillsProgramId}`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ name: 'Staff Program', rosterMode: 'enrolled' });

    expect(res.status).toBe(403);
  });

  it('requires a complete valid age range', async () => {
    const missingMaximum = await request(app)
      .post('/api/programs')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Incomplete Age Range', minAge: 12 });
    const reversedRange = await request(app)
      .post('/api/programs')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Reversed Age Range', minAge: 19, maxAge: 16 });

    expect(missingMaximum.status).toBe(400);
    expect(reversedRange.status).toBe(400);
  });

  it('returns assigned and open programs to staff', async () => {
    const res = await request(app)
      .get('/api/programs?scope=assigned')
      .set('Authorization', `Bearer ${staffToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: expect.any(String),
        name: 'Soft Skills',
        minAge: 12,
        maxAge: 15,
      }),
      expect.objectContaining({ id: expect.any(String), name: 'Drop In', rosterMode: 'open' }),
    ]));
    expect(res.body).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'Job Readiness', minAge: 16, maxAge: 19 }),
    ]));
  });

  it('keeps the full program lookup available outside Programming', async () => {
    const res = await request(app)
      .get('/api/programs')
      .set('Authorization', `Bearer ${staffToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'Soft Skills' }),
      expect.objectContaining({ name: 'Job Readiness' }),
      expect.objectContaining({ name: 'Drop In' }),
    ]));
  });

  it('rejects accounts without program lookup permission', async () => {
    const res = await request(app)
      .get('/api/programs')
      .set('Authorization', `Bearer ${youthToken}`);

    expect(res.status).toBe(403);
  });
});
