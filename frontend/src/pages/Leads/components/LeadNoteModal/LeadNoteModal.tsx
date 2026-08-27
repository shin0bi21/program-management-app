import FormField from '../../../../common/components/FormField/FormField';
import Modal from '../../../../common/components/Modal/Modal';
import ModalFormFooter from '../../../../common/components/Modal/components/ModalFormFooter';

import type { Lead, LeadNote } from '../../types';

import useLeadNoteModal from './hooks/useLeadNoteModal';

export default function LeadNoteModal({
  lead,
  note,
  onClose,
  onSaved,
}: {
  lead: Lead | null;
  note: LeadNote | null;
  onClose: () => void;
  onSaved: (savedNote: LeadNote) => void;
}) {
  const workflow = useLeadNoteModal({ lead, note, onSaved });

  return (
    <Modal
      isOpen={lead !== null}
      onClose={onClose}
      title={note ? 'Edit Follow-up Note' : 'Add Follow-up Note'}
      status={workflow.submitStatus}
      statusMessage={workflow.statusMessage}
      successDelay={900}
      footer={(
        <ModalFormFooter
          formId="lead-note-form"
          submitLabel={note ? 'Save' : 'Add Note'}
          submitStatus={workflow.submitStatus}
          onClose={onClose}
        />
      )}
    >
      <form
        id="lead-note-form"
        aria-busy={workflow.submitStatus === 'submitting'}
        onSubmit={(event) => {
          event.preventDefault();
          void workflow.submit();
        }}
      >
        <FormField id="lead-note-details" label="Follow-up note *">
          <textarea
            id="lead-note-details"
            rows={5}
            maxLength={500}
            value={workflow.details}
            required
            disabled={workflow.submissionComplete}
            onChange={event => workflow.updateDetails(event.target.value)}
          />
        </FormField>
      </form>
    </Modal>
  );
}
