import crypto from 'crypto';
import request from 'supertest';
import { createApp } from '../shared/app';
import { deleteTestUser, seedTestUser, sql } from '../shared/db';
import { generateToken } from '../shared/tokenHelpers';

const app = createApp();

interface ListedProgram {
  id: string;
  name: string;
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
  const prefix = `Pagination ${crypto.randomUUID()}`;

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

    const fixtures = Array.from({ length: 60 }, (_, index) => {
      // Equal names span the default page boundary in both sort directions.
      const nameIndex = index === 1 ? 0 : index === 10 ? 9 : index === 50 ? 49 : index;
      const namePrefix = nameIndex !== index ? prefix.toUpperCase() : prefix;
      return { name: `${namePrefix}-${String(nameIndex).padStart(2, '0')}` };
    });
    assigned = await Promise.all(fixtures.map(async fixture => {
      const [program] = await sql<ListedProgram[]>`
        INSERT INTO programs (name) VALUES (${fixture.name}) RETURNING id, name
      `;
      return program;
    }));
    assigned.sort((left, right) => {
      const nameOrder = left.name.toLowerCase().localeCompare(right.name.toLowerCase());
      return nameOrder || left.id.localeCompare(right.id);
    });
    await sql`
      INSERT INTO user_program_assignments ${sql(assigned.map(program => ({ user_id: staffId, program_id: program.id })), 'user_id', 'program_id')}
    `;
    const [unrelated] = await sql<{ id: string }[]>`
      INSERT INTO programs (name) VALUES (${`${prefix}-unrelated`}) RETURNING id
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

  const list = (token = staffToken) => request(app).get('/api/programs/list')
    .set('Authorization', `Bearer ${token}`);

  it.each(['asc', 'desc'])('paginates all assigned programs with stable case-insensitive name ties (%s)', async direction => {
    const first = await list().query({ scope: 'assigned', direction });
    expect(first.status).toBe(200);
    expect(first.body.rows).toHaveLength(50);
    expect(first.body.nextCursor).toEqual(expect.any(String));

    const second = await list().query({ scope: 'assigned', direction, cursor: first.body.nextCursor });
    expect(second.status).toBe(200);
    expect(second.body.rows).toHaveLength(10);
    expect(second.body.nextCursor).toBeNull();
    const rows = [...first.body.rows, ...second.body.rows] as ListedProgram[];
    const expected = direction === 'asc' ? assigned : [...assigned].reverse();
    expect(rows.map(row => row.id)).toEqual(expected.map(row => row.id));
    expect(new Set(rows.map(row => row.id)).size).toBe(60);
    expect(rows[0]).not.toHaveProperty('cursorValue');
  });

  it('keeps staff scope assigned while managers and administrators discover unassigned programs', async () => {
    const scopedStaff = await list().query({ scope: 'assigned', limit: 50 });
    expect(scopedStaff.body.rows.map((row: ListedProgram) => row.id)).not.toContain(unrelatedId);

    for (const token of [managerToken, adminToken]) {
      const ids: string[] = [];
      let cursor: string | null = null;
      do {
        const response = await list(token).query({ scope: 'assigned', limit: 50, ...(cursor ? { cursor } : {}) });
        expect(response.status).toBe(200);
        ids.push(...response.body.rows.map((row: ListedProgram) => row.id));
        cursor = response.body.nextCursor;
      } while (cursor);

      expect(ids).toContain(unrelatedId);
    }
  });

  it('returns the same complete program projection as an authoritative update', async () => {
    const program = assigned[2];
    const updated = await request(app).put(`/api/programs/${program.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: program.name, description: 'Edited table row', enrollmentRequired: false, minAge: 12, maxAge: 16 });
    expect(updated.status).toBe(200);

    const response = await list().query({ scope: 'assigned', limit: 50 });
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
    { limit: 0 }, { limit: 51 }, { limit: 'invalid' }, { cursor: 'not-a-cursor' },
    { sort: 'unsupported' }, { direction: 'sideways' }, { scope: 'all' },
  ])('rejects malformed pagination and scope %j', async query => {
    expect((await list().query(query)).status).toBe(400);
  });
});
