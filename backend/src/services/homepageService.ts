import { randomUUID } from 'crypto';
import { access, mkdir, unlink, writeFile } from 'fs/promises';
import path from 'path';
import sharp from 'sharp';
import { asTransactionSql, sql } from '../db/client';
import { BadRequestError, ConflictError, NotFoundError } from '../errors';
import type { AccessTokenPayload } from '../types/auth';
import type {
  CreateHomepageImageInput,
  ReorderHomepageImagesInput,
  UpdateHomepageImageInput,
  UpdateHomepageSignupInput,
} from '../validation/homepageSchemas';
import { createExternalLead } from './outreach/leads/leadService';
import {
  finalizeQuarantinedUpload,
  quarantineUpload,
  restoreQuarantinedUpload,
} from './shared/uploadFileService';

const uploadRoot = path.resolve(process.env.UPLOAD_ROOT ?? path.join(process.cwd(), 'uploads'));
const homepageUploadRoot = path.join(uploadRoot, 'homepage');

const supportedImageTypes = new Map([
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp'],
]);

type HomepageImageVariant = 'original' | 'thumbnail' | 'mobile' | 'display';

interface HomepageProgramRow {
  programId: string;
  programName: string;
  programDescription: string | null;
  rosterMode: 'enrolled' | 'open';
  minAge: number | null;
  maxAge: number | null;
  sessionId: string | null;
  sessionTheme: string | null;
  sessionStartsAt: string | null;
}

export type PublicLeadInput = {
  youthFirstName: string;
  youthLastName: string;
  age: number;
  school: string;
  submittedByRole: 'youth' | 'parent' | 'guardian';
  discoverySource: 'online' | 'friend_family' | 'school' | 'community_outreach' | 'other';
  contactPhoneNumber: string;
  contactRelationship: 'parent' | 'sibling' | 'guardian';
  notes?: string;
};

export async function getPublicHomepageImages() {
  return { images: await homepageImages() };
}

export async function getPublicHomepagePrograms() {
  return { programs: await homepagePrograms() };
}

export async function getManagedHomepage() {
  return { images: await homepageImages() };
}

export async function getHomepageSignup() {
  const [settings] = await sql<{ signupEnabled: boolean }[]>`
    SELECT signup_enabled
    FROM homepage_settings
    WHERE id = 1
  `;
  if (!settings) throw new Error('Homepage settings row is missing');
  return settings;
}

export async function updateHomepageSignup(
  data: UpdateHomepageSignupInput,
  actor: AccessTokenPayload,
) {
  const [settings] = await sql<{ signupEnabled: boolean }[]>`
    UPDATE homepage_settings
    SET
      signup_enabled = ${data.enabled},
      updated_at = NOW(),
      updated_by = ${actor.userId}
    WHERE id = 1
    RETURNING signup_enabled
  `;
  if (!settings) throw new Error('Homepage settings row is missing');
  return settings;
}

