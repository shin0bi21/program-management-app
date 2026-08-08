import { faLinkSlash, faPen } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import Button from '../../../../../common/components/Button/Button';
import type { SessionNote } from '../../../../../common/types/cohort';
import { SessionNoteCategoryBadge } from '../../../../../features/notes/components/SessionNoteDetails/SessionNoteDetails';

export default function SessionNoteCard({
  note,
  onEdit,
  onUnlink,
}: {
  note: SessionNote;
  onEdit?: () => void;
  onUnlink?: () => void;
}) {
  return (
    <article className="youth-attendance-modal__note-card">
      <div className="youth-attendance-modal__note-heading">
        <h4>{note.title}</h4>
        <SessionNoteCategoryBadge category={note.category} />
        {onEdit && onUnlink && (
          <div className="youth-attendance-modal__note-actions">
            <Button
              size="sm"
              variant="ghost"
              aria-label={`Edit ${note.title}`}
              title="Edit note"
              onClick={onEdit}
            >
              <FontAwesomeIcon icon={faPen} aria-hidden="true" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="youth-attendance-modal__note-unlink"
              aria-label={`Unlink ${note.title}`}
              title="Unlink note from youth"
              onClick={onUnlink}
            >
              <FontAwesomeIcon icon={faLinkSlash} aria-hidden="true" />
            </Button>
          </div>
        )}
      </div>
      {note.details && <p className="youth-attendance-modal__note-body">{note.details}</p>}
    </article>
  );
}
