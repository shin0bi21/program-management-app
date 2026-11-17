import { randomUUID } from 'crypto';
import { mkdir, unlink, writeFile } from 'fs/promises';
import path from 'path';
import { asTransactionSql, sql } from '../../../db/client';
import { BadRequestError, ConflictError, InternalServerError, NotFoundError } from '../../../errors';
import { assertSessionAccess } from '../../../policies/programAccessPolicy';
import type { AccessTokenPayload } from '../../../types/auth';
import type {
  CreateSessionAttachmentInput,
  UpdateSessionAttachmentInput,
} from '../../../validation/programmingSchemas';
import {
  finalizeQuarantinedUpload,
  quarantineUpload,
  restoreQuarantinedUpload,
} from '../../shared/uploadFileService';

const uploadRoot = path.resolve(process.env.UPLOAD_ROOT ?? path.join(process.cwd(), 'uploads'));
const attachmentRoot = path.join(uploadRoot, 'sessions');
const supportedTypes = new Map([
  ['application/pdf', '.pdf'],
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp'],
  ['text/plain', '.txt'],
  ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', '.docx'],
]);

/** Attachment metadata shared by list, upload, and metadata-update responses. */
export interface SessionAttachmentRow {
  id: string;
  sessionId: string;
  title: string;
  description: string | null;
  originalFilename: string;
  mimeType: string;
  fileSize: number;
  createdAt: Date;
  updatedAt: Date;
  createdByName: string | null;
  youth: { youthId: string; firstName: string; lastName: string }[];
}

/**
 * Lists attachments and linked youth for an accessible session.
 * File sizes are numeric bytes; the upload boundary limits files to 15 MB,
 * safely within PostgreSQL integer range.
 * @param sessionId - Session whose attachment metadata is requested.
 * @param user - User whose session access is enforced.
 * @example getSessionAttachments(sessionId, user) // newest attachments first
 */
export async function getSessionAttachments(sessionId: string, user: AccessTokenPayload) {
  // 1. Check session access.
  await assertSessionAccess(user, sessionId);

  return sql<SessionAttachmentRow[]>`
    SELECT
      sa.id,
      sa.session_id,
      sa.title,
      sa.description,
      sa.original_filename,
      sa.mime_type,
      sa.file_size::integer AS file_size,
      sa.created_at,
      sa.updated_at,

      CONCAT_WS(' ', author.first_name, author.last_name) AS created_by_name,
      COALESCE(JSON_AGG(JSON_BUILD_OBJECT(
        'youthId', youth.id, 'firstName', youth.first_name, 'lastName', youth.last_name
      ) ORDER BY youth.first_name, youth.last_name)
        FILTER (WHERE youth.id IS NOT NULL), '[]'::json) AS youth
    FROM session_attachments sa
    LEFT JOIN users author ON author.id = sa.created_by
    LEFT JOIN session_attachment_has_youth sahy ON sahy.attachment_id = sa.id
    LEFT JOIN users youth ON youth.id = sahy.youth_id
    WHERE sa.session_id = ${sessionId}
    GROUP BY sa.id, author.id
    ORDER BY sa.created_at DESC
  `;
}

/**
 * Resolves an accessible attachment's file path and sanitized download name.
 * @param sessionId - Accessible session owning the attachment.
 * @param attachmentId - Existing attachment; missing targets are not-found errors.
 * @param user - User requesting the download.
 * @example getSessionAttachmentFile(sessionId, attachmentId, user) // path and download metadata
 */
export async function getSessionAttachmentFile(
  sessionId: string,
  attachmentId: string,
  user: AccessTokenPayload,
) {
  // 1. Check session access.
  await assertSessionAccess(user, sessionId);

  const rows = await sql<{ storageKey: string; title: string; mimeType: string }[]>`
    SELECT storage_key, title, mime_type
    FROM session_attachments
    WHERE id = ${attachmentId} AND session_id = ${sessionId}
  `;
  if (!rows.length) throw new NotFoundError('Session attachment not found');
  return {
    path: path.join(attachmentRoot, rows[0].storageKey),
    filename: `${safeDownloadTitle(rows[0].title)}${supportedTypes.get(rows[0].mimeType) ?? ''}`,
    mimeType: rows[0].mimeType,
  };
}

