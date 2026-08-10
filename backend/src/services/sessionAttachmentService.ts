import { randomUUID } from 'crypto';
import { mkdir, unlink, writeFile } from 'fs/promises';
import path from 'path';
import { asTransactionSql, sql } from '../db/client';
import { BadRequestError, ConflictError, NotFoundError } from '../errors';
import { assertSessionAccess } from '../policies/programAccessPolicy';
import type { AccessTokenPayload } from '../types/auth';
import type {
  CreateSessionAttachmentInput,
  UpdateSessionAttachmentInput,
} from '../validation/cohortSchemas';
import {
  finalizeQuarantinedUpload,
  quarantineUpload,
  restoreQuarantinedUpload,
} from './uploadFileService';

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

const safeDownloadTitle = (title: string) => title
  .split('')
  .map(character => character.charCodeAt(0) < 32 ? '-' : character)
  .join('')
  .replace(/[<>:"/\\|?*]/g, '-')
  .replace(/[. ]+$/g, '')
  .trim() || 'attachment';

async function assertYouthEligibility(
  trx: ReturnType<typeof asTransactionSql>,
  sessionId: string,
  rosterMode: 'enrolled' | 'open',
  youthIds: string[],
) {
  if (!youthIds.length) return;
  const eligible = rosterMode === 'open'
    ? await trx<{ youthId: string }[]>`
        SELECT ar.youth_id FROM attendance_records ar
        WHERE ar.session_id = ${sessionId} AND ar.status = 'present'
          AND ar.youth_id = ANY(${sql.array(youthIds)}::uuid[])
      `
    : await trx<{ youthId: string }[]>`
        SELECT ce.youth_id
        FROM cohort_sessions cs
        INNER JOIN cohort_enrollments ce ON ce.cohort_id = cs.cohort_id
        WHERE cs.id = ${sessionId}
          AND ce.youth_id = ANY(${sql.array(youthIds)}::uuid[])
          AND ce.enrolled_on <= (cs.starts_at AT TIME ZONE 'America/Toronto')::date
          AND (ce.withdrawn_on IS NULL OR ce.withdrawn_on > (cs.starts_at AT TIME ZONE 'America/Toronto')::date)
      `;
  if (eligible.length !== youthIds.length) {
    throw new ConflictError('Session attachments can only reference youth in the session roster');
  }
}

export async function getSessionAttachments(sessionId: string, actor: AccessTokenPayload) {
  await assertSessionAccess(actor, sessionId);
  return sql`
    SELECT sa.id, sa.session_id, sa.title, sa.description, sa.original_filename,
      sa.mime_type, sa.file_size, sa.created_at, sa.updated_at,
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

export async function createSessionAttachment(
  sessionId: string,
  data: CreateSessionAttachmentInput,
  file: Express.Multer.File | undefined,
  actor: AccessTokenPayload,
) {
  await assertSessionAccess(actor, sessionId);
  if (!file) throw new BadRequestError('An attachment file is required');
  const extension = supportedTypes.get(file.mimetype);
  if (!extension) throw new BadRequestError('Unsupported attachment file type');
  const storageKey = `${randomUUID()}${extension}`;
  const filePath = path.join(attachmentRoot, storageKey);
  await mkdir(attachmentRoot, { recursive: true });
  await writeFile(filePath, file.buffer, { flag: 'wx' });
  let attachmentId = '';

  try {
    await sql.begin(async tx => {
      const trx = asTransactionSql(tx);
      const sessions = await trx<{ rosterMode: 'enrolled' | 'open' }[]>`
        SELECT p.roster_mode FROM cohort_sessions cs
        INNER JOIN program_cohorts pc ON pc.id = cs.cohort_id
        INNER JOIN programs p ON p.id = pc.program_id
        WHERE cs.id = ${sessionId} FOR UPDATE OF cs
      `;
      if (!sessions.length) throw new NotFoundError('Session not found');
      await assertYouthEligibility(trx, sessionId, sessions[0].rosterMode, data.youthIds);
      const rows = await trx<{ id: string }[]>`
        INSERT INTO session_attachments (
          session_id, title, description, storage_key, original_filename,
          mime_type, file_size, created_by, updated_by
        ) VALUES (
          ${sessionId}, ${data.title}, ${data.description}, ${storageKey},
          ${file.originalname}, ${file.mimetype}, ${file.size}, ${actor.userId}, ${actor.userId}
        ) RETURNING id
      `;
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
  const attachments = await getSessionAttachments(sessionId, actor);
  return attachments.find(attachment => attachment.id === attachmentId)!;
}

export async function deleteSessionAttachment(
  sessionId: string,
  attachmentId: string,
  actor: AccessTokenPayload,
) {
  await assertSessionAccess(actor, sessionId);
  const existing = await sql<{ storageKey: string }[]>`
    SELECT storage_key FROM session_attachments
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

export async function updateSessionAttachment(
  sessionId: string,
  attachmentId: string,
  data: UpdateSessionAttachmentInput,
  actor: AccessTokenPayload,
) {
  await assertSessionAccess(actor, sessionId);
  await sql.begin(async tx => {
    const trx = asTransactionSql(tx);
    const attachments = await trx<{ id: string; rosterMode: 'enrolled' | 'open' }[]>`
      SELECT sa.id, p.roster_mode
      FROM session_attachments sa
      INNER JOIN cohort_sessions cs ON cs.id = sa.session_id
      INNER JOIN program_cohorts pc ON pc.id = cs.cohort_id
      INNER JOIN programs p ON p.id = pc.program_id
      WHERE sa.id = ${attachmentId} AND sa.session_id = ${sessionId}
      FOR UPDATE OF sa
    `;
    if (!attachments.length) throw new NotFoundError('Session attachment not found');

    await assertYouthEligibility(trx, sessionId, attachments[0].rosterMode, data.youthIds);
    await trx`
      UPDATE session_attachments
      SET title = ${data.title},
          description = ${data.description},
          updated_at = NOW(),
          updated_by = ${actor.userId}
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

  const attachments = await getSessionAttachments(sessionId, actor);
  const updated = attachments.find(attachment => attachment.id === attachmentId);
  if (!updated) throw new NotFoundError('Session attachment not found after update');
  return updated;
}

export async function getSessionAttachmentFile(
  sessionId: string,
  attachmentId: string,
  actor: AccessTokenPayload,
) {
  await assertSessionAccess(actor, sessionId);
  const rows = await sql<{ storageKey: string; title: string; mimeType: string }[]>`
    SELECT storage_key, title, mime_type FROM session_attachments
    WHERE id = ${attachmentId} AND session_id = ${sessionId}
  `;
  if (!rows.length) throw new NotFoundError('Session attachment not found');
  return {
    path: path.join(attachmentRoot, rows[0].storageKey),
    filename: `${safeDownloadTitle(rows[0].title)}${supportedTypes.get(rows[0].mimeType) ?? ''}`,
    mimeType: rows[0].mimeType,
  };
}
