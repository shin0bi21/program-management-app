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
  let sessionIds: string[];

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
      SELECT id
      FROM programs
      WHERE title = 'Soft Skills'
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

    const sessions = await sql<{ id: string; title: string }[]>`
      INSERT INTO program_sessions (program_id, cycle_id, title, date, start_time, end_time)
      SELECT
        ${programId}, ${cycleId},
        'Homepage Session ' || day_number,
        CURRENT_DATE + day_number, TIME '17:00', TIME '19:00'
      FROM generate_series(1, 4) AS day_number
      RETURNING id, title
    `;
    sessionIds = sessions.sort((first, second) => first.title.localeCompare(second.title)).map(session => session.id);
  });

  afterAll(async () => {
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
    expect(created.body).toEqual({
      id: expect.any(String),
      altText: 'Youth workshop.',
      caption: 'Youth workshop.',
      displayOrder: expect.any(Number),
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
      imageUrl: `/public/homepage/images/${uploadedImageId}/display`,
      mobileUrl: `/public/homepage/images/${uploadedImageId}/mobile`,
      thumbnailUrl: `/public/homepage/images/${uploadedImageId}/thumbnail`,
    });
    const createdList = await request(app).get('/api/public/homepage/images');
    expect(createdList.body.images).toContainEqual(created.body);

    const updated = await request(app)
      .put(`/api/homepage/images/${uploadedImageId}`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        caption: 'Youth workshop updated.',
      });
    expect(updated.status).toBe(200);
    expect(updated.body).toEqual({
      ...created.body,
      altText: 'Youth workshop updated.',
      caption: 'Youth workshop updated.',
      updatedAt: expect.any(String),
    });

    const publicContent = await request(app).get('/api/public/homepage/images');
    expect(publicContent.body.images).toContainEqual(updated.body);
    const managedContent = await request(app).get('/api/homepage')
      .set('Authorization', `Bearer ${staffToken}`);
    expect(managedContent.status).toBe(200);
    expect(managedContent.body.images).toContainEqual(updated.body);

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
    const [program] = await sql<{ id: string }[]>`
      SELECT id
      FROM programs
      WHERE title = 'Soft Skills'
    `;
    const programs = await sql<{ id: string; title: string }[]>`
      SELECT id, title
      FROM programs
    `;
    const programIdsByName = new Map(programs.map(item => [item.title, item.id]));
    const expectedProgramIds = ['Drop In', 'Soft Skills', 'Job Readiness'].map(name => programIdsByName.get(name));
    expect(publicContent.status).toBe(200);
    expect(publicContent.body.programs.map((item: { id: string }) => item.id))
      .toEqual(expectedProgramIds);
    const softSkills = publicContent.body.programs.find(
      (item: { id: string }) => item.id === program.id,
    );
    expect(softSkills).toEqual(expect.objectContaining({
      title: 'Soft Skills',
      enrollmentRequired: true,
      minAge: 12,
      maxAge: 15,
    }));
    expect(softSkills.sessions.map((session: { id: string }) => session.id))
      .toEqual(sessionIds.slice(0, 3));
    expect(publicContent.body.programs).toEqual(expect.arrayContaining([
      expect.objectContaining({ title: 'Job Readiness', sessions: expect.any(Array) }),
    ]));

    const managed = await request(app).get('/api/homepage').set('Authorization', `Bearer ${staffToken}`);
    expect(managed.status).toBe(200);
    expect(managed.body.programs).toBeUndefined();
  });

  it('does not allow youth accounts to manage homepage content', async () => {
    const response = await request(app).get('/api/homepage').set('Authorization', `Bearer ${youthToken}`);
    expect(response.status).toBe(403);
  });

  it('lets read-only staff view managed photos', async () => {
    const photos = await request(app)
      .get('/api/homepage')
      .set('Authorization', `Bearer ${homepageReadToken}`);

    expect(photos.status).toBe(200);
    expect(photos.body.images).toEqual(expect.any(Array));
  });

  it('requires homepage write permission to upload photos', async () => {
    const response = await request(app)
      .post('/api/homepage/images')
      .set('Authorization', `Bearer ${homepageReadToken}`);

    expect(response.status).toBe(403);
  });
});
