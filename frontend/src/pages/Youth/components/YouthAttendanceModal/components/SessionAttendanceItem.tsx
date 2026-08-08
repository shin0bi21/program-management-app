import { faChevronDown, faChevronUp } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import Button from '../../../../../common/components/Button/Button';
import type { AttendanceStatus, SessionNote } from '../../../../../common/types/cohort';
import { formatShortDate } from '../../../../../common/utils/date';
import AttendanceStatusSelect from '../../../../../features/attendance/components/AttendanceStatusSelect/AttendanceStatusSelect';
import type { YouthAttendanceSession } from '../types';
import SessionNoteCard from './SessionNoteCard';

export default function SessionAttendanceItem({
  session,
  rosterMode,
  status,
  canManageSessionNotes,
  notesExpanded,
  onStatusChange,
  onToggleNotes,
  onAddNote,
  onEditNote,
  onUnlinkNote,
}: {
  session: YouthAttendanceSession;
  rosterMode: 'enrolled' | 'open';
  status: AttendanceStatus | '';
  canManageSessionNotes: boolean;
  notesExpanded: boolean;
  onStatusChange: (value: AttendanceStatus | '') => void;
  onToggleNotes: () => void;
  onAddNote: () => void;
  onEditNote: (note: SessionNote) => void;
  onUnlinkNote: (note: SessionNote) => void;
}) {
  const sessionLabel = session.theme || session.sessionTypeName;
  const canAddNote = rosterMode === 'enrolled' || session.status === 'present';

  return (
    <article className="youth-attendance-modal__session">
      <div className="youth-attendance-modal__session-details">
        <strong>{sessionLabel}</strong>
        <span>{formatShortDate(session.startsAt)}</span>
        {session.cancelledAt && (
          <span className="status-badge youth-attendance-modal__cancelled">Cancelled</span>
        )}
      </div>
      <section className="youth-attendance-modal__attendance" aria-label={`Attendance for ${sessionLabel}`}>
        <strong>Attendance</strong>
        <AttendanceStatusSelect
          id={`youth-attendance-${session.id}`}
          ariaLabel={`Attendance for ${sessionLabel} on ${formatShortDate(session.startsAt)}`}
          rosterMode={rosterMode}
          value={status}
          disabled={Boolean(session.cancelledAt)}
          onChange={onStatusChange}
        />
      </section>

      <section className="youth-attendance-modal__notes" aria-label={`Notes for ${sessionLabel}`}>
        <div className="youth-attendance-modal__notes-header">
          {session.sessionNotes.length > 0 ? (
            <Button
              size="sm"
              variant="ghost"
              className="youth-attendance-modal__notes-toggle"
              aria-expanded={notesExpanded}
              onClick={onToggleNotes}
            >
              <span>Notes ({session.sessionNotes.length})</span>
              <FontAwesomeIcon icon={notesExpanded ? faChevronUp : faChevronDown} aria-hidden="true" />
            </Button>
          ) : (
            <strong className="youth-attendance-modal__notes-label">Notes (0)</strong>
          )}
          {canManageSessionNotes && (
            <Button
              size="sm"
              variant="secondary"
              disabled={Boolean(session.cancelledAt) || !canAddNote}
              title={!canAddNote ? 'Save this open-session attendance before adding a note' : 'Add session note'}
              onClick={onAddNote}
            >
              + Add Note
            </Button>
          )}
        </div>
        {notesExpanded && session.sessionNotes.length ? (
          <div className="youth-attendance-modal__note-list">
            {session.sessionNotes.map(note => (
              <SessionNoteCard
                key={note.id}
                note={note}
                onEdit={canManageSessionNotes ? () => onEditNote(note) : undefined}
                onUnlink={canManageSessionNotes ? () => onUnlinkNote(note) : undefined}
              />
            ))}
          </div>
        ) : null}
      </section>
    </article>
  );
}
