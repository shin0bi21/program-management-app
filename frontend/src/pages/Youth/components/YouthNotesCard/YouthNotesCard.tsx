import type { ReactNode } from 'react';
import { DashboardCard } from '../../../../common/components/DashboardCard/DashboardCard';
import type { YouthProfileNote } from '../../../../common/types/youth';
import ProfileNoteRow from '../ProfileNoteRow/ProfileNoteRow';

interface YouthNotesCardProps {
  profileNotes?: YouthProfileNote[];
  selected: boolean;
  onSelectProfileNote: (note: YouthProfileNote) => void;
  canManageProfileNotes?: boolean;
  onEditProfileNote?: (note: YouthProfileNote) => void;
  onDeleteProfileNote?: (note: YouthProfileNote) => void;
  profileNotesLoading?: boolean;
  profileNotesError?: string | null;
}

export default function YouthNotesCard({
  profileNotes = [], selected, onSelectProfileNote, canManageProfileNotes = false, onEditProfileNote,
  onDeleteProfileNote, profileNotesLoading = false, profileNotesError,
}: YouthNotesCardProps) {
  const title = selected && !profileNotesLoading ? `Profile Notes (${profileNotes.length})` : 'Profile Notes';
  let content: ReactNode;
  if (!selected) content = <p className="dashboard-card__empty">Select a row to view notes.</p>;
  else if (profileNotesLoading) content = <p className="dashboard-card__empty">Loading profile notes…</p>;
  else if (profileNotesError) content = <p className="form-error">{profileNotesError}</p>;
  else if (!profileNotes.length) content = <p className="dashboard-card__empty">No profile notes recorded.</p>;
  else content = <div className="note-list">{profileNotes.map(note => (
    <ProfileNoteRow
      key={note.id}
      note={note}
      onView={onSelectProfileNote}
      onEdit={canManageProfileNotes ? onEditProfileNote : undefined}
      onDelete={canManageProfileNotes ? onDeleteProfileNote : undefined}
    />
  ))}</div>;

  return (
    <DashboardCard title={title}>
      {content}
    </DashboardCard>
  );
}
