import Button from '../../../../common/components/Button/Button';
import Modal from '../../../../common/components/Modal/Modal';
import ConfirmModal from '../../../../common/components/ConfirmModal/ConfirmModal';
import type { ConfirmAction } from '../../../../common/components/ConfirmModal/types';
import type { YouthProfileNote } from '../../types';
import ProfileNoteDetails from './ProfileNoteDetails';
import ProfileNoteModal from './ProfileNoteModal';

interface ProfileNoteDialogsProps {
  editorTarget: { youthId: string; note: YouthProfileNote | 'new' } | null;
  selectedNote: YouthProfileNote | null;
  canManage: boolean;
  confirmAction: ConfirmAction | null;
  onCloseEditor: () => void;
  onSaved: (note: YouthProfileNote) => void;
  onCloseDetails: () => void;
  onEdit: (note: YouthProfileNote) => void;
  onRequestDelete: (note: YouthProfileNote) => void;
  onCloseConfirmation: () => void;
}

/**
 * Composes profile-note editors, details and the shared delete confirmation.
 * @param props - Current targets and their close/save/management actions.
 * @example <ProfileNoteDialogs {...noteActions} />
 */
export default function ProfileNoteDialogs({
  editorTarget,
  selectedNote,
  canManage,
  confirmAction,
  onCloseEditor,
  onSaved,
  onCloseDetails,
  onEdit,
  onRequestDelete,
  onCloseConfirmation,
}: ProfileNoteDialogsProps) {
  let editor = null;
  if (editorTarget) {
    editor = (
      <ProfileNoteModal
        key={`${editorTarget.youthId}:${editorTarget.note === 'new' ? 'new' : editorTarget.note.id}`}
        youthId={editorTarget.youthId}
        note={editorTarget.note === 'new' ? undefined : editorTarget.note}
        onClose={onCloseEditor}
        onSaved={onSaved}
      />
    );
  }

  const canShowDetails = selectedNote !== null && editorTarget === null && confirmAction === null;
  const footer = selectedNote && canManage ? <>
    <Button onClick={() => onEdit(selectedNote)}>Edit</Button>
    <Button variant="danger" onClick={() => onRequestDelete(selectedNote)}>Delete</Button>
  </> : <Button variant="secondary" onClick={onCloseDetails}>Close</Button>;

  return <>
    {editor}
    <Modal isOpen={canShowDetails} onClose={onCloseDetails} title="Profile Note" footer={footer}>
      {selectedNote && <ProfileNoteDetails note={selectedNote} />}
    </Modal>
    <ConfirmModal action={confirmAction} onClose={onCloseConfirmation} />
  </>;
}
