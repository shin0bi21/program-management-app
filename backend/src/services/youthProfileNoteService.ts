import { sql } from '../db/client';
import { NotFoundError } from '../errors';
import type { SetYouthProfileNoteInput } from '../validation/youthProfileNoteSchemas';

async function assertYouthExists(youthId: string) {
  const rows = await sql`SELECT 1 FROM youth_profiles WHERE user_id = ${youthId} LIMIT 1`;
  if (!rows.length) throw new NotFoundError('Youth profile not found');
}
export async function getYouthProfileNotes(youthId: string) {
  await assertYouthExists(youthId);
  return sql`
    SELECT note.id, note.youth_id, note.category, note.title, note.details,
      note.created_at, note.updated_at,
      CONCAT_WS(' ', author.first_name, author.last_name) AS created_by_name
    FROM youth_profile_notes note
    LEFT JOIN users author ON author.id = note.created_by
    WHERE note.youth_id = ${youthId}
    ORDER BY note.created_at DESC
  `;
}
export async function createYouthProfileNote(youthId: string, data: SetYouthProfileNoteInput, actorId: string) {
  await assertYouthExists(youthId);
  const rows = await sql`
    INSERT INTO youth_profile_notes (youth_id, category, title, details, created_by, updated_by)
    VALUES (${youthId}, ${data.category}, ${data.title}, ${data.details}, ${actorId}, ${actorId}) RETURNING id
  `;
  return (await getYouthProfileNotes(youthId)).find(note => note.id === rows[0].id)!;
}
export async function updateYouthProfileNote(youthId: string, noteId: string, data: SetYouthProfileNoteInput, actorId: string) {
  const rows = await sql`
    UPDATE youth_profile_notes SET category = ${data.category}, title = ${data.title}, details = ${data.details},
      updated_by = ${actorId}, updated_at = NOW()
    WHERE id = ${noteId} AND youth_id = ${youthId} RETURNING id
  `;
  if (!rows.length) throw new NotFoundError('Profile note not found');
  return (await getYouthProfileNotes(youthId)).find(note => note.id === noteId)!;
}
export async function deleteYouthProfileNote(youthId: string, noteId: string) {
  const rows = await sql`DELETE FROM youth_profile_notes WHERE id = ${noteId} AND youth_id = ${youthId} RETURNING id`;
  if (!rows.length) throw new NotFoundError('Profile note not found');
}
