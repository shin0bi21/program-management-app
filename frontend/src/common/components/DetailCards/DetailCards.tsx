import { useState, type ReactNode } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEye, faPen, faTrash } from '@fortawesome/free-solid-svg-icons';
import './DetailCards.css';
import { formatShortDate, getDateKeyInTimeZone } from '../../utils/date';
import type { YouthSessionNote } from '../../types/cohort';
import type { YouthProfileNote } from '../../types/youth';
import { ProfileNoteCategoryBadge } from '../ProfileNoteDetails/ProfileNoteDetails';
import { DashboardCard } from '../DashboardCard/DashboardCard';
import SessionNoteRow from '../SessionNoteRow/SessionNoteRow';
import Button from '../Button/Button';

interface PrimaryContactCardProps {
  contact: {
    phoneNumber?: string | null;
    relationship?: string | null;
  } | null;
  selected: boolean;
  action?: ReactNode;
}

const relationshipLabel = (value?: string | null) => value
  ? value.charAt(0).toUpperCase() + value.slice(1).replace(/_/g, ' ')
  : '—';

export function PrimaryContactCard({ contact, selected, action }: PrimaryContactCardProps) {
  return (
    <DashboardCard
      title="Primary Contact"
      emptyMessage={selected ? 'No primary contact recorded.' : 'Select a row to view the primary contact.'}
      className="primary-contact-card"
      action={action}
    >
      {contact ? (
        <p className="primary-contact-card__summary">
          <span>{contact.phoneNumber || '—'}</span>
          <span>{relationshipLabel(contact.relationship)}</span>
        </p>
      ) : undefined}
    </DashboardCard>
  );
}

export function NotesCard({ notes, selected }: { notes?: string | null; selected: boolean }) {
  return (
    <DashboardCard title="Notes">
      <p className={!selected || !notes?.trim() ? 'dashboard-card__empty' : undefined}>
        {!selected ? 'Select a row to view notes.' : notes?.trim() || 'No notes recorded.'}
      </p>
    </DashboardCard>
  );
}

export type NotesTab = 'profile' | 'session';

export function YouthNotesCard({
  profileNotes = [],
  selected,
  activeTab,
  onTabChange,
  sessionNotes = [],
  sessionNotesLoading = false,
  sessionNotesError,
  onSelectSessionNote,
  canManageSessionNotes = false,
  onEditSessionNote,
  onDeleteSessionNote,
  onSelectProfileNote,
  canManageProfileNotes = false,
  onEditProfileNote,
  onDeleteProfileNote,
  profileNotesLoading = false,
  profileNotesError,
}: {
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
}) {
  let content: ReactNode;
  if (!selected) {
    content = <p className="dashboard-card__empty">Select a row to view notes.</p>;
  } else if (activeTab === 'profile') {
    if (profileNotesLoading) content = <p className="dashboard-card__empty">Loading profile notes…</p>;
    else if (profileNotesError) content = <p className="form-error">{profileNotesError}</p>;
    else if (!profileNotes.length) content = <p className="dashboard-card__empty">No profile notes recorded.</p>;
    else content = <div className="profile-session-notes">{profileNotes.map(note => (
      <div key={note.id} className="profile-session-note profile-session-note--with-actions">
        <div className="profile-session-note__profile-summary">
          <strong>{note.title}</strong>
          <ProfileNoteCategoryBadge category={note.category} />
          <span className="profile-session-note__date">{formatShortDate(note.createdAt)}</span>
        </div>
        <div className="profile-session-note__actions">
          <Button size="sm" variant="ghost" className="profile-session-note__action-button" aria-label={`View ${note.title}`} title="View note" onClick={() => onSelectProfileNote(note)}>
            <FontAwesomeIcon icon={faEye} aria-hidden="true" />
          </Button>
          {canManageProfileNotes && onEditProfileNote && onDeleteProfileNote && <>
            <Button size="sm" variant="ghost" className="profile-session-note__action-button" aria-label={`Edit ${note.title}`} title="Edit note" onClick={() => onEditProfileNote(note)}>
              <FontAwesomeIcon icon={faPen} aria-hidden="true" />
            </Button>
            <Button size="sm" variant="ghost" className="profile-session-note__action-button profile-session-note__action-button--danger" aria-label={`Delete ${note.title}`} title="Delete note" onClick={() => onDeleteProfileNote(note)}>
              <FontAwesomeIcon icon={faTrash} aria-hidden="true" />
            </Button>
          </>}
        </div>
      </div>
    ))}</div>;
  } else if (sessionNotesLoading) {
    content = <p className="dashboard-card__empty">Loading session notes…</p>;
  } else if (sessionNotesError) {
    content = <p className="form-error">{sessionNotesError}</p>;
  } else if (!sessionNotes.length) {
    content = <p className="dashboard-card__empty">No linked session notes.</p>;
  } else {
    content = (
      <div className="session-note-list">
        {sessionNotes.map(note => (
          <SessionNoteRow
            key={note.id}
            note={note}
            date={note.startsAt}
            onView={onSelectSessionNote}
            onEdit={canManageSessionNotes ? onEditSessionNote : undefined}
            onDelete={canManageSessionNotes ? onDeleteSessionNote : undefined}
          />
        ))}
      </div>
    );
  }

  return (
    <DashboardCard
      title="Notes"
      action={(
        <div className="dashboard-card__tabs" role="group" aria-label="Notes view">
          <button
            type="button"
            className={activeTab === 'profile' ? 'is-active' : ''}
            aria-pressed={activeTab === 'profile'}
            onClick={() => onTabChange('profile')}
          >
            Profile
          </button>
          <button
            type="button"
            className={activeTab === 'session' ? 'is-active' : ''}
            aria-pressed={activeTab === 'session'}
            onClick={() => onTabChange('session')}
          >
            Session
          </button>
        </div>
      )}
    >
      {content}
    </DashboardCard>
  );
}

