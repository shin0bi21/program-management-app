import crypto from 'crypto';
import { asTransactionSql, sql } from '../../../db/client';
import { ConflictError, NotFoundError } from '../../../errors';
import type { SetLeadNoteInput, UpdateLeadNoteInput } from '../../../validation/leadNoteSchemas';
import { audit } from '../../shared/auditService';
import { getLead } from './leadService';

export async function getLeadNotes(leadId: string) {
  await assertLeadExists(leadId);
  return sql`
    SELECT note.id, note.lead_id, note.category, note.details, note.created_at, note.updated_at,
      CONCAT_WS(' ', author.first_name, author.last_name) AS created_by_name
    FROM lead_notes note
    LEFT JOIN users author ON author.id = note.created_by
    WHERE note.lead_id = ${leadId}
    ORDER BY note.created_at DESC
  `;
}

export async function createLeadStatusNote(leadId: string, data: SetLeadNoteInput, actorId: string) {
  const transactionId = crypto.randomUUID();
  const noteId = await sql.begin(async rawTx => {
    const tx = asTransactionSql(rawTx);
    const leads = await tx<{ status: string }[]>`
      SELECT status FROM leads WHERE id = ${leadId} FOR UPDATE
    `;
    if (!leads.length) throw new NotFoundError('Lead not found');
    if (leads[0].status === 'signed_up') {
      throw new ConflictError('Signed-up lead status cannot be changed');
    }

    const notes = await tx<{ id: string }[]>`
      INSERT INTO lead_notes (lead_id, category, details, created_by, updated_by)
      VALUES (${leadId}, ${data.category}, ${data.details}, ${actorId}, ${actorId})
      RETURNING id
    `;
    await tx`
      UPDATE leads
      SET status = ${data.category},
          status_updated_at = CASE WHEN status = ${data.category} THEN status_updated_at ELSE NOW() END,
          updated_at = NOW(),
          updated_by = ${actorId}
      WHERE id = ${leadId}
    `;
    await audit(tx, actorId, transactionId, 'leads', leadId, 'UPDATE',
      { status: leads[0].status }, { status: data.category });
    return notes[0].id;
  });

  const notes = await getLeadNotes(leadId);
  const note = notes.find(candidate => candidate.id === noteId);
  if (!note) throw new NotFoundError('Lead status note not found after creation');
  return { note, lead: await getLead(leadId) };
}

export async function updateLeadNoteDetails(
  leadId: string,
  noteId: string,
  data: UpdateLeadNoteInput,
  actorId: string,
) {
  const transactionId = crypto.randomUUID();

  await sql.begin(async rawTx => {
    const tx = asTransactionSql(rawTx);
    const notes = await tx<{ details: string }[]>`
      SELECT details FROM lead_notes
      WHERE id = ${noteId} AND lead_id = ${leadId}
      FOR UPDATE
    `;
    if (!notes.length) throw new NotFoundError('Lead status note not found');

    await tx`
      UPDATE lead_notes
      SET details = ${data.details}, updated_by = ${actorId}, updated_at = NOW()
      WHERE id = ${noteId} AND lead_id = ${leadId}
    `;
    await audit(tx, actorId, transactionId, 'lead_notes', noteId, 'UPDATE',
      { details: notes[0].details }, { details: data.details });
  });

  const notes = await getLeadNotes(leadId);
  const note = notes.find(candidate => candidate.id === noteId);
  if (!note) throw new NotFoundError('Lead status note not found after update');
  return note;
}

async function assertLeadExists(leadId: string) {
  const rows = await sql`SELECT 1 FROM leads WHERE id = ${leadId} LIMIT 1`;
  if (!rows.length) throw new NotFoundError('Lead not found');
}