/**
 * Stores an upload and atomically creates its metadata and eligible youth links.
 * Removes the stored file if the database write fails.
 * @param sessionId - Accessible session receiving the attachment.
 * @param data - Validated title, description, and distinct roster youth IDs.
 * @param file - Required upload supplied by the shared 15 MB upload middleware.
 * @param user - User checked for access and recorded as author.
 * @example createSessionAttachment(sessionId, data, file, user) // canonical metadata with numeric fileSize
 */
export async function createSessionAttachment(
  sessionId: string,
  data: CreateSessionAttachmentInput,
  file: Express.Multer.File | undefined,
  user: AccessTokenPayload,
) {
  // 1. Check session access.
  await assertSessionAccess(user, sessionId);

  if (!file) throw new BadRequestError('An attachment file is required');
  const extension = supportedTypes.get(file.mimetype);
  if (!extension) throw new BadRequestError('Unsupported attachment file type');

  // 2. Store the validated file before saving its metadata.
  const storageKey = `${randomUUID()}${extension}`;
  const filePath = path.join(attachmentRoot, storageKey);
  await mkdir(attachmentRoot, { recursive: true });
  await writeFile(filePath, file.buffer, { flag: 'wx' });
  let attachmentId = '';

  // 3. Save metadata and youth links, compensating for persistence failure.
  try {
    await sql.begin(async tx => {
      const trx = asTransactionSql(tx);
      const sessions = await trx<{ enrollmentRequired: boolean }[]>`
        SELECT p.enrollment_required
        FROM program_sessions cs
        INNER JOIN programs p ON p.id = cs.program_id
        WHERE cs.id = ${sessionId}
        FOR UPDATE OF cs
      `;
      if (!sessions.length) throw new NotFoundError('Session not found');
      await assertYouthEligibility(trx, sessionId, sessions[0].enrollmentRequired, data.youthIds);
      const rows = await trx<{ id: string }[]>`
        INSERT INTO session_attachments (
          session_id, title, description, storage_key, original_filename,
          mime_type, file_size, created_by, updated_by
        ) VALUES (
          ${sessionId}, ${data.title}, ${data.description}, ${storageKey},
          ${file.originalname}, ${file.mimetype}, ${file.size}, ${user.userId}, ${user.userId}
        )
        RETURNING id
      `;
      if (!rows[0]) throw new InternalServerError('Attachment creation returned no record');
      attachmentId = rows[0].id;
      if (data.youthIds.length) {
        await trx`
          INSERT INTO session_attachment_has_youth (attachment_id, youth_id)
          SELECT ${rows[0].id}, selected.youth_id
          FROM UNNEST(${sql.array(data.youthIds)}::uuid[]) AS selected(youth_id)
        `;
      }
    });
  } catch (error) {
    await unlink(filePath).catch(() => {});
    throw error;
  }

  // Return the same projection as attachment reads.
  const attachments = await getSessionAttachments(sessionId, user);
  const attachment = attachments.find(candidate => candidate.id === attachmentId);
  if (!attachment) throw new NotFoundError('Session attachment not found');
  return attachment;
}

/**
 * Replaces attachment metadata and eligible youth links without changing the file.
 * @param sessionId - Accessible session owning the attachment.
 * @param attachmentId - Existing attachment; missing targets are not-found errors.
 * @param data - Validated replacement metadata and distinct roster youth IDs.
 * @param user - User checked for access and recorded as updater.
 * @example updateSessionAttachment(sessionId, attachmentId, data, user) // saved metadata
 */
export async function updateSessionAttachment(
  sessionId: string,
  attachmentId: string,
  data: UpdateSessionAttachmentInput,
  user: AccessTokenPayload,
) {
  // 1. Check session access.
  await assertSessionAccess(user, sessionId);

  await sql.begin(async tx => {
    const trx = asTransactionSql(tx);
    const attachments = await trx<{ id: string; enrollmentRequired: boolean }[]>`
      SELECT sa.id, p.enrollment_required
      FROM session_attachments sa
      INNER JOIN program_sessions cs ON cs.id = sa.session_id
      INNER JOIN programs p ON p.id = cs.program_id
      WHERE sa.id = ${attachmentId} AND sa.session_id = ${sessionId}
      FOR UPDATE OF sa
    `;
    if (!attachments.length) throw new NotFoundError('Session attachment not found');

    await assertYouthEligibility(trx, sessionId, attachments[0].enrollmentRequired, data.youthIds);
    await trx`
      UPDATE session_attachments
      SET title = ${data.title},
          description = ${data.description},
          updated_at = NOW(),
          updated_by = ${user.userId}
      WHERE id = ${attachmentId}
    `;
    await trx`DELETE FROM session_attachment_has_youth WHERE attachment_id = ${attachmentId}`;
    if (data.youthIds.length) {
      await trx`
        INSERT INTO session_attachment_has_youth (attachment_id, youth_id)
        SELECT ${attachmentId}, selected.youth_id
        FROM UNNEST(${sql.array(data.youthIds)}::uuid[]) AS selected(youth_id)
      `;
    }
  });

  // Return the same projection as attachment reads.
  const attachments = await getSessionAttachments(sessionId, user);
  const updated = attachments.find(attachment => attachment.id === attachmentId);
  if (!updated) throw new NotFoundError('Session attachment not found after update');
  return updated;
}

