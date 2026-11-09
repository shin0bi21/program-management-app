import request from 'supertest';
import { createApp } from '../shared/app';
import { deleteTestProgramCycle, deleteTestUser, seedTestProgramCycle, seedTestUser, sql } from '../shared/db';
import { generateToken } from '../shared/tokenHelpers';

const app = createApp();

describe('Programs API', () => {
  let staffUserId: string;
  let staffToken: string;
  let youthUserId: string;
  let youthToken: string;
  let adminUserId: string;
  let adminToken: string;
  let softSkillsProgramId: string;
  let createdProgramId: string;
  const createdName = `Leadership ${Date.now()}`;

  beforeAll(async () => {
    const staff = await seedTestUser({ email: `program-staff-${Date.now()}@test.local`, role: 'staff' });
    staffUserId = staff.userId;
    staffToken = generateToken(staff.userId, 'staff', staff.email);
    const youth = await seedTestUser({ email: `program-youth-${Date.now()}@test.local`, role: 'youth' });
    youthUserId = youth.userId;
    youthToken = generateToken(youth.userId, 'youth', youth.email);
    const admin = await seedTestUser({ email: `program-admin-${Date.now()}@test.local`, role: 'admin' });
    adminUserId = admin.userId;
    adminToken = generateToken(admin.userId, 'admin', admin.email);

    const [softSkills] = await sql<{ id: string }[]>`
      SELECT id FROM programs WHERE name = 'Soft Skills'
    `;
    softSkillsProgramId = softSkills.id;
    await sql`
      INSERT INTO user_program_assignments (user_id, program_id)
      VALUES (${staffUserId}, ${softSkillsProgramId})
    `;
  });

  afterAll(async () => {
    if (createdProgramId) await sql`DELETE FROM programs WHERE id = ${createdProgramId}`;
    await deleteTestUser(adminUserId);
    await deleteTestUser(youthUserId);
    await deleteTestUser(staffUserId);
  });

  it('allows admins to create a program', async () => {
    const res = await request(app)
      .post('/api/programs')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: ` ${createdName} `,
        enrollmentRequired: false,
        minAge: 14,
        maxAge: 18,
        defaultDayOfWeek: 'wednesday',
        defaultStartTime: '17:30',
        defaultEndTime: '19:30',
        timezone: 'America/Toronto',
      });

    expect(res.status).toBe(201);
    expect(res.body.program).toEqual(expect.objectContaining({
      id: expect.any(String),
      name: createdName,
      enrollmentRequired: false,
      minAge: 14,
      maxAge: 18,
      defaultDayOfWeek: 'wednesday',
      defaultStartTime: '17:30',
      defaultEndTime: '19:30',
      timezone: 'America/Toronto',
    }));
    createdProgramId = res.body.program.id;
  });

  it('allows admins to edit a program', async () => {
    const res = await request(app)
      .put(`/api/programs/${createdProgramId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: createdName,
        description: 'Updated program description',
        enrollmentRequired: true,
        minAge: 15,
        maxAge: 19,
      });

    expect(res.status).toBe(200);
    expect(res.body.program).toEqual(expect.objectContaining({
      id: createdProgramId,
      description: 'Updated program description',
      enrollmentRequired: true,
      minAge: 15,
      maxAge: 19,
    }));
  });

  it('returns canonical retained program cycles and youth memberships after a program edit without expanding read capabilities', async () => {
    const [program] = await sql<{ id: string }[]>`INSERT INTO programs (name) VALUES (${`Program envelope ${Date.now()}`}) RETURNING id`;
    const [dates] = await sql<{ startsOn: string; endsOn: string }[]>`
      SELECT ((NOW() AT TIME ZONE 'America/Toronto')::date - 30)::text AS starts_on,
        ((NOW() AT TIME ZONE 'America/Toronto')::date + 30)::text AS ends_on
    `;
    const { cycleId } = await seedTestProgramCycle({ programId: program.id, ...dates });
    const youth = await seedTestUser({ role: 'youth', firstName: 'Envelope', lastName: 'Youth' });
    await sql`INSERT INTO youth_profiles (user_id) VALUES (${youth.userId})`;
    await sql`INSERT INTO program_enrollments (program_id, cycle_id, youth_id) VALUES (${program.id}, ${cycleId}, ${youth.userId})`;
    const name = `Renamed program ${Date.now()}`;

    try {
      const saved = await request(app).put(`/api/programs/${program.id}`).set('Authorization', `Bearer ${adminToken}`)
        .send({ name, enrollmentRequired: true, minAge: 13, maxAge: 18 });
      expect(saved.status).toBe(200);
      const programCycles = await request(app).get('/api/programs/cycle-assignments').query({ programId: program.id })
        .set('Authorization', `Bearer ${adminToken}`);
      const youthRows = await request(app).get('/api/youth').query({ search: 'Envelope Youth', limit: 50 })
        .set('Authorization', `Bearer ${adminToken}`);
      expect(programCycles.status).toBe(200);
      expect(youthRows.status).toBe(200);
      expect(saved.body.updatedProgramCycles).toEqual(programCycles.body);
      expect(saved.body.updatedProgramCycles[0]).toMatchObject({ programId: program.id, program: name, minAge: 13, maxAge: 18 });
      expect(saved.body.updatedYouth).toEqual(youthRows.body.rows);
      expect(saved.body.updatedYouth[0].activeProgram).toEqual(expect.objectContaining({ programId: program.id, program: name }));
      expect(saved.body.removedProgramCycles).toEqual([]);
      expect(saved.body.createdProgramCycles).toEqual([]);

      const writer = generateToken(adminUserId, 'admin', undefined, ['write:programs']);
      const restricted = await request(app).put(`/api/programs/${program.id}`).set('Authorization', `Bearer ${writer}`)
        .send({ name, enrollmentRequired: true, minAge: 13, maxAge: 18 });
      expect(restricted.status).toBe(200);
      expect(restricted.body.updatedProgramCycles).toEqual([]);
      expect(restricted.body.updatedYouth).toEqual([]);
    } finally {
      await sql`DELETE FROM program_enrollments WHERE youth_id = ${youth.userId}`;
      await deleteTestUser(youth.userId);
      await deleteTestProgramCycle(program.id, cycleId);
      await sql`DELETE FROM programs WHERE id = ${program.id}`;
    }
  });

  it('rejects program creation by staff', async () => {
    const res = await request(app)
      .post('/api/programs')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ name: 'Staff Program' });

    expect(res.status).toBe(403);
  });

  it('defaults new programs to requiring enrollment', async () => {
    const response = await request(app)
      .post('/api/programs')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: `Default enrollment ${Date.now()}` });

    expect(response.status).toBe(201);

    try {
      expect(response.body.program.enrollmentRequired).toBe(true);
      expect(response.body.program).not.toHaveProperty('rosterMode');

      const [stored] = await sql`SELECT enrollment_required FROM programs WHERE id = ${response.body.program.id}`;
      expect(stored.enrollmentRequired).toBe(true);
    } finally {
      await sql`DELETE FROM programs WHERE id = ${response.body.program.id}`;
    }
  });

  it.each(['yes', 'enrolled', 1, null])('rejects non-boolean enrollment requirement %p', async (enrollmentRequired) => {
    const response = await request(app)
      .post('/api/programs')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Invalid enrollment requirement', enrollmentRequired });

    expect(response.status).toBe(400);
  });

  it('rejects the removed roster mode request field', async () => {
    const response = await request(app)
      .post('/api/programs')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Obsolete enrollment request', rosterMode: 'open' });

    expect(response.status).toBe(400);
  });

  it('rejects program edits by staff', async () => {
    const res = await request(app)
      .put(`/api/programs/${softSkillsProgramId}`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ name: 'Staff Program', enrollmentRequired: true });

    expect(res.status).toBe(403);
  });

  it('requires a complete valid age range', async () => {
    const missingMaximum = await request(app)
      .post('/api/programs')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Incomplete Age Range', minAge: 12 });
    const reversedRange = await request(app)
      .post('/api/programs')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Reversed Age Range', minAge: 19, maxAge: 16 });

    expect(missingMaximum.status).toBe(400);
    expect(reversedRange.status).toBe(400);
  });

  it('rejects invalid scheduling defaults', async () => {
    for (const defaults of [
      { defaultStartTime: '25:00' },
      { defaultStartTime: '20:00', defaultEndTime: '19:00' },
      { defaultDayOfWeek: 'holiday' },
      { timezone: 'America/Vancouver' },
    ]) {
      const response = await request(app).post('/api/programs')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Invalid scheduling defaults', ...defaults });
      expect(response.status).toBe(400);
    }
  });

  it('rejects unsupported timezones at the database boundary', async () => {
    await expect(sql`UPDATE programs SET timezone = 'torotto' WHERE id = ${createdProgramId}`)
      .rejects.toMatchObject({ code: '22P02' });

    const [program] = await sql`SELECT timezone FROM programs WHERE id = ${createdProgramId}`;
    expect(program.timezone).toBe('America/Toronto');
  });

  it('returns only assigned programs to staff', async () => {
    const res = await request(app)
      .get('/api/programs?scope=assigned')
      .set('Authorization', `Bearer ${staffToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: expect.any(String),
        name: 'Soft Skills',
        minAge: 12,
        maxAge: 15,
      }),
    ]));
    expect(res.body).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'Job Readiness', minAge: 16, maxAge: 19 }),
      expect.objectContaining({ name: 'Drop In', enrollmentRequired: false }),
    ]));
  });

  it('keeps the full program lookup available outside Programming', async () => {
    const res = await request(app)
      .get('/api/programs')
      .set('Authorization', `Bearer ${staffToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'Soft Skills' }),
      expect.objectContaining({ name: 'Job Readiness' }),
      expect.objectContaining({ name: 'Drop In' }),
    ]));
  });

  it('rejects accounts without program lookup permission', async () => {
    const res = await request(app)
      .get('/api/programs')
      .set('Authorization', `Bearer ${youthToken}`);

    expect(res.status).toBe(403);
  });
});
