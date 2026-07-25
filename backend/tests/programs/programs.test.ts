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
  });

  afterAll(async () => {
    await sql`DELETE FROM programs WHERE BTRIM(name) = ${createdName}`;
    await deleteTestUser(adminUserId);
    await deleteTestUser(youthUserId);
    await deleteTestUser(staffUserId);
  });

  it('allows admins to create a program', async () => {
    const res = await request(app)
      .post('/api/programs')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: ` ${createdName} `, rosterMode: 'open' });

    expect(res.status).toBe(201);
    expect(res.body).toEqual(expect.objectContaining({
      id: expect.any(String),
      name: createdName,
      rosterMode: 'open',
    }));
  });

  it('rejects program creation by staff', async () => {
    const res = await request(app)
      .post('/api/programs')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ name: 'Staff Program' });

    expect(res.status).toBe(403);
  });

  it('returns the canonical seeded programs to staff', async () => {
    const res = await request(app)
      .get('/api/programs')
      .set('Authorization', `Bearer ${staffToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: expect.any(String), name: 'Job Readiness' }),
      expect.objectContaining({ id: expect.any(String), name: 'Soft Skills' }),
      expect.objectContaining({ id: expect.any(String), name: 'Drop In', rosterMode: 'open' }),
    ]));
  });

  it('rejects accounts without program lookup permission', async () => {
    const res = await request(app)
      .get('/api/programs')
      .set('Authorization', `Bearer ${youthToken}`);

    expect(res.status).toBe(403);
  });
});
