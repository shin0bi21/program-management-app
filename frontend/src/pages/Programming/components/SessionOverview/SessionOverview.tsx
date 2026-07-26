import { useEffect, useRef, useState } from 'react';
import { getSessionNotes } from '../../../../common/api/cohorts.api';
import Button from '../../../../common/components/Button/Button';
import { DashboardCard } from '../../../../common/components/DashboardCard/DashboardCard';
import type { ManagedSession, SessionNote } from '../../../../common/types/cohort';
import { formatShortDate } from '../../../../common/utils/date';
import SessionNoteModal from '../SessionNoteModal/SessionNoteModal';
import './SessionOverview.css';

interface SessionOverviewProps {
  session: ManagedSession | null;
  canWriteAttendance: boolean;
  canWriteNotes: boolean;
  onAddAttendance: (session: ManagedSession) => void;
}

const getAttendanceSummary = (session: ManagedSession | null) => {
  if (!session || session.attendanceRate === null) return null;
  if (session.rosterMode === 'open') {
    return session.attendanceMarkedCount
      ? `${session.attendanceMarkedCount} check-ins`
      : null;
  }
  return `${session.attendedCount}/${session.attendanceMarkedCount}`;
};

function SessionNotesContent({
  notes,
  loading,
  error,
}: {
  notes: SessionNote[];
  loading: boolean;
  error: string | null;
}) {
  if (loading) return <p className="dashboard-card__empty">Loading notes…</p>;
  if (error) return <p className="form-error">{error}</p>;
  if (!notes.length) return <p className="dashboard-card__empty">No notes.</p>;

  return (
    <div className="session-notes-list">
      {notes.map(note => (
        <article key={note.id} className="session-note">
          <p>{note.note}</p>
          <div className="session-note__meta">
            <span>
              {note.createdByName || 'Staff'} · {formatShortDate(note.createdAt)}
            </span>
            {note.youth.length > 0 && (
              <span>
                {note.youth.map(youth => `${youth.firstName} ${youth.lastName}`).join(', ')}
              </span>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}

export default function SessionOverview({
  session,
  canWriteAttendance,
  canWriteNotes,
  onAddAttendance,
}: SessionOverviewProps) {
  const attendanceSummary = getAttendanceSummary(session);
  const [noteTarget, setNoteTarget] = useState<ManagedSession | null>(null);
  const [notes, setNotes] = useState<SessionNote[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const loadNotes = async (sessionId: string) => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const nextNotes = await getSessionNotes(sessionId);
      if (requestIdRef.current === requestId) setNotes(nextNotes);
    } catch (cause) {
      if (requestIdRef.current === requestId) {
        setNotes([]);
        setError(cause instanceof Error ? cause.message : 'Could not load session notes');
      }
    } finally {
      if (requestIdRef.current === requestId) setLoading(false);
    }
  };

  useEffect(() => {
    setNoteTarget(null);
    if (!session) {
      requestIdRef.current += 1;
      setNotes([]);
      setError(null);
      setLoading(false);
      return;
    }
    void loadNotes(session.id);
    return () => {
      requestIdRef.current += 1;
    };
  }, [session?.id]);

  return (
    <>
      <DashboardCard
        title="Attendance"
        emptyMessage="No session selected."
        action={canWriteAttendance ? (
          <Button
            size="sm"
            variant="secondary"
            disabled={!session}
            aria-label="Add attendance"
            onClick={() => {
              if (session) onAddAttendance(session);
            }}
          >
            + Add
          </Button>
        ) : undefined}
      >
        {session ? (
          <p className={attendanceSummary ? undefined : 'dashboard-card__empty'}>
            {attendanceSummary ?? 'No attendance.'}
          </p>
        ) : undefined}
      </DashboardCard>
      <DashboardCard
        title="Session notes"
        emptyMessage={session ? 'No notes.' : 'No session selected.'}
        action={canWriteNotes ? (
          <Button
            size="sm"
            variant="secondary"
            disabled={!session}
            aria-label="Add notes"
            onClick={() => {
              if (session) setNoteTarget(session);
            }}
          >
            + Add
          </Button>
        ) : undefined}
      >
        {session
          ? <SessionNotesContent notes={notes} loading={loading} error={error} />
          : undefined}
      </DashboardCard>
      <DashboardCard
        title="Worksheets"
        emptyMessage={session ? 'Not available yet.' : 'No session selected.'}
        action={(
          <Button
            size="sm"
            variant="secondary"
            disabled
            aria-label="Add worksheets"
            title="Worksheet support is not available yet"
          >
            + Add
          </Button>
        )}
      />
      <SessionNoteModal
        session={noteTarget}
        onClose={() => setNoteTarget(null)}
        onSaved={async () => {
          if (noteTarget) await loadNotes(noteTarget.id);
        }}
      />
    </>
  );
}
