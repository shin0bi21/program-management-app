import { sql } from '../../../db/client';
import { NotFoundError } from '../../../errors';
import type { SetLeadNoteInput } from '../../../validation/leadNoteSchemas';

export async function getLeadNotes(leadId: string) {
  await assertLeadExists(leadId);
  return sql`
    SELECT note.id, note.lead_id, note.details, note.created_at, note.updated_at,
      CONCAT_WS(' ', author.first_name, author.last_name) AS created_by_name
    FROM lead_notes note
    LEFT JOIN users author ON author.id = note.created_by
    WHERE note.lead_id = ${leadId}
    ORDER BY note.created_at DESC
  `;
}

export function setLeadNote(leadId: string, data: SetLeadNoteInput, actorId: string, noteId?: string) {
  return noteId
    ? updateLeadNoteRecord(leadId, noteId, data, actorId)
    : insertLeadNote(leadId, data, actorId);
}

export async function deleteLeadNote(leadId: string, noteId: string) {
  const rows = await sql`
    DELETE FROM lead_notes
    WHERE id = ${noteId} AND lead_id = ${leadId}
    RETURNING id
  `;
  if (!rows.length) throw new NotFoundError('Lead note not found');
}

async function insertLeadNote(leadId: string, data: SetLeadNoteInput, actorId: string) {
  await assertLeadExists(leadId);
  const rows = await sql`
    INSERT INTO lead_notes (lead_id, details, created_by, updated_by)
    VALUES (${leadId}, ${data.details}, ${actorId}, ${actorId})
    RETURNING id
  `;
  return (await getLeadNotes(leadId)).find(note => note.id === rows[0].id)!;
}

async function updateLeadNoteRecord(leadId: string, noteId: string, data: SetLeadNoteInput, actorId: string) {
  const rows = await sql`
    UPDATE lead_notes
    SET details = ${data.details}, updated_by = ${actorId}, updated_at = NOW()
    WHERE id = ${noteId} AND lead_id = ${leadId}
    RETURNING id
  `;
  if (!rows.length) throw new NotFoundError('Lead note not found');
  return (await getLeadNotes(leadId)).find(note => note.id === noteId)!;
}

async function assertLeadExists(leadId: string) {
  const rows = await sql`SELECT 1 FROM leads WHERE id = ${leadId} LIMIT 1`;
  if (!rows.length) throw new NotFoundError('Lead not found');
}
