import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCalendarDays, faUser } from '@fortawesome/free-solid-svg-icons';
import type { ReactNode } from 'react';
import { formatShortDate } from '../../../utils/date';
import './NoteDetails.css';

export default function NoteDetails({
  categoryLabel,
  createdAt,
  createdByName,
  context,
  details,
  children,
}: {
  categoryLabel: ReactNode;
  createdAt: string;
  createdByName: string | null;
  context?: ReactNode;
  details?: string | null;
  children?: ReactNode;
}) {
  return (
    <div className="note-details">
      <div className="note-details__meta">
        {categoryLabel}
        <span>
          <FontAwesomeIcon icon={faUser} aria-hidden="true" />
          {createdByName || 'Staff'}
        </span>
        <span>
          <FontAwesomeIcon icon={faCalendarDays} aria-hidden="true" />
          {formatShortDate(createdAt)}
        </span>
      </div>
      {context && <div className="note-details__context">{context}</div>}
      {details && <div className="note-details__body"><p>{details}</p></div>}
      {children}
    </div>
  );
}
