import Button from '../../../../../common/components/Button/Button';
import Modal from '../../../../../common/components/Modal/Modal';
import type { YouthProfile } from '../../../../../common/types/youth';
import SessionNoteModal from '../../../../../common/features/notes/components/SessionNoteModal/SessionNoteModal';
import SessionNoteDetails from '../../../../../common/features/notes/components/SessionNoteDetails/SessionNoteDetails';
import type { SessionNote } from '../../../../../common/types/cohort';
import type { SessionNoteTarget, SessionNoteUnlinkTarget } from '../types';

export default function YouthSessionNoteDialogs({
  youth,
  rosterMode,
  noteTarget,
  detailTarget,
  unlinkTarget,
  unlinking,
  unlinkError,
  onCloseNote,
  onCloseDetails,
  onNoteSaved,
  onCloseUnlink,
  onConfirmUnlink,
}: {
  youth: YouthProfile | null;
  rosterMode: 'enrolled' | 'open';
  noteTarget: SessionNoteTarget | null;
  detailTarget: SessionNote | null;
  unlinkTarget: SessionNoteUnlinkTarget | null;
  unlinking: boolean;
  unlinkError: string;
  onCloseNote: () => void;
  onCloseDetails: () => void;
  onNoteSaved: () => Promise<void>;
  onCloseUnlink: () => void;
  onConfirmUnlink: () => Promise<void>;
}) {
  return (
    <>
      <SessionNoteModal
        session={noteTarget ? { id: noteTarget.session.id, rosterMode } : null}
        note={noteTarget?.note ?? null}
        initialYouthId={noteTarget?.note ? undefined : youth?.id}
        hideYouthSelection
        onClose={onCloseNote}
        onSaved={onNoteSaved}
      />

      <Modal
        isOpen={detailTarget !== null}
        onClose={onCloseDetails}
        title="Session Note"
        footer={<Button variant="secondary" onClick={onCloseDetails}>Close</Button>}
      >
        {detailTarget && <SessionNoteDetails note={detailTarget} />}
      </Modal>

      <Modal
        isOpen={unlinkTarget !== null}
        onClose={onCloseUnlink}
        title="Unlink Session Note"
        status={unlinkError ? 'error' : unlinking ? 'submitting' : 'idle'}
        statusMessage={unlinkError || (unlinking ? 'Unlinking session note...' : undefined)}
        footer={<>
          <Button variant="secondary" disabled={unlinking} onClick={onCloseUnlink}>Cancel</Button>
          <Button variant="danger" disabled={unlinking} onClick={() => void onConfirmUnlink()}>Unlink</Button>
        </>}
      >
        {unlinkTarget && youth && (
          <p>
            Unlink this note from {youth.firstName} {youth.lastName}?
            {' '}The session note will remain available and any other youth links will be unchanged.
          </p>
        )}
      </Modal>
    </>
  );
}
