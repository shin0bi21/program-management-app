import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEye, faPen, faTrash } from '@fortawesome/free-solid-svg-icons';
import type { ReactNode } from 'react';
import Button from '../../../../components/Button/Button';
import { formatShortDate } from '../../../../utils/date';
import './NoteRow.css';

interface NoteRowProps {
  title: string;
  categoryBadge: ReactNode;
  date: string;
  onView: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

export default function NoteRow({
  title,
  categoryBadge,
  date,
  onView,
  onEdit,
  onDelete,
}: NoteRowProps) {
  const canManage = Boolean(onEdit && onDelete);

  return (
    <article className="note-row">
      <div className="note-row__summary">
        <strong>{title}</strong>
        {categoryBadge}
        <span className="note-row__date">{formatShortDate(date)}</span>
      </div>
      <div className="note-row__actions">
        <Button size="sm" variant="ghost" className="note-row__action" aria-label={`View ${title}`} title="View note" onClick={onView}>
          <FontAwesomeIcon icon={faEye} aria-hidden="true" />
        </Button>
        {canManage && <>
          <Button size="sm" variant="ghost" className="note-row__action" aria-label={`Edit ${title}`} title="Edit note" onClick={onEdit}>
            <FontAwesomeIcon icon={faPen} aria-hidden="true" />
          </Button>
          <Button size="sm" variant="ghost" className="note-row__action note-row__action--danger" aria-label={`Delete ${title}`} title="Delete note" onClick={onDelete}>
            <FontAwesomeIcon icon={faTrash} aria-hidden="true" />
          </Button>
        </>}
      </div>
    </article>
  );
}
