import type { SessionNote } from '../../types';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import NoteCategoryLabel from '../../../../../common/features/Notes/NoteCategoryLabel/NoteCategoryLabel';
import NoteRow from '../../../../../common/features/Notes/NoteRow/NoteRow';
import { getSessionNoteCategoryLabel } from '../../utils/sessionNoteCategories';

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
      categoryLabel={<NoteCategoryLabel category={note.category} label={getSessionNoteCategoryLabel(note.category)} />}
      date={date}
      onView={() => onView(note)}
      onEdit={onEdit ? () => onEdit(note) : undefined}
      onDelete={onDelete ? () => onDelete(note) : undefined}
      deleteActionLabel={deleteActionLabel}
      deleteActionIcon={deleteActionIcon}
    />
  );
}
