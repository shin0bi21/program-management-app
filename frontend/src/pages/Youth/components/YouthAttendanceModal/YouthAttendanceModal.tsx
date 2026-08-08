import type { FormEvent } from 'react';
import LoadingSpinner from '../../../../common/components/LoadingSpinner/LoadingSpinner';
import Modal from '../../../../common/components/Modal/Modal';
import ModalFormFooter from '../../../../common/components/Modal/components/ModalFormFooter';
import type { YouthProfile } from '../../../../common/types/youth';
import { formatShortDate } from '../../../../common/utils/date';
import AttendanceStatusSelect from '../../../../features/attendance/components/AttendanceStatusSelect/AttendanceStatusSelect';
import useYouthAttendance from './useYouthAttendance';
import './YouthAttendanceModal.css';

type AttendanceCohort = YouthProfile['cohorts'][number];

export default function YouthAttendanceModal({
  youth,
  cohort,
  onClose,
  onSaved,
}: {
  youth: YouthProfile | null;
  cohort: AttendanceCohort | null;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const {
    attendance,
    loading,
    loadError,
    selections,
    updateStatus,
    save,
    submitStatus,
    error,
  } = useYouthAttendance({
    youthId: youth?.id ?? null,
    cohortId: cohort?.id ?? null,
    onSaved,
  });

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void save();
  };

  return (
    <Modal
      isOpen={Boolean(youth && cohort)}
      onClose={onClose}
      title="Manage Attendance"
      maxWidth="720px"
      status={submitStatus}
      statusMessage={error || (submitStatus === 'submitting'
        ? 'Saving youth attendance...'
        : submitStatus === 'success' ? 'Youth attendance saved.' : undefined)}
      successDelay={1000}
      disableClose={submitStatus === 'submitting'}
      footer={(
        <ModalFormFooter
          formId="youth-attendance-form"
          submitLabel="Save Attendance"
          submitStatus={submitStatus}
          submitDisabled={loading || Boolean(loadError) || !attendance?.sessions.length}
          onClose={onClose}
        />
      )}
    >
      <form id="youth-attendance-form" onSubmit={submit}>
        {youth && cohort && (
          <p className="youth-attendance-modal__context">
            {youth.firstName} {youth.lastName}<span aria-hidden="true"> · </span>
            {cohort.programName}<span aria-hidden="true"> · </span>{cohort.name}
          </p>
        )}

        {loading && (
          <div className="youth-attendance-modal__loading" role="status">
            <LoadingSpinner size="sm" />
            <span>Loading sessions...</span>
          </div>
        )}
        {loadError && <p className="form-error" role="alert">{loadError}</p>}
        {!loading && !loadError && attendance?.sessions.length === 0 && (
          <p className="page-empty">No sessions are available for this cohort.</p>
        )}

        {attendance?.sessions.length ? (
          <div className="youth-attendance-modal__sessions">
            {attendance.sessions.map(session => (
              <div className="youth-attendance-modal__session" key={session.id}>
                <div className="youth-attendance-modal__session-details">
                  <strong>{session.theme || session.sessionTypeName}</strong>
                  <span>{formatShortDate(session.startsAt)}</span>
                  {session.cancelledAt && <span className="status-badge youth-attendance-modal__cancelled">Cancelled</span>}
                </div>
                <AttendanceStatusSelect
                  id={`youth-attendance-${session.id}`}
                  ariaLabel={`Attendance for ${session.theme || session.sessionTypeName} on ${formatShortDate(session.startsAt)}`}
                  rosterMode={attendance.cohort.rosterMode}
                  value={selections[session.id] ?? ''}
                  disabled={Boolean(session.cancelledAt)}
                  onChange={value => updateStatus(session.id, value)}
                />
              </div>
            ))}
          </div>
        ) : null}
      </form>
    </Modal>
  );
}
