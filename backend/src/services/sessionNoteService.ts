import { asTransactionSql, sql } from '../db/client';
import { ConflictError, NotFoundError } from '../errors';
import { assertSessionAccess } from '../policies/programAccessPolicy';
import type { AccessTokenPayload } from '../types/auth';
import type { CreateSessionNoteInput } from '../validation/cohortSchemas';

export async function getSessionNotes(sessionId: string, actor: AccessTokenPayload) {
  await assertSessionAccess(actor, sessionId);
  return sql`
    SELECT
      sn.id,
      sn.session_id,
      sn.note,
      sn.created_at,
      sn.updated_at,
      CONCAT_WS(' ', author.first_name, author.last_name) AS created_by_name,
      COALESCE(
        JSON_AGG(
          JSON_BUILD_OBJECT(
            'youthId', youth.id,
            'firstName', youth.first_name,
            'lastName', youth.last_name
          )
          ORDER BY youth.first_name, youth.last_name
        ) FILTER (WHERE youth.id IS NOT NULL),
        '[]'::json
      ) AS youth
    FROM session_notes sn
    LEFT JOIN users author ON author.id = sn.created_by
    LEFT JOIN session_note_youth sny ON sny.note_id = sn.id
    LEFT JOIN users youth ON youth.id = sny.youth_id
    WHERE sn.session_id = ${sessionId}
    GROUP BY sn.id, author.id
    ORDER BY sn.created_at DESC
  `;
}

export async function createSessionNote(
  sessionId: string,
  data: CreateSessionNoteInput,
  actor: AccessTokenPayload,
) {
  await assertSessionAccess(actor, sessionId);
  const noteId = await sql.begin(async tx => {
    const trx = asTransactionSql(tx);
    const sessions = await trx<{ id: string; rosterMode: 'enrolled' | 'open' }[]>`
      SELECT cs.id, p.roster_mode
      FROM cohort_sessions cs
      INNER JOIN program_cohorts pc ON pc.id = cs.cohort_id
      INNER JOIN programs p ON p.id = pc.program_id
      WHERE cs.id = ${sessionId}
      FOR UPDATE OF cs
    `;
    if (!sessions.length) throw new NotFoundError('Session not found');

    if (data.youthIds.length) {
      const eligibleYouth = sessions[0].rosterMode === 'open'
        ? await trx<{ youthId: string }[]>`
            SELECT ar.youth_id
            FROM attendance_records ar
            WHERE ar.session_id = ${sessionId}
              AND ar.status = 'present'
              AND ar.youth_id = ANY(${sql.array(data.youthIds)}::uuid[])
          `
        : await trx<{ youthId: string }[]>`
            SELECT ce.youth_id
            FROM cohort_sessions cs
            INNER JOIN cohort_enrollments ce ON ce.cohort_id = cs.cohort_id
            WHERE cs.id = ${sessionId}
              AND ce.youth_id = ANY(${sql.array(data.youthIds)}::uuid[])
              AND ce.enrolled_on <= (cs.starts_at AT TIME ZONE 'America/Toronto')::date
              AND (
                ce.withdrawn_on IS NULL
                OR ce.withdrawn_on > (cs.starts_at AT TIME ZONE 'America/Toronto')::date
              )
          `;
      if (eligibleYouth.length !== data.youthIds.length) {
        throw new ConflictError(
          'Session notes can only reference youth in the session roster',
        );
      }
    }

    const notes = await trx<{ id: string }[]>`
      INSERT INTO session_notes (session_id, note, created_by, updated_by)
      VALUES (${sessionId}, ${data.note}, ${actor.userId}, ${actor.userId})
      RETURNING id
    `;

    if (data.youthIds.length) {
      await trx`
        INSERT INTO session_note_youth (note_id, youth_id)
        SELECT ${notes[0].id}, selected.youth_id
        FROM UNNEST(${sql.array(data.youthIds)}::uuid[]) AS selected(youth_id)
      `;
    }
    return notes[0].id;
  });

  const notes = await getSessionNotes(sessionId, actor);
  const createdNote = notes.find(note => note.id === noteId);
  if (!createdNote) throw new NotFoundError('Session note not found after creation');
  return createdNote;
}
