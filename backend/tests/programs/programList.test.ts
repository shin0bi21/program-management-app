import crypto from 'crypto';
import request from 'supertest';
import { createApp } from '../shared/app';
import { deleteTestUser, seedTestUser, sql } from '../shared/db';
import { generateToken } from '../shared/tokenHelpers';

const app = createApp();

interface ListedProgram {
  id: string;
  title: string;
}

describe('Programs table list', () => {
  let staffId: string;
  let adminId: string;
  let managerId: string;
  let staffToken: string;
  let adminToken: string;
  let managerToken: string;
  let assigned: ListedProgram[];
  let unrelatedId: string;
  const prefix = `Program list ${crypto.randomUUID()}`;

  beforeAll(async () => {
    const staff = await seedTestUser({ role: 'staff' });
    const admin = await seedTestUser({ role: 'admin' });
    const manager = await seedTestUser({ role: 'project_manager' });
    staffId = staff.userId;
    adminId = admin.userId;
    managerId = manager.userId;
    staffToken = generateToken(staffId, 'staff');
    adminToken = generateToken(adminId, 'admin');
    managerToken = generateToken(managerId, 'project_manager');

    const fixtures = Array.from({ length: 3 }, (_, index) => ({ title: `${prefix}-${index}` }));
    assigned = await Promise.all(fixtures.map(async fixture => {
      const [program] = await sql<ListedProgram[]>`
        INSERT INTO programs (title) VALUES (${fixture.title}) RETURNING id, title
      `;
      return program;
    }));
    await sql`
      INSERT INTO user_program_assignments ${sql(assigned.map(program => ({ user_id: staffId, program_id: program.id })), 'user_id', 'program_id')}
    `;
    const [unrelated] = await sql<{ id: string }[]>`
      INSERT INTO programs (title) VALUES (${`${prefix}-unrelated`}) RETURNING id
    `;
    unrelatedId = unrelated.id;
  });

  afterAll(async () => {
    const ids = [...assigned.map(program => program.id), unrelatedId];
    await sql`DELETE FROM user_program_assignments WHERE program_id = ANY(${sql.array(ids)}::uuid[])`;
    await sql`DELETE FROM programs WHERE id = ANY(${sql.array(ids)}::uuid[])`;
    await deleteTestUser(staffId);
    await deleteTestUser(adminId);
    await deleteTestUser(managerId);
  });

  /**
   * Requests programs visible to the selected test actor.
   * @param token - Defaults to the assigned staff member's access token.
   * @example await list(adminToken) // programs visible to the administrator
   */
  const list = (token = staffToken) => request(app).get('/api/programs/list')
    .set('Authorization', `Bearer ${token}`);

  it('keeps staff scope assigned while managers and administrators discover unassigned programs', async () => {
    const scopedStaff = await list().query({ scope: 'assigned' });
    expect(scopedStaff.status).toBe(200);
    expect(scopedStaff.body.rows.map((row: ListedProgram) => row.id).sort())
      .toEqual(assigned.map(row => row.id).sort());

    for (const token of [managerToken, adminToken]) {
      const response = await list(token).query({ scope: 'assigned' });
      expect(response.status).toBe(200);
      expect(response.body.rows.map((row: ListedProgram) => row.id)).toContain(unrelatedId);
    }
  });

  it('returns the same complete program projection as an authoritative update', async () => {
    const program = assigned[2];
    const updated = await request(app).put(`/api/programs/${program.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: program.title, description: 'Edited table row', enrollmentRequired: false, minAge: 12, maxAge: 16 });
    expect(updated.status).toBe(200);

    const response = await list().query({ scope: 'assigned' });
    expect(response.status).toBe(200);
    expect(response.body.rows.find((row: ListedProgram) => row.id === program.id)).toEqual(updated.body.program);
    expect(updated.body.program).toEqual(expect.objectContaining({
      description: 'Edited table row', enrollmentRequired: false, minAge: 12, maxAge: 16,
      defaultDayOfWeek: 'tuesday', defaultStartTime: '17:00', defaultEndTime: '19:30', timezone: 'America/Toronto',
    }));
  });

  it('requires authentication and the explicit program read capability', async () => {
    expect((await request(app).get('/api/programs/list')).status).toBe(401);
    const denied = generateToken(adminId, 'admin', undefined, ['write:programs']);
    expect((await list(denied)).status).toBe(403);
  });

  it.each([
    { cursor: 'not-a-cursor' },
    { sort: 'unsupported' }, { direction: 'sideways' }, { scope: 'all' },
  ])('rejects malformed pagination and scope %j', async query => {
    expect((await list().query(query)).status).toBe(400);
  });
});
