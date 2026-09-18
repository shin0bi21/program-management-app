import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronLeft, faChevronRight } from '@fortawesome/free-solid-svg-icons';
import Button from '../../../../../../common/components/Button/Button';
import ConfirmModal from '../../../../../../common/components/ConfirmModal/ConfirmModal';
import { DashboardCard } from '../../../../../../common/components/DashboardCard/DashboardCard';
import Modal from '../../../../../../common/components/Modal/Modal';
import SessionNoteDetails from '../../SessionNoteDetails/SessionNoteDetails';
import SessionNoteModal from '../../SessionNoteModal/SessionNoteModal';
import SessionNoteRow from '../../SessionNoteRow/SessionNoteRow';
import type { CohortSession } from '../../../types';
import { type PageErrorChangeHandler } from '../../../../../../common/components/PageErrorOverlay/usePageErrorReporter';
import UnavailableState from '../../../../../../common/components/UnavailableState/UnavailableState';
import { useSessionNotes } from './hooks/useSessionNotes';
import './SessionNotesDashboardCard.css';

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
  const notes = query.data ?? [];
  const detailNoteIndex = detailNote
    ? notes.findIndex(note => note.id === detailNote.id)
    : -1;
  const showDetailNavigation = notes.length > 1 && detailNoteIndex >= 0;
  const showPreviousNote = () => setDetailNote(notes[detailNoteIndex - 1] ?? detailNote);
  const showNextNote = () => setDetailNote(notes[detailNoteIndex + 1] ?? detailNote);

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
    <Modal
      isOpen={detailNote !== null}
      onClose={() => setDetailNote(null)}
      title="Session Note"
      footer={<>
        {showDetailNavigation && (
          <div className="session-note-navigation" role="group" aria-label="Session note navigation">
            <Button
              size="sm"
              variant="secondary"
              aria-label="Previous session note"
              disabled={detailNoteIndex === 0}
              onClick={showPreviousNote}
            >
              <FontAwesomeIcon icon={faChevronLeft} aria-hidden="true" />
            </Button>
            <span className="session-note-navigation__position" aria-live="polite">
              {detailNoteIndex + 1} of {notes.length}
            </span>
            <Button
              size="sm"
              variant="secondary"
              aria-label="Next session note"
              disabled={detailNoteIndex === notes.length - 1}
              onClick={showNextNote}
            >
              <FontAwesomeIcon icon={faChevronRight} aria-hidden="true" />
            </Button>
          </div>
        )}
        <Button variant="secondary" onClick={() => setDetailNote(null)}>Close</Button>
      </>}
    >
      {detailNote && <SessionNoteDetails note={detailNote} />}
    </Modal>
    <ConfirmModal action={confirmAction} onClose={() => setConfirmAction(null)} />
  </>;
}
