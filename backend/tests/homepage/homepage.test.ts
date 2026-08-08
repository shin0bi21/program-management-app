import request from 'supertest';
import sharp from 'sharp';
import { createApp } from '../shared/app';
import { deleteTestUser, seedTestUser, sql } from '../shared/db';
import { generateToken } from '../shared/tokenHelpers';

const app = createApp();

describe('Homepage management API', () => {
  let pngFixture: Buffer;
  let staffId: string;
  let staffToken: string;
  let youthId: string;
  let youthToken: string;
  let cohortId: string;
  let uploadedImageId: string | undefined;

  beforeAll(async () => {
    pngFixture = await sharp({
      create: { width: 8, height: 8, channels: 3, background: '#cc3366' },
    }).png().toBuffer();
    const staff = await seedTestUser({ role: 'staff' });
    staffId = staff.userId;
    staffToken = generateToken(staff.userId, 'staff', staff.email);
    const youth = await seedTestUser({ role: 'youth' });
    youthId = youth.userId;
    youthToken = generateToken(youth.userId, 'youth', youth.email);

    const [program] = await sql<{ id: string }[]>`
      SELECT id FROM programs WHERE name = 'Soft Skills'
    `;
    await sql`
      INSERT INTO staff_program_assignments (staff_id, program_id)
      VALUES (${staffId}, ${program.id})
      ON CONFLICT DO NOTHING
    `;
    const [cohort] = await sql<{ id: string }[]>`
      INSERT INTO program_cohorts (program_id, name, starts_on, ends_on)
      VALUES (
        ${program.id},
        ${`Homepage Test ${Date.now()}`},
        CURRENT_DATE,
        CURRENT_DATE + 30
      )
      RETURNING id
    `;
    cohortId = cohort.id;

    await sql`
      INSERT INTO cohort_sessions (cohort_id, theme, starts_at, ends_at)
      SELECT
        ${cohortId},
        'Homepage Session ' || day_number,
        NOW() + (day_number || ' days')::interval,
        NOW() + (day_number || ' days')::interval + interval '2 hours'
      FROM generate_series(1, 4) AS day_number
    `;
  });

  afterAll(async () => {
    if (uploadedImageId) {
      await request(app).delete(`/api/homepage/images/${uploadedImageId}`).set('Authorization', `Bearer ${staffToken}`);
    }
    await sql`DELETE FROM program_cohorts WHERE id = ${cohortId}`;
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
      .attach('image', pngFixture, {
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

  it('automatically returns the next three sessions for each homepage program', async () => {
    const publicContent = await request(app).get('/api/public/homepage/sessions');
    const [program] = await sql<{ id: string }[]>`SELECT id FROM programs WHERE name = 'Soft Skills'`;
    const expected = await sql<{ id: string }[]>`
      SELECT cs.id
      FROM cohort_sessions cs
      INNER JOIN program_cohorts pc ON pc.id = cs.cohort_id
      WHERE pc.program_id = ${program.id}
        AND cs.ends_at >= NOW()
        AND cs.cancelled_at IS NULL
      ORDER BY cs.starts_at
      LIMIT 3
    `;
    const softSkillsSessions = publicContent.body.sessions.filter(
      (session: { programId: string }) => session.programId === program.id,
    );
    expect(softSkillsSessions.map((session: { id: string }) => session.id))
      .toEqual(expected.map(session => session.id));

    const managed = await request(app).get('/api/homepage').set('Authorization', `Bearer ${staffToken}`);
    expect(managed.status).toBe(200);
    expect(managed.body.sessions).toBeUndefined();
  });

  it('does not allow youth accounts to manage homepage content', async () => {
    const response = await request(app).get('/api/homepage').set('Authorization', `Bearer ${youthToken}`);
    expect(response.status).toBe(403);
  });
});
