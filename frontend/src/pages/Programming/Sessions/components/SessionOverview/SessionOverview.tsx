import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  deleteSessionAttachment,
  deleteSessionNote,
  getSessionAttachments,
  getSessionNotes,
} from '../../../../../common/features/programming/api/programming.api';
import Button from '../../../../../common/components/Button/Button';
import { DashboardCard } from '../../../../../common/components/DashboardCard/DashboardCard';
import Modal from '../../../../../common/components/Modal/Modal';
import SessionNoteDetails from '../../../../../common/features/notes/components/SessionNoteDetails/SessionNoteDetails';
import SessionNoteModal from '../../../../../common/features/notes/components/SessionNoteModal/SessionNoteModal';
import SessionNoteRow from '../../../../../common/features/notes/components/SessionNoteRow/SessionNoteRow';
import { useConfirmModal, type ConfirmAction } from '../../../../../common/components/Modal/hooks/useConfirmModal';
import type { CohortSession, SessionAttachment, SessionNote } from '../../../../../common/types/cohort';
import SessionAttachmentModal from '../SessionAttachmentModal/SessionAttachmentModal';
import SessionAttachmentRow from '../SessionAttachmentRow/SessionAttachmentRow';
import SessionAttachmentViewerModal from '../SessionAttachmentViewerModal/SessionAttachmentViewerModal';

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
    <div className="note-list">
      {notes.map(note => (
        <SessionNoteRow
          key={note.id}
          note={note}
          date={note.createdAt}
          onView={onView}
          onEdit={canWrite ? onEdit : undefined}
          onDelete={canWrite ? onDelete : undefined}
        />
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
  const [attachmentTarget, setAttachmentTarget] = useState<CohortSession | null>(null);
  const [editAttachment, setEditAttachment] = useState<SessionAttachment | null>(null);
  const [detailAttachment, setDetailAttachment] = useState<SessionAttachment | null>(null);
  const notesQuery = useQuery({
    queryKey: ['sessions', session?.id, 'notes'],
    queryFn: ({ signal }) => getSessionNotes(session!.id, { signal }),
    enabled: session !== null,
  });
  const attachmentsQuery = useQuery({
    queryKey: ['sessions', session?.id, 'attachments'],
    queryFn: ({ signal }) => getSessionAttachments(session!.id, { signal }),
    enabled: session !== null,
  });
  const notes = notesQuery.data ?? [];
  const attachments = attachmentsQuery.data ?? [];
  const confirmModal = useConfirmModal({
    action: confirmAction,
    onClose: () => setConfirmAction(null),
  });

  const loadNotes = async () => { await notesQuery.refetch(); };
  const loadAttachments = async () => { await attachmentsQuery.refetch(); };

  useEffect(() => {
    setNoteTarget(null);
    setEditNote(null);
    setDetailNote(null);
    setConfirmAction(null);
    setAttachmentTarget(null);
    setEditAttachment(null);
    setDetailAttachment(null);
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
        title="Session Notes"
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
                loading={notesQuery.isLoading}
                error={notesQuery.error instanceof Error ? notesQuery.error.message : null}
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
                    await loadNotes();
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
        {session ? attachmentsQuery.isLoading ? (
          <p role="status">Loading attachments…</p>
        ) : attachmentsQuery.error ? (
          <p role="alert">{attachmentsQuery.error instanceof Error ? attachmentsQuery.error.message : 'Could not load session attachments'}</p>
        ) : attachments.length ? (
          <div className="session-attachment-list">
            {attachments.map(attachment => (
              <SessionAttachmentRow
                key={attachment.id}
                attachment={attachment}
                onView={() => setDetailAttachment(attachment)}
                onEdit={canWriteSessions ? () => {
                  setEditAttachment(attachment);
                  setAttachmentTarget(session);
                } : undefined}
                onDelete={canWriteSessions ? () => setConfirmAction({
                  title: 'Delete Attachment',
                  message: `Delete “${attachment.title}”? This cannot be undone.`,
                  confirmLabel: 'Delete',
                  confirmVariant: 'danger',
                  successMessage: 'Attachment successfully deleted.',
                  onConfirm: async () => {
                    await deleteSessionAttachment(session.id, attachment.id);
                    await loadAttachments();
                    if (detailAttachment?.id === attachment.id) setDetailAttachment(null);
                  },
                }) : undefined}
              />
            ))}
          </div>
        ) : <p className="dashboard-card__empty">No attachments.</p> : undefined}
      </DashboardCard>
      <SessionAttachmentModal
        session={attachmentTarget}
        attachment={editAttachment}
        onClose={() => {
          setAttachmentTarget(null);
          setEditAttachment(null);
        }}
        onSaved={loadAttachments}
      />
      <SessionAttachmentViewerModal
        session={session}
        attachment={detailAttachment}
        onClose={() => setDetailAttachment(null)}
      />
      <SessionNoteModal
        session={noteTarget}
        note={editNote}
        onClose={() => {
          setNoteTarget(null);
          setEditNote(null);
        }}
        onSaved={async () => {
          if (noteTarget) await loadNotes();
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
      >
        <p>{confirmAction?.message}</p>
      </Modal>
    </>
  );
}
