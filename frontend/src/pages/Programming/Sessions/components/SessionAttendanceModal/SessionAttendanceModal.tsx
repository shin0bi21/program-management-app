import type { SessionAttendanceResult } from '../../sessions.api';
import Modal from '../../../../../common/components/Modal/Modal';
import ModalFormFooter from '../../../../../common/components/Modal/components/ModalFormFooter';
import type { ProgramSession } from '../../types';
import { formatShortDate } from '../../../../../common/utils/date';

import SessionAttendanceRoster from './SessionAttendanceRoster';
import OpenAttendancePicker from './OpenAttendancePicker';
import useSessionAttendanceModal from './hooks/useSessionAttendanceModal';

interface SessionAttendanceModalProps {
  session: ProgramSession | null;
  onClose: () => void;
  onSaved: (result: SessionAttendanceResult) => void | Promise<void>;
}

export default function SessionAttendanceModal({
  session,
  onClose,
  onSaved,
}: SessionAttendanceModalProps) {
  const workflow = useSessionAttendanceModal({ session, onSaved });

  const footer = (
    <ModalFormFooter
      formId="attendance-form"
      submitStatus={workflow.submitStatus}
      submitDisabled={workflow.submitDisabled}
      onClose={onClose}
    />
  );

  return (
    <Modal
      isOpen={session !== null}
      onClose={onClose}
      title="Attendance"
      maxWidth="720px"
      status={workflow.submitStatus}
      statusMessage={workflow.statusMessage}
      footer={footer}
    >
      <form
        id="attendance-form"
        aria-busy={workflow.submitStatus === 'submitting'}
        onSubmit={(event) => {
          event.preventDefault();
          void workflow.submit();
        }}
      >
        {session && (
          <p className="attendance-modal__context">
            {formatShortDate(session.startsAt)}
            {session.theme ? ` · ${session.theme}` : ''}
          </p>
        )}

        {workflow.rosterError && (
          <p className="form-error" role="alert">{workflow.rosterError}</p>
        )}
        {workflow.youthError && (
          <p className="form-error" role="alert">{workflow.youthError}</p>
        )}

        {workflow.isOpenRoster ? (
          <OpenAttendancePicker
            key={session?.id}
            youth={workflow.youth}
            selectedYouthIds={workflow.selectedYouthIds}
            loading={workflow.attendanceLoading}
            unavailable={workflow.attendanceUnavailable}
            disabled={workflow.controlsDisabled}
            onToggle={workflow.toggleOpenAttendee}
          />
        ) : (
          <SessionAttendanceRoster
            loading={workflow.attendanceLoading}
            roster={workflow.roster}
            selections={workflow.selections}
            disabled={workflow.controlsDisabled}
            onStatusChange={workflow.updateAttendanceStatus}
          />
        )}
      </form>
    </Modal>
  );
}
