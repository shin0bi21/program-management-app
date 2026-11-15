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
} from '../validation/homepageSchemas';
import { getHomepageImageRows, homepageImageRowColumns, type HomepageImageRow } from './homepage/homepageImageRowQuery';
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
  program: string;
  programDescription: string | null;
  enrollmentRequired: boolean;
  minAge: number | null;
  maxAge: number | null;
  sessionId: string | null;
  sessionTitle: string | null;
  sessionDate: string | null;
}

export type PublicLeadInput = {
  youthFirstName: string;
  youthLastName: string;
  dateOfBirth: string;
  school: string;
  submittedByRole: 'youth' | 'parent' | 'guardian';
  discoverySource: 'online' | 'friend_family' | 'school' | 'community_outreach' | 'other';
  contactPhoneNumber: string;
  contactRelationship: 'parent' | 'sibling' | 'guardian';
  notes?: string;
};

/**
 * Lists homepage photos and their variant URLs in display order.
 * @example await getPublicHomepageImages() // public image rows
 */
export async function getPublicHomepageImages() {
  return { images: await readHomepageImages() };
}

/**
 * Lists all public programs with up to three upcoming sessions each.
 * @example await getPublicHomepagePrograms() // programs in age order
 */
export async function getPublicHomepagePrograms() {
  return { programs: await readHomepagePrograms() };
}

/**
 * Lists complete image rows for authorized homepage managers.
 * @example await getManagedHomepage() // the same image shape as the public list
 */
export async function getManagedHomepage() {
  return { images: await readHomepageImages() };
}

/**
 * Resolves an image file, using the original when a generated variant is unavailable.
 * @param imageId - Image whose stored upload should be served; missing uploads are 404.
 * @param variant - Requested image size; omitted for the original.
 * @example await getHomepageImageFile(imageId, 'thumbnail') // local thumbnail path or original fallback
 */