export function AttendanceCard({
  cohorts,
  selected,
}: {
  cohorts?: Array<{
    id: string;
    name: string;
    programName: string;
    rosterMode: 'enrolled' | 'open';
    startsOn: string;
    endsOn: string;
    withdrawnOn: string | null;
    presentCount: number;
    lateCount: number;
    absentCount: number;
    lastAttendedOn: string | null;
  }>;
  selected: boolean;
}) {
  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');
  const today = getDateKeyInTimeZone();
  const visibleCohorts = cohorts?.filter(cohort => {
    const isActive = cohort.startsOn <= today
      && cohort.endsOn >= today
      && cohort.withdrawnOn === null;
    return activeTab === 'active' ? isActive : !isActive;
  }) ?? [];

  return (
    <DashboardCard
      title="Attendance"
      action={selected ? (
        <div className="dashboard-card__tabs" role="group" aria-label="Attendance view">
          <button
            type="button"
            className={activeTab === 'active' ? 'is-active' : ''}
            aria-pressed={activeTab === 'active'}
            onClick={() => setActiveTab('active')}
          >
            Active
          </button>
          <button
            type="button"
            className={activeTab === 'history' ? 'is-active' : ''}
            aria-pressed={activeTab === 'history'}
            onClick={() => setActiveTab('history')}
          >
            History
          </button>
        </div>
      ) : undefined}
      emptyMessage={!selected
        ? 'Select a row to view attendance.'
        : activeTab === 'active'
          ? 'No active cohort attendance.'
          : 'No historical attendance.'}
    >
      {selected && visibleCohorts.length ? (
        <div className="attendance-card__cohorts">
          {visibleCohorts.map(cohort => (
            <div className="attendance-card__cohort" key={cohort.id}>
              <strong>{cohort.programName} · {cohort.name}</strong>
              {cohort.rosterMode === 'open' ? (
                <p className="attendance-card__breakdown">
                  {cohort.presentCount} {cohort.presentCount === 1 ? 'visit' : 'visits'}
                </p>
              ) : (
                <p className="attendance-card__breakdown">
                  Present {cohort.presentCount}
                  <span aria-hidden="true"> · </span>
                  Late {cohort.lateCount}
                  <span aria-hidden="true"> · </span>
                  Absent {cohort.absentCount}
                </p>
              )}
            </div>
          ))}
        </div>
      ) : undefined}
    </DashboardCard>
  );
}
