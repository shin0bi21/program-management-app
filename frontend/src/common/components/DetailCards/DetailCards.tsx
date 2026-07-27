import type { ReactNode } from 'react';
import './DetailCards.css';
import { formatShortDate } from '../../utils/date';
import type { YouthSessionNote } from '../../types/cohort';
import { DashboardCard } from '../DashboardCard/DashboardCard';
import { SessionNoteCategoryBadge } from '../SessionNoteDetails/SessionNoteDetails';

interface PrimaryContactCardProps {
  contact: {
    firstName?: string | null;
    lastName?: string | null;
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
          <span>{[contact.firstName, contact.lastName].filter(Boolean).join(' ') || '—'}</span>
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
  notes,
  selected,
  activeTab,
  onTabChange,
  sessionNotes = [],
  sessionNotesLoading = false,
  sessionNotesError,
  onSelectSessionNote,
}: {
  notes?: string | null;
  selected: boolean;
  activeTab: NotesTab;
  onTabChange: (tab: NotesTab) => void;
  sessionNotes?: YouthSessionNote[];
  sessionNotesLoading?: boolean;
  sessionNotesError?: string | null;
  onSelectSessionNote: (note: YouthSessionNote) => void;
}) {
  let content: ReactNode;
  if (!selected) {
    content = <p className="dashboard-card__empty">Select a row to view notes.</p>;
  } else if (activeTab === 'profile') {
    content = (
      <p className={!notes?.trim() ? 'dashboard-card__empty' : undefined}>
        {notes?.trim() || 'No profile notes recorded.'}
      </p>
    );
  } else if (sessionNotesLoading) {
    content = <p className="dashboard-card__empty">Loading session notes…</p>;
  } else if (sessionNotesError) {
    content = <p className="form-error">{sessionNotesError}</p>;
  } else if (!sessionNotes.length) {
    content = <p className="dashboard-card__empty">No linked session notes.</p>;
  } else {
    content = (
      <div className="profile-session-notes">
        {sessionNotes.map(note => (
          <button
            key={note.id}
            type="button"
            className="profile-session-note"
            onClick={() => onSelectSessionNote(note)}
          >
            <span className="profile-session-note__heading">
              <strong>{note.title}</strong>
              <SessionNoteCategoryBadge category={note.category} />
            </span>
            <span>
              {note.programName} · {note.cohortName} · {formatShortDate(note.startsAt)}
            </span>
          </button>
        ))}
      </div>
    );
  }

  return (
    <DashboardCard
      title="Notes"
      action={(
        <div className="notes-card__tabs" role="group" aria-label="Notes view">
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
    presentCount: number;
    lateCount: number;
    absentCount: number;
    lastAttendedOn: string | null;
  }>;
  selected: boolean;
}) {
  return (
    <DashboardCard
      title="Attendance"
      emptyMessage={!selected ? 'Select a row to view attendance.' : 'No attendance recorded.'}
    >
      {selected && cohorts?.length ? (
        <div className="attendance-card__cohorts">
          {cohorts.map(cohort => (
            <div className="attendance-card__cohort" key={cohort.id}>
              <strong>{cohort.rosterMode === 'open'
                ? `${cohort.programName} · ${cohort.name}`
                : cohort.name}</strong>
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
              <p className={!cohort.lastAttendedOn ? 'dashboard-card__empty' : undefined}>
                Last attended: {cohort.lastAttendedOn
                  ? formatShortDate(cohort.lastAttendedOn)
                  : 'Not recorded'}
              </p>
            </div>
          ))}
        </div>
      ) : undefined}
    </DashboardCard>
  );
}
