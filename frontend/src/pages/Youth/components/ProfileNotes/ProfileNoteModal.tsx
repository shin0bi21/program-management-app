import NoteModal from '../../../../common/features/Notes/NoteModal/NoteModal';

import useProfileNoteModal from './hooks/useProfileNoteModal';

import type { YouthProfileNote, YouthProfileNoteCategory } from '../../types';

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

  return (
    <NoteModal
      isOpen
      title={note ? 'Edit Profile Note' : 'Add Profile Note'}
      formId="profile-note-form"
      categoryLabel="Category"
      category={workflow.draft.category}
      categoryOptions={[
        { value: 'general', label: 'General' },
        { value: 'health', label: 'Health' },
        { value: 'preference', label: 'Preference' },
      ]}
      details={workflow.draft.details}
      submitLabel="Save"
      submitStatus={workflow.submitStatus}
      statusMessage={workflow.statusMessage}
      successDelay={1400}
      onCategoryChange={value => workflow.selectCategory(value as YouthProfileNoteCategory)}
      onDetailsChange={workflow.updateDetails}
      onSubmit={workflow.submit}
      onClose={onClose}
    />
  );
}
