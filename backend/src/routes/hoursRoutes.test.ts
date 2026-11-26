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
    expect(table.status).toBe(200);
    expect(table.body.rows).toEqual([created.body]);

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

  it('returns logged hours for a calendar range spanning more than one year', async () => {
    const created = await request(app).post('/api/hours')
      .set('Authorization', `Bearer ${token}`)
      .send(regularHoursInput(fixture));
    expect(created.status).toBe(201);

    const calendar = await request(app).get('/api/hours/calendar')
      .query({ start: '2000-01-01', end: fixture.date })
      .set('Authorization', `Bearer ${token}`);

    expect(calendar.status).toBe(200);
    expect(calendar.body).toEqual([created.body]);
  });

  it('rejects an incomplete calendar range at the HTTP boundary', async () => {
    const response = await request(app).get('/api/hours/calendar')
      .query({ start: fixture.date })
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(400);
  });

  it('returns the assigned session for the requested staff and work date', async () => {
    const { firstStaff, date, sessionId } = fixture;
    const response = await request(app).get('/api/hours/sessions')
      .query({ staffId: firstStaff.userId, date })
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual([{ id: sessionId, name: 'Hours workshop', date }]);
  });

  it('returns pay-period totals and cycle averages for logged hours', async () => {
    const { firstStaff, activeCycleId, date } = fixture;
    const staffId = firstStaff.userId;
    const created = await request(app).post('/api/hours')
      .set('Authorization', `Bearer ${token}`)
      .send(regularHoursInput(fixture, { hours: 2 }));
    expect(created.status).toBe(201);

    const payPeriod = await request(app).get('/api/hours/pay-period')
      .query({ staffId, date })
      .set('Authorization', `Bearer ${token}`);
    const cycleSummary = await request(app).get('/api/hours/cycle-summary')
      .query({ staffId, cycleId: activeCycleId })
      .set('Authorization', `Bearer ${token}`);

    const breakdown = [{ label: 'Meeting', hours: 2 }];
    expect(payPeriod.status).toBe(200);
    expect(payPeriod.body).toEqual(expect.objectContaining({ totalHours: 2, breakdown }));
    expect(cycleSummary.status).toBe(200);
    expect(cycleSummary.body).toEqual({ periodCount: 1, averageHours: 2, breakdown });
  });

  it('validates entry IDs and cycle selections', async () => {
    expect((await request(app).get('/api/hours/table?cycleIds=not-a-uuid').set('Authorization', `Bearer ${token}`)).status).toBe(400);
    expect((await request(app).delete('/api/hours/not-a-uuid').set('Authorization', `Bearer ${token}`)).status).toBe(400);
  });

  it('rejects missing notes and Program Delivery through the regular workflow', async () => {
    for (const input of [regularHoursInput(fixture, { note: ' ' }), { ...regularHoursInput(fixture), category: 'program_delivery' }]) {
      const response = await request(app).post('/api/hours').set('Authorization', `Bearer ${token}`).send(input);
      expect(response.status).toBe(400);
    }
  });

  it('validates summary inputs and requires read permission on both summary routes', async () => {
    const invalid = await request(app).get('/api/hours/cycle-summary')
      .query({ staffId: fixture.firstStaff.userId })
      .set('Authorization', `Bearer ${token}`);
    expect(invalid.status).toBe(400);

    const noRead = generateToken(fixture.firstStaff.userId, 'staff', fixture.firstStaff.email, []);
    for (const path of [
      `/api/hours/pay-period?staffId=${fixture.firstStaff.userId}`,
      `/api/hours/cycle-summary?staffId=${fixture.firstStaff.userId}&cycleId=${fixture.activeCycleId}`,
    ]) {
      expect((await request(app).get(path).set('Authorization', `Bearer ${noRead}`)).status).toBe(403);
    }
  });
});
