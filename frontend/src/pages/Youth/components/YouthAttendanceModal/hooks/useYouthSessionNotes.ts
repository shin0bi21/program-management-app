import { useState } from 'react';
import { unlinkSessionNoteYouth } from '../../../../Programming/Sessions/sessions.api';
import type { SessionNote } from '../../../../Programming/Sessions/types';
import { getErrorMessage } from '../../../../../http/errors';
import type { SessionNoteTarget, SessionNoteUnlinkTarget, YouthAttendanceSession } from '../types';

export default function useYouthSessionNotes({
  youthId,
  sessions,
  refresh,
}: {
  youthId: string | null;
  sessions: YouthAttendanceSession[];
  refresh: () => Promise<unknown>;
}) {
  const [noteTarget, setNoteTarget] = useState<SessionNoteTarget | null>(null);
  const [detailTarget, setDetailTarget] = useState<SessionNote | null>(null);
  const [unlinkTarget, setUnlinkTarget] = useState<SessionNoteUnlinkTarget | null>(null);
  const [unlinking, setUnlinking] = useState(false);
  const [unlinkError, setUnlinkError] = useState('');
  const [collapsedSessionIds, setCollapsedSessionIds] = useState<Set<string>>(() => new Set());
  const sessionsWithNotes = sessions.filter(session => session.sessionNotes.length > 0);
  const allExpanded = sessionsWithNotes.length > 0
    && sessionsWithNotes.every(session => !collapsedSessionIds.has(session.id));

  const reset = () => {
    setNoteTarget(null);
    setDetailTarget(null);
    setUnlinkTarget(null);
    setUnlinkError('');
    setCollapsedSessionIds(new Set());
  };

  const toggleAll = () => {
    setCollapsedSessionIds(allExpanded
      ? new Set(sessionsWithNotes.map(session => session.id))
      : new Set());
  };

  const toggleSession = (sessionId: string) => {
    setCollapsedSessionIds(current => {
      const next = new Set(current);
      if (next.has(sessionId)) next.delete(sessionId);
      else next.add(sessionId);
      return next;
    });
  };

  const addNote = (session: YouthAttendanceSession) => setNoteTarget({ session, note: null });
  const viewNote = (note: SessionNote) => setDetailTarget(note);
  const closeDetails = () => setDetailTarget(null);
  const editNote = (session: YouthAttendanceSession, note: SessionNote) => setNoteTarget({ session, note });
  const closeNote = () => setNoteTarget(null);
  const noteSaved = async () => {
    await refresh();
    if (!noteTarget) return;
    setCollapsedSessionIds(current => {
      const next = new Set(current);
      next.delete(noteTarget.session.id);
      return next;
    });
  };

  const requestUnlink = (session: YouthAttendanceSession, note: SessionNote) => {
    setUnlinkError('');
    setUnlinkTarget({ session, note });
  };
  const closeUnlink = () => {
    if (unlinking) return;
    setUnlinkTarget(null);
    setUnlinkError('');
  };
  const confirmUnlink = async () => {
    if (!unlinkTarget || !youthId) return;
    setUnlinking(true);
    setUnlinkError('');
    try {
      await unlinkSessionNoteYouth(unlinkTarget.session.id, unlinkTarget.note.id, youthId);
      await refresh();
      setUnlinkTarget(null);
    } catch (cause) {
      setUnlinkError(getErrorMessage(cause, 'Failed to unlink session note'));
    } finally {
      setUnlinking(false);
    }
  };

  return {
    noteTarget,
    detailTarget,
    unlinkTarget,
    unlinking,
    unlinkError,
    sessionsWithNotes,
    allExpanded,
    isChildOpen: Boolean(noteTarget || detailTarget || unlinkTarget),
    isExpanded: (sessionId: string) => !collapsedSessionIds.has(sessionId),
    reset,
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
