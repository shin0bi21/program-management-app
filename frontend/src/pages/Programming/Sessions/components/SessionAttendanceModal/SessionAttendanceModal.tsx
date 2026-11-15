import type { SessionAttendanceResult } from '../../sessions.api';
import Modal from '../../../../../common/components/Modal/Modal';
import ModalFormFooter from '../../../../../common/components/Modal/components/ModalFormFooter';
import type { ProgramSession, SessionRosterMember } from '../../types';
import { formatShortDate } from '../../../../../common/utils/date';

import SessionAttendanceRoster from './SessionAttendanceRoster';
import OpenAttendancePicker from './OpenAttendancePicker';
import useSessionAttendanceModal from './hooks/useSessionAttendanceModal';

interface SessionAttendanceModalProps {
  session: ProgramSession | null;
  roster: SessionRosterMember[];
  onClose: () => void;
  onSaved: (result: SessionAttendanceResult) => void | Promise<void>;
}

/**
 * Mounts a fresh attendance editor from the session and roster supplied on Manage.
 * @param props - Open session target, loaded attendance, and completion actions.
 * @example <SessionAttendanceModal session={session} roster={roster} onClose={close} onSaved={save} />
 */
export default function SessionAttendanceModal({ session, ...props }: SessionAttendanceModalProps) {
  return session ? <AttendanceForm key={session.id} session={session} {...props} /> : null;
}

/**
 * Owns one session's attendance choices until its dialog closes or finishes saving.
 * @param props - Saved session and attendance with close/save callbacks.
 * @example <AttendanceForm session={session} roster={roster} onClose={close} onSaved={save} />
 */
function AttendanceForm({ session, roster, onClose, onSaved }: Omit<SessionAttendanceModalProps, 'session'> & { session: ProgramSession }) {
  const workflow = useSessionAttendanceModal({ session, roster, onSaved });

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
      isOpen
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
        <p className="attendance-modal__context">
          {formatShortDate(session.date)}
          {session.title ? ` · ${session.title}` : ''}
        </p>

        {workflow.youthError && (
          <p className="form-error" role="alert">{workflow.youthError}</p>
        )}

        {workflow.isOpenRoster ? (
          <OpenAttendancePicker
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
