import { useEffect, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEye, faPen, faTrash } from '@fortawesome/free-solid-svg-icons';
import {
  deleteSessionNote,
  getSessionNotes,
} from '../../../../common/api/cohorts.api';
import Button from '../../../../common/components/Button/Button';
import { DashboardCard } from '../../../../common/components/DashboardCard/DashboardCard';
import Modal from '../../../../common/components/Modal/Modal';
import SessionNoteDetails, {
  SessionNoteCategoryBadge,
} from '../../../../common/components/SessionNoteDetails/SessionNoteDetails';
import { useConfirmModal, type ConfirmAction } from '../../../../common/hooks/useConfirmModal';
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
  canWrite,
  onView,
  onEdit,
  onDelete,
}: {
  notes: SessionNote[];
  loading: boolean;
  error: string | null;
  canWrite: boolean;
  onView: (note: SessionNote) => void;
  onEdit: (note: SessionNote) => void;
  onDelete: (note: SessionNote) => void;
}) {
  if (loading) return <p className="dashboard-card__empty">Loading notes…</p>;
  if (error) return <p className="form-error">{error}</p>;
  if (!notes.length) return <p className="dashboard-card__empty">No notes.</p>;

  return (
    <div className="session-notes-list">
      {notes.map(note => (
        <article key={note.id} className="session-note">
          <div className="session-note__main">
            <span className="session-note__summary">
              <strong>{note.title}</strong>
              <SessionNoteCategoryBadge category={note.category} />
            </span>
            <div className="session-note__meta">
              <span>
                {note.createdByName || 'Staff'} · {formatShortDate(note.createdAt)}
              </span>
            </div>
          </div>
          <div className="session-note__actions">
            <Button
              size="sm"
              variant="ghost"
              className="session-note__action-button"
              aria-label={`View ${note.title}`}
              title="View note"
              onClick={() => onView(note)}
            >
              <FontAwesomeIcon icon={faEye} aria-hidden="true" />
            </Button>
            {canWrite && (
              <>
                <Button
                  size="sm"
                  variant="ghost"
                  className="session-note__action-button"
                  aria-label={`Edit ${note.title}`}
                  title="Edit note"
                  onClick={() => onEdit(note)}
                >
                  <FontAwesomeIcon icon={faPen} aria-hidden="true" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="session-note__action-button session-note__action-button--danger"
                  aria-label={`Delete ${note.title}`}
                  title="Delete note"
                  onClick={() => onDelete(note)}
                >
                  <FontAwesomeIcon icon={faTrash} aria-hidden="true" />
                </Button>
              </>
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
  const [editNote, setEditNote] = useState<SessionNote | null>(null);
  const [detailNote, setDetailNote] = useState<SessionNote | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [notes, setNotes] = useState<SessionNote[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);
  const confirmModal = useConfirmModal({
    action: confirmAction,
    onClose: () => setConfirmAction(null),
  });

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
    setEditNote(null);
    setDetailNote(null);
    setConfirmAction(null);
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
            aria-label="Manage attendance"
            onClick={() => {
              if (session) onAddAttendance(session);
            }}
          >
            Manage
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
          ? (
              <SessionNotesContent
                notes={notes}
                loading={loading}
                error={error}
                canWrite={canWriteNotes}
                onView={setDetailNote}
                onEdit={note => {
                  setEditNote(note);
                  setNoteTarget(session);
                }}
                onDelete={note => setConfirmAction({
                  title: 'Delete Note',
                  message: `Delete “${note.title}”? This cannot be undone.`,
                  confirmLabel: 'Delete',
                  confirmVariant: 'danger',
                  successMessage: 'Session note successfully deleted.',
                  onConfirm: async () => {
                    await deleteSessionNote(session.id, note.id);
                    await loadNotes(session.id);
                    if (detailNote?.id === note.id) setDetailNote(null);
                  },
                })}
              />
            )
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
        note={editNote}
        onClose={() => {
          setNoteTarget(null);
          setEditNote(null);
        }}
        onSaved={async () => {
          if (noteTarget) await loadNotes(noteTarget.id);
        }}
      />
      <Modal
        isOpen={detailNote !== null}
        onClose={() => setDetailNote(null)}
        title={detailNote?.title ?? ''}
        footer={(
          <Button variant="secondary" onClick={() => setDetailNote(null)}>
            Close
          </Button>
        )}
      >
        {detailNote && <SessionNoteDetails note={detailNote} />}
      </Modal>
      <Modal
        isOpen={confirmAction !== null}
        onClose={() => setConfirmAction(null)}
        title={confirmAction?.title ?? ''}
        footer={confirmModal.footer}
        status={confirmModal.status}
        statusMessage={confirmModal.statusMessage}
        successDelay={confirmModal.successDelay}
        disableClose={confirmModal.disableClose}
      >
        <p>{confirmAction?.message}</p>
      </Modal>
    </>
  );
}
