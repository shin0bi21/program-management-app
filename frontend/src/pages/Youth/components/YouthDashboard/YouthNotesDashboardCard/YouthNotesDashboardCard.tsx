import type { ReactNode } from 'react';
import Button from '../../../../../common/components/Button/Button';
import { DashboardCard } from '../../../../../common/components/DashboardCard/DashboardCard';
import type { YouthProfileNote } from '../../../types';
import ProfileNoteRow from '../../ProfileNotes/ProfileNoteRow';
import UnavailableState from '../../../../../common/components/UnavailableState/UnavailableState';

interface YouthNotesDashboardCardProps {
  profileNotes?: YouthProfileNote[];
  selected: boolean;
  onSelectProfileNote: (note: YouthProfileNote) => void;
  canManageProfileNotes?: boolean;
  onAddProfileNote?: () => void;
  onEditProfileNote?: (note: YouthProfileNote) => void;
  onDeleteProfileNote?: (note: YouthProfileNote) => void;
  profileNotesLoading?: boolean;
  profileNotesError?: string | null;
  onRetry?: () => void;
}

export default function YouthNotesDashboardCard({
  profileNotes = [], selected, onSelectProfileNote, canManageProfileNotes = false, onAddProfileNote, onEditProfileNote,
  onDeleteProfileNote, profileNotesLoading = false, profileNotesError, onRetry,
}: YouthNotesDashboardCardProps) {
  let content: ReactNode;
  if (!selected) content = <p className="dashboard-card__empty">Select a row to view notes.</p>;
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
    <DashboardCard
      title="Notes"
      loading={selected && profileNotesLoading}
      loadingLabel="Loading profile notes…"
      action={canManageProfileNotes ? <Button size="sm" variant="secondary" aria-label="Add profile note" disabled={!selected} onClick={onAddProfileNote}>+ Add</Button> : undefined}
    >
      {content}
    </DashboardCard>
  );
}
