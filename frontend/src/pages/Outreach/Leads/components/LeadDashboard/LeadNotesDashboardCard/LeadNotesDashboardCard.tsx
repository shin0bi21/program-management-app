import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPen, faTrash } from '@fortawesome/free-solid-svg-icons';
import Button from '../../../../../../common/components/Button/Button';
import { DashboardCard } from '../../../../../../common/components/DashboardCard/DashboardCard';
import Modal from '../../../../../../common/components/Modal/Modal';
import { useConfirmModal } from '../../../../../../common/components/Modal/hooks/useConfirmModal';
import { formatShortDate } from '../../../../../../common/utils/date';
import type { Lead } from '../../../types';
import LeadNoteModal from '../../LeadNoteModal/LeadNoteModal';
import useLeadNotes from './useLeadNotes';
import './LeadNotesDashboardCard.css';

export default function LeadNotesDashboardCard({ lead, canWrite }: { lead: Lead | null; canWrite: boolean }) {
  const notes = useLeadNotes(lead);
  const confirmModal = useConfirmModal({ action: notes.confirmAction, onClose: notes.closeConfirmation });

  return <>
    <DashboardCard
      title="Follow-up notes"
      action={canWrite ? <Button size="sm" variant="secondary" aria-label="Add follow-up note" disabled={!lead} onClick={notes.openCreate}>+ Add</Button> : undefined}
    >
      {!lead ? (
        <p className="dashboard-card__empty">Select a lead to view follow-up notes.</p>
      ) : notes.loading ? (
        <p role="status">Loading follow-up notes…</p>
      ) : notes.error ? (
        <p role="alert">Could not load follow-up notes.</p>
      ) : notes.notes.length ? (
        <div className="lead-notes-list">
          {notes.notes.map(note => (
            <article className="lead-note-row" key={note.id}>
              <strong className="lead-note-row__title" title={note.details}>{note.details}</strong>
              <span className="lead-note-row__author" title={note.createdByName || 'Former staff member'}>
                {note.createdByName || 'Former staff member'}
              </span>
              <span className="lead-note-row__date">{formatShortDate(note.createdAt)}</span>
              {canWrite && <span className="lead-note-row__actions">
                <Button size="sm" variant="ghost" aria-label={`Edit follow-up note from ${formatShortDate(note.createdAt)}`} onClick={() => notes.openEdit(note)}>
                  <FontAwesomeIcon icon={faPen} aria-hidden="true" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="lead-note-row__delete"
                  aria-label={`Delete follow-up note from ${formatShortDate(note.createdAt)}`}
                  onClick={() => notes.requestDelete(note)}
                >
                  <FontAwesomeIcon icon={faTrash} aria-hidden="true" />
                </Button>
              </span>}
            </article>
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
      isOpen={notes.confirmAction !== null}
      onClose={notes.closeConfirmation}
      title={notes.confirmAction?.title ?? ''}
      status={confirmModal.status}
      statusMessage={confirmModal.statusMessage}
      footer={confirmModal.footer}
      successDelay={confirmModal.successDelay}
    >
      {notes.confirmAction && <p>{notes.confirmAction.message}</p>}
    </Modal>
  </>;
}
