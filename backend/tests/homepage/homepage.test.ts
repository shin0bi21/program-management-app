import request from 'supertest';
import sharp from 'sharp';
import { createApp } from '../shared/app';
import { deleteTestProgramCycle, deleteTestUser, seedTestProgramCycle, seedTestUser, sql } from '../shared/db';
import { generateToken } from '../shared/tokenHelpers';

const app = createApp();

describe('Homepage management API', () => {
  let pngFixture: Buffer;
  let staffId: string;
  let staffToken: string;
  let homepageReadToken: string;
  let youthId: string;
  let youthToken: string;
  let programId: string;
  let cycleId: string;
  let uploadedImageId: string | undefined;

  beforeAll(async () => {
    pngFixture = await sharp({
      create: { width: 8, height: 8, channels: 3, background: '#cc3366' },
    }).png().toBuffer();
    const staff = await seedTestUser({ role: 'staff' });
    staffId = staff.userId;
    staffToken = generateToken(staff.userId, 'staff', staff.email);
    homepageReadToken = generateToken(staff.userId, 'staff', staff.email, ['read:homepage']);
    const youth = await seedTestUser({ role: 'youth' });
    youthId = youth.userId;
    youthToken = generateToken(youth.userId, 'youth', youth.email);

    const [program] = await sql<{ id: string }[]>`
      SELECT id FROM programs WHERE name = 'Soft Skills'
    `;
    await sql`
      INSERT INTO user_program_assignments (user_id, program_id)
      VALUES (${staffId}, ${program.id})
      ON CONFLICT DO NOTHING
    `;
    programId = program.id;
    ({ cycleId } = await seedTestProgramCycle({
      programId: program.id,
      name: `Homepage Test ${Date.now()}`,
    }));

    await sql`
      INSERT INTO program_sessions (program_id, cycle_id, theme, starts_at, ends_at)
      SELECT
        ${programId}, ${cycleId},
        'Homepage Session ' || day_number,
        NOW() + (day_number || ' days')::interval,
        NOW() + (day_number || ' days')::interval + interval '2 hours'
      FROM generate_series(1, 4) AS day_number
    `;
  });

  afterAll(async () => {
    await sql`UPDATE homepage_settings SET signup_enabled = TRUE WHERE id = 1`;
    if (uploadedImageId) {
      await request(app).delete(`/api/homepage/images/${uploadedImageId}`).set('Authorization', `Bearer ${staffToken}`);
    }
    await sql`DELETE FROM program_sessions WHERE program_id = ${programId} AND cycle_id = ${cycleId}`;
    await deleteTestProgramCycle(programId, cycleId);
    await deleteTestUser(youthId);
    await deleteTestUser(staffId);
  });

  it('returns seeded hero images publicly without authentication', async () => {
    const response = await request(app).get('/api/public/homepage/images');

    expect(response.status).toBe(200);
    expect(response.body.images).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          imageUrl: '/programming/adventure_bay-display.webp',
          mobileUrl: '/programming/adventure_bay-mobile.webp',
          thumbnailUrl: '/programming/adventure_bay-thumbnail.webp',
        }),
      ]),
    );
  });

  it('lets staff close and reopen homepage signup', async () => {
    const disabled = await request(app)
      .patch('/api/homepage/signup')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ enabled: false });

    expect(disabled.status).toBe(200);
    expect(disabled.body).toEqual({ signupEnabled: false });
    const managed = await request(app)
      .get('/api/homepage/signup')
      .set('Authorization', `Bearer ${staffToken}`);
    expect(managed.body.signupEnabled).toBe(false);
    expect((await request(app).get('/api/public/homepage/signup')).body.signupEnabled).toBe(false);

    const enabled = await request(app)
      .patch('/api/homepage/signup')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ enabled: true });
    expect(enabled.status).toBe(200);
    expect(enabled.body).toEqual({ signupEnabled: true });
  });

  it('allows staff to upload, edit, serve, and delete a homepage image', async () => {
    const originalImageIds = (await request(app).get('/api/public/homepage/images')).body.images.map(
      (image: { id: string }) => image.id,
    );
    const created = await request(app)
      .post('/api/homepage/images')
      .set('Authorization', `Bearer ${staffToken}`)
      .field('caption', 'Youth workshop.')
      .attach('file', pngFixture, {
        filename: 'workshop.png',
        contentType: 'image/png',
      });

    expect(created.status).toBe(201);
    uploadedImageId = created.body.id;

    const updated = await request(app)
      .put(`/api/homepage/images/${uploadedImageId}`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        caption: 'Youth workshop updated.',
      });
    expect(updated.status).toBe(200);

    const publicContent = await request(app).get('/api/public/homepage/images');
    expect(publicContent.body.images).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: uploadedImageId,
          imageUrl: `/public/homepage/images/${uploadedImageId}/display`,
          mobileUrl: `/public/homepage/images/${uploadedImageId}/mobile`,
          thumbnailUrl: `/public/homepage/images/${uploadedImageId}/thumbnail`,
          caption: 'Youth workshop updated.',
          altText: 'Youth workshop updated.',
        }),
      ]),
    );

    const reversedImageIds = publicContent.body.images.map((image: { id: string }) => image.id).reverse();
    const reordered = await request(app)
      .put('/api/homepage/images/order')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ imageIds: reversedImageIds });
    expect(reordered.status).toBe(200);
    expect(reordered.body.imageIds).toEqual(reversedImageIds);
    expect((await request(app).get('/api/public/homepage/images')).body.images[0].id).toBe(reversedImageIds[0]);

    const file = await request(app).get(`/api/public/homepage/images/${uploadedImageId}/file`);
    expect(file.status).toBe(200);
    const thumbnail = await request(app).get(`/api/public/homepage/images/${uploadedImageId}/thumbnail`);
    const mobile = await request(app).get(`/api/public/homepage/images/${uploadedImageId}/mobile`);
    const display = await request(app).get(`/api/public/homepage/images/${uploadedImageId}/display`);
    expect(thumbnail.status).toBe(200);
    expect(mobile.status).toBe(200);
    expect(display.status).toBe(200);
    expect(thumbnail.headers['content-type']).toBe('image/webp');
    expect(mobile.headers['content-type']).toBe('image/webp');
    expect(display.headers['content-type']).toBe('image/webp');

    const deleted = await request(app)
      .delete(`/api/homepage/images/${uploadedImageId}`)
      .set('Authorization', `Bearer ${staffToken}`);
    expect(deleted.status).toBe(200);
    uploadedImageId = undefined;

    const restored = await request(app)
      .put('/api/homepage/images/order')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ imageIds: originalImageIds });
    expect(restored.status).toBe(200);

    expect((await request(app).get(`/api/public/homepage/images/${created.body.id}/file`)).status).toBe(404);
    expect((await request(app).get(`/api/public/homepage/images/${created.body.id}/thumbnail`)).status).toBe(404);
    expect((await request(app).get(`/api/public/homepage/images/${created.body.id}/display`)).status).toBe(404);
  });

  it('returns every program with its next three sessions in age order', async () => {
    const publicContent = await request(app).get('/api/public/homepage/programs');
    const [program] = await sql<{ id: string }[]>`SELECT id FROM programs WHERE name = 'Soft Skills'`;
    const orderedPrograms = await sql<{ id: string }[]>`
      SELECT id
      FROM programs
      ORDER BY min_age ASC NULLS FIRST, name
    `;
    const expected = await sql<{ id: string }[]>`
      SELECT cs.id
      FROM program_sessions cs
      WHERE cs.program_id = ${program.id}
        AND cs.ends_at >= NOW()
        AND cs.cancelled_at IS NULL
      ORDER BY cs.starts_at
      LIMIT 3
    `;
    expect(publicContent.status).toBe(200);
    expect(publicContent.body.programs.map((item: { id: string }) => item.id))
      .toEqual(orderedPrograms.map(item => item.id));
    const softSkills = publicContent.body.programs.find(
      (item: { id: string }) => item.id === program.id,
    );
    expect(softSkills).toEqual(expect.objectContaining({
      name: 'Soft Skills',
      enrollmentRequired: true,
      minAge: 12,
      maxAge: 15,
    }));
    expect(softSkills.sessions.map((session: { id: string }) => session.id))
      .toEqual(expected.map(session => session.id));
    expect(publicContent.body.programs).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'Job Readiness', sessions: expect.any(Array) }),
    ]));

    const managed = await request(app).get('/api/homepage').set('Authorization', `Bearer ${staffToken}`);
    expect(managed.status).toBe(200);
    expect(managed.body.programs).toBeUndefined();
  });

  it('does not allow youth accounts to manage homepage content', async () => {
    const response = await request(app).get('/api/homepage').set('Authorization', `Bearer ${youthToken}`);
    expect(response.status).toBe(403);
  });

  it('lets read-only staff view signup status separately from photos', async () => {
    const signup = await request(app)
      .get('/api/homepage/signup')
      .set('Authorization', `Bearer ${homepageReadToken}`);
    const photos = await request(app)
      .get('/api/homepage')
      .set('Authorization', `Bearer ${homepageReadToken}`);

    expect(signup.status).toBe(200);
    expect(signup.body).toEqual({ signupEnabled: true });
    expect(photos.status).toBe(200);
    expect(photos.body.signupEnabled).toBeUndefined();
    expect((await request(app).get('/api/public/homepage/images')).body.signupEnabled).toBeUndefined();
  });

  it('requires homepage write permission to change signup availability', async () => {
    const update = await request(app)
      .patch('/api/homepage/signup')
      .set('Authorization', `Bearer ${homepageReadToken}`)
      .send({ enabled: false });
    expect(update.status).toBe(403);
  });
});
