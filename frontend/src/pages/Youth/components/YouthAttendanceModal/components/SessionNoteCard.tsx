import type { SessionNote } from '../../../../Programming/Sessions/types';
import { faLinkSlash } from '@fortawesome/free-solid-svg-icons';
import SessionNoteRow from '../../../../Programming/Sessions/components/SessionNoteRow/SessionNoteRow';

export default function SessionNoteCard({
  note,
  onView,
  onEdit,
  onUnlink,
}: {
  note: SessionNote;
  onView: () => void;
  onEdit?: () => void;
  onUnlink?: () => void;
}) {
  return <SessionNoteRow
    note={note}
    date={note.createdAt}
    onView={onView}
    onEdit={onEdit ? () => onEdit() : undefined}
    onDelete={onUnlink ? () => onUnlink() : undefined}
    deleteActionLabel="Unlink session note"
    deleteActionIcon={faLinkSlash}
  />;
}
