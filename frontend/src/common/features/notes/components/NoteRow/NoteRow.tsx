import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEye, faPen, faTrash, type IconDefinition } from '@fortawesome/free-solid-svg-icons';
import type { ReactNode } from 'react';
import Button from '../../../../components/Button/Button';
import { formatShortDate } from '../../../../utils/date';
import './NoteRow.css';

interface NoteRowProps {
  ariaLabel: string;
  title?: string;
  categoryBadge: ReactNode;
  date: string;
  author?: string | null;
  onView: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  editActionLabel?: string;
  deleteActionLabel?: string;
  deleteActionIcon?: IconDefinition;
  compact?: boolean;
  emphasizeTitle?: boolean;
}

export default function NoteRow({
  ariaLabel,
  title,
  categoryBadge,
  date,
  author,
  onView,
  onEdit,
  onDelete,
  editActionLabel = `Edit ${ariaLabel}`,
  deleteActionLabel = `Delete ${ariaLabel}`,
  deleteActionIcon = faTrash,
  compact = false,
  emphasizeTitle = true,
}: NoteRowProps) {
  const canManage = Boolean(onEdit && onDelete);

  return (
    <article className={`note-row${compact ? ' note-row--compact' : ''}`}>
      <div className="note-row__summary">
        {title && (emphasizeTitle
          ? <strong className="note-row__title" title={title}>{title}</strong>
          : <span className="note-row__title" title={title}>{title}</span>)}
        {categoryBadge}
        {author && <span className="note-row__author" title={author}>{author}</span>}
        <span className="note-row__date">{formatShortDate(date)}</span>
      </div>
      <div className="note-row__actions">
        <Button size="sm" variant="ghost" className="note-row__action" aria-label={`View ${ariaLabel}`} title="View note" onClick={onView}>
          <FontAwesomeIcon icon={faEye} aria-hidden="true" />
        </Button>
        {canManage && <>
          <Button size="sm" variant="ghost" className="note-row__action" aria-label={editActionLabel} title="Edit note" onClick={onEdit}>
            <FontAwesomeIcon icon={faPen} aria-hidden="true" />
          </Button>
          <Button size="sm" variant="ghost" className="note-row__action note-row__action--danger" aria-label={deleteActionLabel} title={deleteActionLabel} onClick={onDelete}>
            <FontAwesomeIcon icon={deleteActionIcon} aria-hidden="true" />
          </Button>
        </>}
      </div>
    </article>
  );
}
