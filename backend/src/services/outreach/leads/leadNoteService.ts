import crypto from 'crypto';
import { asTransactionSql, sql } from '../../../db/client';
import { NotFoundError } from '../../../errors';
import type { SetLeadNoteInput, UpdateLeadNoteInput } from '../../../validation/leadNoteSchemas';
import { audit } from '../../shared/auditService';

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

export async function createLeadNote(leadId: string, data: SetLeadNoteInput, actorId: string) {
  const transactionId = crypto.randomUUID();
  const noteId = await sql.begin(async rawTx => {
    const tx = asTransactionSql(rawTx);
    const leads = await tx`SELECT 1 FROM leads WHERE id = ${leadId} FOR UPDATE`;
    if (!leads.length) throw new NotFoundError('Lead not found');

    const notes = await tx<{ id: string }[]>`
      INSERT INTO lead_notes (lead_id, category, details, created_by, updated_by)
      VALUES (${leadId}, 'follow_up', ${data.details}, ${actorId}, ${actorId})
      RETURNING id
    `;
    await audit(tx, actorId, transactionId, 'lead_notes', notes[0].id, 'INSERT', null, {
      leadId,
      category: 'follow_up',
      details: data.details,
    });
    return notes[0].id;
  });

  const notes = await getLeadNotes(leadId);
  const note = notes.find(candidate => candidate.id === noteId);
  if (!note) throw new NotFoundError('Lead note not found after creation');
  return note;
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
    if (!notes.length) throw new NotFoundError('Lead note not found');

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
  if (!note) throw new NotFoundError('Lead note not found after update');
  return note;
}

export async function deleteLeadNote(leadId: string, noteId: string, actorId: string) {
  const transactionId = crypto.randomUUID();

  return sql.begin(async rawTx => {
    const tx = asTransactionSql(rawTx);
    const notes = await tx<Record<string, unknown>[]>`
      DELETE FROM lead_notes
      WHERE id = ${noteId} AND lead_id = ${leadId}
      RETURNING id, lead_id, category, details, created_at, updated_at, created_by, updated_by
    `;
    if (!notes.length) throw new NotFoundError('Lead note not found');

    await audit(tx, actorId, transactionId, 'lead_notes', noteId, 'DELETE', notes[0], null);
    return { id: noteId };
  });
}

async function assertLeadExists(leadId: string) {
  const rows = await sql`SELECT 1 FROM leads WHERE id = ${leadId} LIMIT 1`;
  if (!rows.length) throw new NotFoundError('Lead not found');
}
