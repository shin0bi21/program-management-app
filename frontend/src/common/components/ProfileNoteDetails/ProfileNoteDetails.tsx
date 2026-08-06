import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCalendarDays, faUser } from '@fortawesome/free-solid-svg-icons';
import type { YouthProfileNote } from '../../types/youth';
import { formatShortDate } from '../../utils/date';
import '../SessionNoteDetails/SessionNoteDetails.css';

const categoryLabel = (category: YouthProfileNote['category']) => (
  category.charAt(0).toUpperCase() + category.slice(1)
);

export function ProfileNoteCategoryBadge({ category }: { category: YouthProfileNote['category'] }) {
  return <span className={`session-note-category session-note-category--${category}`}>{categoryLabel(category)}</span>;
}

export default function ProfileNoteDetails({ note }: { note: YouthProfileNote }) {
  return (
    <div className="session-note-details">
      <div className="session-note-details__meta">
        <ProfileNoteCategoryBadge category={note.category} />
        <span><FontAwesomeIcon icon={faUser} aria-hidden="true" />{note.createdByName || 'Staff'}</span>
        <span><FontAwesomeIcon icon={faCalendarDays} aria-hidden="true" />{formatShortDate(note.createdAt)}</span>
      </div>
      {note.details && <div className="session-note-details__body"><p>{note.details}</p></div>}
    </div>
  );
}
