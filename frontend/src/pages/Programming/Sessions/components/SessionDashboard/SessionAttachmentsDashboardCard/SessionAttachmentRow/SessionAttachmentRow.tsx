import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEye, faPen, faTrash } from '@fortawesome/free-solid-svg-icons';
import Button from '../../../../../../../common/components/Button/Button';
import type { SessionAttachment } from '../../../../types';
import './SessionAttachmentRow.css';

export default function SessionAttachmentRow({
  attachment,
  onView,
  onEdit,
  onDelete,
}: {
  attachment: SessionAttachment;
  onView: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  return (
    <article className="session-attachment-row">
      <strong>{attachment.title}</strong>
      <div className="session-attachment-row__actions">
        <Button size="sm" variant="ghost" className="session-attachment-row__action" aria-label={`View ${attachment.title}`} title="View attachment" onClick={onView}>
          <FontAwesomeIcon icon={faEye} aria-hidden="true" />
        </Button>
        {onEdit && onDelete && <>
          <Button size="sm" variant="ghost" className="session-attachment-row__action" aria-label={`Edit ${attachment.title}`} title="Edit attachment" onClick={onEdit}>
            <FontAwesomeIcon icon={faPen} aria-hidden="true" />
          </Button>
          <Button size="sm" variant="ghost" className="session-attachment-row__action session-attachment-row__action--danger" aria-label={`Delete ${attachment.title}`} title="Delete attachment" onClick={onDelete}>
            <FontAwesomeIcon icon={faTrash} aria-hidden="true" />
          </Button>
        </>}
      </div>
    </article>
  );
}
