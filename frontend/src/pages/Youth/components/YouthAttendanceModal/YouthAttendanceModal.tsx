import type { YouthAttendanceSummary } from '../YouthDashboard/YouthAttendanceDashboardCard/youthAttendanceSummary.api';
import type { YouthAttendanceResult } from './youthAttendance.api';
import type { FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getErrorMessage } from '../../../../http/errors';
import { getYouthProgramCycleAttendance } from './youthAttendance.api';
import type { YouthProgramCycleAttendance } from './types';
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

type AttendanceProgramCycle = Pick<YouthAttendanceSummary, 'programId' | 'cycleId' | 'program' | 'cycle' | 'enrollmentRequired'>;

interface YouthAttendanceModalProps {
  youth: YouthProfile | null;
  programCycle: AttendanceProgramCycle | null;
  canManageSessionNotes?: boolean;
  onClose: () => void;
  onSaved: (result: YouthAttendanceResult) => void | Promise<void>;
}

/**
 * Mounts one youth/program-cycle attendance interaction while its target is open.
 * @param props - Saved youth, program-cycle summary and completion actions.
 * @example <YouthAttendanceModal youth={youth} programCycle={summary} onClose={onClose} onSaved={save} />
 */
export default function YouthAttendanceModal({ youth, programCycle, ...props }: YouthAttendanceModalProps) {
  if (!youth || !programCycle) return null;

  return <AttendanceInteraction key={`${youth.id}:${programCycle.programId}:${programCycle.cycleId}`}
    youth={youth} programCycle={programCycle} {...props} />;
}

/**
 * Loads the session history absent from the opening dashboard's attendance summary.
 * @param props - Required saved targets and completion actions for this open interaction.
 * @example <AttendanceInteraction youth={youth} programCycle={summary} onClose={onClose} onSaved={save} />
 */
function AttendanceInteraction({ youth, programCycle, ...props }: Omit<YouthAttendanceModalProps, 'youth' | 'programCycle'> & {
  youth: YouthProfile; programCycle: AttendanceProgramCycle;
}) {
  const query = useQuery({
    queryKey: ['youth-program-cycle-attendance', youth.id, programCycle.programId, programCycle.cycleId],
    queryFn: ({ signal }) => getYouthProgramCycleAttendance(youth.id, { programId: programCycle.programId, cycleId: programCycle.cycleId }, { signal }),
  });
  const loadError = query.error ? getErrorMessage(query.error, 'Could not load youth attendance') : '';
  if (!query.data) {
    return <Modal isOpen title="Manage Attendance" maxWidth="720px" onClose={props.onClose}>
      {loadError ? <p className="form-error" role="alert">{loadError} <Button onClick={() => void query.refetch()}>Retry</Button></p>
        : <div className="youth-attendance-modal__loading" role="status"><LoadingSpinner size="sm" /><span>Loading sessions...</span></div>}
    </Modal>;
  }

  return <AttendanceForm youth={youth} programCycle={programCycle} attendance={query.data}
    loadError={loadError} refresh={query.refetch} {...props} />;
}

/**
 * Owns loaded attendance choices and child note dialogs until the interaction closes.
 * @param props - Loaded session history and required targets, retry and save/close actions.
 * @example <AttendanceForm {...loadedAttendanceProps} />
 */
function AttendanceForm({ youth, programCycle, attendance, loadError, refresh, canManageSessionNotes = false, onClose, onSaved }: Omit<YouthAttendanceModalProps, 'youth' | 'programCycle'> & {
  youth: YouthProfile; programCycle: AttendanceProgramCycle; attendance: YouthProgramCycleAttendance;
  loadError: string; refresh: () => Promise<unknown>;
}) {
  const { selections, updateStatus, save, submitStatus, statusMessage, submissionComplete } = useYouthAttendance({
    youthId: youth.id, attendance, unavailable: Boolean(loadError), onSaved,
  });
  const attendanceSessions = attendance.sessions;
  const sessionNotes = useYouthSessionNotes({
    youthId: youth.id,
    sessions: attendanceSessions,
    refresh,
  });

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void save();
  };

  return (
    <>
      <Modal
        isOpen={!sessionNotes.isChildOpen}
        onClose={onClose}
        title="Manage Attendance"
        maxWidth="720px"
        status={submitStatus}
        statusMessage={statusMessage}
        footer={(
          <ModalFormFooter
            formId="youth-attendance-form"
            submitStatus={submitStatus}
            submitDisabled={Boolean(loadError) || !attendance.sessions.length}
            onClose={onClose}
          />
        )}
      >
        <form id="youth-attendance-form" onSubmit={submit} aria-busy={submissionComplete}>
          <fieldset className="youth-attendance-modal__fields" disabled={submissionComplete || Boolean(loadError)}>
              <div className="youth-attendance-modal__summary">
                <p className="youth-attendance-modal__context">
                    {youth.firstName} {youth.lastName}<span aria-hidden="true"> · </span>
                    {programCycle.program}<span aria-hidden="true"> · </span>{programCycle.cycle}
                </p>
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

              {loadError && <p className="form-error" role="alert">{loadError}</p>}
              {!loadError && attendance.sessions.length === 0 && (
                <p className="page-empty">No sessions are available for this program and cycle.</p>
              )}

              {attendance.sessions.length > 0 && (
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
              )}
          </fieldset>
        </form>
      </Modal>

      <YouthSessionNoteDialogs
        youth={youth}
        enrollmentRequired={attendance.programCycle.enrollmentRequired}
        noteTarget={sessionNotes.noteTarget}
        detailTarget={sessionNotes.detailTarget}
        unlinkTarget={sessionNotes.unlinkTarget}
        onCloseNote={sessionNotes.closeNote}
        onCloseDetails={sessionNotes.closeDetails}
        onNoteSaved={sessionNotes.noteSaved}
        onCloseUnlink={sessionNotes.closeUnlink}
        onConfirmUnlink={sessionNotes.confirmUnlink}
      />
    </>
  );
}
