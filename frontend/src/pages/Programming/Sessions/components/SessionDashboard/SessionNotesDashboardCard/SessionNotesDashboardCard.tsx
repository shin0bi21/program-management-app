import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Button from '../../../../../../common/components/Button/Button';
import ConfirmModal from '../../../../../../common/components/ConfirmModal/ConfirmModal';
import { type ConfirmAction } from '../../../../../../common/components/ConfirmModal/types';
import { DashboardCard } from '../../../../../../common/components/DashboardCard/DashboardCard';
import Modal from '../../../../../../common/components/Modal/Modal';
import SessionNoteDetails from '../../../../../../common/features/notes/components/SessionNoteDetails/SessionNoteDetails';
import SessionNoteModal from '../../../../../../common/features/notes/components/SessionNoteModal/SessionNoteModal';
import SessionNoteRow from '../../../../../../common/features/notes/components/SessionNoteRow/SessionNoteRow';
import { deleteSessionNote, getSessionNotes } from '../../../../../../common/features/programming/api/sessions.api';
import type { CohortSession, SessionNote } from '../../../../../../common/types/cohort';
import usePageErrorReporter, { type PageErrorChangeHandler } from '../../../../../../common/components/PageErrorOverlay/usePageErrorReporter';
import UnavailableState from '../../../../../../common/components/UnavailableState/UnavailableState';

export default function SessionNotesDashboardCard({
  queryKey,
  session,
  canWrite,
  onErrorChange,
}: {
  queryKey: readonly unknown[];
  session: CohortSession | null;
  canWrite: boolean;
  onErrorChange?: PageErrorChangeHandler;
}) {
  const [noteTarget, setNoteTarget] = useState<CohortSession | null>(null);
  const [editNote, setEditNote] = useState<SessionNote | null>(null);
  const [detailNote, setDetailNote] = useState<SessionNote | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const query = useQuery({
    queryKey: [...queryKey, session?.id, 'notes'],
    queryFn: ({ signal }) => getSessionNotes(session!.id, { signal }),
    enabled: session !== null,
  });
  const retryAction = useMemo(() => ({ label: 'Retry', onClick: query.refetch }), [query.refetch]);
  usePageErrorReporter(onErrorChange, query.error ? 'Could not load session notes.' : null, retryAction);
  const loadNotes = async () => { await query.refetch(); };
  const title = session && !query.isLoading && !query.error
    ? `Session Notes (${query.data?.length ?? 0})`
    : 'Session Notes';
  useEffect(() => {
    setNoteTarget(null); setEditNote(null); setDetailNote(null); setConfirmAction(null);
  }, [session?.id]);

  return <>
    <DashboardCard
      title={title}
      emptyMessage={session ? 'No notes.' : 'No session selected.'}
      action={canWrite ? <Button size="sm" variant="secondary" disabled={!session} aria-label="Add notes" onClick={() => { if (session) setNoteTarget(session); }}>+ Add</Button> : undefined}
    >
      {session ? query.isLoading ? <p className="dashboard-card__empty">Loading notes…</p>
        : query.error ? <UnavailableState compact title="Session notes unavailable" onRetry={query.refetch} />
        : query.data?.length ? <div className="note-list">{query.data.map(note => <SessionNoteRow
          key={note.id}
          note={note}
          date={note.createdAt}
          onView={setDetailNote}
          onEdit={canWrite ? value => { setEditNote(value); setNoteTarget(session); } : undefined}
          onDelete={canWrite ? value => setConfirmAction({
            title: 'Delete Note', message: 'Delete this session note? This cannot be undone.', confirmLabel: 'Delete',
            confirmVariant: 'danger', successMessage: 'Session note successfully deleted.',
            onConfirm: async () => { await deleteSessionNote(session.id, value.id); await loadNotes(); if (detailNote?.id === value.id) setDetailNote(null); },
          }) : undefined}
        />)}</div> : <p className="dashboard-card__empty">No notes.</p> : undefined}
    </DashboardCard>
    <SessionNoteModal session={noteTarget} note={editNote} onClose={() => { setNoteTarget(null); setEditNote(null); }} onSaved={loadNotes} />
    <Modal isOpen={detailNote !== null} onClose={() => setDetailNote(null)} title="Session Note" footer={<Button variant="secondary" onClick={() => setDetailNote(null)}>Close</Button>}>
      {detailNote && <SessionNoteDetails note={detailNote} />}
    </Modal>
    <ConfirmModal action={confirmAction} onClose={() => setConfirmAction(null)} />
  </>;
}
