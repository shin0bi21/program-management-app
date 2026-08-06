import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEye, faPen, faTrash } from '@fortawesome/free-solid-svg-icons';
import type { SessionNote } from '../../types/cohort';
import { formatShortDate } from '../../utils/date';
import Button from '../Button/Button';
import { SessionNoteCategoryBadge } from '../SessionNoteDetails/SessionNoteDetails';
import './SessionNoteRow.css';

interface SessionNoteRowProps<TNote extends SessionNote> {
  note: TNote;
  date: string;
  onView: (note: TNote) => void;
  onEdit?: (note: TNote) => void;
  onDelete?: (note: TNote) => void;
}

export default function SessionNoteRow<TNote extends SessionNote>({
  note,
  date,
  onView,
  onEdit,
  onDelete,
}: SessionNoteRowProps<TNote>) {
  const canManage = Boolean(onEdit && onDelete);

  return (
    <article className="session-note-row">
      <div className="session-note-row__summary">
        <strong>{note.title}</strong>
        <SessionNoteCategoryBadge category={note.category} />
        <span className="session-note-row__date">{formatShortDate(date)}</span>
      </div>
      <div className="session-note-row__actions">
        <Button size="sm" variant="ghost" className="session-note-row__action" aria-label={`View ${note.title}`} title="View note" onClick={() => onView(note)}>
          <FontAwesomeIcon icon={faEye} aria-hidden="true" />
        </Button>
        {canManage && <>
          <Button size="sm" variant="ghost" className="session-note-row__action" aria-label={`Edit ${note.title}`} title="Edit note" onClick={() => onEdit?.(note)}>
            <FontAwesomeIcon icon={faPen} aria-hidden="true" />
          </Button>
          <Button size="sm" variant="ghost" className="session-note-row__action session-note-row__action--danger" aria-label={`Delete ${note.title}`} title="Delete note" onClick={() => onDelete?.(note)}>
            <FontAwesomeIcon icon={faTrash} aria-hidden="true" />
          </Button>
        </>}
      </div>
    </article>
  );
}
