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
      submitDisabled={workflow.rosterLoading || workflow.rosterUnavailable || (
        !workflow.isOpenRoster && !workflow.roster.length
      )}
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
        {workflow.searchError && (
          <p className="form-error" role="alert">{workflow.searchError}</p>
        )}

        {workflow.isOpenRoster && (
          <OpenAttendancePicker
            search={workflow.search}
            appliedSearch={workflow.appliedSearch}
            searchResults={workflow.searchResults}
            searching={workflow.searching}
            disabled={workflow.submissionComplete
              || workflow.rosterLoading
              || workflow.rosterUnavailable}
            onSearchChange={workflow.setSearch}
            onSearchApply={workflow.applySearch}
            onSearchClear={workflow.clearSearch}
            onCheckIn={workflow.addOpenAttendee}
          />
        )}

        <SessionAttendanceRoster
          loading={workflow.rosterLoading}
          isOpenRoster={workflow.isOpenRoster}
          roster={workflow.roster}
          selections={workflow.selections}
          disabled={workflow.submissionComplete || workflow.rosterUnavailable}
          onRemove={workflow.removeOpenAttendee}
          onStatusChange={workflow.updateAttendanceStatus}
        />
      </form>
    </Modal>
  );
}
