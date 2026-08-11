import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPen, faTrash } from '@fortawesome/free-solid-svg-icons';
import Button from '../../../../../common/components/Button/Button';
import { DashboardCard } from '../../../../../common/components/DashboardCard/DashboardCard';
import Modal from '../../../../../common/components/Modal/Modal';
import { useConfirmModal, type ConfirmAction } from '../../../../../common/components/Modal/hooks/useConfirmModal';
import { formatShortDate } from '../../../../../common/utils/date';
import { deleteLeadNote, getLeadNotes } from '../../api/leads.api';
import type { Lead, LeadNote } from '../../types';
import LeadNoteModal from '../LeadNoteModal/LeadNoteModal';
import './LeadNotesCard.css';

export default function LeadNotesCard({ lead, canWrite }: { lead: Lead | null; canWrite: boolean }) {
  const queryClient = useQueryClient();
  const [noteTarget, setNoteTarget] = useState<LeadNote | 'new' | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const queryKey = ['leads', lead?.id, 'notes'] as const;
  const query = useQuery({
    queryKey,
    queryFn: ({ signal }) => getLeadNotes(lead!.id, { signal }),
    enabled: lead !== null,
  });
  const confirmModal = useConfirmModal({ action: confirmAction, onClose: () => setConfirmAction(null) });
  const notes = query.data ?? [];

  return <>
    <DashboardCard
      title="Follow-up notes"
      action={canWrite ? <Button size="sm" variant="secondary" aria-label="Add follow-up note" disabled={!lead} onClick={() => setNoteTarget('new')}>+ Add</Button> : undefined}
    >
      {!lead ? (
        <p className="dashboard-card__empty">Select a lead to view follow-up notes.</p>
      ) : query.isLoading ? (
        <p role="status">Loading follow-up notes…</p>
      ) : query.error ? (
        <p role="alert">Could not load follow-up notes.</p>
      ) : notes.length ? (
        <div className="lead-notes-list">
          {notes.map(note => (
            <article className="lead-note-row" key={note.id}>
              <strong className="lead-note-row__title" title={note.details}>{note.details}</strong>
              <span className="lead-note-row__author" title={note.createdByName || 'Former staff member'}>
                {note.createdByName || 'Former staff member'}
              </span>
              <span className="lead-note-row__date">{formatShortDate(note.createdAt)}</span>
              {canWrite && <span className="lead-note-row__actions">
                <Button size="sm" variant="ghost" aria-label={`Edit follow-up note from ${formatShortDate(note.createdAt)}`} onClick={() => setNoteTarget(note)}>
                  <FontAwesomeIcon icon={faPen} aria-hidden="true" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="lead-note-row__delete"
                  aria-label={`Delete follow-up note from ${formatShortDate(note.createdAt)}`}
                  onClick={() => setConfirmAction({
                    title: 'Delete Follow-up Note',
                    message: 'Delete this follow-up note? This cannot be undone.',
                    confirmLabel: 'Delete',
                    confirmVariant: 'danger',
                    successMessage: 'Follow-up note deleted.',
                    onConfirm: async () => {
                      await deleteLeadNote(lead.id, note.id);
                      queryClient.setQueryData<LeadNote[]>(queryKey, current =>
                        current?.filter(currentNote => currentNote.id !== note.id) ?? []);
                    },
                  })}
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
      lead={noteTarget && lead ? lead : null}
      note={noteTarget === 'new' ? null : noteTarget}
      onClose={() => setNoteTarget(null)}
      onSaved={savedNote => {
        queryClient.setQueryData<LeadNote[]>(queryKey, current => {
          const rows = current ?? [];
          return rows.some(note => note.id === savedNote.id)
            ? rows.map(note => note.id === savedNote.id ? savedNote : note)
            : [savedNote, ...rows];
        });
      }}
    />
    <Modal
      isOpen={confirmAction !== null}
      onClose={() => setConfirmAction(null)}
      title={confirmAction?.title ?? ''}
      status={confirmModal.status}
      statusMessage={confirmModal.statusMessage}
      footer={confirmModal.footer}
      successDelay={confirmModal.successDelay}
    >
      {confirmAction && <p>{confirmAction.message}</p>}
    </Modal>
  </>;
}
