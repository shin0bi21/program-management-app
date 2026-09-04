import NoteModal from '../../../../../common/features/Notes/NoteModal/NoteModal';
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
    title="Edit Follow-up Note"
    formId="lead-note-edit-form"
    categoryLabel="Category"
    category="follow_up"
    categoryOptions={[{ value: 'follow_up', label: 'Follow-up' }]}
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
