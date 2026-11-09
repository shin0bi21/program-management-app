import { useMemo, type ReactNode } from 'react';
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
import LeadNoteModal from '../../LeadNoteModal/LeadNoteModal';
import ConfirmModal from '../../../../../common/components/ConfirmModal/ConfirmModal';

/**
 * Displays the selected lead's notes and owns its note dialogs.
 * @param props - Selected lead, note write permission, and page-message callback.
 * @example <LeadNotesDashboardCard lead={lead} canWrite />
 */
export default function LeadNotesDashboardCard({ lead, canWrite, onMessageChange }: {
  lead: Lead | null;
  canWrite: boolean;
  onMessageChange?: PageMessageChangeHandler;
}) {
  const notes = useLeadNotes(lead);
  const isNoteModalOpen = notes.creating || notes.editorTarget !== null;
  const retryAction = useMemo(() => ({ label: 'Retry', onClick: notes.retry }), [notes.retry]);
  const title = lead && !notes.loading && !notes.error
    ? `Notes (${notes.notes.length})`
    : 'Notes';
  usePageMessageReporter(onMessageChange, notes.error ? 'Could not load follow-up notes.' : null, retryAction);
  let content: ReactNode;
  if (!lead) {
    content = <p className="dashboard-card__empty">Select a lead to view follow-up notes.</p>;
  } else if (notes.error) {
    content = <UnavailableState compact title="Follow-up notes unavailable" onRetry={notes.retry} />;
  } else if (notes.notes.length === 0) {
    content = <p className="dashboard-card__empty">No follow-up notes recorded.</p>;
  } else {
    content = <div className="note-list">
      {notes.notes.map(note => <NoteRow
        key={note.id}
        ariaLabel="follow-up note"
        compact
        categoryLabel={<NoteCategoryLabel category="follow_up" label="Follow-up" />}
        date={note.createdAt}
        onView={() => notes.openDetails(note)}
        onEdit={canWrite ? () => notes.openEditor(note) : undefined}
        onDelete={canWrite ? () => notes.requestDelete(note) : undefined}
      />)}
    </div>;
  }

  return <>
    <DashboardCard
      title={title}
      loading={!!lead && notes.loading}
      loadingLabel="Loading follow-up notes…"
      action={canWrite ? <Button size="sm" variant="secondary" aria-label="Add follow-up note" disabled={!lead} onClick={notes.openCreate}>+ Add</Button> : undefined}
    >
      {content}
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
    {lead && isNoteModalOpen && <LeadNoteModal
      key={`${lead.id}:${notes.editorTarget?.id ?? 'new'}`}
      lead={lead}
      note={notes.editorTarget ?? undefined}
      onClose={notes.creating ? notes.closeCreate : notes.closeEditor}
      onSaved={notes.creating ? notes.handleCreated : notes.handleSaved}
    />}
    <ConfirmModal action={notes.confirmAction} onClose={notes.closeConfirmation} />
  </>;
}
