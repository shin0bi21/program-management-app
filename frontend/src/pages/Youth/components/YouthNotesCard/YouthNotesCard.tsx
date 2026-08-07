import type { ReactNode } from 'react';
import { DashboardCard } from '../../../../common/components/DashboardCard/DashboardCard';
import type { YouthSessionNote } from '../../../../common/types/cohort';
import type { YouthProfileNote } from '../../../../common/types/youth';
import SessionNoteRow from '../../../../features/notes/components/SessionNoteRow/SessionNoteRow';
import ProfileNoteRow from '../ProfileNoteRow/ProfileNoteRow';
import YouthDashboardTabs from '../YouthDashboardTabs/YouthDashboardTabs';

export type NotesTab = 'profile' | 'session';

const notesTabs = [
  { value: 'profile', label: 'Profile' },
  { value: 'session', label: 'Session' },
] as const;

interface YouthNotesCardProps {
  profileNotes?: YouthProfileNote[];
  selected: boolean;
  activeTab: NotesTab;
  onTabChange: (tab: NotesTab) => void;
  sessionNotes?: YouthSessionNote[];
  sessionNotesLoading?: boolean;
  sessionNotesError?: string | null;
  onSelectSessionNote: (note: YouthSessionNote) => void;
  canManageSessionNotes?: boolean;
  onEditSessionNote?: (note: YouthSessionNote) => void;
  onDeleteSessionNote?: (note: YouthSessionNote) => void;
  onSelectProfileNote: (note: YouthProfileNote) => void;
  canManageProfileNotes?: boolean;
  onEditProfileNote?: (note: YouthProfileNote) => void;
  onDeleteProfileNote?: (note: YouthProfileNote) => void;
  profileNotesLoading?: boolean;
  profileNotesError?: string | null;
}

export default function YouthNotesCard({
  profileNotes = [], selected, activeTab, onTabChange, sessionNotes = [], sessionNotesLoading = false,
  sessionNotesError, onSelectSessionNote, canManageSessionNotes = false, onEditSessionNote,
  onDeleteSessionNote, onSelectProfileNote, canManageProfileNotes = false, onEditProfileNote,
  onDeleteProfileNote, profileNotesLoading = false, profileNotesError,
}: YouthNotesCardProps) {
  let content: ReactNode;
  if (!selected) content = <p className="dashboard-card__empty">Select a row to view notes.</p>;
  else if (activeTab === 'profile') {
    if (profileNotesLoading) content = <p className="dashboard-card__empty">Loading profile notes…</p>;
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
  } else if (sessionNotesLoading) content = <p className="dashboard-card__empty">Loading session notes…</p>;
  else if (sessionNotesError) content = <p className="form-error">{sessionNotesError}</p>;
  else if (!sessionNotes.length) content = <p className="dashboard-card__empty">No linked session notes.</p>;
  else content = <div className="note-list">{sessionNotes.map(note => (
    <SessionNoteRow
      key={note.id}
      note={note}
      date={note.startsAt}
      onView={onSelectSessionNote}
      onEdit={canManageSessionNotes ? onEditSessionNote : undefined}
      onDelete={canManageSessionNotes ? onDeleteSessionNote : undefined}
    />
  ))}</div>;

  return (
    <DashboardCard
      title="Notes"
      action={<YouthDashboardTabs activeTab={activeTab} ariaLabel="Notes view" onChange={onTabChange} options={notesTabs} />}
    >
      {content}
    </DashboardCard>
  );
}
