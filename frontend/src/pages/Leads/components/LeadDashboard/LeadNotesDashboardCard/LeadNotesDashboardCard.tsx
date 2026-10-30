import { useMemo } from 'react';
import Button from '../../../../../common/components/Button/Button';
import { DashboardCard } from '../../../../../common/components/DashboardCard/DashboardCard';
import Modal from '../../../../../common/components/Modal/Modal';
import NoteDetails from '../../../../../common/features/Notes/NoteDetails/NoteDetails';
import NoteCategoryLabel from '../../../../../common/features/Notes/NoteCategoryLabel/NoteCategoryLabel';
import NoteRow from '../../../../../common/features/Notes/NoteRow/NoteRow';
import type { Lead } from '../../../types';
import useLeadNotes from './useLeadNotes';
import './LeadNotesDashboardCard.css';
import usePageMessageReporter, { type PageMessageChangeHandler } from '../../../../../common/components/PageMessageOverlay/usePageMessageReporter';
import UnavailableState from '../../../../../common/components/UnavailableState/UnavailableState';
import LeadNoteEditModal from './LeadNoteEditModal';
import LeadNoteModal from '../../LeadNoteModal/LeadNoteModal';
import ConfirmModal from '../../../../../common/components/ConfirmModal/ConfirmModal';

export default function LeadNotesDashboardCard({ lead, canWrite, onMessageChange }: {
  lead: Lead | null;
  canWrite: boolean;
  onMessageChange?: PageMessageChangeHandler;
}) {
  const notes = useLeadNotes(lead);
  const retryAction = useMemo(() => ({ label: 'Retry', onClick: notes.retry }), [notes.retry]);
  const title = lead && !notes.loading && !notes.error
    ? `Notes (${notes.notes.length})`
    : 'Notes';
  usePageMessageReporter(onMessageChange, notes.error ? 'Could not load follow-up notes.' : null, retryAction);
  return <>
    <DashboardCard
      title={title}
      loading={!!lead && notes.loading}
      loadingLabel="Loading follow-up notes…"
      action={canWrite ? <Button size="sm" variant="secondary" aria-label="Add follow-up note" disabled={!lead} onClick={notes.openCreate}>+ Add</Button> : undefined}
    >
      {!lead ? (
        <p className="dashboard-card__empty">Select a lead to view follow-up notes.</p>
      ) : notes.error ? (
        <UnavailableState compact title="Follow-up notes unavailable" onRetry={notes.retry} />
      ) : notes.notes.length ? (
        <div className="note-list">
          {notes.notes.map(note => (
            <NoteRow
              key={note.id}
              ariaLabel="follow-up note"
              compact
              categoryLabel={<NoteCategoryLabel category="follow_up" label="Follow-up" />}
              date={note.createdAt}
              onView={() => notes.openDetails(note)}
              onEdit={canWrite ? () => notes.openEditor(note) : undefined}
              onDelete={canWrite ? () => notes.requestDelete(note) : undefined}
            />
          ))}
        </div>
      ) : (
        <p className="dashboard-card__empty">No follow-up notes recorded.</p>
      )}
    </DashboardCard>
    <Modal
      isOpen={notes.selectedNote !== null}
      onClose={notes.closeDetails}
      title="Follow-up Note"
      footer={<Button variant="secondary" onClick={notes.closeDetails}>Close</Button>}
    >
      {notes.selectedNote && <NoteDetails
        categoryLabel={<NoteCategoryLabel category="follow_up" label="Follow-up" />}
        createdAt={notes.selectedNote.createdAt}
        createdByName={notes.selectedNote.createdByName}
        details={notes.selectedNote.details}
      />}
    </Modal>
    <LeadNoteModal
      lead={notes.creating ? lead : null}
      onClose={notes.closeCreate}
      onSaved={notes.handleCreated}
    />
    <LeadNoteEditModal
      note={notes.editorTarget}
      onClose={notes.closeEditor}
      onSaved={notes.handleSaved}
    />
    <ConfirmModal action={notes.confirmAction} onClose={notes.closeConfirmation} />
  </>;
}
