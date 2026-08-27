import type { ReactNode } from 'react';
import { DashboardCard } from '../../../../../common/components/DashboardCard/DashboardCard';
import type { YouthProfileNote } from '../../../../../common/types/youth';
import ProfileNoteRow from '../../ProfileNotes/ProfileNoteRow';
import UnavailableState from '../../../../../common/components/UnavailableState/UnavailableState';

interface YouthNotesDashboardCardProps {
  profileNotes?: YouthProfileNote[];
  selected: boolean;
  onSelectProfileNote: (note: YouthProfileNote) => void;
  canManageProfileNotes?: boolean;
  onEditProfileNote?: (note: YouthProfileNote) => void;
  onDeleteProfileNote?: (note: YouthProfileNote) => void;
  profileNotesLoading?: boolean;
  profileNotesError?: string | null;
  onRetry?: () => void;
}

export default function YouthNotesDashboardCard({
  profileNotes = [], selected, onSelectProfileNote, canManageProfileNotes = false, onEditProfileNote,
  onDeleteProfileNote, profileNotesLoading = false, profileNotesError, onRetry,
}: YouthNotesDashboardCardProps) {
  const title = selected && !profileNotesLoading ? `Profile Notes (${profileNotes.length})` : 'Profile Notes';
  let content: ReactNode;
  if (!selected) content = <p className="dashboard-card__empty">Select a row to view notes.</p>;
  else if (profileNotesLoading) content = <p className="dashboard-card__empty">Loading profile notes…</p>;
  else if (profileNotesError) content = <UnavailableState compact title="Profile notes unavailable" onRetry={onRetry} />;
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
