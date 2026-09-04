import type { SessionNoteCategory } from '../../types';
import NoteModal from '../../../../../common/features/Notes/NoteModal/NoteModal';
import { sessionNoteCategoryOptions } from '../../utils/sessionNoteCategories';
import useSessionNoteModal, { type UseSessionNoteModalOptions } from './hooks/useSessionNoteModal';
import SessionYouthChecklist from './SessionYouthChecklist';
import './SessionNoteModal.css';

type SessionNoteModalProps = UseSessionNoteModalOptions & {
  onClose: () => void;
};

export default function SessionNoteModal({
  session,
  note = null,
  initialYouthId,
  hideYouthSelection = false,
  onClose,
  onSaved,
}: SessionNoteModalProps) {
  const workflow = useSessionNoteModal({
    session,
    note,
    initialYouthId,
    hideYouthSelection,
    onSaved,
  });

  return (
    <NoteModal
      isOpen={session !== null}
      title={note ? 'Edit Note' : 'Add Note'}
      formId="session-note-form"
      categoryLabel="Category"
      category={workflow.draft.category}
      categoryOptions={sessionNoteCategoryOptions}
      details={workflow.draft.details}
      submitLabel={note ? 'Save' : 'Add Note'}
      submitStatus={workflow.submitStatus}
      statusMessage={workflow.statusMessage}
      successDelay={1200}
      onCategoryChange={value => workflow.updateCategory(value as SessionNoteCategory)}
      onDetailsChange={workflow.updateDetails}
      onSubmit={workflow.submit}
      onClose={onClose}
    >
      {session && !hideYouthSelection && <SessionYouthChecklist
        rosterMode={session.rosterMode}
        roster={workflow.roster}
        selectedYouthIds={workflow.draft.selectedYouthIds}
        loading={workflow.rosterLoading}
        error={workflow.rosterError}
        disabled={workflow.submissionComplete}
        onToggle={workflow.toggleYouth}
      />}
    </NoteModal>
  );
}
