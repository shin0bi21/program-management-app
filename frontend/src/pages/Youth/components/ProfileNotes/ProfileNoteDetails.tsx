import type { YouthProfileNote } from '../../types';
import NoteCategoryLabel from '../../../../common/features/Notes/NoteCategoryLabel/NoteCategoryLabel';
import NoteDetails from '../../../../common/features/Notes/NoteDetails/NoteDetails';

const categoryLabel = (category: YouthProfileNote['category']) => (
  category.charAt(0).toUpperCase() + category.slice(1)
);

export default function ProfileNoteDetails({ note }: { note: YouthProfileNote }) {
  return (
    <NoteDetails
      categoryLabel={<NoteCategoryLabel category={note.category} label={categoryLabel(note.category)} />}
      createdAt={note.createdAt}
      createdByName={note.createdByName}
      details={note.details}
    />
  );
}
