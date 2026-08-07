import type { SessionNote } from '../../../../common/types/cohort';
import { SessionNoteCategoryBadge } from '../SessionNoteDetails/SessionNoteDetails';
import NoteRow from '../NoteRow/NoteRow';

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
  return (
    <NoteRow
      title={note.title}
      categoryBadge={<SessionNoteCategoryBadge category={note.category} />}
      date={date}
      onView={() => onView(note)}
      onEdit={onEdit ? () => onEdit(note) : undefined}
      onDelete={onDelete ? () => onDelete(note) : undefined}
    />
  );
}
