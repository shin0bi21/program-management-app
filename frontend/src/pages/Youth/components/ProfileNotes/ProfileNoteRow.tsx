import type { YouthProfileNote } from '../../../../common/types/youth';
import NoteCategoryBadge from '../../../../common/features/notes/components/NoteCategoryBadge/NoteCategoryBadge';
import NoteRow from '../../../../common/features/notes/components/NoteRow/NoteRow';

const categoryLabel = (category: YouthProfileNote['category']) => (
  category.charAt(0).toUpperCase() + category.slice(1)
);

export default function ProfileNoteRow({
  note,
  onView,
  onEdit,
  onDelete,
}: {
  note: YouthProfileNote;
  onView: (note: YouthProfileNote) => void;
  onEdit?: (note: YouthProfileNote) => void;
  onDelete?: (note: YouthProfileNote) => void;
}) {
  return (
    <NoteRow
      ariaLabel="profile note"
      categoryBadge={<NoteCategoryBadge category={note.category} label={categoryLabel(note.category)} />}
      date={note.createdAt}
      onView={() => onView(note)}
      onEdit={onEdit ? () => onEdit(note) : undefined}
      onDelete={onDelete ? () => onDelete(note) : undefined}
    />
  );
}
