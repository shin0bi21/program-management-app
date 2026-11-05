import { sql } from '../../src/db/client';

interface TestDefaults {
  programIds: string[];
  imageIds: string[];
}

export async function seedTestDefaults(): Promise<TestDefaults> {
  // These shared examples used to arrive through historical migrations. Keep
  // test data independent of the business records chosen for a fresh install.
  const programs = await sql<{ id: string }[]>`
    INSERT INTO programs (name, enrollment_required, min_age, max_age)
    VALUES
      ('Soft Skills', TRUE, 12, 15),
      ('Job Readiness', TRUE, 16, 19),
      ('Drop In', FALSE, NULL, NULL)
    ON CONFLICT (name) DO NOTHING
    RETURNING id
  `;

  const images = await sql<{ id: string }[]>`
    INSERT INTO homepage_images (id, public_path, alt_text, caption, display_order)
    VALUES (
      '00000000-0000-4000-8000-000000000100',
      '/programming/adventure_bay.png',
      'Test youth group trip',
      'Test homepage image',
      0
    )
    ON CONFLICT (id) DO NOTHING
    RETURNING id
  `;

  return {
    programIds: programs.map(program => program.id),
    imageIds: images.map(image => image.id),
  };
}

export async function deleteTestDefaults(fixtures: TestDefaults): Promise<void> {
  await sql`DELETE FROM homepage_images WHERE id = ANY(${sql.array(fixtures.imageIds)}::uuid[])`;
  await sql`DELETE FROM programs WHERE id = ANY(${sql.array(fixtures.programIds)}::uuid[])`;
}
