import FloatingSelect from '../../../../common/components/FloatingSelect/FloatingSelect';
import FormField from '../../../../common/components/FormField/FormField';
import Modal from '../../../../common/components/Modal/Modal';
import ModalFormFooter from '../../../../common/components/Modal/components/ModalFormFooter';

import useProfileNoteModal from './hooks/useProfileNoteModal';

import type { YouthProfileNote, YouthProfileNoteCategory } from '../../../../common/types/youth';

interface ProfileNoteModalProps {
  youthId: string;
  note?: YouthProfileNote | null;
  onClose: () => void;
  onSaved: (note: YouthProfileNote) => void;
}

export default function ProfileNoteModal({
  youthId,
  note,
  onClose,
  onSaved,
}: ProfileNoteModalProps) {
  const workflow = useProfileNoteModal({ youthId, note, onSaved });

  const footer = (
    <ModalFormFooter
      formId="profile-note-form"
      submitLabel="Save"
      submitStatus={workflow.submitStatus}
      onClose={onClose}
    />
  );

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={note ? 'Edit Profile Note' : 'Add Profile Note'}
      status={workflow.submitStatus}
      statusMessage={workflow.statusMessage}
      successDelay={1400}
      footer={footer}
    >
      <form
        id="profile-note-form"
        aria-busy={workflow.submissionComplete || undefined}
        onSubmit={workflow.submit}
      >
        <FormField id="profile-note-category" label="Type">
          <FloatingSelect
            id="profile-note-category"
            ariaLabel="Type"
            value={workflow.draft.category}
            options={[
              { value: 'general', label: 'General' },
              { value: 'health', label: 'Health' },
              { value: 'preference', label: 'Preference' },
            ]}
            onChange={value => workflow.selectCategory(value as YouthProfileNoteCategory)}
            disabled={workflow.submissionComplete}
          />
        </FormField>

        <FormField id="profile-note-title" label="Title *">
          <input
            id="profile-note-title"
            value={workflow.draft.title}
            onChange={event => workflow.updateTitle(event.target.value)}
            disabled={workflow.submissionComplete}
          />
        </FormField>

        <FormField id="profile-note-details" label="Details (optional)">
          <textarea
            id="profile-note-details"
            rows={5}
            value={workflow.draft.details}
            onChange={event => workflow.updateDetails(event.target.value)}
            disabled={workflow.submissionComplete}
          />
        </FormField>
      </form>
    </Modal>
  );
}
