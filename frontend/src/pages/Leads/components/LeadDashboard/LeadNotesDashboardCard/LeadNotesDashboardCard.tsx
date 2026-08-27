import { useMemo } from 'react';
import Button from '../../../../../common/components/Button/Button';
import ConfirmModal from '../../../../../common/components/ConfirmModal/ConfirmModal';
import { DashboardCard } from '../../../../../common/components/DashboardCard/DashboardCard';
import Modal from '../../../../../common/components/Modal/Modal';
import NoteDetails from '../../../../../common/features/notes/components/NoteDetails/NoteDetails';
import NoteRow from '../../../../../common/features/notes/components/NoteRow/NoteRow';
import type { Lead } from '../../../types';
import LeadNoteModal from '../../LeadNoteModal/LeadNoteModal';
import useLeadNotes from './useLeadNotes';
import './LeadNotesDashboardCard.css';
import usePageErrorReporter, { type PageErrorChangeHandler } from '../../../../../common/components/PageErrorOverlay/usePageErrorReporter';
import UnavailableState from '../../../../../common/components/UnavailableState/UnavailableState';

export default function LeadNotesDashboardCard({ lead, canWrite, onErrorChange }: {
  lead: Lead | null;
  canWrite: boolean;
  onErrorChange?: PageErrorChangeHandler;
}) {
  const notes = useLeadNotes(lead);
  const retryAction = useMemo(() => ({ label: 'Retry', onClick: notes.retry }), [notes.retry]);
  usePageErrorReporter(onErrorChange, notes.error ? 'Could not load follow-up notes.' : null, retryAction);
  return <>
    <DashboardCard
      title="Follow-up Notes"
      action={canWrite ? <Button size="sm" variant="secondary" aria-label="Add follow-up note" disabled={!lead} onClick={notes.openCreate}>Add follow-up</Button> : undefined}
    >
      {!lead ? (
        <p className="dashboard-card__empty">Select a lead to view follow-up notes.</p>
      ) : notes.loading ? (
        <p role="status">Loading follow-up notes…</p>
      ) : notes.error ? (
        <UnavailableState compact title="Follow-up notes unavailable" onRetry={notes.retry} />
      ) : notes.notes.length ? (
        <div className="note-list">
          {notes.notes.map(note => (
            <NoteRow
              key={note.id}
              title={note.details}
              compact
              emphasizeTitle={false}
              categoryBadge={null}
              author={note.createdByName || 'Former staff member'}
              date={note.createdAt}
              onView={() => notes.openDetails(note)}
              onEdit={canWrite ? () => notes.openEdit(note) : undefined}
              onDelete={canWrite ? () => notes.requestDelete(note) : undefined}
            />
          ))}
        </div>
      ) : (
        <p className="dashboard-card__empty">No follow-up notes recorded.</p>
      )}
    </DashboardCard>
    <LeadNoteModal
      lead={notes.noteTarget?.lead ?? null}
      note={notes.noteTarget?.note ?? null}
      onClose={notes.closeEditor}
      onSaved={notes.reconcileSavedNote}
    />
    <Modal
      isOpen={notes.selectedNote !== null}
      onClose={notes.closeDetails}
      title="Follow-up Note"
      footer={<Button variant="secondary" onClick={notes.closeDetails}>Close</Button>}
    >
      {notes.selectedNote && <NoteDetails
        categoryBadge={null}
        createdAt={notes.selectedNote.createdAt}
        createdByName={notes.selectedNote.createdByName}
        details={notes.selectedNote.details}
      />}
    </Modal>
    <ConfirmModal
      action={notes.confirmAction}
      onClose={notes.closeConfirmation}
    />
  </>;
}
