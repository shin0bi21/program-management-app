import { randomUUID } from 'crypto';
import request from 'supertest';
import { createApp } from '../shared/app';
import { deleteTestProgramCycle, deleteTestUser, seedTestProgramCycle, seedTestUser, sql } from '../shared/db';
import { generateToken } from '../shared/tokenHelpers';

const app = createApp();
const missingId = '00000000-0000-4000-8000-000000000000';

describe('Program authorization before missing-record responses', () => {
  const users: string[] = [];
  const tokens: Record<string, string> = {};
  let programId: string;
  let cycleId: string;
  let sessionId: string;
  let noPermissionToken: string;

  beforeAll(async () => {
    for (const [name, role] of [
      ['admin', 'admin'], ['manager', 'project_manager'], ['assigned', 'staff'], ['unassigned', 'staff'],
    ] as const) {
      const user = await seedTestUser({ role });
      users.push(user.userId);
      tokens[name] = generateToken(user.userId, role);
      if (name === 'admin') noPermissionToken = generateToken(user.userId, role, user.email, []);
      if (name === 'assigned') {
        const [program] = await sql`INSERT INTO programs (title) VALUES (${`Access ${randomUUID()}`}) RETURNING id`;
        programId = program.id;
        await sql`INSERT INTO user_program_assignments (user_id, program_id) VALUES (${user.userId}, ${programId})`;
      }
    }
    const pair = await seedTestProgramCycle({ programId });
    cycleId = pair.cycleId;
    const [session] = await sql`
      INSERT INTO program_sessions (program_id, cycle_id, title, date, start_time, end_time)
      VALUES (${programId}, ${cycleId}, 'Access checks', '2026-06-01', '10:00:00', '11:00:00')
      RETURNING id
    `;
    sessionId = session.id;
  });

  afterAll(async () => {
    if (sessionId) await sql`DELETE FROM program_sessions WHERE id = ${sessionId}`;
    if (cycleId) await deleteTestProgramCycle(programId, cycleId);
    if (programId) await sql`DELETE FROM programs WHERE id = ${programId}`;
    for (const id of users) await deleteTestUser(id);
  });

  it.each([
    ['admin', 404], ['manager', 404], ['assigned', 403], ['unassigned', 403],
  ])('returns the authorized missing-program result for %s', async (actor, status) => {
    const response = await request(app).post('/api/sessions')
      .set('Authorization', `Bearer ${tokens[actor]}`)
      .send({ programId: missingId, sessionType: 'Regular',
        title: 'Missing program', date: '2026-06-01' });

    expect(response.status).toBe(status);
  });

  it.each([
    ['admin', 404], ['manager', 404], ['assigned', 404], ['unassigned', 403],
  ])('uses known parent authority for a missing cycle requested by %s', async (actor, status) => {
    const response = await request(app)
      .get(`/api/programs/${programId}/cycles/${missingId}/roster`)
      .set('Authorization', `Bearer ${tokens[actor]}`);

    expect(response.status).toBe(status);
    if (status === 404) expect(response.body.error).toBe('Program cycle not found');
  });

  it.each([
    ['admin', 200, 404], ['manager', 200, 404], ['assigned', 200, 403], ['unassigned', 403, 403],
  ])('preserves session visibility and missing-parent authority for %s', async (actor, existingStatus, missingStatus) => {
    const existing = await request(app).get(`/api/sessions/${sessionId}/notes`)
      .set('Authorization', `Bearer ${tokens[actor]}`);
    const missing = await request(app).get(`/api/sessions/${missingId}/notes`)
      .set('Authorization', `Bearer ${tokens[actor]}`);

    expect(existing.status).toBe(existingStatus);
    expect(missing.status).toBe(missingStatus);
  });

  it('rejects missing route capability before revealing existing or missing targets', async () => {
    for (const id of [sessionId, missingId]) {
      const response = await request(app).get(`/api/sessions/${id}/notes`)
        .set('Authorization', `Bearer ${noPermissionToken}`);
      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Insufficient permissions');
    }
  });
});
