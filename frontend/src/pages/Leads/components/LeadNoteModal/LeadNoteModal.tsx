import NoteModal from '../../../../common/features/notes/components/NoteModal/NoteModal';

import type { CreateLeadStatusNoteResult, EditableLeadStatus, Lead } from '../../types';

import useLeadNoteModal from './hooks/useLeadNoteModal';

export default function LeadNoteModal({
  lead,
  initialStatus,
  onClose,
  onSaved,
}: {
  lead: Lead | null;
  initialStatus?: EditableLeadStatus;
  onClose: () => void;
  onSaved: (result: CreateLeadStatusNoteResult) => void;
}) {
  const workflow = useLeadNoteModal({ lead, initialStatus, onSaved });

  return (
    <NoteModal
      isOpen={lead !== null}
      title="Add Status Update"
      formId="lead-status-note-form"
      categoryLabel="Status"
      category={workflow.category}
      categoryOptions={[
        { value: 'new', label: 'New' },
        { value: 'contacted', label: 'Contacted' },
        { value: 'eligible', label: 'Eligible' },
        { value: 'ineligible', label: 'Ineligible' },
        { value: 'deferred', label: 'Deferred' },
        { value: 'closed', label: 'Closed' },
      ]}
      details={workflow.details}
      submitLabel="Add Update"
      submitStatus={workflow.submitStatus}
      statusMessage={workflow.statusMessage}
      successDelay={900}
      maxLength={500}
      onCategoryChange={value => workflow.updateCategory(value as EditableLeadStatus)}
      onDetailsChange={workflow.updateDetails}
      onSubmit={workflow.submit}
      onClose={onClose}
    />
  );
}
