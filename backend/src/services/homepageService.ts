import { randomUUID } from 'crypto';
import { mkdir, unlink, writeFile } from 'fs/promises';
import path from 'path';
import { asTransactionSql, sql } from '../db/client';
import { BadRequestError, ConflictError, NotFoundError } from '../errors';
import type { AccessTokenPayload } from '../types/auth';
import type {
  CreateHomepageImageInput,
  ReorderHomepageImagesInput,
  UpdateHomepageImageInput,
} from '../validation/homepageSchemas';

const uploadRoot = path.resolve(process.env.UPLOAD_ROOT ?? path.join(process.cwd(), 'uploads'));
const homepageUploadRoot = path.join(uploadRoot, 'homepage');

const supportedImageTypes = new Map([
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp'],
]);

function imageUrlSql() {
  return sql`
    CASE
      WHEN hi.public_path IS NOT NULL THEN hi.public_path
      ELSE '/public/homepage/images/' || hi.id::text || '/file'
    END
  `;
}

function homepageImages() {
  return sql`
    SELECT
      hi.id,
      ${imageUrlSql()} AS image_url,
      hi.alt_text,
      hi.caption,
      hi.display_order,
      hi.created_at,
      hi.updated_at
    FROM homepage_images hi
    ORDER BY hi.display_order, hi.created_at
  `;
}

function homepageSessions() {
  return sql`
    WITH ranked_sessions AS (
      SELECT
        cs.id,
        cs.cohort_id,
        cs.theme,
        cs.description,
        cs.starts_at,
        cs.ends_at,
        cs.created_at AS added_at,
        pc.name AS cohort_name,
        p.id AS program_id,
        p.name AS program_name,
        p.description AS program_description,
        p.roster_mode,
        p.min_age,
        p.max_age,
        ROW_NUMBER() OVER (
          PARTITION BY p.id
          ORDER BY cs.starts_at
        ) AS program_session_order
      FROM cohort_sessions cs
      INNER JOIN program_cohorts pc ON pc.id = cs.cohort_id
      INNER JOIN programs p ON p.id = pc.program_id
      WHERE cs.ends_at >= NOW()
        AND cs.cancelled_at IS NULL
        AND p.name IN ('Drop In', 'Soft Skills', 'Job Readiness')
    )
    SELECT *
    FROM ranked_sessions
    WHERE program_session_order <= 3
    ORDER BY
      CASE program_name
        WHEN 'Drop In' THEN 1
        WHEN 'Soft Skills' THEN 2
        WHEN 'Job Readiness' THEN 3
        ELSE 4
      END,
      starts_at
  `;
}

export async function getPublicHomepage() {
  const [images, sessions] = await Promise.all([homepageImages(), homepageSessions()]);
  return { images, sessions };
}

export async function getManagedHomepage() {
  return { images: await homepageImages() };
}

export async function createHomepageImage(
  data: CreateHomepageImageInput,
  file: Express.Multer.File | undefined,
  actor: AccessTokenPayload,
) {
  if (!file) throw new BadRequestError('An image file is required');
  const extension = supportedImageTypes.get(file.mimetype);
  if (!extension) {
    throw new BadRequestError('Image must be a JPEG, PNG, or WebP file');
  }

  const storageKey = `${randomUUID()}${extension}`;
  const filePath = path.join(homepageUploadRoot, storageKey);
  await mkdir(homepageUploadRoot, { recursive: true });
  await writeFile(filePath, file.buffer, { flag: 'wx' });

  try {
    const rows = await sql`
      INSERT INTO homepage_images (
        storage_key, alt_text, caption, display_order, created_by, updated_by
      )
      SELECT
        ${storageKey},
        ${data.caption},
        ${data.caption},
        COALESCE(MAX(display_order), -1) + 1,
        ${actor.userId},
        ${actor.userId}
      FROM homepage_images
      RETURNING id
    `;
    return rows[0];
  } catch (error) {
    await unlink(filePath).catch(() => {});
    throw error;
  }
}

export async function updateHomepageImage(imageId: string, data: UpdateHomepageImageInput, actor: AccessTokenPayload) {
  const rows = await sql`
    UPDATE homepage_images
    SET
      alt_text = ${data.caption},
      caption = ${data.caption},
      updated_at = NOW(),
      updated_by = ${actor.userId}
    WHERE id = ${imageId}
    RETURNING id
  `;
  if (!rows.length) throw new NotFoundError('Homepage image not found');
  return rows[0];
}

export async function reorderHomepageImages({ imageIds }: ReorderHomepageImagesInput, actor: AccessTokenPayload) {
  return sql.begin(async (transaction) => {
    const trx = asTransactionSql(transaction);
    await trx`LOCK TABLE homepage_images IN SHARE ROW EXCLUSIVE MODE`;
    const [{ count }] = await trx<{ count: number }[]>`
      SELECT COUNT(*)::int AS count
      FROM homepage_images
    `;
    if (count !== imageIds.length) {
      throw new ConflictError('Image order must include every homepage image');
    }

    const rows = await trx`
      UPDATE homepage_images hi
      SET
        display_order = ordered.display_order,
        updated_at = NOW(),
        updated_by = ${actor.userId}
      FROM (
        SELECT image_id, (ordinality - 1)::int AS display_order
        FROM unnest(${sql.array(imageIds)}::uuid[]) WITH ORDINALITY AS item(image_id, ordinality)
      ) ordered
      WHERE hi.id = ordered.image_id
      RETURNING hi.id
    `;
    if (rows.length !== imageIds.length) {
      throw new BadRequestError('Image order contains an unknown image');
    }
    return { imageIds };
  });
}

export async function deleteHomepageImage(imageId: string) {
  const rows = await sql<{ storageKey: string | null }[]>`
    DELETE FROM homepage_images
    WHERE id = ${imageId}
    RETURNING storage_key
  `;
  if (!rows.length) throw new NotFoundError('Homepage image not found');

  if (rows[0].storageKey) {
    await unlink(path.join(homepageUploadRoot, rows[0].storageKey!)).catch((error) => {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    });
  }
}

export async function getHomepageImageFile(imageId: string) {
  const rows = await sql<{ storageKey: string | null }[]>`
    SELECT storage_key
    FROM homepage_images
    WHERE id = ${imageId}
  `;
  if (!rows.length || !rows[0].storageKey) {
    throw new NotFoundError('Homepage image file not found');
  }
  return path.join(homepageUploadRoot, rows[0].storageKey);
}
