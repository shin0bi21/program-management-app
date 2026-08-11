import Button from '../../../../common/components/Button/Button';
import Modal from '../../../../common/components/Modal/Modal';
import type { YouthProfileNote } from '../../../../common/types/youth';
import ProfileNoteDetails from './ProfileNoteDetails';
import ProfileNoteModal from './ProfileNoteModal';

interface ProfileNoteDialogsProps {
  editorTarget: { youthId: string; note: YouthProfileNote | 'new' } | null;
  selectedNote: YouthProfileNote | null;
  canManage: boolean;
  confirmingDelete: boolean;
  deleting: boolean;
  deleteError: string;
  onCloseEditor: () => void;
  onSaved: (note: YouthProfileNote) => void;
  onCloseDetails: () => void;
  onEdit: (note: YouthProfileNote) => void;
  onRequestDelete: (note: YouthProfileNote) => void;
  onCancelDelete: () => void;
  onConfirmDelete: () => Promise<void>;
}

export default function ProfileNoteDialogs({
  editorTarget,
  selectedNote,
  canManage,
  confirmingDelete,
  deleting,
  deleteError,
  onCloseEditor,
  onSaved,
  onCloseDetails,
  onEdit,
  onRequestDelete,
  onCancelDelete,
  onConfirmDelete,
}: ProfileNoteDialogsProps) {
  let editor = null;
  if (editorTarget) {
    editor = (
      <ProfileNoteModal
        youthId={editorTarget.youthId}
        note={editorTarget.note === 'new' ? undefined : editorTarget.note}
        onClose={onCloseEditor}
        onSaved={onSaved}
      />
    );
  }

  return (
    <>
      {editor}

      <Modal
        isOpen={selectedNote !== null}
        onClose={onCloseDetails}
        title={confirmingDelete ? 'Delete Profile Note' : selectedNote?.title || 'Profile Note'}
        status={deleteError ? 'error' : deleting ? 'submitting' : 'idle'}
        statusMessage={deleteError || (deleting ? 'Deleting profile note...' : undefined)}
        footer={selectedNote && canManage ? confirmingDelete ? <>
          <Button variant="secondary" disabled={deleting} onClick={onCancelDelete}>Cancel</Button>
          <Button variant="danger" disabled={deleting} onClick={() => void onConfirmDelete()}>Delete</Button>
        </> : <>
          <Button onClick={() => onEdit(selectedNote)}>Edit</Button>
          <Button variant="danger" onClick={() => onRequestDelete(selectedNote)}>Delete</Button>
        </> : <Button variant="secondary" onClick={onCloseDetails}>Close</Button>}
      >
        {selectedNote && (confirmingDelete
          ? <p>Delete {selectedNote.title || 'this profile note'}? This cannot be undone.</p>
          : <ProfileNoteDetails note={selectedNote} />)}
      </Modal>
    </>
  );
}
