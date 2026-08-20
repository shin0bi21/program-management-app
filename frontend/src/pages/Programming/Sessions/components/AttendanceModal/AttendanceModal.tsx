import Modal from '../../../../../common/components/Modal/Modal';
import ModalFormFooter from '../../../../../common/components/Modal/components/ModalFormFooter';
import YouthModal from '../../../../../common/features/youth/components/YouthModal/YouthModal';
import type { CohortSession } from '../../../../../common/types/cohort';
import { formatShortDate } from '../../../../../common/utils/date';

import AttendanceRoster from './AttendanceRoster';
import OpenAttendancePicker from './OpenAttendancePicker';
import useAttendanceModal from './hooks/useAttendanceModal';

interface AttendanceModalProps {
  session: CohortSession | null;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}

export default function AttendanceModal({
  session,
  onClose,
  onSaved,
}: AttendanceModalProps) {
  const workflow = useAttendanceModal({ session, onSaved });

  const footer = (
    <ModalFormFooter
      formId="attendance-form"
      submitLabel="Save Attendance"
      submitStatus={workflow.submitStatus}
      submitDisabled={workflow.rosterLoading || workflow.rosterUnavailable || (
        !workflow.isOpenRoster && !workflow.roster.length
      )}
      onClose={onClose}
    />
  );

  return <>
    <Modal
      isOpen={session !== null && !workflow.creatingYouth}
      onClose={onClose}
      title="Attendance"
      maxWidth="720px"
      status={workflow.submitStatus}
      statusMessage={workflow.statusMessage}
      successDelay={1400}
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
            searchResults={workflow.searchResults}
            searching={workflow.searching}
            disabled={workflow.submissionComplete
              || workflow.rosterLoading
              || workflow.rosterUnavailable}
            onSearchChange={workflow.setSearch}
            onCreateProfile={workflow.startCreatingYouth}
            onCheckIn={workflow.addOpenAttendee}
          />
        )}

        <AttendanceRoster
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

    <YouthModal
      isOpen={workflow.creatingYouth}
      onClose={workflow.stopCreatingYouth}
      onSuccess={workflow.handleYouthCreated}
    />
  </>;
}
