import Button from '../../../../../common/components/Button/Button';
import Modal from '../../../../../common/components/Modal/Modal';
import ConfirmModal from '../../../../../common/components/ConfirmModal/ConfirmModal';
import type { YouthProfile } from '../../../types';
import SessionNoteModal from '../../../../Programming/Sessions/components/SessionNoteModal/SessionNoteModal';
import SessionNoteDetails from '../../../../Programming/Sessions/components/SessionNoteDetails/SessionNoteDetails';
import type { SessionNote } from '../../../../Programming/Sessions/types';
import type { SessionNoteTarget, SessionNoteUnlinkTarget } from '../types';

/**
 * Displays the attendance interaction's supplied note targets and shared unlink confirmation.
 * @param props - Saved youth/note context and close/save/unlink actions.
 * @example <YouthSessionNoteDialogs {...noteTargets} />
 */
export default function YouthSessionNoteDialogs({
  youth,
  enrollmentRequired,
  noteTarget,
  detailTarget,
  unlinkTarget,
  onCloseNote,
  onCloseDetails,
  onNoteSaved,
  onCloseUnlink,
  onConfirmUnlink,
}: {
  youth: YouthProfile | null;
  enrollmentRequired: boolean;
  noteTarget: SessionNoteTarget | null;
  detailTarget: SessionNote | null;
  unlinkTarget: SessionNoteUnlinkTarget | null;
  onCloseNote: () => void;
  onCloseDetails: () => void;
  onNoteSaved: () => Promise<void>;
  onCloseUnlink: () => void;
  onConfirmUnlink: () => Promise<void>;
}) {
  return (
    <>
      <SessionNoteModal
        session={noteTarget ? { id: noteTarget.session.id, enrollmentRequired } : null}
        note={noteTarget?.note ?? null}
        youthId={youth?.id}
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

      <ConfirmModal
        action={unlinkTarget && youth ? {
          title: 'Unlink Session Note',
          message: `Unlink this note from ${youth.firstName} ${youth.lastName}? The session note will remain available and any other youth links will be unchanged.`,
          confirmVariant: 'danger',
          successMessage: 'Session note unlinked.',
          onConfirm: onConfirmUnlink,
        } : null}
        onClose={onCloseUnlink}
      />
    </>
  );
}
