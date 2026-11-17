import type { AttendanceSession } from '../../../../../common/features/Attendance/attendance.api';
import { useState } from 'react';
import { unlinkSessionNoteYouth } from '../../../../Programming/Sessions/sessions.api';
import type { SessionNote } from '../../../../Programming/Sessions/types';
import type { SessionNoteTarget, SessionNoteUnlinkTarget } from '../types';

/**
 * Coordinates note targets and expansion within one mounted attendance interaction.
 * @param options - Selected youth, loaded session notes and dashboard refresh action.
 * @example useYouthSessionNotes({ youthId, sessions, refresh }).addNote(session)
 */
export default function useYouthSessionNotes({
  youthId,
  sessions,
  refresh,
}: {
  youthId: string;
  sessions: AttendanceSession[];
  refresh: () => Promise<unknown>;
}) {
  const [noteTarget, setNoteTarget] = useState<SessionNoteTarget | null>(null);
  const [detailTarget, setDetailTarget] = useState<SessionNote | null>(null);
  const [unlinkTarget, setUnlinkTarget] = useState<SessionNoteUnlinkTarget | null>(null);
  const [collapsedSessionIds, setCollapsedSessionIds] = useState<Set<string>>(() => new Set());
  const sessionsWithNotes = sessions.filter(session => session.sessionNotes.length > 0);
  const allExpanded = sessionsWithNotes.length > 0
    && sessionsWithNotes.every(session => !collapsedSessionIds.has(session.id));

  /**
   * Expands all note-bearing sessions or collapses them when all are already expanded.
   * @example toggleAll()
   */
  const toggleAll = () => {
    setCollapsedSessionIds(allExpanded
      ? new Set(sessionsWithNotes.map(session => session.id))
      : new Set());
  };

  /**
   * Toggles note expansion for the supplied session ID.
   * @example toggleSession(sessionId)
   */
  const toggleSession = (sessionId: string) => {
    setCollapsedSessionIds(current => {
      const next = new Set(current);
      if (next.has(sessionId)) next.delete(sessionId);
      else next.add(sessionId);
      return next;
    });
  };

  /**
   * Opens a blank note linked to the supplied attendance session.
   * @example addNote(session)
   */
  const addNote = (session: AttendanceSession) => setNoteTarget({ session, note: null });
  /**
   * Opens details for the supplied saved note.
   * @example viewNote(note)
   */
  const viewNote = (note: SessionNote) => setDetailTarget(note);
  /**
   * Clears the detail target and returns to attendance.
   * @example closeDetails()
   */
  const closeDetails = () => setDetailTarget(null);
  /**
   * Opens the supplied saved note within its attendance session.
   * @example editNote(session, note)
   */
  const editNote = (session: AttendanceSession, note: SessionNote) => setNoteTarget({ session, note });
  /**
   * Clears the note editor target and unmounts its draft.
   * @example closeNote()
   */
  const closeNote = () => setNoteTarget(null);
  /**
   * Refreshes the loaded dashboard data and expands the edited note's session.
   * @example await noteSaved()
   */
  const noteSaved = async () => {
    await refresh();
    if (!noteTarget) return;
    setCollapsedSessionIds(current => {
      const next = new Set(current);
      next.delete(noteTarget.session.id);
      return next;
    });
  };

  /**
   * Captures the supplied session/note link for confirmation.
   * @example requestUnlink(session, note)
   */
  const requestUnlink = (session: AttendanceSession, note: SessionNote) => {
    setUnlinkTarget({ session, note });
  };
  /**
   * Clears the unlink confirmation and returns to attendance.
   * @example closeUnlink()
   */
  const closeUnlink = () => setUnlinkTarget(null);
  /**
   * Removes the captured youth link and refreshes attendance without deleting the note.
   * @example await confirmUnlink()
   */
  const confirmUnlink = async () => {
    if (!unlinkTarget) return;

    await unlinkSessionNoteYouth(unlinkTarget.session.id, unlinkTarget.note.id, youthId);
    await refresh();
  };

  return {
    noteTarget,
    detailTarget,
    unlinkTarget,
    sessionsWithNotes,
    allExpanded,
    isChildOpen: Boolean(noteTarget || detailTarget || unlinkTarget),
    isExpanded: (sessionId: string) => !collapsedSessionIds.has(sessionId),
    toggleAll,
    toggleSession,
    addNote,
    viewNote,
    closeDetails,
    editNote,
    closeNote,
    noteSaved,
    requestUnlink,
    closeUnlink,
    confirmUnlink,
  };
}
