import request from 'supertest';
import { createApp } from '../shared/app';
import { deleteTestUser, seedTestUser, sql } from '../shared/db';
import { generateToken } from '../shared/tokenHelpers';
import { getStaffReferenceData } from '../../src/services/referenceData/staffReferenceData';
import type { AccessTokenPayload } from '../../src/types/auth';

const app = createApp();

describe('Page-authorized reference data', () => {
  let adminId: string;
  let staffId: string;
  let sharedId: string;
  let unrelatedId: string;
  let inactiveId: string;
  let managerId: string;
  let assignedProgramId: string;
  let otherProgramId: string;
  let cycleId: string;
  let schoolId: string;

  const token = (permissions: string[], id = staffId, role = 'staff') => generateToken(id, role, undefined, permissions);
  const get = (path: string, permissions: string[], id = staffId, role = 'staff') => request(app)
    .get(`/api${path}`).set('Authorization', `Bearer ${token(permissions, id, role)}`);

  beforeAll(async () => {
    const stamp = Date.now();
    const admin = await seedTestUser({ role: 'admin' });
    const staff = await seedTestUser({ role: 'staff', firstName: 'Reference', lastName: 'Owner' });
    const shared = await seedTestUser({ role: 'staff', firstName: 'Reference', lastName: 'Coworker' });
    const unrelated = await seedTestUser({ role: 'staff', firstName: 'Reference', lastName: 'Unrelated' });
    const inactive = await seedTestUser({ role: 'staff' });
    const manager = await seedTestUser({ role: 'project_manager' });
    managerId = manager.userId;
    adminId = admin.userId;
    staffId = staff.userId;
    sharedId = shared.userId;
    unrelatedId = unrelated.userId;
    inactiveId = inactive.userId;
    await sql`UPDATE user_credentials SET status = 'inactive' WHERE user_id = ${inactiveId}`;

    const [assigned] = await sql<{ id: string }[]>`
      INSERT INTO programs (name, description, min_age, max_age)
      VALUES (${`Assigned reference ${stamp}`}, 'Private scheduling detail', 12, 19) RETURNING id
    `;
    const [other] = await sql<{ id: string }[]>`
      INSERT INTO programs (name) VALUES (${`Other reference ${stamp}`}) RETURNING id
    `;
    assignedProgramId = assigned.id;
    otherProgramId = other.id;
    await sql`
      INSERT INTO user_program_assignments (user_id, program_id)
      VALUES (${staffId}, ${assignedProgramId}), (${sharedId}, ${assignedProgramId}), (${managerId}, ${assignedProgramId})
    `;
    const [cycle] = await sql<{ id: string }[]>`
      INSERT INTO program_cycles (name, starts_on, ends_on)
      VALUES (${`Reference cycle ${stamp}`}, CURRENT_DATE - 1, CURRENT_DATE + 7) RETURNING id
    `;
    cycleId = cycle.id;
    const [school] = await sql<{ id: string }[]>`
      INSERT INTO schools (name) VALUES (${`Reference school ${stamp}`}) RETURNING id
    `;
    schoolId = school.id;
  });

  afterAll(async () => {
    for (const id of [adminId, staffId, sharedId, unrelatedId, inactiveId, managerId]) await deleteTestUser(id);
    await sql`DELETE FROM programs WHERE id IN (${assignedProgramId}, ${otherProgramId})`;
    await sql`DELETE FROM program_cycles WHERE id = ${cycleId}`;
    await sql`DELETE FROM schools WHERE id = ${schoolId}`;
  });

  it.each(['cycles', 'programs', 'staff?feature=tasks', 'schools'])('requires authentication and an entry capability for %s', async lookup => {
    expect((await request(app).get(`/api/reference-data/${lookup}`)).status).toBe(401);
    expect((await get(`/reference-data/${lookup}`, [])).status).toBe(403);
    expect((await get(`/reference-data/${lookup}`, ['write:hours'])).status).toBe(403);
  });

  it.each([
    'read:programs', 'write:programs', 'read:sessions', 'read:tasks', 'read:hours',
    'read:youth_profiles', 'read:outreach', 'read:accounts',
  ])('allows minimal program and cycle metadata for %s', async permission => {
    const programs = await get('/reference-data/programs', [permission]);
    expect(programs.status).toBe(200);
    expect(programs.body).toContainEqual({ id: assignedProgramId, name: expect.any(String) });
    expect(programs.body).toContainEqual({ id: otherProgramId, name: expect.any(String) });
    for (const program of programs.body) expect(Object.keys(program).sort()).toEqual(['id', 'name']);

    const cycles = await get('/reference-data/cycles', [permission]);
    expect(cycles.status).toBe(200);
    expect(cycles.body).toContainEqual({
      id: cycleId, name: expect.any(String), startsOn: expect.any(String), endsOn: expect.any(String), state: 'active',
    });
    for (const cycle of cycles.body) expect(Object.keys(cycle).sort()).toEqual(['endsOn', 'id', 'name', 'startsOn', 'state']);
  });

  it('validates assignedOnly and scopes assigned labels through program policy', async () => {
    const assigned = await get('/reference-data/programs?assignedOnly=true', ['read:sessions']);
    expect(assigned.status).toBe(200);
    expect(assigned.body).toEqual([{ id: assignedProgramId, name: expect.any(String) }]);
    const all = await get('/reference-data/programs?assignedOnly=false', ['read:sessions']);
    expect(all.body).toContainEqual({ id: otherProgramId, name: expect.any(String) });
    const admin = await get('/reference-data/programs?assignedOnly=true', ['read:programs'], adminId, 'admin');
    expect(admin.body).toContainEqual({ id: otherProgramId, name: expect.any(String) });
    expect((await get('/reference-data/programs?assignedOnly=anything', ['read:sessions'])).status).toBe(400);
  });

  it('serves own assigned labels without a feature permission while protecting unrestricted labels', async () => {
    const assigned = await get('/reference-data/programs?assignedOnly=true', []);
    expect(assigned.status).toBe(200);
    expect(assigned.body).toEqual([{ id: assignedProgramId, name: expect.any(String) }]);
    const unassigned = await get('/reference-data/programs?assignedOnly=true', [], unrelatedId);
    expect(unassigned.status).toBe(200);
    expect(unassigned.body).toEqual([]);

    for (const suffix of ['', '?assignedOnly=false']) {
      expect((await get(`/reference-data/programs${suffix}`, [])).status).toBe(403);
    }
    expect((await get('/reference-data/programs?assignedOnly=invalid', [])).status).toBe(400);

    const accountOptions = await get('/reference-data/programs', ['write:accounts']);
    expect(accountOptions.status).toBe(200);
    expect(accountOptions.body).toContainEqual({ id: otherProgramId, name: expect.any(String) });
    for (const program of accountOptions.body) expect(Object.keys(program).sort()).toEqual(['id', 'name']);
    expect((await get('/programs', ['write:accounts'])).status).toBe(403);
    expect((await get('/reference-data/cycles', ['write:accounts'])).status).toBe(403);
    expect((await get('/reference-data/cycles', [])).status).toBe(403);
  });

  it.each(['read:schools', 'write:schools', 'read:youth_profiles'])('allows only school labels for %s', async permission => {
    const response = await get('/reference-data/schools', [permission]);
    expect(response.status).toBe(200);
    expect(response.body).toContainEqual({ id: schoolId, name: expect.any(String) });
    for (const school of response.body) expect(Object.keys(school).sort()).toEqual(['id', 'name']);
  });

  it.each(['tasks', 'hours'])('enforces %s feature read capability and its own write capability', async feature => {
    const other = feature === 'tasks' ? 'hours' : 'tasks';
    expect((await get(`/reference-data/staff?feature=${feature}`, [`read:${other}`])).status).toBe(403);
    const readOnly = await get(`/reference-data/staff?feature=${feature}`, [`read:${feature}`, `write:${other}`]);
    expect(readOnly.status).toBe(200);
    expect(readOnly.body.every((resource: { writable: boolean }) => !resource.writable)).toBe(true);

    const scoped = await get(`/reference-data/staff?feature=${feature}`, [`read:${feature}`, `write:${feature}`]);
    expect(scoped.status).toBe(200);
    expect(scoped.body).toEqual(expect.arrayContaining([
      { id: staffId, firstName: 'Reference', lastName: 'Owner', name: 'Reference Owner', role: 'staff', writable: true },
      { id: sharedId, firstName: 'Reference', lastName: 'Coworker', name: 'Reference Coworker', role: 'staff', writable: false },
    ]));
    expect(scoped.body.map((resource: { id: string }) => resource.id)).not.toContain(unrelatedId);
    expect(scoped.body.map((resource: { id: string }) => resource.id)).not.toContain(inactiveId);

    const unrelated = await get(`/reference-data/staff?feature=${feature}`, [`read:${feature}`, `write:${feature}`], unrelatedId);
    expect(unrelated.body).toEqual([expect.objectContaining({ id: unrelatedId, writable: true })]);
    const admin = await get(`/reference-data/staff?feature=${feature}`, [`read:${feature}`, `write:${feature}`], adminId, 'admin');
    expect(admin.body).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: staffId, writable: true }),
      expect.objectContaining({ id: unrelatedId, writable: true }),
    ]));
    expect(admin.body.map((resource: { id: string }) => resource.id)).not.toContain(inactiveId);
  });

  it.each(['tasks', 'hours'])('keeps project managers in %s resources with staff read and write scope', async feature => {
    const permissions = [`read:${feature}`, `write:${feature}`];
    const manager = await get(`/reference-data/staff?feature=${feature}`, permissions, managerId, 'project_manager');

    expect(manager.status).toBe(200);
    expect(manager.body).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: managerId, role: 'project_manager', writable: true }),
      expect.objectContaining({ id: sharedId, writable: false }),
    ]));
    expect(manager.body.map((resource: { id: string }) => resource.id)).not.toContain(unrelatedId);

    const staff = await get(`/reference-data/staff?feature=${feature}`, permissions);
    expect(staff.body).toContainEqual(expect.objectContaining({ id: managerId, writable: false }));
    const admin = await get(`/reference-data/staff?feature=${feature}`, permissions, adminId, 'admin');
    expect(admin.body).toContainEqual(expect.objectContaining({ id: managerId, writable: true }));
  });

  it('requires a valid staff feature and independently checks the service capability', async () => {
    for (const suffix of ['', '?feature=schools']) {
      expect((await get(`/reference-data/staff${suffix}`, ['read:tasks'])).status).toBe(400);
    }
    const actor: AccessTokenPayload = {
      userId: staffId, role: 'staff', permissions: ['read:hours'], email: 'reference@test.local',
      jti: 'reference-service-test', tokenType: 'access', iat: 0, exp: 1,
    };
    expect(() => getStaffReferenceData(actor, 'tasks')).toThrow('Insufficient permissions');
  });

  it('keeps feature-local choices separate from shared lookups', async () => {
    const tasks = await get('/tasks/reference-data', ['read:tasks']);
    expect(tasks.status).toBe(200);
    expect(Object.keys(tasks.body).sort()).toEqual(['categories', 'statuses']);
    const hours = await get('/hours/reference-data', ['read:hours']);
    expect(hours.status).toBe(200);
    expect(Object.keys(hours.body).sort()).toEqual(['categories', 'types']);
    expect(hours.body.categories.length).toBeGreaterThan(0);
    expect(hours.body.types.length).toBeGreaterThan(0);
    expect((await get('/tasks/reference-data', ['read:hours'])).status).toBe(403);
    expect((await get('/hours/reference-data', ['read:tasks'])).status).toBe(403);
  });

  it('serves Sessions scheduling references with only session-read permission and retains management boundaries', async () => {
    const sessions = await get('/cohorts/sessions/reference-data', ['read:sessions']);
    expect(sessions.status).toBe(200);
    expect(Object.keys(sessions.body).sort()).toEqual(['programs', 'sessionTypes']);
    expect(sessions.body.programs).toEqual([expect.objectContaining({
      id: assignedProgramId, description: 'Private scheduling detail', minAge: 12, maxAge: 19,
      defaultDayOfWeek: expect.any(String), defaultStartTime: expect.any(String),
      defaultEndTime: expect.any(String), timezone: 'America/Toronto', enrollmentRequired: true,
    })]);
    expect(Array.isArray(sessions.body.sessionTypes)).toBe(true);
    expect((await get('/cohorts/sessions/reference-data', ['read:tasks'])).status).toBe(403);
    for (const path of ['/programs', '/cohorts/cycles']) {
      expect((await get(path, ['read:sessions'])).status).toBe(403);
    }
    expect((await get('/schools', ['read:youth_profiles'])).status).toBe(403);
    expect((await get('/reference-data/schools', ['read:tasks'])).status).toBe(403);
  });
});
