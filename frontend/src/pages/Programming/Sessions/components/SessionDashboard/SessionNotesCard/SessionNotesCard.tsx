import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Button from '../../../../../../common/components/Button/Button';
import { DashboardCard } from '../../../../../../common/components/DashboardCard/DashboardCard';
import Modal from '../../../../../../common/components/Modal/Modal';
import { useConfirmModal, type ConfirmAction } from '../../../../../../common/components/Modal/hooks/useConfirmModal';
import SessionNoteDetails from '../../../../../../common/features/notes/components/SessionNoteDetails/SessionNoteDetails';
import SessionNoteModal from '../../../../../../common/features/notes/components/SessionNoteModal/SessionNoteModal';
import SessionNoteRow from '../../../../../../common/features/notes/components/SessionNoteRow/SessionNoteRow';
import { deleteSessionNote, getSessionNotes } from '../../../../../../common/features/programming/api/programming.api';
import type { CohortSession, SessionNote } from '../../../../../../common/types/cohort';

export default function SessionNotesCard({ session, canWrite }: { session: CohortSession | null; canWrite: boolean }) {
  const [noteTarget, setNoteTarget] = useState<CohortSession | null>(null);
  const [editNote, setEditNote] = useState<SessionNote | null>(null);
  const [detailNote, setDetailNote] = useState<SessionNote | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const query = useQuery({
    queryKey: ['sessions', session?.id, 'notes'],
    queryFn: ({ signal }) => getSessionNotes(session!.id, { signal }),
    enabled: session !== null,
  });
  const confirmModal = useConfirmModal({ action: confirmAction, onClose: () => setConfirmAction(null) });
  const loadNotes = async () => { await query.refetch(); };
  useEffect(() => {
    setNoteTarget(null); setEditNote(null); setDetailNote(null); setConfirmAction(null);
  }, [session?.id]);

  return <>
    <DashboardCard
      title="Session Notes"
      emptyMessage={session ? 'No notes.' : 'No session selected.'}
      action={canWrite ? <Button size="sm" variant="secondary" disabled={!session} aria-label="Add notes" onClick={() => { if (session) setNoteTarget(session); }}>+ Add</Button> : undefined}
    >
      {session ? query.isLoading ? <p className="dashboard-card__empty">Loading notes…</p>
        : query.error ? <p className="form-error">{query.error instanceof Error ? query.error.message : 'Could not load session notes'}</p>
        : query.data?.length ? <div className="note-list">{query.data.map(note => <SessionNoteRow
          key={note.id}
          note={note}
          date={note.createdAt}
          onView={setDetailNote}
          onEdit={canWrite ? value => { setEditNote(value); setNoteTarget(session); } : undefined}
          onDelete={canWrite ? value => setConfirmAction({
            title: 'Delete Note', message: `Delete “${value.title}”? This cannot be undone.`, confirmLabel: 'Delete',
            confirmVariant: 'danger', successMessage: 'Session note successfully deleted.',
            onConfirm: async () => { await deleteSessionNote(session.id, value.id); await loadNotes(); if (detailNote?.id === value.id) setDetailNote(null); },
          }) : undefined}
        />)}</div> : <p className="dashboard-card__empty">No notes.</p> : undefined}
    </DashboardCard>
    <SessionNoteModal session={noteTarget} note={editNote} onClose={() => { setNoteTarget(null); setEditNote(null); }} onSaved={loadNotes} />
    <Modal isOpen={detailNote !== null} onClose={() => setDetailNote(null)} title={detailNote?.title ?? ''} footer={<Button variant="secondary" onClick={() => setDetailNote(null)}>Close</Button>}>
      {detailNote && <SessionNoteDetails note={detailNote} />}
    </Modal>
    <Modal isOpen={confirmAction !== null} onClose={() => setConfirmAction(null)} title={confirmAction?.title ?? ''} footer={confirmModal.footer} status={confirmModal.status} statusMessage={confirmModal.statusMessage} successDelay={confirmModal.successDelay}>
      <p>{confirmAction?.message}</p>
    </Modal>
  </>;
}
