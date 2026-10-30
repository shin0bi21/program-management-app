import type { ReactNode } from 'react';
import type { SessionNote } from '../../types';
import NoteCategoryLabel from '../../../../../common/features/Notes/NoteCategoryLabel/NoteCategoryLabel';
import NoteDetails from '../../../../../common/features/Notes/NoteDetails/NoteDetails';
import { getSessionNoteCategoryLabel } from '../../utils/sessionNoteCategories';
import './SessionNoteDetails.css';

export default function SessionNoteDetails({
  note,
  context,
}: {
  note: SessionNote;
  context?: ReactNode;
}) {
  return (
    <NoteDetails
      categoryLabel={<NoteCategoryLabel category={note.category} label={getSessionNoteCategoryLabel(note.category)} />}
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
