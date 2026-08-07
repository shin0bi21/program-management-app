import type { YouthProfileNote } from '../../../../common/types/youth';
import NoteCategoryBadge from '../../../../features/notes/components/NoteCategoryBadge/NoteCategoryBadge';
import NoteDetails from '../../../../features/notes/components/NoteDetails/NoteDetails';

const categoryLabel = (category: YouthProfileNote['category']) => (
  category.charAt(0).toUpperCase() + category.slice(1)
);

export default function ProfileNoteDetails({ note }: { note: YouthProfileNote }) {
  return (
    <NoteDetails
      categoryBadge={<NoteCategoryBadge category={note.category} label={categoryLabel(note.category)} />}
      createdAt={note.createdAt}
      createdByName={note.createdByName}
      details={note.details}
    />
  );
}
