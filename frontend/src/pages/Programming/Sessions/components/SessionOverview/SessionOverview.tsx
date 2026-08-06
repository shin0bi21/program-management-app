import { useEffect, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faDownload, faEye, faPen, faTrash } from '@fortawesome/free-solid-svg-icons';
import {
  deleteSessionAttachment,
  deleteSessionNote,
  downloadSessionAttachment,
  getSessionAttachments,
  getSessionNotes,
} from '../../../../../common/api/cohorts.api';
import Button from '../../../../../common/components/Button/Button';
import { DashboardCard } from '../../../../../common/components/DashboardCard/DashboardCard';
import Modal from '../../../../../common/components/Modal/Modal';
import SessionNoteDetails, {
  SessionNoteCategoryBadge,
} from '../../../../../common/components/SessionNoteDetails/SessionNoteDetails';
import { useConfirmModal, type ConfirmAction } from '../../../../../common/hooks/useConfirmModal';
import type { CohortSession, SessionAttachment, SessionNote } from '../../../../../common/types/cohort';
import { formatShortDate } from '../../../../../common/utils/date';
import SessionNoteModal from '../SessionNoteModal/SessionNoteModal';
import SessionAttachmentModal from '../SessionAttachmentModal/SessionAttachmentModal';
import './SessionOverview.css';

interface SessionOverviewProps {
  session: CohortSession | null;
  canWriteAttendance: boolean;
  canWriteSessions: boolean;
  onAddAttendance: (session: CohortSession) => void;
}

const getAttendanceSummary = (session: CohortSession | null) => {
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
  canWriteSessions,
  onAddAttendance,
}: SessionOverviewProps) {
  const attendanceSummary = getAttendanceSummary(session);
  const [noteTarget, setNoteTarget] = useState<CohortSession | null>(null);
  const [editNote, setEditNote] = useState<SessionNote | null>(null);
  const [detailNote, setDetailNote] = useState<SessionNote | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [notes, setNotes] = useState<SessionNote[]>([]);
  const [attachments, setAttachments] = useState<SessionAttachment[]>([]);
  const [attachmentTarget, setAttachmentTarget] = useState<CohortSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attachmentsLoading, setAttachmentsLoading] = useState(false);
  const [attachmentsError, setAttachmentsError] = useState<string | null>(null);
  const requestIdRef = useRef(0);
  const attachmentRequestIdRef = useRef(0);
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

  const loadAttachments = async (sessionId: string) => {
    const requestId = ++attachmentRequestIdRef.current;
    setAttachmentsLoading(true);
    setAttachmentsError(null);
    try {
      const nextAttachments = await getSessionAttachments(sessionId);
      if (attachmentRequestIdRef.current === requestId) setAttachments(nextAttachments);
    } catch (cause) {
      if (attachmentRequestIdRef.current === requestId) {
        setAttachments([]);
        setAttachmentsError(cause instanceof Error ? cause.message : 'Could not load session attachments');
      }
    } finally {
      if (attachmentRequestIdRef.current === requestId) setAttachmentsLoading(false);
    }
  };

  useEffect(() => {
    setNoteTarget(null);
    setEditNote(null);
    setDetailNote(null);
    setConfirmAction(null);
    setAttachmentTarget(null);
    if (!session) {
      requestIdRef.current += 1;
      attachmentRequestIdRef.current += 1;
      setNotes([]);
      setAttachments([]);
      setError(null);
      setAttachmentsError(null);
      setLoading(false);
      setAttachmentsLoading(false);
      return;
    }
    void Promise.all([loadNotes(session.id), loadAttachments(session.id)]);
    return () => {
      requestIdRef.current += 1;
      attachmentRequestIdRef.current += 1;
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
        action={canWriteSessions ? (
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
                canWrite={canWriteSessions}
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
        title="Attachments"
        emptyMessage={session ? 'No attachments.' : 'No session selected.'}
        action={canWriteSessions ? (
          <Button
            size="sm"
            variant="secondary"
            disabled={!session}
            aria-label="Add attachments"
            onClick={() => { if (session) setAttachmentTarget(session); }}
          >
            + Add
          </Button>
        ) : undefined}
      >
        {session ? attachmentsLoading ? (
          <p role="status">Loading attachments…</p>
        ) : attachmentsError ? (
          <p role="alert">{attachmentsError}</p>
        ) : attachments.length ? (
          <div className="session-notes-list">
            {attachments.map(attachment => (
              <article key={attachment.id} className="session-note">
                <div className="session-note__main">
                  <strong>{attachment.title}</strong>
                  <span className="session-note__meta">
                    {attachment.originalFilename} · {Math.max(1, Math.round(attachment.fileSize / 1024))} KB
                  </span>
                </div>
                <div className="session-note__actions">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="session-note__action-button"
                    aria-label={`Download ${attachment.title}`}
                    title="Download attachment"
                    onClick={() => void downloadSessionAttachment(session.id, attachment)}
                  >
                    <FontAwesomeIcon icon={faDownload} aria-hidden="true" />
                  </Button>
                  {canWriteSessions && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="session-note__action-button session-note__action-button--danger"
                      aria-label={`Delete ${attachment.title}`}
                      title="Delete attachment"
                      onClick={() => setConfirmAction({
                        title: 'Delete Attachment',
                        message: `Delete “${attachment.title}”? This cannot be undone.`,
                        confirmLabel: 'Delete',
                        confirmVariant: 'danger',
                        successMessage: 'Attachment successfully deleted.',
                        onConfirm: async () => {
                          await deleteSessionAttachment(session.id, attachment.id);
                          await loadAttachments(session.id);
                        },
                      })}
                    >
                      <FontAwesomeIcon icon={faTrash} aria-hidden="true" />
                    </Button>
                  )}
                </div>
              </article>
            ))}
          </div>
        ) : <p className="dashboard-card__empty">No attachments.</p> : undefined}
      </DashboardCard>
      <SessionAttachmentModal
        session={attachmentTarget}
        onClose={() => setAttachmentTarget(null)}
        onSaved={async () => { if (attachmentTarget) await loadAttachments(attachmentTarget.id); }}
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
