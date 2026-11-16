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
      INSERT INTO programs (title) VALUES (${`Assignment ${crypto.randomUUID()}`}) RETURNING id
    `;
    programId = program.id;
    const cycles = await sql<{ id: string }[]>`
      INSERT INTO program_cycles (title, starts_on, ends_on)
      VALUES (${`Assignment A ${crypto.randomUUID()}`}, '2026-01-01', '2026-12-31'),
        (${`Assignment B ${crypto.randomUUID()}`}, '2026-01-01', '2026-12-31')
      RETURNING id
    `;
    cycleIds = cycles.map(cycle => cycle.id);
    await sql`INSERT INTO user_program_assignments (user_id, program_id) VALUES (${staffId}, ${programId})`;
  });

  afterEach(async () => {
    await sql`DELETE FROM time_entries WHERE program_id = ${programId}`;
    await sql`DELETE FROM program_enrollments WHERE program_id = ${programId}`;
    await sql`DELETE FROM program_sessions WHERE program_id = ${programId}`;
    await sql`DELETE FROM program_cycle_assignments WHERE program_id = ${programId}`;
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

  it('keeps the program cycle lookup ordered by newest cycle first', async () => {
    await sql`UPDATE program_cycles SET starts_on = '2025-01-01' WHERE id = ${cycleIds[0]}`;
    await setCycles(cycleIds);

    const response = await request(app).get('/api/programs/cycle-assignments')
      .query({ programId }).set('Authorization', `Bearer ${staffToken}`);

    expect(response.status).toBe(200);
    expect(response.body.map((pair: { cycleId: string }) => pair.cycleId)).toEqual([cycleIds[1], cycleIds[0]]);
  });

  it('preserves session cascading when an assignment is deleted directly in the database', async () => {
    await setCycles([cycleIds[0]]);
    const [session] = await sql<{ id: string }[]>`
      INSERT INTO program_sessions (program_id, cycle_id, title, date, start_time, end_time)
      VALUES (${programId}, ${cycleIds[0]}, 'Delete behavior', '2026-06-01', '10:00:00', '11:00:00')
      RETURNING id
    `;

    await sql`DELETE FROM program_cycle_assignments WHERE program_id = ${programId} AND cycle_id = ${cycleIds[0]}`;

    const sessions = await sql`SELECT id FROM program_sessions WHERE id = ${session.id}`;
    expect(sessions).toHaveLength(0);
  });

  it('requires write:programs for assignment management while staff retain enrollment and session capabilities', async () => {
    const created = await setCycles([cycleIds[0]]);
    expect(created.status).toBe(200);
    const pair = { programId, cycleId: cycleIds[0] };

    expect((await setCycles([], staffToken)).status).toBe(403);

    const enrollmentOnly = generateToken(staffId, 'staff', undefined, ['write:enrollments']);
    const enrolled = await request(app).post(`/api/programs/${programId}/cycles/${cycleIds[0]}/enrollments`)
      .set('Authorization', `Bearer ${enrollmentOnly}`).send({ youthIds: [youthId] });
    expect(enrolled.status).toBe(201);
    const denied = await request(app).post(`/api/programs/${programId}/cycles/${cycleIds[0]}/enrollments`)
      .set('Authorization', `Bearer ${generateToken(adminId, 'admin', undefined, ['write:programs'])}`)
      .send({ youthIds: [youthId] });
    expect(denied.status).toBe(403);

    const readable = await request(app).get('/api/programs/cycle-assignments')
      .set('Authorization', `Bearer ${generateToken(staffId, 'staff', undefined, ['read:programs'])}`);
    expect(readable.status).toBe(200);
    expect(readable.body).toEqual(expect.arrayContaining([expect.objectContaining(pair)]));
    expect((await request(app).get('/api/programs/cycle-assignments')
      .set('Authorization', `Bearer ${enrollmentOnly}`)).status).toBe(403);
  });

  it('allows project managers to discover and manage unassigned programs, cycles, rosters and sessions', async () => {
    const scopedPrograms = await request(app).get('/api/programs?scope=assigned')
      .set('Authorization', `Bearer ${managerToken}`);
    expect(scopedPrograms.status).toBe(200);
    expect(scopedPrograms.body).toEqual(expect.arrayContaining([expect.objectContaining({ id: programId })]));

    expect((await request(app).put(`/api/programs/${programId}`)
      .set('Authorization', `Bearer ${managerToken}`).send({ title: 'Manager edited program' })).status).toBe(200);
    expect((await setCycles([cycleIds[0]], managerToken)).status).toBe(200);
    const futureYear = new Date().getUTCFullYear() + 1;
    const cycle = await request(app).post('/api/cycles')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ title: `Manager cycle ${crypto.randomUUID()}`, startsOn: `${futureYear}-01-01`, endsOn: `${futureYear}-12-31`, programIds: [programId] });
    expect(cycle.status).toBe(201);
    cycleIds.push(cycle.body.cycle.id);

    const enrolled = await request(app).post(`/api/programs/${programId}/cycles/${cycleIds[0]}/enrollments`)
      .set('Authorization', `Bearer ${managerToken}`).send({ youthIds: [youthId] });
    expect(enrolled.status).toBe(201);
    expect((await request(app).get(`/api/programs/${programId}/cycles/${cycleIds[0]}/roster`)
      .set('Authorization', `Bearer ${managerToken}`)).status).toBe(200);

    const session = await request(app).post('/api/sessions')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ programId, sessionType: 'Regular', title: 'Manager session', date: `${futureYear}-10-01` });
    expect(session.status).toBe(201);
    expect((await request(app).put(`/api/sessions/${session.body.id}/date`)
      .set('Authorization', `Bearer ${managerToken}`).send({ date: `${futureYear}-10-02` })).status).toBe(200);
    expect((await request(app).delete(`/api/sessions/${session.body.id}`)
      .set('Authorization', `Bearer ${managerToken}`)).status).toBe(200);

    expect((await request(app).patch(`/api/programs/${programId}/cycles/${cycleIds[0]}/enrollments/${youthId}/withdraw`)
      .set('Authorization', `Bearer ${managerToken}`)).status).toBe(200);
  });

  it('keeps programming route permissions authoritative for project managers', async () => {
    const reader = generateToken(managerId, 'project_manager', undefined, ['read:programs']);

    expect((await setCycles([cycleIds[0]], reader)).status).toBe(403);
    expect((await request(app).post('/api/cycles').set('Authorization', `Bearer ${reader}`)
      .send({ title: 'Denied', startsOn: '2026-01-01', endsOn: '2026-12-31', programIds: [] })).status).toBe(403);
    expect((await request(app).post('/api/sessions').set('Authorization', `Bearer ${reader}`)
      .send({})).status).toBe(403);
  });

  it('requires program read permission for side-loaded program-cycle projections on assignment and cycle saves', async () => {
    const writer = generateToken(adminId, 'admin', undefined, ['write:programs']);
    const readerWriter = generateToken(adminId, 'admin', undefined, ['write:programs', 'read:programs']);

    const assigned = await setCycles([cycleIds[0]], writer);
    expect(assigned.status).toBe(200);
    expect(assigned.body.createdProgramCycles).toHaveLength(1);
    expect(assigned.body.updatedProgramCycles).toEqual([]);
    expect((await request(app).get('/api/programs/cycle-assignments')
      .set('Authorization', `Bearer ${writer}`)).status).toBe(403);

    const cycleInput = { title: `Write-only cycle ${crypto.randomUUID()}`, startsOn: '2026-01-01', endsOn: '2026-12-31', programIds: [programId] };
    const created = await request(app).post('/api/cycles')
      .set('Authorization', `Bearer ${writer}`).send(cycleInput);
    expect(created.status).toBe(201);
    cycleIds.push(created.body.cycle.id);
    expect(created.body.createdProgramCycles).toHaveLength(1);
    expect(created.body.updatedProgramCycles).toEqual([]);

    const updated = await request(app).put(`/api/cycles/${cycleIds[0]}`)
      .set('Authorization', `Bearer ${writer}`).send({ ...cycleInput, title: `${cycleInput.title} edited` });
    expect(updated.status).toBe(200);
    expect(updated.body.updatedProgramCycles).toEqual([]);

    const readableAssignment = await setCycles([cycleIds[0], created.body.cycle.id], readerWriter);
    expect(readableAssignment.status).toBe(200);
    expect(readableAssignment.body.updatedProgramCycles).toHaveLength(2);

    const readableCycle = await request(app).put(`/api/cycles/${cycleIds[0]}`)
      .set('Authorization', `Bearer ${readerWriter}`).send({ ...cycleInput, title: `${cycleInput.title} edited` });
    expect(readableCycle.status).toBe(200);
    expect(readableCycle.body.updatedProgramCycles).toHaveLength(1);
  });

  it('replaces the checked set atomically, preserves existing pairs and unrelated program fields', async () => {
    expect((await setCycles([cycleIds[0]])).status).toBe(200);
    const pair = { programId, cycleId: cycleIds[0] };
    await sql`UPDATE programs SET description = 'Unrelated edit' WHERE id = ${programId}`;

    const response = await setCycles(cycleIds);
    expect(response.status).toBe(200);
    expect(response.body).toEqual(expect.objectContaining({ programId, cycleIds: [...cycleIds].sort() }));
    expect(response.body.updatedProgramCycles).toEqual(expect.arrayContaining([expect.objectContaining(pair)]));
    expect(response.body.createdProgramCycles).toHaveLength(1);
    expect(await sql`SELECT program_id FROM program_cycle_assignments WHERE program_id = ${programId} AND cycle_id = ${cycleIds[0]}`).toHaveLength(1);
    expect((await sql`SELECT description FROM programs WHERE id = ${programId}`)[0].description).toBe('Unrelated edit');
    expect((await setCycles([])).status).toBe(200);
    expect(await sql`SELECT program_id FROM program_cycle_assignments WHERE program_id = ${programId}`).toHaveLength(0);
  });

  it('validates all IDs before changing the set', async () => {
    await setCycles([cycleIds[0]]);
    expect((await setCycles([cycleIds[1], crypto.randomUUID()])).status).toBe(404);
    expect((await setCycles([cycleIds[0], cycleIds[0]])).status).toBe(400);
    expect((await setCycles(['invalid'])).status).toBe(400);
    const rows = await sql`SELECT cycle_id FROM program_cycle_assignments WHERE program_id = ${programId}`;
    expect(rows).toEqual([expect.objectContaining({ cycleId: cycleIds[0] })]);
  });

  it('returns canonical program-cycle and Youth rows after cycle metadata edits', async () => {
    await setCycles([cycleIds[0]]);
    await sql`INSERT INTO program_enrollments (program_id, cycle_id, youth_id) VALUES (${programId}, ${cycleIds[0]}, ${youthId})`;

    const updated = await request(app).put(`/api/cycles/${cycleIds[0]}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Updated canonical cycle', startsOn: '2026-01-02', endsOn: '2026-12-30', programIds: [programId] });
    expect(updated.status).toBe(200);
    expect(updated.body.updatedProgramCycles).toEqual([expect.objectContaining({
      programId, cycleId: cycleIds[0], cycle: 'Updated canonical cycle', startsOn: '2026-01-02',
    })]);
    expect(updated.body.updatedProgramCycles[0]).not.toHaveProperty('id');
    const youth = await request(app).get('/api/youth').query({ id: youthId })
      .set('Authorization', `Bearer ${adminToken}`);
    expect(updated.body.updatedYouth).toEqual([youth.body]);
  });

  it.each(['sessions', 'enrollments', 'withdrawn enrollments', 'hours'])('preserves %s and rolls back the entire replacement', async dependency => {
    await setCycles([cycleIds[0]]);
    if (dependency === 'sessions') {
      await sql`INSERT INTO program_sessions (program_id, cycle_id, title, date, start_time, end_time)
        VALUES (${programId}, ${cycleIds[0]}, 'History', '2026-10-01', '13:00:00', '15:00:00')`;
    } else if (dependency === 'hours') {
      await sql`INSERT INTO time_entries (staff_id, program_id, cycle_id, category, date, hours, note)
        VALUES (${staffId}, ${programId}, ${cycleIds[0]}, 'planning_prep', '2026-10-01', 1, 'Assignment history')`;
    } else {
      await sql`INSERT INTO program_enrollments (program_id, cycle_id, youth_id, enrolled_on, withdrawn_on)
        VALUES (${programId}, ${cycleIds[0]}, ${youthId}, '2026-10-01', ${dependency === 'withdrawn enrollments' ? '2026-10-02' : null})`;
    }

    expect((await setCycles([cycleIds[1]])).status).toBe(409);
    expect(await sql`SELECT program_id, cycle_id FROM program_cycle_assignments WHERE program_id = ${programId}`)
      .toEqual([expect.objectContaining({ programId, cycleId: cycleIds[0] })]);
  });

  it('creates and edits cycle programs atomically while retaining relationships', async () => {
    const title = `Cycle editor ${crypto.randomUUID()}`;
    const created = await request(app).post('/api/cycles')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title, startsOn: '2026-01-01', endsOn: '2026-12-31', programIds: [programId] });
    expect(created.status).toBe(201);
    cycleIds.push(created.body.cycle.id);
    const cycleId = created.body.cycle.id;

    const update = (programIds: string[], updatedName = title) => request(app)
      .put(`/api/cycles/${created.body.cycle.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: updatedName, startsOn: '2026-01-01', endsOn: '2026-12-31', programIds });
    expect((await update([programId], 'Renamed cycle')).status).toBe(200);
    expect(await sql`SELECT program_id FROM program_cycle_assignments WHERE program_id = ${programId} AND cycle_id = ${cycleId}`).toHaveLength(1);
    expect((await update([crypto.randomUUID()], 'Must roll back')).status).toBe(404);
    expect((await sql`SELECT title FROM program_cycles WHERE id = ${created.body.cycle.id}`)[0].title).toBe('Renamed cycle');

    await sql`INSERT INTO program_enrollments (program_id, cycle_id, youth_id) VALUES (${programId}, ${cycleId}, ${youthId})`;
    expect((await update([], 'Must also roll back')).status).toBe(409);
    expect((await sql`SELECT title FROM program_cycles WHERE id = ${created.body.cycle.id}`)[0].title).toBe('Renamed cycle');
    await sql`DELETE FROM program_enrollments WHERE program_id = ${programId} AND cycle_id = ${cycleId}`;
    expect((await update([])).status).toBe(200);
    expect(await sql`SELECT program_id FROM program_cycle_assignments WHERE cycle_id = ${created.body.cycle.id}`).toHaveLength(0);
  });

  it('rejects invalid cycle programs without creating a partial cycle', async () => {
    const title = `Invalid cycle ${crypto.randomUUID()}`;
    const input = { title, startsOn: '2026-01-01', endsOn: '2026-12-31' };
    expect((await request(app).post('/api/cycles')
      .set('Authorization', `Bearer ${adminToken}`).send(input)).status).toBe(400);
    expect((await request(app).post('/api/cycles')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ...input, programIds: [programId, crypto.randomUUID()] })).status).toBe(404);
    expect(await sql`SELECT id FROM program_cycles WHERE title = ${title}`).toHaveLength(0);
  });

  it('serializes concurrent checklist replacements into one complete set', async () => {
    const results = await Promise.all([setCycles([cycleIds[0]]), setCycles([cycleIds[1]])]);
    expect(results.map(result => result.status)).toEqual([200, 200]);
    const rows = await sql`SELECT cycle_id FROM program_cycle_assignments WHERE program_id = ${programId}`;
    expect(rows).toHaveLength(1);
    expect(cycleIds).toContain(rows[0].cycleId);
  });
});
