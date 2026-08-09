import type { ReactNode } from 'react';
import type { SessionNote, SessionNoteCategory } from '../../../../types/cohort';
import NoteCategoryBadge from '../NoteCategoryBadge/NoteCategoryBadge';
import NoteDetails from '../NoteDetails/NoteDetails';
import { getSessionNoteCategoryLabel } from '../../sessionNoteCategories';
import './SessionNoteDetails.css';

export function SessionNoteCategoryBadge({ category }: { category: SessionNoteCategory }) {
  return <NoteCategoryBadge category={category} label={getSessionNoteCategoryLabel(category)} />;
}

export default function SessionNoteDetails({
  note,
  context,
}: {
  note: SessionNote;
  context?: ReactNode;
}) {
  return (
    <NoteDetails
      categoryBadge={<SessionNoteCategoryBadge category={note.category} />}
      createdAt={note.createdAt}
      createdByName={note.createdByName}
      context={context}
      details={note.details}
    >
      {note.youth.length > 0 && (
        <section className="session-note-details__youth">
          <h3>Linked youth</h3>
          <div className="session-note-details__youth-list">
            {note.youth.map(youth => (
              <span key={youth.youthId}>{youth.firstName} {youth.lastName}</span>
            ))}
          </div>
        </section>
      )}
    </NoteDetails>
  );
}
