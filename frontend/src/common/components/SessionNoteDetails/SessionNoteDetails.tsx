import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCalendarDays, faUser } from '@fortawesome/free-solid-svg-icons';
import type { ReactNode } from 'react';
import type { SessionNote, SessionNoteCategory } from '../../types/cohort';
import { formatShortDate } from '../../utils/date';
import './SessionNoteDetails.css';

export const sessionNoteCategoryOptions: Array<{
  value: SessionNoteCategory;
  label: string;
}> = [
  { value: 'general', label: 'General' },
  { value: 'attendance', label: 'Attendance' },
  { value: 'behaviour', label: 'Behaviour' },
  { value: 'achievement', label: 'Achievement' },
  { value: 'follow_up', label: 'Follow-up' },
];

export const getSessionNoteCategoryLabel = (category: SessionNoteCategory) => (
  sessionNoteCategoryOptions.find(option => option.value === category)?.label ?? 'General'
);

export function SessionNoteCategoryBadge({ category }: { category: SessionNoteCategory }) {
  return (
    <span className={`session-note-category session-note-category--${category}`}>
      {getSessionNoteCategoryLabel(category)}
    </span>
  );
}

export default function SessionNoteDetails({
  note,
  context,
}: {
  note: SessionNote;
  context?: ReactNode;
}) {
  return (
    <div className="session-note-details">
      <div className="session-note-details__meta">
        <SessionNoteCategoryBadge category={note.category} />
        <span>
          <FontAwesomeIcon icon={faUser} aria-hidden="true" />
          {note.createdByName || 'Staff'}
        </span>
        <span>
          <FontAwesomeIcon icon={faCalendarDays} aria-hidden="true" />
          {formatShortDate(note.createdAt)}
        </span>
      </div>
      {context && <div className="session-note-details__context">{context}</div>}
      <div className="session-note-details__body">
        <p>{note.details}</p>
      </div>
      {note.youth.length > 0 && (
        <section className="session-note-details__youth">
          <h3>Linked youth</h3>
          <div className="session-note-details__youth-list">
            {note.youth.map(youth => (
              <span key={youth.youthId}>
                {youth.firstName} {youth.lastName}
              </span>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