export async function getHomepageImageFile(
  imageId: string,
  variant: HomepageImageVariant = 'original',
) {
  // 1. Find the stored original upload.
  const rows = await sql<{ storageKey: string | null }[]>`
    SELECT storage_key
    FROM homepage_images
    WHERE id = ${imageId}
  `;
  if (!rows.length || !rows[0].storageKey) {
    throw new NotFoundError('Homepage image file not found');
  }

  // 2. Use the requested variant when it exists, otherwise serve the original.
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

/**
 * Trims a validated public submission and saves it through the lead intake owner.
 * @param data - Validated youth and contact details, including the submitter relationship.
 * @example await submitPublicLead(data) // saves the youth details and contact
 */
export async function submitPublicLead(data: PublicLeadInput) {
  return createExternalLead({
    youthFirstName: data.youthFirstName.trim(),
    youthLastName: data.youthLastName.trim(),
    dateOfBirth: data.dateOfBirth,
    school: data.school.trim(),
    discoverySource: data.discoverySource,
    contactPhoneNumber: data.contactPhoneNumber.trim(),
    contactRelationship: data.contactRelationship,
    notes: data.notes?.trim() || null,
  }, data.submittedByRole, sql);
}

/**
 * Stores an uploaded original and three WebP variants, then returns the complete saved image.
 * Removes written files if upload persistence fails. Callers authorize homepage writes.
 * @param data - Validated caption used for both the caption and accessible alt text.
 * @param file - In-memory JPEG, PNG, or WebP upload; omission or invalid bytes are 400.
 * @param actor - Authorized user recorded as creator and updater.
 * @example await createHomepageImage(data, file, actor) // complete row with generated URLs
 */
export async function createHomepageImage(
  data: CreateHomepageImageInput,
  file: Express.Multer.File | undefined,
  actor: AccessTokenPayload,
) {
  // 1. Validate the uploaded image type.
  if (!file) throw new BadRequestError('An image file is required');
  const extension = supportedImageTypes.get(file.mimetype);
  if (!extension) {
    throw new BadRequestError('Image must be a JPEG, PNG, or WebP file');
  }

  // 2. Prepare the original and generated variant paths.
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

  // 3. Generate optimized variants before writing any files.
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

  // 4. Save files and return the inserted image, cleaning up if persistence fails.
  try {
    await writeFile(filePath, file.buffer, { flag: 'wx' });
    await writeFile(thumbnailPath, thumbnail, { flag: 'wx' });
    await writeFile(mobilePath, mobile, { flag: 'wx' });
    await writeFile(displayPath, display, { flag: 'wx' });
    const rows = await sql<HomepageImageRow[]>`
      INSERT INTO homepage_images AS image (
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
      RETURNING ${homepageImageRowColumns}
    `;
    return rows[0];
  } catch (error) {
    await Promise.all([filePath, thumbnailPath, mobilePath, displayPath].map(candidate => unlink(candidate).catch(() => {})));
    throw error;
  }
}

/**
 * Updates the caption and alt text and returns the complete saved image; missing images are 404.
 * @param imageId - Image whose saved caption and alt text change.
 * @param data - Validated replacement caption.
 * @param actor - Authorized user recorded as updater.
 * @example await updateHomepageImage(imageId, { caption: 'Youth workshop.' }, actor) // complete updated row
 */
export async function updateHomepageImage(imageId: string, data: UpdateHomepageImageInput, actor: AccessTokenPayload) {
  const rows = await sql<HomepageImageRow[]>`
    UPDATE homepage_images AS image
    SET
      alt_text = ${data.caption},
      caption = ${data.caption},
      updated_at = NOW(),
      updated_by = ${actor.userId}
    WHERE image.id = ${imageId}
    RETURNING ${homepageImageRowColumns}
  `;
  if (!rows.length) throw new NotFoundError('Homepage image not found');
  return rows[0];
}

/**
 * Replaces display order atomically after checking that every homepage image is included.
 * @param imageIds - Complete, distinct list of image IDs in the requested order.
 * @param actor - Authorized user recorded as updater.
 * @example await reorderHomepageImages({ imageIds }, actor) // saved image IDs in the requested order
 */
export async function reorderHomepageImages({ imageIds }: ReorderHomepageImagesInput, actor: AccessTokenPayload) {
  return sql.begin(async (tx) => {
    const trx = asTransactionSql(tx);

    // 1. Lock the image set and require its complete ordering.
    await trx`LOCK TABLE homepage_images IN SHARE ROW EXCLUSIVE MODE`;
    const [{ count }] = await trx<{ count: number }[]>`
      SELECT COUNT(*)::int AS count
      FROM homepage_images
    `;
    if (count !== imageIds.length) {
      throw new ConflictError('Image order must include every homepage image');
    }

    // 2. Save the requested positions and reject unavailable IDs.
    const rows = await trx`
      UPDATE homepage_images image
      SET
        display_order = ordered.display_order,
        updated_at = NOW(),
        updated_by = ${actor.userId}
      FROM (
        SELECT image_id, (ordinality - 1)::int AS display_order
        FROM unnest(${trx.array(imageIds)}::uuid[]) WITH ORDINALITY AS item(image_id, ordinality)
      ) ordered
      WHERE image.id = ordered.image_id
      RETURNING image.id
    `;
    if (rows.length !== imageIds.length) {
      throw new BadRequestError('Image order contains an unknown image');
    }
    return { imageIds };
  });
}

/**
 * Deletes an image and its files, restoring quarantined files when the database deletion fails.
 * @param imageId - Existing image to remove with its uploaded files.
 * @example await deleteHomepageImage(imageId) // removes the original and generated variants
 */
export async function deleteHomepageImage(imageId: string) {
  // 1. Find the image and its uploaded storage key.
  const existing = await sql<{ storageKey: string | null }[]>`
    SELECT storage_key
    FROM homepage_images
    WHERE id = ${imageId}
  `;
  if (!existing.length) throw new NotFoundError('Homepage image not found');

  // 2. Quarantine uploaded files, restoring them if preparation fails.
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

  // 3. Delete the database row before finalizing removal of quarantined files.
  try {
    const rows = await sql`
      DELETE
      FROM homepage_images
      WHERE id = ${imageId}
      RETURNING id
    `;
    if (!rows.length) throw new NotFoundError('Homepage image not found');
  } catch (error) {
    await Promise.all(quarantined.map(restoreQuarantinedUpload));
    throw error;
  }
  await Promise.all(quarantined.map(finalizeQuarantinedUpload));
}

/**
 * Reads the complete public and managed image list in its saved display order.
 * @example await readHomepageImages() // includes variant URLs and saved captions
 */
function readHomepageImages() {
  return sql<HomepageImageRow[]>`
    ${getHomepageImageRows()}
    ORDER BY image.display_order, image.created_at
  `;
}

/**
 * Groups each public program with its next three noncancelled sessions in age order.
 * @example await readHomepagePrograms() // includes programs with no upcoming sessions
 */
async function readHomepagePrograms() {
  // 1. Load programs with their next three sessions.
  const rows = await sql<HomepageProgramRow[]>`
    WITH ranked_sessions AS (
      SELECT
        session.program_id,
        session.id AS session_id,
        session.title AS session_title,
        session.date AS session_date,
        session.start_time AS session_start_time,
        ROW_NUMBER() OVER (
          PARTITION BY session.program_id
          ORDER BY session.date, session.start_time, session.id
        ) AS program_session_order
      FROM program_sessions session
      WHERE session.date >= CURRENT_DATE
        AND session.cancelled_at IS NULL
    )
    SELECT
      program.id AS program_id,
      program.name AS program,
      program.description AS program_description,
      program.enrollment_required,
      program.min_age,
      program.max_age,

      ranked.session_id,
      ranked.session_title,
      ranked.session_date
    FROM programs program
    LEFT JOIN ranked_sessions ranked
      ON ranked.program_id = program.id
      AND ranked.program_session_order <= 3
    ORDER BY
      program.min_age ASC NULLS FIRST,
      program.name,
      ranked.session_date,
      ranked.session_start_time,
      ranked.session_id
  `;

  // 2. Group session rows under each program, retaining empty programs.
  const programs = new Map<string, {
    id: string;
    name: string;
    description: string | null;
    enrollmentRequired: boolean;
    minAge: number | null;
    maxAge: number | null;
    sessions: Array<{ id: string; title: string; date: string }>;
  }>();

  for (const row of rows) {
    let program = programs.get(row.programId);
    if (!program) {
      program = {
        id: row.programId,
        name: row.program,
        description: row.programDescription,
        enrollmentRequired: row.enrollmentRequired,
        minAge: row.minAge,
        maxAge: row.maxAge,
        sessions: [],
      };
      programs.set(row.programId, program);
    }

    if (row.sessionId === null) continue;
    if (row.sessionTitle === null || row.sessionDate === null) {
      throw new Error(`Homepage session ${row.sessionId} is missing required data`);
    }

    program.sessions.push({
      id: row.sessionId,
      title: row.sessionTitle,
      date: row.sessionDate,
    });
  }

  return [...programs.values()];
}
