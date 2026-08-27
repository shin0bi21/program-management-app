import type { SessionNote } from '../../../../types/cohort';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { SessionNoteCategoryBadge } from '../SessionNoteDetails/SessionNoteDetails';
import NoteRow from '../NoteRow/NoteRow';

interface SessionNoteRowProps<TNote extends SessionNote> {
  note: TNote;
  date: string;
  onView: (note: TNote) => void;
  onEdit?: (note: TNote) => void;
  onDelete?: (note: TNote) => void;
  deleteActionLabel?: string;
  deleteActionIcon?: IconDefinition;
}

export default function SessionNoteRow<TNote extends SessionNote>({
  note,
  date,
  onView,
  onEdit,
  onDelete,
  deleteActionLabel,
  deleteActionIcon,
}: SessionNoteRowProps<TNote>) {
  return (
    <NoteRow
      ariaLabel="session note"
      categoryBadge={<SessionNoteCategoryBadge category={note.category} />}
      date={date}
      onView={() => onView(note)}
      onEdit={onEdit ? () => onEdit(note) : undefined}
      onDelete={onDelete ? () => onDelete(note) : undefined}
      deleteActionLabel={deleteActionLabel}
      deleteActionIcon={deleteActionIcon}
    />
  );
}
