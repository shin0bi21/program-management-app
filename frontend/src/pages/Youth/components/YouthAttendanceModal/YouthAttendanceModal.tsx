import type { YouthAttendanceResult } from './youthAttendance.api';
import type { AttendanceGroup, AttendanceYouth } from '../../../../common/features/Attendance/attendance.api';
import { faToggleOff, faToggleOn } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import Button from '../../../../common/components/Button/Button';
import Modal from '../../../../common/components/Modal/Modal';
import ModalFormFooter from '../../../../common/components/Modal/components/ModalFormFooter';
import type { YouthProfile } from '../../types';
import SessionAttendanceItem from './components/SessionAttendanceItem';
import YouthSessionNoteDialogs from './components/YouthSessionNoteDialogs';
import useYouthAttendance from './hooks/useYouthAttendance';
import useYouthSessionNotes from './hooks/useYouthSessionNotes';
import './YouthAttendanceModal.css';

interface YouthAttendanceModalProps {
  youth: YouthProfile | null;
  attendance: AttendanceGroup | null;
  refresh: () => Promise<unknown>;
  canManageSessionNotes?: boolean;
  onClose: () => void;
  onSaved: (result: YouthAttendanceResult) => void | Promise<void>;
}

/**
 * Mounts a fresh editor with the cycle attendance already loaded by its dashboard.
 * @param props - Supplied youth, complete cycle attendance and completion/refresh actions.
 * @example <YouthAttendanceModal youth={youth} attendance={attendance} refresh={retry} onClose={close} onSaved={save} />
 */
export default function YouthAttendanceModal({ youth, attendance, ...props }: YouthAttendanceModalProps) {
  if (!youth || !attendance) return null;

  const participant = attendance.youth.find(person => person.id === youth.id);
  if (!participant) return null;

  const { programId, cycleId } = attendance.programCycle;
  return <AttendanceForm key={`${youth.id}:${programId}:${cycleId}`}
    youth={youth} attendance={attendance} participant={participant} {...props} />;
}

/**
 * Owns supplied attendance choices and child note dialogs until close or save completion.
 * @param props - Loaded cycle attendance, youth and completion/refresh actions.
 * @example <AttendanceForm {...loadedAttendanceProps} />
 */
function AttendanceForm({ youth, attendance, participant, refresh, canManageSessionNotes = false, onClose, onSaved }: Omit<YouthAttendanceModalProps, 'youth' | 'attendance'> & {
  youth: YouthProfile; attendance: AttendanceGroup; participant: AttendanceYouth;
}) {
  const { programCycle } = attendance;
  const { selections, updateStatus, save, submitStatus, statusMessage, submissionComplete } = useYouthAttendance({
    youthId: youth.id, attendance, onSaved,
  });
  const attendanceSessions = participant.sessions;
  const sessionNotes = useYouthSessionNotes({
    youthId: youth.id,
    sessions: attendanceSessions,
    refresh,
  });

  /** Saves the supplied cycle's edited attendance. @example submit(event) */
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
            submitDisabled={!participant.sessions.length}
            onClose={onClose}
          />
        )}
      >
        <form id="youth-attendance-form" onSubmit={save} aria-busy={submissionComplete}>
          <fieldset className="youth-attendance-modal__fields" disabled={submissionComplete}>
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

              {participant.sessions.length === 0 && (
                <p className="page-empty">No sessions are available for this program and cycle.</p>
              )}

              {participant.sessions.length > 0 && (
                <div className="youth-attendance-modal__sessions">
                  {participant.sessions.map(session => (
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
