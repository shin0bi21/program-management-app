import NoteModal from '../../../../common/features/notes/components/NoteModal/NoteModal';

import type { Lead, LeadNote } from '../../types';

import useLeadNoteModal from './hooks/useLeadNoteModal';

export default function LeadNoteModal({
  lead,
  onClose,
  onSaved,
}: {
  lead: Lead | null;
  onClose: () => void;
  onSaved: (note: LeadNote) => void;
}) {
  const workflow = useLeadNoteModal({ lead, onSaved });

  return (
    <NoteModal
      isOpen={lead !== null}
      title="Add Follow-up Note"
      formId="lead-note-form"
      categoryLabel="Category"
      category="follow_up"
      categoryOptions={[{ value: 'follow_up', label: 'Follow-up' }]}
      categoryDisabled
      details={workflow.details}
      submitLabel="Add Note"
      submitStatus={workflow.submitStatus}
      statusMessage={workflow.statusMessage}
      successDelay={900}
      maxLength={500}
      onCategoryChange={() => undefined}
      onDetailsChange={workflow.updateDetails}
      onSubmit={workflow.submit}
      onClose={onClose}
    />
  );
}