/**
 * Deletes attachment metadata and its file, restoring a quarantined file if deletion fails.
 * @param sessionId - Accessible session owning the attachment.
 * @param attachmentId - Existing attachment; missing targets are not-found errors.
 * @param user - User requesting deletion.
 * @example deleteSessionAttachment(sessionId, attachmentId, user) // removes metadata and file
 */
export async function deleteSessionAttachment(
  sessionId: string,
  attachmentId: string,
  user: AccessTokenPayload,
) {
  // 1. Check session access.
  await assertSessionAccess(user, sessionId);

  const existing = await sql<{ storageKey: string }[]>`
    SELECT storage_key
    FROM session_attachments
    WHERE id = ${attachmentId} AND session_id = ${sessionId}
  `;
  if (!existing.length) throw new NotFoundError('Session attachment not found');
  const quarantined = await quarantineUpload(path.join(attachmentRoot, existing[0].storageKey));
  try {
    const rows = await sql`
      DELETE FROM session_attachments
      WHERE id = ${attachmentId} AND session_id = ${sessionId}
      RETURNING id
    `;
    if (!rows.length) throw new NotFoundError('Session attachment not found');
  } catch (error) {
    await restoreQuarantinedUpload(quarantined);
    throw error;
  }
  await finalizeQuarantinedUpload(quarantined);
}

/**
 * Removes control characters and unsafe filename punctuation from a download title.
 * @param title - Attachment title; blank or fully removed titles use 'attachment'.
 * @example safeDownloadTitle('Updated / worksheet.') // 'Updated - worksheet'
 */
function safeDownloadTitle(title: string) {
  return title
    .split('')
    .map(character => character.charCodeAt(0) < 32 ? '-' : character)
    .join('')
    .replace(/[<>:"/\\|?*]/g, '-')
    .replace(/[. ]+$/g, '')
    .trim() || 'attachment';
}

/**
 * Rejects links outside the session enrollment roster or open-session attendance.
 * @param trx - Caller-owned transaction used for eligibility reads.
 * @param sessionId - Session receiving youth links.
 * @param enrollmentRequired - Whether eligibility depends on enrollment.
 * @param youthIds - Validated distinct IDs; an empty list requires no checks.
 * @example assertYouthEligibility(trx, sessionId, true, []) // accepts no youth links
 */
async function assertYouthEligibility(
  trx: ReturnType<typeof asTransactionSql>,
  sessionId: string,
  enrollmentRequired: boolean,
  youthIds: string[],
) {
  if (!youthIds.length) return;
  const eligible = !enrollmentRequired
    ? await trx<{ youthId: string }[]>`
        SELECT ar.youth_id
        FROM attendance_records ar
        WHERE ar.session_id = ${sessionId}
          AND ar.status = 'present'
          AND ar.youth_id = ANY(${sql.array(youthIds)}::uuid[])
      `
    : await trx<{ youthId: string }[]>`
        SELECT ce.youth_id
        FROM program_sessions cs
        INNER JOIN program_enrollments ce ON ce.program_id = cs.program_id AND ce.cycle_id = cs.cycle_id
        WHERE cs.id = ${sessionId}
          AND ce.youth_id = ANY(${sql.array(youthIds)}::uuid[])
          AND ce.enrolled_on <= cs.date
          AND (ce.withdrawn_on IS NULL OR ce.withdrawn_on > cs.date)
      `;
  if (eligible.length !== youthIds.length) {
    throw new ConflictError('Session attachments can only reference youth in the session roster');
  }
}
