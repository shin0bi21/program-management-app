import crypto from 'crypto';
import request from 'supertest';
import { createApp } from '../shared/app';
import { deleteTestUser, seedTestUser, sql } from '../shared/db';
import { generateToken } from '../shared/tokenHelpers';

const app = createApp();

describe('Program cycle assignments', () => {
  let adminId: string;
  let staffId: string;
  let youthId: string;
  let adminToken: string;
  let staffToken: string;
  let programId: string;
  let cycleIds: string[];

  beforeAll(async () => {
    const admin = await seedTestUser({ role: 'admin' });
    const staff = await seedTestUser({ role: 'staff' });
    const youth = await seedTestUser({ role: 'youth' });
    adminId = admin.userId;
    staffId = staff.userId;
    youthId = youth.userId;
    adminToken = generateToken(adminId, 'admin');
    staffToken = generateToken(staffId, 'staff');
    await sql`INSERT INTO youth_profiles (user_id) VALUES (${youthId})`;
  });

  beforeEach(async () => {
    const [program] = await sql<{ id: string }[]>`
      INSERT INTO programs (name) VALUES (${`Assignment ${crypto.randomUUID()}`}) RETURNING id
    `;
    programId = program.id;
    const cycles = await sql<{ id: string }[]>`
      INSERT INTO program_cycles (name, starts_on, ends_on)
      VALUES (${`Assignment A ${crypto.randomUUID()}`}, '2026-01-01', '2026-12-31'),
        (${`Assignment B ${crypto.randomUUID()}`}, '2026-01-01', '2026-12-31')
      RETURNING id
    `;
    cycleIds = cycles.map(cycle => cycle.id);
    await sql`INSERT INTO user_program_assignments (user_id, program_id) VALUES (${staffId}, ${programId})`;
  });

  afterEach(async () => {
    await sql`DELETE FROM time_entries WHERE program_id = ${programId}`;
    await sql`DELETE FROM cohort_enrollments WHERE cohort_id IN (SELECT id FROM program_cohorts WHERE program_id = ${programId})`;
    await sql`DELETE FROM program_cohorts WHERE program_id = ${programId}`;
    await sql`DELETE FROM programs WHERE id = ${programId}`;
    await sql`DELETE FROM program_cycles WHERE id = ANY(${sql.array(cycleIds)}::uuid[])`;
  });

  afterAll(async () => {
    await deleteTestUser(youthId);
    await deleteTestUser(staffId);
    await deleteTestUser(adminId);
  });

  const setCycles = (ids: string[], token = adminToken) => request(app)
    .put(`/api/programs/${programId}/cycles`)
    .set('Authorization', `Bearer ${token}`)
    .send({ cycleIds: ids });

  it('requires write:programs for assignment management while staff retain enrollment and session capabilities', async () => {
    const created = await setCycles([cycleIds[0]]);
    expect(created.status).toBe(200);
    const [cohort] = await sql<{ id: string }[]>`SELECT id FROM program_cohorts WHERE program_id = ${programId}`;

    expect((await setCycles([], staffToken)).status).toBe(403);
    expect((await request(app).post('/api/cohorts').set('Authorization', `Bearer ${staffToken}`)
      .send({ programId, cycleId: cycleIds[1] })).status).toBe(403);
    expect((await request(app).put(`/api/cohorts/${cohort.id}`).set('Authorization', `Bearer ${staffToken}`)
      .send({ cycleId: cycleIds[1] })).status).toBe(403);
    expect((await request(app).delete(`/api/cohorts/${cohort.id}`).set('Authorization', `Bearer ${staffToken}`)).status).toBe(403);

    const enrollmentOnly = generateToken(staffId, 'staff', undefined, ['write:enrollments']);
    const enrolled = await request(app).post(`/api/cohorts/${cohort.id}/enrollments`)
      .set('Authorization', `Bearer ${enrollmentOnly}`).send({ youthIds: [youthId] });
    expect(enrolled.status).toBe(201);
    const denied = await request(app).post(`/api/cohorts/${cohort.id}/enrollments`)
      .set('Authorization', `Bearer ${generateToken(adminId, 'admin', undefined, ['write:programs'])}`)
      .send({ youthIds: [youthId] });
    expect(denied.status).toBe(403);

    const readable = await request(app).get('/api/cohorts')
      .set('Authorization', `Bearer ${generateToken(staffId, 'staff', undefined, ['read:programs'])}`);
    expect(readable.status).toBe(200);
    expect(readable.body).toEqual(expect.arrayContaining([expect.objectContaining({ id: cohort.id })]));
    expect((await request(app).get('/api/cohorts')
      .set('Authorization', `Bearer ${enrollmentOnly}`)).status).toBe(403);
  });

  it('replaces the checked set atomically, preserves existing IDs and unrelated program fields', async () => {
    expect((await setCycles([cycleIds[0]])).status).toBe(200);
    const [original] = await sql<{ id: string }[]>`SELECT id FROM program_cohorts WHERE program_id = ${programId}`;
    await sql`UPDATE programs SET description = 'Unrelated edit' WHERE id = ${programId}`;

    const response = await setCycles(cycleIds);
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ programId, cycleIds: [...cycleIds].sort() });
    expect(await sql`SELECT id FROM program_cohorts WHERE id = ${original.id}`).toHaveLength(1);
    expect((await sql`SELECT description FROM programs WHERE id = ${programId}`)[0].description).toBe('Unrelated edit');
    expect((await setCycles([])).status).toBe(200);
    expect(await sql`SELECT id FROM program_cohorts WHERE program_id = ${programId}`).toHaveLength(0);
  });

  it('validates all IDs before changing the set', async () => {
    await setCycles([cycleIds[0]]);
    expect((await setCycles([cycleIds[1], crypto.randomUUID()])).status).toBe(404);
    expect((await setCycles([cycleIds[0], cycleIds[0]])).status).toBe(400);
    expect((await setCycles(['invalid'])).status).toBe(400);
    const rows = await sql`SELECT cycle_id FROM program_cohorts WHERE program_id = ${programId}`;
    expect(rows).toEqual([expect.objectContaining({ cycleId: cycleIds[0] })]);
  });

  it.each(['sessions', 'enrollments', 'withdrawn enrollments', 'hours'])('preserves %s and rolls back the entire replacement', async dependency => {
    await setCycles([cycleIds[0]]);
    const [cohort] = await sql<{ id: string }[]>`SELECT id FROM program_cohorts WHERE program_id = ${programId}`;
    if (dependency === 'sessions') {
      await sql`INSERT INTO cohort_sessions (cohort_id, theme, starts_at, ends_at)
        VALUES (${cohort.id}, 'History', '2026-10-01T17:00:00Z', '2026-10-01T19:00:00Z')`;
    } else if (dependency === 'hours') {
      await sql`INSERT INTO time_entries (staff_id, program_id, cycle_id, category, work_date, hours, note)
        VALUES (${staffId}, ${programId}, ${cycleIds[0]}, 'planning_prep', '2026-10-01', 1, 'Assignment history')`;
    } else {
      await sql`INSERT INTO cohort_enrollments (cohort_id, youth_id, enrolled_on, withdrawn_on)
        VALUES (${cohort.id}, ${youthId}, '2026-10-01', ${dependency === 'withdrawn enrollments' ? '2026-10-02' : null})`;
    }

    expect((await setCycles([cycleIds[1]])).status).toBe(409);
    expect((await request(app).delete(`/api/cohorts/${cohort.id}`)
      .set('Authorization', `Bearer ${adminToken}`)).status).toBe(409);
    expect(await sql`SELECT id, cycle_id FROM program_cohorts WHERE program_id = ${programId}`)
      .toEqual([expect.objectContaining({ id: cohort.id, cycleId: cycleIds[0] })]);
  });

  it('creates and edits cycle programs atomically while retaining relationship IDs', async () => {
    const name = `Cycle editor ${crypto.randomUUID()}`;
    const created = await request(app).post('/api/cohorts/cycles')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name, startsOn: '2026-01-01', endsOn: '2026-12-31', programIds: [programId] });
    expect(created.status).toBe(201);
    cycleIds.push(created.body.id);
    const [original] = await sql<{ id: string }[]>`SELECT id FROM program_cohorts WHERE cycle_id = ${created.body.id}`;

    const update = (programIds: string[], updatedName = name) => request(app)
      .put(`/api/cohorts/cycles/${created.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: updatedName, startsOn: '2026-01-01', endsOn: '2026-12-31', programIds });
    expect((await update([programId], 'Renamed cycle')).status).toBe(200);
    expect(await sql`SELECT id FROM program_cohorts WHERE id = ${original.id}`).toHaveLength(1);
    expect((await update([crypto.randomUUID()], 'Must roll back')).status).toBe(404);
    expect((await sql`SELECT name FROM program_cycles WHERE id = ${created.body.id}`)[0].name).toBe('Renamed cycle');

    await sql`INSERT INTO cohort_enrollments (cohort_id, youth_id) VALUES (${original.id}, ${youthId})`;
    expect((await update([], 'Must also roll back')).status).toBe(409);
    expect((await sql`SELECT name FROM program_cycles WHERE id = ${created.body.id}`)[0].name).toBe('Renamed cycle');
    await sql`DELETE FROM cohort_enrollments WHERE cohort_id = ${original.id}`;
    expect((await update([])).status).toBe(200);
    expect(await sql`SELECT id FROM program_cohorts WHERE cycle_id = ${created.body.id}`).toHaveLength(0);
  });

  it('rejects invalid cycle programs without creating a partial cycle', async () => {
    const name = `Invalid cycle ${crypto.randomUUID()}`;
    const input = { name, startsOn: '2026-01-01', endsOn: '2026-12-31' };
    expect((await request(app).post('/api/cohorts/cycles')
      .set('Authorization', `Bearer ${adminToken}`).send(input)).status).toBe(400);
    expect((await request(app).post('/api/cohorts/cycles')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ...input, programIds: [programId, crypto.randomUUID()] })).status).toBe(404);
    expect(await sql`SELECT id FROM program_cycles WHERE name = ${name}`).toHaveLength(0);
  });

  it('serializes concurrent checklist replacements into one complete set', async () => {
    const results = await Promise.all([setCycles([cycleIds[0]]), setCycles([cycleIds[1]])]);
    expect(results.map(result => result.status)).toEqual([200, 200]);
    const rows = await sql`SELECT cycle_id FROM program_cohorts WHERE program_id = ${programId}`;
    expect(rows).toHaveLength(1);
    expect(cycleIds).toContain(rows[0].cycleId);
  });
});
