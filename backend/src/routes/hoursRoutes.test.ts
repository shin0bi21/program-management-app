import request from 'supertest';
import { createApp } from '../../tests/shared/app';
import { generateToken } from '../../tests/shared/tokenHelpers';
import {
  createHoursFixture, clearHoursRecords, deleteHoursFixture, regularHoursInput, type HoursFixture,
} from '../../tests/shared/hoursFixtures';

const app = createApp();

describe('Hours HTTP boundary', () => {
  let fixture: HoursFixture;
  let token: string;
  beforeAll(async () => {
    fixture = await createHoursFixture();
    token = generateToken(fixture.firstStaff.userId, 'staff', fixture.firstStaff.email);
  });
  afterEach(async () => { await clearHoursRecords(fixture); });
  afterAll(async () => { await deleteHoursFixture(fixture); });

  it('requires authentication and explicit read/write capabilities', async () => {
    expect((await request(app).get('/api/hours/table')).status).toBe(401);
    const readOnly = generateToken(fixture.firstStaff.userId, 'staff', fixture.firstStaff.email, ['read:hours']);
    const writeOnly = generateToken(fixture.firstStaff.userId, 'staff', fixture.firstStaff.email, ['write:hours']);
    expect((await request(app).get('/api/hours/table').set('Authorization', `Bearer ${writeOnly}`)).status).toBe(403);
    expect((await request(app).post('/api/hours').set('Authorization', `Bearer ${readOnly}`).send(regularHoursInput(fixture))).status).toBe(403);
  });

  it('wires create, read, update, placement and delete requests to their canonical responses', async () => {
    const created = await request(app).post('/api/hours').set('Authorization', `Bearer ${token}`).send(regularHoursInput(fixture));
    expect(created.status).toBe(201);
    const id: string = created.body.id;
    const table = await request(app).get('/api/hours/table').set('Authorization', `Bearer ${token}`);
    const calendar = await request(app).get('/api/hours/calendar').set('Authorization', `Bearer ${token}`);
    expect(table.status).toBe(200);
    expect(calendar.status).toBe(200);
    expect(table.body.rows).toEqual([created.body]);
    expect(calendar.body).toEqual([created.body]);
    const updated = await request(app).put(`/api/hours/${id}`).set('Authorization', `Bearer ${token}`)
      .send(regularHoursInput(fixture, { note: 'HTTP edit' }));
    expect(updated.status).toBe(200);
    expect(updated.body).toEqual(expect.objectContaining({ id, note: 'HTTP edit' }));
    const moved = await request(app).patch(`/api/hours/${id}/placement`).set('Authorization', `Bearer ${token}`)
      .send({ date: fixture.placementDate });
    expect(moved.status).toBe(200);
    expect(moved.body).toEqual(expect.objectContaining({ id, date: fixture.placementDate }));
    const deleted = await request(app).delete(`/api/hours/${id}`).set('Authorization', `Bearer ${token}`);
    expect(deleted.status).toBe(200);
    expect(deleted.body.message).toBe('Logged hours deleted');
  });

  it.each([
    'start=2026-06-12',
    'start=2026-06-15&end=2026-06-12',
    'start=2026-02-30&end=2026-03-01',
  ])('rejects an invalid table range: %s', async query => {
    const response = await request(app).get(`/api/hours/table?${query}`).set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(400);
  });

  it('validates calendar bounds, entry IDs and cycle selections', async () => {
    for (const path of [
      `/api/hours/calendar?start=${fixture.date}`,
      '/api/hours/calendar?start=2026-99-99&end=2026-99-99',
      '/api/hours/table?cycleIds=not-a-uuid',
    ]) {
      expect((await request(app).get(path).set('Authorization', `Bearer ${token}`)).status).toBe(400);
    }
    expect((await request(app).delete('/api/hours/not-a-uuid').set('Authorization', `Bearer ${token}`)).status).toBe(400);
  });

  it('rejects missing notes and Program Delivery through the regular workflow', async () => {
    for (const input of [regularHoursInput(fixture, { note: ' ' }), { ...regularHoursInput(fixture), category: 'program_delivery' }]) {
      const response = await request(app).post('/api/hours').set('Authorization', `Bearer ${token}`).send(input);
      expect(response.status).toBe(400);
    }
  });

  it('validates summary inputs and requires read permission on both summary routes', async () => {
    for (const path of [
      `/api/hours/pay-period?staffId=${fixture.firstStaff.userId}&date=2026-02-30`,
      `/api/hours/cycle-summary?staffId=${fixture.firstStaff.userId}`,
    ]) {
      expect((await request(app).get(path).set('Authorization', `Bearer ${token}`)).status).toBe(400);
    }
    const noRead = generateToken(fixture.firstStaff.userId, 'staff', fixture.firstStaff.email, []);
    for (const path of [
      `/api/hours/pay-period?staffId=${fixture.firstStaff.userId}`,
      `/api/hours/cycle-summary?staffId=${fixture.firstStaff.userId}&cycleId=${fixture.activeCycleId}`,
    ]) {
      expect((await request(app).get(path).set('Authorization', `Bearer ${noRead}`)).status).toBe(403);
    }
  });
});
