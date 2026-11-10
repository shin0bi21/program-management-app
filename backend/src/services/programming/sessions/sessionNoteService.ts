import { asTransactionSql, sql } from '../../../db/client';
import { ConflictError, NotFoundError } from '../../../errors';
import { assertCanAccessSession, programAccessPredicate } from '../../../policies/programAccessPolicy';
import type { AccessTokenPayload } from '../../../types/auth';
import type {
  CreateSessionNoteInput,
  UpdateSessionNoteInput,
} from '../../../validation/programmingSchemas';

export async function getSessionNotes(sessionId: string, actor: AccessTokenPayload) {
  await assertCanAccessSession(actor, sessionId);
  return sql`
    SELECT
      sn.id,
      sn.session_id,
      sn.category,
      sn.details,
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
    LEFT JOIN session_note_has_youth sny ON sny.note_id = sn.id
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
  await assertCanAccessSession(actor, sessionId);
  const noteId = await sql.begin(async tx => {
    const trx = asTransactionSql(tx);
    const sessions = await trx<{ id: string; enrollmentRequired: boolean }[]>`
      SELECT cs.id, p.enrollment_required
      FROM program_sessions cs
      INNER JOIN programs p ON p.id = cs.program_id
      WHERE cs.id = ${sessionId}
      FOR UPDATE OF cs
    `;
    if (!sessions.length) throw new NotFoundError('Session not found');

    await assertYouthEligibility(
      trx,
      sessionId,
      sessions[0].enrollmentRequired,
      data.youthIds,
    );

    const notes = await trx<{ id: string }[]>`
      INSERT INTO session_notes (
        session_id,
        category,
        details,
        created_by,
        updated_by
      )
      VALUES (
        ${sessionId},
        ${data.category},
        ${data.details},
        ${actor.userId},
        ${actor.userId}
      )
      RETURNING id
    `;

    if (data.youthIds.length) {
      await trx`
        INSERT INTO session_note_has_youth (note_id, youth_id)
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

export async function updateSessionNote(
  sessionId: string,
  noteId: string,
  data: UpdateSessionNoteInput,
  actor: AccessTokenPayload,
) {
  await assertCanAccessSession(actor, sessionId);
  await sql.begin(async tx => {
    const trx = asTransactionSql(tx);
    const notes = await trx<{ id: string; enrollmentRequired: boolean }[]>`
      SELECT sn.id, p.enrollment_required
      FROM session_notes sn
      INNER JOIN program_sessions cs ON cs.id = sn.session_id
      INNER JOIN programs p ON p.id = cs.program_id
      WHERE sn.id = ${noteId}
        AND sn.session_id = ${sessionId}
      FOR UPDATE OF sn
    `;
    if (!notes.length) throw new NotFoundError('Session note not found');

    await assertYouthEligibility(
      trx,
      sessionId,
      notes[0].enrollmentRequired,
      data.youthIds,
    );

    await trx`
      UPDATE session_notes
      SET category = ${data.category},
          details = ${data.details},
          updated_at = NOW(),
          updated_by = ${actor.userId}
      WHERE id = ${noteId}
    `;
    await trx`DELETE FROM session_note_has_youth WHERE note_id = ${noteId}`;
    if (data.youthIds.length) {
      await trx`
        INSERT INTO session_note_has_youth (note_id, youth_id)
        SELECT ${noteId}, selected.youth_id
        FROM UNNEST(${sql.array(data.youthIds)}::uuid[]) AS selected(youth_id)
      `;
    }
  });

  const notes = await getSessionNotes(sessionId, actor);
  const updatedNote = notes.find(note => note.id === noteId);
  if (!updatedNote) throw new NotFoundError('Session note not found after update');
  return updatedNote;
}

export async function deleteSessionNote(
  sessionId: string,
  noteId: string,
  actor: AccessTokenPayload,
) {
  await assertCanAccessSession(actor, sessionId);
  const deleted = await sql`
    DELETE FROM session_notes
    WHERE id = ${noteId}
      AND session_id = ${sessionId}
    RETURNING id
  `;
  if (!deleted.length) throw new NotFoundError('Session note not found');
}

export async function unlinkYouthFromSessionNote(
  sessionId: string,
  noteId: string,
  youthId: string,
  actor: AccessTokenPayload,
) {
  await assertCanAccessSession(actor, sessionId);
  const unlinked = await sql`
    DELETE FROM session_note_has_youth sny
    USING session_notes sn
    WHERE sny.note_id = sn.id
      AND sn.id = ${noteId}
      AND sn.session_id = ${sessionId}
      AND sny.youth_id = ${youthId}
    RETURNING sny.note_id
  `;
  if (!unlinked.length) throw new NotFoundError('Session note youth link not found');
}

export async function listSessionNotesForYouth(
  youthId: string,
  actor: AccessTokenPayload,
  programCycle?: { programId: string; cycleId: string },
) {
  const profiles = await sql`SELECT 1 FROM youth_profiles WHERE user_id = ${youthId} LIMIT 1`;
  if (!profiles.length) throw new NotFoundError('Youth profile not found');

  return sql`
    SELECT
      sn.id, sn.session_id, sn.category, sn.details, sn.created_at, sn.updated_at,
      CONCAT_WS(' ', author.first_name, author.last_name) AS created_by_name,
      cs.theme AS session_theme, cs.date::text, cs.cycle_id,
      cycle.name AS cycle, p.id AS program_id, p.name AS program, p.enrollment_required,
      COALESCE(
        JSON_AGG(
          JSON_BUILD_OBJECT(
            'youthId', linked_youth.id,
            'firstName', linked_youth.first_name,
            'lastName', linked_youth.last_name
          ) ORDER BY linked_youth.first_name, linked_youth.last_name
        ) FILTER (WHERE linked_youth.id IS NOT NULL),
        '[]'::json
      ) AS youth
    FROM session_notes sn
    INNER JOIN session_note_has_youth selected_youth
      ON selected_youth.note_id = sn.id AND selected_youth.youth_id = ${youthId}
    INNER JOIN program_sessions cs ON cs.id = sn.session_id
    INNER JOIN program_cycles cycle ON cycle.id = cs.cycle_id
    INNER JOIN programs p ON p.id = cs.program_id
    LEFT JOIN users author ON author.id = sn.created_by
    LEFT JOIN session_note_has_youth linked_note ON linked_note.note_id = sn.id
    LEFT JOIN users linked_youth ON linked_youth.id = linked_note.youth_id
    WHERE ${programAccessPredicate(actor, sql`p.id`)}
      AND ${programCycle ? sql`cs.program_id = ${programCycle.programId} AND cs.cycle_id = ${programCycle.cycleId}` : sql`TRUE`}
    GROUP BY sn.id, author.id, cs.id, cycle.id, p.id
    ORDER BY cs.date DESC, cs.start_time DESC, sn.created_at DESC
  `;
}

async function assertYouthEligibility(
  trx: ReturnType<typeof asTransactionSql>,
  sessionId: string,
  enrollmentRequired: boolean,
  youthIds: string[],
) {
  if (!youthIds.length) return;
  const eligibleYouth = !enrollmentRequired
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
          AND (
            ce.withdrawn_on IS NULL
            OR ce.withdrawn_on > cs.date
          )
      `;
  if (eligibleYouth.length !== youthIds.length) {
    throw new ConflictError(
      'Session notes can only reference youth in the session roster',
    );
  }
}
