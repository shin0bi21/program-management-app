import crypto from 'crypto';
import request from 'supertest';
import { createApp } from '../shared/app';
import { deleteTestUser, seedTestUser, sql } from '../shared/db';
import { generateToken } from '../shared/tokenHelpers';

const app = createApp();

describe('Program cycle assignments', () => {
  let adminId: string;
  let staffId: string;
  let managerId: string;
  let managerToken: string;
  let youthId: string;
  let adminToken: string;
  let staffToken: string;
  let programId: string;
  let cycleIds: string[];

  beforeAll(async () => {
    const admin = await seedTestUser({ role: 'admin' });
    const staff = await seedTestUser({ role: 'staff' });
    const youth = await seedTestUser({ role: 'youth' });
    const manager = await seedTestUser({ role: 'project_manager' });
    managerId = manager.userId;
    managerToken = generateToken(managerId, 'project_manager');
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
    await deleteTestUser(managerId);
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

  it('allows project managers to discover and manage unassigned programs, cycles, rosters and sessions', async () => {
    const scopedPrograms = await request(app).get('/api/programs?scope=assigned')
      .set('Authorization', `Bearer ${managerToken}`);
    expect(scopedPrograms.status).toBe(200);
    expect(scopedPrograms.body).toEqual(expect.arrayContaining([expect.objectContaining({ id: programId })]));

    expect((await request(app).put(`/api/programs/${programId}`)
      .set('Authorization', `Bearer ${managerToken}`).send({ name: 'Manager edited program' })).status).toBe(200);
    expect((await setCycles([cycleIds[0]], managerToken)).status).toBe(200);
    const [cohort] = await sql<{ id: string }[]>`SELECT id FROM program_cohorts WHERE program_id = ${programId}`;

    const futureYear = new Date().getUTCFullYear() + 1;
    const cycle = await request(app).post('/api/cohorts/cycles')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ name: `Manager cycle ${crypto.randomUUID()}`, startsOn: `${futureYear}-01-01`, endsOn: `${futureYear}-12-31`, programIds: [programId] });
    expect(cycle.status).toBe(201);
    cycleIds.push(cycle.body.cycle.id);

    const enrolled = await request(app).post(`/api/cohorts/${cohort.id}/enrollments`)
      .set('Authorization', `Bearer ${managerToken}`).send({ youthIds: [youthId] });
    expect(enrolled.status).toBe(201);
    expect((await request(app).get(`/api/cohorts/${cohort.id}/roster`)
      .set('Authorization', `Bearer ${managerToken}`)).status).toBe(200);

    const session = await request(app).post('/api/cohorts/sessions')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ programId, sessionTypeId: '00000000-0000-4000-8000-000000000001', theme: 'Manager session', date: `${futureYear}-10-01` });
    expect(session.status).toBe(201);
    expect((await request(app).put(`/api/cohorts/sessions/${session.body.id}/date`)
      .set('Authorization', `Bearer ${managerToken}`).send({ date: `${futureYear}-10-02` })).status).toBe(200);
    expect((await request(app).delete(`/api/cohorts/sessions/${session.body.id}`)
      .set('Authorization', `Bearer ${managerToken}`)).status).toBe(200);

    expect((await request(app).patch(`/api/cohorts/${cohort.id}/enrollments/${youthId}/withdraw`)
      .set('Authorization', `Bearer ${managerToken}`)).status).toBe(200);
  });

  it('keeps programming route permissions authoritative for project managers', async () => {
    const reader = generateToken(managerId, 'project_manager', undefined, ['read:programs']);

    expect((await setCycles([cycleIds[0]], reader)).status).toBe(403);
    expect((await request(app).post('/api/cohorts/cycles').set('Authorization', `Bearer ${reader}`)
      .send({ name: 'Denied', startsOn: '2026-01-01', endsOn: '2026-12-31', programIds: [] })).status).toBe(403);
    expect((await request(app).post('/api/cohorts/sessions').set('Authorization', `Bearer ${reader}`)
      .send({})).status).toBe(403);
  });

  it('requires program read permission for side-loaded cohort projections on assignment and cycle saves', async () => {
    const writer = generateToken(adminId, 'admin', undefined, ['write:programs']);
    const readerWriter = generateToken(adminId, 'admin', undefined, ['write:programs', 'read:programs']);

    const assigned = await setCycles([cycleIds[0]], writer);
    expect(assigned.status).toBe(200);
    expect(assigned.body.createdCohortIds).toHaveLength(1);
    expect(assigned.body.updatedCohorts).toEqual([]);
    expect((await request(app).get('/api/cohorts')
      .set('Authorization', `Bearer ${writer}`)).status).toBe(403);

    const cycleInput = { name: `Write-only cycle ${crypto.randomUUID()}`, startsOn: '2026-01-01', endsOn: '2026-12-31', programIds: [programId] };
    const created = await request(app).post('/api/cohorts/cycles')
      .set('Authorization', `Bearer ${writer}`).send(cycleInput);
    expect(created.status).toBe(201);
    cycleIds.push(created.body.cycle.id);
    expect(created.body.createdCohortIds).toHaveLength(1);
    expect(created.body.updatedCohorts).toEqual([]);

    const updated = await request(app).put(`/api/cohorts/cycles/${cycleIds[0]}`)
      .set('Authorization', `Bearer ${writer}`).send({ ...cycleInput, name: `${cycleInput.name} edited` });
    expect(updated.status).toBe(200);
    expect(updated.body.updatedCohorts).toEqual([]);

    const readableAssignment = await setCycles([cycleIds[0], created.body.cycle.id], readerWriter);
    expect(readableAssignment.status).toBe(200);
    expect(readableAssignment.body.updatedCohorts).toHaveLength(2);

    const readableCycle = await request(app).put(`/api/cohorts/cycles/${cycleIds[0]}`)
      .set('Authorization', `Bearer ${readerWriter}`).send({ ...cycleInput, name: `${cycleInput.name} edited` });
    expect(readableCycle.status).toBe(200);
    expect(readableCycle.body.updatedCohorts).toHaveLength(1);
  });

  it('replaces the checked set atomically, preserves existing IDs and unrelated program fields', async () => {
    expect((await setCycles([cycleIds[0]])).status).toBe(200);
    const [original] = await sql<{ id: string }[]>`SELECT id FROM program_cohorts WHERE program_id = ${programId}`;
    await sql`UPDATE programs SET description = 'Unrelated edit' WHERE id = ${programId}`;

    const response = await setCycles(cycleIds);
    expect(response.status).toBe(200);
    expect(response.body).toEqual(expect.objectContaining({ programId, cycleIds: [...cycleIds].sort() }));
    expect(response.body.updatedCohorts).toEqual(expect.arrayContaining([expect.objectContaining({ id: original.id })]));
    expect(response.body.createdCohortIds).toHaveLength(1);
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

  it('returns canonical cohort and Youth rows after cycle metadata and reassignment edits', async () => {
    await setCycles([cycleIds[0]]);
    const [cohort] = await sql<{ id: string }[]>`SELECT id FROM program_cohorts WHERE program_id = ${programId}`;
    await sql`INSERT INTO cohort_enrollments (cohort_id, youth_id) VALUES (${cohort.id}, ${youthId})`;

    const updatedCycle = await request(app).put(`/api/cohorts/cycles/${cycleIds[0]}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Updated canonical cycle', startsOn: '2026-01-02', endsOn: '2026-12-30', programIds: [programId] });
    expect(updatedCycle.status).toBe(200);
    expect(updatedCycle.body.cycle).toEqual(expect.objectContaining({ id: cycleIds[0], state: expect.any(String) }));
    expect(updatedCycle.body.updatedCohorts).toEqual([expect.objectContaining({ id: cohort.id, name: 'Updated canonical cycle', startsOn: '2026-01-02' })]);
    const cycleYouth = await request(app).get('/api/youth').query({ id: youthId })
      .set('Authorization', `Bearer ${adminToken}`);
    expect(updatedCycle.body.updatedYouth).toEqual([cycleYouth.body]);

    const reassigned = await request(app).put(`/api/cohorts/${cohort.id}`)
      .set('Authorization', `Bearer ${adminToken}`).send({ cycleId: cycleIds[1] });
    expect(reassigned.status).toBe(200);
    const listed = await request(app).get('/api/cohorts').query({ programId, limit: 25 })
      .set('Authorization', `Bearer ${adminToken}`);
    expect(reassigned.body.cohort).toEqual(listed.body.rows[0]);
    const reassignedYouth = await request(app).get('/api/youth').query({ id: youthId })
      .set('Authorization', `Bearer ${adminToken}`);
    expect(reassigned.body.updatedYouth).toEqual([reassignedYouth.body]);

    const programOnly = generateToken(adminId, 'admin', undefined, ['write:programs']);
    const restricted = await request(app).put(`/api/cohorts/${cohort.id}`)
      .set('Authorization', `Bearer ${programOnly}`).send({ cycleId: cycleIds[1] });
    expect(restricted.status).toBe(200);
    expect(restricted.body.updatedYouth).toEqual([]);
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
    cycleIds.push(created.body.cycle.id);
    const [original] = await sql<{ id: string }[]>`SELECT id FROM program_cohorts WHERE cycle_id = ${created.body.cycle.id}`;

    const update = (programIds: string[], updatedName = name) => request(app)
      .put(`/api/cohorts/cycles/${created.body.cycle.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: updatedName, startsOn: '2026-01-01', endsOn: '2026-12-31', programIds });
    expect((await update([programId], 'Renamed cycle')).status).toBe(200);
    expect(await sql`SELECT id FROM program_cohorts WHERE id = ${original.id}`).toHaveLength(1);
    expect((await update([crypto.randomUUID()], 'Must roll back')).status).toBe(404);
    expect((await sql`SELECT name FROM program_cycles WHERE id = ${created.body.cycle.id}`)[0].name).toBe('Renamed cycle');

    await sql`INSERT INTO cohort_enrollments (cohort_id, youth_id) VALUES (${original.id}, ${youthId})`;
    expect((await update([], 'Must also roll back')).status).toBe(409);
    expect((await sql`SELECT name FROM program_cycles WHERE id = ${created.body.cycle.id}`)[0].name).toBe('Renamed cycle');
    await sql`DELETE FROM cohort_enrollments WHERE cohort_id = ${original.id}`;
    expect((await update([])).status).toBe(200);
    expect(await sql`SELECT id FROM program_cohorts WHERE cycle_id = ${created.body.cycle.id}`).toHaveLength(0);
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
