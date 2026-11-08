import type { YouthAttendanceSummary } from './YouthAttendanceDashboardCard/youthAttendanceSummary.api';
import Button from '../../../../common/components/Button/Button';
import PrimaryContactDashboardCard from '../../../../common/features/contacts/components/PrimaryContactDashboardCard/PrimaryContactDashboardCard';
import type { YouthProfile } from '../../types';
import type { YouthProfileNote } from '../../types';
import YouthAttendanceDashboardCard from './YouthAttendanceDashboardCard/YouthAttendanceDashboardCard';
import YouthNotesDashboardCard from './YouthNotesDashboardCard/YouthNotesDashboardCard';

type AttendanceProgramCycle = YouthAttendanceSummary;

interface YouthDashboardProps {
  profile: YouthProfile | null;
  canWrite: boolean;
  onManagePrimaryContact: (profile: YouthProfile) => void;
  canReadAttendance: boolean;
  canManageAttendance: boolean;
  onManageAttendance: (programCycle: AttendanceProgramCycle) => void;
  canViewAttendanceReport: boolean;
  onViewAttendanceReport: (programCycle: AttendanceProgramCycle) => void;
  profileNotes: YouthProfileNote[];
  profileNotesLoading: boolean;
  profileNotesError: string | null;
  onRetryProfileNotes?: () => void;
  onSelectProfileNote: (note: YouthProfileNote) => void;
  onAddProfileNote: () => void;
  onEditProfileNote: (note: YouthProfileNote) => void;
  onDeleteProfileNote: (note: YouthProfileNote) => void;
}

/**
 * Displays the selected youth's contact, attendance, and profile-note cards.
 * @param props.profile - Selected saved profile; null displays the cards' no-selection states.
 * @param props.canReadAttendance - Whether to mount the card that loads attendance summaries.
 * @param props - Available actions, note data, and permission flags supplied by the Youth page.
 * @example <YouthDashboard {...dashboardProps} profile={selectedProfile} />
 */
export default function YouthDashboard({
  profile,
  canWrite,
  onManagePrimaryContact,
  canReadAttendance,
  canManageAttendance,
  onManageAttendance,
  canViewAttendanceReport,
  onViewAttendanceReport,
  profileNotes,
  profileNotesLoading,
  profileNotesError,
  onRetryProfileNotes,
  onSelectProfileNote,
  onAddProfileNote,
  onEditProfileNote,
  onDeleteProfileNote,
}: YouthDashboardProps) {
  const selected = profile !== null;

  return <>
    <PrimaryContactDashboardCard
      contact={profile?.contacts?.[0] ? {
        phoneNumber: profile.contacts[0].phoneNumber,
        relationship: profile.contacts[0].type,
      } : null}
      selected={selected}
      action={canWrite ? (
        <Button
          size="sm"
          variant="secondary"
          disabled={!profile}
          aria-label="Manage primary contact"
          onClick={() => {
            if (profile) onManagePrimaryContact(profile);
          }}
        >
          Manage
        </Button>
      ) : undefined}
    />
    {canReadAttendance && <YouthAttendanceDashboardCard
      youthId={profile?.id ?? null}
      canManage={canManageAttendance}
      onManage={onManageAttendance}
      canViewReport={canViewAttendanceReport}
      onViewReport={onViewAttendanceReport}
    />}
    <YouthNotesDashboardCard
      profileNotes={profileNotes}
      selected={selected}
      onSelectProfileNote={onSelectProfileNote}
      canManageProfileNotes={canWrite}
      onAddProfileNote={onAddProfileNote}
      onEditProfileNote={onEditProfileNote}
      onDeleteProfileNote={onDeleteProfileNote}
      profileNotesLoading={profileNotesLoading}
      profileNotesError={profileNotesError}
      onRetry={onRetryProfileNotes}
    />
  </>;
}
