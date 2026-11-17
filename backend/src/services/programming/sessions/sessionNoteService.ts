import { asTransactionSql, sql } from '../../../db/client';
import { ConflictError, NotFoundError } from '../../../errors';
import { assertSessionAccess, programAccessPredicate } from '../../../policies/programAccessPolicy';
import type { AccessTokenPayload } from '../../../types/auth';
import type {
  CreateSessionNoteInput,
  UpdateSessionNoteInput,
} from '../../../validation/programmingSchemas';

/**
 * Lists notes and linked youth for an accessible session.
 * @param sessionId - Session whose notes are requested.
 * @param user - User whose session access is enforced.
 * @example getSessionNotes(sessionId, user) // notes ordered newest first
 */
export async function getSessionNotes(sessionId: string, user: AccessTokenPayload) {
  await assertSessionAccess(user, sessionId);
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

/**
 * Creates a note and eligible youth links in one transaction.
 * @param sessionId - Accessible session receiving the note.
 * @param data - Validated note content and roster youth IDs.
 * @param user - User checked for access and recorded as author.
 * @example createSessionNote(sessionId, data, user) // saved note with linked youth
 */
export async function createSessionNote(
  sessionId: string,
  data: CreateSessionNoteInput,
  user: AccessTokenPayload,
) {
  await assertSessionAccess(user, sessionId);
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
        ${user.userId},
        ${user.userId}
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

  const notes = await getSessionNotes(sessionId, user);
  const createdNote = notes.find(note => note.id === noteId);
  if (!createdNote) throw new NotFoundError('Session note not found after creation');
  return createdNote;
}

/**
 * Replaces a note and its eligible youth links atomically.
 * @param sessionId - Accessible session owning the note.
 * @param noteId - Existing note; a missing target is a not-found error.
 * @param data - Validated replacement content and youth IDs.
 * @param user - User checked for access and recorded as updater.
 * @example updateSessionNote(sessionId, noteId, data, user) // complete saved note
 */
export async function updateSessionNote(
  sessionId: string,
  noteId: string,
  data: UpdateSessionNoteInput,
  user: AccessTokenPayload,
) {
  await assertSessionAccess(user, sessionId);
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
          updated_by = ${user.userId}
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

  const notes = await getSessionNotes(sessionId, user);
  const updatedNote = notes.find(note => note.id === noteId);
  if (!updatedNote) throw new NotFoundError('Session note not found after update');
  return updatedNote;
}

/**
 * Deletes a note belonging to an accessible session.
 * @param sessionId - Session whose access is checked.
 * @param noteId - Note to remove; missing targets are not-found errors.
 * @param user - User requesting deletion.
 * @example deleteSessionNote(sessionId, noteId, user) // removes the note
 */
export async function deleteSessionNote(
  sessionId: string,
  noteId: string,
  user: AccessTokenPayload,
) {
  await assertSessionAccess(user, sessionId);
  const deleted = await sql`
    DELETE FROM session_notes
    WHERE id = ${noteId}
      AND session_id = ${sessionId}
    RETURNING id
  `;
  if (!deleted.length) throw new NotFoundError('Session note not found');
}

/**
 * Removes one youth link without deleting the session note.
 * @param sessionId - Accessible session owning the note.
 * @param noteId - Note whose link changes.
 * @param youthId - Linked youth; missing links are not-found errors.
 * @param user - User requesting the change.
 * @example unlinkYouthFromSessionNote(sessionId, noteId, youthId, user) // preserves other links
 */
export async function unlinkYouthFromSessionNote(
  sessionId: string,
  noteId: string,
  youthId: string,
  user: AccessTokenPayload,
) {
  await assertSessionAccess(user, sessionId);
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

/**
 * Lists a youth profile's linked notes within the user's program scope.
 * @param youthId - Required youth profile whose notes are requested.
 * @param user - User whose program scope restricts the result.
 * @param programCycle - Optional program and cycle pair restricting the notes.
 * @example listSessionNotesForYouth(youthId, user) // accessible notes across cycles
 */
export async function listSessionNotesForYouth(
  youthId: string,
  user: AccessTokenPayload,
  programCycle?: { programId: string; cycleId: string },
) {
  const profiles = await sql`SELECT 1 FROM youth_profiles WHERE user_id = ${youthId} LIMIT 1`;
  if (!profiles.length) throw new NotFoundError('Youth profile not found');

  return sql`
    SELECT
      sn.id,
      sn.session_id,
      sn.category,
      sn.details,
      sn.created_at,
      sn.updated_at,
      CONCAT_WS(' ', author.first_name, author.last_name) AS created_by_name,
      cs.title AS session_title,
      cs.date,
      cs.cycle_id,

      cycle.title AS cycle,

      p.id AS program_id,
      p.title AS program,
      p.enrollment_required,
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
    WHERE ${programAccessPredicate(user, sql`p.id`)}
      AND ${programCycle ? sql`cs.program_id = ${programCycle.programId} AND cs.cycle_id = ${programCycle.cycleId}` : sql`TRUE`}
    GROUP BY sn.id, author.id, cs.id, cycle.id, p.id
    ORDER BY cs.date DESC, cs.start_time DESC, sn.created_at DESC
  `;
}

/**
 * Rejects links to youth outside the session roster or open-session attendance.
 * @param trx - Caller-owned transaction used for eligibility reads.
 * @param sessionId - Session receiving the youth links.
 * @param enrollmentRequired - Whether enrollment determines eligibility.
 * @param youthIds - Validated distinct IDs; an empty list requires no checks.
 * @example assertYouthEligibility(trx, sessionId, true, []) // accepts a note without youth links
 */
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
