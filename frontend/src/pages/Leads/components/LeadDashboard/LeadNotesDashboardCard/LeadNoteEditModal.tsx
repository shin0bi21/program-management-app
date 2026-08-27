import NoteModal from '../../../../../common/features/notes/components/NoteModal/NoteModal';
import type { LeadNote } from '../../../types';
import useLeadNoteEditModal from './useLeadNoteEditModal';

export default function LeadNoteEditModal({ note, onClose, onSaved }: {
  note: LeadNote | null;
  onClose: () => void;
  onSaved: (note: LeadNote) => void;
}) {
  const workflow = useLeadNoteEditModal({ note, onSaved });

  return <NoteModal
    isOpen={note !== null}
    title="Edit Status Update"
    formId="lead-status-note-edit-form"
    categoryLabel="Recorded Status"
    category={note?.category ?? 'historical'}
    categoryOptions={[{ value: note?.category ?? 'historical', label: statusLabel(note?.category ?? null) }]}
    categoryDisabled
    details={workflow.details}
    submitLabel="Save"
    submitStatus={workflow.submitStatus}
    statusMessage={workflow.statusMessage}
    maxLength={500}
    onCategoryChange={() => undefined}
    onDetailsChange={workflow.updateDetails}
    onSubmit={workflow.submit}
    onClose={onClose}
  />;
}

function statusLabel(status: LeadNote['category']) {
  if (status === null) return 'Historical';
  return status === 'signed_up' ? 'Signed up' : status.charAt(0).toUpperCase() + status.slice(1);
}
