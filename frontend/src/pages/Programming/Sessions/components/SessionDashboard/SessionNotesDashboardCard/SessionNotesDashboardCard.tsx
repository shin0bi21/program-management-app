import Button from '../../../../../../common/components/Button/Button';
import ConfirmModal from '../../../../../../common/components/ConfirmModal/ConfirmModal';
import { DashboardCard } from '../../../../../../common/components/DashboardCard/DashboardCard';
import Modal from '../../../../../../common/components/Modal/Modal';
import SessionNoteDetails from '../../../../../../common/features/notes/components/SessionNoteDetails/SessionNoteDetails';
import SessionNoteModal from '../../../../../../common/features/notes/components/SessionNoteModal/SessionNoteModal';
import SessionNoteRow from '../../../../../../common/features/notes/components/SessionNoteRow/SessionNoteRow';
import type { CohortSession } from '../../../../../../common/types/cohort';
import { type PageErrorChangeHandler } from '../../../../../../common/components/PageErrorOverlay/usePageErrorReporter';
import UnavailableState from '../../../../../../common/components/UnavailableState/UnavailableState';
import { useSessionNotes } from './hooks/useSessionNotes';

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
  const workflow = useSessionNotes({ queryKey, session, onErrorChange });
  const { query, noteTarget, editNote, detailNote, confirmAction, loadNotes, openAdd, openEdit, closeEditor, setDetailNote, requestDelete, setConfirmAction } = workflow;
  const title = session && !query.isLoading && !query.error
    ? `Session Notes (${query.data?.length ?? 0})`
    : 'Session Notes';
  return <>
    <DashboardCard
      title={title}
      emptyMessage={session ? 'No notes.' : 'No session selected.'}
      action={canWrite ? <Button size="sm" variant="secondary" disabled={!session} aria-label="Add notes" onClick={openAdd}>+ Add</Button> : undefined}
    >
      {session ? query.isLoading ? <p className="dashboard-card__empty">Loading notes…</p>
        : query.error ? <UnavailableState compact title="Session notes unavailable" onRetry={query.refetch} />
        : query.data?.length ? <div className="note-list">{query.data.map(note => <SessionNoteRow
          key={note.id}
          note={note}
          date={note.createdAt}
          onView={setDetailNote}
          onEdit={canWrite ? openEdit : undefined}
          onDelete={canWrite ? requestDelete : undefined}
        />)}</div> : <p className="dashboard-card__empty">No notes.</p> : undefined}
    </DashboardCard>
    <SessionNoteModal session={noteTarget} note={editNote} onClose={closeEditor} onSaved={loadNotes} />
    <Modal isOpen={detailNote !== null} onClose={() => setDetailNote(null)} title="Session Note" footer={<Button variant="secondary" onClick={() => setDetailNote(null)}>Close</Button>}>
      {detailNote && <SessionNoteDetails note={detailNote} />}
    </Modal>
    <ConfirmModal action={confirmAction} onClose={() => setConfirmAction(null)} />
  </>;
}
