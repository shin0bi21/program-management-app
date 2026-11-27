import NoteModal from '../../../../common/features/Notes/NoteModal/NoteModal';

import useProfileNoteModal from './hooks/useProfileNoteModal';

import type { YouthProfileNote, YouthProfileNoteCategory } from '../../types';

interface ProfileNoteModalProps {
  youthId: string;
  note?: YouthProfileNote | null;
  onClose: () => void;
  onSaved: (note: YouthProfileNote) => void;
}

/**
 * Edits supplied note values for the lifetime of its mounted dialog.
 * The opening owner keys this editor by youth and note identity.
 * @param props - Youth target, optional saved note and completion actions.
 * @example <ProfileNoteModal youthId={youth.id} note={note} onClose={close} onSaved={save} />
 */
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
        { id: 'general', name: 'General' },
        { id: 'health', name: 'Health' },
        { id: 'preference', name: 'Preference' },
      ]}
      detailsField={workflow.detailsField}
      submitStatus={workflow.submitStatus}
      statusMessage={workflow.statusMessage}
      onCategoryChange={value => workflow.selectCategory(value as YouthProfileNoteCategory)}
      onSubmit={workflow.submit}
      onClose={onClose}
    />
  );
}
