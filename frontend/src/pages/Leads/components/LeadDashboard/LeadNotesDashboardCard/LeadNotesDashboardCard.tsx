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

const statusLabel = (status: Lead['status'] | null) => status === null
  ? 'Historical'
  : status === 'signed_up'
  ? 'Signed up'
  : status.charAt(0).toUpperCase() + status.slice(1);

const badgeCategory = (status: Lead['status'] | null) => status ?? 'historical';

export default function LeadNotesDashboardCard({ lead, canWrite, onAddStatusUpdate, onErrorChange }: {
  lead: Lead | null;
  canWrite: boolean;
  onAddStatusUpdate: (lead: Lead) => void;
  onErrorChange?: PageErrorChangeHandler;
}) {
  const notes = useLeadNotes(lead);
  const retryAction = useMemo(() => ({ label: 'Retry', onClick: notes.retry }), [notes.retry]);
  const title = lead && !notes.loading && !notes.error
    ? `Status Updates (${notes.notes.length})`
    : 'Status Updates';
  usePageErrorReporter(onErrorChange, notes.error ? 'Could not load status updates.' : null, retryAction);
  return <>
    <DashboardCard
      title={title}
      action={canWrite ? <Button size="sm" variant="secondary" aria-label="Add status update" disabled={!lead || lead.status === 'signed_up'} onClick={() => lead && onAddStatusUpdate(lead)}>+ Add</Button> : undefined}
    >
      {!lead ? (
        <p className="dashboard-card__empty">Select a lead to view status updates.</p>
      ) : notes.loading ? (
        <p role="status">Loading status updates…</p>
      ) : notes.error ? (
        <UnavailableState compact title="Status updates unavailable" onRetry={notes.retry} />
      ) : notes.notes.length ? (
        <div className="note-list">
          {notes.notes.map(note => (
            <NoteRow
              key={note.id}
              ariaLabel="status update"
              compact
              categoryBadge={<NoteCategoryBadge category={badgeCategory(note.category)} label={statusLabel(note.category)} />}
              date={note.createdAt}
              onView={() => notes.openDetails(note)}
            />
          ))}
        </div>
      ) : (
        <p className="dashboard-card__empty">No status updates recorded.</p>
      )}
    </DashboardCard>
    <Modal
      isOpen={notes.selectedNote !== null}
      onClose={notes.closeDetails}
      title="Status Update"
      footer={<Button variant="secondary" onClick={notes.closeDetails}>Close</Button>}
    >
      {notes.selectedNote && <NoteDetails
        categoryBadge={<NoteCategoryBadge category={badgeCategory(notes.selectedNote.category)} label={statusLabel(notes.selectedNote.category)} />}
        createdAt={notes.selectedNote.createdAt}
        createdByName={notes.selectedNote.createdByName}
        details={notes.selectedNote.details}
      />}
    </Modal>
  </>;
}
