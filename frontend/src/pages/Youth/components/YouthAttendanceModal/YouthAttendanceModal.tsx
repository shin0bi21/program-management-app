import type { YouthAttendanceResult } from './youthAttendance.api';
import type { FormEvent } from 'react';
import { faToggleOff, faToggleOn } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import Button from '../../../../common/components/Button/Button';
import LoadingSpinner from '../../../../common/components/LoadingSpinner/LoadingSpinner';
import Modal from '../../../../common/components/Modal/Modal';
import ModalFormFooter from '../../../../common/components/Modal/components/ModalFormFooter';
import type { YouthProfile } from '../../types';
import SessionAttendanceItem from './components/SessionAttendanceItem';
import YouthSessionNoteDialogs from './components/YouthSessionNoteDialogs';
import useYouthAttendance from './hooks/useYouthAttendance';
import useYouthSessionNotes from './hooks/useYouthSessionNotes';
import './YouthAttendanceModal.css';

type AttendanceProgramCycle = YouthProfile['programCycles'][number];

export default function YouthAttendanceModal({
  youth,
  programCycle,
  canManageSessionNotes = false,
  onClose,
  onSaved,
}: {
  youth: YouthProfile | null;
  programCycle: AttendanceProgramCycle | null;
  canManageSessionNotes?: boolean;
  onClose: () => void;
  onSaved: (result: YouthAttendanceResult) => void | Promise<void>;
}) {
  const {
    attendance,
    loading,
    loadError,
    refresh,
    selections,
    updateStatus,
    save,
    submitStatus,
    error,
  } = useYouthAttendance({
    youthId: youth?.id ?? null,
    programId: programCycle?.programId ?? null,
    cycleId: programCycle?.cycleId ?? null,
    onSaved,
  });
  const attendanceSessions = attendance?.sessions ?? [];
  const sessionNotes = useYouthSessionNotes({
    youthId: youth?.id ?? null,
    sessions: attendanceSessions,
    refresh,
  });

  const close = () => {
    sessionNotes.reset();
    onClose();
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void save();
  };

  return (
    <>
      <Modal
        isOpen={Boolean(youth && programCycle && !sessionNotes.isChildOpen)}
        onClose={close}
        title="Manage Attendance"
        maxWidth="720px"
        status={submitStatus}
        statusMessage={error || (submitStatus === 'submitting'
          ? 'Saving youth attendance...'
          : submitStatus === 'success' ? 'Youth attendance saved.' : undefined)}
        footer={(
          <ModalFormFooter
            formId="youth-attendance-form"
            submitStatus={submitStatus}
            submitDisabled={loading || Boolean(loadError) || !attendance?.sessions.length}
            onClose={close}
          />
        )}
      >
        <form id="youth-attendance-form" onSubmit={submit}>
          <div className="youth-attendance-modal__summary">
            {youth && programCycle && (
              <p className="youth-attendance-modal__context">
                {youth.firstName} {youth.lastName}<span aria-hidden="true"> · </span>
                {programCycle.programName}<span aria-hidden="true"> · </span>{programCycle.cycleName}
              </p>
            )}
            {sessionNotes.sessionsWithNotes.length > 0 && (
              <div className="youth-attendance-modal__toolbar">
                <Button
                  size="sm"
                  variant="ghost"
                  className="youth-attendance-modal__all-notes-toggle"
                  aria-pressed={sessionNotes.allExpanded}
                  onClick={sessionNotes.toggleAll}
                >
                  <span>{sessionNotes.allExpanded ? 'Hide all notes' : 'Show all notes'}</span>
                  <FontAwesomeIcon icon={sessionNotes.allExpanded ? faToggleOn : faToggleOff} aria-hidden="true" />
                </Button>
              </div>
            )}
          </div>

          {loading && (
            <div className="youth-attendance-modal__loading" role="status">
              <LoadingSpinner size="sm" />
              <span>Loading sessions...</span>
            </div>
          )}
          {loadError && <p className="form-error" role="alert">{loadError}</p>}
          {!loading && !loadError && attendance?.sessions.length === 0 && (
            <p className="page-empty">No sessions are available for this program and cycle.</p>
          )}

          {attendance?.sessions.length ? (
            <div className="youth-attendance-modal__sessions">
              {attendance.sessions.map(session => (
                <SessionAttendanceItem
                  key={session.id}
                  session={session}
                  enrollmentRequired={attendance.programCycle.enrollmentRequired}
                  status={selections[session.id] ?? ''}
                  canManageSessionNotes={canManageSessionNotes}
                  notesExpanded={sessionNotes.isExpanded(session.id)}
                  onStatusChange={value => updateStatus(session.id, value)}
                  onToggleNotes={() => sessionNotes.toggleSession(session.id)}
                  onAddNote={() => sessionNotes.addNote(session)}
                  onViewNote={sessionNotes.viewNote}
                  onEditNote={note => sessionNotes.editNote(session, note)}
                  onUnlinkNote={note => sessionNotes.requestUnlink(session, note)}
                />
              ))}
            </div>
          ) : null}
        </form>
      </Modal>

      <YouthSessionNoteDialogs
        youth={youth}
        enrollmentRequired={attendance?.programCycle.enrollmentRequired ?? programCycle?.enrollmentRequired ?? true}
        noteTarget={sessionNotes.noteTarget}
        detailTarget={sessionNotes.detailTarget}
        unlinkTarget={sessionNotes.unlinkTarget}
        unlinking={sessionNotes.unlinking}
        unlinkError={sessionNotes.unlinkError}
        onCloseNote={sessionNotes.closeNote}
        onCloseDetails={sessionNotes.closeDetails}
        onNoteSaved={sessionNotes.noteSaved}
        onCloseUnlink={sessionNotes.closeUnlink}
        onConfirmUnlink={sessionNotes.confirmUnlink}
      />
    </>
  );
}
