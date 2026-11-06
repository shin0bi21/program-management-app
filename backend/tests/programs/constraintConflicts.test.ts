import { randomUUID } from 'crypto';
import request from 'supertest';
import { createApp } from '../shared/app';
import { deleteTestUser, seedTestUser, sql } from '../shared/db';
import { generateToken } from '../shared/tokenHelpers';

const app = createApp();

describe('Programming constraint conflicts', () => {
  let adminId: string;
  let token: string;
  let programId: string;
  let cycleId: string;
  let startsOn: string;
  let endsOn: string;

  beforeAll(async () => {
    const admin = await seedTestUser({ role: 'admin' });
    adminId = admin.userId;
    token = generateToken(adminId, 'admin');
  });

  beforeEach(async () => {
    const [program] = await sql`
      INSERT INTO programs (name) VALUES (${`Conflict program ${randomUUID()}`}) RETURNING id
    `;
    programId = program.id;
    const [{ year }] = await sql<{ year: number }[]>`SELECT EXTRACT(YEAR FROM NOW())::int + 1 AS year`;
    startsOn = `${year}-01-01`;
    endsOn = `${year}-12-31`;
    const response = await request(app).post('/api/cycles')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `Conflict cycle ${randomUUID()}`, programIds: [programId], startsOn, endsOn });
    expect(response.status).toBe(201);
    cycleId = response.body.cycle.id;
  });

  afterEach(async () => {
    await sql`DELETE FROM program_sessions WHERE program_id = ${programId}`;
    await sql`DELETE FROM program_cycle_assignments WHERE program_id = ${programId}`;
    await sql`DELETE FROM programs WHERE id = ${programId}`;
    if (cycleId) await sql`DELETE FROM program_cycles WHERE id = ${cycleId}`;
  });

  afterAll(async () => { await deleteTestUser(adminId); });

  it('explains a duplicate cycle name and rolls back its assignment changes', async () => {
    const [cycle] = await sql`SELECT name FROM program_cycles WHERE id = ${cycleId}`;

    const response = await request(app).post('/api/cycles')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: cycle.name, programIds: [programId], startsOn, endsOn });

    expect(response.status).toBe(409);
    expect(response.body.error).toBe('A cycle with this name already exists');
    expect(response.body.requestId).toEqual(expect.any(String));
    expect(await sql`SELECT 1 FROM program_cycle_assignments WHERE program_id = ${programId}`).toHaveLength(1);
  });

  it('explains duplicate session schedules without inserting a second session', async () => {
    const input = { programId, theme: 'Same schedule', date: startsOn,
      sessionTypeId: '00000000-0000-4000-8000-000000000001' };
    const first = await request(app).post('/api/sessions')
      .set('Authorization', `Bearer ${token}`).send(input);
    expect(first.status).toBe(201);

    const duplicate = await request(app).post('/api/sessions')
      .set('Authorization', `Bearer ${token}`).send(input);

    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error).toBe('A session with this theme and start time already exists in this program cycle');
    expect(await sql`SELECT 1 FROM program_sessions WHERE program_id = ${programId}`).toHaveLength(1);
  });
});
