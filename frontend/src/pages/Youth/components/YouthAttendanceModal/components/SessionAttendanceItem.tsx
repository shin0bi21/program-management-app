import { faChevronDown, faChevronUp } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import Label from '../../../../../common/components/Label/Label';
import Button from '../../../../../common/components/Button/Button';
import type { AttendanceStatus } from '../../../../../common/features/AttendanceStatusSelect/types';
import type { SessionNote } from '../../../../Programming/Sessions/types';
import { formatShortDate } from '../../../../../common/utils/date';
import AttendanceStatusSelect from '../../../../../common/features/AttendanceStatusSelect/AttendanceStatusSelect';
import type { YouthAttendanceSession } from '../types';
import SessionNoteCard from './SessionNoteCard';

/**
 * Displays attendance and linked notes on the saved Session date.
 * @param props - Session data, draft attendance, note capabilities, and editor actions.
 * @example <SessionAttendanceItem {...props} /> // cancellation disables attendance and note creation
 */
export default function SessionAttendanceItem({
  session,
  enrollmentRequired,
  status,
  canManageSessionNotes,
  notesExpanded,
  onStatusChange,
  onToggleNotes,
  onAddNote,
  onViewNote,
  onEditNote,
  onUnlinkNote,
}: {
  session: YouthAttendanceSession;
  enrollmentRequired: boolean;
  status: AttendanceStatus | '';
  canManageSessionNotes: boolean;
  notesExpanded: boolean;
  onStatusChange: (value: AttendanceStatus | '') => void;
  onToggleNotes: () => void;
  onAddNote: () => void;
  onViewNote: (note: SessionNote) => void;
  onEditNote: (note: SessionNote) => void;
  onUnlinkNote: (note: SessionNote) => void;
}) {
  const sessionLabel = session.theme;
  const canAddNote = enrollmentRequired || session.status === 'present';

  return (
    <article className="youth-attendance-modal__session">
      <div className="youth-attendance-modal__session-overview">
        <div className="youth-attendance-modal__session-details">
          <strong>{sessionLabel}</strong>
          <span>{formatShortDate(session.date)}</span>
          {session.cancelledAt && (
            <Label tone="negative">Cancelled</Label>
          )}
        </div>
        <section className="youth-attendance-modal__attendance" aria-label={`Attendance for ${sessionLabel}`}>
          <AttendanceStatusSelect
            id={`youth-attendance-${session.id}`}
            ariaLabel={`Attendance for ${sessionLabel} on ${formatShortDate(session.date)}`}
            enrollmentRequired={enrollmentRequired}
            value={status}
            disabled={Boolean(session.cancelledAt)}
            onChange={onStatusChange}
          />
        </section>
      </div>

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
                onView={() => onViewNote(note)}
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
