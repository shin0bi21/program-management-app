import type { SessionNoteCategory } from '../../types';
import NoteModal from '../../../../../common/features/Notes/NoteModal/NoteModal';
import { sessionNoteCategoryOptions } from '../../utils/sessionNoteCategories';
import useSessionNoteModal, { type UseSessionNoteModalOptions } from './hooks/useSessionNoteModal';
import SessionYouthChecklist from './SessionYouthChecklist';
import './SessionNoteModal.css';

type SessionNoteModalProps = Omit<UseSessionNoteModalOptions, 'session'> & {
  session: UseSessionNoteModalOptions['session'] | null;
  onClose: () => void;
};

/**
 * Mounts a note editor while its supplied session target is open.
 * @param props - Saved note/session, optional youth context, and completion actions.
 * @example <SessionNoteModal session={session} note={note} onClose={close} onSaved={refresh} />
 */
export default function SessionNoteModal({ session, ...props }: SessionNoteModalProps) {
  if (!session) return null;

  const targetKey = `${session.id}:${props.note?.id ?? 'new'}:${props.youthId ?? ''}`;
  return <SessionNoteForm key={targetKey} session={session} {...props} />;
}

/**
 * Edits one note until close or completion of shared save feedback.
 * @param props - Supplied draft values, selector visibility, and completion actions.
 * @example <SessionNoteForm session={session} onClose={close} onSaved={refresh} />
 */
function SessionNoteForm({
  session,
  note = null,
  youthId,
  hideYouthSelection = false,
  onClose,
  onSaved,
}: UseSessionNoteModalOptions & { onClose: () => void }) {
  const workflow = useSessionNoteModal({
    session,
    note,
    youthId,
    hideYouthSelection,
    onSaved,
  });

  return (
    <NoteModal
      isOpen
      title={note ? 'Edit Note' : 'Add Note'}
      formId="session-note-form"
      categoryLabel="Category"
      category={workflow.draft.category}
      categoryOptions={sessionNoteCategoryOptions}
      details={workflow.draft.details}
      submitStatus={workflow.submitStatus}
      statusMessage={workflow.statusMessage}
      onCategoryChange={value => workflow.updateCategory(value as SessionNoteCategory)}
      onDetailsChange={workflow.updateDetails}
      onSubmit={workflow.submit}
      onClose={onClose}
    >
      {!hideYouthSelection && <SessionYouthChecklist
        enrollmentRequired={session.enrollmentRequired}
        roster={workflow.roster}
        selectedYouthIds={workflow.draft.youthIds}
        loading={workflow.rosterLoading}
        error={workflow.rosterError}
        disabled={workflow.submissionComplete}
        onToggle={workflow.toggleYouth}
      />}
    </NoteModal>
  );
}
