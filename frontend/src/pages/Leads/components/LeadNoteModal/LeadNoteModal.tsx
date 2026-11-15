import NoteModal from '../../../../common/features/Notes/NoteModal/NoteModal';

import type { Lead, LeadNote } from '../../types';

import useLeadNoteModal from './hooks/useLeadNoteModal';

/**
 * Adds or edits a follow-up note for a lead while the editor is mounted.
 * @param props - Selected lead, optional saved note, and close/save callbacks.
 * @example <LeadNoteModal lead={lead} note={note} onClose={close} onSaved={save} />
 */
export default function LeadNoteModal({
  lead,
  note,
  onClose,
  onSaved,
}: {
  lead: Lead;
  note?: LeadNote;
  onClose: () => void;
  onSaved: (note: LeadNote) => void;
}) {
  const workflow = useLeadNoteModal({ lead, note, onSaved });

  return (
    <NoteModal
      isOpen
      title={note ? 'Edit Follow-up Note' : 'Add Follow-up Note'}
      formId="lead-note-form"
      categoryLabel="Category"
      category="follow_up"
      categoryOptions={[{ id: 'follow_up', name: 'Follow-up' }]}
      categoryDisabled
      details={workflow.details}
      submitStatus={workflow.submitStatus}
      statusMessage={workflow.statusMessage}
      maxLength={500}
      onCategoryChange={() => undefined}
      onDetailsChange={workflow.updateDetails}
      onSubmit={workflow.submit}
      onClose={onClose}
    />
  );
}