export async function submitPublicLead(data: PublicLeadInput) {
  return sql.begin(async rawTx => {
    const trx = asTransactionSql(rawTx);

    // Hold the settings row through insertion so closing signup waits for in-flight submissions.
    const [settings] = await trx<{ signupEnabled: boolean }[]>`
      SELECT signup_enabled
      FROM homepage_settings
      WHERE id = 1
      FOR SHARE
    `;
    if (!settings) throw new Error('Homepage settings row is missing');
    if (!settings.signupEnabled) throw new ConflictError('Homepage signup is currently closed');

    return createExternalLead({
      youthFirstName: data.youthFirstName.trim(),
      youthLastName: data.youthLastName.trim(),
      age: data.age,
      school: data.school.trim(),
      discoverySource: data.discoverySource,
      contactPhoneNumber: data.contactPhoneNumber.trim(),
      contactRelationship: data.contactRelationship,
      notes: data.notes?.trim() || null,
    }, data.submittedByRole, trx);
  });
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
  const storageStem = path.parse(storageKey).name;
  const thumbnailKey = `${storageStem}-thumbnail.webp`;
  const mobileKey = `${storageStem}-mobile.webp`;
  const displayKey = `${storageStem}-display.webp`;
  const filePath = path.join(homepageUploadRoot, storageKey);
  const thumbnailPath = path.join(homepageUploadRoot, thumbnailKey);
  const mobilePath = path.join(homepageUploadRoot, mobileKey);
  const displayPath = path.join(homepageUploadRoot, displayKey);
  await mkdir(homepageUploadRoot, { recursive: true });
  let thumbnail: Buffer;
  let mobile: Buffer;
  let display: Buffer;
  try {
    const source = sharp(file.buffer, { failOn: 'warning' }).rotate();
    [thumbnail, mobile, display] = await Promise.all([
      source.clone().resize({ width: 320, withoutEnlargement: true }).webp({ quality: 76 }).toBuffer(),
      source.clone().resize({ width: 768, withoutEnlargement: true }).webp({ quality: 78 }).toBuffer(),
      source.clone().resize({ width: 1600, withoutEnlargement: true }).webp({ quality: 82 }).toBuffer(),
    ]);
  } catch {
    throw new BadRequestError('Image file is invalid or unsupported');
  }
  try {
    await writeFile(filePath, file.buffer, { flag: 'wx' });
    await writeFile(thumbnailPath, thumbnail, { flag: 'wx' });
    await writeFile(mobilePath, mobile, { flag: 'wx' });
    await writeFile(displayPath, display, { flag: 'wx' });
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
    await Promise.all([filePath, thumbnailPath, mobilePath, displayPath].map(candidate => unlink(candidate).catch(() => {})));
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
  const existing = await sql<{ storageKey: string | null }[]>`
    SELECT storage_key FROM homepage_images
    WHERE id = ${imageId}
  `;
  if (!existing.length) throw new NotFoundError('Homepage image not found');

  const quarantined = [];
  if (existing[0].storageKey) {
    const storageKey = existing[0].storageKey;
    const stem = path.parse(storageKey).name;
    try {
      for (const key of [storageKey, `${stem}-thumbnail.webp`, `${stem}-mobile.webp`, `${stem}-display.webp`]) {
        quarantined.push(await quarantineUpload(path.join(homepageUploadRoot, key)));
      }
    } catch (error) {
      await Promise.all(quarantined.map(restoreQuarantinedUpload));
      throw error;
    }
  }

  try {
    const rows = await sql`DELETE FROM homepage_images WHERE id = ${imageId} RETURNING id`;
    if (!rows.length) throw new NotFoundError('Homepage image not found');
  } catch (error) {
    await Promise.all(quarantined.map(restoreQuarantinedUpload));
    throw error;
  }
  await Promise.all(quarantined.map(finalizeQuarantinedUpload));
}

export async function getHomepageImageFile(
  imageId: string,
  variant: HomepageImageVariant = 'original',
) {
  const rows = await sql<{ storageKey: string | null }[]>`
    SELECT storage_key
    FROM homepage_images
    WHERE id = ${imageId}
  `;
  if (!rows.length || !rows[0].storageKey) {
    throw new NotFoundError('Homepage image file not found');
  }
  const originalPath = path.join(homepageUploadRoot, rows[0].storageKey);
  if (variant === 'original') return originalPath;
  const variantPath = path.join(
    homepageUploadRoot,
    `${path.parse(rows[0].storageKey).name}-${variant}.webp`,
  );
  try {
    await access(variantPath);
    return variantPath;
  } catch {
    return originalPath;
  }
}

function imageVariantUrlSql(variant: Exclude<HomepageImageVariant, 'original'>) {
  return sql`
    CASE
      WHEN hi.public_path IS NOT NULL THEN regexp_replace(
        hi.public_path,
        '[.][^./]+$',
        ${`-${variant}.webp`}
      )
      ELSE '/public/homepage/images/' || hi.id::text || '/' || ${variant}
    END
  `;
}

function homepageImages() {
  return sql`
    SELECT
      hi.id,
      ${imageVariantUrlSql('display')} AS image_url,
      ${imageVariantUrlSql('mobile')} AS mobile_url,
      ${imageVariantUrlSql('thumbnail')} AS thumbnail_url,
      hi.alt_text,
      hi.caption,
      hi.display_order,
      hi.created_at,
      hi.updated_at
    FROM homepage_images hi
    ORDER BY hi.display_order, hi.created_at
  `;
}

async function homepagePrograms() {
  const rows = await sql<HomepageProgramRow[]>`
    WITH ranked_sessions AS (
      SELECT
        pc.program_id,
        cs.id AS session_id,
        cs.theme AS session_theme,
        cs.starts_at AS session_starts_at,
        ROW_NUMBER() OVER (
          PARTITION BY pc.program_id
          ORDER BY cs.starts_at, cs.id
        ) AS program_session_order
      FROM cohort_sessions cs
      INNER JOIN program_cohorts pc ON pc.id = cs.cohort_id
      WHERE cs.ends_at >= NOW()
        AND cs.cancelled_at IS NULL
    )
    SELECT
      p.id AS program_id,
      p.name AS program_name,
      p.description AS program_description,
      p.roster_mode,
      p.min_age,
      p.max_age,
      ranked.session_id,
      ranked.session_theme,
      ranked.session_starts_at
    FROM programs p
    LEFT JOIN ranked_sessions ranked
      ON ranked.program_id = p.id
      AND ranked.program_session_order <= 3
    ORDER BY
      p.min_age ASC NULLS FIRST,
      p.name,
      ranked.session_starts_at,
      ranked.session_id
  `;

  const programs = new Map<string, {
    id: string;
    name: string;
    description: string | null;
    rosterMode: 'enrolled' | 'open';
    minAge: number | null;
    maxAge: number | null;
    sessions: Array<{ id: string; theme: string; startsAt: string }>;
  }>();

  for (const row of rows) {
    let program = programs.get(row.programId);
    if (!program) {
      program = {
        id: row.programId,
        name: row.programName,
        description: row.programDescription,
        rosterMode: row.rosterMode,
        minAge: row.minAge,
        maxAge: row.maxAge,
        sessions: [],
      };
      programs.set(row.programId, program);
    }

    if (row.sessionId === null) continue;
    if (row.sessionTheme === null || row.sessionStartsAt === null) {
      throw new Error(`Homepage session ${row.sessionId} is missing required data`);
    }

    program.sessions.push({
      id: row.sessionId,
      theme: row.sessionTheme,
      startsAt: row.sessionStartsAt,
    });
  }

  return [...programs.values()];
}
