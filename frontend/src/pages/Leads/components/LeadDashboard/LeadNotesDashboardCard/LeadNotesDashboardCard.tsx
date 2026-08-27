import { useMemo } from 'react';
import Button from '../../../../../common/components/Button/Button';
import { DashboardCard } from '../../../../../common/components/DashboardCard/DashboardCard';
import Modal from '../../../../../common/components/Modal/Modal';
import NoteDetails from '../../../../../common/features/notes/components/NoteDetails/NoteDetails';
import NoteCategoryBadge from '../../../../../common/features/notes/components/NoteCategoryBadge/NoteCategoryBadge';
import NoteRow from '../../../../../common/features/notes/components/NoteRow/NoteRow';
import type { Lead } from '../../../types';
import useLeadNotes from './useLeadNotes';
import './LeadNotesDashboardCard.css';
import usePageErrorReporter, { type PageErrorChangeHandler } from '../../../../../common/components/PageErrorOverlay/usePageErrorReporter';
import UnavailableState from '../../../../../common/components/UnavailableState/UnavailableState';
import LeadNoteEditModal from './LeadNoteEditModal';
import LeadNoteModal from '../../LeadNoteModal/LeadNoteModal';
import ConfirmModal from '../../../../../common/components/ConfirmModal/ConfirmModal';

export default function LeadNotesDashboardCard({ lead, canWrite, onErrorChange }: {
  lead: Lead | null;
  canWrite: boolean;
  onErrorChange?: PageErrorChangeHandler;
}) {
  const notes = useLeadNotes(lead);
  const retryAction = useMemo(() => ({ label: 'Retry', onClick: notes.retry }), [notes.retry]);
  const title = lead && !notes.loading && !notes.error
    ? `Notes (${notes.notes.length})`
    : 'Notes';
  usePageErrorReporter(onErrorChange, notes.error ? 'Could not load follow-up notes.' : null, retryAction);
  return <>
    <DashboardCard
      title={title}
      action={canWrite ? <Button size="sm" variant="secondary" aria-label="Add follow-up note" disabled={!lead} onClick={notes.openCreate}>+ Add</Button> : undefined}
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
              ariaLabel="follow-up note"
              compact
              categoryBadge={<NoteCategoryBadge category="follow_up" label="Follow-up" />}
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
        categoryBadge={<NoteCategoryBadge category="follow_up" label="Follow-up" />}
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
